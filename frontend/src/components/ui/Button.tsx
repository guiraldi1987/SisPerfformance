import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'inline-flex items-center justify-center gap-2 font-bold font-outfit rounded-xl ' +
  'transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:pointer-events-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-red/50 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--surface-base)]';

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
};

const variants: Record<Variant, string> = {
  primary: 'bg-club-red text-white shadow-lg shadow-club-red/25 hover:brightness-110',
  ghost:
    'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 ' +
    'border border-slate-200/60 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10',
  danger: 'bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700',
};

export const Button = ({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) => (
  <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
);

export default Button;
