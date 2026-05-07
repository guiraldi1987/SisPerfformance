export const GAUGE_MAX = {
  distanciaTotal: 10000,
  hsr: 600,
  sprint: 300,
} as const;

export const ZONES = {
  hr: [
    { max: 65,  color: '#4caf50' },  // verde
    { max: 70,  color: '#8bc34a' },  // verde-amarelo
    { max: 75,  color: '#ff9800' },  // laranja
    { max: 100, color: '#f44336' },  // vermelho
  ],
  hsr:    '#f97316',  // laranja-500
  sprint: '#ef4444',  // vermelho-500
} as const;

export function getHrColor(pct: number): string {
  for (const zone of ZONES.hr) {
    if (pct <= zone.max) return zone.color;
  }
  return '#f44336';
}
