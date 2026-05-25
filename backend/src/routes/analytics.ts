import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import { sessoes, metricas, jogadores } from '../db/schema';

const analyticsRouter = new Hono();

// ─── ACWR Helpers ─────────────────────────────────────────────────────────────

const n = (v: number | null | undefined) => v ?? 0;

type Zona = 'risco' | 'atencao' | 'ideal' | 'baixa' | 'sem-dados';

function zonaACWR(acwr: number | null): Zona {
  if (acwr == null || !isFinite(acwr) || acwr === 0) return 'sem-dados';
  if (acwr > 1.5)  return 'risco';
  if (acwr > 1.3)  return 'atencao';
  if (acwr < 0.8)  return 'baixa';
  return 'ideal';
}

// Adiciona dias a uma string ISO YYYY-MM-DD; retorna nova string ISO
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Diferença em dias entre duas ISO dates
function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db_ = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((da - db_) / 86_400_000);
}

// Calcula janelas aguda/crônica em torno de uma data de referência
// Retorna ACWR usando Player Load como métrica de carga
function calcularAcwr(
  cargasPorDia: Map<string, number>,
  dataRef: string,
): { aguda: number; cronica: number; acwr: number | null } {
  let somaAguda = 0;
  let somaCronica = 0;

  for (let i = 0; i < 28; i++) {
    const dia = addDays(dataRef, -i);
    const c = cargasPorDia.get(dia) ?? 0;
    if (i < 7) somaAguda += c;
    somaCronica += c;
  }

  const aguda  = somaAguda  / 7;
  const cronica = somaCronica / 28;
  const acwr = cronica > 0 ? aguda / cronica : null;
  return { aguda, cronica, acwr };
}

// Tendência: compara aguda atual vs aguda 7 dias atrás
function tendencia(cargasPorDia: Map<string, number>, dataRef: string): 'subindo' | 'descendo' | 'estavel' {
  const agudaHoje = calcularAcwr(cargasPorDia, dataRef).aguda;
  const agudaSemPassada = calcularAcwr(cargasPorDia, addDays(dataRef, -7)).aguda;
  if (agudaSemPassada === 0) return 'estavel';
  const delta = (agudaHoje - agudaSemPassada) / agudaSemPassada;
  if (delta > 0.1)  return 'subindo';
  if (delta < -0.1) return 'descendo';
  return 'estavel';
}

// ─── GET /api/analytics/team-overview ─────────────────────────────────────────
// Retorna tudo que o "Painel do Time" precisa em uma única chamada.

