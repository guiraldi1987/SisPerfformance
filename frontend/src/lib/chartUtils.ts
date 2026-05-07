export const heat = (v: number, max: number): string => {
  if (max <= 0 || v <= 0) return '';
  const r = v / max;
  if (r >= 0.9)  return 'bg-red-100 dark:bg-red-900/30 font-semibold';
  if (r >= 0.75) return 'bg-red-50  dark:bg-red-900/20';
  if (r >= 0.5)  return 'bg-slate-50 dark:bg-white/[0.04]';
  return '';
};

/**
 * Retorna a cor do arco do gauge na posição `ratio` (0–1).
 * Verde → Laranja → Vermelho, conforme o relatório de referência.
 */
export function gaugeZoneColor(ratio: number): string {
  if (ratio <= 0.4) return '#4caf50';
  if (ratio <= 0.7) return '#ff9800';
  return '#f44336';
}
