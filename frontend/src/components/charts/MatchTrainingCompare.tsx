import React from 'react';

export interface ComparePoint {
  match: number;
  training: number;
}

export interface CompareData {
  dist:      ComparePoint;
  mpm:       ComparePoint;
  hsr:       ComparePoint;
  sprint:    ComparePoint;
  acelDesac: ComparePoint;
}

interface Props {
  data: CompareData;
  matchCount: number;
  trainingCount: number;
}

const ROWS: Array<{
  key: keyof CompareData;
  label: string;
  unit: string;
  color: string;
  dec: number;
}> = [
  { key: 'dist',      label: 'Distância',     unit: 'm',     color: '#0d9488', dec: 0 },
  { key: 'mpm',       label: 'm/min',         unit: 'm/min', color: '#1e3a5f', dec: 1 },
  { key: 'hsr',       label: 'HSR',           unit: 'm',     color: '#f59e0b', dec: 0 },
  { key: 'sprint',    label: 'Sprint',        unit: 'm',     color: '#ef4444', dec: 0 },
  { key: 'acelDesac', label: 'Acel + Desac',  unit: '',      color: '#7c3aed', dec: 0 },
];

export const MatchTrainingCompare: React.FC<Props> = ({ data, matchCount, trainingCount }) => {
  if (matchCount === 0 || trainingCount === 0) {
    return (
      <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-8 px-4">
        {matchCount === 0 && trainingCount === 0
          ? 'Nenhuma sessão para comparar.'
          : matchCount === 0
            ? 'Nenhum jogo registrado neste período.'
            : 'Nenhum treino registrado neste período.'}
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {ROWS.map(metric => {
        const point = data[metric.key];
        const max = Math.max(point.match, point.training, 1);
        const ratio = point.match > 0 ? (point.training / point.match) * 100 : 0;

        const fmt = (v: number) =>
          v.toLocaleString('pt-BR', { minimumFractionDigits: metric.dec, maximumFractionDigits: metric.dec });

        // Verde: 80–110% (treino próximo de jogo)
        // Âmbar: <60% (sub-estímulo) ou >135% (sobrecarga)
        // Cinza: zona neutra
        const ratioClass =
          ratio >= 80 && ratio <= 110 ? 'text-emerald-600 dark:text-emerald-400'
        : ratio < 60 || ratio > 135   ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-slate-500 dark:text-slate-400';

        return (
          <div key={metric.key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                <span className="w-2 h-2 rounded-sm" style={{ background: metric.color }} />
                {metric.label}
              </span>
              <span className={`text-[10px] font-bold tabular-nums ${ratioClass}`}>
                Treino = {ratio.toFixed(0)}% do jogo
              </span>
            </div>

            <div className="space-y-1">
              {/* Bar JOGO */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-club-red w-14 shrink-0 tracking-wide">JOGO</span>
                <div className="flex-1 h-5 bg-slate-100 dark:bg-white/[0.04] rounded-sm overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 rounded-sm flex items-center justify-end pr-2 transition-all"
                       style={{ width: `${(point.match / max) * 100}%`, background: metric.color }}>
                    <span className="text-[10px] font-bold text-white tabular-nums whitespace-nowrap">
                      {fmt(point.match)}{metric.unit && ` ${metric.unit}`}
                    </span>
                  </div>
                </div>
              </div>
              {/* Bar TREINO */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 w-14 shrink-0 tracking-wide">TREINO</span>
                <div className="flex-1 h-5 bg-slate-100 dark:bg-white/[0.04] rounded-sm overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 rounded-sm flex items-center justify-end pr-2 transition-all"
                       style={{ width: `${(point.training / max) * 100}%`, background: metric.color, opacity: 0.45 }}>
                    <span className="text-[10px] font-bold text-white tabular-nums whitespace-nowrap">
                      {fmt(point.training)}{metric.unit && ` ${metric.unit}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-2 mt-3 border-t border-slate-100 dark:border-white/[0.04] text-[10px] text-slate-400 dark:text-slate-500">
        <span><b className="text-slate-600 dark:text-slate-300">{matchCount}</b> jogos</span>
        <span>·</span>
        <span><b className="text-slate-600 dark:text-slate-300">{trainingCount}</b> treinos</span>
        <span className="ml-auto italic">Médias por sessão</span>
      </div>
    </div>
  );
};