analyticsRouter.get('/team-overview', async (c) => {
  // Data de referência (para ACWR): a mais recente solicitada — `end` tem
  // prioridade, depois `refDate` (compat), senão hoje.
  const endParam     = c.req.query('end');
  const startParam   = c.req.query('start');
  const refDateParam = c.req.query('refDate');
  const refDate = endParam ?? refDateParam ?? new Date().toISOString().slice(0, 10);

  // Janela do heatmap: usa start/end se ambos fornecidos; senão últimos 14 dias.
  const heatEnd   = endParam   ?? refDate;
  const heatStart = startParam ?? addDays(heatEnd, -13);    // -13 = 14 dias inclusive
  const heatDias  = Math.max(1, Math.min(diffDays(heatEnd, heatStart) + 1, 366));

  // Busca todas as métricas Session com dados de sessão e jogador
  const dados = await db
    .select({
      jogadorId:         metricas.jogadorId,
      nome:              jogadores.nomeCompleto,
      apelido:           jogadores.apelido,
      posicao:           jogadores.posicao,
      cargaJogador:      metricas.cargaJogador,
      distancia:         metricas.distanciaTotal,
      metragemPorMinuto: metricas.metragemPorMinuto,
      data:              sessoes.data,
      tipo:              sessoes.tipo,
      sessaoId:          sessoes.id,
    })
    .from(metricas)
    .innerJoin(jogadores, eq(metricas.jogadorId, jogadores.id))
    .innerJoin(sessoes,   eq(metricas.sessaoId,  sessoes.id))
    .where(eq(metricas.periodo, 'Session'));

  // ACWR e anomalias só consideram atletas no elenco ativo. Histórico
  // (sessões, métricas) continua intacto — só não aparece nos dashboards.
  const todosAtletas = (await db.select().from(jogadores).orderBy(jogadores.nomeCompleto))
    .filter((j: any) => j.status === 'ativo');

  // Agrupa carga por jogador + data
  const cargaPorAtleta = new Map<number, Map<string, number>>();
  const distPorAtleta  = new Map<number, Map<string, number>>();
  const ultimaSessao   = new Map<number, string>();

  for (const r of dados) {
    if (!cargaPorAtleta.has(r.jogadorId)) cargaPorAtleta.set(r.jogadorId, new Map());
    if (!distPorAtleta.has(r.jogadorId))  distPorAtleta.set(r.jogadorId,  new Map());
    const mc = cargaPorAtleta.get(r.jogadorId)!;
    const md = distPorAtleta.get(r.jogadorId)!;
    mc.set(r.data, (mc.get(r.data) ?? 0) + n(r.cargaJogador));
    md.set(r.data, (md.get(r.data) ?? 0) + n(r.distancia));
    const ult = ultimaSessao.get(r.jogadorId);
    if (!ult || r.data > ult) ultimaSessao.set(r.jogadorId, r.data);
  }

  // Calcula ACWR para cada atleta
  const atletasAnalise = todosAtletas.map((j: any) => {
    const cargas = cargaPorAtleta.get(j.id) ?? new Map();
    const { aguda, cronica, acwr } = calcularAcwr(cargas, refDate);
    const z = zonaACWR(acwr);
    return {
      id:           j.id,
      nome:         j.nomeCompleto,
      apelido:      j.apelido,
      posicao:      j.posicao,
      fotoUrl:      j.fotoUrl,
      acwr:         acwr,
      cargaAguda:   Math.round(aguda * 100) / 100,
      cargaCronica: Math.round(cronica * 100) / 100,
      zona:         z,
      tendencia:    cargas.size > 0 ? tendencia(cargas, refDate) : 'estavel',
      ultimaSessao: ultimaSessao.get(j.id) ?? null,
    };
  });

  // Contadores por zona
  const alertas = {
    risco:    atletasAnalise.filter((a: any) => a.zona === 'risco').length,
    atencao:  atletasAnalise.filter((a: any) => a.zona === 'atencao').length,
    baixa:    atletasAnalise.filter((a: any) => a.zona === 'baixa').length,
    ideal:    atletasAnalise.filter((a: any) => a.zona === 'ideal').length,
    semDados: atletasAnalise.filter((a: any) => a.zona === 'sem-dados').length,
  };

  // Heatmap da janela solicitada (carga média do time + tipo de sessão)
  const cargaSemanal: Array<{
    data: string; diaSemana: string;
    cargaMedia: number; atletasCount: number; tipo: string | null;
  }> = [];

  const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

  for (let i = 0; i < heatDias; i++) {
    const dia = addDays(heatStart, i);
    const sessoesNoDia = dados.filter((r: any) => r.data === dia);
    const atletas = new Set(sessoesNoDia.map((r: any) => r.jogadorId));
    const cargaTotal = sessoesNoDia.reduce((s: number, r: any) => s + n(r.cargaJogador), 0);
    const tiposNoDia = [...new Set(sessoesNoDia.map((r: any) => r.tipo as string))];
    const tipo = (tiposNoDia.includes('Jogo') ? 'Jogo' : (tiposNoDia[0] ?? null)) as string | null;

    const dt = new Date(dia + 'T00:00:00Z');
    cargaSemanal.push({
      data:         dia,
      diaSemana:    DIAS_SEMANA[dt.getUTCDay()]!,
      cargaMedia:   atletas.size > 0 ? Math.round((cargaTotal / atletas.size) * 10) / 10 : 0,
      atletasCount: atletas.size,
      tipo,
    });
  }

  // Insights auto-gerados
  const insights: string[] = [];

  if (alertas.risco > 0) {
    const nomes = atletasAnalise
      .filter((a: any) => a.zona === 'risco')
      .slice(0, 3)
      .map((a: any) => a.apelido || a.nome.split(',')[0])
      .join(', ');
    insights.push(`${alertas.risco} ${alertas.risco === 1 ? 'atleta está' : 'atletas estão'} em zona de risco crítico (ACWR > 1.5): ${nomes}`);
    
    if (alertas.risco > 1) {
      insights.push(`Alerta coletivo de sobrecarga de microciclo: Reduzir a intensidade média dos treinos de campo reduzido (táticos) nas próximas 48 horas para diminuir risco de lesões de tecidos moles.`);
    } else {
      insights.push(`Sobrecarga individual detectada: Controlar rigidamente a minutagem de exposição e o volume de sprints de alta intensidade do atleta em zona de risco nas próximas sessões.`);
    }
  }

  if (alertas.baixa > 0) {
    insights.push(`${alertas.baixa} ${alertas.baixa === 1 ? 'atleta está sub-treinado' : 'atletas estão sub-treinados'} (ACWR < 0.8) — possível perda de forma`);
    
    if (alertas.baixa > 1) {
      insights.push(`Janela propícia para carga de choque coletiva: Aumentar o volume tático coletivo no dia MD-3 para promover o recondicionamento crônico seguro e restaurar a robustez física do time.`);
    } else {
      insights.push(`Atleta sub-treinado identificado: Programar treino suplementar pós-sessão principal para compensar o déficit de carga crônica e mitigar o risco de lesões no retorno aos jogos de alta intensidade.`);
    }
  }

  // Comparação volume agudo vs crônico do time
  const agudaTime   = atletasAnalise.reduce((s: number, a: any) => s + a.cargaAguda,   0) / Math.max(atletasAnalise.length, 1);
  const cronicaTime = atletasAnalise.reduce((s: number, a: any) => s + a.cargaCronica, 0) / Math.max(atletasAnalise.length, 1);
  if (cronicaTime > 0) {
    const delta = ((agudaTime - cronicaTime) / cronicaTime) * 100;
    if (Math.abs(delta) > 10) {
      insights.push(`Volume médio do time está ${delta > 0 ? '+' : ''}${delta.toFixed(0)}% vs média mensal. ${delta > 0 ? 'Fase de acumulação intensa; priorizar recovery muscular.' : 'Fase de descarga/polimento; foco em velocidade e explosão neuromuscular.'}`);
    }
  }

  const subindo = atletasAnalise.filter((a: any) => a.tendencia === 'subindo').length;
  if (subindo >= 3) {
    insights.push(`${subindo} atletas com carga em alta nos últimos 7 dias. Implementar sessões de prevenção e liberação miofascial ativa para este bloco de atletas.`);
  }

  // Última sessão registrada
  const ultimaSessaoGeral = await db
    .select({ data: sessoes.data, tipo: sessoes.tipo, descricao: sessoes.descricao })
    .from(sessoes)
    .orderBy(desc(sessoes.data))
    .limit(1);

  // ── Detecção de anomalias ────────────────────────────────────────────────
  // Para cada atleta, compara a sessão mais recente com média/desvio das
  // anteriores em 3 métricas (Player Load, distância, m/min). |z| > 2 → flag.
  type AnomMetric = {
    key:    'cargaJogador' | 'distancia' | 'metragemPorMinuto';
    label:  string;
    unit:   string;
    latest: number;
    mean:   number;
    z:      number;
    direction: 'up' | 'down';
  };

  const sessoesPorAtleta = new Map<number, typeof dados>();
  for (const r of dados) {
    if (!sessoesPorAtleta.has(r.jogadorId)) sessoesPorAtleta.set(r.jogadorId, []);
    sessoesPorAtleta.get(r.jogadorId)!.push(r);
  }

  const METRICS_ANOM = [
    { key: 'cargaJogador'      as const, label: 'Player Load', unit: '' },
    { key: 'distancia'         as const, label: 'Distância',   unit: 'm' },
    { key: 'metragemPorMinuto' as const, label: 'm/min',       unit: 'm/min' },
  ];

  const anomalias = [] as Array<{
    atletaId: number; nome: string; apelido: string | null; posicao: string | null;
    data: string; tipo: string;
    metricas: AnomMetric[];
  }>;

  for (const j of todosAtletas) {
    const arr = (sessoesPorAtleta.get(j.id) ?? [])
      .filter((r: any) => n(r.distancia) > 0)
      .sort((a: any, b: any) => b.data.localeCompare(a.data));
    if (arr.length < 4) continue; // precisa de pelo menos 3 baseline + 1 atual

    const latest = arr[0]!;
    const baseline = arr.slice(1);

    const flagged: AnomMetric[] = [];
    for (const m of METRICS_ANOM) {
      const vals = baseline.map((b: any) => n(b[m.key])).filter((v: any) => v > 0);
      if (vals.length < 3) continue;
      const mean = vals.reduce((s: number, v: any) => s + v, 0) / vals.length;
      const variance = vals.reduce((s: number, v: any) => s + (v - mean) ** 2, 0) / vals.length;
      const std = Math.sqrt(variance);
      if (std < 0.001) continue;
      const lv = n(latest[m.key]);
      if (lv === 0) continue;
      const z = (lv - mean) / std;
      if (Math.abs(z) > 2) {
        flagged.push({
          key:    m.key,
          label:  m.label,
          unit:   m.unit,
          latest: Math.round(lv * 10) / 10,
          mean:   Math.round(mean * 10) / 10,
          z:      Math.round(z * 100) / 100,
          direction: z > 0 ? 'up' : 'down',
        });
      }
    }

    if (flagged.length === 0) continue;
    anomalias.push({
      atletaId: j.id,
      nome:     j.nomeCompleto,
      apelido:  j.apelido,
      posicao:  j.posicao,
      fotoUrl:  j.fotoUrl,
      data:     latest.data,
      tipo:     latest.tipo,
      metricas: flagged,
    });
  }

  // Ordena pelo maior |z| dentre as métricas flagadas
  anomalias.sort((a, b) => {
    const zA = Math.max(...a.metricas.map(m => Math.abs(m.z)));
    const zB = Math.max(...b.metricas.map(m => Math.abs(m.z)));
    return zB - zA;
  });

  if (anomalias.length > 0) {
    insights.push(
      `${anomalias.length} ${anomalias.length === 1 ? 'atleta apresentou' : 'atletas apresentaram'} ` +
      `desvio >2σ da média pessoal na última sessão`
    );
  }

  return c.json({
    refDate,
    windowStart: heatStart,
    windowEnd:   heatEnd,
    windowDias:  heatDias,
    alertas,
    atletas: atletasAnalise,
    cargaSemanal,
    insights,
    anomalias,
    ultimaSessao: ultimaSessaoGeral[0] ?? null,
    totalAtletas: todosAtletas.length,
    totalSessoes: new Set(dados.map((d: any) => d.sessaoId)).size,
  });
});

