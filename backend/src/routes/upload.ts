import { Hono } from 'hono';
import { db } from '../db';
import { jogadores, sessoes, metricas } from '../db/schema';
import Papa from 'papaparse';

const uploadRouter = new Hono();

function timeToSeconds(timeString: string): number {
  if (!timeString) return 0;
  const parts = timeString.split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return 0;
}

// POST /upload-gps
uploadRouter.post('/upload-gps', async (c) => {
  try {
    // { all: true } é obrigatório para receber File em multipart no Hono v4
    const body = await c.req.parseBody({ all: true });

    const dataSessao = body['data'] as string;
    const tipoSessao = body['tipo'] as string;
    const file = body['file'];

    if (!file || typeof file === 'string') {
      return c.json({ error: 'Nenhum arquivo enviado. Verifique o campo "file".' }, 400);
    }
    if (!dataSessao || !tipoSessao) {
      return c.json({ error: 'Campos "data" e "tipo" são obrigatórios.' }, 400);
    }

    const [novaSessao] = await db.insert(sessoes).values({
      data: dataSessao,
      tipo: tipoSessao,
    }).returning();

    if (!novaSessao) return c.json({ error: 'Falha ao criar sessão.' }, 500);

    const todosJogadores = await db.select().from(jogadores);
    const mapJogadores = new Map(todosJogadores.map(j => [j.codigoCsv, j.id]));

    const csvText = await (file as File).text();
    const lines = csvText.split('\n');
    const headerIndex = lines.findIndex(line => line.startsWith('"Player Name"'));

    if (headerIndex === -1) {
      return c.json({ error: 'Cabeçalho "Player Name" não encontrado no CSV.' }, 400);
    }

    const validCsvText = lines.slice(headerIndex).join('\n');
    const parsed = Papa.parse(validCsvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    // Auto-cria jogadores ausentes para não bloquear o primeiro upload
    const nomesNoCsv = Array.from(new Set(
      (parsed.data as any[])
        .map((r: any) => r['Player Name'])
        .filter((n: any): n is string => typeof n === 'string' && n.trim().length > 0)
    ));
    const ausentes = nomesNoCsv.filter(n => !mapJogadores.has(n));
    if (ausentes.length > 0) {
      const criados = await db.insert(jogadores)
        .values(ausentes.map(n => ({ nomeCompleto: n, codigoCsv: n })))
        .returning();
      criados.forEach((j: { id: number; codigoCsv: string }) => mapJogadores.set(j.codigoCsv, j.id));
    }

    const linhasInserir: {
      jogadorId: number;
      sessaoId: number;
      periodo: string;
      duracao: number;
      distanciaTotal: number;
      velocidadeMaxima: number;
      hsr: number;
      sprint: number;
      aceleracoes: number;
      desaceleracoes: number;
    }[] = [];

    for (const row of parsed.data as any[]) {
      const jogadorId = mapJogadores.get(row['Player Name']);
      if (!jogadorId) continue;

      linhasInserir.push({
        jogadorId,
        sessaoId: novaSessao.id,
        periodo: String(row['Period Name'] || 'Desconhecido'),
        duracao: timeToSeconds(String(row['Duration'] ?? '')),
        distanciaTotal: Number(row['Distance'] ?? 0),
        velocidadeMaxima: Number(row['Max Velocity'] ?? 0),
        hsr: Number(row['High Speed Distance'] ?? 0),
        sprint: Number(row['Sprint Distance'] ?? 0),
        aceleracoes: Number(row['Acceleration Efforts'] ?? 0),
        desaceleracoes: Number(row['Deceleration Efforts'] ?? 0),
      });
    }

    if (linhasInserir.length > 0) {
      await db.insert(metricas).values(linhasInserir);
    }

    return c.json({
      message: 'Upload concluído!',
      sessaoId: novaSessao.id,
      registros: linhasInserir.length,
      jogadoresCriados: ausentes.length,
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    return c.json({ error: 'Erro interno ao processar o CSV.', detail: String(error) }, 500);
  }
});

export default uploadRouter;
