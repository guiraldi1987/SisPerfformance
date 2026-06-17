import React, { useState } from 'react';
import { API_BASE } from '../lib/api';

interface PlayerAvatarProps {
  fotoUrl: string | null;
  nome: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  fotoUrl,
  nome,
  size = 'md',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  // Calcula a URL absoluta da foto a partir do endpoint do backend
  const getAbsoluteUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const host = API_BASE.replace(/\/api$/, '');
    return `${host}${path}`;
  };

  const resolvedUrl = fotoUrl && !hasError ? getAbsoluteUrl(fotoUrl) : null;
  const inicial = nome.trim() ? nome.trim().charAt(0).toUpperCase() : '?';

  // Classes de tamanho consistentes com Tailwind CSS
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl font-extrabold border-2',
  };

  return (
    <div
      className={`relative shrink-0 rounded-full flex items-center justify-center font-bold overflow-hidden shadow-inner select-none transition-all duration-300 border border-slate-200 dark:border-white/10 ${
        sizeClasses[size]
      } ${
        resolvedUrl
          ? 'bg-slate-100 dark:bg-input'
          : 'bg-gradient-to-br from-indigo-500/20 to-purple-600/30 text-indigo-700 dark:text-indigo-300 border-indigo-200/50 dark:border-indigo-500/20 shadow-[0_2px_10px_rgba(99,102,241,0.1)]'
      } ${className}`}
    >
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={nome}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        />
      ) : (
        <span>{inicial}</span>
      )}
    </div>
  );
};