// ─── GET /api/jogadores/:id/acwr ─────────────────────────────────────────────
// Retorna a série temporal de ACWR para um jogador específico.

analyticsRouter.get('/jogadores/:id/acwr', async (c) => {
  const jogadorId = Number(c.req.param('id'));

  const [jogador] = await db.select().from(jogadores).where(eq(jogadores.id, jogadorId));
  if (!jogador) return c.json({ error: 'Jogador não encontrado.' }, 404);

  const dados = await db
    .select({
      cargaJogador:   metricas.cargaJogador,
      distanciaTotal: metricas.distanciaTotal,
      data:           sessoes.data,
    })
    .from(metricas)
    .innerJoin(sessoes, eq(metricas.sessaoId, sessoes.id))
    .where(eq(metricas.jogadorId, jogadorId));

  // Filtra apenas Session
  const sessao = dados;
  const cargaPorDia = new Map<string, number>();
  const distPorDia  = new Map<string, number>();
  for (const r of sessao) {
    cargaPorDia.set(r.data, (cargaPorDia.get(r.data) ?? 0) + n(r.cargaJogador));
    distPorDia.set(r.data,  (distPorDia.get(r.data)  ?? 0) + n(r.distanciaTotal));
  }

  // Determina range: da primeira sessão até hoje
  const datasOrdenadas = [...cargaPorDia.keys()].sort();
  if (datasOrdenadas.length === 0) {
    return c.json({
      jogador,
      serie: [],
      acwrAtual: null,
      zona: 'sem-dados' as Zona,
    });
  }

  const primeiraData = datasOrdenadas[0]!;
  const hoje = new Date().toISOString().slice(0, 10);
  const ultimaData = datasOrdenadas[datasOrdenadas.length - 1]!;
  const dataFim = hoje > ultimaData ? hoje : ultimaData;

  // Gera série dia-a-dia
  const serie: Array<{
    data: string; aguda: number; cronica: number;
    acwr: number | null; cargaDia: number; distanciaDia: number;
  }> = [];

  const diasTotal = diffDays(dataFim, primeiraData);
  for (let i = 0; i <= diasTotal; i++) {
    const dia = addDays(primeiraData, i);
    const { aguda, cronica, acwr } = calcularAcwr(cargaPorDia, dia);
    serie.push({
      data:         dia,
      aguda:        Math.round(aguda * 100) / 100,
      cronica:      Math.round(cronica * 100) / 100,
      acwr:         acwr != null ? Math.round(acwr * 100) / 100 : null,
      cargaDia:     Math.round((cargaPorDia.get(dia) ?? 0) * 100) / 100,
      distanciaDia: Math.round(distPorDia.get(dia)  ?? 0),
    });
  }

  const acwrAtual = serie[serie.length - 1]?.acwr ?? null;

  return c.json({
    jogador,
    serie,
    acwrAtual,
    zona: zonaACWR(acwrAtual),
  });
});

