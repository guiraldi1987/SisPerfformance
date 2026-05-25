import { sqliteTable, integer as sqInteger, text as sqText, real as sqReal } from 'drizzle-orm/sqlite-core';
import { pgTable, integer as pgInteger, text as pgText, real as pgReal, serial as pgSerial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

const isPostgres = !!(
  process.env.DATABASE_URL?.startsWith('postgres://') ||
  process.env.DATABASE_URL?.startsWith('postgresql://') ||
  process.env.DB_TYPE === 'postgres'
);

export const { jogadores, sessoes, metricas, usuarios } = (() => {
  if (isPostgres) {
    const jogadoresPg = pgTable('jogadores', {
      id:           pgSerial('id').primaryKey(),
      nomeCompleto: pgText('nome_completo').notNull(),
      apelido:      pgText('apelido'),
      posicao:      pgText('posicao'),
      codigoCsv:    pgText('codigo_csv').notNull().unique(),
      fotoUrl:      pgText('foto_url'),
      status:       pgText('status').notNull().default('ativo'),
      dataChegada:  pgText('data_chegada'),
      dataSaida:    pgText('data_saida'),
    });

    const sessoesPg = pgTable('sessoes', {
      id:        pgSerial('id').primaryKey(),
      data:      pgText('data').notNull(),
      tipo:      pgText('tipo').notNull(),
      descricao: pgText('descricao'),
      equipe:    pgText('equipe'),
      local:     pgText('local'),
      createdAt: pgText('created_at').$defaultFn(() => new Date().toISOString()),
    });

    const metricasPg = pgTable('metricas', {
      id:                   pgSerial('id').primaryKey(),
      jogadorId:            pgInteger('jogador_id').notNull().references(() => jogadoresPg.id),
      sessaoId:             pgInteger('sessao_id').notNull().references(() => sessoesPg.id),
      periodo:              pgText('periodo').notNull(),
      duracao:              pgInteger('duracao'),
      distanciaTotal:       pgReal('distancia_total'),
      velocidadeMaxima:     pgReal('velocidade_maxima'),
      metragemPorMinuto:    pgReal('metragem_por_minuto'),
      hsr:                  pgReal('hsr'),
      hsrEsforcos:          pgInteger('hsr_esforcos'),
      hsrPorMinuto:         pgReal('hsr_por_minuto'),
      sprint:               pgReal('sprint'),
      sprintEsforcos:       pgInteger('sprint_esforcos'),
      sprintPorMinuto:      pgReal('sprint_por_minuto'),
      aceleracoes:          pgInteger('aceleracoes'),
      desaceleracoes:       pgInteger('desaceleracoes'),
      acelDesacelTotal:     pgInteger('acel_desacel_total'),
      acelDesacelPorMinuto: pgReal('acel_desacel_por_minuto'),
      cargaJogador:         pgReal('carga_jogador'),
      cargaPorMinuto:       pgReal('carga_por_minuto'),
      maxAceleracao:        pgReal('max_aceleracao'),
      maxDesaceleracao:     pgReal('max_desaceleracao'),
      distStanding:         pgReal('dist_standing'),
      distWalking:          pgReal('dist_walking'),
      distJogging:          pgReal('dist_jogging'),
      distRunning:          pgReal('dist_running'),
      distHi:               pgReal('dist_hi'),
    });

    const usuariosPg = pgTable('usuarios', {
      id:           pgSerial('id').primaryKey(),
      username:     pgText('username').notNull().unique(),
      name:         pgText('name').notNull(),
      passwordHash: pgText('password_hash').notNull(),
      role:         pgText('role').notNull(),
      status:       pgText('status').notNull().default('ativo'),
      createdAt:    pgText('created_at').$defaultFn(() => new Date().toISOString()),
    });

    return { jogadores: jogadoresPg, sessoes: sessoesPg, metricas: metricasPg, usuarios: usuariosPg };
  } else {
    const jogadoresSq = sqliteTable('jogadores', {
      id:           sqInteger('id').primaryKey({ autoIncrement: true }),
      nomeCompleto: sqText('nome_completo').notNull(),
      apelido:      sqText('apelido'),
      posicao:      sqText('posicao'),
      codigoCsv:    sqText('codigo_csv').notNull().unique(),
      fotoUrl:      sqText('foto_url'),
      status:       sqText('status').notNull().default('ativo'),
      dataChegada:  sqText('data_chegada'),
      dataSaida:    sqText('data_saida'),
    });

    const sessoesSq = sqliteTable('sessoes', {
      id:        sqInteger('id').primaryKey({ autoIncrement: true }),
      data:      sqText('data').notNull(),
      tipo:      sqText('tipo').notNull(),
      descricao: sqText('descricao'),
      equipe:    sqText('equipe'),
      local:     sqText('local'),
      createdAt: sqText('created_at').$defaultFn(() => new Date().toISOString()),
    });

    const metricasSq = sqliteTable('metricas', {
      id:                   sqInteger('id').primaryKey({ autoIncrement: true }),
      jogadorId:            sqInteger('jogador_id').notNull().references(() => jogadoresSq.id),
      sessaoId:             sqInteger('sessao_id').notNull().references(() => sessoesSq.id),
      periodo:              sqText('periodo').notNull(),
      duracao:              sqInteger('duracao'),
      distanciaTotal:       sqReal('distancia_total'),
      velocidadeMaxima:     sqReal('velocidade_maxima'),
      metragemPorMinuto:    sqReal('metragem_por_minuto'),
      hsr:                  sqReal('hsr'),
      hsrEsforcos:          sqInteger('hsr_esforcos'),
      hsrPorMinuto:         sqReal('hsr_por_minuto'),
      sprint:               sqReal('sprint'),
      sprintEsforcos:       sqInteger('sprint_esforcos'),
      sprintPorMinuto:      sqReal('sprint_por_minuto'),
      aceleracoes:          sqInteger('aceleracoes'),
      desaceleracoes:       sqInteger('desaceleracoes'),
      acelDesacelTotal:     sqInteger('acel_desacel_total'),
      acelDesacelPorMinuto: sqReal('acel_desacel_por_minuto'),
      cargaJogador:         sqReal('carga_jogador'),
      cargaPorMinuto:       sqReal('carga_por_minuto'),
      maxAceleracao:        sqReal('max_aceleracao'),
      maxDesaceleracao:     sqReal('max_desaceleracao'),
      distStanding:         sqReal('dist_standing'),
      distWalking:          sqReal('dist_walking'),
      distJogging:          sqReal('dist_jogging'),
      distRunning:          sqReal('dist_running'),
      distHi:               sqReal('dist_hi'),
    });

    const usuariosSq = sqliteTable('usuarios', {
      id:           sqInteger('id').primaryKey({ autoIncrement: true }),
      username:     sqText('username').notNull().unique(),
      name:         sqText('name').notNull(),
      passwordHash: sqText('password_hash').notNull(),
      role:         sqText('role').notNull(),
      status:       sqText('status').notNull().default('ativo'),
      createdAt:    sqText('created_at').$defaultFn(() => new Date().toISOString()),
    });

    return { jogadores: jogadoresSq, sessoes: sessoesSq, metricas: metricasSq, usuarios: usuariosSq };
  }
})();

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
