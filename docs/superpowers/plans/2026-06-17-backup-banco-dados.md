# Backup do Banco de Dados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir gerar backups (.zip com o banco SQLite + as fotos dos atletas), salvá-los numa pasta na VPS, listá-los/baixá-los/excluí-los pela interface, com um backup automático diário.

**Architecture:** Geração nativa em Node — `better-sqlite3.backup()` faz um snapshot consistente do `ieeegp.db` em modo WAL, `archiver` compacta o snapshot + `uploads/` num `.zip`, e `node-cron` agenda a execução diária. Um service isolado (`backup.ts`) concentra a lógica; rotas Hono finas e um agendador no boot consomem a mesma função `createBackup(source)`.

**Tech Stack:** Hono v4, Drizzle, better-sqlite3 (já existentes); `archiver` + `node-cron` (novos); React 19 + Vite + Tailwind v4 no frontend.

## Global Constraints

Copiados verbatim do spec (`docs/superpowers/specs/2026-06-17-backup-banco-dados-design.md`) e do `CLAUDE.md`. Valem para TODAS as tasks:

- **Branch:** trabalhar em `feat/backup-banco-dados` (já criada). `main` é produção — não commitar nela.
- **Dependências novas permitidas:** apenas `archiver` e `node-cron` (+ `@types/*`). Nenhuma outra.
- **Sem framework de testes:** o projeto não tem test runner. Verificação via **smoke script standalone** (`node`/`tsx`) + teste manual. NÃO instalar vitest/jest (spec §11; instrução do usuário tem precedência sobre o TDD padrão do skill).
- **Comentários:** zero por padrão. Só comentar o "porquê" não-óbvio; nunca o "o quê".
- **Sem feature flag, sem backward-compat shim** (1 cliente).
- **Retenção:** manter os **5** backups `auto` mais recentes; backups `manual` ficam até o usuário excluir.
- **Horário do automático:** **03:00 America/Sao_Paulo**.
- **Acesso:** todas as rotas só autenticadas (JWT de `/api/*`), sem trava por papel.
- **Path traversal:** `:filename` validado contra `^apexpro-backup-(auto|manual)-\d{4}-\d{2}-\d{2}_\d{4}\.zip$`; caminho final resolvido e conferido dentro de `backend/backups/`.
- **`backend/backups/`** deve estar no `.gitignore`; nunca servido pela rota estática pública `/uploads/*`.
- **Postgres fora de escopo:** se `isPostgres`, `createBackup` lança erro claro em vez de gerar zip inválido.

## File Structure

- `backend/package.json` — **Modify:** adicionar deps `archiver`, `node-cron` (+ types) e script `smoke:backup`.
- `backend/src/db/index.ts` — **Modify:** exportar `snapshotDatabase(destPath)`.
- `backend/src/services/backup.ts` — **Create:** lógica isolada (criar/listar/excluir/podar/validar).
- `backend/scripts/smoke-backup.ts` — **Create:** smoke test do service.
- `backend/src/routes/backups.ts` — **Create:** 4 endpoints HTTP.
- `backend/src/index.ts` — **Modify:** registrar a rota + iniciar o cron + garantir a pasta.
- `.gitignore` — **Modify:** adicionar `backend/backups/`.
- `frontend/src/pages/Backups.tsx` — **Create:** página (criar/listar/baixar/excluir).
- `frontend/src/App.tsx` — **Modify:** import lazy + `<Route path="/backups">`.
- `frontend/src/pages/Layout.tsx` — **Modify:** ícone + NavLink "Backups".
- `HANDOVER.md` — **Modify:** registrar Fase 29.

---

## Task 1: Dependências + .gitignore