// ─── GET /api/analytics/posicoes-benchmarks ──────────────────────────────────
// Calcula benchmark dinâmico por posição (média das últimas N sessões Jogo).

analyticsRouter.get('/posicoes-benchmarks', async (c) => {
  const dados = await db
    .select({
      posicao:              jogadores.posicao,
      distanciaTotal:       metricas.distanciaTotal,
      metragemPorMinuto:    metricas.metragemPorMinuto,
      hsr:                  metricas.hsr,
      hsrPorMinuto:         metricas.hsrPorMinuto,
      sprint:               metricas.sprint,
      sprintPorMinuto:      metricas.sprintPorMinuto,
      acelDesacelTotal:     metricas.acelDesacelTotal,
      acelDesacelPorMinuto: metricas.acelDesacelPorMinuto,
      cargaJogador:         metricas.cargaJogador,
      tipo:                 sessoes.tipo,
    })
    .from(metricas)
    .innerJoin(jogadores, eq(metricas.jogadorId, jogadores.id))
    .innerJoin(sessoes,   eq(metricas.sessaoId,  sessoes.id))
    .where(eq(metricas.periodo, 'Session'));

  // Agrupa por posição (apenas jogos)
  const grupos = new Map<string, typeof dados>();
  for (const r of dados.filter((d: any) => d.tipo === 'Jogo' && d.posicao)) {
    const p = r.posicao!;
    if (!grupos.has(p)) grupos.set(p, []);
    grupos.get(p)!.push(r);
  }

  // Percentil p (linear) para uma série numérica
  const percentil = (vals: number[], p: number): number => {
    if (vals.length === 0) return 0;
    const sorted = [...vals].sort((a, b) => a - b);
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo]!;
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
  };

  const benchmarks = Array.from(grupos.entries()).map(([posicao, rows]) => {
    const c = rows.length;
    const avg = (fn: (r: any) => number) =>
      Math.round((rows.reduce((s: number, r: any) => s + fn(r), 0) / c) * 10) / 10;

    // p95 ("melhor da posição") — robusto contra outliers únicos
    const top = (fn: (r: any) => number) =>
      Math.round(percentil(rows.map(fn), 0.95) * 10) / 10;

    return {
      posicao,
      amostras: c,
      distanciaTotal:       avg(r => n(r.distanciaTotal)),
      metragemPorMinuto:    avg(r => n(r.metragemPorMinuto)),
      hsr:                  avg(r => n(r.hsr)),
      hsrPorMinuto:         avg(r => n(r.hsrPorMinuto)),
      sprint:               avg(r => n(r.sprint)),
      sprintPorMinuto:      avg(r => n(r.sprintPorMinuto)),
      acelDesacelTotal:     avg(r => n(r.acelDesacelTotal)),
      acelDesacelPorMinuto: avg(r => n(r.acelDesacelPorMinuto)),
      cargaJogador:         avg(r => n(r.cargaJogador)),
      // ── Top (p95) "melhor da posição" ────────────────────────────────
      top: {
        distanciaTotal:       top(r => n(r.distanciaTotal)),
        metragemPorMinuto:    top(r => n(r.metragemPorMinuto)),
        hsr:                  top(r => n(r.hsr)),
        hsrPorMinuto:         top(r => n(r.hsrPorMinuto)),
        sprint:               top(r => n(r.sprint)),
        sprintPorMinuto:      top(r => n(r.sprintPorMinuto)),
        acelDesacelTotal:     top(r => n(r.acelDesacelTotal)),
        acelDesacelPorMinuto: top(r => n(r.acelDesacelPorMinuto)),
        cargaJogador:         top(r => n(r.cargaJogador)),
      },
    };
  });

  return c.json({ benchmarks });
});

