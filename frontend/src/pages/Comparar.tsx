import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import { formatData } from '../lib/format';
import { POSICOES, posicaoCodigo, POSICAO_COLOR, posicaoLabel } from '../lib/constants';

interface SessaoDisp { id: number; data: string; tipo: string; descricao: string | null; equipe: string | null; local: string | null; }
type FiltroPreset = 'ultimo-1' | 'ultimo-3' | 'ultimo-5' | 'todos-jogos' | 'tudo' | 'sessao';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Jogador { id: number; nome: string; apelido: string | null; posicao: string | null; }
interface Stats {
  sessoes: number; distanciaTotal: number; metragemPorMinuto: number;
  hsr: number; sprint: number; aceleracoes: number; desaceleracoes: number;
  acelDesacelTotal: number; cargaJogador: number; velocidadeMaxima: number;
}
interface Ponto { data: string; tipo: string; dist: number; mpm: number; hsr: number; sprint: number; }
interface JogadorComparacao { jogador: Jogador; geral: Stats; jogos: Stats; treinos: Stats; ultimas: Ponto[]; }
interface JogadorLista { id: number; nomeCompleto: string; apelido: string | null; posicao: string | null; }

const PLAYER_COLORS = ['#cc1e1e', '#0891b2', '#7c3aed', '#f59e0b'];
const n = (v: number | null | undefined) => v ?? 0;
const fmt = (v: number, dec = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// ─── Metric Definitions ──────────────────────────────────────────────────────

const METRICAS = [
  { key: 'distanciaTotal',    label: 'Distância Total',  unit: 'm',     dec: 0 },
  { key: 'metragemPorMinuto', label: 'm/min',            unit: 'm/min', dec: 1 },
  { key: 'hsr',               label: 'HSR (Z4)',         unit: 'm',     dec: 0 },
  { key: 'sprint',            label: 'Sprint (Z5)',      unit: 'm',     dec: 0 },
  { key: 'acelDesacelTotal',  label: 'Acel + Desac',     unit: '',      dec: 0 },
  { key: 'cargaJogador',      label: 'Player Load',      unit: '',      dec: 0 },
  { key: 'velocidadeMaxima',  label: 'Vel. Máxima',      unit: 'km/h',  dec: 1 },
] as const;

type MetricKey = typeof METRICAS[number]['key'];

// ─── Radar SVG ────────────────────────────────────────────────────────────────

const RadarOverlay: React.FC<{ jogadores: JogadorComparacao[]; tipo: 'jogos' | 'geral' }> = ({ jogadores, tipo }) => {
  const W = 420, H = 360, CX = W / 2, CY = H / 2 - 5, R = 120;
  const axes = METRICAS.slice(0, 5); // 5 eixos no radar
  const total = axes.length;

  // Max por eixo = máximo entre todos os jogadores
  const maxPorEixo = axes.map(m => Math.max(...jogadores.map(j => n((j[tipo] as any)[m.key])), 1));

  const point = (i: number, ratio: number): [number, number] => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / total;
    const r = R * Math.min(ratio, 1.2);
    return [CX + Math.cos(angle) * r, CY + Math.sin(angle) * r];
  };

  const RINGS = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ minHeight: 240 }}>
      {/* Rings */}
      {RINGS.map(ratio => {
        const pts = Array.from({ length: total }, (_, i) => point(i, ratio));
        return <polygon key={ratio} points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none" stroke="currentColor" strokeOpacity={ratio === 1 ? 0.2 : 0.07} strokeWidth={ratio === 1 ? 1 : 0.7} />;
      })}
      {/* Axes */}
      {axes.map((_, i) => {
        const [ex, ey] = point(i, 1.15);
        return <line key={i} x1={CX} y1={CY} x2={ex} y2={ey} stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.7} />;
      })}
      {/* Polygons per player */}
      {jogadores.map((j, ji) => {
        const color = PLAYER_COLORS[ji % PLAYER_COLORS.length];
        const pts = axes.map((m, i) => {
          const val = n((j[tipo] as any)[m.key]);
          return point(i, val / maxPorEixo[i]!);
        });
        const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
        return (
          <g key={j.jogador.id}>
            <path d={d} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
            {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill={color} stroke="#fff" strokeWidth={0.8} />)}
          </g>
        );
      })}
      {/* Labels */}
      {axes.map((a, i) => {
        const [x, y] = point(i, 1.32);
        const anchor = x > CX + 5 ? 'start' : x < CX - 5 ? 'end' : 'middle';
        const dy = Math.abs((-Math.PI / 2 + (i * 2 * Math.PI) / total) + Math.PI / 2) < 0.1 ? -2
                 : Math.abs((-Math.PI / 2 + (i * 2 * Math.PI) / total) - Math.PI / 2) < 0.1 ? 10 : 4;
        return <text key={a.key} x={x} y={y + dy} fontSize="9.5" textAnchor={anchor}
          className="fill-slate-600 dark:fill-slate-300 font-bold">{a.label}</text>;
      })}
      <circle cx={CX} cy={CY} r={1.5} fill="currentColor" className="text-slate-400" />
    </svg>
  );
};

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

