import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import uploadRouter from './routes/upload';
import jogadoresRouter from './routes/jogadores';
import sessoesRouter from './routes/sessoes';

const app = new Hono();

app.use('*', cors());

app.get('/', (c) => c.text('API de Performance Esportiva online!'));

app.route('/api', uploadRouter);
app.route('/api/jogadores', jogadoresRouter);
app.route('/api/sessoes', sessoesRouter);

const port = 3001;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
