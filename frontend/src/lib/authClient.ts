import { API_BASE } from './api';

// ──────────────────────────────────────────────────────────────────────────────
// Token storage
// ──────────────────────────────────────────────────────────────────────────────
// Guardamos token+user no localStorage. Persistência simples; trade-off é que
// é vulnerável a XSS — aceitável pra um MVP single-user em rede interna/cloud.
//
// Em produção real, mudar pra HttpOnly cookie + Secure + SameSite.
// ──────────────────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'auth_token';
const USER_KEY  = 'auth_user';
const EXP_KEY   = 'auth_expires_at';

export interface AuthUser {
  username: string;
  name: string;
  role: string;
}

export function getToken(): string | null {
  const t = localStorage.getItem(TOKEN_KEY);
  if (!t) return null;
  // Checa expiração local pra economizar uma round-trip ao backend
  const expStr = localStorage.getItem(EXP_KEY);
  if (expStr && Number(expStr) <= Date.now()) {
    clearAuth();
    return null;
  }
  return t;
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}

export function setAuth(token: string, user: AuthUser, expiresAt: number) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(EXP_KEY, String(expiresAt));
  // Notifica listeners no mesmo tab (storage event só dispara em outros tabs)
  window.dispatchEvent(new CustomEvent('auth-change'));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXP_KEY);
  window.dispatchEvent(new CustomEvent('auth-change'));
}

// ──────────────────────────────────────────────────────────────────────────────
// Fetch interceptor — injeta Authorization em chamadas à API_BASE e trata 401
// ──────────────────────────────────────────────────────────────────────────────
// Patch global em window.fetch evita refatorar as 18 chamadas espalhadas pelo
// app. Só toca em URLs que apontam pra API_BASE; o resto passa intocado.

let installed = false;
export function installFetchInterceptor() {
  if (installed) return;
  installed = true;

  const original = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL    ? input.href
      :                            input.url;

    const isApi = url.startsWith(API_BASE);

    if (isApi) {
      const token = getToken();
      if (token) {
        const headers = new Headers(init?.headers ?? {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init = { ...(init ?? {}), headers };
      }
    }

    const res = await original(input, init);

    // Token expirou ou foi invalidado server-side → derruba sessão.
    // Não derruba se a URL não for da API (ex: WebSocket, CDN etc).
    // E ignora /auth/login pra não criar loop quando a senha estiver errada.
    if (isApi && res.status === 401 && !url.endsWith('/auth/login')) {
      clearAuth();
      if (!window.location.pathname.startsWith('/login')) {
        // Preserva pra onde o usuário queria ir
        const redirect = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(redirect)}`;
      }
    }

    return res;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Operações de auth
// ──────────────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ erro: 'Falha no login' }));
    throw new Error((data as { erro?: string }).erro ?? 'Falha no login');
  }
  const { token, user, expiresAt } = await res.json() as {
    token: string; user: AuthUser; expiresAt: number;
  };
  setAuth(token, user, expiresAt);
  return user;
}

export function logout() {
  clearAuth();
}
