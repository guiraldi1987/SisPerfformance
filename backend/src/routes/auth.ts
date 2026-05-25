import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';
import { db } from '../db';
import { usuarios } from '../db/schema';
import { eq } from 'drizzle-orm';

const auth = new Hono();

// Variáveis de ambiente como fallback
const FALLBACK_USERNAME      = process.env.AUTH_USERNAME;
const FALLBACK_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH;
const FALLBACK_USER_NAME     = process.env.AUTH_USER_NAME ?? FALLBACK_USERNAME ?? '';
const FALLBACK_USER_ROLE     = process.env.AUTH_USER_ROLE ?? 'Preparador Físico';
const JWT_SECRET             = process.env.JWT_SECRET;
const EXPIRES_HOURS          = Number(process.env.JWT_EXPIRES_IN_HOURS ?? 12);

if (!JWT_SECRET) {
  console.error('[auth] JWT_SECRET ausente no arquivo backend/.env');
}

// POST /api/login — autentica usuário/senha e devolve JWT
auth.post('/login', async (c) => {
  if (!JWT_SECRET) {
    return c.json({ erro: 'Servidor sem chave secreta JWT configurada' }, 500);
  }

  let body: { username?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ erro: 'Corpo JSON inválido' }, 400);
  }

  const { username, password } = body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return c.json({ erro: 'Informe username e password' }, 400);
  }

  const inputUsername = username.trim().toLowerCase();

  let userSub = '';
  let userName = '';
  let userRole = '';
  let isAuthenticated = false;

  try {
    // 1. Tentar autenticação no Banco de Dados
    const [dbUser] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.username, inputUsername));

    if (dbUser && dbUser.status === 'ativo') {
      const passOk = await bcrypt.compare(password, dbUser.passwordHash);
      if (passOk) {
        userSub = dbUser.username;
        userName = dbUser.name;
        userRole = dbUser.role;
        isAuthenticated = true;
      }
    }
  } catch (err) {
    console.error('[auth] Erro ao buscar usuário no banco de dados, tentando fallback...', err);
  }

  // 2. Fallback seguro nas variáveis do .env caso não tenha autenticado no banco
  if (!isAuthenticated && FALLBACK_USERNAME && FALLBACK_PASSWORD_HASH) {
    const isFallbackUser = inputUsername === FALLBACK_USERNAME.toLowerCase();
    const isFallbackPass = await bcrypt.compare(password, FALLBACK_PASSWORD_HASH);

    if (isFallbackUser && isFallbackPass) {
      userSub = FALLBACK_USERNAME;
      userName = FALLBACK_USER_NAME;
      userRole = FALLBACK_USER_ROLE;
      isAuthenticated = true;
      console.log('[auth] Login efetuado com sucesso via credenciais de fallback (.env)');
    }
  }

  // Mensagem genérica se falhar em ambos os métodos
  if (!isAuthenticated) {
    return c.json({ erro: 'Usuário ou senha incorretos' }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + EXPIRES_HOURS * 3600;
  const token = await sign(
    { sub: userSub, name: userName, role: userRole, iat: now, exp },
    JWT_SECRET,
  );

  return c.json({
    token,
    expiresAt: exp * 1000,
    user: { username: userSub, name: userName, role: userRole },
  });
});

// GET /api/me — valida o token corrente e devolve o usuário
auth.get('/me', (c) => {
  // O middleware JWT já validou o token, ecoamos as informações do payload
  const payload = c.get('jwtPayload') as { sub?: string; name?: string; role?: string } | undefined;
  if (!payload?.sub) return c.json({ erro: 'Sem sessão' }, 401);
  return c.json({
    user: { username: payload.sub, name: payload.name ?? '', role: payload.role ?? '' },
  });
});

export default auth;
