import { createHash, randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { validateRetentionPolicy } from './retention-policy.ts';
import { inspectPrivacyFields } from './privacy-field-inventory.ts';

type Count = { count: number };
type OutcomeState = 'DISABLED' | 'DELETED' | 'PROTECTED' | 'ISOLATED' | 'PARTIALLY_ISOLATED_REVIEW_PENDING' | 'DEIDENTIFIED_REVIEW_PENDING' | 'DEIDENTIFICATION_PENDING' | 'ISOLATION_PENDING';
type Outcome = { state: OutcomeState; affected: number };
type PendingReview = { code: string; scope: string; reason: string };
type SafeguardOutcomes = {
  account: Outcome;
  sessions: Outcome;
  personalExportTickets: Outcome;
  externalDelivery: Outcome;
  hostedRecruitment: Outcome;
  eventAliases: Outcome;
  unneededDraftInput: Outcome;
  sharedActivity: Outcome;
  disputeOrRequiredLogs: Outcome;
  backup: Outcome;
  pendingReviews: PendingReview[];
};
type StoredExecution = { request_id: string; user_id: string; policy_sha256: string;
  outcomes: SafeguardOutcomes; applied_at: Date };

async function count(tx: Queryable, sql: string, actor: string): Promise<number> {
  const { rows } = await tx.query<Count>(sql, [actor]);
  return rows[0]?.count ?? 0;
}

// Selected relational fields only. The plan intentionally does not infer that
// free-text JSON, provider copies, or backups can be erased by these counts.
export async function dryRunPrivacyDeletion(db: Database, requestId: string) {
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows } = await tx.query<{ user_id: string; kind: string }>(
      'SELECT user_id,kind FROM privacy_requests WHERE id=$1', [requestId]);
    const request = rows[0];
    if (!request) throw new AppError('NOT_FOUND', '个人信息请求不存在', 404);
    if (request.kind !== 'DELETE') throw new AppError('BAD_REQUEST', '仅注销或删除申请可预览');
    const actor = request.user_id;
    return { requestId, inventoryScope: 'SELECTED_RELATIONAL_FIELDS_ONLY',
      fieldInventory: await inspectPrivacyFields(tx, actor), classifications: {
      ordinaryProfile: {
        account: await count(tx, 'SELECT count(*)::int AS count FROM users WHERE id=$1', actor),
        sessions: await count(tx, 'SELECT count(*)::int AS count FROM sessions WHERE user_id=$1', actor),
        personalExportTickets: await count(tx, 'SELECT count(*)::int AS count FROM personal_export_tickets WHERE user_id=$1', actor),
        notificationConsents: await count(tx, 'SELECT count(*)::int AS count FROM notification_consents WHERE user_id=$1', actor),
        eventAliases: await count(tx, 'SELECT count(*)::int AS count FROM event_aliases WHERE user_id=$1', actor)
      },
      unneededDraftInput: {
        aiDraftRequests: await count(tx, 'SELECT count(*)::int AS count FROM ai_draft_requests WHERE actor_id=$1', actor),
        aiSemanticRequests: await count(tx, 'SELECT count(*)::int AS count FROM ai_semantic_requests WHERE actor_id=$1', actor),
        aiSemanticAlertReviews: await count(tx, 'SELECT count(*)::int AS count FROM ai_semantic_alert_reviews WHERE actor_id=$1', actor),
        aiActionProposals: await count(tx, 'SELECT count(*)::int AS count FROM ai_action_proposals WHERE actor_id=$1', actor)
      },
      sharedActivity: {
        hostedEvents: await count(tx, 'SELECT count(*)::int AS count FROM events WHERE host_id=$1', actor),
        registrations: await count(tx, 'SELECT count(*)::int AS count FROM registrations WHERE user_id=$1', actor),
        authoredContent: await count(tx, 'SELECT count(*)::int AS count FROM activity_content WHERE author_id=$1', actor)
      },
      disputeOrRequiredLogs: {
        reports: await count(tx, 'SELECT count(*)::int AS count FROM reports WHERE reporter_id=$1', actor),
        appeals: await count(tx, 'SELECT count(*)::int AS count FROM appeals WHERE appellant_id=$1', actor),
        privacyRequests: await count(tx, 'SELECT count(*)::int AS count FROM privacy_requests WHERE user_id=$1', actor)
      },
      backup: { status: 'EXTERNAL_INVENTORY_REQUIRED' }
    } };
  });
}