// ─── GET /api/analytics/jogadores/:id/microciclo ─────────────────────────────
// Para cada sessão do jogador, classifica MD±N pelo offset ao jogo mais próximo
// (jogos próprios do jogador). Empates de distância: prefere MD- (próximo jogo).

analyticsRouter.get('/jogadores/:id/microciclo', async (c) => {
  const id = Number(c.req.param('id'));

  const [jogador] = await db.select().from(jogadores).where(eq(jogadores.id, id));
  if (!jogador) return c.json({ error: 'Jogador não encontrado.' }, 404);

  const dados = await db
    .select({
      data:               sessoes.data,
      tipo:               sessoes.tipo,
      duracao:            metricas.duracao,
      distanciaTotal:     metricas.distanciaTotal,
      metragemPorMinuto:  metricas.metragemPorMinuto,
      cargaJogador:       metricas.cargaJogador,
      hsr:                metricas.hsr,
      sprint:             metricas.sprint,
    })
    .from(metricas)
    .innerJoin(sessoes, eq(metricas.sessaoId, sessoes.id))
    .where(and(
      eq(metricas.jogadorId, id),
      eq(metricas.periodo, 'Session'),
    ));

  // Filtra sessões em que o jogador efetivamente participou
  const valid = dados.filter((r: any) => n(r.distanciaTotal) > 0);
  valid.sort((a: any, b: any) => a.data.localeCompare(b.data));

  // Datas de jogo próprias do jogador (apenas em que participou)
  const jogoDates = valid.filter((r: any) => r.tipo === 'Jogo').map((r: any) => r.data);

  // Classifica cada sessão para um label MD±N
  // Regra: pega o jogo mais próximo em dias absolutos; em caso de empate
  // (treino entre dois jogos equidistantes), prefere o jogo seguinte (MD-N).
  const classify = (data: string, tipo: string): string | null => {
    if (tipo === 'Jogo') return 'MD';
    if (jogoDates.length === 0) return null;

    let bestDiff = Number.POSITIVE_INFINITY; // diff = jogo - dataSessao (positivo = jogo no futuro)
    let bestAbs = Number.POSITIVE_INFINITY;
    for (const gd of jogoDates) {
      const diff = diffDays(gd, data);
      const abs  = Math.abs(diff);
      if (abs < bestAbs || (abs === bestAbs && diff > 0 && bestDiff < 0)) {
        bestAbs = abs;
        bestDiff = diff;
      }
    }
    if (!isFinite(bestDiff)) return null;

    // Janela útil: MD-7 a MD+7. Fora disso é ruído.
    const offset = Math.abs(bestDiff);
    if (offset > 7) return null;
    if (bestDiff === 0) return 'MD';
    if (bestDiff > 0)   return `MD-${offset}`;
    return `MD+${offset}`;
  };

  const buckets = new Map<string, typeof valid>();
  for (const r of valid) {
    const label = classify(r.data, r.tipo);
    if (!label) continue;
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(r);
  }

  // Ordem canônica do microciclo (MD-7 → MD+7)
  const ORDER = [
    'MD-7','MD-6','MD-5','MD-4','MD-3','MD-2','MD-1',
    'MD',
    'MD+1','MD+2','MD+3','MD+4','MD+5','MD+6','MD+7',
  ];

  const distribuicao = Array.from(buckets.entries())
    .map(([md, rows]) => {
      const c = rows.length;
      const avg = (fn: (r: any) => number) =>
        Math.round((rows.reduce((s: number, r: any) => s + fn(r), 0) / c) * 10) / 10;
      return {
        md,
        sessoes:        c,
        cargaMedia:     avg(r => n(r.cargaJogador)),
        distanciaMedia: avg(r => n(r.distanciaTotal)),
        mpmMedia:       avg(r => n(r.metragemPorMinuto)),
        hsrMedia:       avg(r => n(r.hsr)),
        sprintMedia:    avg(r => n(r.sprint)),
        duracaoMedia:   avg(r => n(r.duracao)),
      };
    })
    .sort((a, b) => {
      const ai = ORDER.indexOf(a.md);
      const bi = ORDER.indexOf(b.md);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return c.json({
    jogador,
    distribuicao,
    totalJogos:   jogoDates.length,
    totalSessoes: valid.length,
  });
});

// ─── GET /api/analytics/comparar ──────────────────────────────────────────────
// Query params:
//   ids=1,2,3       (obrigatório, 2-4 jogadores)
//   sessaoId=5      (opcional — dados de uma sessão específica)
//   ultimos=3       (opcional — média dos últimos N jogos; default = todos)
// Retorna médias por jogador + lista de sessões disponíveis (para dropdown).

analyticsRouter.get('/comparar', async (c) => {
  const idsParam = c.req.query('ids') ?? '';
  const ids = idsParam.split(',').map(Number).filter(v => v > 0 && isFinite(v));
  if (ids.length < 2) return c.json({ error: 'Informe pelo menos 2 IDs (ids=1,2,3).' }, 400);

  const sessaoIdParam = c.req.query('sessaoId');
  const ultimosParam  = c.req.query('ultimos');
  const sessaoIdFiltro = sessaoIdParam ? Number(sessaoIdParam) : null;
  const ultimosFiltro  = ultimosParam  ? Number(ultimosParam)  : null;

  const todosJogadores = await db.select().from(jogadores);
  const jogadoresMap = new Map<number, any>(todosJogadores.map((j: any): [number, any] => [j.id, j]));

  const dados = await db
    .select({
      jogadorId:            metricas.jogadorId,
      sessaoId:             metricas.sessaoId,
      distanciaTotal:       metricas.distanciaTotal,
      metragemPorMinuto:    metricas.metragemPorMinuto,
      hsr:                  metricas.hsr,
      hsrPorMinuto:         metricas.hsrPorMinuto,
      sprint:               metricas.sprint,
      sprintPorMinuto:      metricas.sprintPorMinuto,
      aceleracoes:          metricas.aceleracoes,
      desaceleracoes:       metricas.desaceleracoes,
      acelDesacelTotal:     metricas.acelDesacelTotal,
      cargaJogador:         metricas.cargaJogador,
      duracao:              metricas.duracao,
      velocidadeMaxima:     metricas.velocidadeMaxima,
      sessaoData:           sessoes.data,
      sessaoTipo:           sessoes.tipo,
      sessaoDescricao:      sessoes.descricao,
    })
    .from(metricas)
    .innerJoin(sessoes, eq(metricas.sessaoId, sessoes.id))
    .where(eq(metricas.periodo, 'Session'));

  // Lista de sessões disponíveis (para dropdown no frontend)
  const sessoesDisp = await db
    .select({ id: sessoes.id, data: sessoes.data, tipo: sessoes.tipo, descricao: sessoes.descricao,
              equipe: sessoes.equipe, local: sessoes.local })
    .from(sessoes)
    .orderBy(desc(sessoes.data));

  const resultado = ids.map(id => {
    const jogador = jogadoresMap.get(id);
    if (!jogador) return null;

    let rows = dados.filter((d: any) => d.jogadorId === id && n(d.distanciaTotal) > 0);

    // ── Aplicar filtros ──────────────────────────────────────────────────
    let filtroLabel = 'todos';

    if (sessaoIdFiltro) {
      // Sessão específica
      rows = rows.filter((d: any) => d.sessaoId === sessaoIdFiltro);
      filtroLabel = 'sessao';
    } else if (ultimosFiltro && ultimosFiltro > 0) {
      // Últimos N jogos
      const jogos = rows
        .filter((d: any) => d.sessaoTipo === 'Jogo')
        .sort((a: any, b: any) => b.sessaoData.localeCompare(a.sessaoData))
        .slice(0, ultimosFiltro);
      rows = jogos;
      filtroLabel = `ultimos-${ultimosFiltro}`;
    }

    const jogos = rows.filter((d: any) => d.sessaoTipo === 'Jogo');
    const treinos = rows.filter((d: any) => d.sessaoTipo === 'Treino');

    const avg = (arr: typeof rows, fn: (r: any) => number) =>
      arr.length > 0 ? Math.round((arr.reduce((s: number, r: any) => s + fn(r), 0) / arr.length) * 10) / 10 : 0;

    const mkStats = (arr: typeof rows) => ({
      sessoes: arr.length,
      distanciaTotal:    avg(arr, r => n(r.distanciaTotal)),
      metragemPorMinuto: avg(arr, r => n(r.metragemPorMinuto)),
      hsr:               avg(arr, r => n(r.hsr)),
      hsrPorMinuto:      avg(arr, r => n(r.hsrPorMinuto)),
      sprint:            avg(arr, r => n(r.sprint)),
      sprintPorMinuto:   avg(arr, r => n(r.sprintPorMinuto)),
      aceleracoes:       avg(arr, r => n(r.aceleracoes)),
      desaceleracoes:    avg(arr, r => n(r.desaceleracoes)),
      acelDesacelTotal:  avg(arr, r => n(r.acelDesacelTotal)),
      cargaJogador:      avg(arr, r => n(r.cargaJogador)),
      velocidadeMaxima:  avg(arr, r => n(r.velocidadeMaxima)),
    });

    // Últimas 10 sessões para sparkline (sempre do histórico completo)
    const todosDoJogador = dados.filter((d: any) => d.jogadorId === id && n(d.distanciaTotal) > 0);
    const ultimas = [...todosDoJogador]
      .sort((a, b) => a.sessaoData.localeCompare(b.sessaoData))
      .slice(-10)
      .map(r => ({
        data: r.sessaoData,
        tipo: r.sessaoTipo,
        dist: n(r.distanciaTotal),
        mpm: n(r.metragemPorMinuto),
        hsr: n(r.hsr),
        sprint: n(r.sprint),
      }));

    return {
      jogador: {
        id: jogador.id,
        nome: jogador.nomeCompleto,
        apelido: jogador.apelido,
        posicao: jogador.posicao,
      },
      geral: mkStats(rows),
      jogos: mkStats(jogos),
      treinos: mkStats(treinos),
      ultimas,
      filtroLabel,
    };
  }).filter(Boolean);

  return c.json({ jogadores: resultado, sessoes: sessoesDisp });
});

export default analyticsRouter;

