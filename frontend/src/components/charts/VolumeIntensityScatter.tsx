import React, { useState } from 'react';
import { posicaoCodigo, POSICAO_COLOR } from '../../lib/constants';

export interface ScatterPoint {
  jogadorId: number;
  nome: string;
  apelido: string | null;
  posicao: string | null;
  volumePct: number;       // % vs MD em distância
  intensidadePct: number;  // % vs MD em m/min
}

interface Props {
  pontos: ScatterPoint[];
  /** Limites da zona "ideal" central em % do MD. */
  idealMin?: number;       // default 75
  idealMax?: number;       // default 115
  height?: number;
}

const W = 560, H = 320;
const PAD_L = 44, PAD_R = 14, PAD_T = 14, PAD_B = 32;
const PW = W - PAD_L - PAD_R;
const PH = H - PAD_T - PAD_B;

// Eixos de 0 a maxAxis% (auto-ajustado, mín 140%)
const computeMaxAxis = (pts: ScatterPoint[]) => {
  const max = Math.max(140, ...pts.map(p => Math.max(p.volumePct, p.intensidadePct)));
  return Math.ceil(max / 20) * 20;
};

export const VolumeIntensityScatter: React.FC<Props> = ({
  pontos, idealMin = 75, idealMax = 115, height = 320,
}) => {
  const [hoverId, setHoverId] = useState<number | null>(null);

  if (pontos.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-500 dark:text-slate-500 py-12">
        Sem atletas com dados nesta sessão.
      </div>
    );
  }

  const maxAxis = computeMaxAxis(pontos);
  const x = (v: number) => PAD_L + (Math.min(v, maxAxis) / maxAxis) * PW;
  const y = (v: number) => PAD_T + ((maxAxis - Math.min(v, maxAxis)) / maxAxis) * PH;

  const xMin = x(idealMin), xMax = x(idealMax);
  const yMin = y(idealMax), yMax = y(idealMin);

  // Ticks a cada 20% (0, 20, 40, ...)
  const ticks: number[] = [];
  for (let t = 0; t <= maxAxis; t += 20) ticks.push(t);

  // Ordena por posição (estável) — depois sobrepõe o hovered no fim
  const sorted = [...pontos].sort((a, b) =>
    (a.posicao ?? 'ZZ').localeCompare(b.posicao ?? 'ZZ') || a.nome.localeCompare(b.nome)
  );
  const hovered = hoverId != null ? pontos.find(p => p.jogadorId === hoverId) ?? null : null;

  return (
    <div className="relative">
      <svg role="img" aria-label="Dispersão de volume por intensidade dos atletas" viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ height, minHeight: 240 }}
        onMouseLeave={() => setHoverId(null)}>
        {/* ── Quadrantes (zonas) ───────────────────────────────────────────── */}
        {/* Sub-treinado: vol baixo + int baixa (canto inferior esq) */}
        <rect x={PAD_L} y={yMax} width={xMin - PAD_L} height={PAD_T + PH - yMax}
          fill="#eab308" fillOpacity="0.06" />
        {/* Volume excessivo (direita-baixo): muita corrida, pouco intenso */}
        <rect x={xMax} y={yMax} width={PAD_L + PW - xMax} height={PAD_T + PH - yMax}
          fill="#3b82f6" fillOpacity="0.06" />
        {/* Intenso curto (esq-cima): pouca distância, alta intensidade */}
        <rect x={PAD_L} y={PAD_T} width={xMin - PAD_L} height={yMin - PAD_T}
          fill="#a855f7" fillOpacity="0.06" />
        {/* Sobrecarga (cima-direita): muito vol + alta int */}
        <rect x={xMax} y={PAD_T} width={PAD_L + PW - xMax} height={yMin - PAD_T}
          fill="#ef4444" fillOpacity="0.08" />
        {/* Faixa ideal central */}
        <rect x={xMin} y={yMin} width={xMax - xMin} height={yMax - yMin}
          fill="#10b981" fillOpacity="0.10" stroke="#10b981" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3" />

        {/* ── Grid + ticks ─────────────────────────────────────────────────── */}
        {ticks.map(t => (
          <g key={`x-${t}`}>
            <line x1={x(t)} x2={x(t)} y1={PAD_T} y2={PAD_T + PH}
              stroke="currentColor" strokeOpacity={t === 100 ? 0.25 : 0.06}
              strokeDasharray={t === 100 ? '0' : '0'} />
            <text x={x(t)} y={H - 14} fontSize="9" textAnchor="middle"
              className="fill-slate-400 dark:fill-slate-500">{t}</text>
          </g>
        ))}
        {ticks.map(t => (
          <g key={`y-${t}`}>
            <line x1={PAD_L} x2={PAD_L + PW} y1={y(t)} y2={y(t)}
              stroke="currentColor" strokeOpacity={t === 100 ? 0.25 : 0.06} />
            <text x={PAD_L - 6} y={y(t) + 3} fontSize="9" textAnchor="end"
              className="fill-slate-400 dark:fill-slate-500">{t}</text>
          </g>
        ))}

        {/* Linhas 100% MD (vertical e horizontal) */}
        <line x1={x(100)} x2={x(100)} y1={PAD_T} y2={PAD_T + PH}
          stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" opacity="0.55" />
        <line x1={PAD_L} x2={PAD_L + PW} y1={y(100)} y2={y(100)}
          stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" opacity="0.55" />

        {/* Eixos */}
        <line x1={PAD_L} x2={PAD_L + PW} y1={PAD_T + PH} y2={PAD_T + PH}
          stroke="currentColor" strokeOpacity="0.25" />
        <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={PAD_T + PH}
          stroke="currentColor" strokeOpacity="0.25" />

        {/* Labels de eixo */}
        <text x={PAD_L + PW / 2} y={H - 2} fontSize="10" textAnchor="middle"
          className="fill-slate-500 dark:fill-slate-400 font-bold tracking-wide">
          VOLUME (% Distância vs MD)
        </text>
        <text x={10} y={PAD_T + PH / 2} fontSize="10" textAnchor="middle"
          className="fill-slate-500 dark:fill-slate-400 font-bold tracking-wide"
          transform={`rotate(-90 10 ${PAD_T + PH / 2})`}>
          INTENSIDADE (% m/min vs MD)
        </text>

        {/* Rótulos discretos nas zonas (canto da retangulo) */}
        <text x={xMin + (xMax - xMin) / 2} y={yMin - 4} fontSize="9" textAnchor="middle"
          className="fill-emerald-700 dark:fill-emerald-400 font-bold tracking-wide opacity-60">
          IDEAL
        </text>

        {/* ── Pontos ───────────────────────────────────────────────────────── */}
        {sorted.map(p => {
          const codigo = p.posicao ? posicaoCodigo(p.posicao) : 'GOL';
          const cor = POSICAO_COLOR[codigo] ?? '#64748b';
          const cx = x(p.volumePct);
          const cy = y(p.intensidadePct);
          const isHover = hoverId === p.jogadorId;
          return (
            <g key={p.jogadorId}>
              <circle cx={cx} cy={cy} r={isHover ? 8 : 5}
                fill={cor} fillOpacity={isHover ? 1 : 0.85}
                stroke="white" strokeWidth={isHover ? 2 : 1}
                style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                onMouseEnter={() => setHoverId(p.jogadorId)} />
            </g>
          );
        })}

        {/* Hover crosshair + label */}
        {hovered && (() => {
          const codigo = hovered.posicao ? posicaoCodigo(hovered.posicao) : 'GOL';
          const cor = POSICAO_COLOR[codigo] ?? '#64748b';
          const cx = x(hovered.volumePct);
          const cy = y(hovered.intensidadePct);
          return (
            <g pointerEvents="none">
              <line x1={cx} x2={cx} y1={PAD_T} y2={PAD_T + PH}
                stroke={cor} strokeOpacity="0.35" strokeDasharray="2 2" />
              <line x1={PAD_L} x2={PAD_L + PW} y1={cy} y2={cy}
                stroke={cor} strokeOpacity="0.35" strokeDasharray="2 2" />
            </g>
          );
        })()}
      </svg>

      {/* Tooltip flutuante */}
      {hovered && (
        <div className="absolute top-2 right-2 bg-slate-900/95 dark:bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-[11px] pointer-events-none shadow-xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: hovered.posicao ? (POSICAO_COLOR[posicaoCodigo(hovered.posicao)] ?? '#64748b') : '#64748b' }} />
            <span className="text-white font-bold">{hovered.apelido || hovered.nome}</span>
            {hovered.posicao && <span className="text-slate-500 text-[10px]">{hovered.posicao}</span>}
          </div>
          <div className="flex gap-3 text-slate-300 tabular-nums">
            <span>Vol <b className="text-white">{hovered.volumePct.toFixed(0)}%</b></span>
            <span>Int <b className="text-white">{hovered.intensidadePct.toFixed(0)}%</b></span>
          </div>
        </div>
      )}

      {/* Legenda das zonas */}
      <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-emerald-500/50" style={{ background: 'rgba(16,185,129,0.15)' }} />
          Ideal ({idealMin}–{idealMax}%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(239,68,68,0.15)' }} />
          Sobrecarga (vol↑ + int↑)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(168,85,247,0.10)' }} />
          Curto-intenso (vol↓ + int↑)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(59,130,246,0.10)' }} />
          Volume sem ritmo (vol↑ + int↓)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(234,179,8,0.10)' }} />
          Sub-estímulo (vol↓ + int↓)
        </span>
      </div>
    </div>
  );
};
