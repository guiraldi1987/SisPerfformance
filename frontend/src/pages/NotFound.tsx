import { useNavigate, useLocation } from 'react-router-dom';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#111111] p-6">
      <div className="max-w-md w-full bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-8 text-center shadow-xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-club-red/10 border border-club-red/20 flex items-center justify-center">
          <span className="text-3xl font-extrabold text-club-red">404</span>
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">Página não encontrada</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
          A rota
          <code className="mx-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-club-red text-xs font-mono">
            {location.pathname}
          </code>
          não existe.
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
          Verifique se o link está correto ou volte ao painel principal.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            ← Voltar
          </button>
          <button
            onClick={() => navigate('/painel')}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-club-red text-white hover:opacity-90 accent-glow transition-opacity"
          >
            Ir para o Painel
          </button>
        </div>
      </div>
    </div>
  );
};
