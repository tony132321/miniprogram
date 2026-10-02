import type { Database } from './db.ts';
import { purgeExpiredQuarantine } from './privacy-quarantine.ts';
import { aiInputCleanupEligible, purgeExpiredAiInput } from './privacy-ai-expiry.ts';
import { ordinaryProfileExpiryEligible, purgeExpiredOrdinaryProfiles } from './privacy-profile-expiry.ts';
import type { DeletionMarkerStore } from './privacy-deletion-journal.ts';

type ExpiryConfig = { markerStore: DeletionMarkerStore; approvedPolicyJson: string };

// At most one sweep runs at a time. The configured marker replay already
// performs the startup sweep; this keeps expiry moving while the API runs.
export function startPrivacyQuarantineMaintenance(db: Database, onError: () => void,
  intervalMs = 60 * 60_000, expiry?: ExpiryConfig): () => void {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1) throw new Error('Invalid privacy maintenance interval');
  const aiEnabled = expiry ? aiInputCleanupEligible(expiry.approvedPolicyJson) : false;
  const profileEnabled = expiry ? ordinaryProfileExpiryEligible(expiry.approvedPolicyJson) : false;
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void (async () => {
      await purgeExpiredQuarantine(db, 'operator:scheduled-privacy-expiry');
      if (aiEnabled) await purgeExpiredAiInput(db, 'operator:scheduled-privacy-expiry');
      if (profileEnabled && expiry) await purgeExpiredOrdinaryProfiles(db, expiry.markerStore,
        expiry.approvedPolicyJson, 'operator:scheduled-privacy-expiry');
    })()
      .catch(() => onError())
      .finally(() => { running = false; });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
