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

// ─── Paleta canônica por métrica (badges, gráficos, legendas) ────────────────
export const M_COLOR = {
  dist:   '#0d9488', // teal — volume
  mpm:    '#1e3a5f', // navy — intensidade
  hsr:    '#f59e0b', // orange — Z4
  hsrE:   '#f59e0b',
  sprint: '#ef4444', // red — Z5
  sprE:   '#ef4444',
  acel:   '#0891b2', // cyan
  desac:  '#a855f7', // purple
  acelD:  '#64748b', // slate
  carga:  '#7c3aed', // Player Load
  cMin:   '#a855f7', // PL/min
} as const;

export function getHrColor(pct: number): string {
  for (const zone of ZONES.hr) {
    if (pct <= zone.max) return zone.color;
  }
  return '#f44336';
}

// ─── Posições (numeração tática) ──────────────────────────────────────────────
// Goleiro fora da numeração (GOL); 1-7 para zonas táticas de campo
export const POSICOES = [
  'GOL - Goleiro',
  '1 - Lateral Direito',
  '2 - Lateral Esquerdo',
  '3 - Zagueiro',
  '4 - Volante',
  '5 - Meia',
  '6 - Extremo',
  '7 - Atacante',
] as const;

// Extrai apenas o código (ex: "3 - Zagueiro" → "3")
export const posicaoCodigo = (p: string | null): string =>
  p?.split(' - ')[0]?.trim() ?? '—';

// Cores por código de posição (para badges e gráficos)
export const POSICAO_COLOR: Record<string, string> = {
  GOL: '#64748b', // slate
  '1': '#0891b2', // cyan
  '2': '#0891b2',
  '3': '#dc2626', // red — defesa
  '4': '#7c3aed', // purple — meio defensivo
  '5': '#7c3aed',
  '6': '#0d9488', // teal — flanco ofensivo
  '7': '#f59e0b', // amber — ataque
};

// Sigla curta de cada posição (estilo Catapult: ATA, GK, ZAG, VOL, MC, LAT)
export const POSICAO_SIGLA: Record<string, string> = {
  GOL: 'GK',
  '1': 'LAT',
  '2': 'LAT',
  '3': 'ZAG',
  '4': 'VOL',
  '5': 'MC',
  '6': 'EXT',
  '7': 'ATA',
};

// Formata posição como "número - sigla" (ex: "7 - ATA"); goleiro = "GK"
export const posicaoLabel = (p: string | null): string => {
  if (!p) return '—';
  const codigo = posicaoCodigo(p);
  const sigla = POSICAO_SIGLA[codigo];
  if (!sigla) return p;
  return codigo === 'GOL' ? sigla : `${codigo} - ${sigla}`;
};
