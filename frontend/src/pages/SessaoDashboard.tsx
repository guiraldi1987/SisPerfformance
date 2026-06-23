import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import { formatData } from '../lib/format';
import { posicaoCodigo, POSICAO_COLOR, posicaoLabel } from '../lib/constants';
import { VolumeIntensityScatter, type ScatterPoint } from '../components/charts/VolumeIntensityScatter';
import { BoxPlotByPosition } from '../components/charts/BoxPlotByPosition';
import { EditSessaoModal } from '../components/EditSessaoModal';
import { LoadingState } from '../components/ui/LoadingState';
import { useToast } from '../components/Toast';
import { RatioCell, computeECRatio } from '../components/RatioCell';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sessao {
  id: number; data: string; tipo: string;
  descricao: string | null; equipe: string | null; local: string | null;
}

interface AtletaRow {
  jogadorId: number; nome: string; apelido: string | null; posicao: string | null;
  periodo: string;
  duracao: number | null; distanciaTotal: number | null; velocidadeMaxima: number | null;
  metragemPorMinuto: number | null; hsr: number | null; hsrEsforcos: number | null;
  hsrPorMinuto: number | null;
  sprint: number | null; sprintEsforcos: number | null; sprintPorMinuto: number | null;
  aceleracoes: number | null; desaceleracoes: number | null;
  acelDesacelTotal: number | null; acelDesacelPorMinuto: number | null;
  cargaJogador: number | null; cargaPorMinuto: number | null;
}

interface PeriodoCard {
  nome: string; atletasCount: number; duracao: number;
  distanciaMedia: number; metragemPorMinuto: number;
  hsrMedia: number; hsrPorMinuto: number;
  sprintMedia: number; acelDesacelMedia: number; acelDesacelPorMinuto: number;
  cargaMedia: number; volumePct: number; intensidadePct: number;
}

interface Medias {
  distanciaTotal: number; metragemPorMinuto: number; velocidadeMaxima: number;
  hsr: number; hsrEsforcos: number; hsrPorMinuto: number;
  sprint: number; sprintEsforcos: number; sprintPorMinuto: number;
  aceleracoes: number; desaceleracoes: number;
  acelDesacelTotal: number; acelDesacelPorMinuto: number;
  cargaJogador: number; cargaPorMinuto: number;
}

interface Historico {
  amostras: number;
  distanciaTotal: number; metragemPorMinuto: number; velocidadeMaxima: number;
  hsr: number; hsrPorMinuto: number;
  sprint: number; sprintPorMinuto: number;
  acelDesacelTotal: number; acelDesacelPorMinuto: number;
  cargaJogador: number; cargaPorMinuto: number;
}

interface Participacao { full: number; na: number; total: number; }

interface ZonasVelocidade {
  standing: number; walking: number; jogging: number;
  running: number; hi: number; sprint: number;
}

interface AnaliseData {
  sessao: Sessao; tempoTotal: number;
  periodos: PeriodoCard[];
  atletasSession: AtletaRow[]; medias: Medias | null;
  historico: Historico | null;
  participacao: Participacao;
  zonasVelocidade: ZonasVelocidade | null;
}

type Tab = 'resumo' | 'periodos' | 'atletas';

// ─── Benchmarks (Match Day reference) ─────────────────────────────────────────
// Valores típicos de uma partida profissional de 90min — base "100%".
// Usado como FALLBACK quando a posição do atleta ainda não tem amostras
// suficientes em /api/analytics/posicoes-benchmarks.
const MD = {
  distanciaTotal:       10000,
  hsr:                  600,
  acelDesacelTotal:     80,
  metragemPorMinuto:    95,
  hsrPorMinuto:         6,
  acelDesacelPorMinuto: 1.0,
};

// Benchmark dinâmico vindo do endpoint — um por posição
interface PosicaoBenchmark {
  posicao: string;
  amostras: number;
  distanciaTotal: number;
  metragemPorMinuto: number;
  hsr: number;
  hsrPorMinuto: number;
  sprint: number;
  sprintPorMinuto: number;
  acelDesacelTotal: number;
  acelDesacelPorMinuto: number;
  cargaJogador: number;
}

type PosBenchMap = Record<string, PosicaoBenchmark>;

// Resolve benchmark para uma posição: usa o dinâmico (se com ≥3 amostras)
// senão cai no MD global. Centraliza a regra para evitar bugs de divisão.
const benchFor = (
  posicao: string | null | undefined,
  key: keyof typeof MD,
  map: PosBenchMap | null,
): number => {
  if (posicao && map && map[posicao] && map[posicao]!.amostras >= 3) {
    const v = map[posicao]![key];
    if (v && v > 0) return v;
  }
  return MD[key];
};

// ─── Colors (PDF reference) ───────────────────────────────────────────────────
const C = {
  volume:   '#0d9488',  // teal/cyan
  geral:    '#7c3aed',  // purple
  intens:   '#1e3a5f',  // navy
  bench:    '#94a3b8',  // benchmark line
  bg:       '#e2e8f0',
};

// Cores fixas por métrica (para mini-barras na tabela de atletas)
const M_COLOR = {
  dist:   '#0d9488', // teal
  mpm:    '#1e3a5f', // navy
  carga:  '#7c3aed', // purple - Player Load
  cMin:   '#a855f7', // light purple - PL/min
  hsr:    '#f59e0b', // orange — Z4
  hsrE:   '#f59e0b',
  sprint: '#ef4444', // red — Z5
  sprE:   '#ef4444',
  acel:   '#0891b2', // cyan
  desac:  '#a855f7', // purple
  acelD:  '#64748b', // slate
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n = (v: number | null | undefined) => v ?? 0;

const fmtSec = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const fmtNum = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// Mini-barra de intensidade ao lado do número (estilo PDF) - responsiva e fluida
const BarCell: React.FC<{ value: number; max: number; color: string; dec?: number }> = ({
  value, max, color, dec = 0,
}) => {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const showBar = value > 0 && max > 0;
  return (
    <div className="flex items-center justify-end gap-1">
      <span className="font-mono text-[10.5px] xl:text-[11.5px] tabular-nums text-slate-700 dark:text-slate-200 font-semibold transition-colors duration-200">
        {value.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })}
      </span>
      <div className="hidden sm:block w-3 md:w-5 lg:w-7 h-1.5 bg-slate-100/80 dark:bg-white/[0.04] rounded-sm overflow-hidden shrink-0 border border-slate-200/50 dark:border-white/[0.04] relative">
        {showBar && (
          <div 
            className="h-full rounded-sm transition-all duration-500 ease-out" 
            style={{ 
              width: `${Math.max(ratio * 100, 6)}%`, 
              backgroundColor: color
            }} 
          />
        )}
      </div>
    </div>
  );
};

// ─── Components ───────────────────────────────────────────────────────────────

