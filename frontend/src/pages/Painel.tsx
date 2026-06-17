import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import { formatData } from '../lib/format';
import { posicaoCodigo, POSICAO_COLOR, posicaoLabel } from '../lib/constants';
import { useToast } from '../components/Toast';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { LoadingState } from '../components/ui/LoadingState';

// ─── Types ────────────────────────────────────────────────────────────────────

type Zona = 'risco' | 'atencao' | 'ideal' | 'baixa' | 'sem-dados';

interface AtletaAnalise {
  id: number; nome: string; apelido: string | null; posicao: string | null;
  fotoUrl: string | null;
  acwr: number | null;
  cargaAguda: number; cargaCronica: number;
  zona: Zona;
  tendencia: 'subindo' | 'descendo' | 'estavel';
  ultimaSessao: string | null;
}

interface DiaCarga {
  data: string; diaSemana: string;
  cargaMedia: number; atletasCount: number;
  tipo: string | null;
}

interface AnomaliaMetrica {
  key: 'cargaJogador' | 'distancia' | 'metragemPorMinuto';
  label: string; unit: string;
  latest: number; mean: number; z: number;
  direction: 'up' | 'down';
}

interface Anomalia {
  atletaId: number;
  nome: string; apelido: string | null; posicao: string | null;
  fotoUrl: string | null;
  data: string; tipo: string;
  metricas: AnomaliaMetrica[];
}

