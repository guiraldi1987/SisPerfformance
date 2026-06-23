import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export const EmptyState = ({ title, description, icon, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6">
    {icon && <div className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-600">{icon}</div>}
    <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 font-outfit">{title}</h2>
    {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
