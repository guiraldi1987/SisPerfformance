import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState<string | null>(null);

  const next = params.get('next') || '/painel';

  // Se já estiver logado, manda direto pro destino
  useEffect(() => {
    if (isAuthenticated) navigate(next, { replace: true });
  }, [isAuthenticated, navigate, next]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErro(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate(next, { replace: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 relative overflow-hidden transition-colors duration-300">
      
      {/* Decorative Blur Background (Mesh Gradient) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-club-red/10 dark:bg-club-red/[0.07] blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-amber-500/10 dark:bg-amber-500/[0.04] blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[25vw] h-[25vw] rounded-full bg-club-red/5 dark:bg-club-red/[0.03] blur-[80px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        
        {/* Logo + Título */}
        <div className="flex flex-col items-center mb-8 card-bounce">
          <div className="relative p-1.5 rounded-full bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.06] shadow-md dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] mb-4">
            <picture>
              <source srcSet="/paulista-logo.webp" type="image/webp" />
              <img src="/paulista-logo.png" alt="Paulista FC" className="w-20 h-20 object-contain" />
            </picture>
            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-club-red to-club-gold opacity-10 blur-sm -z-10" />
          </div>
          
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight font-outfit">
            Paulista FC
          </h1>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-club-red inline-block" />
            Departamento de Performance
            <span className="w-1.5 h-1.5 rounded-full bg-club-red inline-block" />
          </p>
        </div>

        {/* Card de login em Glassmorphism */}
        <form
          onSubmit={onSubmit}
          className="glass-panel rounded-2xl p-8 shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 relative overflow-hidden group"
        >
          {/* Luz sutil de destaque no topo */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-club-red via-club-gold to-club-red opacity-70" />

          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1 font-outfit">
            Entrar no sistema
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            Use suas credenciais autorizadas para acessar o painel analítico do clube.
          </p>

          {/* Campo de Usuário */}
          <label className="block mb-4">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 block">
              Usuário
            </span>
            <div className="relative">
              <input
                type="text"
                autoComplete="username"
                autoFocus
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-input border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-club-red/20 focus:border-club-red transition-all duration-200"
                placeholder="seu.usuario"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            </div>
          </label>

          {/* Campo de Senha */}
          <label className="block mb-6">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 block">
              Senha
            </span>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-4 pr-20 py-2.5 text-sm bg-input border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-club-red/20 focus:border-club-red transition-all duration-200"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPwd}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500 hover:text-club-red px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 uppercase tracking-widest transition-colors duration-200"
              >
                {showPwd ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          {erro && (
            <div role="alert" className="mb-5 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-all card-bounce flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4 shrink-0">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span>{erro}</span>
            </div>
          )}

          {/* Botão de Entrar */}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-club-red to-[#e52e2e] text-white text-xs font-bold uppercase tracking-wider font-outfit shadow-md hover:shadow-[0_6px_24px_rgba(204,30,30,0.35)] hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Autenticando…</span>
              </>
            ) : (
              <>
                <span>Acessar Painel</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="text-[10px] text-center text-slate-500 dark:text-slate-500 mt-6 leading-relaxed flex items-center justify-center gap-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Acesso Restrito Paulista FC · ApexPRO
        </p>
      </div>
    </div>
  );
};
