import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTheme } from '../theme';
import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import { useAuth } from '../components/AuthProvider';

const Icon = {
  Dashboard: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  Players: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.4 3.5-5 6.5-5s5.7 1.6 6.5 5" />
      <circle cx="17" cy="9" r="2.5" /><path d="M16 14.5c2.6.2 4.5 1.7 5 4" />
    </svg>
  ),
  Users: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Upload: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110">
      <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  ),
  Calendar: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  Compare: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110">
      <path d="M16 3h5v5M8 3H3v5M21 3l-7 7M3 3l7 7M16 21h5v-5M8 21H3v-5M21 21l-7-7M3 21l7-7" />
    </svg>
  ),
  Backup: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  ),
  Sun: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 rotate-0 transition-transform duration-500 hover:rotate-90">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  Moon: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 rotate-0 transition-transform duration-500 hover:-rotate-12">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
};

export const Layout: React.FC = () => {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [apiOnline, setApiOnline] = useState(true);
  const [pinging, setPinging]     = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Iniciais do usuário pro avatar (ex: "Eduardo Luiz Tavares" → "EL")
  const iniciais = (user?.name || user?.username || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '').join('') || '?';

  // Ping leve da API
  const pingApi = async () => {
    setPinging(true);
    try {
      const res = await fetch(`${API_BASE}/sessoes`, { signal: AbortSignal.timeout(5000) });
      setApiOnline(res.ok);
    } catch {
      setApiOnline(false);
    } finally {
      setPinging(false);
    }
  };

  useEffect(() => {
    pingApi();
    const id = setInterval(pingApi, 30_000);
    return () => clearInterval(id);
  }, []);

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider font-outfit transition-all duration-300 group ${
      isActive
        ? 'bg-gradient-to-r from-club-red to-[#e52e2e] text-white shadow-[0_4px_20px_rgba(204,30,30,0.25)] dark:shadow-[0_4px_20px_rgba(204,30,30,0.35)] scale-[1.02]'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.03]'
    }`;

  return (
    <div className="min-h-screen flex bg-surface transition-colors duration-300">

      {/* ── SIDEBAR ── */}
      <aside aria-label="Barra lateral" className="w-64 shrink-0 flex flex-col bg-card border-r border-slate-200/50 dark:border-white/[0.04] transition-colors duration-300 relative z-20">

        {/* Logo Club */}
        <div className="px-6 py-6 flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.04]">
          <div className="relative p-1 rounded-full bg-white dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] shadow-sm">
            <picture>
              <source srcSet="/paulista-logo.webp" type="image/webp" />
              <img src="/paulista-logo.png" alt="Paulista FC logo" className="w-10 h-10 object-contain" />
            </picture>
            <div className="absolute -inset-0.5 rounded-full bg-club-red opacity-10 blur-[2px] -z-10" />
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight text-slate-850 dark:text-white font-outfit leading-none">
              Paulista FC
            </p>
            <p className="text-[9px] font-extrabold tracking-widest uppercase text-club-red mt-1">
              Performance
            </p>
          </div>
        </div>

        {/* Navegação principal */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-7">
          
          <div className="space-y-1.5">
            <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500 dark:text-slate-600 px-3.5 mb-2.5">
              Análise Tática
            </p>
            <nav aria-label="Análise tática" className="space-y-1">
              <NavLink to="/painel"    className={navCls}><Icon.Dashboard /> Painel do Time</NavLink>
              <NavLink to="/sessoes"   className={navCls}><Icon.Calendar />  Sessões</NavLink>
              <NavLink to="/comparar"  className={navCls}><Icon.Compare />   Comparar</NavLink>
            </nav>
          </div>

          <div className="space-y-1.5">
            <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500 dark:text-slate-600 px-3.5 mb-2.5">
              Administração
            </p>
            <nav aria-label="Administração" className="space-y-1">
              <NavLink to="/jogadores" className={navCls}><Icon.Players /> Elenco</NavLink>
              <NavLink to="/upload"    className={navCls}><Icon.Upload />  Upload GPS</NavLink>
              <NavLink to="/usuarios"  className={navCls}><Icon.Users />   Usuários</NavLink>
              <NavLink to="/backups"   className={navCls}><Icon.Backup />  Backups</NavLink>
            </nav>
          </div>
        </div>

        {/* Footer Sidebar */}
        <div className="px-4 pb-6 pt-4 border-t border-slate-100 dark:border-white/[0.04] space-y-3">
          
          {/* Bloco do usuário logado em Glassmorphism */}
          {user && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-club-red/10 flex items-center justify-center text-xs font-bold text-club-red shrink-0 border border-club-red/20 font-outfit">
                    {iniciais}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0b0f16]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate font-outfit">
                    {user.name || user.username}
                  </p>
                  {user.role && (
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500 truncate mt-0.5">
                      {user.role}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full mt-2.5 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 uppercase tracking-widest transition-all duration-200"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                Sair do sistema
              </button>
            </div>
          )}

          {/* Alternador de tema */}
          <button
            onClick={toggle}
            aria-label="Alternar tema"
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-colors duration-200"
          >
            {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
            <span className="font-outfit">{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>
          </button>

          {/* API Status Chip */}
          <div className="flex items-center justify-between px-3.5 py-1 bg-slate-50 dark:bg-white/[0.01] rounded-lg border border-slate-200/30 dark:border-white/[0.02]">
            <span className="text-[9px] font-extrabold tracking-widest text-slate-500 dark:text-slate-600">CONEXÃO API</span>
            <div className="flex items-center gap-2">
              {!apiOnline && (
                <button
                  onClick={pingApi}
                  disabled={pinging}
                  aria-label="Tentar reconectar com a API"
                  className="text-[9px] font-extrabold text-club-red hover:underline disabled:opacity-50 uppercase tracking-wider"
                >
                  {pinging ? '…' : 'Tentar'}
                </button>
              )}
              <span className={`flex items-center gap-1 text-[10px] font-extrabold uppercase ${apiOnline ? 'text-emerald-500' : 'text-red-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${apiOnline ? 'bg-emerald-500 animate-pulse neon-glow-green' : 'bg-red-500'}`} />
                {apiOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 min-w-0 relative z-10 overflow-y-auto max-h-screen">
        <div className="animate-fade-in duration-300">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