const Sparkline: React.FC<{ pontos: number[]; color: string; w?: number; h?: number }> = ({ pontos, color, w = 100, h = 28 }) => {
  if (pontos.length < 2) return <span className="text-[10px] text-slate-400">—</span>;
  const max = Math.max(...pontos, 1);
  const min = Math.min(...pontos, 0);
  const range = max - min || 1;
  const pts = pontos.map((v, i) => `${(i / (pontos.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Bar Row ──────────────────────────────────────────────────────────────────

const MetricBar: React.FC<{ jogadores: JogadorComparacao[]; metricKey: MetricKey; label: string; unit: string; dec: number; tipo: 'jogos' | 'geral' }> = ({ jogadores, metricKey, label, unit, dec, tipo }) => {
  const values = jogadores.map(j => n((j[tipo] as any)[metricKey]));
  const maxVal = Math.max(...values, 1);
  const bestIdx = values.indexOf(Math.max(...values));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{label}</span>
        <span className="text-[10px] text-slate-400">{unit}</span>
      </div>
      {jogadores.map((j, ji) => {
        const val = values[ji]!;
        const pct = (val / maxVal) * 100;
        const color = PLAYER_COLORS[ji % PLAYER_COLORS.length]!;
        const nome = j.jogador.apelido || j.jogador.nome.split(',')[0] || j.jogador.nome;
        return (
          <div key={j.jogador.id} className="flex items-center gap-2">
            <span className="text-[10px] w-16 truncate text-slate-500 dark:text-slate-400 shrink-0">{nome}</span>
            <div className="flex-1 h-5 bg-slate-100 dark:bg-white/[0.04] rounded-sm overflow-hidden relative">
              <div className="h-full rounded-sm transition-all duration-500"
                style={{ width: `${Math.max(pct, 3)}%`, background: color, opacity: 0.75 }} />
            </div>
            <span className={`text-[11px] tabular-nums font-semibold w-14 text-right shrink-0 ${ji === bestIdx ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
              {fmt(val, dec)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export const Comparar: React.FC = () => {
  const navigate = useNavigate();
  const [elenco, setElenco] = useState<JogadorLista[]>([]);
  const [filtroPosicao, setFiltroPosicao] = useState('');
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [dados, setDados] = useState<JogadorComparacao[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<'jogos' | 'geral'>('jogos');
  const [filtroPreset, setFiltroPreset] = useState<FiltroPreset>('todos-jogos');
  const [sessaoEscolhida, setSessaoEscolhida] = useState<number | null>(null);
  const [sessoesDisp, setSessoesDisp] = useState<SessaoDisp[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/jogadores`).then(r => r.json()).then(setElenco);
    // Pré-carrega lista de sessões para popular o dropdown desde o início,
    // sem depender de uma comparação ter sido feita antes.
    fetch(`${API_BASE}/sessoes`)
      .then(r => r.ok ? r.json() : [])
      .then((arr: SessaoDisp[]) => setSessoesDisp(arr))
      .catch(() => { /* dropdown fica vazio se API offline */ });
  }, []);

  const jogadoresFiltrados = useMemo(() => {
    if (!filtroPosicao) return elenco;
    return elenco.filter(j => j.posicao === filtroPosicao);
  }, [elenco, filtroPosicao]);

  const toggleJogador = (id: number) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev);
  };

  const comparar = async () => {
    if (selecionados.length < 2) return;
    setLoading(true);
    try {
      let url = `${API_BASE}/analytics/comparar?ids=${selecionados.join(',')}`;
      if (filtroPreset === 'sessao' && sessaoEscolhida) {
        url += `&sessaoId=${sessaoEscolhida}`;
      } else if (filtroPreset === 'ultimo-1') {
        url += '&ultimos=1';
      } else if (filtroPreset === 'ultimo-3') {
        url += '&ultimos=3';
      } else if (filtroPreset === 'ultimo-5') {
        url += '&ultimos=5';
      }
      // 'todos-jogos' e 'tudo' não passam params extras (filtro no frontend via tipo)
      const r = await fetch(url);
      const d = await r.json();
      setDados(d.jogadores);
      if (d.sessoes) setSessoesDisp(d.sessoes);
    } finally { setLoading(false); }
  };

  // Re-fetch quando muda o filtro (se já tem dados)
  useEffect(() => {
    if (dados && selecionados.length >= 2) comparar();
  }, [filtroPreset, sessaoEscolhida]);

  // Posições com jogadores cadastrados
  const posicoesDisp = useMemo(() => {
    const set = new Set(elenco.map(j => j.posicao).filter(Boolean));
    return POSICOES.filter(p => set.has(p));
  }, [elenco]);

  const cardCls = 'bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-white/[0.06] p-6';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#111111]">
      {/* HEADER */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-white/[0.06] px-8 py-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Análise Comparativa</p>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Comparar Jogadores</h1>
          <p className="text-[11px] text-slate-400 mt-1">Selecione 2 a 4 jogadores para comparação lado a lado de métricas</p>
        </div>
        <button onClick={() => window.print()}
          title="Imprimir ou salvar como PDF"
          className="print-hide flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition-colors shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
          </svg>
          Imprimir
        </button>
      </header>

      <main className="p-6 space-y-6">
        {/* SELEÇÃO */}
        <div className={`${cardCls} print-hide`}>
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Selecionar Jogadores</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Filtre por posição para comparar atletas da mesma função</p>
            </div>
            <div className="flex items-center gap-3">
              <select value={filtroPosicao} onChange={e => { setFiltroPosicao(e.target.value); setSelecionados([]); setDados(null); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11161d] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-club-red">
                <option value="">Todas as posições</option>
                {posicoesDisp.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Grid de jogadores */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {jogadoresFiltrados.map(j => {
              const sel = selecionados.includes(j.id);
              const idx = selecionados.indexOf(j.id);
              const color = sel ? PLAYER_COLORS[idx % PLAYER_COLORS.length] : undefined;
              const cod = posicaoCodigo(j.posicao);
              const corPos = POSICAO_COLOR[cod] ?? '#64748b';
              return (
                <button key={j.id} onClick={() => toggleJogador(j.id)}
                  className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left ${
                    sel
                      ? 'border-2 bg-white dark:bg-white/5'
                      : 'border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                  style={sel ? { borderColor: color } : undefined}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
                    style={{ background: sel ? color + '20' : corPos + '15', color: sel ? color : corPos }}>
                    {(j.apelido || j.nomeCompleto).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${sel ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                      {j.apelido || j.nomeCompleto.split(',')[0]}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{posicaoLabel(j.posicao)}</p>
                  </div>
                  {sel && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                      style={{ background: color }}>
                      {idx + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
            <span className="text-[11px] text-slate-400">
              <b className="text-slate-700 dark:text-slate-300">{selecionados.length}</b> de 4 selecionados
            </span>
            <div className="flex gap-2">
              {selecionados.length > 0 && (
                <button onClick={() => { setSelecionados([]); setDados(null); }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                  Limpar
                </button>
              )}
              <button onClick={comparar} disabled={selecionados.length < 2 || loading}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-club-red text-white hover:opacity-90 transition-opacity disabled:opacity-40 accent-glow">
                {loading ? 'Carregando…' : 'Comparar'}
              </button>
            </div>
          </div>
        </div>

        {/* RESULTADOS */}
        {dados && dados.length >= 2 && (
          <>
            {/* ── Filtro Inteligente ─────────────────────────────────── */}
            <div className={cardCls + ' !py-4 print-hide'}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {/* Chips rápidos */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">Base</span>
                  <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-lg flex-wrap">
                    {([
                      ['ultimo-1', 'Último Jogo'],
                      ['ultimo-3', 'Últ. 3 Jogos'],
                      ['ultimo-5', 'Últ. 5 Jogos'],
                      ['todos-jogos', 'Todos os Jogos'],
                      ['tudo', 'Todas Sessões'],
                    ] as [FiltroPreset, string][]).map(([k, l]) => (
                      <button key={k} onClick={() => { setFiltroPreset(k); setSessaoEscolhida(null); setTipo(k === 'tudo' ? 'geral' : 'jogos'); }}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                          filtroPreset === k ? 'bg-club-red text-white accent-glow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                        }`}>{l}</button>
                    ))}
                  </div>
                </div>

                {/* Dropdown sessão específica */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">Ou sessão</span>
                  <select
                    value={filtroPreset === 'sessao' ? String(sessaoEscolhida ?? '') : ''}
                    onChange={e => {
                      const v = Number(e.target.value);
                      if (v > 0) { setFiltroPreset('sessao'); setSessaoEscolhida(v); setTipo('geral'); }
                      else { setFiltroPreset('todos-jogos'); setSessaoEscolhida(null); setTipo('jogos'); }
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11161d] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-club-red max-w-[280px]"
                  >
                    <option value="">— Selecionar jogo —</option>
                    {sessoesDisp.filter(s => s.tipo === 'Jogo').map(s => (
                      <option key={s.id} value={s.id}>
                        {formatData(s.data)} — {s.descricao || 'Jogo'}{s.local ? ` (${s.local})` : ''}
                      </option>
                    ))}
                    <optgroup label="Treinos">
                      {sessoesDisp.filter(s => s.tipo === 'Treino').map(s => (
                        <option key={s.id} value={s.id}>
                          {formatData(s.data)} — {s.descricao || 'Treino'}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Info do filtro ativo */}
                <span className="text-[10px] text-slate-400 ml-auto">
                  {filtroPreset === 'sessao' && sessaoEscolhida
                    ? `Sessão #${sessaoEscolhida}`
                    : filtroPreset === 'ultimo-1' ? 'Dados do último jogo de cada atleta'
                    : filtroPreset === 'ultimo-3' ? 'Média dos últimos 3 jogos'
                    : filtroPreset === 'ultimo-5' ? 'Média dos últimos 5 jogos'
                    : filtroPreset === 'tudo' ? 'Média de todas as sessões (jogos + treinos)'
                    : 'Média de todos os jogos registrados'}
                </span>
              </div>
            </div>

            {/* Legenda dos jogadores */}
            <div className="flex flex-wrap gap-3">
              {dados.map((j, ji) => {
                const color = PLAYER_COLORS[ji % PLAYER_COLORS.length]!;
                const nome = j.jogador.apelido || j.jogador.nome.split(',')[0] || j.jogador.nome;
                return (
                  <button key={j.jogador.id} onClick={() => navigate(`/jogador/${j.jogador.id}`)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 transition-colors">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{nome}</span>
                    <span className="text-[10px] text-slate-400">{posicaoLabel(j.jogador.posicao)} · {(j[tipo] as Stats).sessoes}s</span>
                  </button>
                );
              })}
            </div>

            {/* Radar + Barras */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Radar (2/5) */}
              <div className={`lg:col-span-2 ${cardCls}`}>
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Radar Comparativo</h2>
                <p className="text-[11px] text-slate-400 mb-3">5 métricas sobrepostas — borda externa = melhor entre selecionados</p>
                <RadarOverlay jogadores={dados} tipo={tipo} />
              </div>

              {/* Barras (3/5) */}
              <div className={`lg:col-span-3 ${cardCls}`}>
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Métricas Detalhadas</h2>
                <p className="text-[11px] text-slate-400 mb-4">Barras comparativas — <span className="text-emerald-500 font-bold">verde</span> = melhor no grupo</p>
                <div className="space-y-4">
                  {METRICAS.map(m => (
                    <MetricBar key={m.key} jogadores={dados} metricKey={m.key} label={m.label} unit={m.unit} dec={m.dec} tipo={tipo} />
                  ))}
                </div>
              </div>
            </div>

            {/* Sparklines */}
            <div className={cardCls}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Evolução Recente</h2>
              <p className="text-[11px] text-slate-400 mb-4">Últimas 10 sessões — tendência de cada métrica</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      <th className="text-left px-3 py-2">Jogador</th>
                      <th className="text-center px-3 py-2">Distância</th>
                      <th className="text-center px-3 py-2">m/min</th>
                      <th className="text-center px-3 py-2">HSR</th>
                      <th className="text-center px-3 py-2">Sprint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {dados.map((j, ji) => {
                      const color = PLAYER_COLORS[ji % PLAYER_COLORS.length]!;
                      const nome = j.jogador.apelido || j.jogador.nome.split(',')[0] || j.jogador.nome;
                      return (
                        <tr key={j.jogador.id}>
                          <td className="px-3 py-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{nome}</span>
                          </td>
                          <td className="px-3 py-3 text-center"><Sparkline pontos={j.ultimas.map(p => p.dist)} color={color} /></td>
                          <td className="px-3 py-3 text-center"><Sparkline pontos={j.ultimas.map(p => p.mpm)} color={color} /></td>
                          <td className="px-3 py-3 text-center"><Sparkline pontos={j.ultimas.map(p => p.hsr)} color={color} /></td>
                          <td className="px-3 py-3 text-center"><Sparkline pontos={j.ultimas.map(p => p.sprint)} color={color} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabela ranking */}
            <div className={cardCls}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Ranking por Métrica</h2>
              <p className="text-[11px] text-slate-400 mb-4">🥇 = melhor no grupo em cada métrica</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]">
                      <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Jogador</th>
                      {METRICAS.map(m => (
                        <th key={m.key} className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{m.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {dados.map((j, ji) => {
                      const color = PLAYER_COLORS[ji % PLAYER_COLORS.length]!;
                      const nome = j.jogador.apelido || j.jogador.nome.split(',')[0] || j.jogador.nome;
                      return (
                        <tr key={j.jogador.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                          <td className="px-3 py-2.5 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{nome}</span>
                          </td>
                          {METRICAS.map(m => {
                            const val = n((j[tipo] as any)[m.key]);
                            const allVals = dados.map(d => n((d[tipo] as any)[m.key]));
                            const isBest = val === Math.max(...allVals) && val > 0;
                            return (
                              <td key={m.key} className={`px-3 py-2.5 text-right tabular-nums text-xs ${
                                isBest ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-600 dark:text-slate-300'
                              }`}>
                                {isBest && '🥇 '}{fmt(val, m.dec)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
