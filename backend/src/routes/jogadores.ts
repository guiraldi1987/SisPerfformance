import { Hono } from 'hono';
import { eq, desc, inArray } from 'drizzle-orm';
import { db } from '../db';
import { jogadores, metricas, sessoes } from '../db/schema';
import { promises as fs } from 'fs';
import * as path from 'path';

const jogadoresRouter = new Hono();

// LIST com filtro de status (default: ativos)
// ?status=ativo (default) | inativo | todos
jogadoresRouter.get('/', async (c) => {
  const status = c.req.query('status') ?? 'ativo';
  const lista = await db.select().from(jogadores).orderBy(jogadores.nomeCompleto);
  if (status === 'todos') return c.json(lista);
  return c.json(lista.filter((j: any) => j.status === status));
});

// BATCH: marca múltiplos jogadores com novo status (ex: reapresentação)
// Body: { ids: number[], status: 'ativo'|'inativo', dataSaida?: 'YYYY-MM-DD' }
jogadoresRouter.post('/batch-status', async (c) => {
  const body = await c.req.json<{
    ids: number[];
    status: 'ativo' | 'inativo';
    dataSaida?: string | null;
  }>();
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return c.json({ error: 'Lista de ids vazia.' }, 400);
  }
  if (!['ativo', 'inativo'].includes(body.status)) {
    return c.json({ error: 'Status deve ser "ativo" ou "inativo".' }, 400);
  }

  // Reativar zera dataSaida; marcar inativo grava dataSaida (default = hoje)
  const patch: Partial<{ status: string; dataSaida: string | null }> = { status: body.status };
  if (body.status === 'inativo') {
    patch.dataSaida = body.dataSaida ?? new Date().toISOString().slice(0, 10);
  } else {
    patch.dataSaida = null;
  }

  const atualizados = await db.update(jogadores)
    .set(patch)
    .where(inArray(jogadores.id, body.ids))
    .returning();

  return c.json({ atualizados: atualizados.length, jogadores: atualizados });
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
      hsrEsforcos:      metricas.hsrEsforcos,
      sprint:           metricas.sprint,
      sprintEsforcos:   metricas.sprintEsforcos,
      aceleracoes:      metricas.aceleracoes,
      desaceleracoes:   metricas.desaceleracoes,
      acelDesacelTotal: metricas.acelDesacelTotal,
      cargaJogador:     metricas.cargaJogador,
      cargaPorMinuto:   metricas.cargaPorMinuto,
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
    ? rows.filter((r: any) => r.sessaoTipo?.toLowerCase() === tipo.toLowerCase())
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
    status: 'ativo' | 'inativo';
    dataChegada: string | null;
    dataSaida:   string | null;
  }>>();

  // Auto-fill dataSaida quando ativo→inativo é detectado e dataSaida não foi enviada
  if (body.status === 'inativo' && body.dataSaida === undefined) {
    body.dataSaida = new Date().toISOString().slice(0, 10);
  }
  // Reativar zera dataSaida automaticamente
  if (body.status === 'ativo' && body.dataSaida === undefined) {
    body.dataSaida = null;
  }

  const [atualizado] = await db.update(jogadores).set(body).where(eq(jogadores.id, id)).returning();
  if (!atualizado) return c.json({ error: 'Jogador não encontrado.' }, 404);
  return c.json(atualizado);
});

// UPLOAD FOTO
jogadoresRouter.post('/:id/foto', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const file = body.foto;

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Nenhum arquivo de imagem enviado.' }, 400);
  }

  // Validar formato
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: 'Formato inválido. Apenas imagens JPEG, PNG ou WEBP são permitidas.' }, 400);
  }

  // Validar tamanho (máx 2MB)
  if (file.size > 2 * 1024 * 1024) {
    return c.json({ error: 'A imagem é muito grande. O limite máximo é de 2MB.' }, 400);
  }

  const [jogador] = await db.select().from(jogadores).where(eq(jogadores.id, id));
  if (!jogador) {
    return c.json({ error: 'Jogador não encontrado.' }, 404);
  }

  // Determinar extensão do arquivo
  let ext = 'jpg';
  if (file.type === 'image/png') ext = 'png';
  if (file.type === 'image/webp') ext = 'webp';

  const filename = `jogador_${id}_${Date.now()}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'uploads', 'fotos');

  try {
    // Garante que a pasta existe
    await fs.mkdir(uploadDir, { recursive: true });

    // Exclui a foto antiga se for um arquivo local
    if (jogador.fotoUrl && jogador.fotoUrl.startsWith('/uploads/fotos/')) {
      const oldPath = path.join(process.cwd(), jogador.fotoUrl.replace(/^\//, ''));
      await fs.unlink(oldPath).catch(() => {}); // Ignora se o arquivo não existir
    }

    // Salva o novo arquivo
    const filePath = path.join(uploadDir, filename);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    // Salva a nova URL relativa
    const fotoUrl = `/uploads/fotos/${filename}`;
    const [atualizado] = await db.update(jogadores)
      .set({ fotoUrl })
      .where(eq(jogadores.id, id))
      .returning();

    return c.json(atualizado);
  } catch (error) {
    console.error('Erro ao fazer upload da foto:', error);
    return c.json({ error: 'Erro ao processar e salvar a imagem.' }, 500);
  }
});

// DELETE
jogadoresRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const [removido] = await db.delete(jogadores).where(eq(jogadores.id, id)).returning();
  if (!removido) return c.json({ error: 'Jogador não encontrado.' }, 404);
  return c.json({ message: 'Jogador removido.', jogador: removido });
});

export default jogadoresRouter;
