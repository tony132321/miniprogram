import type { Database } from './db.ts';
import { purgeExpiredQuarantine } from './privacy-quarantine.ts';

// At most one sweep runs at a time. The configured marker replay already
// performs the startup sweep; this keeps expiry moving while the API runs.
export function startPrivacyQuarantineMaintenance(db: Database, onError: () => void,
  intervalMs = 60 * 60_000): () => void {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1) throw new Error('Invalid privacy maintenance interval');
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void purgeExpiredQuarantine(db, 'operator:scheduled-privacy-expiry')
      .catch(() => onError())
      .finally(() => { running = false; });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
