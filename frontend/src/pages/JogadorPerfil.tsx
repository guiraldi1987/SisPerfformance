import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import { formatData } from '../lib/format';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { Gauge } from '../components/charts/Gauge';
import { AcwrChart, type AcwrPoint } from '../components/charts/AcwrChart';
import { TrendChart, type TrendPoint } from '../components/charts/TrendChart';
import { MatchTrainingCompare, type CompareData } from '../components/charts/MatchTrainingCompare';
import { MicrocicloChart, type MicrocicloPonto } from '../components/charts/MicrocicloChart';
import { RadarComparativo, type RadarAxis } from '../components/charts/RadarComparativo';
import { POSICOES, posicaoCodigo, POSICAO_COLOR, M_COLOR } from '../lib/constants';
import { buildInsights } from '../lib/insights';
import { RatioCell, computeECRatio } from '../components/RatioCell';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Jogador {
  id: number; nomeCompleto: string; apelido: string | null;
  posicao: string | null; codigoCsv: string; fotoUrl: string | null;
}

interface PeriodoMetrica {
  metricaId: number;
  periodo: string;
  duracao: number | null;
  distanciaTotal: number | null;
  velocidadeMaxima: number | null;
  hsr: number | null;
  hsrEsforcos: number | null;
  sprint: number | null;
  sprintEsforcos: number | null;
  aceleracoes: number | null;
  desaceleracoes: number | null;
  acelDesacelTotal: number | null;
  cargaJogador: number | null;
  cargaPorMinuto: number | null;
  sessaoId: number;
  sessaoData: string;
  sessaoTipo: string;
  sessaoDescricao: string | null;
}

interface SessaoPerf {
  id: number; data: string; tipo: string;
  descricao: string | null;
  periodos: Record<string, PeriodoMetrica>;
}

interface PerformanceResponse {
  jogador: Jogador;
  sessoes: SessaoPerf[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n = (v: number | null | undefined) => v ?? 0;

const fmtSec = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const fmtNum = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// Mini-barra de intensidade ao lado do número (estilo PDF) - responsiva e fluida
const BarCell: React.FC<{
  value: number; max: number; color: string; dec?: number;
}> = ({ value, max, color, dec = 0 }) => {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const showBar = value > 0 && max > 0;
  return (
    <div className="flex items-center justify-end gap-1">
      <span className="font-mono text-[10.5px] xl:text-[11.5px] tabular-nums text-slate-700 dark:text-slate-200 font-semibold transition-colors duration-200">
        {value.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })}
      </span>
      <div className="hidden sm:block w-3 md:w-5 lg:w-7 h-1.5 bg-slate-100/80 dark:bg-white/[0.04] rounded-sm overflow-hidden shrink-0 border border-slate-200/50 dark:border-white/[0.04] relative">
        {showBar && (
          <div 
            className="h-full rounded-sm transition-all duration-500 ease-out" 
            style={{ 
              width: `${Math.max(ratio * 100, 6)}%`, 
              backgroundColor: color
            }} 
          />
        )}
      </div>
    </div>
  );
};

// `RatioCell` + `computeECRatio` movidos para components/RatioCell.tsx
// para reuso no SessaoDashboard (aba Análise do Atleta).

const PERIODOS_ORDER = ['Session', 'Aquecimento', '1º Tempo', '2º Tempo', 'Complemento'];

// ─── Main ─────────────────────────────────────────────────────────────────────

