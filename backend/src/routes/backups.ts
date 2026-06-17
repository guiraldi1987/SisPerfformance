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