// Setinha ↑↓ com delta % vs histórico do mesmo tipo de sessão
const DeltaBadge: React.FC<{
  current: number; reference: number | null | undefined;
  size?: 'sm' | 'md';
  threshold?: number; // delta absoluto considerado "estável" (em %)
}> = ({ current, reference, size = 'sm', threshold = 3 }) => {
  if (reference == null || reference <= 0) return null;
  const delta = ((current - reference) / reference) * 100;
  const flat = Math.abs(delta) < threshold;
  const arrow = flat ? '→' : delta > 0 ? '↑' : '↓';
  
  const bgClass = flat 
    ? 'bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-white/[0.02]'
    : delta > 0 
      ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
      : 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20';

  const sz = size === 'md' ? 'text-[11px] px-2 py-0.5' : 'text-[9px] px-1.5 py-0.2';
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono font-bold tracking-wide rounded-full border tabular-nums ${bgClass} ${sz}`}
      title={`vs média histórica (${reference.toLocaleString('pt-BR', { maximumFractionDigits: 1 })})`}
    >
      <span className="font-sans leading-none">{arrow}</span>
      <span className="leading-none">{flat ? 'estável' : `${Math.abs(delta).toFixed(0)}%`}</span>
    </span>
  );
};

// Donut com porcentagem grande no centro e gradiente sofisticado
const Donut: React.FC<{
  pct: number; color: string; label: string; size?: number;
  delta?: { current: number; reference: number | null | undefined };
}> = ({ pct, color, label, size = 110, delta }) => {
  const r = size * 0.38, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(Math.max(pct, 0) / 100, 2) * circ; // permite >100%
  const strokeW = size * 0.10;
  
  // ID exclusivo do gradiente para este donut (para não conflitar)
  const gradId = `donut-grad-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.round(pct)}`;
  
  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className="relative card-bounce hover:scale-105 duration-300">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:drop-shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={`${color}cc`} />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
            {/* Filtro de glow sutil para dar efeito de neon */}
            <filter id={`glow-${gradId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Círculo de fundo */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor"
            strokeWidth={strokeW} className="text-slate-100 dark:text-white/[0.04]" />
          {/* Círculo preenchido */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${gradId})`}
            strokeWidth={strokeW} strokeDasharray={`${filled} ${circ * 2}`}
            strokeDashoffset={circ * 0.25} strokeLinecap="round"
            filter={`url(#glow-${gradId})`} className="transition-all duration-1000 ease-out" />
          {/* Texto central */}
          <text x={cx} y={cy + size * 0.07} textAnchor="middle"
            fontSize={size * 0.23} fontWeight="800" fill={color} className="font-outfit tracking-tighter">
            {Math.round(pct)}%
          </text>
        </svg>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="font-outfit text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors duration-200">
          {label}
        </span>
        {delta && <DeltaBadge current={delta.current} reference={delta.reference} size="sm" />}
      </div>
    </div>
  );
};

// Barra horizontal estilo PDF: [valor] [████|░░░] [%]  com linha vertical em 100%
const BenchBar: React.FC<{
  label: string; value: number; benchmark: number; dec?: number;
  color?: string;
  histRef?: number | null;  // referência histórica (para setinha delta)
}> = ({ label, value, benchmark, dec = 0, color = C.volume, histRef }) => {
  const VIEW_MAX = benchmark * 2;
  const pctVal = benchmark > 0 ? (value / benchmark) * 100 : 0;
  const fillW = Math.min((value / VIEW_MAX) * 100, 100);

  const histPos = histRef && histRef > 0 && benchmark > 0
    ? Math.min((histRef / VIEW_MAX) * 100, 100)
    : null;

  return (
    <div className="grid grid-cols-[74px_50px_1fr_40px_50px] items-center gap-3 text-[11px] py-1.5 group/bench">
      <span className="text-slate-500 dark:text-slate-400 font-semibold truncate group-hover/bench:text-slate-700 dark:group-hover/bench:text-slate-300 transition-colors">
        {label}
      </span>
      <span className="text-right font-mono font-bold tabular-nums text-slate-800 dark:text-slate-200">
        {fmtNum(value, dec)}
      </span>
      <div className="relative h-2.5 bg-slate-100 dark:bg-white/[0.03] rounded-full overflow-hidden border border-slate-200/30 dark:border-white/[0.02]">
        <div 
          className="h-full rounded-full transition-all duration-700 ease-out relative" 
          style={{ 
            width: `${fillW}%`, 
            background: `linear-gradient(90deg, ${color}dd, ${color})` 
          }} 
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent" />
        </div>
        {/* Linha de benchmark 100% (centralizada) */}
        <div className="absolute top-0 bottom-0 w-px bg-slate-400 dark:bg-white/20" style={{ left: '50%' }} />
        {/* Marcador da média histórica */}
        {histPos != null && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-slate-800 dark:bg-white"
               style={{ left: `${histPos}%` }}
               title={`Média histórica: ${fmtNum(histRef!, dec)}`} />
        )}
      </div>
      <span className="text-right font-mono font-bold text-[10px] text-slate-600 dark:text-slate-300 tabular-nums">
        {Math.round(pctVal)}%
      </span>
      <div className="flex justify-end">
        <DeltaBadge current={value} reference={histRef ?? null} size="sm" />
      </div>
    </div>
  );
};

// ─── Volume & Intensity Chart por jogador ─────────────────────────────────────