export const JogadorPerfil: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const jogadorId = Number(id);

  const [data, setData]       = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo]       = useState<'Todos' | 'Treino' | 'Jogo'>('Todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('Session');
  // Filtro por sessão específica (null = todas as sessões filtradas por tipo/período)
  const [filtroSessaoId, setFiltroSessaoId] = useState<number | null>(null);

  // ACWR data
  const [acwrData, setAcwrData] = useState<{
    serie: AcwrPoint[];
    acwrAtual: number | null;
    zona: 'risco' | 'atencao' | 'ideal' | 'baixa' | 'sem-dados';
  } | null>(null);

  // Microciclo data — independente dos filtros do usuário
  const [microcicloData, setMicrocicloData] = useState<{
    distribuicao: MicrocicloPonto[];
    totalJogos: number;
    totalSessoes: number;
  } | null>(null);

  // Benchmarks por posição (avg + top p95) — usado pelo radar
  interface PosBenchmark {
    posicao: string;
    amostras: number;
    distanciaTotal: number;
    metragemPorMinuto: number;
    hsr: number;
    sprint: number;
    acelDesacelTotal: number;
    cargaJogador: number;
    top: {
      distanciaTotal: number;
      metragemPorMinuto: number;
      hsr: number;
      sprint: number;
      acelDesacelTotal: number;
      cargaJogador: number;
    };
  }
  const [posBench, setPosBench] = useState<Record<string, PosBenchmark> | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ apelido: '', posicao: '' });
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!jogadorId) return;
    setLoading(true);
    // Sempre busca todas as sessões — filtro por tipo é aplicado no frontend
    // para que widgets de comparação Jogo×Treino e Insights tenham acesso a ambos.
    fetch(`${API_BASE}/jogadores/${jogadorId}/performance`)
      .then(r => r.ok ? r.json() : Promise.reject('Jogador não encontrado'))
      .then((d: PerformanceResponse) => {
        setData(d);
        setEditForm({ apelido: d.jogador.apelido ?? '', posicao: d.jogador.posicao ?? '' });
        setErro(null);
      })
      .catch(e => setErro(String(e)))
      .finally(() => setLoading(false));
  }, [jogadorId]);

  // Carrega série ACWR (independente do filtro tipo, usa todas as sessões)
  useEffect(() => {
    if (!jogadorId) return;
    fetch(`${API_BASE}/analytics/jogadores/${jogadorId}/acwr`)
      .then(r => r.ok ? r.json() : Promise.reject(null))
      .then(setAcwrData)
      .catch(() => setAcwrData(null));
  }, [jogadorId]);

  // Carrega distribuição microciclo MD±N (também ignora filtros)
  useEffect(() => {
    if (!jogadorId) return;
    fetch(`${API_BASE}/analytics/jogadores/${jogadorId}/microciclo`)
      .then(r => r.ok ? r.json() : Promise.reject(null))
      .then(setMicrocicloData)
      .catch(() => setMicrocicloData(null));
  }, [jogadorId]);

  // Benchmarks por posição (uma única vez ao montar)
  useEffect(() => {
    fetch(`${API_BASE}/analytics/posicoes-benchmarks`)
      .then(r => r.ok ? r.json() : Promise.reject(null))
      .then((d: { benchmarks: PosBenchmark[] }) => {
        const map: Record<string, PosBenchmark> = {};
        for (const b of d.benchmarks) map[b.posicao] = b;
        setPosBench(map);
      })
      .catch(() => setPosBench(null));
  }, []);

  // Sessões filtradas APENAS por período (todos os tipos) — usado pelos widgets
  // de comparação Jogo×Treino e Insights, que precisam dos dois lados.
  const sessoesPorPeriodo = useMemo(() => {
    if (!data) return [];
    return data.sessoes
      .map(s => {
        const m = s.periodos[filtroPeriodo] ?? s.periodos['Session'];
        return m ? { sessao: s, m } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [data, filtroPeriodo]);

  // Sessões filtradas por período + tipo + (opcional) uma sessão específica.
  // Usado por tabela, trend e gauges. Quando `filtroSessaoId` é diferente de
  // null, todos os widgets que dependem deste derivado mostram um snapshot
  // único — útil para inspecionar performance numa sessão específica.
  const sessoesComPeriodo = useMemo(() => {
    let out = sessoesPorPeriodo;
    if (filtroTipo !== 'Todos') out = out.filter(({ sessao }) => sessao.tipo === filtroTipo);
    if (filtroSessaoId != null) out = out.filter(({ sessao }) => sessao.id === filtroSessaoId);
    return out;
  }, [sessoesPorPeriodo, filtroTipo, filtroSessaoId]);

  const periodosDispo = useMemo(() => {
    if (!data) return ['Session'];
    const set = new Set<string>();
    data.sessoes.forEach(s => Object.keys(s.periodos).forEach(p => set.add(p)));
    return PERIODOS_ORDER.filter(p => set.has(p)).concat(
      [...set].filter(p => !PERIODOS_ORDER.includes(p))
    );
  }, [data]);

  // Sessões disponíveis pro dropdown — respeita filtro de tipo (não faz
  // sentido oferecer um Jogo no dropdown quando o usuário filtrou Treino).
  const sessoesDropdown = useMemo(() => {
    if (!data) return [];
    const respeitaTipo = filtroTipo === 'Todos'
      ? data.sessoes
      : data.sessoes.filter(s => s.tipo === filtroTipo);
    return [...respeitaTipo].sort((a, b) => b.data.localeCompare(a.data));
  }, [data, filtroTipo]);

  // Se o usuário muda tipo/período e a sessão atualmente selecionada some
  // do conjunto disponível, zera o filtro de sessão para não ficar "preso".
  useEffect(() => {
    if (filtroSessaoId != null && !sessoesDropdown.some(s => s.id === filtroSessaoId)) {
      setFiltroSessaoId(null);
    }
  }, [sessoesDropdown, filtroSessaoId]);


  // Comparativo Jogo × Treino — médias por sessão, todos os tipos do período.
  const compareData = useMemo(() => {
    const jogos   = sessoesPorPeriodo.filter(x => x.sessao.tipo === 'Jogo'   && n(x.m.distanciaTotal) > 0);
    const treinos = sessoesPorPeriodo.filter(x => x.sessao.tipo === 'Treino' && n(x.m.distanciaTotal) > 0);

    const mpm = (m: PeriodoMetrica) => {
      const dur = n(m.duracao);
      return dur > 0 ? n(m.distanciaTotal) / (dur / 60) : 0;
    };
    const mean = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    const data: CompareData = {
      dist:      { match: mean(jogos.map(x => n(x.m.distanciaTotal))), training: mean(treinos.map(x => n(x.m.distanciaTotal))) },
      mpm:       { match: mean(jogos.map(x => mpm(x.m))),               training: mean(treinos.map(x => mpm(x.m))) },
      hsr:       { match: mean(jogos.map(x => n(x.m.hsr))),              training: mean(treinos.map(x => n(x.m.hsr))) },
      sprint:    { match: mean(jogos.map(x => n(x.m.sprint))),           training: mean(treinos.map(x => n(x.m.sprint))) },
      acelDesac: {
        match:    mean(jogos.map(x => n(x.m.aceleracoes) + n(x.m.desaceleracoes))),
        training: mean(treinos.map(x => n(x.m.aceleracoes) + n(x.m.desaceleracoes))),
      },
    };

    return { data, matchCount: jogos.length, trainingCount: treinos.length };
  }, [sessoesPorPeriodo]);

  // Insights textuais — gerados sobre todos os tipos do período atual.
  const insights = useMemo(
    () => buildInsights(sessoesPorPeriodo.map(x => x.m), acwrData?.acwrAtual),
    [sessoesPorPeriodo, acwrData],
  );

  // Eixos do radar comparativo — usa apenas Jogos do período Session do
  // atleta para casar com a base do benchmark da posição (média de jogos).
  const radarEixos = useMemo(() => {
    if (!data?.jogador.posicao || !posBench) return null;
    const bench = posBench[data.jogador.posicao];
    if (!bench || bench.amostras < 3) return null;

    const jogosJogador = (data.sessoes ?? [])
      .filter(s => s.tipo === 'Jogo')
      .map(s => s.periodos['Session'])
      .filter((m): m is PeriodoMetrica => !!m && n(m.distanciaTotal) > 0);
    if (jogosJogador.length === 0) return null;

    const mean = (arr: number[]) =>
      arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    const dist   = mean(jogosJogador.map(m => n(m.distanciaTotal)));
    const dur    = mean(jogosJogador.map(m => n(m.duracao)));
    const mpm    = dur > 0 ? dist / (dur / 60) : 0;
    const hsr    = mean(jogosJogador.map(m => n(m.hsr)));
    const sprint = mean(jogosJogador.map(m => n(m.sprint)));
    const acelD  = mean(jogosJogador.map(m => n(m.aceleracoes) + n(m.desaceleracoes)));
    const carga  = mean(jogosJogador.map(m => n(m.cargaJogador)));

    const eixos: RadarAxis[] = [
      { label: 'Distância',  unit: 'm',     dec: 0, player: dist,   avg: bench.distanciaTotal,    top: bench.top.distanciaTotal },
      { label: 'm/min',      unit: '',      dec: 1, player: mpm,    avg: bench.metragemPorMinuto, top: bench.top.metragemPorMinuto },
      { label: 'Player Load', unit: '',     dec: 0, player: carga,  avg: bench.cargaJogador,      top: bench.top.cargaJogador },
      { label: 'HSR',        unit: 'm',     dec: 0, player: hsr,    avg: bench.hsr,               top: bench.top.hsr },
      { label: 'Sprint',     unit: 'm',     dec: 0, player: sprint, avg: bench.sprint,            top: bench.top.sprint },
      { label: 'Acel+Desac', unit: '',      dec: 0, player: acelD,  avg: bench.acelDesacelTotal,  top: bench.top.acelDesacelTotal },
    ];
    return { eixos, posicao: data.jogador.posicao, amostras: bench.amostras, jogos: jogosJogador.length };
  }, [data, posBench]);

  // Pontos de tendência: sessões ordenadas asc, com m/min calculado.
  // Filtra sessões em que o atleta não participou (distancia 0 → N/A).
  const trendPontos = useMemo<TrendPoint[]>(() => {
    return sessoesComPeriodo
      .filter(({ m }) => n(m.distanciaTotal) > 0)
      .map(({ sessao, m }) => {
        const dur = n(m.duracao);
        const dist = n(m.distanciaTotal);
        return {
          data: sessao.data,
          tipo: sessao.tipo,
          descricao: sessao.descricao,
          dist,
          mpm: dur > 0 ? dist / (dur / 60) : 0,
          hsr: n(m.hsr),
          sprint: n(m.sprint),
        };
      })
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [sessoesComPeriodo]);

  const stats = useMemo(() => {
    if (!sessoesComPeriodo.length) return null;
    const vals = (fn: (m: PeriodoMetrica) => number) => sessoesComPeriodo.map(x => fn(x.m));
    const avg = (fn: (m: PeriodoMetrica) => number) => {
      const vs = vals(fn);
      return vs.reduce((a, b) => a + b, 0) / vs.length;
    };
    const max = (fn: (m: PeriodoMetrica) => number) => Math.max(...vals(fn));
    // m/min: response não traz `metragemPorMinuto`, calculo a partir de dist/duração.
    const mpmOf = (m: PeriodoMetrica) => {
      const dur = n(m.duracao);
      return dur > 0 ? n(m.distanciaTotal) / (dur / 60) : 0;
    };
    return {
      totalSessoes: sessoesComPeriodo.length,
      avgDist:     avg(m => n(m.distanciaTotal)),
      avgMpm:      avg(mpmOf),
      maxMpm:      Math.max(...sessoesComPeriodo.map(x => mpmOf(x.m))),
      avgVel:      avg(m => n(m.velocidadeMaxima)),
      maxVel:      max(m => n(m.velocidadeMaxima)),
      avgHsr:      avg(m => n(m.hsr)),
      avgHsrEsforcos: avg(m => n(m.hsrEsforcos)),
      avgSprint:   avg(m => n(m.sprint)),
      avgSprintEsforcos: avg(m => n(m.sprintEsforcos)),
      avgAcel:     avg(m => n(m.aceleracoes)),
      avgDesac:    avg(m => n(m.desaceleracoes)),
      avgAcelDesacelTotal: avg(m => n(m.acelDesacelTotal)),
      avgCarga:    avg(m => n(m.cargaJogador)),
      avgCargaMin: avg(m => n(m.cargaPorMinuto)),
      // Média do ratio é mais honesta que ratio das médias — usa cada sessão
      // individualmente e descarta as com acel=0 (ratio indefinido).
      avgRatio: (() => {
        const rs = sessoesComPeriodo
          .map(x => computeECRatio(n(x.m.aceleracoes), n(x.m.desaceleracoes)))
          .filter((r): r is number => r != null);
        return rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
      })(),
      maxDist:     max(m => n(m.distanciaTotal)),
      maxHsr:      max(m => n(m.hsr)),
      maxHsrEsforcos: max(m => n(m.hsrEsforcos)),
      maxSprint:   max(m => n(m.sprint)),
      maxSprintEsforcos: max(m => n(m.sprintEsforcos)),
      maxAcel:     max(m => n(m.aceleracoes)),
      maxDesac:    max(m => n(m.desaceleracoes)),
      maxAcelDesacelTotal: max(m => n(m.acelDesacelTotal)),
      maxCarga:    max(m => n(m.cargaJogador)),
      maxCargaMin: max(m => n(m.cargaPorMinuto)),
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

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Carregando…</div>;
  if (erro)    return <div className="flex items-center justify-center h-64 text-red-500 text-sm">{erro}</div>;
  if (!data)   return null;

  const { jogador } = data;

  const thCls = 'px-3 py-2.5 text-left text-[10.5px] xl:text-[11.5px] font-extrabold font-outfit tracking-wider uppercase text-slate-450 dark:text-slate-500 whitespace-nowrap select-none';
  const thR   = 'px-3 py-2.5 text-right text-[10.5px] xl:text-[11.5px] font-extrabold font-outfit tracking-wider uppercase text-slate-450 dark:text-slate-500 whitespace-nowrap select-none';

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
                  {POSICOES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditOpen(false)}
                className="flex-1 border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                Cancelar
              </button>
              <button onClick={salvarEdicao} disabled={saving}
                className="flex-1 bg-club-red text-white font-bold rounded-lg px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 accent-glow">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ HEADER ═══════════════════ */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-white/[0.06] px-3 md:px-4 lg:px-4 py-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-4 min-w-0">
            <PlayerAvatar
              fotoUrl={jogador.fotoUrl}
              nome={jogador.apelido || jogador.nomeCompleto}
              size="lg"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Análise do Atleta
              </p>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
                {jogador.nomeCompleto}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {jogador.posicao && (() => {
                  const codigo = posicaoCodigo(jogador.posicao);
                  const cor = POSICAO_COLOR[codigo] ?? '#64748b';
                  const nome = jogador.posicao.split(' - ')[1] ?? jogador.posicao;
                  return (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-extrabold text-white"
                        style={{ background: cor }}
                      >
                        {codigo}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{nome}</span>
                    </span>
                  );
                })()}
                {jogador.apelido && (
                  <span className="text-[11px] text-slate-400">"{jogador.apelido}"</span>
                )}
                <span className="text-[10px] text-slate-400 font-mono">· {jogador.codigoCsv}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => navigate(-1)}
              className="print-hide text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
              ← Voltar
            </button>
            <button onClick={() => window.print()}
              title="Imprimir ou salvar como PDF"
              className="print-hide flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
              </svg>
              Imprimir
            </button>
            <button onClick={() => setEditOpen(true)}
              className="print-hide bg-club-red text-white text-xs font-bold px-4 py-2 rounded-lg hover:opacity-90 accent-glow">
              Editar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tipo</span>
            <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
              {(['Todos', 'Treino', 'Jogo'] as const).map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    filtroTipo === t
                      ? 'bg-club-red text-white accent-glow'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Período</span>
            <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
              {periodosDispo.map(p => (
                <button key={p} onClick={() => setFiltroPeriodo(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    filtroPeriodo === p
                      ? 'bg-slate-800 dark:bg-white/20 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}>
                  {p === 'Session' ? 'Sessão' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro por sessão específica */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sessão</span>
            <select
              value={filtroSessaoId == null ? '' : String(filtroSessaoId)}
              onChange={e => setFiltroSessaoId(e.target.value ? Number(e.target.value) : null)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#11161d] border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-club-red max-w-[260px]"
            >
              <option value="">Todas as sessões</option>
              {sessoesDropdown.map(s => {
                const titulo = s.descricao || (s.tipo === 'Jogo' ? 'Jogo' : 'Treino');
                return (
                  <option key={s.id} value={s.id}>
                    {formatData(s.data)} · {titulo}
                  </option>
                );
              })}
            </select>
            {filtroSessaoId != null && (
              <button
                onClick={() => setFiltroSessaoId(null)}
                className="text-[11px] font-extrabold text-club-red dark:text-club-red-light hover:underline font-outfit uppercase tracking-wider"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="py-4 md:py-6 w-full space-y-6 px-3 md:px-4 lg:px-4">

        {/* ═══════════════════ TABELA ═══════════════════ */}
        <div className="bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-hidden shadow-xl dark:shadow-black/20">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] xl:text-[13.5px] table-auto">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]">
                <tr>
                  <th className={thCls}>Data</th>
                  <th className={thCls}>Sessão</th>
                  <th className={thCls}>Tipo</th>
                  <th className={thCls}>Período</th>
                  <th className={thR}>Duração</th>
                  <th className={thR}>Dist. (m)</th>
                  <th className={thR}>m/min</th>
                  <th className={thR}>PL</th>
                  <th className={thR}>PL/min</th>
                  <th className={thR}>Vel. Máx</th>
                  <th className={thR}>HSR (m)</th>
                  <th className={thR}>HS Esf.</th>
                  <th className={thR}>Sprint (m)</th>
                  <th className={thR}>Spr. Esf.</th>
                  <th className={thR}>Acel.</th>
                  <th className={thR}>Desac.</th>
                  <th className={thR}>Acel+D</th>
                  <th className={thR}>EXC/CON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {sessoesComPeriodo.map(({ sessao, m }) => (
                  <tr key={`${sessao.id}-${m.periodo}`}
                    onClick={() => navigate(`/sessao/${sessao.id}`)}
                    className="cursor-pointer hover:bg-club-red/5 dark:hover:bg-club-red/10 transition-colors group text-[11px] xl:text-[12px]">
                    <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap group-hover:text-club-red transition-colors">
                      {formatData(sessao.data)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-650 dark:text-slate-400 whitespace-nowrap text-[12px] xl:text-[13px] max-w-[150px] truncate" title={sessao.descricao || undefined}>
                      {sessao.descricao || '—'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                        sessao.tipo === 'Jogo'
                          ? 'bg-club-red/10 text-club-red border border-club-red/20'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-500 border border-slate-200/40 dark:border-white/10'
                      }`}>
                        {sessao.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] xl:text-[13px] text-slate-400">
                      {m.periodo === 'Session' ? 'Sessão' : m.periodo}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[12px] xl:text-[13px] text-slate-500 dark:text-slate-400">
                      {fmtSec(n(m.duracao))}
                    </td>
                    <td className="px-3 py-2.5">
                      <BarCell value={n(m.distanciaTotal)} max={stats?.maxDist ?? 1} color={M_COLOR.dist} />
                    </td>
                    <td className="px-3 py-2.5">
                      {(() => {
                        const dur = n(m.duracao);
                        const mpm = dur > 0 ? n(m.distanciaTotal) / (dur / 60) : 0;
                        return <BarCell value={mpm} max={stats?.maxMpm ?? 1} color={M_COLOR.mpm} dec={1} />;
                      })()}
                    </td>
                    <td className="px-3 py-2.5">
                      <BarCell value={n(m.cargaJogador)} max={stats?.maxCarga ?? 1} color={M_COLOR.carga} />
                    </td>
                    <td className="px-3 py-2.5">
                      <BarCell value={n(m.cargaPorMinuto)} max={stats?.maxCargaMin ?? 1} color={M_COLOR.cMin} dec={2} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300 font-medium">
                      {fmtNum(n(m.velocidadeMaxima), 1)}
                    </td>
                    <td className="px-3 py-2.5">
                      <BarCell value={n(m.hsr)} max={stats?.maxHsr ?? 1} color={M_COLOR.hsr} />
                    </td>
                    <td className="px-3 py-2.5">
                      <BarCell value={n(m.hsrEsforcos)} max={stats?.maxHsrEsforcos ?? 1} color={M_COLOR.hsrE} />
                    </td>
                    <td className="px-3 py-2.5">
                      <BarCell value={n(m.sprint)} max={stats?.maxSprint ?? 1} color={M_COLOR.sprint} />
                    </td>
                    <td className="px-3 py-2.5">
                      <BarCell value={n(m.sprintEsforcos)} max={stats?.maxSprintEsforcos ?? 1} color={M_COLOR.sprE} />
                    </td>
                    <td className="px-3 py-2.5">
                      <BarCell value={n(m.aceleracoes)} max={stats?.maxAcel ?? 1} color={M_COLOR.acel} />
                    </td>
                    <td className="px-3 py-2.5">
                      <BarCell value={n(m.desaceleracoes)} max={stats?.maxDesac ?? 1} color={M_COLOR.desac} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-[12px] xl:text-[13px] tabular-nums text-slate-700 dark:text-slate-400">
                      {n(m.acelDesacelTotal)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <RatioCell acel={n(m.aceleracoes)} desac={n(m.desaceleracoes)} />
                    </td>
                  </tr>
                ))}

                {sessoesComPeriodo.length === 0 && (
                  <tr><td colSpan={18} className="py-12 text-center text-sm text-slate-400">
                    Nenhuma sessão encontrada para os filtros selecionados.
                  </td></tr>
                )}
              </tbody>

              {/* Linha de médias */}
              {stats && sessoesComPeriodo.length > 0 && (
                <tfoot className="bg-slate-100 dark:bg-white/[0.04] border-t-2 border-slate-300 dark:border-white/10">
                  <tr className="text-[12px] xl:text-[13.5px]">
                    <td className="px-3 py-2.5 text-[11px] xl:text-[12px] font-black uppercase tracking-wide text-slate-650 dark:text-slate-300 font-outfit" colSpan={5}>
                      Médias do Atleta
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-750 dark:text-slate-200">{fmtNum(stats.avgDist)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-750 dark:text-slate-200">{fmtNum(stats.avgMpm, 1)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-750 dark:text-slate-200">{fmtNum(stats.avgCarga, 0)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-750 dark:text-slate-200">{fmtNum(stats.avgCargaMin, 2)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-750 dark:text-slate-200">{fmtNum(stats.avgVel, 1)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-750 dark:text-slate-200">{fmtNum(stats.avgHsr)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-750 dark:text-slate-200">{fmtNum(stats.avgHsrEsforcos, 1)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-750 dark:text-slate-200">{fmtNum(stats.avgSprint)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-750 dark:text-slate-200">{fmtNum(stats.avgSprintEsforcos, 1)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-750 dark:text-slate-200">{fmtNum(stats.avgAcel, 1)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-750 dark:text-slate-200">{fmtNum(stats.avgDesac, 1)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[11px] xl:text-[12px] tabular-nums text-slate-750 dark:text-slate-200">{fmtNum(stats.avgAcelDesacelTotal, 1)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <RatioCell acel={0} desac={0} ratio={stats.avgRatio} />
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ═══════════════════ EVOLUÇÃO POR SESSÃO (TREND) ═══════════════════ */}
        {trendPontos.length >= 2 && (
          <div className="bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-white/[0.06] p-6">
            <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Evolução por Sessão
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tendência das principais métricas — linha tracejada = média do atleta · ponto sólido = jogo · ponto translúcido = treino
                </p>
              </div>
              <span className="text-[11px] text-slate-400">
                <b className="text-slate-700 dark:text-slate-300">{trendPontos.length}</b> sessões com participação
              </span>
            </div>
            <TrendChart pontos={trendPontos} />
          </div>
        )}

        {/* ═══════════════════ JOGO × TREINO + INSIGHTS ═══════════════════ */}
        {sessoesPorPeriodo.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Match × Training Compare (3/5) */}
            <div className="lg:col-span-3 bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-white/[0.06] p-6">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Jogo × Treino
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Médias por sessão — quanto mais próximas as barras, mais o treino reproduz a demanda do jogo
                </p>
              </div>
              <MatchTrainingCompare
                data={compareData.data}
                matchCount={compareData.matchCount}
                trainingCount={compareData.trainingCount}
              />
            </div>

            {/* Smart Insights (2/5) */}
            <div className="lg:col-span-2 bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-white/[0.06] p-6">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Insights
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Análise automática dos padrões deste atleta
                </p>
              </div>

              {insights.length === 0 ? (
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-8 px-4">
                  Dados insuficientes para gerar insights neste período.
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {insights.map((ins, i) => {
                    const palette = ins.kind === 'positive'
                      ? { dot: 'bg-emerald-500', tag: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200/60 dark:border-emerald-800/40' }
                      : ins.kind === 'warning'
                      ? { dot: 'bg-amber-500',   tag: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/15 border-amber-200/60 dark:border-amber-800/40' }
                      : { dot: 'bg-slate-400',   tag: 'text-slate-600 dark:text-slate-300',     bg: 'bg-slate-50 dark:bg-white/[0.03] border-slate-200/60 dark:border-white/[0.06]' };
                    return (
                      <li key={i} className={`flex gap-2.5 p-3 rounded-lg border ${palette.bg}`}>
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${palette.dot}`} />
                        <div className="min-w-0">
                          <p className={`text-[11px] font-bold uppercase tracking-wide ${palette.tag}`}>
                            {ins.title}
                          </p>
                          <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5 leading-snug">
                            {ins.detail}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════ ACWR (RISCO DE LESÃO) ═══════════════════ */}
        {acwrData && acwrData.serie.length > 0 && (() => {
          const zonaInfo: Record<string, { label: string; color: string; bg: string }> = {
            'risco':     { label: 'RISCO ELEVADO',  color: '#dc2626', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40' },
            'atencao':   { label: 'ATENÇÃO',        color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40' },
            'ideal':     { label: 'ZONA IDEAL',     color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40' },
            'baixa':     { label: 'SUB-TREINADO',   color: '#eab308', bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/40' },
            'sem-dados': { label: 'COLETANDO',      color: '#94a3b8', bg: 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10' },
          };
          const info = zonaInfo[acwrData.zona] ?? zonaInfo['sem-dados']!;
          return (
            <div className="bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-white/[0.06] p-6">
              <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                <div>
                  <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    ACWR · Risco de Lesão
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Razão entre carga aguda (7 dias) e crônica (28 dias) — baseado em Player Load
                  </p>
                </div>
                <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${info.bg}`}>
                  <div className="text-right">
                    <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: info.color }}>
                      {info.label}
                    </p>
                    <p className="text-2xl font-extrabold tabular-nums leading-none mt-0.5" style={{ color: info.color }}>
                      {acwrData.acwrAtual != null ? acwrData.acwrAtual.toFixed(2) : '—'}
                    </p>
                  </div>
                </div>
              </div>
              <AcwrChart serie={acwrData.serie} />
            </div>
          );
        })()}

        {/* ═══════════════════ MICROCICLO + RADAR ═══════════════════ */}
        {(microcicloData?.totalJogos || radarEixos) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {microcicloData && microcicloData.totalJogos > 0 && (
              <div className="bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-white/[0.06] p-6">
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Microciclo · MD-N · MD · MD+N
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Carga média por dia do ciclo — cada treino classificado pelo offset ao jogo mais próximo
                  </p>
                </div>
                <MicrocicloChart
                  pontos={microcicloData.distribuicao}
                  totalJogos={microcicloData.totalJogos}
                  totalSessoes={microcicloData.totalSessoes}
                />
              </div>
            )}

            {radarEixos && (
              <div className="bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-white/[0.06] p-6">
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Radar · Atleta × Posição
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Médias do atleta em jogos comparadas à posição <b className="text-slate-600 dark:text-slate-300">{radarEixos.posicao}</b> · borda externa = melhor (p95)
                  </p>
                </div>
                <RadarComparativo
                  axes={radarEixos.eixos}
                  posicaoLabel={radarEixos.posicao}
                  amostras={radarEixos.amostras}
                />
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ 5 GAUGES ═══════════════════ */}
        {stats && sessoesComPeriodo.length > 0 && (
          <div className="bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-white/[0.06] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Médias do Atleta
              </h2>
              <p className="text-[11px] text-slate-400">
                Calculadas sobre {stats.totalSessoes} sessões filtradas
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Gauge title="Total Dist."    value={Math.round(stats.avgDist)}    max={12000} topAtleta={stats.maxDist}    unit="m" />
              <Gauge title="HSR"            value={Math.round(stats.avgHsr)}     max={1000}  topAtleta={stats.maxHsr}     unit="m" />
              <Gauge title="Sprint"         value={Math.round(stats.avgSprint)}  max={400}   topAtleta={stats.maxSprint}  unit="m" />
              <Gauge title="Aceleração"     value={Math.round(stats.avgAcel)}    max={50}    topAtleta={stats.maxAcel} />
              <Gauge title="Desaceleração"  value={Math.round(stats.avgDesac)}   max={50}    topAtleta={stats.maxDesac} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
