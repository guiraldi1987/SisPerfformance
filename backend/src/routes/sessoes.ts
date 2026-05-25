import { Hono } from 'hono';
import { eq, desc, and, ne } from 'drizzle-orm';
import { db } from '../db';
import { sessoes, metricas, jogadores } from '../db/schema';

const sessoesRouter = new Hono();

const PERIODOS_ORDER = ['Session', 'Aquecimento', '1º Tempo', '2º Tempo', 'Complemento'];

const periodoSort = (a: string, b: string) => {
  const ia = PERIODOS_ORDER.indexOf(a);
  const ib = PERIODOS_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
};

// GET /api/sessoes
sessoesRouter.get('/', async (c) => {
  const lista = await db.select().from(sessoes).orderBy(desc(sessoes.data));
  return c.json(lista);
});

// GET /api/sessoes/listagem — versão "rica" com stats agregados por sessão.
// Usada pela página de listagem inteligente; sidebar continua usando GET /.
// IMPORTANTE: deve vir ANTES de /:id senão o Hono interpreta "listagem" como id.
sessoesRouter.get('/listagem', async (c) => {
  const lista = await db.select().from(sessoes).orderBy(desc(sessoes.data));

  // Uma única query buscando todas as métricas Session — barato vs N+1 calls.
  const todasSessionMetricas = await db
    .select({
      sessaoId:       metricas.sessaoId,
      duracao:        metricas.duracao,
      distanciaTotal: metricas.distanciaTotal,
      cargaJogador:   metricas.cargaJogador,
    })
    .from(metricas)
    .where(eq(metricas.periodo, 'Session'));

  const porSessao = new Map<number, typeof todasSessionMetricas>();
  for (const r of todasSessionMetricas) {
    if (!porSessao.has(r.sessaoId)) porSessao.set(r.sessaoId, []);
    porSessao.get(r.sessaoId)!.push(r);
  }

  const n = (v: number | null | undefined) => v ?? 0;

  const enriquecida = lista.map((s: any) => {
    const rows = porSessao.get(s.id) ?? [];
    const validas = rows.filter((r: any) => n(r.distanciaTotal) > 0);
    const c = validas.length;
    const sum = (fn: (r: any) => number) => validas.reduce((acc: number, r: any) => acc + fn(r), 0);
    return {
      ...s,
      atletasCount: c,
      atletasTotal: rows.length,                   // inclui N/A
      duracaoMax:   rows.length > 0 ? Math.max(...rows.map((r: any) => n(r.duracao))) : 0,
      cargaMedia:   c > 0 ? Math.round((sum((r: any) => n(r.cargaJogador)) / c) * 10) / 10 : 0,
      cargaTotal:   Math.round(sum((r: any) => n(r.cargaJogador)) * 10) / 10,
      distMedia:    c > 0 ? Math.round(sum((r: any) => n(r.distanciaTotal)) / c) : 0,
    };
  });

  return c.json(enriquecida);
});

// GET /api/sessoes/:id
sessoesRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const [sessao] = await db.select().from(sessoes).where(eq(sessoes.id, id));
  if (!sessao) return c.json({ error: 'Sessão não encontrada.' }, 404);

  const rows = await db
    .selectDistinct({ periodo: metricas.periodo })
    .from(metricas)
    .where(eq(metricas.sessaoId, id));

  const periodos = rows.map((r: any) => r.periodo).sort(periodoSort);
  return c.json({ ...sessao, periodos });
});

// GET /api/sessoes/:id/metricas?periodo=Session
sessoesRouter.get('/:id/metricas', async (c) => {
  const id = Number(c.req.param('id'));
  const periodo = c.req.query('periodo') ?? 'Session';

  const rows = await db
    .select({
      id:                   metricas.id,
      periodo:              metricas.periodo,
      duracao:              metricas.duracao,
      distanciaTotal:       metricas.distanciaTotal,
      velocidadeMaxima:     metricas.velocidadeMaxima,
      metragemPorMinuto:    metricas.metragemPorMinuto,
      hsr:                  metricas.hsr,
      hsrEsforcos:          metricas.hsrEsforcos,
      sprint:               metricas.sprint,
      sprintEsforcos:       metricas.sprintEsforcos,
      aceleracoes:          metricas.aceleracoes,
      desaceleracoes:       metricas.desaceleracoes,
      acelDesacelTotal:     metricas.acelDesacelTotal,
      acelDesacelPorMinuto: metricas.acelDesacelPorMinuto,
      cargaJogador:         metricas.cargaJogador,
      cargaPorMinuto:       metricas.cargaPorMinuto,
      jogadorId:            jogadores.id,
      nome:                 jogadores.nomeCompleto,
      apelido:              jogadores.apelido,
      posicao:              jogadores.posicao,
    })
    .from(metricas)
    .innerJoin(jogadores, eq(metricas.jogadorId, jogadores.id))
    .where(eq(metricas.sessaoId, id));

  const filtradas = rows.filter(
    (r: any) => r.periodo?.toLowerCase() === periodo.toLowerCase()
  );

  return c.json(filtradas);
});