**Files:**
- Modify: `backend/package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nada.
- Produces: `archiver` e `node-cron` instalados em `backend/node_modules`; `backend/backups/` ignorado pelo git.

- [ ] **Step 1: Adicionar as dependências**

Run (na raiz do repositório):

```bash
npm --prefix backend install archiver "node-cron@^3"
npm --prefix backend install -D @types/archiver @types/node-cron
```

> `node-cron` fixado em `^3`: a v4 mudou a assinatura de `cron.schedule(...)`. O código da Task 4 usa a API estável da v3 (`cron.schedule(expr, fn, { timezone })`).

- [ ] **Step 2: Verificar que as deps entraram**

Run:

```bash
npm --prefix backend ls archiver node-cron
```

Expected: lista `archiver@…` e `node-cron@…` sem `(empty)`.

- [ ] **Step 3: Ignorar a pasta de backups no git**

Em `.gitignore`, logo após a linha `backend/uploads/`, adicionar:

```gitignore
backend/backups/
```

- [ ] **Step 4: Confirmar que o git ignora a pasta**

Run:

```bash
mkdir -p backend/backups && touch backend/backups/.keeptest
git check-ignore backend/backups/.keeptest
rm backend/backups/.keeptest
```

Expected: `git check-ignore` imprime `backend/backups/.keeptest` (ou seja, está ignorado).

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json .gitignore
git commit -m "build(backup): adiciona archiver + node-cron e ignora backend/backups/"
```

---

## Task 2: Service de backup + smoke test

**Files:**
- Modify: `backend/src/db/index.ts`
- Create: `backend/src/services/backup.ts`
- Create: `backend/scripts/smoke-backup.ts`
- Modify: `backend/package.json` (script `smoke:backup`)

**Interfaces:**
- Consumes: `snapshotDatabase` e `isPostgres` de `../db`.
- Produces:
  - `snapshotDatabase(destPath: string): Promise<void>`
  - `interface BackupMeta { filename: string; size: number; createdAt: string; source: 'auto' | 'manual' }`
  - `createBackup(source: 'auto' | 'manual'): Promise<BackupMeta>`
  - `listBackups(): BackupMeta[]`
  - `deleteBackup(filename: string): boolean`
  - `resolveBackupPath(filename: string): string` (string vazia se inválido)
  - `isValidBackupName(filename: string): boolean`
  - `pruneAutoBackups(): void`
  - `ensureBackupsDir(): void`

- [ ] **Step 1: Escrever o smoke test (vai falhar — módulos ainda não existem)**

Create `backend/scripts/smoke-backup.ts`:

```ts
import { strict as assert } from 'assert';
import Database from 'better-sqlite3';
import { existsSync, readFileSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { snapshotDatabase } from '../src/db';
import { createBackup, listBackups, deleteBackup, resolveBackupPath } from '../src/services/backup';

async function main() {
  // 1) snapshotDatabase gera um SQLite válido
  const snap = join(process.cwd(), '.smoke-snapshot.db');
  await snapshotDatabase(snap);
  assert.ok(existsSync(snap), 'snapshot não foi criado');
  const header = readFileSync(snap).subarray(0, 15).toString('utf8');
  assert.equal(header, 'SQLite format 3', 'snapshot não tem header SQLite');
  const sdb = new Database(snap, { readonly: true });
  const row = sdb.prepare('SELECT count(*) AS c FROM usuarios').get() as { c: number };
  assert.equal(typeof row.c, 'number', 'tabela usuarios ausente no snapshot');
  sdb.close();
  unlinkSync(snap);
  console.log('✓ snapshotDatabase gera um SQLite válido');

  // 2) createBackup produz um .zip válido e não-trivial
  const meta = await createBackup('manual');
  const zipPath = resolveBackupPath(meta.filename);
  assert.ok(zipPath && existsSync(zipPath), 'zip não foi criado');
  assert.ok(statSync(zipPath).size > 100, 'zip vazio ou curto demais');
  const buf = readFileSync(zipPath);
  const eocd = buf.subarray(buf.length - 22);
  assert.ok(
    eocd[0] === 0x50 && eocd[1] === 0x4b && eocd[2] === 0x05 && eocd[3] === 0x06,
    'assinatura EOCD do zip ausente (zip inválido)',
  );
  console.log(`✓ createBackup gerou ${meta.filename} (${meta.size} bytes)`);

  // 3) listBackups inclui e deleteBackup remove
  assert.ok(listBackups().some(b => b.filename === meta.filename), 'backup não apareceu na listagem');
  assert.ok(deleteBackup(meta.filename), 'deleteBackup retornou false');
  assert.ok(!existsSync(zipPath), 'zip não foi removido');
  console.log('✓ list + delete roundtrip OK');

  console.log('\nSMOKE OK');
}

main().catch(err => { console.error('SMOKE FALHOU:', err); process.exit(1); });
```

