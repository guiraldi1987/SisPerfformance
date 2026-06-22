import React from 'react';

interface GaugeProps {
  title: string;
  value: number;
  max: number;
  topAtleta?: number;
  unit?: string;
}

export const Gauge: React.FC<GaugeProps> = ({ title, value, max, topAtleta, unit }) => {
  const ratio = Math.min(Math.max(value / max, 0), 1);
  const cx = 100, cy = 100, r = 78;

  // Desenha um segmento de arco entre dois ratios (0–1) no semicírculo superior.
  // O arco vai de 180° (esquerda) até 0° (direita), no sentido horário via parte superior.
  const arc = (s: number, e: number, color: string) => {
    const a1 = (180 - s * 180) * Math.PI / 180;
    const a2 = (180 - e * 180) * Math.PI / 180;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy - r * Math.sin(a2);
    const largeArc = (e - s) > 0.5 ? 1 : 0;
    return (
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
        stroke={color}
        strokeWidth={16}
        fill="none"
        strokeLinecap="butt"
      />
    );
  };

  // Agulha: linha do centro até o bordo do arco no ângulo do valor atual
  const needleAngle = (180 - ratio * 180) * Math.PI / 180;
  const nx = cx + (r - 4) * Math.cos(needleAngle);
  const ny = cy - (r - 4) * Math.sin(needleAngle);

  return (
    <div className="flex flex-col items-center">
      <svg role="img" aria-label={`${title}: ${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${unit ? ' ' + unit : ''} de ${max} máximo`} viewBox="0 0 200 125" className="w-44 h-28">
        {/* Trilha de fundo */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          stroke="#e5e7eb"
          strokeWidth={16}
          fill="none"
          strokeLinecap="butt"
          className="dark:stroke-white/10"
        />
        {/* Três zonas: verde → laranja → vermelho */}
        {arc(0.0, 0.4, '#4caf50')}
        {arc(0.4, 0.7, '#ff9800')}
        {arc(0.7, 1.0, '#f44336')}
        {/* Rótulos min/max */}
        <text x={cx - r - 4} y={cy + 14} fontSize="8" fill="#94a3b8" textAnchor="middle">0</text>
        <text x={cx + r + 4} y={cy + 14} fontSize="8" fill="#94a3b8" textAnchor="middle">{max}</text>
        {/* Título */}
        <text
          x={cx}
          y={cy - 28}
          fontSize="12"
          fontWeight="700"
          textAnchor="middle"
          className="fill-slate-700 dark:fill-slate-200"
        >
          {title}
        </text>
        {/* Agulha */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#1f2937"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="dark:stroke-white"
        />
        {/* Pivô da agulha */}
        <circle cx={cx} cy={cy} r={5} fill="#1f2937" className="dark:fill-white" />
      </svg>
      <span className="text-2xl font-bold text-slate-900 dark:text-white -mt-1 tabular-nums">
        {value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
        {unit && <span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>}
      </span>
      {topAtleta !== undefined && (
        <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums">
          Máx: {topAtleta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
        </span>
      )}
    </div>
  );
};
