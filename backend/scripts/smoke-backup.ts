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
