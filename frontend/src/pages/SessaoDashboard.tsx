import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import { formatData, formatSeconds } from '../lib/format';
import { heat } from '../lib/chartUtils';
import { GAUGE_MAX, ZONES } from '../lib/constants';
import { Gauge } from '../components/charts/Gauge';
import { InlineBar } from '../components/charts/InlineBar';

interface MetricaRow {
  id: number;
  nome: string;
  apelido: string | null;
  posicao: string | null;
  periodo: string;
  duracao: number | null;
  distanciaTotal: number | null;
  velocidadeMaxima: number | null;
  hsr: number | null;
  sprint: number | null;
  aceleracoes: number | null;
  desaceleracoes: number | null;
}

interface SessaoDetalhe {
  id: number;
  data: string;
  tipo: string;
  periodos: string[];
}

const n = (v: number | null) => v ?? 0;

export const SessaoDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const sessaoId = Number(id);

  const [sessao, setSessao] = useState<SessaoDetalhe | null>(null);
  const [metricas, setMetricas] = useState<MetricaRow[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('Session');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!sessaoId) return;
    setSessao(null);
    setMetricas([]);
    setLoading(true);
    setErro(null);

    fetch(`${API_BASE}/sessoes/${sessaoId}`)
      .then(r => r.ok ? r.json() : Promise.reject('Sessão não encontrada'))
      .then((s: SessaoDetalhe) => {
        setSessao(s);
        const periodoDefault = s.periodos.includes('Session') ? 'Session' : (s.periodos[0] ?? 'Session');
        setSelectedPeriod(periodoDefault);
      })
      .catch(e => setErro(String(e)))
      .finally(() => setLoading(false));
  }, [sessaoId]);

  useEffect(() => {
    if (!sessaoId || !sessao) return;
    fetch(`${API_BASE}/sessoes/${sessaoId}/metricas?periodo=${encodeURIComponent(selectedPeriod)}`)
      .then(r => r.ok ? r.json() : Promise.reject('Erro ao buscar métricas'))
      .then(setMetricas)
      .catch(e => setErro(String(e)));
  }, [sessaoId, sessao, selectedPeriod]);

  const stats = useMemo(() => {
    const count = metricas.length || 1;
    const avg = (fn: (m: MetricaRow) => number) => metricas.reduce((s, m) => s + fn(m), 0) / count;
    const top = (fn: (m: MetricaRow) => number) => metricas.reduce((mx, m) => Math.max(mx, fn(m)), 0);
    return {
      medias: {
        distanciaTotal:  avg(m => n(m.distanciaTotal)),
        hsr:             avg(m => n(m.hsr)),
        sprint:          avg(m => n(m.sprint)),
        aceleracoes:     avg(m => n(m.aceleracoes)),
        desaceleracoes:  avg(m => n(m.desaceleracoes)),
      },
      maximos: {
        distanciaTotal:   top(m => n(m.distanciaTotal)),
        velocidadeMaxima: top(m => n(m.velocidadeMaxima)),
        hsr:              top(m => n(m.hsr)),
        sprint:           top(m => n(m.sprint)),
        aceleracoes:      top(m => n(m.aceleracoes)),
        desaceleracoes:   top(m => n(m.desaceleracoes)),
      },
    };
  }, [metricas]);

  const thCls = 'px-3 py-3 text-left  text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-500';
  const thR   = 'px-3 py-3 text-right text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-500';

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Carregando sessão…</div>
  );

  if (erro) return (
    <div className="flex items-center justify-center h-64 text-red-500 text-sm">{erro}</div>
  );

  if (!sessao) return null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#111111] text-slate-800 dark:text-slate-200">

      {/* HEADER */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-white/[0.06] px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            {sessao.tipo} · <span className="text-club-red">{formatData(sessao.data)}</span>
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Paulista FC · Departamento de Fisiologia</p>
        </div>

        {/* Pills de período */}
        <div role="radiogroup" aria-label="Período" className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
          {sessao.periodos.map(p => (
            <button
              key={p}
              role="radio"
              aria-checked={selectedPeriod === p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                selectedPeriod === p
                  ? 'bg-club-red text-white accent-glow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {p === 'Session' ? 'Sessão' : p}
            </button>
          ))}
        </div>
      </header>

      <main className="p-6 space-y-6">

        {/* TABELA */}
        <div className="bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Desempenho Individual</h2>
            <span className="text-xs text-slate-400">{metricas.length} atletas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-white/[0.02]">
                <tr className="border-b border-slate-200 dark:border-white/[0.06]">
                  <th scope="col" className={thCls}>Atleta</th>
                  <th scope="col" className={thCls}>Duração</th>
                  <th scope="col" className={thCls}>Posição</th>
                  <th scope="col" className={thR}>Dist. Total (m)</th>
                  <th scope="col" className={thR}>Vel. Máx (km/h)</th>
                  <th scope="col" className={thCls}>HSR (Z4)</th>
                  <th scope="col" className={thCls}>Sprint Z5</th>
                  <th scope="col" className={thR}>Acel.</th>
                  <th scope="col" className={thR}>Desacel.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {metricas.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {a.apelido || a.nome}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-500 dark:text-slate-400 text-xs">
                      {formatSeconds(n(a.duracao))}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                      {a.posicao ?? '—'}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${heat(n(a.distanciaTotal), stats.maximos.distanciaTotal)}`}>
                      {n(a.distanciaTotal).toLocaleString('pt-BR')}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${heat(n(a.velocidadeMaxima), stats.maximos.velocidadeMaxima)}`}>
                      {n(a.velocidadeMaxima).toFixed(1).replace('.', ',')}
                    </td>
                    <td className="px-3 py-2.5">
                      <InlineBar value={n(a.hsr)}    max={stats.maximos.hsr    || 1} color={ZONES.hsr} />
                    </td>
                    <td className="px-3 py-2.5">
                      <InlineBar value={n(a.sprint)} max={stats.maximos.sprint || 1} color={ZONES.sprint} />
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${heat(n(a.aceleracoes), stats.maximos.aceleracoes)}`}>
                      {n(a.aceleracoes)}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${heat(n(a.desaceleracoes), stats.maximos.desaceleracoes)}`}>
                      {n(a.desaceleracoes)}
                    </td>
                  </tr>
                ))}
                {metricas.length === 0 && (
                  <tr><td colSpan={9} className="py-10 text-center text-sm text-slate-400">Nenhum dado para este período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* GAUGES */}
        <div className="bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-white/[0.06] p-6">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-6">Médias da Equipe</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <Gauge title="Total Dist."   value={stats.medias.distanciaTotal}  max={GAUGE_MAX.distanciaTotal} topAtleta={stats.maximos.distanciaTotal}  unit="m" />
            <Gauge title="HSR"           value={stats.medias.hsr}             max={GAUGE_MAX.hsr}            topAtleta={stats.maximos.hsr}             unit="m" />
            <Gauge title="Sprint"        value={stats.medias.sprint}          max={GAUGE_MAX.sprint}         topAtleta={stats.maximos.sprint}          unit="m" />
            <Gauge title="Aceleração"    value={stats.medias.aceleracoes}     max={150}                      topAtleta={stats.maximos.aceleracoes} />
            <Gauge title="Desaceleração" value={stats.medias.desaceleracoes}  max={150}                      topAtleta={stats.maximos.desaceleracoes} />
          </div>
        </div>

      </main>
    </div>
  );
};
