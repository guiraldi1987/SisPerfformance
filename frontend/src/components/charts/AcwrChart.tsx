import React from 'react';

export interface AcwrPoint {
  data: string;
  aguda: number;
  cronica: number;
  acwr: number | null;
  cargaDia: number;
}

interface Props {
  serie: AcwrPoint[];
  height?: number;
}

const ZONAS = [
  { min: 0,    max: 0.8, color: 'rgba(234, 179, 8, 0.10)',   label: 'Sub-treinado' },
  { min: 0.8,  max: 1.3, color: 'rgba(16, 185, 129, 0.12)',  label: 'Ideal' },
  { min: 1.3,  max: 1.5, color: 'rgba(249, 115, 22, 0.12)',  label: 'Atenção' },
  { min: 1.5,  max: 2.5, color: 'rgba(220, 38, 38, 0.14)',   label: 'Risco' },
];

export const AcwrChart: React.FC<Props> = ({ serie, height = 220 }) => {
  // Filtra pontos onde ACWR existe (após 28 dias de dados)
  const pontos = serie.filter(p => p.acwr != null);

  if (pontos.length < 2) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 py-12 px-4 text-center">
        Coletando dados base — ACWR confiável requer ~28 dias de histórico.
        <br />Sessões disponíveis: {serie.length} dias.
      </div>
    );
  }

  const W = 800;
  const H = height;
  const PAD_L = 40, PAD_R = 12, PAD_T = 12, PAD_B = 28;
  const PW = W - PAD_L - PAD_R;
  const PH = H - PAD_T - PAD_B;

  const yMax = 2.5;
  const yMin = 0;

  const x = (i: number) => PAD_L + (i / Math.max(pontos.length - 1, 1)) * PW;
  const y = (v: number) => PAD_T + ((yMax - v) / (yMax - yMin)) * PH;

  // Linha do ACWR
  const path = pontos
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.acwr!)}`)
    .join(' ');

  const yTicks = [0, 0.5, 0.8, 1.0, 1.3, 1.5, 2.0, 2.5];

  // Mostra ticks X esparsos
  const xTickEvery = Math.max(1, Math.floor(pontos.length / 8));

  return (
    <div className="overflow-x-auto">
      <svg role="img" aria-label="Gráfico de ACWR (carga aguda 7 dias ÷ carga crônica 28 dias) por sessão" viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 600 }}>
        {/* Bandas coloridas das zonas */}
        {ZONAS.map((z, i) => {
          const yTop = y(Math.min(z.max, yMax));
          const yBot = y(Math.max(z.min, yMin));
          return (
            <rect key={i} x={PAD_L} y={yTop} width={PW} height={yBot - yTop} fill={z.color} />
          );
        })}

        {/* Y-axis ticks + grid */}
        {yTicks.map(t => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)}
              stroke="currentColor" strokeOpacity="0.08" />
            <text x={PAD_L - 6} y={y(t) + 3} fontSize="9" textAnchor="end"
              className="fill-slate-400 dark:fill-slate-500">
              {t.toFixed(t === 1 ? 1 : 1)}
            </text>
          </g>
        ))}

        {/* X-axis ticks */}
        {pontos.map((p, i) => i % xTickEvery === 0 && (
          <text key={p.data} x={x(i)} y={H - 8}
            fontSize="8" textAnchor="middle"
            className="fill-slate-400 dark:fill-slate-500">
            {p.data.slice(5)}
          </text>
        ))}

        {/* Linha principal do ACWR */}
        <path d={path} fill="none" stroke="#cc1e1e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Pontos */}
        {pontos.map((p, i) => {
          const acwr = p.acwr!;
          const color = acwr > 1.5 ? '#dc2626' : acwr > 1.3 ? '#f97316' : acwr < 0.8 ? '#eab308' : '#10b981';
          return (
            <circle key={p.data} cx={x(i)} cy={y(acwr)} r={2.5} fill={color}>
              <title>{`${p.data}\nACWR: ${acwr.toFixed(2)}\nAguda: ${p.aguda.toFixed(1)}\nCrônica: ${p.cronica.toFixed(1)}`}</title>
            </circle>
          );
        })}

        {/* Linhas de referência 1.0 (estável) */}
        <line x1={PAD_L} x2={W - PAD_R} y1={y(1.0)} y2={y(1.0)}
          stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
      </svg>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 mt-2 text-[10px]">
        {ZONAS.map(z => (
          <span key={z.label} className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="w-3 h-3 rounded-sm border border-slate-200 dark:border-white/10" style={{ background: z.color }} />
            {z.label} ({z.min.toFixed(1)}–{z.max.toFixed(1)})
          </span>
        ))}
      </div>
    </div>
  );
};