// GET /api/sessoes/:id/analise — dados agregados para as 3 abas do dashboard
sessoesRouter.get('/:id/analise', async (c) => {
  const id = Number(c.req.param('id'));
  const [sessao] = await db.select().from(sessoes).where(eq(sessoes.id, id));
  if (!sessao) return c.json({ error: 'Sessão não encontrada.' }, 404);

  // Todas as métricas da sessão com dados do jogador
  const todasMetricas = await db
    .select({
      periodo:              metricas.periodo,
      duracao:              metricas.duracao,
      distanciaTotal:       metricas.distanciaTotal,
      velocidadeMaxima:     metricas.velocidadeMaxima,
      metragemPorMinuto:    metricas.metragemPorMinuto,
      hsr:                  metricas.hsr,
      hsrEsforcos:          metricas.hsrEsforcos,
      hsrPorMinuto:         metricas.hsrPorMinuto,
      sprint:               metricas.sprint,
      sprintEsforcos:       metricas.sprintEsforcos,
      sprintPorMinuto:      metricas.sprintPorMinuto,
      aceleracoes:          metricas.aceleracoes,
      desaceleracoes:       metricas.desaceleracoes,
      acelDesacelTotal:     metricas.acelDesacelTotal,
      acelDesacelPorMinuto: metricas.acelDesacelPorMinuto,
      cargaJogador:         metricas.cargaJogador,
      cargaPorMinuto:       metricas.cargaPorMinuto,
      maxAceleracao:        metricas.maxAceleracao,
      maxDesaceleracao:     metricas.maxDesaceleracao,
      distStanding:         metricas.distStanding,
      distWalking:          metricas.distWalking,
      distJogging:          metricas.distJogging,
      distRunning:          metricas.distRunning,
      distHi:               metricas.distHi,
      jogadorId:            jogadores.id,
      nome:                 jogadores.nomeCompleto,
      apelido:              jogadores.apelido,
      posicao:              jogadores.posicao,
    })
    .from(metricas)
    .innerJoin(jogadores, eq(metricas.jogadorId, jogadores.id))
    .where(eq(metricas.sessaoId, id));

  const n = (v: number | null | undefined) => v ?? 0;

  // ── Atletas (período Session) ──────────────────────────────────────────────
  const atletasSession = todasMetricas
    .filter((r: any) => r.periodo === 'Session')
    .sort((a: any, b: any) => (a.posicao ?? 'ZZ').localeCompare(b.posicao ?? 'ZZ') || a.nome.localeCompare(b.nome));

  const avgAtletas = atletasSession.length > 0 ? {
    distanciaTotal:       atletasSession.reduce((s: number, r: any) => s + n(r.distanciaTotal),       0) / atletasSession.length,
    metragemPorMinuto:    atletasSession.reduce((s: number, r: any) => s + n(r.metragemPorMinuto),    0) / atletasSession.length,
    hsr:                  atletasSession.reduce((s: number, r: any) => s + n(r.hsr),                  0) / atletasSession.length,
    hsrEsforcos:          atletasSession.reduce((s: number, r: any) => s + n(r.hsrEsforcos),          0) / atletasSession.length,
    hsrPorMinuto:         atletasSession.reduce((s: number, r: any) => s + n(r.hsrPorMinuto),         0) / atletasSession.length,
    sprint:               atletasSession.reduce((s: number, r: any) => s + n(r.sprint),               0) / atletasSession.length,
    sprintEsforcos:       atletasSession.reduce((s: number, r: any) => s + n(r.sprintEsforcos),       0) / atletasSession.length,
    sprintPorMinuto:      atletasSession.reduce((s: number, r: any) => s + n(r.sprintPorMinuto),      0) / atletasSession.length,
    aceleracoes:          atletasSession.reduce((s: number, r: any) => s + n(r.aceleracoes),          0) / atletasSession.length,
    desaceleracoes:       atletasSession.reduce((s: number, r: any) => s + n(r.desaceleracoes),       0) / atletasSession.length,
    acelDesacelTotal:     atletasSession.reduce((s: number, r: any) => s + n(r.acelDesacelTotal),     0) / atletasSession.length,
    acelDesacelPorMinuto: atletasSession.reduce((s: number, r: any) => s + n(r.acelDesacelPorMinuto), 0) / atletasSession.length,
    cargaJogador:         atletasSession.reduce((s: number, r: any) => s + n(r.cargaJogador),         0) / atletasSession.length,
    cargaPorMinuto:       atletasSession.reduce((s: number, r: any) => s + n(r.cargaPorMinuto),       0) / atletasSession.length,
    velocidadeMaxima:     atletasSession.reduce((s: number, r: any) => s + n(r.velocidadeMaxima),     0) / atletasSession.length,
  } : null;

  const tempoTotal = atletasSession.length > 0
    ? Math.max(...atletasSession.map((r: any) => n(r.duracao)))
    : 0;

  // ── Zonas de Velocidade (soma do time, período Session) ────────────────────
  const zonasVelocidade = atletasSession.length > 0 ? {
    standing: atletasSession.reduce((s: number, r: any) => s + n(r.distStanding), 0),
    walking:  atletasSession.reduce((s: number, r: any) => s + n(r.distWalking),  0),
    jogging:  atletasSession.reduce((s: number, r: any) => s + n(r.distJogging),  0),
    running:  atletasSession.reduce((s: number, r: any) => s + n(r.distRunning),  0),
    hi:       atletasSession.reduce((s: number, r: any) => s + n(r.distHi),       0),
    sprint:   atletasSession.reduce((s: number, r: any) => s + n(r.sprint),       0),
  } : null;

  // ── Análise por período ────────────────────────────────────────────────────
  const periodosMap = new Map<string, typeof todasMetricas>();
  for (const r of todasMetricas) {
    if (!periodosMap.has(r.periodo)) periodosMap.set(r.periodo, []);
    periodosMap.get(r.periodo)!.push(r);
  }

  const sessionRef = periodosMap.get('Session');
  const sessionDistMedia = sessionRef && sessionRef.length > 0
    ? sessionRef.reduce((s: number, r: any) => s + n(r.distanciaTotal), 0) / sessionRef.length
    : 1;
  const sessionMpmMedia = sessionRef && sessionRef.length > 0
    ? sessionRef.reduce((s: number, r: any) => s + n(r.metragemPorMinuto), 0) / sessionRef.length
    : 1;

  const periodosList = Array.from(periodosMap.entries())
    .filter(([p]) => p !== 'Session')
    .sort(([a], [b]) => periodoSort(a, b))
    .map(([nome, rows]) => {
      const count = rows.length;
      const avg = (fn: (r: any) => number) =>
        rows.reduce((s: number, r: any) => s + fn(r), 0) / count;
      const maxDur = Math.max(...rows.map((r: any) => n(r.duracao)));

      return {
        nome,
        atletasCount: count,
        duracao: maxDur,
        distanciaMedia:       avg(r => n(r.distanciaTotal)),
        metragemPorMinuto:    avg(r => n(r.metragemPorMinuto)),
        hsrMedia:             avg(r => n(r.hsr)),
        hsrPorMinuto:         avg(r => n(r.hsrPorMinuto)),
        sprintMedia:          avg(r => n(r.sprint)),
        acelDesacelMedia:     avg(r => n(r.acelDesacelTotal)),
        acelDesacelPorMinuto: avg(r => n(r.acelDesacelPorMinuto)),
        cargaMedia:           avg(r => n(r.cargaJogador)),
        // % vs Session
        volumePct:     sessionDistMedia > 0 ? (avg(r => n(r.distanciaTotal)) / sessionDistMedia) * 100 : 0,
        intensidadePct: sessionMpmMedia > 0 ? (avg(r => n(r.metragemPorMinuto)) / sessionMpmMedia) * 100 : 0,
      };
    });

  // ── Participação (Session) ─────────────────────────────────────────────────
  const totalJogadoresSession = atletasSession.length;
  const comDados = atletasSession.filter((r: any) => n(r.distanciaTotal) > 0).length;

  // ── Histórico (mesma "tipo", excluindo a sessão atual) ─────────────────────
  // Médias do período Session em todas as outras sessões com o mesmo tipo —
  // serve para mostrar setinhas de comparação no card "Resumo".
  const historicoRows = await db
    .select({
      distanciaTotal:       metricas.distanciaTotal,
      metragemPorMinuto:    metricas.metragemPorMinuto,
      hsr:                  metricas.hsr,
      hsrPorMinuto:         metricas.hsrPorMinuto,
      sprint:               metricas.sprint,
      sprintPorMinuto:      metricas.sprintPorMinuto,
      acelDesacelTotal:     metricas.acelDesacelTotal,
      acelDesacelPorMinuto: metricas.acelDesacelPorMinuto,
      cargaJogador:         metricas.cargaJogador,
      cargaPorMinuto:       metricas.cargaPorMinuto,
      velocidadeMaxima:     metricas.velocidadeMaxima,
    })
    .from(metricas)
    .innerJoin(sessoes, eq(metricas.sessaoId, sessoes.id))
    .where(and(
      eq(metricas.periodo, 'Session'),
      eq(sessoes.tipo, sessao.tipo),
      ne(sessoes.id, id),
    ));

  // Filtra registros de jogadores que não participaram (distância 0) — não
  // contaminam a média comparativa.
  const historicoValidos = historicoRows.filter((r: any) => n(r.distanciaTotal) > 0);

  const historico = historicoValidos.length > 0 ? {
    amostras:             historicoValidos.length,
    distanciaTotal:       historicoValidos.reduce((s: number, r: any) => s + n(r.distanciaTotal),       0) / historicoValidos.length,
    metragemPorMinuto:    historicoValidos.reduce((s: number, r: any) => s + n(r.metragemPorMinuto),    0) / historicoValidos.length,
    hsr:                  historicoValidos.reduce((s: number, r: any) => s + n(r.hsr),                  0) / historicoValidos.length,
    hsrPorMinuto:         historicoValidos.reduce((s: number, r: any) => s + n(r.hsrPorMinuto),         0) / historicoValidos.length,
    sprint:               historicoValidos.reduce((s: number, r: any) => s + n(r.sprint),               0) / historicoValidos.length,
    sprintPorMinuto:      historicoValidos.reduce((s: number, r: any) => s + n(r.sprintPorMinuto),      0) / historicoValidos.length,
    acelDesacelTotal:     historicoValidos.reduce((s: number, r: any) => s + n(r.acelDesacelTotal),     0) / historicoValidos.length,
    acelDesacelPorMinuto: historicoValidos.reduce((s: number, r: any) => s + n(r.acelDesacelPorMinuto), 0) / historicoValidos.length,
    cargaJogador:         historicoValidos.reduce((s: number, r: any) => s + n(r.cargaJogador),         0) / historicoValidos.length,
    cargaPorMinuto:       historicoValidos.reduce((s: number, r: any) => s + n(r.cargaPorMinuto),       0) / historicoValidos.length,
    velocidadeMaxima:     historicoValidos.reduce((s: number, r: any) => s + n(r.velocidadeMaxima),     0) / historicoValidos.length,
  } : null;

  return c.json({
    sessao,
    tempoTotal,
    periodos: periodosList,
    atletasSession,
    medias: avgAtletas,
    historico,
    participacao: { full: comDados, na: totalJogadoresSession - comDados, total: totalJogadoresSession },
    zonasVelocidade,
  });
});