function response(row: StoredExecution) {
  return { requestId: row.request_id, policySha256: row.policy_sha256,
    appliedAt: new Date(row.applied_at).toISOString(), outcomes: row.outcomes };
}

// This deliberately applies only final-send/public-identity safeguards. A
// later reviewed decision must resolve the pending shared and dispute rows;
// this function never labels them deleted, de-identified, or isolated.
export async function executePrivacyDeletionSafeguards(db: Database, operator: string,
  requestId: string, approvedPolicyJson: string | undefined) {
  validateRetentionPolicy(approvedPolicyJson);
  if (!operator.startsWith('operator:')) throw new AppError('FORBIDDEN', '需要运营身份', 403);
  const policySha256 = createHash('sha256').update(approvedPolicyJson!).digest('hex');
  return db.transaction(async tx => {
    // Keep the lock order used by DELETE intake: person before request. The
    // users update also participates in the external-send fence.
    const { rows: requestRows } = await tx.query<{ user_id: string }>(
      'SELECT user_id FROM privacy_requests WHERE id=$1 AND kind=$2', [requestId, 'DELETE']);
    if (!requestRows[0]) throw new AppError('NOT_FOUND', '注销或删除申请不存在', 404);
    const actor = requestRows[0].user_id;
    const { rows: users } = await tx.query<{ id: string }>('SELECT id FROM users WHERE id=$1 FOR UPDATE', [actor]);
    if (!users[0]) throw new AppError('NOT_FOUND', '账号不存在', 404);
    const { rows: requests } = await tx.query<{ status: string; protection_applied_at: Date | null }>(
      'SELECT status,protection_applied_at FROM privacy_requests WHERE id=$1 AND user_id=$2 FOR UPDATE', [requestId, actor]);
    const request = requests[0]!;
    const { rows: existing } = await tx.query<StoredExecution>(
      'SELECT request_id,user_id,policy_sha256,outcomes,applied_at FROM privacy_deletion_executions WHERE request_id=$1', [requestId]);
    if (existing[0]) {
      if (existing[0].policy_sha256 !== policySha256)
        throw new AppError('POLICY_MISMATCH', '此申请已按另一版本策略执行前置保护', 409);
      return response(existing[0]);
    }
    if (!request.protection_applied_at || request.status === 'CANCELLED' || request.status === 'FULFILLED')
      throw new AppError('DELETE_NOT_PROTECTED', '注销申请尚未完成前置保护，不能执行', 409);
    const { rows: accounts } = await tx.query<{ id: string }>(
      "UPDATE users SET status='DISABLED' WHERE id=$1 AND status<>'DISABLED' RETURNING id", [actor]);
    const { rows: sessions } = await tx.query<{ token_hash: string }>(
      'DELETE FROM sessions WHERE user_id=$1 RETURNING token_hash', [actor]);
    const { rows: tickets } = await tx.query<{ id: string }>(
      'DELETE FROM personal_export_tickets WHERE user_id=$1 RETURNING id', [actor]);
    const { rows: aliases } = await tx.query<{ event_id: string }>(
      'DELETE FROM event_aliases WHERE user_id=$1 RETURNING event_id', [actor]);
    const { rows: hostedEvents } = await tx.query<{ id: string }>(`UPDATE events
      SET recruiting=false,invite_token=NULL,invite_expires_at=NULL,resume_recruiting_after_review=false
      WHERE host_id=$1 AND (recruiting=true OR invite_token IS NOT NULL OR invite_expires_at IS NOT NULL
        OR resume_recruiting_after_review=true) RETURNING id`, [actor]);
    const outcomes: SafeguardOutcomes = {
      account: { state: 'DISABLED', affected: accounts.length },
      sessions: { state: 'DELETED', affected: sessions.length },
      personalExportTickets: { state: 'DELETED', affected: tickets.length },
      externalDelivery: { state: 'PROTECTED', affected: 1 },
      hostedRecruitment: { state: 'DISABLED', affected: hostedEvents.length },
      eventAliases: { state: 'DELETED', affected: aliases.length },
      unneededDraftInput: { state: 'ISOLATION_PENDING', affected: 0 },
      sharedActivity: { state: 'DEIDENTIFICATION_PENDING', affected: 0 },
      disputeOrRequiredLogs: { state: 'ISOLATION_PENDING', affected: 0 },
      backup: { state: 'ISOLATION_PENDING', affected: 0 },
      pendingReviews: [
        { code: 'ORDINARY_PROFILE_PURGE', scope: 'users and profile-linked relations', reason: 'Account disabled; purpose-level deletion still needs evidence' },
        { code: 'UNNEEDED_DRAFT_INPUT', scope: 'AI draft requests and proposals', reason: 'Retention decision and purge not executed' },
        { code: 'AI_SEMANTIC_INPUT', scope: 'AI semantic requests, results, evidence and alert reviews', reason: 'Input and output retention decision and purge not executed' },
        { code: 'PROFILE_LINKED_RELATIONS', scope: 'host_publication_status and user_blocks', reason: 'Direct account links and free text require field disposition' },
        { code: 'NOTIFICATION_DETAIL', scope: 'notifications.detail and consent history', reason: 'Free text and required consent evidence need field review' },
        { code: 'NOTIFICATION_IDENTIFIERS', scope: 'notifications.user_id and followup notes', reason: 'Direct identifiers and operations notes require disposition' },
        { code: 'DISPUTE_COPIES', scope: 'related dispute and outcome review copies', reason: 'Isolation coverage and legal basis require review' },
        { code: 'OPAQUE_JSON_TEXT', scope: 'remaining JSON and free-text columns', reason: 'No comprehensive field inventory or disposition proof' },
        { code: 'AUDIT_AND_IDEMPOTENCY', scope: 'audit, idempotency, external delivery logs', reason: 'Legal basis and retention action require review' },
        { code: 'PROVIDER_COPIES', scope: 'WeChat and other external processors', reason: 'External copy deletion confirmation unavailable' },
        { code: 'BACKUP_LIFECYCLE', scope: 'historical backups and marker durability', reason: 'Production backup inventory and external marker store unverified' },
        { code: 'QUARANTINE_ACCESS', scope: 'privacy_quarantine', reason: 'Production database access separation and expiry operations unverified' }
      ]
    };
    await tx.query("UPDATE privacy_requests SET status='SAFEGUARDS_APPLIED_PENDING_REVIEW' WHERE id=$1", [requestId]);
    const { rows: inserted } = await tx.query<StoredExecution>(`INSERT INTO privacy_deletion_executions
      (request_id,user_id,policy_sha256,outcomes,applied_by)
      VALUES($1,$2,$3,$4,$5) RETURNING request_id,user_id,policy_sha256,outcomes,applied_at`,
    [requestId, actor, policySha256, JSON.stringify(outcomes), operator]);
    await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
      [randomUUID(), operator, 'PRIVACY_DELETE_SAFEGUARDS_APPLIED', JSON.stringify({ requestId,
        policySha256, sessionsRevoked: sessions.length, exportTicketsRevoked: tickets.length })]);
    return response(inserted[0]!);
  });
}

