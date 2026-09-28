import { createHash, randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import type { DeletionMarkerStore } from './privacy-deletion-journal.ts';
import { AppError } from './errors.ts';
import { validateRetentionPolicy } from './retention-policy.ts';

type Marker = Parameters<DeletionMarkerStore['append']>[0];
type Counts = { notificationConsentsDeleted: number; notificationDetailsCleared: number;
  notificationRecipientsTombstoned: number; sessionsDeleted: number; exportTicketsDeleted: number;
  eventAliasesDeleted: number; aliasConsentLinksTombstoned: number };
type Ledger = { recipient_tombstone: string; expires_at: Date; disposition_counts: Counts;
  performed_at: Date };
const zero = (): Counts => ({ notificationConsentsDeleted: 0, notificationDetailsCleared: 0,
  notificationRecipientsTombstoned: 0, sessionsDeleted: 0, exportTicketsDeleted: 0,
  eventAliasesDeleted: 0, aliasConsentLinksTombstoned: 0 });

function rule(raw: string): { days: number; hash: string } {
  validateRetentionPolicy(raw);
  const policy = JSON.parse(raw) as { records: Array<{ class: string; status: string;
    approved_days?: number; approved_trigger?: string }> };
  const item = policy.records.find(record => record.class === 'ordinary_profile');
  if (!item || item.status !== 'APPROVED' || !Number.isSafeInteger(item.approved_days) ||
    item.approved_days! < 1 || item.approved_days! > 36_500 || item.approved_trigger !== 'DELETE_EXECUTION')
    throw new Error('ordinary_profile requires approved_days and DELETE_EXECUTION trigger for automated expiry');
  return { days: item.approved_days!, hash: createHash('sha256').update(raw).digest('hex') };
}

export function validateOrdinaryProfileExpiryRule(raw: string): void { rule(raw); }

// An approved legacy policy without this trigger remains pending manual review.
// Callers can use this guard without making startup/replay reject that policy.
export function ordinaryProfileExpiryEligible(raw: string): boolean {
  validateRetentionPolicy(raw);
  const policy = JSON.parse(raw) as { records: Array<{ class: string; status: string;
    approved_days?: number; approved_trigger?: string }> };
  const item = policy.records.find(record => record.class === 'ordinary_profile');
  return !!item && item.status === 'APPROVED' && Number.isSafeInteger(item.approved_days) &&
    item.approved_days! >= 1 && item.approved_days! <= 36_500 && item.approved_trigger === 'DELETE_EXECUTION';
}

export async function readOrdinaryProfileDisposition(tx: Queryable, requestId: string) {
  const { rows } = await tx.query<{ expires_at: Date; performed_at: Date; disposition_counts: Counts;
    recipient_tombstone: string }>(`SELECT expires_at,performed_at,disposition_counts,recipient_tombstone
    FROM privacy_ordinary_profile_expiries WHERE request_id=$1`, [requestId]);
  if (!rows[0]) return null;
  const { rows: retained } = await tx.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM notifications WHERE user_id=$1', [rows[0].recipient_tombstone]);
  return { state: 'PARTIALLY_PURGED_REVIEW_PENDING' as const,
    expiresAt: new Date(rows[0].expires_at).toISOString(),
    performedAt: new Date(rows[0].performed_at).toISOString(),
    counts: rows[0].disposition_counts,
    retainedNotificationRows: retained[0]?.count ?? 0 };
}

function tombstone(requestId: string, userId: string): string {
  return `deleted:notification:${createHash('sha256').update(`${requestId}:${userId}`).digest('hex').slice(0, 40)}`;
}

function result(requestId: string, disposition: 'NOT_DUE' | 'PARTIALLY_PURGED_REVIEW_PENDING',
  recipientTombstone: string, expiresAt: Date, counts: Counts, newlyApplied = false) {
  return { requestId, disposition, recipientTombstone, expiresAt: new Date(expiresAt).toISOString(), counts, newlyApplied };
}

export async function expireOrdinaryProfile(db: Database, actor: string, requestId: string,
  approvedPolicyJson: string, marker: Marker) {
  if (!actor.startsWith('operator:')) throw new AppError('FORBIDDEN', '需要运营身份', 403);
  const approved = rule(approvedPolicyJson);
  if (marker.schema !== 'project-irl/deletion-marker-v1' || marker.requestId !== requestId ||
    marker.policySha256 !== approved.hash || !Number.isFinite(Date.parse(marker.recordedAt)))
    throw new Error('Deletion marker does not match the approved ordinary profile policy');
  return db.transaction(async tx => {
    const { rows: identity } = await tx.query<{ user_id: string }>(
      "SELECT user_id FROM privacy_requests WHERE id=$1 AND kind='DELETE'", [requestId]);
    if (!identity[0] || identity[0].user_id !== marker.userId)
      throw new Error('Deletion marker and request identity do not match');
    const userId = identity[0].user_id;
    const { rows: users } = await tx.query<{ status: string }>('SELECT status FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!users[0] || users[0].status !== 'DISABLED')
      throw new AppError('DELETE_NOT_PROTECTED', '账号尚未停用，不能清理普通资料', 409);
    const { rows: requests } = await tx.query<{ status: string }>(
      "SELECT status FROM privacy_requests WHERE id=$1 AND kind='DELETE' FOR UPDATE", [requestId]);
    if (requests[0]?.status !== 'SAFEGUARDS_APPLIED_PENDING_REVIEW')
      throw new AppError('DELETE_NOT_PROTECTED', '删除执行尚未完成，不能清理普通资料', 409);
    const { rows: executions } = await tx.query<{ policy_sha256: string; outcomes: Record<string, unknown> }>(
      'SELECT policy_sha256,outcomes FROM privacy_deletion_executions WHERE request_id=$1 FOR UPDATE', [requestId]);
    if (executions[0]?.policy_sha256 !== approved.hash)
      throw new AppError('POLICY_MISMATCH', '普通资料策略与删除执行策略不一致', 409);
    const { rows: shared } = await tx.query('SELECT 1 FROM privacy_shared_deidentifications WHERE request_id=$1', [requestId]);
    const dispute = executions[0]?.outcomes.disputeOrRequiredLogs as { state?: string } | undefined;
    if (!shared.length || !['ISOLATED', 'PARTIALLY_ISOLATED_REVIEW_PENDING'].includes(dispute?.state ?? ''))
      throw new AppError('DELETE_NOT_PROTECTED', '共享资料或争议记录尚未完成保护', 409);
    const { rows: previous } = await tx.query<Ledger>(
      'SELECT recipient_tombstone,expires_at,disposition_counts,performed_at FROM privacy_ordinary_profile_expiries WHERE request_id=$1',
      [requestId]);
    if (previous[0]) return result(requestId, 'PARTIALLY_PURGED_REVIEW_PENDING', previous[0].recipient_tombstone,
      previous[0].expires_at, previous[0].disposition_counts);
    const { rows: times } = await tx.query<{ expires_at: Date; due: boolean }>(
      `SELECT $1::timestamptz+($2::integer * interval '1 day') AS expires_at,
        clock_timestamp() >= $1::timestamptz+($2::integer * interval '1 day') AS due`,
      [marker.recordedAt, approved.days]);
    const expiry = times[0]!;
    const recipientTombstone = tombstone(requestId, userId);
    if (!expiry.due) return result(requestId, 'NOT_DUE', recipientTombstone, expiry.expires_at, zero());
    const { rows: collision } = await tx.query('SELECT 1 FROM users WHERE id=$1', [recipientTombstone]);
    const { rows: existingNotices } = await tx.query('SELECT 1 FROM notifications WHERE user_id=$1 LIMIT 1',
      [recipientTombstone]);
    if (collision.length || existingNotices.length) throw new Error('Notification recipient tombstone collision');
    const counts = zero();
    counts.sessionsDeleted = (await tx.query('DELETE FROM sessions WHERE user_id=$1 RETURNING token_hash', [userId])).rows.length;
    counts.exportTicketsDeleted = (await tx.query('DELETE FROM personal_export_tickets WHERE user_id=$1 RETURNING id', [userId])).rows.length;
    counts.eventAliasesDeleted = (await tx.query('DELETE FROM event_aliases WHERE user_id=$1 RETURNING event_id', [userId])).rows.length;
    counts.notificationConsentsDeleted = (await tx.query('DELETE FROM notification_consents WHERE user_id=$1 RETURNING purpose', [userId])).rows.length;
    const { rows: details } = await tx.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM notifications WHERE user_id=$1 AND detail<>'{}'::jsonb", [userId]);
    counts.notificationDetailsCleared = details[0]?.count ?? 0;
    counts.notificationRecipientsTombstoned = (await tx.query(`UPDATE notifications
      SET user_id=$2,detail='{}'::jsonb WHERE user_id=$1 RETURNING id`, [userId, recipientTombstone])).rows.length;
    const { rows: aliasEvents } = await tx.query<{ event_id: string }>(
      'SELECT DISTINCT event_id FROM event_alias_consent_history WHERE user_id=$1', [userId]);
    for (const { event_id: eventId } of aliasEvents) {
      const replacement = `deleted:${createHash('sha256').update(`${requestId}:${eventId}`).digest('hex').slice(0, 32)}`;
      counts.aliasConsentLinksTombstoned += (await tx.query(`UPDATE event_alias_consent_history
        SET user_id=$3 WHERE user_id=$1 AND event_id=$2 RETURNING id`, [userId, eventId, replacement])).rows.length;
    }
    const { rows: inserted } = await tx.query<Ledger>(`INSERT INTO privacy_ordinary_profile_expiries
      (request_id,user_id,recipient_tombstone,policy_sha256,marker_recorded_at,expires_at,disposition_counts,performed_by)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
      RETURNING recipient_tombstone,expires_at,disposition_counts,performed_at`,
    [requestId, userId, recipientTombstone, approved.hash, marker.recordedAt, expiry.expires_at,
      JSON.stringify(counts), actor]);
    const outcomes = executions[0]!.outcomes;
    const pending = Array.isArray(outcomes.pendingReviews)
      ? outcomes.pendingReviews as Array<{ code: string; scope: string; reason: string }> : [];
    for (const item of pending) {
      if (item.code === 'ORDINARY_PROFILE_PURGE')
        item.reason = 'Approved ordinary-profile expiry ran only for classified fields; remaining links require purpose review';
      if (item.code === 'NOTIFICATION_DETAIL')
        item.reason = 'Notification detail cleared; consent history and other required evidence remain for review';
      if (item.code === 'NOTIFICATION_IDENTIFIERS')
        item.reason = 'Notification recipient detached; provider references and operations notes remain for review';
    }
    if (!pending.some(item => item.code === 'ORDINARY_PROFILE_REMAINDERS')) pending.push({
      code: 'ORDINARY_PROFILE_REMAINDERS',
      scope: 'disabled users tombstone, consent history, safety links, audit, provider delivery metadata',
      reason: 'Required or opaque records retain direct or indirect identifiers pending purpose review'
    });
    outcomes.ordinaryProfile = { state: 'PARTIALLY_PURGED_REVIEW_PENDING',
      affected: counts.notificationConsentsDeleted + counts.notificationRecipientsTombstoned +
        counts.sessionsDeleted + counts.exportTicketsDeleted + counts.eventAliasesDeleted +
        counts.aliasConsentLinksTombstoned };
    outcomes.pendingReviews = pending;
    await tx.query('UPDATE privacy_deletion_executions SET outcomes=$2::jsonb WHERE request_id=$1',
      [requestId, JSON.stringify(outcomes)]);
    await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4::jsonb)',
      [randomUUID(), actor, 'PRIVACY_ORDINARY_PROFILE_EXPIRY', JSON.stringify({ requestId, counts })]);
    return result(requestId, 'PARTIALLY_PURGED_REVIEW_PENDING', recipientTombstone,
      inserted[0]!.expires_at, inserted[0]!.disposition_counts, true);
  });
}

