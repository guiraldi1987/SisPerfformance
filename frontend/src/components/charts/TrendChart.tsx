import React, { useState } from 'react';

export interface TrendPoint {
  data: string;            // YYYY-MM-DD
  tipo: string;            // 'Treino' | 'Jogo'
  descricao: string | null;
  dist: number;            // m
  mpm: number;             // m/min
  hsr: number;             // m
  sprint: number;          // m
}

type MetricKey = 'dist' | 'mpm' | 'hsr' | 'sprint';

interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  color: string;
  dec: number;
}

const METRICS: MetricDef[] = [
  { key: 'dist',   label: 'Distância', unit: 'm',     color: '#0d9488', dec: 0 },
  { key: 'mpm',    label: 'm/min',     unit: 'm/min', color: '#1e3a5f', dec: 1 },
  { key: 'hsr',    label: 'HSR',       unit: 'm',     color: '#f59e0b', dec: 0 },
  { key: 'sprint', label: 'Sprint',    unit: 'm',     color: '#ef4444', dec: 0 },
];

interface Props {
  pontos: TrendPoint[];   // ordenados ascendentes por data
}

export const TrendChart: React.FC<Props> = ({ pontos }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (pontos.length < 2) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 py-12 text-center">
        Mínimo de 2 sessões para gerar tendência. Sessões disponíveis: {pontos.length}.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {METRICS.map(metric => (
        <Sparkline
          key={metric.key}
          metric={metric}
          pontos={pontos}
          hoverIdx={hoverIdx}
          onHover={setHoverIdx}
        />
      ))}
    </div>
  );
};

const Sparkline: React.FC<{
  metric: MetricDef;
  pontos: TrendPoint[];
  hoverIdx: number | null;
  onHover: (i: number | null) => void;
}> = ({ metric, pontos, hoverIdx, onHover }) => {
  const W = 280, H = 88;
  const PAD_L = 6, PAD_R = 6, PAD_T = 6, PAD_B = 14;
  const PW = W - PAD_L - PAD_R;
  const PH = H - PAD_T - PAD_B;

  const values = pontos.map(p => p[metric.key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.0001);
  const yMax = max + range * 0.12;
  const yMin = Math.max(0, min - range * 0.12);
  const ySpan = Math.max(yMax - yMin, 0.0001);

  const x = (i: number) => PAD_L + (i / Math.max(pontos.length - 1, 1)) * PW;
  const y = (v: number) => PAD_T + ((yMax - v) / ySpan) * PH;

  const path = pontos.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p[metric.key]).toFixed(1)}`
  ).join(' ');

  const area = `${path} L ${x(pontos.length - 1).toFixed(1)} ${(PAD_T + PH).toFixed(1)} L ${x(0).toFixed(1)} ${(PAD_T + PH).toFixed(1)} Z`;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const last = values[values.length - 1]!;
  const delta = avg > 0 ? ((last - avg) / avg) * 100 : 0;
  const trend: 'up' | 'down' | 'flat' = delta > 3 ? 'up' : delta < -3 ? 'down' : 'flat';
  const trendColor =
    trend === 'up'   ? 'text-emerald-600 dark:text-emerald-400'
  : trend === 'down' ? 'text-amber-600 dark:text-amber-400'
                     : 'text-slate-400 dark:text-slate-500';

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: metric.dec, maximumFractionDigits: metric.dec });

  const gradId = `trend-grad-${metric.key}`;
  const hoverPoint = hoverIdx != null ? pontos[hoverIdx] : null;

  return (
    <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-lg p-3 relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ background: metric.color }} />
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {metric.label}
          </span>
        </div>
        <span className={`text-[10px] font-bold tabular-nums ${trendColor}`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {Math.abs(delta).toFixed(0)}%
        </span>
      </div>

      {/* Latest value */}
      <div className="flex items-baseline gap-1 mb-1.5">
        <span className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white leading-none">
          {fmt(last)}
        </span>
        <span className="text-[10px] text-slate-400">{metric.unit}</span>
        <span className="text-[9px] text-slate-400 dark:text-slate-500 ml-auto">
          última
        </span>
      </div>

      {/* Sparkline */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full block text-slate-400 dark:text-slate-500"
        preserveAspectRatio="none"
        style={{ height: H }}
        onMouseLeave={() => onHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={metric.color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Average reference line */}
        <line x1={PAD_L} x2={W - PAD_R} y1={y(avg)} y2={y(avg)}
          stroke="currentColor" strokeOpacity="0.35" strokeDasharray="2 3" strokeWidth="0.8" />

        {/* Area + line */}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={path} fill="none" stroke={metric.color} strokeWidth="1.6"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Hover capture (full-height invisible rects) */}
        {pontos.map((_, i) => {
          const cx = x(i);
          const left  = i === 0 ? 0 : (cx + x(i - 1)) / 2;
          const right = i === pontos.length - 1 ? W : (cx + x(i + 1)) / 2;
          return (
            <rect key={i} x={left} y={0} width={right - left} height={H}
              fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseEnter={() => onHover(i)} />
          );
        })}

        {/* Hover indicator */}
        {hoverIdx != null && (
          <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD_T} y2={PAD_T + PH}
            stroke="currentColor" strokeOpacity="0.4" strokeDasharray="2 2" strokeWidth="0.8"
            pointerEvents="none" />
        )}

        {/* Points: jogos maiores, último em destaque, hover ainda maior */}
        {pontos.map((p, i) => {
          const isLast  = i === pontos.length - 1;
          const isHover = hoverIdx === i;
          const isJogo  = p.tipo === 'Jogo';
          const r = isHover ? 3.6 : isLast ? 3.0 : isJogo ? 2.4 : 1.5;
          return (
            <circle key={i} cx={x(i)} cy={y(p[metric.key])} r={r}
              fill={metric.color}
              fillOpacity={isJogo || isLast || isHover ? 1 : 0.55}
              pointerEvents="none" />
          );
        })}
      </svg>

      {/* Footer */}
      <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 mt-1 tabular-nums">
        <span>min {fmt(min)}</span>
        <span className="text-slate-500 dark:text-slate-400">avg {fmt(avg)}</span>
        <span>max {fmt(max)}</span>
      </div>

      {/* Hover tooltip */}
      {hoverPoint && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full bg-slate-900/95 dark:bg-black/90 backdrop-blur-sm border border-white/10 rounded-md px-2 py-1.5 text-[10px] pointer-events-none shadow-xl z-10 whitespace-nowrap">
          <div className="text-white font-bold tabular-nums">
            {fmt(hoverPoint[metric.key])} <span className="text-slate-400 font-normal">{metric.unit}</span>
          </div>
          <div className="text-slate-300 text-[9px] flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${hoverPoint.tipo === 'Jogo' ? 'bg-club-red' : 'bg-slate-400'}`} />
            {hoverPoint.data}
          </div>
        </div>
      )}
    </div>
  );
};
