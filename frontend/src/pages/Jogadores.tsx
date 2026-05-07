import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import { ConfirmModal } from '../components/ConfirmModal';

interface Jogador {
  id: number;
  nomeCompleto: string;
  apelido: string | null;
  posicao: string | null;
  codigoCsv: string;
  fotoUrl: string | null;
}

const API = `${API_BASE}/jogadores`;

const POSICOES = [
  'Goleiro', 'Lateral Direito', 'Lateral Esquerdo', 'Zagueiro',
  'Volante', 'Meia Defensivo', 'Meia', 'Meia Ofensivo',
  'Ponta Direita', 'Ponta Esquerda', 'Centroavante',
];

export const Jogadores: React.FC = () => {
  const navigate = useNavigate();
  const [lista, setLista] = useState<Jogador[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [form, setForm] = useState({ nomeCompleto: '', apelido: '', posicao: '', codigoCsv: '' });
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Edit modal
  const [editJogador, setEditJogador] = useState<Jogador | null>(null);
  const [editForm, setEditForm] = useState({ apelido: '', posicao: '' });
  const [saving, setSaving] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error('Falha ao buscar jogadores');
      setLista(await res.json());
      setErro(null);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm(null);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ nomeCompleto: '', apelido: '', posicao: '', codigoCsv: '' });
        carregar();
      } else {
        const j = await res.json() as { error?: string };
        setErroForm(j.error ?? 'Erro ao adicionar jogador.');
      }
    } catch (e: unknown) {
      setErroForm(e instanceof Error ? e.message : 'Erro de conexão.');
    }
  };

  const executarRemocao = async () => {
    if (pendingDeleteId === null) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
    if (res.ok) carregar();
  };

  const abrirEdicao = (j: Jogador) => {
    setEditJogador(j);
    setEditForm({ apelido: j.apelido ?? '', posicao: j.posicao ?? '' });
  };

  const salvarEdicao = async () => {
    if (!editJogador) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/${editJogador.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditJogador(null);
        carregar();
      }
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'border border-slate-300 dark:border-white/10 bg-white dark:bg-[#11161d] dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-club-red';

  return (
    <div className="px-8 py-6">
      <ConfirmModal
        open={pendingDeleteId !== null}
        message="Remover este jogador e todas as suas métricas?"
        onConfirm={executarRemocao}
        onCancel={() => setPendingDeleteId(null)}
      />

      {/* Edit Modal */}
      {editJogador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Editar Jogador</h3>
            <p className="text-xs text-slate-400 mb-4">{editJogador.nomeCompleto}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Apelido</label>
                <input
                  className={`${inputCls} w-full`}
                  value={editForm.apelido}
                  onChange={e => setEditForm(f => ({ ...f, apelido: e.target.value }))}
                  placeholder="Como é chamado no time"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Posição</label>
                <select
                  className={`${inputCls} w-full`}
                  value={editForm.posicao}
                  onChange={e => setEditForm(f => ({ ...f, posicao: e.target.value }))}
                >
                  <option value="">— Selecionar —</option>
                  {POSICOES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setEditJogador(null)}
                className="flex-1 border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={() => navigate(`/jogador/${editJogador.id}`)}
                className="flex-1 border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Ver Performance
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

      <h1 className="text-2xl font-extrabold mb-2 text-slate-900 dark:text-white">Elenco</h1>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">
        Jogadores são criados automaticamente no primeiro upload. Edite para adicionar apelido e posição.
      </p>

      {/* Form novo jogador */}
      <form onSubmit={criar} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4 bg-slate-50 dark:bg-white/[0.02] p-4 rounded-xl border border-slate-200 dark:border-white/5">
        <input className={inputCls} placeholder="Nome completo" value={form.nomeCompleto} onChange={e => setForm({ ...form, nomeCompleto: e.target.value })} required />
        <input className={inputCls} placeholder="Apelido" value={form.apelido} onChange={e => setForm({ ...form, apelido: e.target.value })} />
        <select className={inputCls} value={form.posicao} onChange={e => setForm({ ...form, posicao: e.target.value })}>
          <option value="">— Posição —</option>
          {POSICOES.map(p => <option key={p}>{p}</option>)}
        </select>
        <input className={inputCls} placeholder="Código CSV (Player Name)" value={form.codigoCsv} onChange={e => setForm({ ...form, codigoCsv: e.target.value })} required />
        <button className="bg-club-red text-white font-bold rounded-lg px-4 py-2 text-sm hover:opacity-90 accent-glow">Adicionar</button>
      </form>

      {erroForm && <p className="text-rose-500 text-sm mb-4">{erroForm}</p>}
      {loading && <p className="text-slate-500 dark:text-slate-400 text-sm">Carregando…</p>}
      {erro && <p className="text-rose-500 text-sm">{erro}</p>}

      <div className="border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden bg-white dark:bg-[#0d1117]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 text-[11px] uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 text-left">Jogador</th>
              <th scope="col" className="px-3 py-3 text-left">Posição</th>
              <th scope="col" className="px-3 py-3 text-left">Código CSV</th>
              <th scope="col" className="px-3 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map(j => (
              <tr key={j.id} className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-300 shrink-0">
                      {(j.apelido || j.nomeCompleto).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{j.apelido || j.nomeCompleto}</p>
                      {j.apelido && <p className="text-xs text-slate-400">{j.nomeCompleto}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {j.posicao ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-club-red/10 text-club-red border border-club-red/20">
                      {j.posicao}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-500 dark:text-slate-500 font-mono text-xs">{j.codigoCsv}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => navigate(`/jogador/${j.id}`)}
                      className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-club-red transition-colors"
                    >
                      Performance
                    </button>
                    <button
                      onClick={() => abrirEdicao(j)}
                      className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setPendingDeleteId(j.id)}
                      className="text-xs font-semibold text-rose-500 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && lista.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-400 dark:text-slate-500 text-sm">Nenhum jogador cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
