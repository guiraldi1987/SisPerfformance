import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import uploadRouter from './routes/upload';
import jogadoresRouter from './routes/jogadores';
import sessoesRouter from './routes/sessoes';
import analyticsRouter from './routes/analytics';
import authRouter from './routes/auth';
import usuariosRouter from './routes/usuarios';

const app = new Hono();

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
const JWT_SECRET  = process.env.JWT_SECRET ?? '';

app.use('*', cors({
  origin: CORS_ORIGIN,
  // Necessário pro frontend mandar `Authorization` em pré-flights.
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Servir arquivos estáticos do diretório /uploads antes do middleware JWT
app.use('/uploads/*', serveStatic({ root: './' }));

app.get('/', (c) => c.text('API de Performance Esportiva online!'));

// Rotas públicas (login) ────────────────────────────────────────────────
app.route('/api/auth', authRouter);

// Middleware JWT — protege TUDO em /api exceto /api/auth/login.
// Lê `Authorization: Bearer <token>` e popula `c.get('jwtPayload')`.
// O bloco `/api/auth/login` já passou antes (rota acima); /api/auth/me
// precisa do middleware, então cobrimos tudo em /api/* aqui.
app.use('/api/*', async (c, next) => {
  // Permite o login sem token. Tudo o mais exige.
  if (c.req.path === '/api/auth/login') return next();
  if (!JWT_SECRET) return c.json({ erro: 'Servidor mal configurado' }, 500);
  return jwt({ secret: JWT_SECRET, alg: 'HS256' })(c, next);
});

app.route('/api', uploadRouter);
app.route('/api/jogadores', jogadoresRouter);
app.route('/api/sessoes', sessoesRouter);
app.route('/api/analytics', analyticsRouter);
app.route('/api/usuarios', usuariosRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});