interface TeamOverview {
  refDate: string;
  windowStart: string;
  windowEnd: string;
  windowDias: number;
  alertas: { risco: number; atencao: number; baixa: number; ideal: number; semDados: number };
  atletas: AtletaAnalise[];
  cargaSemanal: DiaCarga[];
  insights: string[];
  anomalias: Anomalia[];
  ultimaSessao: { data: string; tipo: string; descricao: string | null } | null;
  totalAtletas: number;
  totalSessoes: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ZONA_INFO: Record<Zona, { label: string; color: string; bg: string; ring: string; text: string }> = {
  risco:     { label: 'Alto Risco',     color: '#ef4444', bg: 'bg-red-500/5 dark:bg-red-500/[0.02]',         ring: 'border-red-500/20 dark:border-red-500/10',         text: 'text-red-550 dark:text-red-400' },
  atencao:   { label: 'Atenção',        color: '#f97316', bg: 'bg-orange-500/5 dark:bg-orange-500/[0.02]',  ring: 'border-orange-500/20 dark:border-orange-500/10',   text: 'text-orange-550 dark:text-orange-400' },
  baixa:     { label: 'Sub-treinado',   color: '#eab308', bg: 'bg-yellow-500/5 dark:bg-yellow-500/[0.02]',  ring: 'border-yellow-500/20 dark:border-yellow-500/10',   text: 'text-yellow-600 dark:text-yellow-455' },
  ideal:     { label: 'Zona Ideal',     color: '#10b981', bg: 'bg-emerald-500/5 dark:bg-emerald-500/[0.02]', ring: 'border-emerald-500/20 dark:border-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  'sem-dados': { label: 'Sem dados',    color: '#94a3b8', bg: 'bg-slate-500/5 dark:bg-white/[0.01]',         ring: 'border-slate-500/20 dark:border-white/5',           text: 'text-slate-500 dark:text-slate-400' },
};

const TendenciaIcon: React.FC<{ tendencia: 'subindo' | 'descendo' | 'estavel' }> = ({ tendencia }) => (
  <span className={`text-[10px] font-extrabold font-outfit px-1.5 py-0.5 rounded-md ${
    tendencia === 'subindo'  ? 'bg-rose-500/10 text-rose-500'    :
    tendencia === 'descendo' ? 'bg-emerald-500/10 text-emerald-500' :
    'bg-slate-500/10 text-slate-400'
  }`}>
    {tendencia === 'subindo' ? '▲' : tendencia === 'descendo' ? '▼' : '—'}
  </span>
);

// ─── Heatmap Calendário ───────────────────────────────────────────────────────

const HeatmapCalendario: React.FC<{ dias: DiaCarga[] }> = ({ dias }) => {
  const maxCarga = Math.max(...dias.map(d => d.cargaMedia), 1);
  const todayIso = new Date().toISOString().slice(0, 10);

  if (dias.length <= 21) {
    return (
      <div className="overflow-x-auto pb-1 select-none">
        <div className="flex gap-2 min-w-max py-2 px-1">
          {dias.map(d => {
            const intensidade = maxCarga > 0 ? d.cargaMedia / maxCarga : 0;
            const isJogo = d.tipo === 'Jogo';
            const isToday = d.data === todayIso;
            return (
              <div key={d.data} className="flex flex-col items-center gap-1.5 transition-transform hover:scale-[1.04]">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-outfit">
                  {d.diaSemana}
                </span>
                <div
                  className={`relative w-14 h-16 rounded-xl flex flex-col items-center justify-center border transition-all duration-300 ${
                    isJogo
                      ? 'border-club-red/50 dark:border-club-red/30 shadow-[0_4px_12px_rgba(204,30,30,0.15)] ring-1 ring-club-red/20'
                      : isToday
                        ? 'border-slate-500 dark:border-white/30 bg-slate-100/50 dark:bg-white/[0.04]'
                        : 'border-slate-200/60 dark:border-white/[0.03] bg-white/50 dark:bg-white/[0.01]'
                  }`}
                  style={{
                    background: d.cargaMedia > 0
                      ? `rgba(204, 30, 30, ${0.03 + intensidade * 0.42})`
                      : undefined,
                  }}
                  title={`${formatData(d.data)} · ${d.atletasCount} atletas · Carga ${d.cargaMedia.toFixed(1)}`}
                >
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 font-outfit">{d.data.slice(8, 10)}/{d.data.slice(5, 7)}</span>
                  {d.cargaMedia > 0 ? (
                    <span className="text-sm font-extrabold tabular-nums text-slate-800 dark:text-white font-mono mt-0.5">
                      {d.cargaMedia.toFixed(0)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-350 dark:text-slate-700 mt-0.5">—</span>
                  )}
                  {isJogo && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-club-red text-white text-[8px] font-extrabold rounded-md shadow-sm font-outfit tracking-wide">
                      JOGO
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Grid semanal (GitHub-style) ─────────────────────────────────────────
  const ordenados = [...dias].sort((a, b) => a.data.localeCompare(b.data));
  const primeiro = ordenados[0]!;
  const dWeekFirst = new Date(primeiro.data + 'T00:00:00Z').getUTCDay();
  const dataInicioSemana = new Date(primeiro.data + 'T00:00:00Z');
  dataInicioSemana.setUTCDate(dataInicioSemana.getUTCDate() - dWeekFirst);

  const totalSemanas = Math.ceil((dWeekFirst + ordenados.length) / 7);
  const byIso = new Map(ordenados.map(d => [d.data, d]));

  const cells: Array<Array<DiaCarga | null>> = Array.from({ length: 7 }, () =>
    Array(totalSemanas).fill(null)
  );

  for (let w = 0; w < totalSemanas; w++) {
    for (let d = 0; d < 7; d++) {
      const dt = new Date(dataInicioSemana);
      dt.setUTCDate(dt.getUTCDate() + w * 7 + d);
      const iso = dt.toISOString().slice(0, 10);
      cells[d]![w] = byIso.get(iso) ?? null;
    }
  }

  const monthLabels: Array<{ week: number; label: string }> = [];
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  let lastMonth = -1;
  for (let w = 0; w < totalSemanas; w++) {
    const dt = new Date(dataInicioSemana);
    dt.setUTCDate(dt.getUTCDate() + w * 7);
    const m = dt.getUTCMonth();
    if (m !== lastMonth) {
      monthLabels.push({ week: w, label: MESES[m]! });
      lastMonth = m;
    }
  }

  const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="overflow-x-auto pb-1 select-none">
      <div className="inline-block min-w-max py-2 px-1">
        {/* Labels de mês */}
        <div className="flex pl-8 mb-1.5">
          {Array.from({ length: totalSemanas }).map((_, w) => {
            const ml = monthLabels.find(m => m.week === w);
            return (
              <div key={w} className="w-3.5 text-[8px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-600 font-outfit">
                {ml?.label ?? ''}
              </div>
            );
          })}
        </div>

        {/* Grid: rótulo dow à esquerda + linhas */}
        <div className="flex gap-1">
          {/* Coluna de rótulos dom/seg/... */}
          <div className="flex flex-col gap-0.5 pr-1 justify-around">
            {DOW.map((d, i) => (
              <div key={d} className="h-3 text-[8px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-650 leading-none flex items-center font-outfit"
                style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Linhas de dias */}
          <div className="flex flex-col gap-0.5">
            {cells.map((row, dow) => (
              <div key={dow} className="flex gap-0.5">
                {row.map((cell, w) => {
                  if (!cell) {
                    return <div key={w} className="w-3 h-3" />;
                  }
                  const intensidade = maxCarga > 0 ? cell.cargaMedia / maxCarga : 0;
                  const isJogo = cell.tipo === 'Jogo';
                  const isToday = cell.data === todayIso;
                  return (
                    <div key={w}
                      className={`w-3 h-3 rounded-sm border transition-all duration-300 hover:scale-[1.25] hover:z-10 ${
                        isJogo
                          ? 'border-club-red shadow-[0_2px_6px_rgba(204,30,30,0.2)]'
                          : isToday
                            ? 'border-slate-500 dark:border-white/30'
                            : 'border-slate-200 dark:border-white/[0.03]'
                      }`}
                      style={{
                        background: cell.cargaMedia > 0
                          ? `rgba(204, 30, 30, ${0.06 + intensidade * 0.52})`
                          : undefined,
                      }}
                      title={`${formatData(cell.data)} · ${cell.atletasCount} atletas · Carga ${cell.cargaMedia.toFixed(1)}${isJogo ? ' · JOGO' : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-2 mt-4 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-outfit">
          <span>Menos</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.75, 1.0].map(i => (
              <div key={i} className="w-3 h-3 rounded-sm border border-slate-200 dark:border-white/[0.03]"
                style={{ background: `rgba(204, 30, 30, ${0.06 + i * 0.52})` }} />
            ))}
          </div>
          <span>Mais</span>
          <span className="ml-4 inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-club-red" /> Jogo
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Card de Alerta (zona) ────────────────────────────────────────────────────

const AlertCard: React.FC<{
  zona: Zona; count: number; total: number;
  ativo: boolean;
  onClick: () => void;
}> = ({ zona, count, total, ativo, onClick }) => {
  const info = ZONA_INFO[zona];
  const pct = total > 0 ? (count / total) * 100 : 0;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  const ICONS: Record<Zona, string> = {
    risco:      'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
    atencao:    'M12 9v4M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    baixa:      'M12 2v20M2 12h20M6 6l12 12M18 6L6 18',
    ideal:      'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3',
    'sem-dados':'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2',
  };

  // Se estiver ativo, adiciona borda brilhante e glow colorido
  const borderClass = ativo 
    ? `border-[2px] shadow-lg scale-[1.03]` 
    : `${info.ring} hover:border-slate-400 dark:hover:border-white/20`;

  const shadowGlow = ativo
    ? {
        borderColor: info.color,
        boxShadow: `0 0 18px -2px ${info.color}33, inset 0 0 8px ${info.color}15`,
      }
    : {};

  return (
    <button
      onClick={onClick}
      style={shadowGlow}
      className={`relative overflow-hidden rounded-2xl border text-left w-full cursor-pointer ${info.bg} ${borderClass} p-4.5 flex items-center gap-4.5 transition-all duration-300 hover:scale-[1.02] select-none glass-panel`}
    >
      {/* Glow decorativo */}
      <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-[0.06] blur-xl pointer-events-none ${ativo ? 'opacity-[0.15]' : ''}`} style={{ background: info.color }} />

      {/* Ring progress */}
      <div className="relative w-15 h-15 shrink-0">
        <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
          <circle cx="22" cy="22" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-white/[0.04]" />
          <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="3.5" strokeLinecap="round"
            style={{ stroke: info.color, strokeDasharray: circumference, strokeDashoffset, transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-extrabold tabular-nums leading-none font-outfit" style={{ color: info.color }}>{count}</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <svg viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2.2" className="w-4 h-4 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[zona]} />
          </svg>
          <p className="text-[10px] font-extrabold uppercase tracking-widest font-outfit" style={{ color: info.color }}>
            {info.label}
          </p>
        </div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono tabular-nums leading-none">
          {pct.toFixed(0)}% do elenco
        </p>
      </div>
    </button>
  );
};

// ─── Card Individual do Atleta ────────────────────────────────────────────────

const AtletaGridCard: React.FC<{
  atleta: AtletaAnalise;
  onClick: () => void;
}> = ({ atleta, onClick }) => {
  const info = ZONA_INFO[atleta.zona];
  const cod = atleta.posicao ? posicaoCodigo(atleta.posicao) : null;
  const acwrVal = atleta.acwr ?? 0;
  const barPct = Math.min((acwrVal / 2) * 100, 100);

  // Formatação de data da última sessão de treino
  const formataUltimaSessaoText = (dataStr: string | null) => {
    if (!dataStr) return 'Sem registros';
    const hoje = new Date().toISOString().slice(0, 10);
    const dias = diffDaysIso(hoje, dataStr);
    if (dias === 0) return 'Sessão hoje';
    if (dias === 1) return 'Ontem';
    return `Há ${dias} dias`;
  };

  return (
    <button
      onClick={onClick}
      className="bg-white/60 dark:bg-[#08090c]/40 border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-4.5 text-left transition-all duration-300 hover:scale-[1.03] hover:shadow-md hover:border-slate-350 dark:hover:border-white/10 flex flex-col justify-between h-[210px] group cursor-pointer glass-panel select-none relative overflow-hidden w-full"
    >
      {/* Detalhe de glow sutil de fundo no hover com a cor do status */}
      <div 
        className="absolute -top-24 -right-24 w-40 h-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-[0.06] pointer-events-none" 
        style={{ background: info.color }} 
      />

      <div className="space-y-3.5 w-full">
        {/* Topo do card: Avatar, Nome, Posição */}
        <div className="flex items-center gap-3 w-full">
          <PlayerAvatar 
            fotoUrl={atleta.fotoUrl} 
            nome={atleta.apelido || atleta.nome} 
            size="md" 
            className="group-hover:border-slate-400 dark:group-hover:border-white/20 transition-colors"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-extrabold text-slate-850 dark:text-white truncate font-outfit leading-snug group-hover:text-club-red transition-colors">
              {atleta.apelido || atleta.nome.split(',')[0]}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              {cod && atleta.posicao ? (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[8px] font-extrabold text-white font-outfit leading-none shrink-0"
                  style={{ background: POSICAO_COLOR[cod] ?? '#64748b' }}>
                  {posicaoLabel(atleta.posicao)}
                </span>
              ) : (
                <span className="text-[9px] text-slate-450 font-outfit shrink-0">—</span>
              )}
              <span className="text-[9px] text-slate-400 font-mono tracking-tight shrink-0">•</span>
              <span className="text-[9px] text-slate-400 font-outfit truncate shrink-0">
                {formataUltimaSessaoText(atleta.ultimaSessao)}
              </span>
            </div>
          </div>
        </div>

        {/* ACWR e Tendência de Carga */}
        <div className="flex items-end justify-between w-full">
          <div className="space-y-0.5">
            <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-outfit leading-none">
              Status ACWR
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold font-mono tabular-nums leading-none tracking-tight" style={{ color: info.color }}>
                {atleta.acwr != null ? atleta.acwr.toFixed(2) : '—'}
              </span>
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-extrabold font-outfit uppercase shrink-0 ${info.ring}`}
                style={{ color: info.color, background: info.color + '0d' }}>
                {info.label}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-outfit leading-none">
              Tendência
            </span>
            <TendenciaIcon tendencia={atleta.tendencia} />
          </div>
        </div>
      </div>

      {/* Rodapé: Barra Gráfica de ACWR + Detalhes de Carga */}
      <div className="space-y-2 w-full">
        {/* Barra ACWR Inteligente Horizontal */}
        <div className="relative h-2 bg-slate-100 dark:bg-white/[0.04] rounded-lg overflow-hidden border border-slate-200/30 dark:border-white/[0.02]">
          {/* Faixa da Zona Ideal (0.8 a 1.3) */}
          <div className="absolute h-full bg-emerald-500/10 dark:bg-emerald-500/20 rounded-sm" style={{ left: '40%', width: '25%' }} />
          {/* Marcador flutuante da posição atual */}
          {acwrVal > 0 && (
            <div className="absolute top-0 h-full w-1.5 rounded-full transition-all duration-500 shadow-sm"
              style={{ left: `${Math.max(barPct - 1, 0)}%`, background: info.color }} />
          )}
        </div>

        {/* Cargas Aguda e Crônica */}
        <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 dark:text-slate-500 w-full">
          <div className="flex gap-1.5">
            <span>AGUDA: <strong className="text-slate-650 dark:text-slate-350">{atleta.cargaAguda.toFixed(0)}</strong></span>
            <span className="opacity-40">|</span>
            <span>CRÔNICA: <strong className="text-slate-650 dark:text-slate-350">{atleta.cargaCronica.toFixed(0)}</strong></span>
          </div>
          <span className="font-outfit text-[8px] font-extrabold uppercase tracking-widest text-club-red opacity-0 group-hover:opacity-100 transition-opacity">
            Análise →
          </span>
        </div>
      </div>
    </button>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const todayIso = () => new Date().toISOString().slice(0, 10);
const addDaysIso = (iso: string, delta: number): string => {
  const dt = new Date(iso + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
};
const diffDaysIso = (a: string, b: string): number => {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((da - db) / 86_400_000);
};

const PRESETS_JANELA = [7, 14, 30, 60, 90] as const;

export const Painel: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData]       = useState<TeamOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState<string | null>(null);

  const [windowEnd,   setWindowEnd]   = useState<string>(() => todayIso());
  const [windowStart, setWindowStart] = useState<string>(() => addDaysIso(todayIso(), -13));

  // Novos Estados
  const [filtroZona, setFiltroZona] = useState<Zona | null>(null);
  const [tipoVisualizacao, setTipoVisualizacao] = useState<'cards' | 'tabela'>('cards');

  const atletasFiltrados = useMemo(() => {
    if (!data) return [];
    if (!filtroZona) {
      // Se não tiver filtro, ordena por prioridade de risco
      const ordem: Record<Zona, number> = { risco: 0, atencao: 1, baixa: 2, ideal: 3, 'sem-dados': 4 };
      return [...data.atletas].sort((a, b) => ordem[a.zona] - ordem[b.zona]);
    }
    return data.atletas.filter(a => a.zona === filtroZona);
  }, [data, filtroZona]);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ start: windowStart, end: windowEnd });
    fetch(`${API_BASE}/analytics/team-overview?${qs.toString()}`)
      .then(r => r.ok ? r.json() : Promise.reject('Erro ao carregar dados do painel.'))
      .then(setData)
      .catch(e => setErro(String(e)))
      .finally(() => setLoading(false));
  }, [windowStart, windowEnd]);

  const aplicarPreset = (dias: number) => {
    const end = todayIso();
    setWindowEnd(end);
    setWindowStart(addDaysIso(end, -(dias - 1)));
  };

  const janelaDias = diffDaysIso(windowEnd, windowStart) + 1;
  const presetAtivo = windowEnd === todayIso() && PRESETS_JANELA.includes(janelaDias as typeof PRESETS_JANELA[number])
    ? janelaDias
    : null;

  const atletasAgrupados = useMemo(() => {
    if (!data) return null;
    return {
      risco:    data.atletas.filter(a => a.zona === 'risco'),
      atencao:  data.atletas.filter(a => a.zona === 'atencao'),
      baixa:    data.atletas.filter(a => a.zona === 'baixa'),
      ideal:    data.atletas.filter(a => a.zona === 'ideal'),
      semDados: data.atletas.filter(a => a.zona === 'sem-dados'),
    };
  }, [data]);

  const candidatosInativar = useMemo(() => {
    if (!data) return [];
    const hoje = todayIso();
    const limite = 60; 
    return data.atletas
      .map(a => ({
        ...a,
        diasSemSessao: a.ultimaSessao ? diffDaysIso(hoje, a.ultimaSessao) : null,
      }))
      .filter(a => a.diasSemSessao != null && a.diasSemSessao >= limite)
      .sort((a, b) => (b.diasSemSessao ?? 0) - (a.diasSemSessao ?? 0));
  }, [data]);

  const marcarInativo = async (atleta: AtletaAnalise) => {
    const dataSaida = atleta.ultimaSessao ?? todayIso();
    const r = await fetch(`${API_BASE}/jogadores/${atleta.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'inativo', dataSaida }),
    });
    if (r.ok) {
      toast.success(`${atleta.apelido || atleta.nome.split(',')[0]} marcado como inativo`);
      const qs = new URLSearchParams({ start: windowStart, end: windowEnd });
      fetch(`${API_BASE}/analytics/team-overview?${qs.toString()}`)
        .then(res => res.ok ? res.json() : Promise.reject(null))
        .then(setData)
        .catch(() => { });
    } else {
      toast.error('Falha ao atualizar status.');
    }
  };

  if (loading) return <LoadingState label="Carregando painel analítico…" />;
  if (erro)    return <div className="flex items-center justify-center h-screen text-red-500 text-xs font-semibold uppercase tracking-wider font-outfit">{erro}</div>;
  if (!data || !atletasAgrupados) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050608] pb-10 transition-colors duration-300">

      {/* HEADER PRINCIPAL */}
      <header className="relative overflow-hidden bg-white dark:bg-[#08090c] border-b border-slate-200/50 dark:border-white/[0.04] px-8 py-6 select-none z-10 transition-colors">
        {/* Luz tática superior */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-club-red via-club-gold to-club-red" />
        
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-club-red font-outfit mb-1">
              Visão Geral
            </p>
            <h1 className="text-2xl font-extrabold text-slate-850 dark:text-white tracking-tight font-outfit">
              Painel do Time
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4 text-slate-400"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.4 3.5-5 6.5-5s5.7 1.6 6.5 5" /></svg>
              <span className="text-sm font-extrabold text-slate-850 dark:text-white font-mono tabular-nums leading-none">{data.totalAtletas}</span>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-outfit leading-none">atletas</span>
            </div>

            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4 text-slate-400"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <span className="text-sm font-extrabold text-slate-850 dark:text-white font-mono tabular-nums leading-none">{data.totalSessoes}</span>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-outfit leading-none">sessões</span>
            </div>

            {data.ultimaSessao && (
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] shadow-sm">
                <span className={`w-2 h-2 rounded-full shrink-0 ${data.ultimaSessao.tipo === 'Jogo' ? 'bg-club-red animate-pulse' : 'bg-emerald-500'}`} />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 font-outfit">{formatData(data.ultimaSessao.data)}</span>
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-outfit">{data.ultimaSessao.tipo}</span>
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="print-hide flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10 transition-all duration-300 font-outfit uppercase tracking-wider hover:-translate-y-0.5 cursor-pointer shadow-sm active:scale-95"
              title="Imprimir ou salvar como PDF"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
              </svg>
              Imprimir
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6 max-w-[1600px] mx-auto">

        {/* ALERTAS — 4 cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AlertCard 
            zona="risco"    
            count={data.alertas.risco}    
            total={data.totalAtletas} 
            ativo={filtroZona === 'risco'}
            onClick={() => setFiltroZona(filtroZona === 'risco' ? null : 'risco')}
          />
          <AlertCard 
            zona="atencao"  
            count={data.alertas.atencao}  
            total={data.totalAtletas} 
            ativo={filtroZona === 'atencao'}
            onClick={() => setFiltroZona(filtroZona === 'atencao' ? null : 'atencao')}
          />
          <AlertCard 
            zona="baixa"    
            count={data.alertas.baixa}    
            total={data.totalAtletas} 
            ativo={filtroZona === 'baixa'}
            onClick={() => setFiltroZona(filtroZona === 'baixa' ? null : 'baixa')}
          />
          <AlertCard 
            zona="ideal"    
            count={data.alertas.ideal}    
            total={data.totalAtletas} 
            ativo={filtroZona === 'ideal'}
            onClick={() => setFiltroZona(filtroZona === 'ideal' ? null : 'ideal')}
          />
        </div>

        {/* INSIGHTS */}
        {data.insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.insights.map((insight, i) => {
              const isRisco = insight.toLowerCase().includes('risco') || insight.toLowerCase().includes('acwr > 1.5');
              const isBaixa = insight.toLowerCase().includes('sub-treinado') || insight.toLowerCase().includes('acwr < 0.8');
              const isVolume = insight.toLowerCase().includes('volume') || insight.toLowerCase().includes('%');
              const icon = isRisco ? '⚠️' : isBaixa ? '📉' : isVolume ? '📊' : '💡';
              const border = isRisco ? 'border-red-500/20 dark:border-red-500/10' 
                           : isBaixa ? 'border-yellow-500/20 dark:border-yellow-500/10'
                           : 'border-slate-200/50 dark:border-white/[0.04]';
              const bg = isRisco ? 'bg-red-500/[0.02] dark:bg-red-900/[0.03]'
                       : isBaixa ? 'bg-yellow-500/[0.02] dark:bg-yellow-900/[0.03]'
                       : 'bg-white/60 dark:bg-white/[0.01]';
              return (
                <div key={i} className={`flex items-start gap-3.5 px-4.5 py-4 rounded-2xl border ${border} ${bg} glass-panel transition-all duration-300 hover:shadow-sm`}>
                  <span className="text-lg mt-0.5 shrink-0 select-none">{icon}</span>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-350 leading-relaxed font-sans">{insight}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ANOMALIAS */}
        {data.anomalias && (
          <div className="bg-white dark:bg-[#08090c] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-6 shadow-sm glass-panel transition-colors">
            <div className="flex flex-wrap items-baseline justify-between mb-4 gap-2">
              <div>
                <h3 className={`text-[10px] font-extrabold uppercase tracking-widest font-outfit ${
                  data.anomalias.length > 0
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-emerald-500 dark:text-emerald-400'
                }`}>
                  Desvios da Média Pessoal · {'>'}2σ
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-none">
                  Atletas cuja última sessão fugiu significativamente do próprio histórico.
                </p>
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-450 dark:text-slate-500 font-outfit bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                {data.anomalias.length} desvios
              </span>
            </div>

            {data.anomalias.length === 0 && (
              <div className="flex items-start gap-4 p-4.5 rounded-2xl bg-emerald-500/[0.02] dark:bg-emerald-950/[0.03] border border-emerald-500/20 dark:border-emerald-900/10 shadow-sm select-none">
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 text-emerald-550 dark:text-emerald-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-outfit">
                    Nenhum desvio crítico detectado
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    A última participação de cada atleta seguiu fielmente o próprio padrão. O algoritmo exige um histórico de <b>≥4 sessões</b> por atleta para analisar e calibrar as anomalias.
                  </p>
                </div>
              </div>
            )}

            {data.anomalias.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {data.anomalias.map(an => (
                  <button key={an.atletaId} onClick={() => navigate(`/jogador/${an.atletaId}`)}
                    className="flex flex-col gap-3 px-4 py-4 rounded-2xl border border-amber-500/15 dark:border-amber-500/5 bg-amber-500/[0.01] dark:bg-amber-950/[0.02] hover:bg-amber-500/[0.04] dark:hover:bg-amber-500/[0.03] hover:border-amber-500/30 transition-all duration-300 text-left group cursor-pointer hover:shadow-sm">
                    
                    <div className="flex items-center gap-3">
                      <PlayerAvatar 
                        fotoUrl={an.fotoUrl} 
                        nome={an.apelido || an.nome} 
                        size="sm" 
                        className="border-amber-500/20"
                      />
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-white truncate group-hover:text-club-red transition-colors font-outfit">
                            {an.apelido || an.nome.split(',')[0]}
                          </span>
                          {an.posicao && (() => {
                            const cod = posicaoCodigo(an.posicao);
                            return (
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[8px] font-extrabold text-white font-outfit leading-none shrink-0"
                                style={{ background: POSICAO_COLOR[cod] ?? '#64748b' }}>
                                {posicaoLabel(an.posicao)}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold font-outfit uppercase ${
                          an.tipo === 'Jogo'
                            ? 'bg-club-red/10 text-club-red border border-club-red/20'
                            : 'bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 text-slate-500 dark:text-slate-450'
                        }`}>
                          {an.tipo === 'Jogo' ? 'MD' : an.tipo}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                          {formatData(an.data)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pl-11">
                      {an.metricas.map(m => {
                        const up = m.direction === 'up';
                        const dpct = m.mean > 0 ? Math.round(((m.latest - m.mean) / m.mean) * 100) : 0;
                        return (
                          <span key={m.key}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold font-mono tabular-nums ${
                              up
                                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
                                : 'bg-sky-500/10 border border-sky-500/20 text-sky-500'
                            }`}
                            title={`Última: ${m.latest} ${m.unit} · Média: ${m.mean} ${m.unit} · z=${m.z}`}>
                            <span className="font-extrabold">{up ? '↑' : '↓'}</span>
                            <span className="font-sans font-bold">{m.label}</span>
                            <span className="opacity-85 font-extrabold">{up ? '+' : ''}{dpct}%</span>
                            <span className="opacity-50 text-[9px] font-sans font-medium">z={Math.abs(m.z).toFixed(1)}</span>
                          </span>
                        );
                      })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* GESTÃO DE ELENCO */}
        {candidatosInativar.length > 0 && (
          <div className="bg-white dark:bg-[#08090c] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-6 shadow-sm glass-panel transition-colors">
            <div className="flex flex-wrap items-baseline justify-between mb-4 gap-3">
              <div>
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500 dark:text-amber-400 font-outfit">
                  Sem participação recente · {'>'}60 dias
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-none">
                  Atletas marcados como ativos, mas sem registros recentes.
                </p>
              </div>
              <button onClick={() => navigate('/jogadores')}
                className="text-[11px] font-bold text-club-red hover:text-club-red-hover hover:underline font-outfit uppercase tracking-wider cursor-pointer">
                Gerenciar elenco →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {candidatosInativar.slice(0, 8).map(a => {
                const cod = a.posicao ? posicaoCodigo(a.posicao) : null;
                return (
                  <div key={a.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-500/10 dark:border-amber-500/5 bg-amber-500/[0.01] dark:bg-amber-950/[0.01] transition-all hover:bg-amber-500/[0.03] dark:hover:bg-amber-500/[0.02]">
                    {cod ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[9px] font-extrabold text-white shrink-0 font-outfit shadow-sm"
                        style={{ background: POSICAO_COLOR[cod] ?? '#64748b' }}>
                        {cod}
                      </span>
                    ) : <span className="w-7 text-center text-[10px] text-slate-400 font-outfit shrink-0">—</span>}

                    <button onClick={() => navigate(`/jogador/${a.id}`)}
                      className="flex-1 text-left min-w-0 cursor-pointer">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate hover:text-club-red transition-colors font-outfit">
                        {a.apelido || a.nome.split(',')[0]}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                        {a.ultimaSessao
                          ? `Última: ${formatData(a.ultimaSessao)} · ${a.diasSemSessao}d atrás`
                          : 'Sem registros'}
                      </p>
                    </button>

                    <button onClick={() => marcarInativo(a)}
                      title={`Marcar inativo (data de saída = ${a.ultimaSessao ? formatData(a.ultimaSessao) : 'hoje'})`}
                      className="px-3 py-1.5 rounded-xl text-[9px] font-extrabold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:text-rose-600 transition-all cursor-pointer font-outfit uppercase tracking-widest active:scale-95 shadow-sm">
                      Inativar Atleta
                    </button>
                  </div>
                );
              })}
            </div>

            {candidatosInativar.length > 8 && (
              <p className="text-[10px] text-slate-400 text-center mt-4 font-outfit">
                + {candidatosInativar.length - 8} {candidatosInativar.length - 8 === 1 ? 'atleta' : 'atletas'} — use o assistente em <button onClick={() => navigate('/jogadores')} className="text-club-red font-bold hover:underline cursor-pointer">Elenco</button> para atualizar lote.
              </p>
            )}
          </div>
        )}

        {/* HEATMAP CALENDÁRIO */}
        <div className="bg-white dark:bg-[#08090c] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-6 shadow-sm glass-panel transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-outfit">
                Carga de Treinamento do Time
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums leading-none">
                {formatData(data.windowStart)} → {formatData(data.windowEnd)} ·{' '}
                <span className="font-extrabold text-slate-700 dark:text-slate-200">{data.windowDias}</span> dias analisados
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3.5 select-none">
              
              {/* Chips de preset premium */}
              <div className="flex gap-0.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200/30 dark:border-white/[0.03]">
                {PRESETS_JANELA.map(p => (
                  <button key={p} onClick={() => aplicarPreset(p)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase font-outfit tracking-wider transition-all cursor-pointer ${
                      presetAtivo === p
                        ? 'bg-club-red text-white shadow-sm accent-glow'
                        : 'text-slate-400 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/5'
                    }`}>
                    {p}D
                  </button>
                ))}
              </div>

              {/* Custom range com inputs elegantes */}
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-slate-400 font-outfit">
                <span>DE</span>
                <input type="date" value={windowStart}
                  max={windowEnd}
                  aria-label="Data de início"
                  onChange={e => e.target.value && setWindowStart(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#050608] border border-slate-200/60 dark:border-white/[0.06] rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-club-red font-mono select-all" />
                <span>ATÉ</span>
                <input type="date" value={windowEnd}
                  min={windowStart} max={todayIso()}
                  aria-label="Data de fim"
                  onChange={e => e.target.value && setWindowEnd(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#050608] border border-slate-200/60 dark:border-white/[0.06] rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-club-red font-mono select-all" />
              </div>
            </div>
          </div>

          <HeatmapCalendario dias={data.cargaSemanal} />
        </div>

        {/* GESTÃO DO ELENCO COM SELETOR DE VISUALIZAÇÃO PREMIUM */}
        <div className="bg-white dark:bg-[#08090c] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-6 shadow-sm glass-panel transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-extrabold text-slate-850 dark:text-white font-outfit">
                  {filtroZona ? `Elenco (${ZONA_INFO[filtroZona].label})` : 'Elenco Completo'} — Carga ACWR
                </h3>
                {filtroZona && (
                  <button
                    onClick={() => setFiltroZona(null)}
                    className="px-2 py-0.5 rounded text-[8px] font-extrabold font-outfit uppercase bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    Limpar Filtro
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Acute:Chronic Workload Ratio · Clique sobre o atleta para ver perfil analítico.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 select-none sm:justify-end">
              <div className="flex flex-wrap items-center gap-2">
                {(['risco', 'atencao', 'baixa', 'ideal'] as Zona[]).map(z => {
                  const info = ZONA_INFO[z];
                  const count = z === 'risco' ? atletasAgrupados.risco.length
                    : z === 'atencao' ? atletasAgrupados.atencao.length
                    : z === 'baixa' ? atletasAgrupados.baixa.length
                    : atletasAgrupados.ideal.length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={z}
                      onClick={() => setFiltroZona(filtroZona === z ? null : z)}
                      className={`flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest font-outfit px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        filtroZona === z
                          ? 'shadow-sm'
                          : 'border-transparent bg-transparent hover:bg-slate-100/50 dark:hover:bg-white/5'
                      }`}
                      style={{
                        color: info.color,
                        borderColor: filtroZona === z ? info.color : 'transparent',
                        background: filtroZona === z ? info.color + '0d' : undefined,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full border shadow-sm shrink-0" style={{ background: info.color, borderColor: info.color }} />
                      {info.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Linha vertical separadora */}
              <div className="hidden md:block w-[1px] h-6 bg-slate-200 dark:bg-white/10 shrink-0" />

              {/* Comutador de Visualização */}
              <div className="flex gap-0.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200/30 dark:border-white/[0.03]">
                <button
                  onClick={() => setTipoVisualizacao('cards')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase font-outfit tracking-wider transition-all cursor-pointer ${
                    tipoVisualizacao === 'cards'
                      ? 'bg-club-red text-white shadow-sm'
                      : 'text-slate-400 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3.5 h-3.5">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                  Cards
                </button>
                <button
                  onClick={() => setTipoVisualizacao('tabela')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase font-outfit tracking-wider transition-all cursor-pointer ${
                    tipoVisualizacao === 'tabela'
                      ? 'bg-club-red text-white shadow-sm'
                      : 'text-slate-400 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3.5 h-3.5">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" strokeLinecap="round" />
                    <line x1="3" y1="12" x2="3.01" y2="12" strokeLinecap="round" />
                    <line x1="3" y1="18" x2="3.01" y2="18" strokeLinecap="round" />
                  </svg>
                  Tabela
                </button>
              </div>
            </div>
          </div>

          {atletasFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 select-none text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 mb-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-6 h-6">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 font-outfit">Nenhum atleta encontrado</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-md leading-relaxed">
                Não há atletas com o status de <b>{filtroZona ? ZONA_INFO[filtroZona].label : 'carga'}</b> registrados no período de {formatData(windowStart)} a {formatData(windowEnd)}.
              </p>
            </div>
          ) : tipoVisualizacao === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {atletasFiltrados.map(a => (
                <AtletaGridCard
                  key={a.id}
                  atleta={a}
                  onClick={() => navigate(`/jogador/${a.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200/50 dark:border-white/[0.04] select-none">
                    <th className="text-left px-4 py-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-outfit">Atleta</th>
                    <th className="text-left px-4 py-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-outfit">Posição</th>
                    <th className="text-center px-4 py-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-outfit">Tend.</th>
                    <th className="text-right px-4 py-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-outfit">ACWR</th>
                    <th className="text-left px-4 py-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-outfit w-44">Gráfico ACWR</th>
                    <th className="text-left px-4 py-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-outfit">Status Zona</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-white/[0.02]">
                  {atletasFiltrados.map(a => {
                    const info = ZONA_INFO[a.zona];
                    const acwrVal = a.acwr ?? 0;
                    const barPct = Math.min((acwrVal / 2) * 100, 100);
                    const cod = a.posicao ? posicaoCodigo(a.posicao) : null;
                    return (
                      <tr key={a.id} onClick={() => navigate(`/jogador/${a.id}`)}
                        className="hover:bg-slate-100/40 dark:hover:bg-white/[0.02] cursor-pointer transition-all duration-300 group">
                        
                        <td className="px-4 py-3 font-outfit">
                          <div className="flex items-center gap-2.5">
                            <PlayerAvatar 
                              fotoUrl={a.fotoUrl} 
                              nome={a.apelido || a.nome} 
                              size="xs" 
                            />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-club-red transition-colors">
                              {a.apelido || a.nome}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {cod && a.posicao ? (
                            <span className="inline-flex items-center justify-center h-5 px-2 rounded-md text-[9px] font-extrabold text-white font-outfit shadow-sm"
                              style={{ background: POSICAO_COLOR[cod] ?? '#64748b' }}>
                              {posicaoLabel(a.posicao)}
                            </span>
                          ) : <span className="text-[10px] text-slate-400 font-outfit">—</span>}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <TendenciaIcon tendencia={a.tendencia} />
                        </td>

                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-extrabold font-mono tabular-nums leading-none" style={{ color: info.color }}>
                            {a.acwr != null ? a.acwr.toFixed(2) : '—'}
                          </span>
                        </td>

                        {/* Barra ACWR Inteligente */}
                        <td className="px-4 py-3">
                          <div className="relative h-3.5 bg-slate-100 dark:bg-white/[0.04] rounded-lg overflow-hidden border border-slate-200/30 dark:border-white/[0.02]">
                            {/* Faixa da Zona Ideal (0.8 a 1.3) */}
                            <div className="absolute h-full bg-emerald-500/10 dark:bg-emerald-500/15 rounded-md" style={{ left: '40%', width: '25%' }} />
                            {/* Ponto indicador com glow */}
                            {acwrVal > 0 && (
                              <div className="absolute top-0 h-full w-2 rounded-full transition-all duration-500 shadow-sm"
                                style={{ left: `${Math.max(barPct - 1.5, 0)}%`, background: info.color }} />
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-extrabold font-outfit uppercase border ${info.ring}`}
                            style={{ color: info.color, background: info.color + '0d' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: info.color }} />
                            {info.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {atletasAgrupados.semDados.length > 0 && (
            <div className="border-t border-slate-150/40 dark:border-white/[0.03] pt-4.5 mt-4">
              <p className="text-[10px] text-slate-400 font-outfit leading-relaxed flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3.5 h-3.5 shrink-0"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                Contém {atletasAgrupados.semDados.length} {atletasAgrupados.semDados.length === 1 ? 'atleta' : 'atletas'} em fase de captação inicial ou transição (dados de treino insuficientes para cálculo de ACWR).
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
