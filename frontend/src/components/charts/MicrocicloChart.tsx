import React, { useState } from 'react';

export interface MicrocicloPonto {
  md: string;             // 'MD-4' | 'MD-3' | ... | 'MD' | 'MD+1' | ...
  sessoes: number;
  cargaMedia: number;
  distanciaMedia: number;
  mpmMedia: number;
  hsrMedia: number;
  sprintMedia: number;
  duracaoMedia: number;
}

type MetricKey = 'cargaMedia' | 'distanciaMedia' | 'mpmMedia' | 'hsrMedia' | 'sprintMedia';

const METRICS: Array<{ key: MetricKey; label: string; unit: string; color: string; dec: number }> = [
  { key: 'cargaMedia',     label: 'Player Load', unit: '',      color: '#7c3aed', dec: 1 },
  { key: 'distanciaMedia', label: 'Distância',   unit: 'm',     color: '#0d9488', dec: 0 },
  { key: 'mpmMedia',       label: 'm/min',       unit: 'm/min', color: '#1e3a5f', dec: 1 },
  { key: 'hsrMedia',       label: 'HSR',         unit: 'm',     color: '#f59e0b', dec: 0 },
  { key: 'sprintMedia',    label: 'Sprint',      unit: 'm',     color: '#ef4444', dec: 0 },
];

// Janela canônica que sempre é exibida, mesmo sem dados
const CANONICAL = ['MD-4', 'MD-3', 'MD-2', 'MD-1', 'MD', 'MD+1', 'MD+2'];

interface Props {
  pontos: MicrocicloPonto[];
  totalJogos: number;
  totalSessoes: number;
}

const fmt = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const isMD     = (md: string) => md === 'MD';
const isPos    = (md: string) => md.startsWith('MD+');
const isCanon  = (md: string) => CANONICAL.includes(md);

export const MicrocicloChart: React.FC<Props> = ({ pontos, totalJogos, totalSessoes }) => {
  const [metric, setMetric] = useState<MetricKey>('cargaMedia');

  if (totalJogos === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 py-12 text-center px-4">
        Microciclo precisa de pelo menos um jogo registrado para classificar os treinos como MD-N.
      </div>
    );
  }

  // Sempre mostra a janela canônica, completando com buckets vazios.
  // Se houver buckets fora da janela (MD-5, MD+3 etc.), inclui logo em volta.
  const found = new Map(pontos.map(p => [p.md, p]));
  const extras = pontos
    .map(p => p.md)
    .filter(m => !isCanon(m))
    .sort((a, b) => {
      const av = parseMd(a);
      const bv = parseMd(b);
      return av - bv;
    });
  const labelsOrdenados = [
    ...extras.filter(m => parseMd(m) < parseMd('MD-4')),
    ...CANONICAL,
    ...extras.filter(m => parseMd(m) > parseMd('MD+2')),
  ];

  const pontosOrdenados: MicrocicloPonto[] = labelsOrdenados.map(md =>
    found.get(md) ?? {
      md, sessoes: 0,
      cargaMedia: 0, distanciaMedia: 0, mpmMedia: 0,
      hsrMedia: 0, sprintMedia: 0, duracaoMedia: 0,
    }
  );

  const metricDef = METRICS.find(m => m.key === metric)!;
  const maxV = Math.max(1, ...pontosOrdenados.map(p => p[metric]));

  return (
    <div role="group" aria-label="Microciclo MD-: carga por dia relativo ao jogo">
      {/* Header com toggle de métrica */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-[11px] text-slate-400 dark:text-slate-500">
          <b className="text-slate-700 dark:text-slate-300">{totalJogos}</b> jogos ·{' '}
          <b className="text-slate-700 dark:text-slate-300">{totalSessoes}</b> sessões na janela
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
          {METRICS.map(m => (
            <button key={m.key} onClick={() => setMetric(m.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap ${
                metric === m.key
                  ? 'bg-club-red text-white accent-glow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gráfico de barras */}
      <div className="grid grid-flow-col auto-cols-fr gap-1.5 items-end" style={{ minHeight: 220 }}>
        {pontosOrdenados.map(p => {
          const h = (p[metric] / maxV) * 180;
          const md_ = p.md;
          const noData = p.sessoes === 0;

          // Cor: MD destacado em vermelho, MD- em tons frios → quente, MD+ em tons recuperação
          const color = isMD(md_)
            ? '#cc1e1e'                          // dia de jogo
            : isPos(md_)
              ? noData ? '#cbd5e1' : '#06b6d4'   // recuperação (cyan)
              : noData ? '#cbd5e1' : metricDef.color;

          return (
            <div key={md_} className="flex flex-col items-center gap-1 group">
              <div className="text-[10px] tabular-nums font-bold text-slate-700 dark:text-slate-200 h-4">
                {noData ? '—' : fmt(p[metric], metricDef.dec)}
              </div>
              <div
                className="w-full rounded-sm relative cursor-help transition-all hover:opacity-90"
                style={{
                  height: noData ? 6 : Math.max(h, 8),
                  background: noData ? 'transparent' : color,
                  border: noData ? `1px dashed currentColor` : 'none',
                  opacity: noData ? 0.3 : (isMD(md_) ? 1 : 0.85),
                }}
                title={noData
                  ? `${md_}: sem dados`
                  : `${md_} · ${p.sessoes} sessões\n${metricDef.label}: ${fmt(p[metric], metricDef.dec)} ${metricDef.unit}`
                }
              />
              <div className={`text-[10px] font-extrabold tracking-wider ${
                isMD(md_)
                  ? 'text-club-red'
                  : noData
                    ? 'text-slate-300 dark:text-slate-600'
                    : 'text-slate-500 dark:text-slate-400'
              }`}>
                {md_}
              </div>
              <div className="text-[9px] text-slate-400 dark:text-slate-500 tabular-nums">
                {noData ? '—' : `${p.sessoes}×`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 mt-4 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: '#cc1e1e' }} />
          MD (jogo)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: metricDef.color }} />
          MD-N (preparação)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: '#06b6d4' }} />
          MD+N (recuperação)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-slate-300 dark:border-white/20 bg-transparent" />
          Sem dados
        </span>
      </div>
    </div>
  );
};

// Converte 'MD-N' / 'MD' / 'MD+N' em número ordenável (MD-7 → -7, MD → 0, MD+7 → 7)
function parseMd(md: string): number {
  if (md === 'MD') return 0;
  const m = md.match(/^MD([+-])(\d+)$/);
  if (!m) return 99;
  return (m[1] === '-' ? -1 : 1) * parseInt(m[2]!, 10);
}
