import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createDatabase } from './db.ts';

export async function createLocalBackup(sourceDir: string, archivePath: string): Promise<{ sha256: string; bytes: number }> {
  const source = await stat(sourceDir);
  if (!source.isDirectory()) throw new Error('PGlite source must be a directory');
  try { await stat(join(sourceDir, 'PG_VERSION')); }
  catch { throw new Error('PGlite source is missing PG_VERSION'); }
  const file = await open(archivePath, 'wx', 0o600);
  let complete = false;
  try {
    const db = await PGlite.create(sourceDir);
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(await (await db.dumpDataDir('gzip')).arrayBuffer()); }
    finally { await db.close(); }
    await file.writeFile(bytes);
    await file.sync();
    complete = true;
    return { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength };
  } finally {
    await file.close();
    if (!complete) await rm(archivePath, { force: true });
  }
}

// Explicitly limited to synthetic test snapshots. Real restores must use
// restoreLocalBackupWithPrivacyReplay so an old backup cannot revive deletions.
export async function restoreLocalBackupUnprotectedSynthetic(archivePath: string, destinationDir: string): Promise<void> {
  const bytes = await readFile(archivePath);
  await mkdir(destinationDir);
  try {
    const db = await PGlite.create({ dataDir: destinationDir, loadDataDir: new Blob([new Uint8Array(bytes)]) });
    await db.close();
    const verified = await createDatabase(destinationDir);
    await verified.close();
  } catch (error) {
    await rm(destinationDir, { recursive: true, force: true });
    throw error;
  }
}
