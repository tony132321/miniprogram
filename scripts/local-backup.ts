import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createLocalBackup } from '../src/local-backup.ts';
import { FileDeletionMarkerStore, restoreLocalBackupWithPrivacyReplay } from '../src/privacy-deletion-journal.ts';

const [action, first, second, markerPath, policyPath] = process.argv.slice(2);
if (!first || !second || !['backup', 'restore'].includes(action ?? '') ||
  (action === 'restore' && (!markerPath || !policyPath))) {
  process.stderr.write('Usage: pnpm exec tsx scripts/local-backup.ts backup <stopped-pglite-dir> <new-backup.tgz>\n');
  process.stderr.write('   or: pnpm exec tsx scripts/local-backup.ts restore <backup.tgz> <new-destination-dir> <external-marker.jsonl> <approved-policy.json>\n');
  process.exitCode = 2;
} else {
  try {
    if (action === 'backup') {
      const result = await createLocalBackup(resolve(first), resolve(second));
      process.stdout.write(JSON.stringify({ archive: resolve(second), ...result }) + '\n');
    } else {
      const replayed = await restoreLocalBackupWithPrivacyReplay(resolve(first), resolve(second),
        new FileDeletionMarkerStore(resolve(markerPath!)), await readFile(resolve(policyPath!), 'utf8'));
      process.stdout.write(JSON.stringify({ restored: resolve(second), verified: true, deletionMarkersReplayed: replayed }) + '\n');
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
