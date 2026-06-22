import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastCtx {
  push: (kind: ToastKind, message: string) => void;
  /** Atalhos comuns */
  success: (message: string) => void;
  error:   (message: string) => void;
  info:    (message: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return v;
}

// ─── Provider ────────────────────────────────────────────────────────────────

const DURATION_MS = 3500;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, kind, message }]);
    // Auto-dismiss
    setTimeout(() => remove(id), DURATION_MS);
  }, [remove]);

  const value: ToastCtx = {
    push,
    success: (m) => push('success', m),
    error:   (m) => push('error',   m),
    info:    (m) => push('info',    m),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none print:hidden">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />)}
      </div>
    </Ctx.Provider>
  );
};

// ─── Item ────────────────────────────────────────────────────────────────────

const ToastItem: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(t);
  }, []);

  const palette = toast.kind === 'success'
    ? { bg: 'bg-emerald-600', icon: '✓' }
    : toast.kind === 'error'
    ? { bg: 'bg-rose-600',    icon: '✕' }
    : { bg: 'bg-indigo-600',  icon: 'i' };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 min-w-[260px] max-w-md px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-semibold transition-all duration-200 ${palette.bg} ${
        entered ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
      }`}
    >
      <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold shrink-0">
        {palette.icon}
      </span>
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} aria-label="Fechar"
        className="opacity-70 hover:opacity-100 text-white/90 text-base shrink-0">
        ✕
      </button>
    </div>
  );
};
