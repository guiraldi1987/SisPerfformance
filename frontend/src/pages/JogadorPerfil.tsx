import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import { formatData } from '../lib/format';

interface Jogador {
  id: number;
  nomeCompleto: string;
  apelido: string | null;
  posicao: string | null;
  codigoCsv: string;
  fotoUrl: string | null;
}

interface PeriodoMetrica {
  metricaId: number;
  periodo: string;
  duracao: number | null;
  distanciaTotal: number | null;
  velocidadeMaxima: number | null;
  hsr: number | null;
  sprint: number | null;
  aceleracoes: number | null;
  desaceleracoes: number | null;
  sessaoId: number;
  sessaoData: string;
  sessaoTipo: string;
  sessaoDescricao: string | null;
}

interface SessaoPerf {
  id: number;
  data: string;
  tipo: string;
  descricao: string | null;
  periodos: Record<string, PeriodoMetrica>;
}

interface PerformanceResponse {
  jogador: Jogador;
  sessoes: SessaoPerf[];
}

const n = (v: number | null | undefined) => v ?? 0;

const PERIODOS_ORDER = ['Session', 'Aquecimento', '1º Tempo', '2º Tempo', 'Complemento'];

const StatCard: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 flex flex-col gap-1">
    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</span>
    <span className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">{value}</span>
    {sub && <span className="text-[11px] text-slate-400 dark:text-slate-500">{sub}</span>}
  </div>
);

const heat = (v: number, max: number) => {
  if (max <= 0 || v <= 0) return '';
  const r = v / max;
  if (r >= 0.9)  return 'bg-red-100 dark:bg-red-900/30 font-semibold';
  if (r >= 0.75) return 'bg-red-50 dark:bg-red-900/20';
  if (r >= 0.5)  return 'bg-slate-50 dark:bg-white/[0.04]';
  return '';
};

const TrendDot: React.FC<{ values: number[] }> = ({ values }) => {
  if (values.length < 2) return null;
  const last = values[values.length - 1]!;
  const prev = values[values.length - 2]!;
  const diff = last - prev;
  if (Math.abs(diff) < 0.01) return <span className="text-slate-400 text-xs">—</span>;
  return diff > 0
    ? <span className="text-emerald-500 text-xs font-bold">▲</span>
    : <span className="text-red-500 text-xs font-bold">▼</span>;
};

