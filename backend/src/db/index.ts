import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import pg from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Garante o carregamento do .env
dotenv.config();

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbPath = join(__dirname, '..', '..', 'ieeegp.db');

const isPostgres = !!(
  process.env.DATABASE_URL?.startsWith('postgres://') ||
  process.env.DATABASE_URL?.startsWith('postgresql://') ||
  process.env.DB_TYPE === 'postgres'
);

let db: any;
let pool: pg.Pool | null = null;
let sqlite: any = null;

if (isPostgres) {
  const connectionString = process.env.DATABASE_URL;
  pool = new pg.Pool({ connectionString });
  db = drizzlePg(pool, { schema });
  console.log('[db] Conectado ao banco PostgreSQL');
} else {
  sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  db = drizzleSqlite(sqlite, { schema });
  console.log('[db] Conectado ao banco SQLite local');
}

// ─── Auto-Bootstrapping das Tabelas ──────────────────────────────────────────
async function bootstrap() {
  try {
    if (isPostgres && pool) {
      // 1. Criar tabelas no PostgreSQL
      await pool.query(`
        CREATE TABLE IF NOT EXISTS jogadores (
          id SERIAL PRIMARY KEY,
          nome_completo TEXT NOT NULL,
          apelido TEXT,
          posicao TEXT,
          codigo_csv TEXT NOT NULL UNIQUE,
          foto_url TEXT,
          status TEXT NOT NULL DEFAULT 'ativo',
          data_chegada TEXT,
          data_saida TEXT
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS sessoes (
          id SERIAL PRIMARY KEY,
          data TEXT NOT NULL,
          tipo TEXT NOT NULL,
          descricao TEXT,
          equipe TEXT,
          local TEXT,
          created_at TEXT
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS metricas (
          id SERIAL PRIMARY KEY,
          jogador_id INTEGER NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
          sessao_id INTEGER NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
          periodo TEXT NOT NULL,
          duracao INTEGER,
          distancia_total REAL,
          velocidade_maxima REAL,
          metragem_por_minuto REAL,
          hsr REAL,
          hsr_esforcos INTEGER,
          hsr_por_minuto REAL,
          sprint REAL,
          sprint_esforcos INTEGER,
          sprint_por_minuto REAL,
          aceleracoes INTEGER,
          desaceleracoes INTEGER,
          acel_desacel_total INTEGER,
          acel_desacel_por_minuto REAL,
          carga_jogador REAL,
          carga_por_minuto REAL,
          max_aceleracao REAL,
          max_desaceleracao REAL,
          dist_standing REAL,
          dist_walking REAL,
          dist_jogging REAL,
          dist_running REAL,
          dist_hi REAL
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ativo',
          created_at TEXT
        );
      `);

      console.log('[db] Bootstrapping de tabelas do PostgreSQL concluído com sucesso.');

    } else if (sqlite) {
      // 2. Criar tabelas no SQLite
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS jogadores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome_completo TEXT NOT NULL,
          apelido TEXT,
          posicao TEXT,
          codigo_csv TEXT NOT NULL UNIQUE,
          foto_url TEXT,
          status TEXT NOT NULL DEFAULT 'ativo',
          data_chegada TEXT,
          data_saida TEXT
        );

        CREATE TABLE IF NOT EXISTS sessoes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          data TEXT NOT NULL,
          tipo TEXT NOT NULL,
          descricao TEXT,
          equipe TEXT,
          local TEXT,
          created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS metricas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          jogador_id INTEGER NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
          sessao_id INTEGER NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
          periodo TEXT NOT NULL,
          duracao INTEGER,
          distancia_total REAL,
          velocidade_maxima REAL,
          metragem_por_minuto REAL,
          hsr REAL,
          hsr_esforcos INTEGER,
          hsr_por_minuto REAL,
          sprint REAL,
          sprint_esforcos INTEGER,
          sprint_por_minuto REAL,
          aceleracoes INTEGER,
          desaceleracoes INTEGER,
          acel_desacel_total INTEGER,
          acel_desacel_por_minuto REAL,
          carga_jogador REAL,
          carga_por_minuto REAL,
          max_aceleracao REAL,
          max_desaceleracao REAL,
          dist_standing REAL,
          dist_walking REAL,
          dist_jogging REAL,
          dist_running REAL,
          dist_hi REAL
        );

        CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ativo',
          created_at TEXT
        );
      `);

      // Manter a migração idempotente da versão anterior para adicionar colunas antigas se necessário
      const ensureColumn = (table: string, name: string, ddl: string): boolean => {
        const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
        if (cols.some((c: any) => c.name === name)) return false;
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
        return true;
      };

      const addedStatus = ensureColumn('jogadores', 'status', `status TEXT NOT NULL DEFAULT 'ativo'`);
      const addedDataChegada = ensureColumn('jogadores', 'data_chegada', `data_chegada TEXT`);
      const addedDataSaida = ensureColumn('jogadores', 'data_saida', `data_saida TEXT`);

      if (addedDataChegada || (sqlite.prepare(`SELECT COUNT(*) AS c FROM jogadores WHERE data_chegada IS NULL`).get() as { c: number }).c > 0) {
        sqlite.exec(`
          UPDATE jogadores
             SET data_chegada = (
               SELECT MIN(s.data)
                 FROM metricas m
                 JOIN sessoes s ON s.id = m.sessao_id
                WHERE m.jogador_id = jogadores.id
                  AND m.periodo = 'Session'
                  AND COALESCE(m.distancia_total, 0) > 0
             )
           WHERE data_chegada IS NULL;
        `);
      }

      if (addedStatus || addedDataChegada || addedDataSaida) {
        console.log(`[db] migration aplicada: status=${addedStatus} dataChegada=${addedDataChegada} dataSaida=${addedDataSaida}`);
      }

      console.log('[db] Bootstrapping de tabelas do SQLite concluído com sucesso.');
    }

    // ─── Seeding Automático do Usuário Default ─────────────────────────────────
    const defaultUsername = process.env.AUTH_USERNAME || 'eduardo.tavares';
    const defaultPasswordHash = process.env.AUTH_PASSWORD_HASH || '$2b$12$MtaBnbTUcxaueJZQjGcL9OCjjTR25nYO2rR6iYuagsrL9pJY58QZO'; // admin123 hash fallback
    const defaultName = process.env.AUTH_USER_NAME || 'Eduardo Luiz Tavares';
    const defaultRole = process.env.AUTH_USER_ROLE || 'Preparador Físico';

    let userCount = 0;
    if (isPostgres && pool) {
      const res = await pool.query('SELECT COUNT(*)::integer AS count FROM usuarios');
      userCount = res.rows[0].count;
    } else if (sqlite) {
      const res = sqlite.prepare('SELECT COUNT(*) AS count FROM usuarios').get() as { count: number };
      userCount = res.count;
    }

    if (userCount === 0) {
      console.log('[db] Tabela de usuários vazia. Realizando seed do usuário administrador padrão...');
      if (isPostgres && pool) {
        await pool.query(
          `INSERT INTO usuarios (username, name, password_hash, role, status, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [defaultUsername, defaultName, defaultPasswordHash, defaultRole, 'ativo', new Date().toISOString()]
        );
      } else if (sqlite) {
        sqlite.prepare(
          `INSERT INTO usuarios (username, name, password_hash, role, status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(defaultUsername, defaultName, defaultPasswordHash, defaultRole, 'ativo', new Date().toISOString());
      }
      console.log(`[db] Seed realizado com sucesso para o usuário: ${defaultUsername}`);
    }

  } catch (error) {
    console.error('[db] Erro durante o bootstrapping/seeding do banco de dados:', error);
  }
}

// Executar bootstrapping de forma assíncrona logo após inicializar a conexão
bootstrap();

export { db, isPostgres };