const VolumeIntensityChart: React.FC<{
  atletas: AtletaRow[];
  posBench: PosBenchMap | null;
}> = ({ atletas, posBench }) => {
  const computePct = (a: AtletaRow) => ({
    vol: (n(a.distanciaTotal)    / benchFor(a.posicao, 'distanciaTotal',    posBench)) * 100,
    int: (n(a.metragemPorMinuto) / benchFor(a.posicao, 'metragemPorMinuto', posBench)) * 100,
  });

  const maxVal = Math.max(
    ...atletas.flatMap(a => {
      const { vol, int } = computePct(a);
      return [vol, int];
    }),
    100,
  );
  const yMax = Math.ceil(maxVal / 250) * 250;
  const CHART_H = 220;

  const grupos = new Map<string, AtletaRow[]>();
  for (const a of [...atletas].sort((x, y) =>
    (x.posicao ?? 'ZZ').localeCompare(y.posicao ?? 'ZZ') || x.nome.localeCompare(y.nome)
  )) {
    const pos = a.posicao ?? 'S/P';
    if (!grupos.has(pos)) grupos.set(pos, []);
    grupos.get(pos)!.push(a);
  }

  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  return (
    <div className="overflow-x-auto" tabIndex={0} aria-label="Gráfico de volume e intensidade por atleta">
      <div className="flex gap-6 mb-4 justify-center text-xs font-outfit uppercase tracking-wider font-bold">
        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="w-3.5 h-3.5 rounded-md inline-block shadow-sm shadow-[#0d9488]/30" style={{ background: `linear-gradient(135deg, #0d9488, #14b8a6)` }} />
          Volume (Distância %)
        </span>
        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="w-3.5 h-3.5 rounded-md inline-block shadow-sm shadow-[#1e3a5f]/30" style={{ background: `linear-gradient(135deg, #1e3a5f, #3b82f6)` }} />
          Intensidade (m/min %)
        </span>
      </div>

      <div className="flex mt-2">
        {/* Y-axis */}
        <div className="flex flex-col-reverse justify-between items-end pr-3 text-[10px] font-mono font-bold text-slate-400/80" style={{ height: CHART_H + 18 }}>
          {yTicks.map(t => <span key={t}>{Math.round(t)}%</span>)}
        </div>

        {/* Chart */}
        <div className="flex-1 min-w-[700px]">
          <div className="relative stripe-bg rounded-xl bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.04] px-4 overflow-hidden" style={{ height: CHART_H }}>
            {/* Grid lines */}
            {yTicks.map((t, i) => (
              <div key={i} className="absolute left-0 right-0 border-t border-slate-200/30 dark:border-white/[0.03]"
                style={{ bottom: (t / yMax) * CHART_H }} />
            ))}

            {/* Linha vermelha pontilhada em 100% benchmark de jogo */}
            <div className="absolute left-0 right-0 border-t border-dashed border-club-red/30 z-10"
              style={{ bottom: (100 / yMax) * CHART_H }}
              title="100% Benchmark" />

            <div className="absolute inset-x-4 bottom-0 top-2 flex items-end gap-1.5">
              {Array.from(grupos.entries()).map(([pos, players]) => (
                <div key={pos} className="flex flex-col flex-1 min-w-0 h-full justify-end">
                  <div className="flex gap-1.5 items-end justify-around h-full pb-1">
                    {players.map(a => {
                      const { vol, int } = computePct(a);
                      const volH = Math.max((vol / yMax) * CHART_H, 1);
                      const intH = Math.max((int / yMax) * CHART_H, 1);
                      return (
                        <div key={a.jogadorId} className="flex items-end gap-0.5 relative group/bar hover:scale-x-110 duration-200 z-10">
                          {/* Volume Bar */}
                          <div 
                            className="w-3.5 rounded-t-md cursor-help relative shadow-[0_2px_10px_rgba(13,148,136,0.1)] transition-all duration-500 ease-out" 
                            title={`${a.apelido || a.nome}: Volume ${Math.round(vol)}%`}
                            style={{ 
                              height: `${volH}px`, 
                              background: `linear-gradient(180deg, #14b8a6, #0d9488)`
                            }}
                          >
                            <div className="absolute inset-x-0 top-0 h-0.5 bg-white/20 rounded-t-md" />
                            {vol > yMax * 0.8 && (
                              <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-500 font-mono">
                                {Math.round(vol)}
                              </span>
                            )}
                          </div>
                          {/* Intensity Bar */}
                          <div 
                            className="w-3.5 rounded-t-md cursor-help relative shadow-[0_2px_10px_rgba(30,58,95,0.1)] transition-all duration-500 ease-out" 
                            title={`${a.apelido || a.nome}: Intensidade ${Math.round(int)}%`}
                            style={{ 
                              height: `${intH}px`, 
                              background: `linear-gradient(180deg, #3b82f6, #1e3a5f)`
                            }}
                          >
                            <div className="absolute inset-x-0 top-0 h-0.5 bg-white/20 rounded-t-md" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex gap-1.5 mt-2 px-4">
            {Array.from(grupos.entries()).map(([pos, players]) => (
              <div key={pos} className="flex flex-col flex-1 min-w-0 border-t border-slate-200 dark:border-white/10 pt-1.5">
                <div className="flex gap-1.5 items-start justify-around">
                  {players.map(a => {
                    const nome = (a.apelido || a.nome.split(',')[0] || a.nome).slice(0, 9);
                    return (
                      <div key={a.jogadorId} className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 truncate text-center"
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 55, minWidth: 14 }}>
                        {nome}
                      </div>
                    );
                  })}
                </div>
                <div className="text-[10px] font-extrabold font-outfit text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center mt-2 bg-slate-100/50 dark:bg-white/[0.02] py-0.5 rounded border border-slate-200/30 dark:border-white/[0.02]">
                  {pos}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Tab 1 — Resumo ───────────────────────────────────────────────────────────

// ─── Tab 1 — Resumo ───────────────────────────────────────────────────────────

const TabResumo: React.FC<{
  data: AnaliseData;
  posBench: PosBenchMap | null;
}> = ({ data, posBench }) => {
  const { medias, historico, participacao, atletasSession } = data;

  // Score composto: média de % vs MD para 3 métricas absolutas (vol) e 3 por-minuto (int)
  const scoreOf = (m: Medias | Historico) => {
    const dPct  = (m.distanciaTotal       / MD.distanciaTotal)       * 100;
    const hPct  = (m.hsr                  / MD.hsr)                  * 100;
    const aPct  = (m.acelDesacelTotal     / MD.acelDesacelTotal)     * 100;
    const mPct  = (m.metragemPorMinuto    / MD.metragemPorMinuto)    * 100;
    const hmPct = (m.hsrPorMinuto         / MD.hsrPorMinuto)         * 100;
    const amPct = (m.acelDesacelPorMinuto / MD.acelDesacelPorMinuto) * 100;
    const volume = (dPct + hPct + aPct) / 3;
    const intens = (mPct + hmPct + amPct) / 3;
    return { volume, intens, geral: (volume + intens) / 2 };
  };

  const scores    = useMemo(() => medias    ? scoreOf(medias)    : null, [medias]);
  const histScore = useMemo(() => historico ? scoreOf(historico) : null, [historico]);

  return (
    <div className="space-y-6">

      {/* ═══ Linha 1: Resumo (esq) + Participação (dir) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* RESUMO ─────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl relative overflow-hidden group">
          {/* Luz de fundo decorativa */}
          <div className="absolute -right-24 -top-24 w-48 h-48 rounded-full bg-club-red/5 blur-3xl group-hover:bg-club-red/10 transition-all duration-500 pointer-events-none" />
          
          <div className="flex items-baseline justify-between mb-1.5 z-10 relative">
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-outfit uppercase tracking-tight">Resumo da Sessão</h2>
            {historico && historico.amostras > 0 && (
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-outfit">
                Baseado em <b className="text-club-red dark:text-club-red-light font-extrabold">{historico.amostras}</b> sessões históricas
              </span>
            )}
          </div>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-6 uppercase tracking-wider z-10 relative">MD Comparação · barra preta = média histórica</p>

          {/* 3 donuts grandes */}
          {scores && (
            <div className="flex justify-around mb-6 py-4 bg-slate-50/30 dark:bg-white/[0.01] rounded-2xl border border-slate-200/20 dark:border-white/[0.02] z-10 relative">
              <Donut pct={scores.volume} color={C.volume} label="Volume"      size={110}
                delta={histScore ? { current: scores.volume, reference: histScore.volume } : undefined} />
              <Donut pct={scores.geral}  color={C.geral}  label="Geral"       size={115}
                delta={histScore ? { current: scores.geral,  reference: histScore.geral  } : undefined} />
              <Donut pct={scores.intens} color={C.intens} label="Intensidade" size={110}
                delta={histScore ? { current: scores.intens, reference: histScore.intens } : undefined} />
            </div>
          )}

          {/* 2 colunas de barras */}
          {medias && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 border-t border-slate-200/40 dark:border-white/[0.04] pt-5 z-10 relative">
              {/* Coluna esquerda — Volume (absoluto) */}
              <div className="space-y-1">
                <BenchBar label="Distância (m)"   value={medias.distanciaTotal}   benchmark={MD.distanciaTotal}   color={C.volume} histRef={historico?.distanciaTotal} />
                <BenchBar label="Dist. HS (m)"    value={medias.hsr}              benchmark={MD.hsr}              color={C.volume} histRef={historico?.hsr} />
                <BenchBar label="Acel.+Desacel."  value={medias.acelDesacelTotal} benchmark={MD.acelDesacelTotal} color={C.volume} histRef={historico?.acelDesacelTotal} />
                <p className="text-center font-mono text-[9px] font-extrabold text-slate-400 dark:text-slate-600 mt-2 tracking-widest uppercase">100% Benchmark de Jogo</p>
              </div>
              {/* Coluna direita — Intensidade (por minuto) */}
              <div className="space-y-1">
                <BenchBar label="m/min"            value={medias.metragemPorMinuto}    benchmark={MD.metragemPorMinuto}    dec={1} color={C.intens} histRef={historico?.metragemPorMinuto} />
                <BenchBar label="Dist. HS m/min"   value={medias.hsrPorMinuto}         benchmark={MD.hsrPorMinuto}         dec={1} color={C.intens} histRef={historico?.hsrPorMinuto} />
                <BenchBar label="Acel.+Desac./min" value={medias.acelDesacelPorMinuto} benchmark={MD.acelDesacelPorMinuto} dec={2} color={C.intens} histRef={historico?.acelDesacelPorMinuto} />
                <p className="text-center font-mono text-[9px] font-extrabold text-slate-400 dark:text-slate-600 mt-2 tracking-widest uppercase">100% Benchmark de Jogo</p>
              </div>
            </div>
          )}
        </div>

        {/* PARTICIPAÇÃO ──────────────────────────────────────────────── */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
          {/* Luz de fundo decorativa */}
          <div className="absolute -left-20 -bottom-20 w-44 h-44 rounded-full bg-[#0d9488]/5 blur-3xl group-hover:bg-[#0d9488]/10 transition-all duration-500 pointer-events-none" />
          
          <div className="z-10 relative">
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-outfit uppercase tracking-tight mb-1.5">Participação</h2>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Presença do plantel na sessão</p>
          </div>
          {(() => {
            const total = participacao.total || 1;
            const fullPct = (participacao.full / total) * 100;
            const r = 50, cx = 70, cy = 70, circ = 2 * Math.PI * r;
            const filled = (fullPct / 100) * circ;
            return (
              <div className="flex flex-col items-center gap-4 py-4 z-10 relative">
                <div className="relative card-bounce duration-300">
                  <svg width="140" height="140" viewBox="0 0 140 140" className="filter drop-shadow-[0_4px_12px_rgba(13,148,136,0.15)]">
                    <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth="18" stroke="currentColor" className="text-slate-100 dark:text-white/[0.03]" />
                    <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth="18" stroke={C.volume}
                      strokeDasharray={`${filled} ${circ}`} strokeDashoffset={circ * 0.25} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                    <text x={cx} y={cy + 8} textAnchor="middle" fontSize="22" fontWeight="900" fill={C.volume} className="font-outfit">
                      {Math.round(fullPct)}%
                    </text>
                  </svg>
                </div>
                <div className="flex gap-4 text-xs font-outfit font-bold">
                  <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.02] px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-white/[0.02]">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: C.volume }} />
                    Full ({participacao.full})
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.02] px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-white/[0.02]">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-white/20 inline-block" />
                    N/A ({participacao.na})
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ═══ Linha 2: Volume & Intensity ═══ */}
      {atletasSession.length > 0 && (
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl card-bounce">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-outfit uppercase tracking-tight">Comparativo: Volume &amp; Intensidade Individual</h2>
            {posBench && Object.keys(posBench).length > 0 && (
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-outfit uppercase tracking-wider">
                Benchmark dinâmico por posição (Média de Jogos)
              </span>
            )}
          </div>
          <VolumeIntensityChart atletas={atletasSession} posBench={posBench} />
        </div>
      )}

      {/* ═══ Linha 3: Scatter Volume × Intensidade ═══ */}
      {atletasSession.length > 0 && (() => {
        const pontos: ScatterPoint[] = atletasSession
          .filter(a => n(a.distanciaTotal) > 0)
          .map(a => ({
            jogadorId:      a.jogadorId,
            nome:           a.nome,
            apelido:        a.apelido,
            posicao:        a.posicao,
            volumePct:      (n(a.distanciaTotal)    / benchFor(a.posicao, 'distanciaTotal',    posBench)) * 100,
            intensidadePct: (n(a.metragemPorMinuto) / benchFor(a.posicao, 'metragemPorMinuto', posBench)) * 100,
          }));
        if (pontos.length === 0) return null;
        const usaDinamico = posBench && Object.keys(posBench).length > 0;
        return (
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl card-bounce">
            <div className="mb-4">
              <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-outfit uppercase tracking-tight">Perfil do Atleta · Volume × Intensidade</h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5 uppercase tracking-wide">
                Cada ponto = um atleta · cor pela posição · faixa central verde = zona ideal
                {usaDinamico && ' · 100% = média da posição em jogos'}
              </p>
            </div>
            <VolumeIntensityScatter pontos={pontos} />
          </div>
        );
      })()}

      {/* ═══ Linha 4: Box Plot por Posição ═══ */}
      {atletasSession.length >= 2 && (
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl card-bounce">
          <div className="mb-3">
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-outfit uppercase tracking-tight">Distribuição por Posição</h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5 uppercase tracking-wide">
              Caixa = quartis Q1–Q3 da posição · linha grossa = mediana · pontos = atletas fora do intervalo (Tukey 1.5×IQR)
            </p>
          </div>
          <BoxPlotByPosition atletas={atletasSession} />
        </div>
      )}

      {/* ═══ Linha 5: Zonas de Velocidade ═══ */}
      {data.zonasVelocidade && <ZonasVelocidadeChart zonas={data.zonasVelocidade} />}
    </div>
  );
};

// ─── Gráfico de Distribuição por Zona de Velocidade ──────────────────────────

const ZONAS_VEL = [
  { key: 'standing', label: 'Z1 · Parado',     range: '0–6 km/h',     color: '#94a3b8' },
  { key: 'walking',  label: 'Z2 · Caminhada',  range: '6–11 km/h',    color: '#10b981' },
  { key: 'jogging',  label: 'Z3 · Trote',      range: '11–14 km/h',   color: '#3b82f6' },
  { key: 'running',  label: 'Z4 · Corrida',    range: '14–19 km/h',   color: '#eab308' },
  { key: 'hi',       label: 'Z5 · Alta Int.',  range: '19–25 km/h',   color: '#f97316' },
  { key: 'sprint',   label: 'Z6 · Sprint',     range: '> 25 km/h',    color: '#dc2626' },
] as const;

const ZonasVelocidadeChart: React.FC<{ zonas: ZonasVelocidade }> = ({ zonas }) => {
  const total = ZONAS_VEL.reduce((s, z) => s + (zonas[z.key] ?? 0), 0);

  return (
    <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group/zonas">
      {/* Luz de fundo decorativa */}
      <div className="absolute -right-24 -bottom-24 w-48 h-48 rounded-full bg-slate-500/5 blur-3xl pointer-events-none" />

      <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-outfit uppercase tracking-tight mb-0.5">
        Distribuição por Zona de Velocidade
      </h2>
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-5 uppercase tracking-wider">
        Distância total do time em cada zona ({fmtNum(total)} m no total)
      </p>

      {/* Stacked bar premium com brilho e borda arredondada */}
      <div className="flex h-8 rounded-xl overflow-hidden border border-slate-200/40 dark:border-white/[0.04] mb-6 p-0.5 bg-slate-100/50 dark:bg-white/[0.01] shadow-inner">
        {ZONAS_VEL.map(z => {
          const v = zonas[z.key] ?? 0;
          const pct = total > 0 ? (v / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div 
              key={z.key} 
              className="flex items-center justify-center text-[10px] font-mono font-extrabold text-white transition-all duration-300 hover:brightness-110 relative group/segment"
              style={{ width: `${pct}%`, background: z.color }}
              title={`${z.label}: ${fmtNum(v)} m (${pct.toFixed(1)}%)`}
            >
              {/* Brilho interno do segmento */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
              {pct >= 5 && <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{pct.toFixed(0)}%</span>}
            </div>
          );
        })}
      </div>

      {/* Detalhamento em cards de vidro com micro-interações */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {ZONAS_VEL.map(z => {
          const v = zonas[z.key] ?? 0;
          const pct = total > 0 ? (v / total) * 100 : 0;
          return (
            <div 
              key={z.key} 
              className="flex flex-col gap-1 px-4 py-3.5 rounded-xl border border-slate-200/50 dark:border-white/[0.04] bg-white/40 dark:bg-white/[0.01] transition-all duration-300 hover:scale-[1.03] hover:shadow-lg dark:hover:shadow-black/20 group/card relative overflow-hidden"
            >
              {/* Brilho decorativo que ativa no hover */}
              <div 
                className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: `radial-gradient(circle at 50% 0%, ${z.color}0a, transparent 70%)` }}
              />
              
              <div className="flex items-center gap-1.5 z-10 relative">
                <span className="w-2 h-2 rounded-full shadow-sm animate-pulse" style={{ background: z.color }} />
                <span className="text-[10px] font-extrabold font-outfit uppercase tracking-widest" style={{ color: z.color }}>
                  {z.label}
                </span>
              </div>
              <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 z-10 relative">{z.range}</p>
              
              <div className="mt-2 flex items-baseline gap-1 z-10 relative">
                <span className="text-lg font-black font-outfit tracking-tighter tabular-nums text-slate-800 dark:text-slate-100 group-hover/card:text-slate-950 dark:group-hover/card:text-white transition-colors">
                  {fmtNum(v)}
                </span>
                <span className="text-[10px] font-extrabold text-slate-400 font-outfit uppercase">m</span>
              </div>
              
              <div className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums z-10 relative">
                {pct.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Tab 2 — Análise de Períodos ──────────────────────────────────────────────

const TabPeriodos: React.FC<{ data: AnaliseData }> = ({ data }) => {
  const { periodos } = data;

  if (periodos.length === 0) {
    return (
      <div className="glass-panel p-10 rounded-2xl text-center">
        <p className="text-slate-400 dark:text-slate-500 font-semibold text-sm">
          Nenhum dado de período disponível.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {periodos.map(p => {
        // Volume = média das 3 métricas absolutas vs MD
        const volPct = (
          (p.distanciaMedia       / MD.distanciaTotal)       * 100 +
          (p.hsrMedia             / MD.hsr)                  * 100 +
          (p.acelDesacelMedia     / MD.acelDesacelTotal)     * 100
        ) / 3;
        const intPct = (
          (p.metragemPorMinuto    / MD.metragemPorMinuto)    * 100 +
          (p.hsrPorMinuto         / MD.hsrPorMinuto)         * 100 +
          (p.acelDesacelPorMinuto / MD.acelDesacelPorMinuto) * 100
        ) / 3;

        return (
          <div 
            key={p.nome} 
            className="glass-panel p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl dark:hover:shadow-black/20 relative overflow-hidden group/periodo"
          >
            {/* Luz de fundo decorativa */}
            <div className="absolute -right-20 -top-20 w-40 h-40 rounded-full bg-club-red/5 blur-3xl pointer-events-none group-hover/periodo:bg-club-red/10 transition-colors duration-500" />
            
            <div className="flex items-start justify-between mb-6 z-10 relative">
              <div className="space-y-2">
                <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-outfit uppercase tracking-tight">
                  {p.nome}
                </h3>
                
                <div className="flex flex-col gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    Duração: 
                    <b className="font-mono text-slate-700 dark:text-slate-300 font-bold bg-slate-100 dark:bg-white/[0.04] px-2 py-0.5 rounded border border-slate-200/50 dark:border-white/[0.02] ml-1">
                      {fmtSec(p.duracao)}
                    </b>
                  </span>
                  <span className="flex items-center gap-1">
                    Atletas: 
                    <b className="font-mono text-slate-700 dark:text-slate-300 font-bold bg-slate-100 dark:bg-white/[0.04] px-2 py-0.5 rounded border border-slate-200/50 dark:border-white/[0.02] ml-1">
                      {p.atletasCount}
                    </b>
                  </span>
                </div>
              </div>
              
              <div className="flex gap-4 shrink-0 bg-white/40 dark:bg-white/[0.01] p-2.5 rounded-xl border border-slate-200/50 dark:border-white/[0.03]">
                <Donut pct={volPct} color={C.volume} label="Volume"      size={84} />
                <Donut pct={intPct} color={C.intens} label="Intensidade" size={84} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 border-t border-slate-200/40 dark:border-white/[0.04] pt-4 z-10 relative">
              <div className="space-y-1">
                <BenchBar label="Distância (m)"  value={p.distanciaMedia}   benchmark={MD.distanciaTotal}   color={C.volume} />
                <BenchBar label="Dist. HS (m)"   value={p.hsrMedia}         benchmark={MD.hsr}              color={C.volume} />
                <BenchBar label="Acel.+Desac."   value={p.acelDesacelMedia} benchmark={MD.acelDesacelTotal} color={C.volume} />
              </div>
              <div className="space-y-1">
                <BenchBar label="m/min"            value={p.metragemPorMinuto}    benchmark={MD.metragemPorMinuto}    dec={1} color={C.intens} />
                <BenchBar label="Dist. HS m/min"   value={p.hsrPorMinuto}         benchmark={MD.hsrPorMinuto}         dec={1} color={C.intens} />
                <BenchBar label="Acel.+Desac./min" value={p.acelDesacelPorMinuto} benchmark={MD.acelDesacelPorMinuto} dec={2} color={C.intens} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Tab 3 — Análise do Atleta ────────────────────────────────────────────────

type SortKey = 'nome' | 'posicao' | 'distanciaTotal' | 'metragemPorMinuto'
  | 'cargaJogador' | 'cargaPorMinuto' | 'velocidadeMaxima'
  | 'hsr' | 'hsrEsforcos' | 'sprint' | 'sprintEsforcos'
  | 'aceleracoes' | 'desaceleracoes' | 'acelDesacelTotal';
type SortDir = 'asc' | 'desc';

const TabAtletas: React.FC<{ atletas: AtletaRow[] }> = ({ atletas }) => {
  const navigate = useNavigate();

  const [busca, setBusca]     = useState('');
  const [filtroPos, setFiltroPos] = useState<string>('Todas');
  const [sortBy, setSortBy]   = useState<SortKey>('nome');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const posicoes = useMemo(() => {
    const s = new Set<string>();
    atletas.forEach(a => { if (a.posicao) s.add(a.posicao); });
    return Array.from(s).sort();
  }, [atletas]);

  const atletasFiltrados = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    let lista = atletas.filter(a => {
      if (filtroPos !== 'Todas' && (a.posicao ?? '') !== filtroPos) return false;
      if (buscaLower) {
        const nome = `${a.nome} ${a.apelido ?? ''}`.toLowerCase();
        if (!nome.includes(buscaLower)) return false;
      }
      return true;
    });

    const valOf = (a: AtletaRow): string | number => {
      switch (sortBy) {
        case 'nome':     return (a.apelido || a.nome).toLowerCase();
        case 'posicao':  return (a.posicao ?? '').toLowerCase();
        default:         return n(a[sortBy] as number | null);
      }
    };
    lista = [...lista].sort((a, b) => {
      const va = valOf(a), vb = valOf(b);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return lista;
  }, [atletas, busca, filtroPos, sortBy, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir(key === 'nome' || key === 'posicao' ? 'asc' : 'desc');
    }
  };

  const SortIcon: React.FC<{ active: boolean; dir: SortDir }> = ({ active, dir }) => (
    <span className={`text-[9px] transition-colors duration-200 ${active ? 'text-club-red dark:text-club-red-light font-black' : 'text-slate-300 dark:text-white/10'}`}>
      {!active ? '↕' : dir === 'asc' ? '↑' : '↓'}
    </span>
  );

  const maxDist    = Math.max(...atletas.map(a => n(a.distanciaTotal)),   1);
  const maxMpm     = Math.max(...atletas.map(a => n(a.metragemPorMinuto)), 1);
  const maxCarga   = Math.max(...atletas.map(a => n(a.cargaJogador)),     1);
  const maxCargaMin = Math.max(...atletas.map(a => n(a.cargaPorMinuto)),   1);
  const maxHsr     = Math.max(...atletas.map(a => n(a.hsr)),             1);
  const maxHsrE    = Math.max(...atletas.map(a => n(a.hsrEsforcos)),      1);
  const maxSprint  = Math.max(...atletas.map(a => n(a.sprint)),           1);
  const maxSprintE = Math.max(...atletas.map(a => n(a.sprintEsforcos)),   1);
  const maxAcel    = Math.max(...atletas.map(a => n(a.aceleracoes)),      1);
  const maxDesac   = Math.max(...atletas.map(a => n(a.desaceleracoes)),   1);

  const thL = 'px-3 py-2.5 text-left text-[10.5px] xl:text-[11.5px] font-extrabold font-outfit tracking-wider uppercase text-slate-450 dark:text-slate-500 whitespace-nowrap select-none';
  const thR = 'px-3 py-2.5 text-right text-[10.5px] xl:text-[11.5px] font-extrabold font-outfit tracking-wider uppercase text-slate-450 dark:text-slate-500 whitespace-nowrap select-none';
  const thBtn = 'inline-flex items-center gap-0.5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-200';

  return (
    <div className="print-allow-break glass-panel rounded-2xl overflow-hidden shadow-xl dark:shadow-black/20">
      {/* HEADER do card */}
      <div className="px-6 py-4 border-b border-slate-200/40 dark:border-white/[0.04] flex items-center justify-between gap-4 flex-wrap bg-white/10 dark:bg-white/[0.01]">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-outfit uppercase tracking-tight">Análise do Atleta</h2>
          <p className="print-hide text-[10px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wide">
            Clique em um jogador para ver a performance individual · Clique nas colunas para ordenar
          </p>
        </div>
        <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-white/[0.03] px-3 py-1 rounded-full border border-slate-200/50 dark:border-white/[0.02] shrink-0">
          <b className="text-slate-700 dark:text-slate-200">{atletasFiltrados.length}</b> de {atletas.length} atletas
        </span>
      </div>

      {/* TOOLBAR — busca + filtros premium */}
      <div className="print-hide px-6 py-3.5 border-b border-slate-200/40 dark:border-white/[0.04] flex items-center gap-4 flex-wrap bg-slate-50/30 dark:bg-white/[0.005]">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text" value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar atleta pelo nome ou apelido…"
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-white/70 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-club-red/20 focus:border-club-red transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-outfit">Posição</span>
          <select
            value={filtroPos}
            onChange={e => setFiltroPos(e.target.value)}
            aria-label="Filtrar por posição"
            className="px-3 py-1.5 text-xs bg-white/70 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-club-red/20 focus:border-club-red transition-all"
          >
            <option value="Todas">Todas as Posições</option>
            {posicoes.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-outfit">Ordenar por</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            aria-label="Ordenar atletas por"
            className="px-3 py-1.5 text-xs bg-white/70 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-club-red/20 focus:border-club-red transition-all"
          >
            <option value="nome">Nome</option>
            <option value="posicao">Posição</option>
            <option value="distanciaTotal">Distância</option>
            <option value="metragemPorMinuto">m/min</option>
            <option value="cargaJogador">Player Load (PL)</option>
            <option value="cargaPorMinuto">PL/min</option>
            <option value="velocidadeMaxima">Velocidade Máxima</option>
            <option value="hsr">HSR (m)</option>
            <option value="hsrEsforcos">HSR Esforços</option>
            <option value="sprint">Sprint (m)</option>
            <option value="sprintEsforcos">Sprint Esforços</option>
            <option value="aceleracoes">Acelerações</option>
            <option value="desaceleracoes">Desacelerações</option>
            <option value="acelDesacelTotal">Acelerações + Desacelerações</option>
          </select>
          <button
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-1.5 text-xs bg-white/70 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-350 font-bold hover:border-club-red hover:text-club-red focus:outline-none transition-all flex items-center gap-1 select-none"
            title={sortDir === 'asc' ? 'Crescente' : 'Decrescente'}
          >
            {sortDir === 'asc' ? '↑ Cresc.' : '↓ Decresc.'}
          </button>
        </div>

        {(busca || filtroPos !== 'Todas') && (
          <button
            onClick={() => { setBusca(''); setFiltroPos('Todas'); }}
            className="text-[11px] font-extrabold text-club-red dark:text-club-red-light hover:underline ml-auto font-outfit uppercase tracking-wider"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="overflow-x-auto" tabIndex={0} aria-label="Tabela de métricas por atleta">
        <table className="w-full text-[12px] xl:text-[13.5px] table-auto">
          <thead className="bg-slate-100/50 dark:bg-white/[0.01] border-b border-slate-200/40 dark:border-white/[0.04]">
            <tr>
              <th className={thL}><span className={thBtn} onClick={() => toggleSort('nome')}>Nome <SortIcon active={sortBy==='nome'} dir={sortDir} /></span></th>
              <th className={thL}><span className={thBtn} onClick={() => toggleSort('posicao')}>Pos <SortIcon active={sortBy==='posicao'} dir={sortDir} /></span></th>
              <th className={thR}>
                <span className={thBtn} onClick={() => toggleSort('distanciaTotal')}>
                  <span className="inline-flex items-center gap-0.5">Dist <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: M_COLOR.dist }} /></span>
                  <SortIcon active={sortBy==='distanciaTotal'} dir={sortDir} />
                </span>
              </th>
              <th className={thR}>
                <span className={thBtn} onClick={() => toggleSort('metragemPorMinuto')}>
                  <span className="inline-flex items-center gap-0.5">m/min <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: M_COLOR.mpm }} /></span>
                  <SortIcon active={sortBy==='metragemPorMinuto'} dir={sortDir} />
                </span>
              </th>
              <th className={thR}>
                <span className={thBtn} onClick={() => toggleSort('cargaJogador')}>
                  <span className="inline-flex items-center gap-0.5">PL <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: M_COLOR.carga }} /></span>
                  <SortIcon active={sortBy==='cargaJogador'} dir={sortDir} />
                </span>
              </th>
              <th className={thR}>
                <span className={thBtn} onClick={() => toggleSort('cargaPorMinuto')}>
                  <span className="inline-flex items-center gap-0.5">PL/min <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: M_COLOR.cMin }} /></span>
                  <SortIcon active={sortBy==='cargaPorMinuto'} dir={sortDir} />
                </span>
              </th>
              <th className={thR}>
                <span className={thBtn} onClick={() => toggleSort('velocidadeMaxima')}>
                  V.Máx
                  <SortIcon active={sortBy==='velocidadeMaxima'} dir={sortDir} />
                </span>
              </th>
              <th className={thR}>
                <span className={thBtn} onClick={() => toggleSort('hsr')}>
                  <span className="inline-flex items-center gap-0.5">HSR <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: M_COLOR.hsr }} /></span>
                  <SortIcon active={sortBy==='hsr'} dir={sortDir} />
                </span>
              </th>
              <th className={thR} title="Esforços de High Speed Running"><span className={thBtn} onClick={() => toggleSort('hsrEsforcos')}>HSR E <SortIcon active={sortBy==='hsrEsforcos'} dir={sortDir} /></span></th>
              <th className={thR}>
                <span className={thBtn} onClick={() => toggleSort('sprint')}>
                  <span className="inline-flex items-center gap-0.5">Spr <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: M_COLOR.sprint }} /></span>
                  <SortIcon active={sortBy==='sprint'} dir={sortDir} />
                </span>
              </th>
              <th className={thR} title="Esforços de Sprint"><span className={thBtn} onClick={() => toggleSort('sprintEsforcos')}>Spr E <SortIcon active={sortBy==='sprintEsforcos'} dir={sortDir} /></span></th>
              <th className={thR}>
                <span className={thBtn} onClick={() => toggleSort('aceleracoes')}>
                  <span className="inline-flex items-center gap-0.5">Acel <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: M_COLOR.acel }} /></span>
                  <SortIcon active={sortBy==='aceleracoes'} dir={sortDir} />
                </span>
              </th>
              <th className={thR}>
                <span className={thBtn} onClick={() => toggleSort('desaceleracoes')}>
                  <span className="inline-flex items-center gap-0.5">Desac <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: M_COLOR.desac }} /></span>
                  <SortIcon active={sortBy==='desaceleracoes'} dir={sortDir} />
                </span>
              </th>
              <th className={thR}><span className={thBtn} onClick={() => toggleSort('acelDesacelTotal')}>A+D <SortIcon active={sortBy==='acelDesacelTotal'} dir={sortDir} /></span></th>
              <th className={thR} title="Razão de Equilíbrio / Esforço (Desacelerações ÷ Acelerações)">
                <span className={thBtn}>
                  E/C
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/30 dark:divide-white/[0.03]">
            {atletasFiltrados.map(a => (
              <tr key={a.jogadorId}
                onClick={() => navigate(`/jogador/${a.jogadorId}`)}
                className="hover:bg-club-red/5 dark:hover:bg-club-red/10 transition-colors cursor-pointer group text-[11px] xl:text-[12px]">
                <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap group-hover:text-club-red dark:group-hover:text-club-red-light transition-colors">
                  {a.apelido || a.nome}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {a.posicao ? (() => {
                    const codigo = posicaoCodigo(a.posicao);
                    const cor = POSICAO_COLOR[codigo] ?? '#64748b';
                    return (
                      <span
                        className="inline-flex items-center justify-center h-4.5 px-1.5 rounded text-[8.5px] font-black text-white tracking-widest shadow-sm"
                        style={{ background: cor }}
                        title={a.posicao}
                      >
                        {posicaoLabel(a.posicao)}
                      </span>
                    );
                  })() : <span className="text-slate-400 text-xs">—</span>}
                </td>
                <td className="px-3 py-2.5"><BarCell value={n(a.distanciaTotal)}    max={maxDist}    color={M_COLOR.dist}   /></td>
                <td className="px-3 py-2.5"><BarCell value={n(a.metragemPorMinuto)} max={maxMpm}     color={M_COLOR.mpm} dec={1} /></td>
                <td className="px-3 py-2.5"><BarCell value={n(a.cargaJogador)}      max={maxCarga}   color={M_COLOR.carga}   /></td>
                <td className="px-3 py-2.5"><BarCell value={n(a.cargaPorMinuto)}    max={maxCargaMin} color={M_COLOR.cMin} dec={2} /></td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-[11px] xl:text-[12px] tabular-nums text-slate-700 dark:text-slate-200">
                  {n(a.velocidadeMaxima) > 0 ? fmtNum(n(a.velocidadeMaxima), 1) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                </td>
                <td className="px-3 py-2.5"><BarCell value={n(a.hsr)}               max={maxHsr}     color={M_COLOR.hsr}    /></td>
                <td className="px-3 py-2.5"><BarCell value={n(a.hsrEsforcos)}       max={maxHsrE}    color={M_COLOR.hsrE}   /></td>
                <td className="px-3 py-2.5"><BarCell value={n(a.sprint)}            max={maxSprint}  color={M_COLOR.sprint} /></td>
                <td className="px-3 py-2.5"><BarCell value={n(a.sprintEsforcos)}    max={maxSprintE} color={M_COLOR.sprE}   /></td>
                <td className="px-3 py-2.5"><BarCell value={n(a.aceleracoes)}       max={maxAcel}    color={M_COLOR.acel}   /></td>
                <td className="px-3 py-2.5"><BarCell value={n(a.desaceleracoes)}    max={maxDesac}   color={M_COLOR.desac}  /></td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-[11px] xl:text-[12px] tabular-nums text-slate-700 dark:text-slate-350">
                  {n(a.acelDesacelTotal)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <RatioCell acel={n(a.aceleracoes)} desac={n(a.desaceleracoes)} />
                </td>
              </tr>
            ))}

            {atletasFiltrados.length > 0 && (() => {
              const c = atletasFiltrados.length;
              const avg = (fn: (a: AtletaRow) => number) => atletasFiltrados.reduce((s, a) => s + fn(a), 0) / c;
              const velsValidas = atletasFiltrados
                .map(a => n(a.velocidadeMaxima))
                .filter(v => v > 0);
              const m = {
                dist:     avg(a => n(a.distanciaTotal)),
                mpm:      avg(a => n(a.metragemPorMinuto)),
                carga:    avg(a => n(a.cargaJogador)),
                cargaMin: avg(a => n(a.cargaPorMinuto)),
                velMax:  velsValidas.length > 0
                  ? velsValidas.reduce((s, v) => s + v, 0) / velsValidas.length
                  : 0,
                hsr:     avg(a => n(a.hsr)),
                hsrE:    avg(a => n(a.hsrEsforcos)),
                sprint:  avg(a => n(a.sprint)),
                sprintE: avg(a => n(a.sprintEsforcos)),
                acel:    avg(a => n(a.aceleracoes)),
                desac:   avg(a => n(a.desaceleracoes)),
                acelD:   avg(a => n(a.acelDesacelTotal)),
              };
              const ratios = atletasFiltrados
                .map(a => computeECRatio(n(a.aceleracoes), n(a.desaceleracoes)))
                .filter((r): r is number => r != null);
              const avgRatio = ratios.length > 0
                ? ratios.reduce((s, r) => s + r, 0) / ratios.length
                : null;
              return (
                <tr className="bg-slate-100/80 dark:bg-white/[0.04] border-t border-slate-300 dark:border-white/10 relative backdrop-blur-md text-[12px] xl:text-[13.5px]">
                  <td className="px-3 py-2.5 text-[11px] xl:text-[12px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 font-outfit" colSpan={2}>
                    Médias{atletasFiltrados.length !== atletas.length ? ` (${c})` : ''}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(m.dist)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(m.mpm, 1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(m.carga, 0)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(m.cargaMin, 2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-800 dark:text-slate-100">
                    {m.velMax > 0 ? fmtNum(m.velMax, 1) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(m.hsr)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(m.hsrE, 1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(m.sprint)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(m.sprintE, 1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(m.acel, 1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(m.desac, 1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(m.acelD, 1)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <RatioCell acel={0} desac={0} ratio={avgRatio} />
                  </td>
                </tr>
              );
            })()}

            {atletasFiltrados.length === 0 && (
              <tr><td colSpan={15} className="py-12 text-center text-sm font-semibold text-slate-400">
                {atletas.length === 0
                  ? 'Nenhum dado de atleta para a sessão.'
                  : 'Nenhum atleta encontrado com os filtros selecionados.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export const SessaoDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const sessaoId = Number(id);
  const toast = useToast();

  const [data, setData]       = useState<AnaliseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState<string | null>(null);
  const [tab, setTab]         = useState<Tab>('resumo');
  const [posBench, setPosBench] = useState<PosBenchMap | null>(null);
  const [editando, setEditando] = useState(false);

  const carregarAnalise = () => {
    setLoading(true); setErro(null); setData(null);
    fetch(`${API_BASE}/sessoes/${sessaoId}/analise`)
      .then(r => r.ok ? r.json() : Promise.reject('Sessão não encontrada'))
      .then((d: AnaliseData) => setData(d))
      .catch(e => setErro(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!sessaoId) return;
    carregarAnalise();
  }, [sessaoId]);

  // Benchmark por posição — fetch só uma vez no mount; falhas silenciosas
  // permitem o componente cair de volta no MD global.
  useEffect(() => {
    fetch(`${API_BASE}/analytics/posicoes-benchmarks`)
      .then(r => r.ok ? r.json() : Promise.reject(null))
      .then((d: { benchmarks: PosicaoBenchmark[] }) => {
        const map: PosBenchMap = {};
        for (const b of d.benchmarks) map[b.posicao] = b;
        setPosBench(map);
      })
      .catch(() => setPosBench(null));
  }, []);

  const TABS = useMemo(() => [
    { key: 'resumo'   as Tab, label: 'Resumo' },
    { key: 'periodos' as Tab, label: 'Análise do Período' },
    { key: 'atletas'  as Tab, label: 'Análise do Atleta' },
  ], []);

  if (loading) return <LoadingState label="Carregando sessão…" />;
  if (erro)    return <div className="flex items-center justify-center h-64 text-red-500 text-sm">{erro}</div>;
  if (!data)   return null;

  const { sessao, tempoTotal } = data;

  const handleSaveEdit = async (_id: number, dados: { data: string; tipo: string; descricao: string; equipe: string; local: string }) => {
    const r = await fetch(`${API_BASE}/sessoes/${sessaoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
    if (!r.ok) {
      toast.error('Falha ao atualizar sessão');
      throw new Error('Falha ao atualizar sessão');
    }
    toast.success('Sessão atualizada');
    // Re-fetch para refletir as mudanças (tipo afeta histórico comparativo)
    carregarAnalise();
  };

  return (
    <div className="min-h-screen bg-surface transition-colors duration-300">

      <EditSessaoModal
        sessao={editando ? sessao : null}
        onClose={() => setEditando(false)}
        onSave={handleSaveEdit}
      />

      {/* ═══════════════════ HEADER PREMIUM BACKDROP-BLUR & STICKY ═══════════════════ */}
      <header className="sticky top-0 z-40 backdrop-blur-lg bg-white/85 dark:bg-[#080b10]/85 border-b border-slate-200/40 dark:border-white/[0.04] px-3 md:px-4 lg:px-4 py-4.5 shadow-sm dark:shadow-black/25">
        {/* Linha 1: título + botões + tabs */}
        <div className="flex items-center justify-between gap-6 mb-4 flex-wrap">
          <div className="min-w-0 flex items-center gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-outfit">
                Relatório de Performance Fisiológica
              </p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <h1 className="text-xl font-black font-outfit tracking-tighter text-slate-900 dark:text-white">
                  {sessao.descricao || formatData(sessao.data)}
                </h1>
                
                <span className={`inline-flex items-center h-6 px-2.5 rounded-lg text-[10px] font-black tracking-widest ${
                  sessao.tipo === 'Jogo'
                    ? 'text-club-red bg-club-red/10 border border-club-red/20 shadow-sm shadow-club-red/10 animate-pulse'
                    : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/[0.02]'
                }`}>
                  {sessao.tipo === 'Jogo' ? 'MD · MATCH' : sessao.tipo.toUpperCase()}
                </span>
                
                {/* Ações primárias */}
                <div className="flex items-center gap-2 print-hide">
                  <button
                    onClick={() => setEditando(true)}
                    title="Editar informações da sessão"
                    className="px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-[11px] font-black font-outfit uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer select-none"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Editar
                  </button>
                  <button
                    onClick={() => window.print()}
                    title="Imprimir ou salvar como PDF"
                    className="px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-[11px] font-black font-outfit uppercase tracking-widest text-slate-700 dark:text-slate-350 bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200/80 dark:hover:bg-white/[0.08] border border-slate-200/50 dark:border-white/[0.03] active:scale-95 transition-all cursor-pointer select-none"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
                    </svg>
                    PDF
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Switcher de Abas Premium */}
          <div className="print-hide flex gap-1 bg-slate-100 dark:bg-white/[0.03] p-1.5 rounded-2xl border border-slate-200/40 dark:border-white/[0.02] shrink-0 shadow-inner">
            {TABS.map(t => (
              <button 
                key={t.key} 
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-xl text-xs font-black font-outfit uppercase tracking-wider transition-all duration-300 cursor-pointer select-none ${
                  tab === t.key
                    ? 'bg-club-red text-white shadow-md shadow-club-red/20 scale-[1.02] accent-glow'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linha 2: Chips de Metadados Translúcidos */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] border-t border-slate-200/40 dark:border-white/[0.04] pt-3.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/60 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.02]">
            <span className="font-extrabold font-outfit uppercase tracking-widest text-slate-400 dark:text-slate-500">Data</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold font-mono">{formatData(sessao.data)}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/60 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.02]">
            <span className="font-extrabold font-outfit uppercase tracking-widest text-slate-400 dark:text-slate-500">Duração</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold font-mono">{fmtSec(tempoTotal)}</span>
          </div>
          {sessao.equipe && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/60 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.02]">
              <span className="font-extrabold font-outfit uppercase tracking-widest text-slate-400 dark:text-slate-500">Elenco</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold font-outfit uppercase tracking-wider">{sessao.equipe}</span>
            </div>
          )}
          {sessao.local && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/60 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.02]">
              <span className="font-extrabold font-outfit uppercase tracking-widest text-slate-400 dark:text-slate-500">Arena</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold font-outfit uppercase tracking-wider">{sessao.local}</span>
            </div>
          )}
        </div>
      </header>

      <main className="py-4 md:py-6 w-full space-y-6 px-3 md:px-4 lg:px-4">
        {tab === 'resumo'   && <TabResumo   data={data} posBench={posBench} />}
        {tab === 'periodos' && <TabPeriodos data={data} />}
        {tab === 'atletas'  && <TabAtletas  atletas={data.atletasSession} />}
      </main>
    </div>
  );
};