export const JogadorPerfil: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const jogadorId = Number(id);

  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<'Todos' | 'Treino' | 'Jogo'>('Todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('Session');

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ apelido: '', posicao: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!jogadorId) return;
    setLoading(true);
    const qs = filtroTipo !== 'Todos' ? `?tipo=${filtroTipo}` : '';
    fetch(`${API_BASE}/jogadores/${jogadorId}/performance${qs}`)
      .then(r => r.ok ? r.json() : Promise.reject('Jogador não encontrado'))
      .then((d: PerformanceResponse) => {
        setData(d);
        setEditForm({ apelido: d.jogador.apelido ?? '', posicao: d.jogador.posicao ?? '' });
        setErro(null);
      })
      .catch(e => setErro(String(e)))
      .finally(() => setLoading(false));
  }, [jogadorId, filtroTipo]);

  const sessoesComPeriodo = useMemo(() => {
    if (!data) return [];
    return data.sessoes
      .map(s => {
        const m = s.periodos[filtroPeriodo] ?? s.periodos['Session'];
        return m ? { sessao: s, m } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [data, filtroPeriodo]);

  const periodosDispo = useMemo(() => {
    if (!data) return ['Session'];
    const set = new Set<string>();
    data.sessoes.forEach(s => Object.keys(s.periodos).forEach(p => set.add(p)));
    return PERIODOS_ORDER.filter(p => set.has(p)).concat(
      [...set].filter(p => !PERIODOS_ORDER.includes(p))
    );
  }, [data]);

  const stats = useMemo(() => {
    if (!sessoesComPeriodo.length) return null;
    const vals = (fn: (m: PeriodoMetrica) => number) => sessoesComPeriodo.map(x => fn(x.m));
    const avg = (fn: (m: PeriodoMetrica) => number) => {
      const vs = vals(fn);
      return vs.reduce((a, b) => a + b, 0) / vs.length;
    };
    const max = (fn: (m: PeriodoMetrica) => number) => Math.max(...vals(fn));
    return {
      avgDist:  avg(m => n(m.distanciaTotal)),
      maxVel:   max(m => n(m.velocidadeMaxima)),
      avgHsr:   avg(m => n(m.hsr)),
      avgSprint: avg(m => n(m.sprint)),
      totalSessoes: sessoesComPeriodo.length,
      distTrend: vals(m => n(m.distanciaTotal)).slice(-5),
      maxDist:  max(m => n(m.distanciaTotal)),
      maxHsr:   max(m => n(m.hsr)),
      maxSprint: max(m => n(m.sprint)),
      maxAcel:  max(m => n(m.aceleracoes)),
      maxDesac: max(m => n(m.desaceleracoes)),
    };
  }, [sessoesComPeriodo]);

  const salvarEdicao = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/jogadores/${jogadorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const j = await res.json() as Jogador;
        setData(prev => prev ? { ...prev, jogador: j } : prev);
        setEditOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const thCls = 'px-3 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-500';
  const thR   = 'px-3 py-3 text-right text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-500';

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Carregando…</div>
  );
  if (erro) return (
    <div className="flex items-center justify-center h-64 text-red-500 text-sm">{erro}</div>
  );
  if (!data) return null;

  const { jogador } = data;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#111111]">

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Editar Jogador</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Apelido</label>
                <input
                  className="w-full border border-slate-300 dark:border-white/10 bg-white dark:bg-[#11161d] dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-club-red"
                  value={editForm.apelido}
                  onChange={e => setEditForm(f => ({ ...f, apelido: e.target.value }))}
                  placeholder="Como é chamado"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Posição</label>
                <select
                  className="w-full border border-slate-300 dark:border-white/10 bg-white dark:bg-[#11161d] dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-club-red"
                  value={editForm.posicao}
                  onChange={e => setEditForm(f => ({ ...f, posicao: e.target.value }))}
                >
                  <option value="">— Selecionar —</option>
                  <option>Goleiro</option>
                  <option>Lateral Direito</option>
                  <option>Lateral Esquerdo</option>
                  <option>Zagueiro</option>
                  <option>Volante</option>
                  <option>Meia Defensivo</option>
                  <option>Meia</option>
                  <option>Meia Ofensivo</option>
                  <option>Ponta Direita</option>
                  <option>Ponta Esquerda</option>
                  <option>Centroavante</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setEditOpen(false)}
                className="flex-1 border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEdicao}
                disabled={saving}
                className="flex-1 bg-club-red text-white font-bold rounded-lg px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 accent-glow"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-white/[0.06] px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-xl font-extrabold text-slate-500 dark:text-slate-300 shrink-0">
              {(jogador.apelido || jogador.nomeCompleto).charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                {jogador.apelido || jogador.nomeCompleto}
              </h1>
              {jogador.apelido && (
                <p className="text-xs text-slate-400 mt-0.5">{jogador.nomeCompleto}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {jogador.posicao ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-club-red/10 text-club-red border border-club-red/20">
                    {jogador.posicao}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10">
                    Sem posição
                  </span>
                )}
                <span className="text-[10px] text-slate-400 font-mono">{jogador.codigoCsv}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/jogadores')}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              ← Voltar
            </button>
            <button
              onClick={() => setEditOpen(true)}
              className="bg-club-red text-white text-xs font-bold px-4 py-2 rounded-lg hover:opacity-90 accent-glow"
            >
              Editar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
          <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
            {(['Todos', 'Treino', 'Jogo'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  filtroTipo === t
                    ? 'bg-club-red text-white accent-glow'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
            {periodosDispo.map(p => (
              <button
                key={p}
                onClick={() => setFiltroPeriodo(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  filtroPeriodo === p
                    ? 'bg-slate-800 dark:bg-white/20 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {p === 'Session' ? 'Sessão' : p}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">

        {/* STAT CARDS */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              label="Sessões"
              value={String(stats.totalSessoes)}
              sub={filtroTipo !== 'Todos' ? filtroTipo : 'Total'}
            />
            <StatCard
              label="Dist. Média"
              value={stats.avgDist.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              sub="metros / sessão"
            />
            <StatCard
              label="Vel. Máx Top"
              value={`${stats.maxVel.toFixed(1).replace('.', ',')} km/h`}
              sub="melhor registrado"
            />
            <StatCard
              label="HSR Médio"
              value={stats.avgHsr.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              sub="metros Z4 / sessão"
            />
            <StatCard
              label="Sprint Médio"
              value={stats.avgSprint.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              sub="metros Z5 / sessão"
            />
          </div>
        )}

        {/* TABELA DE SESSÕES */}
        <div className="bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Histórico de Sessões</h2>
            <span className="text-xs text-slate-400">{sessoesComPeriodo.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-white/[0.02]">
                <tr className="border-b border-slate-200 dark:border-white/[0.06]">
                  <th className={thCls}>Data</th>
                  <th className={thCls}>Tipo</th>
                  <th className={thCls}>Período</th>
                  <th className={thR}>Dist. Total (m)</th>
                  <th className={thR}>Vel. Máx (km/h)</th>
                  <th className={thR}>HSR Z4 (m)</th>
                  <th className={thR}>Sprint Z5 (m)</th>
                  <th className={thR}>Acel.</th>
                  <th className={thR}>Desacel.</th>
                  <th className={thR}>Tendência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {sessoesComPeriodo.map(({ sessao, m }, idx) => {
                  const distTrend = sessoesComPeriodo.slice(0, idx + 1).map(x => n(x.m.distanciaTotal));
                  return (
                    <tr
                      key={`${sessao.id}-${m.periodo}`}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => navigate(`/sessao/${sessao.id}`)}
                    >
                      <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatData(sessao.data)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sessao.tipo === 'Jogo'
                            ? 'bg-club-red/10 text-club-red border border-club-red/20'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-500 border border-slate-200 dark:border-white/10'
                        }`}>
                          {sessao.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">
                        {m.periodo === 'Session' ? 'Sessão' : m.periodo}
                      </td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${heat(n(m.distanciaTotal), stats?.maxDist ?? 1)}`}>
                        {n(m.distanciaTotal).toLocaleString('pt-BR')}
                      </td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${heat(n(m.velocidadeMaxima), stats?.maxVel ?? 1)}`}>
                        {n(m.velocidadeMaxima).toFixed(1).replace('.', ',')}
                      </td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${heat(n(m.hsr), stats?.maxHsr ?? 1)}`}>
                        {n(m.hsr).toLocaleString('pt-BR')}
                      </td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${heat(n(m.sprint), stats?.maxSprint ?? 1)}`}>
                        {n(m.sprint).toLocaleString('pt-BR')}
                      </td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${heat(n(m.aceleracoes), stats?.maxAcel ?? 1)}`}>
                        {n(m.aceleracoes)}
                      </td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${heat(n(m.desaceleracoes), stats?.maxDesac ?? 1)}`}>
                        {n(m.desaceleracoes)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <TrendDot values={distTrend} />
                      </td>
                    </tr>
                  );
                })}
                {sessoesComPeriodo.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-sm text-slate-400">
                      Nenhum dado encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
