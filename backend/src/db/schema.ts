import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const jogadores = sqliteTable('jogadores', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  nomeCompleto: text('nome_completo').notNull(),
  apelido:      text('apelido'),
  posicao:      text('posicao'),
  codigoCsv:    text('codigo_csv').notNull().unique(),
  fotoUrl:      text('foto_url'),
});

export const sessoes = sqliteTable('sessoes', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  data:      text('data').notNull(),
  tipo:      text('tipo').notNull(),
  descricao: text('descricao'),
  local:     text('local'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const metricas = sqliteTable('metricas', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  jogadorId:            integer('jogador_id').notNull().references(() => jogadores.id),
  sessaoId:             integer('sessao_id').notNull().references(() => sessoes.id),
  periodo:              text('periodo').notNull(),
  duracao:              integer('duracao'),
  distanciaTotal:       real('distancia_total'),
  velocidadeMaxima:     real('velocidade_maxima'),
  metragemPorMinuto:    real('metragem_por_minuto'),
  hsr:                  real('hsr'),
  hsrEsforcos:          integer('hsr_esforcos'),
  hsrPorMinuto:         real('hsr_por_minuto'),
  sprint:               real('sprint'),
  sprintEsforcos:       integer('sprint_esforcos'),
  sprintPorMinuto:      real('sprint_por_minuto'),
  aceleracoes:          integer('aceleracoes'),
  desaceleracoes:       integer('desaceleracoes'),
  acelDesacelTotal:     integer('acel_desacel_total'),
  acelDesacelPorMinuto: real('acel_desacel_por_minuto'),
  cargaJogador:         real('carga_jogador'),
  cargaPorMinuto:       real('carga_por_minuto'),
  maxAceleracao:        real('max_aceleracao'),
  maxDesaceleracao:     real('max_desaceleracao'),
});

export const jogadoresRelations = relations(jogadores, ({ many }) => ({
  metricas: many(metricas),
}));

export const sessoesRelations = relations(sessoes, ({ many }) => ({
  metricas: many(metricas),
}));

export const metricasRelations = relations(metricas, ({ one }) => ({
  jogador: one(jogadores, { fields: [metricas.jogadorId], references: [jogadores.id] }),
  sessao:  one(sessoes,   { fields: [metricas.sessaoId],  references: [sessoes.id]   }),
}));
