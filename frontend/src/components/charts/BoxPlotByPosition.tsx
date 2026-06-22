import React, { useState } from 'react';
import { posicaoCodigo, POSICAO_COLOR } from '../../lib/constants';

export interface BoxRow {
  jogadorId: number;
  nome: string;
  apelido: string | null;
  posicao: string | null;
  value: number;
}

type MetricKey = 'distanciaTotal' | 'metragemPorMinuto' | 'hsr' | 'sprint' | 'acelDesacelTotal';

interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  dec: number;
}

const METRICS: MetricDef[] = [
  { key: 'distanciaTotal',    label: 'Distância',  unit: 'm',     dec: 0 },
  { key: 'metragemPorMinuto', label: 'm/min',      unit: 'm/min', dec: 1 },
  { key: 'hsr',               label: 'HSR',        unit: 'm',     dec: 0 },
  { key: 'sprint',            label: 'Sprint',     unit: 'm',     dec: 0 },
  { key: 'acelDesacelTotal',  label: 'Acel+Desac', unit: '',      dec: 0 },
];

interface AtletaInput {
  jogadorId: number;
  nome: string;
  apelido: string | null;
  posicao: string | null;
  distanciaTotal: number | null;
  metragemPorMinuto: number | null;
  hsr: number | null;
  sprint: number | null;
  acelDesacelTotal: number | null;
}

interface Props {
  atletas: AtletaInput[];
  /** Métrica inicial — default 'distanciaTotal' */
  defaultMetric?: MetricKey;
}

interface Stats {
  count: number;
  min: number; max: number;
  q1: number;  q2: number; q3: number;     // mediana = q2
  iqr: number;
  whiskerLo: number; whiskerHi: number;    // Tukey 1.5 IQR
  outliers: BoxRow[];
}

// Quartis lineares
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

function computeStats(rows: BoxRow[]): Stats {
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  const vals = sorted.map(r => r.value);
  const min = vals[0] ?? 0;
  const max = vals[vals.length - 1] ?? 0;
  const q1 = quantile(vals, 0.25);
  const q2 = quantile(vals, 0.50);
  const q3 = quantile(vals, 0.75);
  const iqr = q3 - q1;
  const fence = 1.5 * iqr;
  const whiskerLo = vals.find(v => v >= q1 - fence) ?? min;
  const whiskerHi = [...vals].reverse().find(v => v <= q3 + fence) ?? max;
  const outliers = sorted.filter(r => r.value < whiskerLo || r.value > whiskerHi);
  return { count: rows.length, min, max, q1, q2, q3, iqr, whiskerLo, whiskerHi, outliers };
}

const fmt = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const W = 720, H = 280;
const PAD_L = 56, PAD_R = 16, PAD_T = 16, PAD_B = 38;
const PW = W - PAD_L - PAD_R;
const PH = H - PAD_T - PAD_B;

