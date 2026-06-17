import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export const PageHeader = ({ eyebrow, title, subtitle, actions }: PageHeaderProps) => (
  <header className="relative overflow-hidden bg-card border-b border-slate-200/50 dark:border-white/[0.04] px-8 py-6 transition-colors">
    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-club-red via-club-gold to-club-red" />
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div>
        <p className="text-[9px] font-extrabold uppercase tracking-widest text-club-red font-outfit mb-1">{eyebrow}</p>
        <h1 className="text-2xl font-extrabold text-slate-850 dark:text-white tracking-tight font-outfit">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  </header>
);

export default PageHeader;
