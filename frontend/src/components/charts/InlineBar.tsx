import React from 'react';

interface InlineBarProps {
  value: number;
  max: number;
  color?: string;
}

export const InlineBar: React.FC<InlineBarProps> = ({ value, max, color = '#94a3b8' }) => {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums w-10 text-right text-slate-700 dark:text-slate-300">{value}</span>
      <div className="h-2.5 w-14 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};