- [ ] **Step 2: Adicionar o script `smoke:backup` no package.json**

Em `backend/package.json`, dentro de `"scripts"`, adicionar:

```json
    "smoke:backup": "tsx scripts/smoke-backup.ts",
```

- [ ] **Step 3: Rodar o smoke e confirmar que FALHA**

Run:

```bash
npm --prefix backend run smoke:backup
```

Expected: FALHA com erro de import (`Cannot find module '../src/services/backup'` ou `snapshotDatabase is not a function`).

- [ ] **Step 4: Adicionar `snapshotDatabase` em db/index.ts**

Em `backend/src/db/index.ts`, logo antes da linha `export { db, isPostgres };` (final do arquivo), adicionar:

```ts
export async function snapshotDatabase(destPath: string): Promise<void> {
  if (isPostgres || !sqlite) {
    throw new Error('Snapshot disponível apenas para SQLite (produção).');
  }
  await sqlite.backup(destPath);
}
```

- [ ] **Step 5: Criar o service**

Create `backend/src/services/backup.ts`:

```ts
import archiver from 'archiver';
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { snapshotDatabase, isPostgres } from '../db';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BACKEND_ROOT = resolve(__dirname, '..', '..');
const UPLOADS_DIR = join(BACKEND_ROOT, 'uploads');
const BACKUPS_DIR = join(BACKEND_ROOT, 'backups');
const RETENTION_AUTO = Number(process.env.BACKUP_RETENTION ?? 5);
const NAME_RE = /^apexpro-backup-(auto|manual)-\d{4}-\d{2}-\d{2}_\d{4}\.zip$/;

export interface BackupMeta {
  filename: string;
  size: number;
  createdAt: string;
  source: 'auto' | 'manual';
}

export function ensureBackupsDir(): void {
  if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });
}

export function isValidBackupName(name: string): boolean {
  return NAME_RE.test(name);
}

export function resolveBackupPath(name: string): string {
  if (!isValidBackupName(name)) return '';
  const full = resolve(BACKUPS_DIR, name);
  const root = resolve(BACKUPS_DIR);
  if (full !== root && !full.startsWith(root + sep)) return '';
  return full;
}

function timestampSaoPaulo(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}_${get('hour')}${get('minute')}`;
}

