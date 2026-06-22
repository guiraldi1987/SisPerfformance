import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const TITLES: Record<string, string> = {
  '/painel': 'Painel do Time',
  '/sessoes': 'Sessões',
  '/comparar': 'Comparar Jogadores',
  '/jogadores': 'Elenco',
  '/upload': 'Upload de GPS',
  '/usuarios': 'Usuários',
  '/backups': 'Backups',
  '/login': 'Login',
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/sessao/')) return 'Relatório da sessão';
  if (pathname.startsWith('/jogador/')) return 'Perfil do jogador';
  return 'ApexPRO';
}

export const RouteAnnouncer: React.FC = () => {
  const { pathname } = useLocation();
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setMsg(`${titleFor(pathname)} — página carregada`);
  }, [pathname]);
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">{msg}</div>
  );
};
