interface LoadingStateProps {
  label?: string;
}

export const LoadingState = ({ label = 'Carregando…' }: LoadingStateProps) => (
  <div className="p-6 space-y-6 max-w-[1600px] mx-auto" aria-busy="true" aria-live="polite">
    <span className="sr-only">{label}</span>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />
      ))}
    </div>
    <div className="h-64 rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />
    <div className="h-64 rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />
  </div>
);

export default LoadingState;
