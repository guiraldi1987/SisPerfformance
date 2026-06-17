import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../lib/api';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { useAuth } from '../components/AuthProvider';
import { formatData } from '../lib/format';

interface Usuario {
  id: number;
  username: string;
  name: string;
  role: string;
  status: 'ativo' | 'inativo';
  createdAt: string;
}

const API = `${API_BASE}/usuarios`;

const ROLES = [
  'Preparador Físico',
  'Fisiologista',
  'Treinador',
  'Fisioterapeuta',
  'Médico',
  'Diretoria',
  'Auxiliar Técnico',
];

export const Usuarios: React.FC = () => {
  const toast = useToast();
  const { user: loggedInUser } = useAuth();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modais de Criação e Edição unificados ou separados
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Formulário
  const [form, setForm] = useState({
    username: '',
    name: '',
    password: '',
    confirmPassword: '',
    role: 'Preparador Físico',
    status: 'ativo' as 'ativo' | 'inativo',
  });

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error('Falha ao buscar usuários');
      setUsuarios(await res.json());
      setErro(null);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const listagemFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  }, [usuarios, busca]);

  const abrirNovo = () => {
    setEditingUser(null);
    setForm({
      username: '',
      name: '',
      password: '',
      confirmPassword: '',
      role: 'Preparador Físico',
      status: 'ativo',
    });
    setModalOpen(true);
  };

  const abrirEdicao = (u: Usuario) => {
    setEditingUser(u);
    setForm({
      username: u.username,
      name: u.name,
      password: '',
      confirmPassword: '',
      role: u.role,
      status: u.status,
    });
    setModalOpen(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('O nome completo é obrigatório');
      return;
    }
    if (!editingUser && !form.username.trim()) {
      toast.error('O nome de usuário é obrigatório');
      return;
    }

    // Validação de senhas
    if (!editingUser) {
      if (!form.password) {
        toast.error('A senha é obrigatória para novos usuários');
        return;
      }
      if (form.password.length < 6) {
        toast.error('A senha deve ter no mínimo 6 caracteres');
        return;
      }
    }

    if (form.password && form.password !== form.confirmPassword) {
      toast.error('As senhas digitadas não coincidem');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        // Impedir auto-inativação crítica
        if (
          form.status === 'inativo' &&
          loggedInUser?.username.toLowerCase() === editingUser.username.toLowerCase()
        ) {
          toast.error('Você não pode inativar a sua própria conta ativa em uso');
          setSaving(false);
          return;
        }

        // Editar
        const payload: Record<string, any> = {
          name: form.name,
          role: form.role,
          status: form.status,
        };
        if (form.password) {
          payload.password = form.password;
        }

        const res = await fetch(`${API}/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          toast.success('Usuário atualizado com sucesso');
          setModalOpen(false);
          carregar();
        } else {
          const errData = await res.json();
          toast.error(errData.erro || 'Falha ao atualizar usuário');
        }
      } else {
        // Criar novo
        const payload = {
          username: form.username,
          name: form.name,
          password: form.password,
          role: form.role,
        };

        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          toast.success('Novo profissional adicionado com sucesso');
          setModalOpen(false);
          carregar();
        } else {
          const errData = await res.json();
          toast.error(errData.erro || 'Falha ao criar usuário');
        }
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao processar requisição');
    } finally {
      setSaving(false);
    }
  };

  const executarExclusao = async () => {
    if (pendingDeleteId === null) return;
    const u = usuarios.find(x => x.id === pendingDeleteId);
    if (!u) return;

    if (loggedInUser && u.username.toLowerCase() === loggedInUser.username.toLowerCase()) {
      toast.error('Ação bloqueada: Não é possível excluir a sua própria conta ativa');
      setPendingDeleteId(null);
      return;
    }

    try {
      const res = await fetch(`${API}/${u.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`Usuário '${u.name}' excluído permanentemente`);
        carregar();
      } else {
        const errData = await res.json();
        toast.error(errData.erro || 'Falha ao excluir o usuário');
      }
    } catch (e: unknown) {
      toast.error('Erro de rede ao excluir usuário');
    } finally {
      setPendingDeleteId(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Preparador Físico':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
      case 'Fisiologista':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20';
      case 'Treinador':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
      case 'Fisioterapeuta':
      case 'Médico':
        return 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400 border-teal-200 dark:border-teal-500/20';
      case 'Diretoria':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
      default:
        return 'bg-slate-50 text-slate-700 dark:bg-white/5 dark:text-slate-300 border-slate-200 dark:border-white/10';
    }
  };

  const inputCls =
    'w-full border border-slate-300 dark:border-white/10 bg-input dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-club-red transition-colors';

  return (
    <div className="px-8 py-6">
      <ConfirmModal
        open={pendingDeleteId !== null}
        message="Deseja remover permanentemente este profissional do staff técnico? Ele perderá imediatamente qualquer permissão de login no sistema ApexPRO."
        details={(() => {
          const u = usuarios.find(x => x.id === pendingDeleteId);
          return u ? `${u.name} (@${u.username}) — ${u.role}` : undefined;
        })()}
        confirmLabel="Excluir Permanentemente"
        onConfirm={executarExclusao}
        onCancel={() => setPendingDeleteId(null)}
      />

      {/* MODAL CRIAÇÃO/EDIÇÃO */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-card border border-slate-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-white/[0.06]">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {editingUser ? 'Editar Profissional' : 'Novo Membro do Staff'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={salvar} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                  Nome Completo
                </label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Dr. Marcelo Silva"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                  Nome de Usuário (Login)
                </label>
                <input
                  type="text"
                  className={`${inputCls} disabled:opacity-50`}
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="Ex: marcelo.silva"
                  disabled={!!editingUser}
                  required
                />
                {editingUser && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    O nome de usuário identificador não pode ser modificado após a criação.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                  Função / Especialidade
                </label>
                <select
                  className={inputCls}
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {editingUser && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    Status da Conta
                  </label>
                  <div className="flex gap-2">
                    {(['ativo', 'inativo'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, status: s }))}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                          form.status === s
                            ? s === 'ativo'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/50'
                              : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700/50'
                            : 'bg-transparent text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-300'
                        }`}
                      >
                        {s === 'ativo' ? 'Ativo (Acesso Liberado)' : 'Inativo (Acesso Bloqueado)'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] space-y-3">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {editingUser ? 'Alterar Senha (Opcional)' : 'Definir Senha de Acesso'}
                </p>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    Senha
                  </label>
                  <input
                    type="password"
                    className={inputCls}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={editingUser ? '•••••• (deixe em branco para não alterar)' : 'Mínimo de 6 caracteres'}
                    required={!editingUser}
                  />
                </div>
                {form.password && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      Confirmar Senha
                    </label>
                    <input
                      type="password"
                      className={inputCls}
                      value={form.confirmPassword}
                      onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      placeholder="Repita a nova senha digitada"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50 shadow-lg shadow-indigo-600/25 transition-all"
                >
                  {saving ? 'Gravando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Gerenciamento do Staff Técnico
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Cadastre, edite e administre as contas de acesso dos profissionais da comissão técnica do Paulista FC.
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/25"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-3.5 h-3.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Adicionar Profissional
        </button>
      </div>

      {/* ESTATÍSTICA DO STAFF */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-slate-200 dark:border-white/5 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">
              Total de Profissionais
            </p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {usuarios.length}
            </p>
          </div>
        </div>

        <div className="bg-card border border-slate-200 dark:border-white/5 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">
              Contas Ativas
            </p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {usuarios.filter(u => u.status === 'ativo').length}
            </p>
          </div>
        </div>

        <div className="bg-card border border-slate-200 dark:border-white/5 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">
              Contas Inativas
            </p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {usuarios.filter(u => u.status === 'inativo').length}
            </p>
          </div>
        </div>
      </div>

      {/* FILTRO E BUSCA */}
      <div className="mb-4">
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, usuário ou especialidade técnica…"
          className={inputCls}
        />
      </div>

      {/* FEEDBACK DE ESTADO */}
      {erro && <p className="text-rose-500 text-sm mb-4">{erro}</p>}
      {loading && <p className="text-slate-500 dark:text-slate-400 text-sm">Carregando staff…</p>}

      {/* TABELA DE USUÁRIOS */}
      {!loading && (
        <div className="border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th scope="col" className="px-4 py-3.5 text-left">
                  Profissional / Login
                </th>
                <th scope="col" className="px-4 py-3.5 text-left">
                  Cargo / Função
                </th>
                <th scope="col" className="px-4 py-3.5 text-left">
                  Status
                </th>
                <th scope="col" className="px-4 py-3.5 text-left">
                  Membro Desde
                </th>
                <th scope="col" className="px-4 py-3.5 text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {listagemFiltrada.map(u => {
                const isMe = loggedInUser?.username.toLowerCase() === u.username.toLowerCase();
                const inativo = u.status === 'inativo';
                return (
                  <tr
                    key={u.id}
                    className={`hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors ${
                      inativo ? 'opacity-65' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center font-extrabold text-sm text-slate-700 dark:text-slate-200">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {u.name}
                            {isMe && (
                              <span className="text-[9px] font-extrabold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                Você
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            @{u.username}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border ${getRoleBadgeColor(
                          u.role
                        )}`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          inativo
                            ? 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            inativo ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'
                          }`}
                        />
                        {inativo ? 'Inativo' : 'Ativo'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {formatData(u.createdAt.slice(0, 10))}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => abrirEdicao(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-white/30 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3.5 h-3.5">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
                          </svg>
                          Editar
                        </button>
                        <button
                          onClick={() => setPendingDeleteId(u.id)}
                          disabled={isMe}
                          title={isMe ? 'Não é possível excluir o próprio usuário logado' : 'Excluir permanentemente'}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                            isMe
                              ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                              : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                          }`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {listagemFiltrada.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
                    {busca
                      ? 'Nenhum profissional encontrado para a busca especificada.'
                      : 'Nenhum profissional cadastrado.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
