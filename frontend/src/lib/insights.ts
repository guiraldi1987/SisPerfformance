import { formatData } from './format';

export interface InsightInput {
  duracao: number | null;
  distanciaTotal: number | null;
  hsr: number | null;
  sprint: number | null;
  aceleracoes: number | null;
  desaceleracoes: number | null;
  sessaoData: string;
  sessaoTipo: string;
  sessaoDescricao: string | null;
}

export interface Insight {
  kind: 'positive' | 'warning' | 'neutral';
  title: string;
  detail: string;
}

const n = (v: number | null | undefined) => v ?? 0;

const mpm = (m: InsightInput): number => {
  const dur = n(m.duracao);
  return dur > 0 ? n(m.distanciaTotal) / (dur / 60) : 0;
};

const avg = (arr: number[]): number =>
  arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

const fmtNum = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export function buildInsights(metricas: InsightInput[], acwrAtual?: number | null): Insight[] {
  const insights: Insight[] = [];
  if (metricas.length === 0) return insights;

  // Filtra sessões sem participação real (distância 0)
  const valid = metricas.filter(m => n(m.distanciaTotal) > 0);
  if (valid.length === 0) return insights;

  const jogos = valid.filter(m => m.sessaoTipo === 'Jogo');
  const treinos = valid.filter(m => m.sessaoTipo === 'Treino');

  // ─── 0. Prescrições Clínicas baseadas em ACWR (Agudo/Crônico) ───────────────
  if (acwrAtual != null && acwrAtual > 0) {
    if (acwrAtual > 1.5) {
      insights.push({
        kind: 'warning',
        title: 'ALERTA CLÍNICO: Risco Crítico de Lesão',
        detail: `Fator de risco severo (ACWR de ${fmtNum(acwrAtual, 2)}). Pico agudo excessivo. Reduzir a carga de trabalho imediatamente nas próximas 48-72 horas. Foco absoluto em recuperação ativa (imersão em água fria, botas pneumáticas) e sessões regenerativas de baixo impacto. Evitar acelerações em alta intensidade (Z4/Z5).`,
      });
    } else if (acwrAtual > 1.3) {
      insights.push({
        kind: 'warning',
        title: 'PRESCRIÇÃO FÍSICA: Sobrecarga em Curso',
        detail: `Zona de fadiga moderada (ACWR de ${fmtNum(acwrAtual, 2)}). Evitar aumentos abruptos de volume ou treinos extras. Monitorar queixas subjetivas de fadiga muscular (DOMS). Prescrever treinos técnicos de volume controlado e focar em estratégias de recuperação (recuperação miofascial, sono regulado).`,
      });
    } else if (acwrAtual < 0.8) {
      insights.push({
        kind: 'warning',
        title: 'PRESCRIÇÃO FÍSICA: Sub-treinamento Crítico',
        detail: `Condicionamento deficitário (ACWR de ${fmtNum(acwrAtual, 2)}). Risco aumentado de destreinamento e vulnerabilidade a lesões futuras ao retornar a jogos de alta intensidade. Recomenda-se progressão controlada de volume no microciclo e reintrodução gradual de estímulos de acelerações.`,
      });
    } else {
      insights.push({
        kind: 'positive',
        title: 'Equilíbrio Agudo/Crônico Ideal',
        detail: `ACWR ideal de ${fmtNum(acwrAtual, 2)}. Excelente balanço entre cargas agudas (curto prazo) e crônicas (longo prazo). Nível ótimo de fitness, protegendo o atleta contra lesões mecânicas e fadiga sistêmica. Manter o planejamento de cargas corrente.`,
      });
    }
  }

  // ─── 1. Match readiness (m/min de treino vs jogo) ───────────────────────────
  if (jogos.length >= 1 && treinos.length >= 1) {
    const mpmJogo = avg(jogos.map(mpm));
    const mpmTreino = avg(treinos.map(mpm));
    if (mpmJogo > 0) {
      const ratio = (mpmTreino / mpmJogo) * 100;
      if (ratio >= 80 && ratio <= 110) {
        insights.push({
          kind: 'positive',
          title: 'Intensidade Competitiva Adequada',
          detail: `Treinos atingem ${ratio.toFixed(0)}% da intensidade média de jogo (${fmtNum(mpmTreino, 1)} vs ${fmtNum(mpmJogo, 1)} m/min) — estímulo neuromuscular adequado para competição real.`,
        });
      } else if (ratio < 60) {
        insights.push({
          kind: 'warning',
          title: 'PRESCRIÇÃO FÍSICA: Intensidade Deficitária',
          detail: `Estímulo de treino muito baixo (${ratio.toFixed(0)}% do ritmo de jogo, ${fmtNum(mpmTreino, 1)} vs ${fmtNum(mpmJogo, 1)} m/min). Risco de déficit cardiovascular em partidas oficiais. Prescrever blocos adicionais de jogos reduzidos (SSG) de 4x4 ou 5x5 em campo aberto para aproximar ao ritmo real de jogo.`,
        });
      } else if (ratio > 130) {
        insights.push({
          kind: 'warning',
          title: 'ALERTA CLÍNICO: Sobrecarga em Treino',
          detail: `Intensidade dos treinos está ${ratio.toFixed(0)}% acima do ritmo de jogo. Risco agudo de fadiga acumulada e esgotamento de substratos metabólicos. Recomenda-se reduzir o volume das sessões técnicas coletivas nos próximos 2 microciclos.`,
        });
      } else {
        insights.push({
          kind: 'neutral',
          title: 'Match Readiness Estável',
          detail: `Treinos operam em ritmo de ${ratio.toFixed(0)}% da intensidade de jogo (${fmtNum(mpmTreino, 1)} vs ${fmtNum(mpmJogo, 1)} m/min).`,
        });
      }
    }
  }

  // ─── 2. Forma recente — últimos 3 jogos vs média geral em jogos ─────────────
  if (jogos.length >= 4) {
    const sortedDesc = [...jogos].sort((a, b) => b.sessaoData.localeCompare(a.sessaoData));
    const recent = sortedDesc.slice(0, 3);
    const overall = avg(jogos.map(mpm));
    const recentAvg = avg(recent.map(mpm));
    if (overall > 0) {
      const delta = ((recentAvg - overall) / overall) * 100;
      if (delta >= 5) {
        insights.push({
          kind: 'positive',
          title: 'Forma Física em Alta',
          detail: `Últimos 3 jogos apresentam m/min +${delta.toFixed(0)}% vs média histórica (${fmtNum(recentAvg, 1)} vs ${fmtNum(overall, 1)}). Resposta positiva a microciclos de supercompensação.`,
        });
      } else if (delta <= -5) {
        insights.push({
          kind: 'warning',
          title: 'ALERTA: Queda de Intensidade Recente',
          detail: `Desempenho mecânico caiu ${delta.toFixed(0)}% nos últimos 3 jogos (${fmtNum(recentAvg, 1)} vs ${fmtNum(overall, 1)} m/min). Possível estresse acumulado ou fadiga neuromuscular central. Recomenda-se avaliar queixas de dor e repouso.`,
        });
      } else {
        insights.push({
          kind: 'neutral',
          title: 'Forma Mecânica Estável',
          detail: `Últimos 3 jogos com m/min alinhados à média do atleta (${fmtNum(recentAvg, 1)} m/min, variação estável de ${delta.toFixed(0)}%).`,
        });
      }
    }
  }

  // ─── 3. Pico — Sprint ou HSR muito acima da média ───────────────────────────
  if (valid.length >= 3) {
    const avgSprint = avg(valid.map(m => n(m.sprint)));
    const avgHsr    = avg(valid.map(m => n(m.hsr)));

    let bestSprint = valid[0]!;
    let bestHsr    = valid[0]!;
    for (const m of valid) {
      if (n(m.sprint) > n(bestSprint.sprint)) bestSprint = m;
      if (n(m.hsr)    > n(bestHsr.hsr))       bestHsr    = m;
    }

    const sprintRatio = avgSprint > 0 ? n(bestSprint.sprint) / avgSprint : 0;
    const hsrRatio    = avgHsr    > 0 ? n(bestHsr.hsr)       / avgHsr    : 0;

    // Pega o pico mais "notável" (% acima da média)
    if (sprintRatio >= 1.5 && sprintRatio >= hsrRatio) {
      const pct = (sprintRatio - 1) * 100;
      insights.push({
        kind: 'positive',
        title: 'Estímulo de Alta Velocidade (Sprint)',
        detail: `${fmtNum(n(bestSprint.sprint))} m de sprint em ${formatData(bestSprint.sessaoData)} (${bestSprint.sessaoTipo}) — ${pct.toFixed(0)}% acima da média. Excelente exposição preventiva contra lesões de isquiotibiais.`,
      });
    } else if (hsrRatio >= 1.5) {
      const pct = (hsrRatio - 1) * 100;
      insights.push({
        kind: 'positive',
        title: 'Estímulo de Corrida de Alta Intensidade',
        detail: `${fmtNum(n(bestHsr.hsr))} m de HSR em ${formatData(bestHsr.sessaoData)} (${bestHsr.sessaoTipo}) — ${pct.toFixed(0)}% acima da média. Excelente estímulo cardiovascular de limiar de lactato.`,
      });
    }
  }

  // ─── 4. Balanço Acel × Desac (Sobrecarga Excêntrica vs Potência) ──────────────
  const allAcel  = avg(valid.map(m => n(m.aceleracoes)));
  const allDesac = avg(valid.map(m => n(m.desaceleracoes)));
  if (allAcel >= 5 && allDesac >= 5) {
    const ratio = allAcel / allDesac;
    if (ratio >= 0.85 && ratio <= 1.15) {
      insights.push({
        kind: 'positive',
        title: 'Relação Neuromuscular Balanceada',
        detail: `Médias equilibradas de ${fmtNum(allAcel, 1)} acelerações e ${fmtNum(allDesac, 1)} desacelerações por sessão (ratio ${ratio.toFixed(2)}). Excelente balanço de frenagem/ignição mecânica.`,
      });
    } else if (ratio < 0.85) {
      insights.push({
        kind: 'warning',
        title: 'PRESCRIÇÃO CLÍNICA: Fadiga Excêntrica Aguda',
        detail: `Alto volume de desacelerações (${fmtNum(allDesac, 1)}) vs acelerações (${fmtNum(allAcel, 1)}). Sobrecarga excêntrica severa nos quadríceps e tendões patelares. Prescrever fortalecimento excêntrico preventivo (nórdico reverso, agachamentos lentos) e reduzir treinamentos em espaço curto (SSG) de frenagens curtas neste microciclo.`,
      });
    } else {
      insights.push({
        kind: 'neutral',
        title: 'Perfil Neuromuscular Explosivo / Concêntrico',
        detail: `Alto volume de acelerações (${fmtNum(allAcel, 1)}) vs desacelerações (${fmtNum(allDesac, 1)}). Foco preventivo em musculatura flexora (isquiotibiais) com exercícios como nórdico tradicional e levantamentos terra romeno para suportar frenagens futuras.`,
      });
    }
  }

  return insights;
}
