import { createHash, randomUUID } from 'node:crypto';
import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { validateRetentionPolicy } from './retention-policy.ts';

type Rule = { class: string; status: string; approved_days?: number; approved_trigger?: string;
  legal_basis?: string; access_roles?: string[] };

function disputeRule(raw: string): { days: number; basis: string; roles: string[]; hash: string } {
  validateRetentionPolicy(raw);
  const policy = JSON.parse(raw) as { records: Rule[] };
  const rule = policy.records.find(item => item.class === 'dispute_or_required_logs');
  if (!rule || rule.status !== 'APPROVED' || !Number.isSafeInteger(rule.approved_days) ||
    rule.approved_days! < 1) throw new Error('dispute_or_required_logs requires approved_days for automated expiry');
  if (rule.approved_trigger !== 'DELETE_EXECUTION')
    throw new Error('dispute_or_required_logs requires approved_trigger DELETE_EXECUTION for automated expiry');
  return { days: rule.approved_days!, basis: rule.legal_basis!, roles: rule.access_roles!,
    hash: createHash('sha256').update(raw).digest('hex') };
}

export function validateDisputeRetentionRule(raw: string): void { disputeRule(raw); }

function operator(actor: string): void {
  if (!actor.startsWith('operator:')) throw new AppError('FORBIDDEN', '需要运营身份', 403);
}

export async function isolateDisputeRecords(db: Database, actor: string, requestId: string, approvedPolicyJson: string,
  deletionExecutionAt?: string) {
  operator(actor);
  const rule = disputeRule(approvedPolicyJson);
  if (deletionExecutionAt && !Number.isFinite(Date.parse(deletionExecutionAt)))
    throw new Error('Invalid deletion execution timestamp');
  return db.transaction(async tx => {
    const { rows: requestRows } = await tx.query<{ user_id: string; status: string }>(
      "SELECT user_id,status FROM privacy_requests WHERE id=$1 AND kind='DELETE'", [requestId]);
    if (!requestRows[0]) throw new AppError('NOT_FOUND', '注销或删除申请不存在', 404);
    const userId = requestRows[0].user_id;
    await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    const { rows: executionRows } = await tx.query<{ policy_sha256: string; applied_at: Date;
      outcomes: Record<string, unknown> }>(
      'SELECT policy_sha256,applied_at,outcomes FROM privacy_deletion_executions WHERE request_id=$1 FOR UPDATE', [requestId]);
    if (!executionRows[0] || requestRows[0].status !== 'SAFEGUARDS_APPLIED_PENDING_REVIEW')
      throw new AppError('DELETE_NOT_PROTECTED', '注销前置保护未完成', 409);
    if (executionRows[0].policy_sha256 !== rule.hash)
      throw new AppError('POLICY_MISMATCH', '隔离策略与已执行策略不一致', 409);
    const tombstone = `deleted:${createHash('sha256').update(requestId).digest('hex').slice(0, 24)}`;
    const { rows: expiryRows } = await tx.query<{ expires_at: Date }>(
      "SELECT $1::timestamptz+($2::integer * interval '1 day') AS expires_at",
      [deletionExecutionAt ?? executionRows[0].applied_at, rule.days]);
    const expiresAt = expiryRows[0]!.expires_at;
    const parameters = [requestId, userId, expiresAt, rule.basis, rule.roles];
    await tx.query(`INSERT INTO privacy_quarantine
      (request_id,source_table,source_id,payload,expires_at,legal_basis,access_roles)
      SELECT $1,'reports',r.id,to_jsonb(r),$3,$4,$5 FROM reports r WHERE r.reporter_id=$2
      ON CONFLICT DO NOTHING`, parameters);
    await tx.query(`INSERT INTO privacy_quarantine
      (request_id,source_table,source_id,payload,expires_at,legal_basis,access_roles)
      SELECT $1,'appeals',a.id,to_jsonb(a),$3,$4,$5 FROM appeals a WHERE a.appellant_id=$2
      ON CONFLICT DO NOTHING`, parameters);
    await tx.query(`INSERT INTO privacy_quarantine
      (request_id,source_table,source_id,payload,expires_at,legal_basis,access_roles)
      SELECT $1,'outcome_reviews',o.id,to_jsonb(o),$3,$4,$5 FROM outcome_reviews o
      JOIN reports r ON r.id=o.report_id WHERE r.reporter_id=$2
      ON CONFLICT DO NOTHING`, parameters);
    await tx.query(`UPDATE outcome_reviews o SET reason='[已隔离保留]'
      FROM reports r WHERE o.report_id=r.id AND r.reporter_id=$1`, [userId]);
    await tx.query(`UPDATE reports SET reporter_id=$2,description='[已隔离保留]',
      resolution=CASE WHEN resolution IS NULL THEN NULL ELSE '[已隔离保留]' END
      WHERE reporter_id=$1`, [userId, tombstone]);
    await tx.query(`UPDATE appeals SET appellant_id=$2,description='[已隔离保留]',
      resolution=CASE WHEN resolution IS NULL THEN NULL ELSE '[已隔离保留]' END
      WHERE appellant_id=$1`, [userId, tombstone]);
    const { rows: countRows } = await tx.query<{ count: number; expires_at: Date | null }>(
      `SELECT count(*)::int AS count,min(expires_at) AS expires_at FROM privacy_quarantine WHERE request_id=$1`, [requestId]);
    const count = countRows[0]?.count ?? 0;
    const outcomes = executionRows[0].outcomes;
    const pendingReviews: Array<{ code: string; scope: string; reason: string }> = Array.isArray(outcomes.pendingReviews)
      ? outcomes.pendingReviews as Array<{ code: string; scope: string; reason: string }> : [];
    if (!pendingReviews.some(item => item.code === 'DISPUTE_RELATED_COPIES')) pendingReviews.push({
      code: 'DISPUTE_RELATED_COPIES', scope: 'privacy requests, report assignments, appeal notices and linked records',
      reason: 'Only reports, appeals and reported outcome reviews were isolated; other required records remain for review'
    });
    outcomes.disputeOrRequiredLogs = { state: 'PARTIALLY_ISOLATED_REVIEW_PENDING', affected: count };
    outcomes.pendingReviews = pendingReviews;
    await tx.query('UPDATE privacy_deletion_executions SET outcomes=$2 WHERE request_id=$1',
      [requestId, JSON.stringify(outcomes)]);
    await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
      [randomUUID(), actor, 'PRIVACY_DISPUTE_ISOLATED', JSON.stringify({ requestId, count,
        expiresAt: countRows[0]?.expires_at })]);
    return { requestId, disposition: 'PARTIALLY_ISOLATED_REVIEW_PENDING' as const, records: count,
      expiresAt: countRows[0]?.expires_at ? new Date(countRows[0].expires_at).toISOString() : null };
  });
}

