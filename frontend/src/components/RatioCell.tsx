import React from 'react';

// Relação Excêntrica / Concêntrica = desaceleração / aceleração.
//  • 0.85–1.15 → BALANCEADO (verde)
//  • 0.70–0.85 ou 1.15–1.30 → atenção (âmbar)
//  • <0.70 ou >1.30 → assimetria forte (vermelho)
//
// Numerador alto (desac > acel) sugere sobrecarga excêntrica → maior risco
// de lesão muscular. Numerador baixo, perfil mais explosivo/concêntrico.
export function computeECRatio(acel: number, desac: number): number | null {
  if (acel <= 0) return null;
  return desac / acel;
}

interface Props {
  acel: number;
  desac: number;
  /** Se passar `ratio` direto, ignora acel/desac (usado em footers de média) */
  ratio?: number | null;
}

export const RatioCell: React.FC<Props> = ({ acel, desac, ratio }) => {
  const r = ratio !== undefined ? ratio : computeECRatio(acel, desac);
  if (r == null) {
    return <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>;
  }
  const zona = r >= 0.85 && r <= 1.15 ? 'ok'
             : r >= 0.70 && r <= 1.30 ? 'atencao'
             : 'risco';
  const palette = zona === 'ok'
    ? { bg: 'bg-emerald-100 dark:bg-emerald-900/30', txt: 'text-emerald-700 dark:text-emerald-400' }
    : zona === 'atencao'
      ? { bg: 'bg-amber-100 dark:bg-amber-900/30',   txt: 'text-amber-700 dark:text-amber-400' }
      : { bg: 'bg-rose-100 dark:bg-rose-900/30',     txt: 'text-rose-700 dark:text-rose-400' };
  // Direção em torno de 1.0:
  //   ▼ ratio < 0.85  → concêntrico-dominante (acel > desac)
  //   ● 0.85 – 1.15   → balanceado
  //   ▲ ratio > 1.15  → excêntrico-dominante (desac > acel)
  const icone = r < 0.85 ? '▼' : r > 1.15 ? '▲' : '●';
  const direcaoLabel = r < 0.85 ? 'perfil concêntrico (acel > desac)'
                     : r > 1.15 ? 'perfil excêntrico (desac > acel)'
                     : 'balanceado';
  return (
    <span
      className={`inline-flex items-center justify-end gap-1 px-2 py-0.5 rounded-md text-xs font-bold tabular-nums ${palette.bg} ${palette.txt}`}
      title={
        `Desac/Acel = ${r.toFixed(2)} · ${direcaoLabel} · ${
          zona === 'ok' ? 'zona ideal'
          : zona === 'atencao' ? 'atenção — assimetria moderada'
          : 'assimetria forte — risco neuromuscular'
        }`
      }
    >
      <span className="text-[10px] leading-none" aria-hidden="true">{icone}</span>
      {r.toFixed(2)}
    </span>
  );
};
