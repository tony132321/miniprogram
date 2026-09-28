import { createHash } from 'node:crypto';
import { open, readFile, rm, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Database } from './db.ts';
import { createDatabase } from './db.ts';
import { restoreLocalBackupUnprotectedSynthetic } from './local-backup.ts';
import { createPrivacyRequest } from './operations.ts';
import { executePrivacyDeletionSafeguards } from './privacy-deletion.ts';
import { deidentifySharedActivity } from './privacy-shared-deidentification.ts';
import { isolateDisputeRecords, purgeExpiredQuarantine, validateDisputeRetentionRule } from './privacy-quarantine.ts';
import { aiInputCleanupEligible, purgeExpiredAiInput, scheduleAiInputCleanup } from './privacy-ai-expiry.ts';
import { expireOrdinaryProfile, ordinaryProfileExpiryEligible } from './privacy-profile-expiry.ts';
import { validateRetentionPolicy } from './retention-policy.ts';
import { AppError } from './errors.ts';

type DeletionMarker = {
  schema: 'project-irl/deletion-marker-v1';
  requestId: string;
  userId: string;
  policySha256: string;
  recordedAt: string;
};

export interface DeletionMarkerStore {
  append(marker: DeletionMarker): Promise<void>;
  list(): Promise<DeletionMarker[]>;
}

// Local single-writer rehearsal adapter. Production needs a separately
// protected, durable store outside every database backup and restore scope.
export class FileDeletionMarkerStore implements DeletionMarkerStore {
  constructor(private readonly path: string) {}