export async function getPrivacyDeletionDisposition(db: Database, operator: string,
  requestId: string): Promise<{ requestId: string; status: string; policySha256: string | null;
  appliedAt: string | null; outcomes: SafeguardOutcomes | null }> {
  if (!operator.startsWith('operator:')) throw new AppError('FORBIDDEN', '需要运营身份', 403);
  return db.transaction(async tx => {
    const { rows } = await tx.query<{ status: string; policy_sha256: string | null;
      applied_at: Date | null; outcomes: SafeguardOutcomes | null }>(`SELECT p.status,e.policy_sha256,e.applied_at,e.outcomes
      FROM privacy_requests p LEFT JOIN privacy_deletion_executions e ON e.request_id=p.id
      WHERE p.id=$1 AND p.kind='DELETE'`, [requestId]);
    if (!rows[0]) throw new AppError('NOT_FOUND', '注销或删除申请不存在', 404);
    await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
      [randomUUID(), operator, 'READ_PRIVACY_DELETION_DISPOSITION', JSON.stringify({ requestId })]);
    return { requestId, status: rows[0].status, policySha256: rows[0].policy_sha256,
      appliedAt: rows[0].applied_at ? new Date(rows[0].applied_at).toISOString() : null,
      outcomes: rows[0].outcomes };
  });
}
