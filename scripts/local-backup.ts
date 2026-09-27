import { resolve } from 'node:path';
import { createLocalBackup, restoreLocalBackup } from '../src/local-backup.ts';

const [action, first, second] = process.argv.slice(2);
if (!first || !second || !['backup', 'restore'].includes(action ?? '')) {
  process.stderr.write('Usage: pnpm exec tsx scripts/local-backup.ts backup <stopped-pglite-dir> <new-backup.tgz>\n');
  process.stderr.write('   or: pnpm exec tsx scripts/local-backup.ts restore <backup.tgz> <new-destination-dir>\n');
  process.exitCode = 2;
} else {
  try {
    if (action === 'backup') {
      const result = await createLocalBackup(resolve(first), resolve(second));
      process.stdout.write(JSON.stringify({ archive: resolve(second), ...result }) + '\n');
    } else {
      await restoreLocalBackup(resolve(first), resolve(second));
      process.stdout.write(JSON.stringify({ restored: resolve(second), verified: true }) + '\n');
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