export function listBackups(): BackupMeta[] {
  ensureBackupsDir();
  return readdirSync(BACKUPS_DIR)
    .filter(f => NAME_RE.test(f))
    .map(f => {
      const st = statSync(join(BACKUPS_DIR, f));
      const source: 'auto' | 'manual' = f.includes('-auto-') ? 'auto' : 'manual';
      return { filename: f, size: st.size, createdAt: st.mtime.toISOString(), source };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function deleteBackup(name: string): boolean {
  const full = resolveBackupPath(name);
  if (!full || !existsSync(full)) return false;
  unlinkSync(full);
  return true;
}

export function pruneAutoBackups(): void {
  const autos = listBackups().filter(b => b.source === 'auto');
  for (const b of autos.slice(RETENTION_AUTO)) {
    deleteBackup(b.filename);
  }
}

export async function createBackup(source: 'auto' | 'manual'): Promise<BackupMeta> {
  if (isPostgres) {
    throw new Error('Backup disponível apenas para SQLite (produção). DB_TYPE=postgres não suportado.');
  }
  ensureBackupsDir();

  const ts = timestampSaoPaulo();
  const filename = `apexpro-backup-${source}-${ts}.zip`;
  const zipPath = join(BACKUPS_DIR, filename);
  const tmpDbPath = join(BACKUPS_DIR, `.snapshot-${source}-${ts}.db`);

  await snapshotDatabase(tmpDbPath);

  await new Promise<void>((resolvePromise, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolvePromise());
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.file(tmpDbPath, { name: 'ieeegp.db' });
    if (existsSync(UPLOADS_DIR)) archive.directory(UPLOADS_DIR, 'uploads');
    archive.finalize();
  });

  for (const ext of ['', '-wal', '-shm']) {
    const p = tmpDbPath + ext;
    if (existsSync(p)) unlinkSync(p);
  }

  if (source === 'auto') pruneAutoBackups();

  const { size } = statSync(zipPath);
  return { filename, size, createdAt: new Date().toISOString(), source };
}
```

- [ ] **Step 6: Rodar o smoke e confirmar que PASSA**

Run:

```bash
npm --prefix backend run smoke:backup
```

Expected: termina com `SMOKE OK` (e as 3 linhas `✓`).

- [ ] **Step 7: Commit**

```bash
git add backend/src/db/index.ts backend/src/services/backup.ts backend/scripts/smoke-backup.ts backend/package.json
git commit -m "feat(backup): service de criacao/listagem/exclusao com snapshot SQLite + zip"
```

---

## Task 3: Endpoints HTTP

**Files:**
- Create: `backend/src/routes/backups.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `createBackup`, `listBackups`, `deleteBackup`, `resolveBackupPath`, `isValidBackupName` de `../services/backup`.
- Produces: rotas `POST/GET /api/backups`, `GET/DELETE /api/backups/:filename` (sob JWT).

- [ ] **Step 1: Criar o router**

Create `backend/src/routes/backups.ts`:

```ts
import { Hono } from 'hono';
import { existsSync, readFileSync } from 'fs';
import { createBackup, listBackups, deleteBackup, resolveBackupPath, isValidBackupName } from '../services/backup';

const backupsRouter = new Hono();

// GET / — lista backups salvos
backupsRouter.get('/', (c) => {
  try {
    return c.json(listBackups());
  } catch (err) {
    console.error('[backups] erro ao listar:', err);
    return c.json({ erro: 'Falha ao listar backups' }, 500);
  }
});

// POST / — cria um backup manual agora
backupsRouter.post('/', async (c) => {
  try {
    const meta = await createBackup('manual');
    return c.json(meta, 201);
  } catch (err: any) {
    console.error('[backups] erro ao criar:', err);
    return c.json({ erro: err?.message ?? 'Falha ao criar backup' }, 500);
  }
});

// GET /:filename — baixa o .zip
backupsRouter.get('/:filename', (c) => {
  const filename = c.req.param('filename');
  const full = resolveBackupPath(filename);
  if (!full) return c.json({ erro: 'Nome de arquivo inválido' }, 400);
  if (!existsSync(full)) return c.json({ erro: 'Backup não encontrado' }, 404);
  const data = readFileSync(full);
  return c.body(data, 200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
});

// DELETE /:filename — exclui o .zip
backupsRouter.delete('/:filename', (c) => {
  const filename = c.req.param('filename');
  if (!isValidBackupName(filename)) return c.json({ erro: 'Nome de arquivo inválido' }, 400);
  const ok = deleteBackup(filename);
  if (!ok) return c.json({ erro: 'Backup não encontrado' }, 404);
  return c.json({ sucesso: true });
});

export default backupsRouter;
```

- [ ] **Step 2: Registrar o router no index.ts**

Em `backend/src/index.ts`:

No bloco de imports (após a linha `import usuariosRouter from './routes/usuarios';`), adicionar:

```ts
import backupsRouter from './routes/backups';
```

Após a linha `app.route('/api/usuarios', usuariosRouter);`, adicionar:

```ts
app.route('/api/backups', backupsRouter);
```

- [ ] **Step 3: Subir o backend**

Run (terminal dedicado):

```bash
npm --prefix backend run dev
```

Expected: log `Server is running on port 3001` e `[db] Conectado ao banco SQLite local`.

- [ ] **Step 4: Testar o ciclo completo via PowerShell (autenticado)**

Run (substituir `<SENHA>` pela senha real do usuário `eduardo.tavares`):

```powershell
$login = Invoke-RestMethod -Uri http://localhost:3001/api/auth/login -Method Post -ContentType 'application/json' -Body (@{ username='eduardo.tavares'; password='<SENHA>' } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod -Uri http://localhost:3001/api/backups -Method Post -Headers $h            # cria
$lista = Invoke-RestMethod -Uri http://localhost:3001/api/backups -Headers $h                 # lista
$nome  = $lista[0].filename
Invoke-WebRequest -Uri "http://localhost:3001/api/backups/$nome" -Headers $h -OutFile "$env:TEMP\$nome"   # baixa
Invoke-RestMethod -Uri "http://localhost:3001/api/backups/$nome" -Method Delete -Headers $h   # exclui
```

Expected: POST retorna `{ filename; size; createdAt; source='manual' }`; a lista contém o item; `Invoke-WebRequest` salva o zip em `%TEMP%`; DELETE retorna `{ sucesso = $true }`.

- [ ] **Step 5: Confirmar que sem token dá 401**

Run:

```powershell
try { Invoke-RestMethod -Uri http://localhost:3001/api/backups -Method Post } catch { $_.Exception.Response.StatusCode.value__ }
```

Expected: `401`.

- [ ] **Step 6: Confirmar que filename inválido dá 400 (sem path traversal)**

Run:

```powershell
try { Invoke-RestMethod -Uri "http://localhost:3001/api/backups/..%2F..%2Fieeegp.db" -Headers $h } catch { $_.Exception.Response.StatusCode.value__ }
```

Expected: `400`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/backups.ts backend/src/index.ts
git commit -m "feat(backup): endpoints autenticados criar/listar/baixar/excluir"
```

---

## Task 4: Agendador diário automático

**Files:**
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `createBackup`, `ensureBackupsDir` de `./services/backup`; `isPostgres` de `./db`; `node-cron`.
- Produces: backup `auto` diário às 03:00 America/Sao_Paulo; pasta `backend/backups/` criada no boot.

- [ ] **Step 1: Adicionar imports do cron e do service no index.ts**

Em `backend/src/index.ts`, no bloco de imports, adicionar:

```ts
import cron from 'node-cron';
import { ensureBackupsDir, createBackup } from './services/backup';
import { isPostgres } from './db';
```

- [ ] **Step 2: Iniciar a pasta e o agendador após o `serve(...)`**

Em `backend/src/index.ts`, ao final do arquivo (após o bloco `serve({ ... });`), adicionar:

```ts
ensureBackupsDir();

if (!isPostgres) {
  cron.schedule('0 3 * * *', async () => {
    try {
      const meta = await createBackup('auto');
      console.log(`[backup] automático criado: ${meta.filename} (${meta.size} bytes)`);
    } catch (err) {
      console.error('[backup] falha no backup automático:', err);
    }
  }, { timezone: 'America/Sao_Paulo' });
  console.log('[backup] agendador diário ativo (03:00 America/Sao_Paulo)');
}
```

- [ ] **Step 3: Subir o backend e confirmar o agendador + a pasta**

Run:

```bash
npm --prefix backend run dev
```

Expected: aparece a linha `[backup] agendador diário ativo (03:00 America/Sao_Paulo)` e a pasta `backend/backups/` existe.

- [ ] **Step 4: (Opcional) Verificar o disparo trocando o cron para cada minuto**

Trocar temporariamente `'0 3 * * *'` por `'* * * * *'`, subir o backend, aguardar a virada do minuto e confirmar no log `[backup] automático criado: apexpro-backup-auto-…`. **Reverter para `'0 3 * * *'` em seguida** e apagar o zip de teste gerado.

- [ ] **Step 5: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat(backup): agendador diario 03:00 America/Sao_Paulo + pasta no boot"
```

---

## Task 5: Página de Backups no frontend

**Files:**
- Create: `frontend/src/pages/Backups.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Layout.tsx`

**Interfaces:**
- Consumes: `API_BASE` (`../lib/api`), `useToast` (`../components/Toast`), `ConfirmModal` (`../components/ConfirmModal`); endpoints `/api/backups` da Task 3.
- Produces: rota `/backups` acessível pelo menu lateral "Administração".

- [ ] **Step 1: Criar a página**

Create `frontend/src/pages/Backups.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';

interface BackupMeta {
  filename: string;
  size: number;
  createdAt: string;
  source: 'auto' | 'manual';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// "apexpro-backup-manual-2026-06-17_1430.zip" -> "17/06/2026 14:30"
function formatFromName(filename: string): string {
  const m = filename.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/);
  if (!m) return filename;
  const [, y, mo, d, h, mi] = m;
  return `${d}/${mo}/${y} ${h}:${mi}`;
}

export const Backups = () => {
  const toast = useToast();
  const [list, setList] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  const fetchList = async () => {
    try {
      const res = await fetch(`${API_BASE}/backups`);
      if (!res.ok) throw new Error();
      setList(await res.json());
    } catch {
      toast.error('Falha ao carregar a lista de backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/backups`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Backup criado com sucesso');
      await fetchList();
    } catch {
      toast.error('Falha ao criar o backup');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (filename: string) => {
    setDownloading(filename);
    try {
      const res = await fetch(`${API_BASE}/backups/${filename}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Falha ao baixar o backup');
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    const filename = confirmTarget;
    setConfirmTarget(null);
    try {
      const res = await fetch(`${API_BASE}/backups/${filename}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Backup excluído');
      await fetchList();
    } catch {
      toast.error('Falha ao excluir o backup');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-outfit">Backups</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Backup automático diário às 03:00. Mantém os últimos 5 automáticos; os manuais ficam até serem excluídos.
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="px-5 py-2.5 rounded-xl text-sm font-bold bg-club-red text-white hover:brightness-110 shadow-lg shadow-club-red/25 transition-all active:scale-95 disabled:opacity-60"
        >
          {creating ? 'Criando…' : 'Criar backup agora'}
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm">Carregando…</p>
      ) : list.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm">Nenhum backup ainda. Clique em "Criar backup agora".</p>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-extrabold">
              <tr>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Origem</th>
                <th className="text-left px-4 py-3">Tamanho</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {list.map(b => (
                <tr key={b.filename} className="text-slate-700 dark:text-slate-200">
                  <td className="px-4 py-3 font-semibold">{formatFromName(b.filename)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      b.source === 'auto'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    }`}>
                      {b.source === 'auto' ? 'Automático' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatSize(b.size)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDownload(b.filename)}
                        disabled={downloading === b.filename}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-club-red hover:bg-club-red/5 transition-colors disabled:opacity-60"
                      >
                        {downloading === b.filename ? 'Baixando…' : 'Baixar'}
                      </button>
                      <button
                        onClick={() => setConfirmTarget(b.filename)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-500/5 transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={confirmTarget !== null}
        message="Tem certeza que deseja excluir este backup? Esta ação não pode ser desfeita."
        details={confirmTarget ? formatFromName(confirmTarget) : undefined}
        confirmLabel="Sim, excluir"
        onConfirm={handleDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
};
```

- [ ] **Step 2: Registrar a rota lazy no App.tsx**

Em `frontend/src/App.tsx`, após a linha do `Usuarios` (`const Usuarios = React.lazy(...)`), adicionar:

```tsx
const Backups = React.lazy(() => import('./pages/Backups').then(m => ({ default: m.Backups })));
```

Após a linha `<Route path="/usuarios" element={<Usuarios />} />`, adicionar:

```tsx
                    <Route path="/backups"     element={<Backups />} />
```

- [ ] **Step 3: Adicionar o ícone no Layout.tsx**

Em `frontend/src/pages/Layout.tsx`, dentro do objeto `Icon`, após a entrada `Compare`, adicionar:

```tsx
  Backup: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  ),
```

- [ ] **Step 4: Adicionar o NavLink no grupo Administração**

Em `frontend/src/pages/Layout.tsx`, logo após a linha do NavLink de Usuários (`<NavLink to="/usuarios" ...>… Usuários</NavLink>`), adicionar:

```tsx
              <NavLink to="/backups"   className={navCls}><Icon.Backup />  Backups</NavLink>
```

- [ ] **Step 5: Confirmar que o frontend builda**

Run:

```bash
npm --prefix frontend run build
```

Expected: build conclui sem erros (exit 0).

- [ ] **Step 6: Teste manual da UI**

Run `npm --prefix frontend run dev` (com o backend rodando), logar, clicar em **Backups** no menu lateral. Confirmar: criar gera item na lista; baixar baixa o `.zip` (abre num descompactador e contém `ieeegp.db` + `uploads/`); excluir pede confirmação e remove.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Backups.tsx frontend/src/App.tsx frontend/src/pages/Layout.tsx
git commit -m "feat(backup): pagina Backups (criar/listar/baixar/excluir) + rota e menu"
```

---

## Task 6: Documentação (HANDOVER Fase 29)

**Files:**
- Modify: `HANDOVER.md`

**Interfaces:**
- Consumes: nada.
- Produces: registro da feature no histórico de fases.

- [ ] **Step 1: Adicionar a Fase 29 ao HANDOVER**

Seguindo o padrão das fases existentes no `HANDOVER.md`, adicionar uma seção "Fase 29" com este conteúdo, e atualizar as seções de Estrutura/Endpoints/Páginas e a data no rodapé:

```markdown
## Fase 29 — Backup do banco de dados

Feature de backup acessível pelo menu Administração → Backups.

- **O que faz:** gera um `.zip` com snapshot consistente do `ieeegp.db` (via `better-sqlite3.backup()`) + a pasta `uploads/` (fotos dos atletas), salvo em `backend/backups/` na VPS.
- **Disparo:** botão "Criar backup agora" (manual) + automático diário às 03:00 America/Sao_Paulo (`node-cron`).
- **Retenção:** mantém os 5 backups automáticos mais recentes; manuais ficam até exclusão.
- **Endpoints** (sob JWT): `POST /api/backups`, `GET /api/backups`, `GET /api/backups/:filename` (download), `DELETE /api/backups/:filename`.
- **Arquivos:** `backend/src/services/backup.ts`, `backend/src/routes/backups.ts`, `backend/src/db/index.ts` (`snapshotDatabase`), `frontend/src/pages/Backups.tsx`.
- **Deps novas:** `archiver`, `node-cron`.
- **Deploy:** após `git pull` na VPS, rodar `npm install` no backend (deps novas) antes do `pm2 restart apexpro-backend`. A pasta `backend/backups/` é criada no boot e está no `.gitignore`.
```

- [ ] **Step 2: Atualizar a data do rodapé do HANDOVER**

Atualizar a linha de data/versão no rodapé do `HANDOVER.md` para `2026-06-17`.

- [ ] **Step 3: Commit**

```bash
git add HANDOVER.md
git commit -m "docs(backup): registra Fase 29 no HANDOVER"
```

---

## Notas de deploy (pós-merge na main)

Conforme Fase 27 do HANDOVER, na VPS: `git pull` → **`npm --prefix backend install`** (instala `archiver` + `node-cron`) → `npm --prefix frontend run build` → `pm2 restart apexpro-backend`. A pasta `backend/backups/` é criada automaticamente no boot. O agendador sobe junto com o processo `pm2`.