// Resolver must come from trusted server-side operator configuration, never
// from a request body or client supplied list of roles.
export async function readQuarantinedRecord(db: Database, actor: string,
  resolveTrustedRoles: (actor: string) => Promise<readonly string[]>,
  requestId: string, source: string, sourceId: string) {
  operator(actor);
  const { rows } = await db.query<{ payload: Record<string, unknown>; expires_at: Date; access_roles: string[] }>(
    `SELECT payload,expires_at,access_roles FROM privacy_quarantine
      WHERE request_id=$1 AND source_table=$2 AND source_id=$3 AND expires_at>clock_timestamp()`,
  [requestId, source, sourceId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', '隔离保留记录不存在', 404);
  const roles = await resolveTrustedRoles(actor);
  if (!roles.some(role => rows[0]!.access_roles.includes(role)))
    throw new AppError('FORBIDDEN', '无权读取隔离保留记录', 403);
  await db.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
    [randomUUID(), actor, 'READ_PRIVACY_QUARANTINE', JSON.stringify({ requestId, source, sourceId })]);
  return { payload: rows[0].payload, expiresAt: new Date(rows[0].expires_at).toISOString() };
}

export async function purgeExpiredQuarantine(db: Database, actor: string): Promise<number> {
  operator(actor);
  return db.transaction(async tx => {
    const { rows } = await tx.query<{ request_id: string }>(
      'DELETE FROM privacy_quarantine WHERE expires_at<=clock_timestamp() RETURNING request_id');
    if (rows.length) await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
      [randomUUID(), actor, 'PRIVACY_QUARANTINE_EXPIRED', JSON.stringify({ count: rows.length })]);
    return rows.length;
  });
}
