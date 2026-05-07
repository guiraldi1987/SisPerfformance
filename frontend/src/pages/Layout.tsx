import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../theme';
import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import { formatData } from '../lib/format';
import { ConfirmModal } from '../components/ConfirmModal';

interface Sessao {
  id: number;
  data: string;
  tipo: string;
}

const Icon = {
  Dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  Players: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.4 3.5-5 6.5-5s5.7 1.6 6.5 5" />
      <circle cx="17" cy="9" r="2.5" /><path d="M16 14.5c2.6.2 4.5 1.7 5 4" />
    </svg>
  ),
  Chart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0">
      <path d="M3 20h18M5 20V14M9 20V8M13 20V11M17 20V4" />
    </svg>
  ),
  Upload: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0">
      <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5 shrink-0">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  Sun: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  Moon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  ),
};

export const Layout: React.FC = () => {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const params = useParams();
  const sessaoAtiva = params.id ? Number(params.id) : null;

  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [loadingSessoes, setLoadingSessoes] = useState(true);
  const [apiOnline, setApiOnline] = useState(true);

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const carregarSessoes = async () => {
    setLoadingSessoes(true);
    try {
      const res = await fetch(`${API_BASE}/sessoes`);
      if (res.ok) {
        setSessoes(await res.json());
        setApiOnline(true);
      }
    } catch {
      setApiOnline(false);
    } finally {
      setLoadingSessoes(false);
    }
  };

  useEffect(() => { carregarSessoes(); }, []);

  const confirmarRemocao = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const executarRemocao = async () => {
    if (pendingDeleteId === null) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    await fetch(`${API_BASE}/sessoes/${id}`, { method: 'DELETE' });
    setSessoes(prev => prev.filter(s => s.id !== id));
    if (sessaoAtiva === id) navigate('/upload');
  };

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? 'bg-club-red text-white accent-glow'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5'
    }`;

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-[#111111]">

      <ConfirmModal
        open={pendingDeleteId !== null}
        message="Remover esta sessão e todas as suas métricas?"
        onConfirm={executarRemocao}
        onCancel={() => setPendingDeleteId(null)}
      />

      {/* ── SIDEBAR ── */}
      <aside className="w-60 shrink-0 flex flex-col bg-white dark:bg-[#0a0a0a] border-r border-slate-200 dark:border-white/[0.06]">

        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06]">
          <picture>
            <source srcSet="/paulista-logo.webp" type="image/webp" />
            <img src="/paulista-logo.png" alt="Paulista FC logo" className="w-11 h-11 object-contain" />
          </picture>
          <div>
            <p className="text-[13px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">Paulista FC</p>
            <p className="text-[10px] tracking-widest uppercase text-slate-400 dark:text-slate-500 mt-0.5">Performance</p>
          </div>
        </div>

        {/* Sessões */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 pt-4 pb-2">
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-600">Sessões</p>
              <NavLink
                to="/upload"
                className="text-[10px] font-bold text-club-red hover:underline tracking-wide"
              >
                + Nova
              </NavLink>
            </div>

            {loadingSessoes && (
              <p className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-600">Carregando…</p>
            )}

            {!loadingSessoes && sessoes.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-600 leading-relaxed">
                Nenhuma sessão.<br />Faça um upload para começar.
              </p>
            )}

            <div className="space-y-0.5">
              {sessoes.map(s => (
                <NavLink
                  key={s.id}
                  to={`/sessao/${s.id}`}
                  className={({ isActive }) =>
                    `group flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                      isActive
                        ? 'bg-club-red text-white accent-glow'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
                    }`
                  }
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon.Calendar />
                    <span className="truncate">
                      <span className="font-semibold">{formatData(s.data)}</span>
                      <span className="ml-1.5 opacity-70">{s.tipo}</span>
                    </span>
                  </span>
                  <button
                    onClick={(e) => confirmarRemocao(e, s.id)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ml-1 shrink-0"
                    aria-label="Remover sessão"
                  >
                    <Icon.Trash />
                  </button>
                </NavLink>
              ))}
            </div>
          </div>

          {/* Config */}
          <div className="px-3 pt-2 pb-2">
            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-600 px-3 mb-2">Configuração</p>
            <nav className="space-y-0.5">
              <NavLink to="/jogadores" className={navCls}><Icon.Players /> Elenco</NavLink>
              <NavLink to="/upload"    className={navCls}><Icon.Upload /> Upload GPS</NavLink>
            </nav>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 pb-4 pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-1">
          <button
            onClick={toggle}
            aria-label="Alternar tema"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
            {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </button>
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[11px] text-slate-400 dark:text-slate-600">API</span>
            <span className={`flex items-center gap-1.5 text-[11px] font-medium ${apiOnline ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${apiOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              {apiOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 min-w-0">
        <Outlet context={{ recarregarSessoes: carregarSessoes }} />
      </main>
    </div>
  );
};