export async function purgeExpiredOrdinaryProfiles(db: Database, markerStore: DeletionMarkerStore,
  approvedPolicyJson: string, actor: string, limit = 100): Promise<number> {
  if (!actor.startsWith('operator:')) throw new AppError('FORBIDDEN', '需要运营身份', 403);
  const approved = rule(approvedPolicyJson);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid ordinary profile sweep limit');
  const markers = await markerStore.list();
  const earliest = new Map<string, Marker>();
  for (const marker of markers) {
    if (marker.schema !== 'project-irl/deletion-marker-v1' || marker.policySha256 !== approved.hash ||
      !marker.requestId || !marker.userId || !Number.isFinite(Date.parse(marker.recordedAt)))
      throw new Error('Ordinary profile marker list conflicts with approved policy');
    const prior = earliest.get(marker.requestId);
    if (prior && prior.userId !== marker.userId) throw new Error('Ordinary profile marker identity conflict');
    if (!prior || Date.parse(marker.recordedAt) < Date.parse(prior.recordedAt))
      earliest.set(marker.requestId, marker);
  }
  const dueBefore = Date.now() - approved.days * 86_400_000;
  let applied = 0;
  for (const marker of [...earliest.values()].filter(item => Date.parse(item.recordedAt) <= dueBefore)
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt))) {
    if (applied >= limit) break;
    const outcome = await expireOrdinaryProfile(db, actor, marker.requestId, approvedPolicyJson, marker);
    if (outcome.newlyApplied) applied++;
  }
  return applied;
}
