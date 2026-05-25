import { Hono } from 'hono';
import { db } from '../db';
import { jogadores, sessoes, metricas } from '../db/schema';
import Papa from 'papaparse';

const uploadRouter = new Hono();

function timeToSeconds(t: string): number {
  if (!t) return 0;
  const parts = t.split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return 0;
}

// Converte DD/MM/YYYY → YYYY-MM-DD
function parseCsvDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}

// Extrai metadados das linhas antes do header "Player Name"
function extractMeta(lines: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const line of lines) {
    // Formato: Key:,Value  ou  "Key:",Value
    const sep = line.indexOf(',');
    if (sep === -1) continue;
    const key   = line.slice(0, sep).replace(/"/g, '').replace(/:$/, '').trim();
    const value = line.slice(sep + 1).replace(/"/g, '').trim();
    if (key) meta[key] = value;
  }
  return meta;
}

const num = (v: unknown): number => (v == null || v === '' ? 0 : Number(v) || 0);
const int = (v: unknown): number => Math.round(num(v));

uploadRouter.post('/upload-gps', async (c) => {
  try {
    const body = await c.req.parseBody({ all: true });

    const tipoSessao   = body['tipo']   as string;
    const jogoSessao   = (body['jogo']   as string) || null;
    const equipeSessao = (body['equipe'] as string) || null;
    const localSessao  = (body['local']  as string) || null;
    const file = body['file'];

    if (!file || typeof file === 'string') {
      return c.json({ error: 'Nenhum arquivo enviado. Verifique o campo "file".' }, 400);
    }
    if (!tipoSessao) {
      return c.json({ error: 'Campo "tipo" é obrigatório.' }, 400);
    }

    const csvText  = await (file as File).text();
    const lines    = csvText.split('\n');
    const headerIndex = lines.findIndex(line => line.startsWith('"Player Name"'));

    if (headerIndex === -1) {
      return c.json({ error: 'Cabeçalho "Player Name" não encontrado no CSV.' }, 400);
    }

    // Extrai data do CSV (linha 0: "Date:,15/02/2026")
    const metaLines = lines.slice(0, headerIndex);
    const meta = extractMeta(metaLines);
    const dataSessao = parseCsvDate(meta['Date'] ?? '');

    if (!dataSessao) {
      return c.json({ error: 'Data não encontrada no CSV. Linha esperada: "Date:,DD/MM/YYYY".' }, 400);
    }

    const [novaSessao] = await db.insert(sessoes).values({
      data:      dataSessao,
      tipo:      tipoSessao,
      descricao: jogoSessao,
      equipe:    equipeSessao,
      local:     localSessao,
    }).returning();

    if (!novaSessao) return c.json({ error: 'Falha ao criar sessão.' }, 500);

    const todosJogadores = await db.select().from(jogadores);
    const mapJogadores = new Map<string, number>(todosJogadores.map((j: any): [string, number] => [j.codigoCsv, j.id]));

    const validCsvText = lines.slice(headerIndex).join('\n');
    const parsed = Papa.parse(validCsvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

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
      criados.forEach((j: any) => mapJogadores.set(j.codigoCsv, j.id));
    }

    const linhasInserir: (typeof metricas.$inferInsert)[] = [];

    for (const row of parsed.data as any[]) {
      const jogadorId = mapJogadores.get(row['Player Name']);
      if (!jogadorId) continue;

      linhasInserir.push({
        jogadorId,
        sessaoId:             novaSessao.id,
        periodo:              String(row['Period Name'] || 'Desconhecido'),
        duracao:              timeToSeconds(String(row['Duration'] ?? '')),
        distanciaTotal:       num(row['Distance']),
        velocidadeMaxima:     num(row['Max Velocity']),
        metragemPorMinuto:    num(row['Meterage Per Minute']),
        hsr:                  num(row['High Speed Distance']),
        hsrEsforcos:          int(row['High Speed Efforts']),
        hsrPorMinuto:         num(row['High Speed Distance Per Minute']),
        sprint:               num(row['Sprint Distance']),
        sprintEsforcos:       int(row['Sprint Efforts']),
        sprintPorMinuto:      num(row['Sprint Dist Per Min']),
        aceleracoes:          int(row['Acceleration Efforts']),
        desaceleracoes:       int(row['Deceleration Efforts']),
        acelDesacelTotal:     int(row['Accel + Decel Efforts']),
        acelDesacelPorMinuto: num(row['Accel + Decel Efforts Per Minute']),
        cargaJogador:         num(row['Player Load']),
        cargaPorMinuto:       num(row['Player Load Per Minute']),
        maxAceleracao:        num(row['Max Acceleration']),
        maxDesaceleracao:     num(row['Max Deceleration']),
        distStanding:         num(row['Standing Distance']),
        distWalking:          num(row['Walking Distance']),
        distJogging:          num(row['Jogging Distance']),
        distRunning:          num(row['Running Distance']),
        distHi:               num(row['HI Distance']),
      });
    }

    if (linhasInserir.length > 0) {
      await db.insert(metricas).values(linhasInserir);
    }

    return c.json({
      message:          'Upload concluído!',
      sessaoId:         novaSessao.id,
      dataSessao,
      registros:        linhasInserir.length,
      jogadoresCriados: ausentes.length,
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    return c.json({ error: 'Erro interno ao processar o CSV.', detail: String(error) }, 500);
  }
});

export default uploadRouter;
