import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { jogadores, metricas, sessoes } from '../db/schema';

const jogadoresRouter = new Hono();

// LIST
jogadoresRouter.get('/', async (c) => {
  const lista = await db.select().from(jogadores).orderBy(jogadores.nomeCompleto);
  return c.json(lista);
});

// PERFORMANCE — histórico de sessões do jogador
jogadoresRouter.get('/:id/performance', async (c) => {
  const id = Number(c.req.param('id'));
  const tipo = c.req.query('tipo'); // 'Treino' | 'Jogo' | undefined = todos

  const [jogador] = await db.select().from(jogadores).where(eq(jogadores.id, id));
  if (!jogador) return c.json({ error: 'Jogador não encontrado.' }, 404);

  // Busca todas as métricas do jogador no período 'Session'
  const rows = await db
    .select({
      metricaId:        metricas.id,
      periodo:          metricas.periodo,
      duracao:          metricas.duracao,
      distanciaTotal:   metricas.distanciaTotal,
      velocidadeMaxima: metricas.velocidadeMaxima,
      hsr:              metricas.hsr,
      sprint:           metricas.sprint,
      aceleracoes:      metricas.aceleracoes,
      desaceleracoes:   metricas.desaceleracoes,
      sessaoId:         sessoes.id,
      sessaoData:       sessoes.data,
      sessaoTipo:       sessoes.tipo,
      sessaoDescricao:  sessoes.descricao,
    })
    .from(metricas)
    .innerJoin(sessoes, eq(metricas.sessaoId, sessoes.id))
    .where(eq(metricas.jogadorId, id))
    .orderBy(desc(sessoes.data));

  // Filtra por tipo se fornecido
  const filtradas = tipo
    ? rows.filter(r => r.sessaoTipo?.toLowerCase() === tipo.toLowerCase())
    : rows;

  // Agrupa por sessão, mantendo todos os períodos disponíveis
  const sessaoMap = new Map<number, {
    id: number; data: string; tipo: string; descricao: string | null;
    periodos: Record<string, typeof filtradas[0]>;
  }>();

  for (const r of filtradas) {
    if (!sessaoMap.has(r.sessaoId)) {
      sessaoMap.set(r.sessaoId, {
        id: r.sessaoId, data: r.sessaoData, tipo: r.sessaoTipo,
        descricao: r.sessaoDescricao, periodos: {},
      });
    }
    sessaoMap.get(r.sessaoId)!.periodos[r.periodo] = r;
  }

  return c.json({
    jogador,
    sessoes: Array.from(sessaoMap.values()),
  });
});

// READ
jogadoresRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const [jogador] = await db.select().from(jogadores).where(eq(jogadores.id, id));
  if (!jogador) return c.json({ error: 'Jogador não encontrado.' }, 404);
  return c.json(jogador);
});

// CREATE
jogadoresRouter.post('/', async (c) => {
  const body = await c.req.json<{
    nomeCompleto: string;
    apelido?: string;
    posicao?: string;
    codigoCsv: string;
    fotoUrl?: string;
  }>();

  if (!body.nomeCompleto || !body.codigoCsv) {
    return c.json({ error: 'nomeCompleto e codigoCsv são obrigatórios.' }, 400);
  }

  try {
    const [novo] = await db.insert(jogadores).values(body).returning();
    return c.json(novo, 201);
  } catch (e: any) {
    if (e?.code === '23505' || String(e).includes('UNIQUE')) {
      return c.json({ error: 'codigoCsv já cadastrado.' }, 409);
    }
    throw e;
  }
});

// UPDATE
jogadoresRouter.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Partial<{
    nomeCompleto: string;
    apelido: string;
    posicao: string;
    codigoCsv: string;
    fotoUrl: string;
  }>>();

  const [atualizado] = await db.update(jogadores).set(body).where(eq(jogadores.id, id)).returning();
  if (!atualizado) return c.json({ error: 'Jogador não encontrado.' }, 404);
  return c.json(atualizado);
});

// DELETE
jogadoresRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const [removido] = await db.delete(jogadores).where(eq(jogadores.id, id)).returning();
  if (!removido) return c.json({ error: 'Jogador não encontrado.' }, 404);
  return c.json({ message: 'Jogador removido.', jogador: removido });
});

export default jogadoresRouter;
