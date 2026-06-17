import { ZipArchive } from 'archiver';
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

  try {
    await new Promise<void>((resolvePromise, reject) => {
      const output = createWriteStream(zipPath);
      const archive = new ZipArchive({ zlib: { level: 9 } });
      output.on('close', () => resolvePromise());
      output.on('error', reject);
      archive.on('error', reject);
      archive.pipe(output);
      archive.file(tmpDbPath, { name: 'ieeegp.db' });
      if (existsSync(UPLOADS_DIR)) archive.directory(UPLOADS_DIR, 'uploads');
      archive.finalize();
    });
  } finally {
    for (const ext of ['', '-wal', '-shm']) {
      const p = tmpDbPath + ext;
      if (existsSync(p)) unlinkSync(p);
    }
  }

  if (source === 'auto') pruneAutoBackups();

  const { size, mtime } = statSync(zipPath);
  return { filename, size, createdAt: mtime.toISOString(), source };
}
