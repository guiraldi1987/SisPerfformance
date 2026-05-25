import React, { useState } from 'react';

export interface RadarAxis {
  label: string;
  unit: string;
  dec: number;
  player: number;   // valor absoluto do atleta
  avg: number;      // média da posição (jogos)
  top: number;      // p95 da posição (jogos)
}

interface Props {
  axes: RadarAxis[];
  posicaoLabel: string;
  amostras: number;     // tamanho da amostra da posição
}

const W = 480, H = 380;
const CX = W / 2, CY = H / 2 - 8;
const R  = 130;        // raio para "100%" (= top da posição)
const R_MAX = 165;     // raio máximo visual (≈ 127% do top)
const SCALE_MAX = R_MAX / R;

const RINGS = [0.25, 0.5, 0.75, 1.0]; // anéis em % do top

const fmt = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// Coordenadas (cx, cy) → ponto no eixo i (0 no topo, sentido horário) com raio r%
function point(i: number, total: number, ratio: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / total;
  const ratioCapped = Math.min(ratio, SCALE_MAX);
  const r = R * ratioCapped;
  return [CX + Math.cos(angle) * r, CY + Math.sin(angle) * r];
}

export const RadarComparativo: React.FC<Props> = ({ axes, posicaoLabel, amostras }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (axes.length < 3 || amostras < 3) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 py-12 text-center">
        Radar precisa de ≥3 jogos da posição como referência.
        <br />Amostras atuais: {amostras}.
      </div>
    );
  }

  const total = axes.length;

  // Normaliza pela top da posição (= raio = R = 100%)
  const ratios = axes.map(a => ({
    player: a.top > 0 ? a.player / a.top : 0,
    avg:    a.top > 0 ? a.avg    / a.top : 0,
    top:    1,
  }));

  const playerPath = ratios.map((r, i) => point(i, total, r.player));
  const avgPath    = ratios.map((r, i) => point(i, total, r.avg));

  const pathStr = (pts: [number, number][]) =>
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ minHeight: 260 }}>
        {/* ── Anéis ──────────────────────────────────────────────────────── */}
        {RINGS.map(ratio => {
          const pts = Array.from({ length: total }, (_, i) => point(i, total, ratio));
          return (
            <polygon key={ratio}
              points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none" stroke="currentColor" strokeOpacity={ratio === 1 ? 0.25 : 0.08}
              strokeWidth={ratio === 1 ? 1 : 0.8}
              strokeDasharray={ratio === 1 ? '0' : '0'} />
          );
        })}

        {/* Anel além dos 100% (linha tracejada — onde o jogador supera o p95) */}
        {(() => {
          const pts = Array.from({ length: total }, (_, i) => point(i, total, SCALE_MAX));
          return (
            <polygon
              points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none" stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3 3" />
          );
        })()}

        {/* ── Eixos (radiais) ────────────────────────────────────────────── */}
        {axes.map((_, i) => {
          const [ex, ey] = point(i, total, SCALE_MAX);
          return (
            <line key={i} x1={CX} y1={CY} x2={ex} y2={ey}
              stroke="currentColor" strokeOpacity={0.1} strokeWidth={0.8} />
          );
        })}

        {/* Polígono média da posição (atrás) */}
        <path d={pathStr(avgPath)}
          fill="#94a3b8" fillOpacity={0.15}
          stroke="#64748b" strokeWidth={1.4} strokeDasharray="4 3" />

        {/* Polígono do jogador (frente) */}
        <path d={pathStr(playerPath)}
          fill="#cc1e1e" fillOpacity={0.22}
          stroke="#cc1e1e" strokeWidth={1.8} strokeLinejoin="round" />

        {/* Pontos do jogador (interativos) */}
        {playerPath.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={hoverIdx === i ? 5 : 3.5}
            fill="#cc1e1e" stroke="#fff" strokeWidth="1"
            style={{ cursor: 'pointer', transition: 'r 0.15s' }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)} />
        ))}

        {/* ── Labels dos eixos ───────────────────────────────────────────── */}
        {axes.map((a, i) => {
          const [x, y] = point(i, total, SCALE_MAX + 0.10);
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / total;
          // Pequeno offset vertical para os labels do topo/base
          const dy = Math.abs(angle + Math.PI / 2) < 0.1 ? -2
                  : Math.abs(angle - Math.PI / 2) < 0.1 ? 10
                  : 4;
          const anchor =
              x > CX + 5 ? 'start'
            : x < CX - 5 ? 'end'
            : 'middle';
          return (
            <g key={a.label}>
              <text x={x} y={y + dy} fontSize="10" textAnchor={anchor}
                className="fill-slate-700 dark:fill-slate-200 font-bold">
                {a.label}
              </text>
              <text x={x} y={y + dy + 11} fontSize="9" textAnchor={anchor}
                className="fill-slate-400 dark:fill-slate-500 tabular-nums">
                {fmt(a.player, a.dec)}{a.unit && ` ${a.unit}`}
              </text>
            </g>
          );
        })}

        {/* Centro: 0% */}
        <circle cx={CX} cy={CY} r={2} fill="currentColor" className="text-slate-400 dark:text-slate-600" />
      </svg>

      {/* Legenda */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2 border-club-red" style={{ background: 'rgba(204,30,30,0.22)' }} />
          Atleta
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2 border-dashed border-slate-500" />
          Média {posicaoLabel} ({amostras})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-white/20" />
          Borda externa = melhor (p95) da posição
        </span>
      </div>

      {/* Tooltip do eixo em hover */}
      {hoverIdx != null && (() => {
        const a = axes[hoverIdx]!;
        const r = ratios[hoverIdx]!;
        const pctVsAvg = a.avg > 0 ? ((a.player - a.avg) / a.avg) * 100 : 0;
        return (
          <div className="absolute top-2 right-2 bg-slate-900/95 dark:bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-[11px] pointer-events-none shadow-xl">
            <div className="text-white font-bold mb-1">{a.label}</div>
            <div className="space-y-0.5 text-[10px] tabular-nums">
              <div className="flex justify-between gap-4">
                <span className="text-club-red">Atleta</span>
                <span className="text-white">{fmt(a.player, a.dec)} {a.unit}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Média pos.</span>
                <span className="text-slate-200">{fmt(a.avg, a.dec)} {a.unit}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Top (p95)</span>
                <span className="text-slate-200">{fmt(a.top, a.dec)} {a.unit}</span>
              </div>
              <div className="flex justify-between gap-4 pt-1 mt-1 border-t border-white/10">
                <span className="text-slate-400">vs média</span>
                <span className={pctVsAvg >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                  {pctVsAvg >= 0 ? '+' : ''}{pctVsAvg.toFixed(0)}% · {(r.player * 100).toFixed(0)}% top
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