// PUT /api/sessoes/:id — atualiza metadados da sessão
sessoesRouter.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();

  const campos: Partial<Record<string, string>> = {};
  if (body.data      !== undefined) campos.data      = body.data;
  if (body.tipo      !== undefined) campos.tipo      = body.tipo;
  if (body.descricao !== undefined) campos.descricao  = body.descricao;
  if (body.equipe    !== undefined) campos.equipe     = body.equipe;
  if (body.local     !== undefined) campos.local      = body.local;

  if (Object.keys(campos).length === 0) {
    return c.json({ error: 'Nenhum campo para atualizar.' }, 400);
  }

  const [atualizada] = await db.update(sessoes)
    .set(campos)
    .where(eq(sessoes.id, id))
    .returning();

  if (!atualizada) return c.json({ error: 'Sessão não encontrada.' }, 404);
  return c.json({ message: 'Sessão atualizada.', sessao: atualizada });
});

// DELETE /api/sessoes/:id
sessoesRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await db.delete(metricas).where(eq(metricas.sessaoId, id));
  const [removida] = await db.delete(sessoes).where(eq(sessoes.id, id)).returning();
  if (!removida) return c.json({ error: 'Sessão não encontrada.' }, 404);
  return c.json({ message: 'Sessão removida.', sessao: removida });
});

export default sessoesRouter;