  async append(marker: DeletionMarker): Promise<void> {
    let created = false;
    try { await stat(this.path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      created = true;
    }
    const file = await open(this.path, 'a', 0o600);
    try {
      await file.writeFile(`${JSON.stringify(marker)}\n`);
      await file.sync();
    } finally { await file.close(); }
    if (created) {
      const parent = await open(dirname(this.path), 'r');
      try { await parent.sync(); }
      finally { await parent.close(); }
    }
  }

  async list(): Promise<DeletionMarker[]> {
    // Missing journal is not an empty journal: a restore cannot prove that no
    // deletion happened after its snapshot without an authoritative source.
    let contents: string;
    try { contents = await readFile(this.path, 'utf8'); }
    catch { throw new Error('Deletion marker journal is unavailable'); }
    if (contents && !contents.endsWith('\n')) throw new Error('Deletion marker journal has a partial trailing record');
    return contents.split('\n').filter(Boolean).map(line => {
      const value = JSON.parse(line) as Partial<DeletionMarker>;
      if (value.schema !== 'project-irl/deletion-marker-v1' ||
        typeof value.requestId !== 'string' || !value.requestId ||
        typeof value.userId !== 'string' || !value.userId ||
        !/^[a-f0-9]{64}$/.test(value.policySha256 ?? '') ||
        typeof value.recordedAt !== 'string' || !Number.isFinite(Date.parse(value.recordedAt)))
        throw new Error('Deletion marker journal contains an invalid record');
      return value as DeletionMarker;
    });
  }
}

function policyHash(raw: string | undefined): string {
  validateRetentionPolicy(raw);
  return createHash('sha256').update(raw!).digest('hex');
}

export async function executePrivacyDeletionWithMarker(db: Database, markerStore: DeletionMarkerStore,
  operator: string, requestId: string, approvedPolicyJson: string | undefined) {
  const policySha256 = policyHash(approvedPolicyJson);
  validateDisputeRetentionRule(approvedPolicyJson!);
  const aiExpiryEnabled = aiInputCleanupEligible(approvedPolicyJson!);
  const profileExpiryEnabled = ordinaryProfileExpiryEligible(approvedPolicyJson!);
  if (!markerStore) throw new Error('Deletion marker store is required');
  if (!operator.startsWith('operator:')) throw new AppError('FORBIDDEN', '需要运营身份', 403);
  // The marker is an irrevocable execution intent. Hold the user/send fence
  // and request locks through its fsync and the matching DB status commit.
  // If the process fails after fsync but before commit, replay still honors
  // the marker and completes the deletion; it must never be discarded.
  const intent = await db.transaction(async tx => {
    const { rows: identities } = await tx.query<{ user_id: string }>(
      "SELECT user_id FROM privacy_requests WHERE id=$1 AND kind='DELETE'", [requestId]);
    if (!identities[0]) throw new AppError('NOT_FOUND', '注销或删除申请不存在', 404);
    const userId = identities[0].user_id;
    const { rows: users } = await tx.query<{ id: string }>('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!users[0]) throw new AppError('NOT_FOUND', '账号不存在', 404);
    const { rows: requests } = await tx.query<{ user_id: string; status: string; protection_applied_at: Date | null }>(
      "SELECT user_id,status,protection_applied_at FROM privacy_requests WHERE id=$1 AND kind='DELETE' FOR UPDATE", [requestId]);
    const request = requests[0];
    if (!request || request.user_id !== userId) throw new AppError('NOT_FOUND', '注销或删除申请不存在', 404);
    if (!request.protection_applied_at || ['CANCELLED', 'FULFILLED'].includes(request.status))
      throw new AppError('DELETE_NOT_PROTECTED', '注销申请尚未完成前置保护，不能执行', 409);
    const { rows: priorExecution } = await tx.query<{ user_id: string; policy_sha256: string }>(
      'SELECT user_id,policy_sha256 FROM privacy_deletion_executions WHERE request_id=$1 FOR UPDATE', [requestId]);
    if (priorExecution[0] && (priorExecution[0].user_id !== userId || priorExecution[0].policy_sha256 !== policySha256))
      throw new AppError('POLICY_MISMATCH', '此申请已按另一版本策略执行，不能记录冲突标记', 409);
    const recordedAt = new Date().toISOString();
    await markerStore.append({ schema: 'project-irl/deletion-marker-v1', requestId,
      userId, policySha256, recordedAt });
    if (request.status !== 'SAFEGUARDS_APPLIED_PENDING_REVIEW')
      await tx.query("UPDATE privacy_requests SET status='EXECUTION_INTENT_RECORDED' WHERE id=$1", [requestId]);
    return { userId, recordedAt };
  });
  const recordedMarkers = (await markerStore.list()).filter(marker => marker.requestId === requestId)
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  const marker = recordedMarkers[0];
  if (!marker || marker.userId !== intent.userId || marker.policySha256 !== policySha256 ||
    recordedMarkers.some(entry => entry.userId !== intent.userId || entry.policySha256 !== policySha256))
    throw new Error('Deletion marker journal conflicts with the applied request');
  const result = await executePrivacyDeletionSafeguards(db, operator, requestId, approvedPolicyJson);
  const { rows: applied } = await db.query<{ user_id: string; policy_sha256: string }>(
    'SELECT user_id,policy_sha256 FROM privacy_deletion_executions WHERE request_id=$1', [requestId]);
  if (applied[0]?.user_id !== intent.userId || applied[0]?.policy_sha256 !== policySha256)
    throw new Error('Deletion marker and applied request identity do not match');
  const dispute = await isolateDisputeRecords(db, operator, requestId, approvedPolicyJson!, marker.recordedAt);
  const shared = await deidentifySharedActivity(db, operator, requestId, approvedPolicyJson!);
  if (aiExpiryEnabled) await scheduleAiInputCleanup(db, operator, requestId, approvedPolicyJson!, marker.recordedAt);
  if (profileExpiryEnabled) await expireOrdinaryProfile(db, operator, requestId, approvedPolicyJson!, marker);
  const { rows: final } = await db.query<{ outcomes: typeof result.outcomes }>(
    'SELECT outcomes FROM privacy_deletion_executions WHERE request_id=$1', [requestId]);
  if (!final[0]) throw new Error('Deletion execution disappeared after disposition');
  return { ...result, outcomes: final[0].outcomes, dispute, shared };
}

export async function replayPrivacyDeletionMarkers(db: Database, markerStore: DeletionMarkerStore,
  approvedPolicyJson: string | undefined): Promise<number> {
  if (!markerStore) throw new Error('Deletion marker store is required');
  const markers = await markerStore.list();
  const approvedHash = policyHash(approvedPolicyJson);
  validateDisputeRetentionRule(approvedPolicyJson!);
  const aiExpiryEnabled = aiInputCleanupEligible(approvedPolicyJson!);
  const profileExpiryEnabled = ordinaryProfileExpiryEligible(approvedPolicyJson!);
  const unique = new Map<string, DeletionMarker>();
  for (const marker of markers) {
    const previous = unique.get(marker.requestId);
    if (previous && (previous.userId !== marker.userId || previous.policySha256 !== marker.policySha256))
      throw new Error('Deletion marker journal has conflicting request records');
    if (!previous || Date.parse(marker.recordedAt) < Date.parse(previous.recordedAt))
      unique.set(marker.requestId, marker);
  }
  for (const marker of unique.values()) {
    if (marker.policySha256 !== approvedHash) throw new Error('Deletion marker policy does not match approved policy');
    await db.transaction(async tx => {
      const { rows: users } = await tx.query<{ id: string }>(
        'SELECT id FROM users WHERE id=$1 FOR UPDATE', [marker.userId]);
      if (!users[0]) throw new Error('Deletion marker names an absent account');
      const { rows: requests } = await tx.query<{ user_id: string; kind: string; status: string }>(
        'SELECT user_id,kind,status FROM privacy_requests WHERE id=$1 FOR UPDATE', [marker.requestId]);
      if (requests[0] && (requests[0].user_id !== marker.userId || requests[0].kind !== 'DELETE'))
        throw new Error('Deletion marker conflicts with restored request');
      const { rows: execution } = await tx.query<{ user_id: string; policy_sha256: string }>(
        'SELECT user_id,policy_sha256 FROM privacy_deletion_executions WHERE request_id=$1 FOR UPDATE', [marker.requestId]);
      if (execution[0] && (execution[0].user_id !== marker.userId || execution[0].policy_sha256 !== approvedHash))
        throw new Error('Deletion marker conflicts with restored execution');
      if (!requests[0]) await tx.query(`INSERT INTO privacy_requests(id,user_id,kind,status)
        VALUES($1,$2,'DELETE','EXECUTION_INTENT_RECORDED')`, [marker.requestId, marker.userId]);
      else if (['CANCELLED', 'FULFILLED'].includes(requests[0].status)) {
        // The file fsync can outlive a rolled-back DB transaction. Its valid
        // marker wins over a later status update: restore the irrevocable
        // intent before intake repair and complete the remaining phases.
        await tx.query('UPDATE privacy_requests SET status=$2 WHERE id=$1', [marker.requestId,
          execution[0] ? 'SAFEGUARDS_APPLIED_PENDING_REVIEW' : 'EXECUTION_INTENT_RECORDED']);
      }
    });
    await createPrivacyRequest(db, marker.userId, { kind: 'DELETE' }, `restore-marker:${marker.requestId}`, 'STARTUP_REPAIR');
    await executePrivacyDeletionSafeguards(db, 'operator:restore', marker.requestId, approvedPolicyJson);
    await isolateDisputeRecords(db, 'operator:restore', marker.requestId, approvedPolicyJson!, marker.recordedAt);
    await deidentifySharedActivity(db, 'operator:restore', marker.requestId, approvedPolicyJson!);
    if (aiExpiryEnabled) await scheduleAiInputCleanup(db, 'operator:restore', marker.requestId,
      approvedPolicyJson!, marker.recordedAt);
    if (profileExpiryEnabled) await expireOrdinaryProfile(db, 'operator:restore', marker.requestId,
      approvedPolicyJson!, marker);
  }
  await purgeExpiredQuarantine(db, 'operator:restore');
  if (aiExpiryEnabled) await purgeExpiredAiInput(db, 'operator:restore');
  return unique.size;
}

export async function restoreLocalBackupWithPrivacyReplay(archivePath: string, destinationDir: string,
  markerStore: DeletionMarkerStore, approvedPolicyJson: string | undefined): Promise<number> {
  if (!markerStore) throw new Error('Deletion marker store is required');
  // Validate source and policy before restoring any stale personal data.
  await markerStore.list();
  policyHash(approvedPolicyJson);
  await restoreLocalBackupUnprotectedSynthetic(archivePath, destinationDir);
  try {
    const db = await createDatabase(destinationDir);
    try { return await replayPrivacyDeletionMarkers(db, markerStore, approvedPolicyJson); }
    finally { await db.close(); }
  } catch (error) {
    await rm(destinationDir, { recursive: true, force: true });
    throw error;
  }
}