export const BoxPlotByPosition: React.FC<Props> = ({ atletas, defaultMetric = 'distanciaTotal' }) => {
  const [metric, setMetric] = useState<MetricKey>(defaultMetric);
  const [hoverOutlier, setHoverOutlier] = useState<{ row: BoxRow; pos: string } | null>(null);

  const metricDef = METRICS.find(m => m.key === metric)!;

  // Valor por atleta (filtra zero/NA)
  const rows: BoxRow[] = atletas
    .map(a => ({
      jogadorId: a.jogadorId,
      nome: a.nome,
      apelido: a.apelido,
      posicao: a.posicao,
      value: a[metric] ?? 0,
    }))
    .filter(r => r.value > 0);

  // Agrupa por posição (sigla curta extraída de posicaoCodigo + cor)
  const grupos = new Map<string, BoxRow[]>();
  for (const r of rows) {
    const cod = r.posicao ? posicaoCodigo(r.posicao) : 'S/P';
    if (!grupos.has(cod)) grupos.set(cod, []);
    grupos.get(cod)!.push(r);
  }

  // Ordem fixa pelas posições conhecidas (depois posições "extras")
  const POS_ORDER = ['GOL', '1', '2', '3', '4', '5', '6', '7'];
  const posicoesOrdenadas = Array.from(grupos.keys()).sort((a, b) => {
    const ai = POS_ORDER.indexOf(a);
    const bi = POS_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });

  if (rows.length === 0 || posicoesOrdenadas.length === 0) {
    return (
      <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-8">
        Sem dados suficientes para a métrica selecionada.
      </div>
    );
  }

  // Eixo Y: 0 → max global (com 10% de folga)
  const maxGlobal = Math.max(...rows.map(r => r.value)) * 1.08;
  const minGlobal = 0;
  const ySpan = Math.max(maxGlobal - minGlobal, 0.0001);

  const y = (v: number) => PAD_T + ((maxGlobal - v) / ySpan) * PH;

  // Largura de cada coluna (posição)
  const colW = PW / posicoesOrdenadas.length;
  const boxW = Math.min(colW * 0.55, 60);

  // Ticks Y a cada ~5 valores
  const yTicks: number[] = [];
  const step = niceStep(maxGlobal / 5);
  for (let t = 0; t <= maxGlobal; t += step) yTicks.push(t);

  return (
    <div className="relative">
      {/* Toggle métrica */}
      <div className="flex flex-wrap items-center justify-end gap-1 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Métrica</span>
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

      <svg role="img" aria-label="Box plot da distribuição da métrica por posição" viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ minHeight: 240 }}>
        {/* Grid Y + ticks */}
        {yTicks.map(t => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)}
              stroke="currentColor" strokeOpacity="0.06" />
            <text x={PAD_L - 6} y={y(t) + 3} fontSize="9" textAnchor="end"
              className="fill-slate-400 dark:fill-slate-500 tabular-nums">
              {fmt(t, metricDef.dec)}
            </text>
          </g>
        ))}

        {/* Eixos */}
        <line x1={PAD_L} x2={PAD_L + PW} y1={PAD_T + PH} y2={PAD_T + PH}
          stroke="currentColor" strokeOpacity="0.25" />
        <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={PAD_T + PH}
          stroke="currentColor" strokeOpacity="0.25" />

        {/* Label Y */}
        <text x={14} y={PAD_T + PH / 2} fontSize="10" textAnchor="middle"
          className="fill-slate-500 dark:fill-slate-400 font-bold tracking-wide"
          transform={`rotate(-90 14 ${PAD_T + PH / 2})`}>
          {metricDef.label}{metricDef.unit && ` (${metricDef.unit})`}
        </text>

        {/* Boxes por posição */}
        {posicoesOrdenadas.map((cod, i) => {
          const groupRows = grupos.get(cod)!;
          const cx = PAD_L + colW * (i + 0.5);
          const cor = POSICAO_COLOR[cod] ?? '#64748b';
          const stats = computeStats(groupRows);
          const single = groupRows.length === 1;

          // Single ponto: desenha apenas como círculo
          if (single) {
            const v = groupRows[0]!.value;
            return (
              <g key={cod}>
                <circle cx={cx} cy={y(v)} r={4} fill={cor} stroke="white" strokeWidth="1" />
                <text x={cx} y={H - 22} fontSize="10" textAnchor="middle"
                  className="fill-slate-700 dark:fill-slate-200 font-bold">{cod}</text>
                <text x={cx} y={H - 10} fontSize="9" textAnchor="middle"
                  className="fill-slate-400 dark:fill-slate-500">1 atl.</text>
              </g>
            );
          }

          const xLeft  = cx - boxW / 2;
          const xRight = cx + boxW / 2;
          const yQ1 = y(stats.q1);
          const yQ2 = y(stats.q2);
          const yQ3 = y(stats.q3);
          const yWLo = y(stats.whiskerLo);
          const yWHi = y(stats.whiskerHi);

          return (
            <g key={cod}>
              {/* Whiskers (linha vertical inteira) */}
              <line x1={cx} x2={cx} y1={yWHi} y2={yWLo}
                stroke={cor} strokeOpacity="0.5" strokeWidth="1.2" />
              {/* Caps dos whiskers */}
              <line x1={xLeft + boxW * 0.25} x2={xRight - boxW * 0.25} y1={yWHi} y2={yWHi}
                stroke={cor} strokeWidth="1.2" />
              <line x1={xLeft + boxW * 0.25} x2={xRight - boxW * 0.25} y1={yWLo} y2={yWLo}
                stroke={cor} strokeWidth="1.2" />

              {/* Caixa Q1–Q3 */}
              <rect x={xLeft} y={yQ3} width={boxW} height={Math.max(yQ1 - yQ3, 1)}
                fill={cor} fillOpacity="0.18" stroke={cor} strokeWidth="1.4" />

              {/* Linha da mediana */}
              <line x1={xLeft} x2={xRight} y1={yQ2} y2={yQ2}
                stroke={cor} strokeWidth="2.2" />

              {/* Outliers como pontos */}
              {stats.outliers.map(o => (
                <circle key={o.jogadorId} cx={cx} cy={y(o.value)} r={3.2}
                  fill="#fff" stroke={cor} strokeWidth="1.5"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoverOutlier({ row: o, pos: cod })}
                  onMouseLeave={() => setHoverOutlier(null)} />
              ))}

              {/* Label da posição */}
              <text x={cx} y={H - 22} fontSize="10" textAnchor="middle"
                className="fill-slate-700 dark:fill-slate-200 font-bold">{cod}</text>
              <text x={cx} y={H - 10} fontSize="9" textAnchor="middle"
                className="fill-slate-400 dark:fill-slate-500">
                {stats.count} atl. · med {fmt(stats.q2, metricDef.dec)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-2 border-2 border-current rounded-sm bg-current/20" />
          Caixa = Q1 a Q3 (50% central)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-current" />
          Linha grossa = mediana
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-current bg-white" />
          Outlier (Tukey 1.5×IQR)
        </span>
      </div>

      {/* Tooltip de outlier */}
      {hoverOutlier && (
        <div className="absolute top-2 right-2 bg-slate-900/95 dark:bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-[11px] pointer-events-none shadow-xl">
          <div className="text-white font-bold mb-0.5">
            {hoverOutlier.row.apelido || hoverOutlier.row.nome}
          </div>
          <div className="text-slate-400 text-[10px] mb-1">
            {hoverOutlier.row.posicao || hoverOutlier.pos}
          </div>
          <div className="tabular-nums">
            <span className="text-slate-300">{metricDef.label}: </span>
            <span className="text-white font-bold">{fmt(hoverOutlier.row.value, metricDef.dec)} {metricDef.unit}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Step "redondo" perto do valor desejado (1, 2, 5, 10, 20, 50, 100, ...)
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const norm = raw / base;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * base;
}
