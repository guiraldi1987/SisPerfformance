import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import { ConfirmModal } from '../components/ConfirmModal';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { POSICOES, posicaoCodigo, POSICAO_COLOR, ensureContrastBg } from '../lib/constants';
import { formatData } from '../lib/format';
import { useToast } from '../components/Toast';

interface Jogador {
  id: number;
  nomeCompleto: string;
  apelido: string | null;
  posicao: string | null;
  codigoCsv: string;
  fotoUrl: string | null;
  status: 'ativo' | 'inativo';
  dataChegada: string | null;
  dataSaida:   string | null;
}

const API = `${API_BASE}/jogadores`;

type StatusFiltro = 'ativo' | 'inativo' | 'todos';

export const Jogadores: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [todos, setTodos] = useState<Jogador[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('ativo');
  const [busca, setBusca] = useState('');

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [form, setForm] = useState({ nomeCompleto: '', apelido: '', posicao: '', codigoCsv: '' });
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Edit modal — agora também controla status e dataSaida
  const [editJogador, setEditJogador] = useState<Jogador | null>(null);
  const [editForm, setEditForm] = useState({
    apelido: '', posicao: '', status: 'ativo' as 'ativo' | 'inativo', dataSaida: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editJogador) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Apenas imagens JPEG, PNG ou WEBP são permitidas.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }

    setUploadingFoto(true);
    const formData = new FormData();
    formData.append('foto', file);

    try {
      const res = await fetch(`${API}/${editJogador.id}/foto`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const jogadorAtualizado = await res.json() as Jogador;
        toast.success('Foto atualizada com sucesso!');
        setEditJogador(jogadorAtualizado);
        setTodos(prev => prev.map(j => j.id === jogadorAtualizado.id ? jogadorAtualizado : j));
      } else {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? 'Falha ao fazer upload da foto.');
      }
    } catch (error) {
      console.error('Erro de upload:', error);
      toast.error('Erro de conexão ao fazer upload.');
    } finally {
      setUploadingFoto(false);
    }
  };


  // Wizard de reapresentação (Lote 4)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSelecionados, setWizardSelecionados] = useState<Set<number>>(new Set());
  const [wizardSalvando, setWizardSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      // Sempre buscamos `todos` e filtramos no frontend pra contagens em chip
      const res = await fetch(`${API}?status=todos`);
      if (!res.ok) throw new Error('Falha ao buscar jogadores');
      setTodos(await res.json());
      setErro(null);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  // Contagens por status — alimenta os chips
  const counts = useMemo(() => ({
    ativo:   todos.filter(j => j.status === 'ativo').length,
    inativo: todos.filter(j => j.status === 'inativo').length,
    todos:   todos.length,
  }), [todos]);

  // Lista visível: filtro de status + busca textual
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let out = todos;
    if (statusFiltro !== 'todos') out = out.filter(j => j.status === statusFiltro);
    if (q) {
      out = out.filter(j => {
        const blob = `${j.nomeCompleto} ${j.apelido ?? ''} ${j.posicao ?? ''} ${j.codigoCsv}`.toLowerCase();
        return blob.includes(q);
      });
    }
    return out;
  }, [todos, statusFiltro, busca]);

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
        toast.success('Jogador adicionado');
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
    if (res.ok) {
      toast.success('Jogador removido');
      carregar();
    } else {
      toast.error('Falha ao remover (pode haver métricas associadas)');
    }
  };

  const abrirEdicao = (j: Jogador) => {
    setEditJogador(j);
    setEditForm({
      apelido:   j.apelido ?? '',
      posicao:   j.posicao ?? '',
      status:    j.status,
      dataSaida: j.dataSaida ?? '',
    });
  };

  const salvarEdicao = async () => {
    if (!editJogador) return;
    setSaving(true);
    try {
      // Se o usuário marcou inativo sem informar data, default = hoje
      const payload: Record<string, unknown> = {
        apelido: editForm.apelido,
        posicao: editForm.posicao,
        status:  editForm.status,
      };
      if (editForm.status === 'inativo') {
        payload.dataSaida = editForm.dataSaida || new Date().toISOString().slice(0, 10);
      } else {
        payload.dataSaida = null;
      }

      const res = await fetch(`${API}/${editJogador.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditJogador(null);
        toast.success(editForm.status === 'inativo' ? 'Jogador marcado como inativo' : 'Alterações salvas');
        carregar();
      } else {
        toast.error('Falha ao salvar');
      }
    } finally {
      setSaving(false);
    }
  };

  // Atalho: marca/desmarca inativo direto da linha (sem abrir modal)
  const toggleStatusRapido = async (j: Jogador) => {
    const novo = j.status === 'ativo' ? 'inativo' : 'ativo';
    const res = await fetch(`${API}/${j.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novo }),
    });
    if (res.ok) {
      toast.success(novo === 'inativo' ? `${j.apelido || j.nomeCompleto} marcado como inativo` : `${j.apelido || j.nomeCompleto} reativado`);
      carregar();
    } else {
      toast.error('Falha ao atualizar status');
    }
  };

  // ─── Wizard "Atualizar Elenco para Reapresentação" ──────────────────────
  const abrirWizard = () => {
    // Pré-marca todos os ativos para o usuário desmarcar quem saiu
    const ativos = todos.filter(j => j.status === 'ativo').map(j => j.id);
    setWizardSelecionados(new Set(ativos));
    setWizardOpen(true);
  };

  const wizardToggle = (id: number) => {
    setWizardSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const wizardConfirmar = async () => {
    // Os atletas atuais ativos que NÃO estão marcados serão inativados
    const ativosAtuais = todos.filter(j => j.status === 'ativo').map(j => j.id);
    const aInativar = ativosAtuais.filter(id => !wizardSelecionados.has(id));

    if (aInativar.length === 0) {
      toast.info('Nenhuma alteração — todos os ativos foram mantidos.');
      setWizardOpen(false);
      return;
    }

    setWizardSalvando(true);
    try {
      const res = await fetch(`${API}/batch-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: aInativar,
          status: 'inativo',
          dataSaida: new Date().toISOString().slice(0, 10),
        }),
      });
      if (res.ok) {
        const j = await res.json() as { atualizados: number };
        toast.success(`${j.atualizados} ${j.atualizados === 1 ? 'atleta marcado' : 'atletas marcados'} como inativo`);
        setWizardOpen(false);
        carregar();
      } else {
        toast.error('Falha na atualização em lote');
      }
    } finally {
      setWizardSalvando(false);
    }
  };

  const inputCls = 'border border-slate-300 dark:border-white/10 bg-input dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-club-red';

  // Atletas sem posição entre os ativos (sugestão de ação)
  const ativosSemPosicao = useMemo(
    () => todos.filter(j => j.status === 'ativo' && !j.posicao).length,
    [todos],
  );

  return (
    <div className="px-8 py-6">
      <ConfirmModal
        open={pendingDeleteId !== null}
        message="Remover este jogador e todas as suas métricas? Para preservar o histórico, prefira marcar como inativo."
        details={(() => {
          const j = todos.find(x => x.id === pendingDeleteId);
          return j ? (j.apelido || j.nomeCompleto) : undefined;
        })()}
        confirmLabel="Remover permanentemente"
        onConfirm={executarRemocao}
        onCancel={() => setPendingDeleteId(null)}
      />

      {/* Edit Modal */}
      {editJogador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditJogador(null)}>
          <div className="bg-card border border-slate-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Editar Jogador</h3>
            <p className="text-xs text-slate-500 mb-2">{editJogador.nomeCompleto}</p>
            
            {/* Foto Upload Area */}
            <div className="flex flex-col items-center justify-center py-4 mb-4 border-b border-slate-100 dark:border-white/5 relative">
              <div className="relative group cursor-pointer" onClick={() => document.getElementById('foto-input')?.click()}>
                <PlayerAvatar
                  fotoUrl={editJogador.fotoUrl}
                  nome={editJogador.apelido || editJogador.nomeCompleto}
                  size="xl"
                  className={`${uploadingFoto ? 'opacity-40 animate-pulse' : 'hover:scale-105 shadow-md'}`}
                />
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6 text-white">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                {uploadingFoto && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                    <div className="w-8 h-8 border-4 border-t-indigo-600 border-indigo-200 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <input
                type="file"
                id="foto-input"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFotoChange}
              />
              <button
                type="button"
                onClick={() => document.getElementById('foto-input')?.click()}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-2.5 hover:underline focus:outline-none"
              >
                {editJogador.fotoUrl ? 'Alterar Foto' : 'Adicionar Foto'}
              </button>
            </div>

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
                  aria-label="Posição do atleta"
                  className={`${inputCls} w-full`}
                  value={editForm.posicao}
                  onChange={e => setEditForm(f => ({ ...f, posicao: e.target.value }))}
                >
                  <option value="">— Selecionar —</option>
                  {POSICOES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>

              {/* Status + dataSaida */}
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Status no elenco</label>
                <div className="flex gap-2">
                  {(['ativo', 'inativo'] as const).map(s => (
                    <button key={s} type="button"
                      onClick={() => setEditForm(f => ({
                        ...f, status: s,
                        dataSaida: s === 'inativo' && !f.dataSaida ? new Date().toISOString().slice(0, 10) : f.dataSaida,
                      }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all border ${
                        editForm.status === s
                          ? s === 'ativo'
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/50'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-white/30'
                          : 'bg-transparent text-slate-500 border-slate-200 dark:border-white/10 hover:border-slate-300'
                      }`}>
                      {s === 'ativo' ? 'No elenco' : 'Saiu do clube'}
                    </button>
                  ))}
                </div>

                {editForm.status === 'inativo' && (
                  <div className="mt-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500 mb-1 block">Data de saída</label>
                    <input type="date" value={editForm.dataSaida}
                      aria-label="Data de saída do atleta"
                      onChange={e => setEditForm(f => ({ ...f, dataSaida: e.target.value }))}
                      className={`${inputCls} w-full`} />
                  </div>
                )}
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
                className="flex-1 bg-indigo-600 text-white font-bold rounded-lg px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-600/25"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wizard de Reapresentação */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setWizardOpen(false)}>
          <div className="bg-card border border-slate-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-club-red/15 text-club-red text-base flex items-center justify-center">↻</span>
              Atualizar Elenco para Reapresentação
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Desmarque os atletas que <b>saíram do clube</b>. Os desmarcados serão movidos para inativos com data de hoje.
              Atletas novos chegarão automaticamente no próximo upload de CSV.
            </p>

            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/[0.02]">
              {todos.filter(j => j.status === 'ativo').map(j => {
                const sel = wizardSelecionados.has(j.id);
                return (
                  <label key={j.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-white/[0.06] last:border-b-0 cursor-pointer transition-colors ${
                    sel
                      ? 'bg-emerald-50/40 dark:bg-emerald-900/10'
                      : 'bg-rose-50/40 dark:bg-rose-900/10'
                  }`}>
                    <input type="checkbox" checked={sel} onChange={() => wizardToggle(j.id)}
                      className="w-4 h-4 accent-emerald-600" />
                    {j.posicao ? (() => {
                      const c = posicaoCodigo(j.posicao);
                      return (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded text-[10px] font-extrabold text-white shrink-0"
                          style={{ background: ensureContrastBg(POSICAO_COLOR[c] ?? '#64748b') }}>
                          {c}
                        </span>
                      );
                    })() : <span className="w-7 text-center text-xs text-slate-500">—</span>}
                    <span className={`flex-1 text-sm font-bold truncate ${
                      sel ? 'text-slate-900 dark:text-white' : 'text-slate-500 line-through'
                    }`}>
                      {j.apelido || j.nomeCompleto}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{j.codigoCsv}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      sel
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                    }`}>
                      {sel ? 'Permanece' : 'Sai'}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                <b className="text-emerald-600 dark:text-emerald-400">{wizardSelecionados.size}</b> permanecem ·{' '}
                <b className="text-rose-600 dark:text-rose-400">{counts.ativo - wizardSelecionados.size}</b> sairão
              </span>
              <div className="flex gap-2">
                <button onClick={() => setWizardOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10">
                  Cancelar
                </button>
                <button onClick={wizardConfirmar} disabled={wizardSalvando}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-club-red text-white hover:opacity-90 disabled:opacity-50 accent-glow">
                  {wizardSalvando ? 'Aplicando…' : 'Confirmar mudanças'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Elenco</h1>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Jogadores são criados automaticamente no upload. Edite para apelido, posição e status.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={abrirWizard}
            className="print-hide flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-club-red text-white hover:opacity-90 accent-glow shadow-lg shadow-club-red/20"
            title="Atualizar elenco em batch">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3.5 h-3.5">
              <path d="M3 12a9 9 0 0 1 15-6.7M21 12a9 9 0 0 1-15 6.7M16 5h5V0M8 19H3v5" />
            </svg>
            Atualizar Elenco
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-4 mt-4">
        <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
          {([
            ['ativo',   'Ativos',   counts.ativo],
            ['inativo', 'Inativos', counts.inativo],
            ['todos',   'Todos',    counts.todos],
          ] as Array<[StatusFiltro, string, number]>).map(([k, label, n]) => (
            <button key={k} onClick={() => setStatusFiltro(k)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFiltro === k
                  ? 'bg-club-red text-white accent-glow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}>
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                statusFiltro === k ? 'bg-white/20' : 'bg-slate-200 dark:bg-white/10'
              } tabular-nums`}>{n}</span>
            </button>
          ))}
        </div>

        <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, apelido, posição ou código CSV…"
          className={`${inputCls} flex-1 min-w-[220px]`} />

        {ativosSemPosicao > 0 && statusFiltro === 'ativo' && (
          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
            ⚠ {ativosSemPosicao} ativo{ativosSemPosicao > 1 ? 's' : ''} sem posição
          </span>
        )}
      </div>

      {/* Form novo jogador */}
      <form onSubmit={criar} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4 bg-slate-50 dark:bg-white/[0.02] p-4 rounded-xl border border-slate-200 dark:border-white/5 print-hide">
        <input className={inputCls} placeholder="Nome completo" value={form.nomeCompleto} onChange={e => setForm({ ...form, nomeCompleto: e.target.value })} required />
        <input className={inputCls} placeholder="Apelido" value={form.apelido} onChange={e => setForm({ ...form, apelido: e.target.value })} />
        <select className={inputCls} value={form.posicao} onChange={e => setForm({ ...form, posicao: e.target.value })} aria-label="Posição do novo atleta">
          <option value="">— Posição —</option>
          {POSICOES.map(p => <option key={p}>{p}</option>)}
        </select>
        <input className={inputCls} placeholder="Código CSV (Player Name)" value={form.codigoCsv} onChange={e => setForm({ ...form, codigoCsv: e.target.value })} required />
        <button className="bg-club-red text-white font-bold rounded-lg px-4 py-2 text-sm hover:opacity-90 accent-glow">Adicionar</button>
      </form>

      {erroForm && <p className="text-rose-700 text-sm mb-4">{erroForm}</p>}
      {loading && <p className="text-slate-500 dark:text-slate-400 text-sm">Carregando…</p>}
      {erro && <p className="text-rose-700 text-sm">{erro}</p>}

      <div className="border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 text-[11px] uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 text-left">Jogador</th>
              <th scope="col" className="px-3 py-3 text-left">Posição</th>
              <th scope="col" className="px-3 py-3 text-left">Status</th>
              <th scope="col" className="px-3 py-3 text-left">Período</th>
              <th scope="col" className="px-3 py-3 text-left">Código CSV</th>
              <th scope="col" className="px-3 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map(j => {
              const inativo = j.status === 'inativo';
              return (
              <tr key={j.id} className={`border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.03] ${inativo ? 'opacity-65' : ''}`}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar
                      fotoUrl={j.fotoUrl}
                      nome={j.apelido || j.nomeCompleto}
                      size="sm"
                      className={inativo ? 'opacity-60' : ''}
                    />
                    <div>
                      <p className={`font-semibold ${inativo ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                        {j.apelido || j.nomeCompleto}
                      </p>
                      {j.apelido && <p className="text-xs text-slate-500">{j.nomeCompleto}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {j.posicao ? (() => {
                    const codigo = posicaoCodigo(j.posicao);
                    const cor = POSICAO_COLOR[codigo] ?? '#64748b';
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-extrabold text-white"
                          style={{ background: cor }}
                        >
                          {codigo}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300">{j.posicao.split(' - ')[1] ?? j.posicao}</span>
                      </span>
                    );
                  })() : (
                    <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold">— sem posição</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    inativo
                      ? 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                      : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${inativo ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
                    {inativo ? 'Inativo' : 'Ativo'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                  {j.dataChegada ? `Desde ${formatData(j.dataChegada)}` : '—'}
                  {j.dataSaida && (
                    <div className="text-rose-700 dark:text-rose-400 text-[10px]">Saiu {formatData(j.dataSaida)}</div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-500 dark:text-slate-500 font-mono text-xs">{j.codigoCsv}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => navigate(`/jogador/${j.id}`)}
                      title="Ver performance"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-club-red text-white hover:opacity-90 accent-glow transition-all"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-3 h-3">
                        <path d="M3 20h18M5 20V14M9 20V8M13 20V11M17 20V4" />
                      </svg>
                      Performance
                    </button>
                    <button
                      onClick={() => abrirEdicao(j)}
                      title="Editar"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-white/30 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3 h-3">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                      Editar
                    </button>
                    <button
                      onClick={() => toggleStatusRapido(j)}
                      title={inativo ? 'Reativar' : 'Marcar como inativo'}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                        inativo
                          ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                          : 'text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      {inativo ? (
                        // ↻ reativar
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3.5 h-3.5">
                          <path d="M3 12a9 9 0 0 1 15-6.7M21 12a9 9 0 0 1-15 6.7M16 5h5V0M8 19H3v5" />
                        </svg>
                      ) : (
                        // → inativar (seta saída)
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3.5 h-3.5">
                          <path d="M9 12h12m0 0-3-3m3 3-3 3M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => setPendingDeleteId(j.id)}
                      title="Remover permanentemente"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3.5 h-3.5">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
            {!loading && lista.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-500 dark:text-slate-500 text-sm">
                {busca || statusFiltro !== 'todos'
                  ? 'Nenhum jogador corresponde aos filtros.'
                  : 'Nenhum jogador cadastrado.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
