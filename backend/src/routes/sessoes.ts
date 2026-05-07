import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { sessoes, metricas, jogadores } from '../db/schema';

const sessoesRouter = new Hono();

// GET /api/sessoes — lista todas as sessões ordenadas pela mais recente
sessoesRouter.get('/', async (c) => {
  const lista = await db.select().from(sessoes).orderBy(desc(sessoes.data));
  return c.json(lista);
});

// GET /api/sessoes/:id — detalhe da sessão com os períodos disponíveis
sessoesRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const [sessao] = await db.select().from(sessoes).where(eq(sessoes.id, id));
  if (!sessao) return c.json({ error: 'Sessão não encontrada.' }, 404);

  // Busca períodos únicos disponíveis para esta sessão
  const rows = await db
    .selectDistinct({ periodo: metricas.periodo })
    .from(metricas)
    .where(eq(metricas.sessaoId, id));

  const periodos = rows.map(r => r.periodo);
  return c.json({ ...sessao, periodos });
});

// GET /api/sessoes/:id/metricas?periodo=Session
sessoesRouter.get('/:id/metricas', async (c) => {
  const id = Number(c.req.param('id'));
  const periodo = c.req.query('periodo') ?? 'Session';

  const rows = await db
    .select({
      id:              metricas.id,
      periodo:         metricas.periodo,
      duracao:         metricas.duracao,
      distanciaTotal:  metricas.distanciaTotal,
      velocidadeMaxima: metricas.velocidadeMaxima,
      hsr:             metricas.hsr,
      sprint:          metricas.sprint,
      aceleracoes:     metricas.aceleracoes,
      desaceleracoes:  metricas.desaceleracoes,
      // Dados do jogador
      jogadorId:       jogadores.id,
      nome:            jogadores.nomeCompleto,
      apelido:         jogadores.apelido,
      posicao:         jogadores.posicao,
    })
    .from(metricas)
    .innerJoin(jogadores, eq(metricas.jogadorId, jogadores.id))
    .where(eq(metricas.sessaoId, id));

  // Filtra pelo período solicitado (case-insensitive)
  const filtradas = rows.filter(
    r => r.periodo?.toLowerCase() === periodo.toLowerCase()
  );

  return c.json(filtradas);
});

// DELETE /api/sessoes/:id — remove sessão e suas métricas
sessoesRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await db.delete(metricas).where(eq(metricas.sessaoId, id));
  const [removida] = await db.delete(sessoes).where(eq(sessoes.id, id)).returning();
  if (!removida) return c.json({ error: 'Sessão não encontrada.' }, 404);
  return c.json({ message: 'Sessão removida.', sessao: removida });
});

export default sessoesRouter;
