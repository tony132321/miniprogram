import { createHash, randomUUID } from 'node:crypto';
import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { validateRetentionPolicy } from './retention-policy.ts';

type Rule = { class: string; status: string; approved_days?: number; approved_trigger?: string };
type Outcomes = { unneededDraftInput?: { state: string; affected: number };
  pendingReviews?: Array<{ code: string; scope: string; reason: string }> };
const redactedHash = '0'.repeat(64);
const redactedNote = '[已清理个人草稿内容]';

function aiRule(raw: string): { days: number; hash: string } {
  validateRetentionPolicy(raw);
  const policy = JSON.parse(raw) as { records: Rule[] };
  const rule = policy.records.find(item => item.class === 'unneeded_draft_input');
  if (!rule || rule.status !== 'APPROVED' || !Number.isSafeInteger(rule.approved_days) ||
    rule.approved_days! < 1) throw new Error('unneeded_draft_input requires approved_days for automated expiry');
  if (rule.approved_trigger !== 'DELETE_EXECUTION')
    throw new Error('unneeded_draft_input requires approved_trigger DELETE_EXECUTION for automated expiry');
  return { days: rule.approved_days!, hash: createHash('sha256').update(raw).digest('hex') };
}

export function validateAiInputRetentionRule(raw: string): void { aiRule(raw); }

export function aiInputCleanupEligible(raw: string): boolean {
  validateRetentionPolicy(raw);
  const policy = JSON.parse(raw) as { records: Rule[] };
  const rule = policy.records.find(item => item.class === 'unneeded_draft_input');
  return rule?.status === 'APPROVED' && Number.isSafeInteger(rule.approved_days) &&
    rule.approved_days! > 0 && rule.approved_trigger === 'DELETE_EXECUTION';
}

function requireOperator(actor: string): void {
  if (!actor.startsWith('operator:')) throw new AppError('FORBIDDEN', '需要运营身份', 403);
}

export async function scheduleAiInputCleanup(db: Database, actor: string, requestId: string,
  approvedPolicyJson: string, deletionExecutionAt?: string) {
  requireOperator(actor);
  const rule = aiRule(approvedPolicyJson);
  if (deletionExecutionAt && !Number.isFinite(Date.parse(deletionExecutionAt)))
    throw new Error('Invalid deletion execution timestamp');
  return db.transaction(async tx => {
    const { rows: identities } = await tx.query<{ user_id: string }>(
      "SELECT user_id FROM privacy_requests WHERE id=$1 AND kind='DELETE'", [requestId]);
    if (!identities[0]) throw new AppError('NOT_FOUND', '注销或删除申请不存在', 404);
    const userId = identities[0].user_id;
    await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    const { rows: requests } = await tx.query<{ status: string }>(
      'SELECT status FROM privacy_requests WHERE id=$1 FOR UPDATE', [requestId]);
    const { rows: executions } = await tx.query<{ user_id: string; policy_sha256: string; applied_at: Date }>(
      'SELECT user_id,policy_sha256,applied_at FROM privacy_deletion_executions WHERE request_id=$1 FOR UPDATE', [requestId]);
    if (!executions[0] || requests[0]?.status !== 'SAFEGUARDS_APPLIED_PENDING_REVIEW')
      throw new AppError('DELETE_NOT_PROTECTED', '注销前置保护未完成', 409);
    if (executions[0].user_id !== userId || executions[0].policy_sha256 !== rule.hash)
      throw new AppError('POLICY_MISMATCH', 'AI 清理策略与已执行策略不一致', 409);
    const { rows } = await tx.query<{ expires_at: Date; execution_at: Date }>(`INSERT INTO privacy_ai_input_expiry
      (request_id,user_id,policy_sha256,execution_at,expires_at)
      VALUES($1,$2,$3,$4::timestamptz,$4::timestamptz+($5::integer * interval '1 day'))
      ON CONFLICT (request_id) DO UPDATE SET request_id=excluded.request_id
      WHERE privacy_ai_input_expiry.user_id=excluded.user_id
        AND privacy_ai_input_expiry.policy_sha256=excluded.policy_sha256
        AND privacy_ai_input_expiry.execution_at=excluded.execution_at
      RETURNING expires_at,execution_at`,
    [requestId, userId, rule.hash, deletionExecutionAt ?? executions[0].applied_at, rule.days]);
    if (!rows[0]) throw new AppError('POLICY_MISMATCH', 'AI 清理排程与原执行时间或策略冲突', 409);
    return { requestId, expiresAt: new Date(rows[0].expires_at).toISOString(),
      executionAt: new Date(rows[0].execution_at).toISOString() };
  });
}

type ProviderEvidence = { attempt: number; modelVersion: string; promptHash: string;
  usage: { inputTokens: number; outputTokens: number };
  receipt: { status: string; referenceHash: string }; costFen: number };
function safeProviderEvidence(value: unknown): ProviderEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const v = item as Record<string, unknown>;
    const usage = v.usage as Record<string, unknown> | undefined;
    const receipt = v.receipt as Record<string, unknown> | undefined;
    if (!Number.isSafeInteger(v.attempt) || typeof v.modelVersion !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/.test(v.modelVersion) ||
      typeof v.promptHash !== 'string' || !/^[a-f0-9]{64}$/i.test(v.promptHash) ||
      !usage || !Number.isSafeInteger(usage.inputTokens) || !Number.isSafeInteger(usage.outputTokens) ||
      !receipt || !['ACCEPTED', 'REJECTED', 'UNKNOWN'].includes(String(receipt.status)) ||
      typeof receipt.referenceHash !== 'string' || !/^[a-f0-9]{64}$/i.test(receipt.referenceHash) ||
      !Number.isSafeInteger(v.costFen)) return [];
    return [{ attempt: Number(v.attempt), modelVersion: v.modelVersion, promptHash: v.promptHash,
      usage: { inputTokens: Number(usage.inputTokens), outputTokens: Number(usage.outputTokens) },
      receipt: { status: String(receipt.status), referenceHash: receipt.referenceHash }, costFen: Number(v.costFen) }];
  });
}

export async function purgeExpiredAiInput(db: Database, actor: string, at = new Date()): Promise<number> {
  requireOperator(actor);
  if (!Number.isFinite(at.getTime())) throw new Error('Invalid AI expiry cutoff');
  const { rows: candidates } = await db.query<{ request_id: string }>(
    'SELECT request_id FROM privacy_ai_input_expiry WHERE expires_at<=$1 AND cleanup_at IS NULL ORDER BY expires_at,request_id LIMIT 100', [at]);
  let treatedRequests = 0;
  for (const { request_id: requestId } of candidates) {
    const changed = await db.transaction(async tx => {
      const { rows: identities } = await tx.query<{ user_id: string }>(
        'SELECT user_id FROM privacy_ai_input_expiry WHERE request_id=$1', [requestId]);
      if (!identities[0]) return false;
      const userId = identities[0].user_id;
      await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
      const { rows: schedules } = await tx.query<{ policy_sha256: string; affected_rows: number }>(
        'SELECT policy_sha256,affected_rows FROM privacy_ai_input_expiry WHERE request_id=$1 AND expires_at<=$2 AND cleanup_at IS NULL FOR UPDATE',
      [requestId, at]);
      if (!schedules[0]) return false;
      const { rows: executions } = await tx.query<{ user_id: string; policy_sha256: string; outcomes: Outcomes }>(
        'SELECT user_id,policy_sha256,outcomes FROM privacy_deletion_executions WHERE request_id=$1 FOR UPDATE', [requestId]);
      if (!executions[0] || executions[0].user_id !== userId ||
        executions[0].policy_sha256 !== schedules[0].policy_sha256)
        throw new AppError('POLICY_MISMATCH', 'AI 清理排程与删除执行不一致', 409);
      const { rows: drafts } = await tx.query<{ request_key: string; result: Record<string, unknown> | null }>(
        'SELECT request_key,result FROM ai_draft_requests WHERE actor_id=$1 FOR UPDATE', [userId]);
      let affected = 0;
      for (const row of drafts) {
        const result = row.result;
        if (result?.privacyRedacted === true) continue;
        const evidence = safeProviderEvidence(result?.providerEvidence);
        const fallbackReason = typeof result?.fallbackReason === 'string' &&
          ['BUDGET', 'TIMEOUT', 'PROVIDER_ERROR', 'INVALID_RESPONSE', 'COST_BOUND_VIOLATION'].includes(result.fallbackReason)
          ? result.fallbackReason : undefined;
        await tx.query(`UPDATE ai_draft_requests SET request_hash=$3,
          result=CASE WHEN status='COMPLETED' THEN $4::jsonb ELSE NULL END
          WHERE actor_id=$1 AND request_key=$2`,
        [userId, row.request_key, redactedHash, JSON.stringify({ privacyRedacted: true, providerEvidence: evidence,
          ...(fallbackReason ? { fallbackReason } : {}) })]);
        affected++;
      }
      const { rows: semantics } = await tx.query<{ request_key: string; result: Record<string, unknown> | null;
        request_hash: string; provider_evidence: unknown }>(
        'SELECT request_key,result,request_hash,provider_evidence FROM ai_semantic_requests WHERE actor_id=$1 FOR UPDATE', [userId]);
      for (const row of semantics) {
        if (row.result?.privacyRedacted === true && row.request_hash === redactedHash) continue;
        await tx.query(`UPDATE ai_semantic_requests SET request_hash=$3,
          provider_evidence=$4::jsonb,
          result=CASE WHEN status='COMPLETED' THEN '{"privacyRedacted":true}'::jsonb ELSE NULL END
          WHERE actor_id=$1 AND request_key=$2`,
        [userId, row.request_key, redactedHash, JSON.stringify(safeProviderEvidence(row.provider_evidence))]);
        affected++;
      }
      const { rows: proposals } = await tx.query<{ id: string; payload: Record<string, unknown>; payload_hash: string;
        receipt: Record<string, unknown> | null; status: string }>(
        'SELECT id,payload,payload_hash,receipt,status FROM ai_action_proposals WHERE actor_id=$1 FOR UPDATE', [userId]);
      for (const row of proposals) {
        if (row.payload.privacyRedacted === true && row.payload_hash === redactedHash &&
          (row.receipt === null || row.receipt.privacyRedacted === true) &&
          !['PROPOSED', 'APPROVED'].includes(row.status)) continue;
        await tx.query(`UPDATE ai_action_proposals SET payload='{"privacyRedacted":true}'::jsonb,
          payload_hash=$2,receipt=CASE WHEN status='SUCCEEDED' THEN '{"privacyRedacted":true}'::jsonb ELSE NULL END,
          status=CASE WHEN status IN ('PROPOSED','APPROVED') THEN 'REVOKED' ELSE status END,
          revoked_at=CASE WHEN status IN ('PROPOSED','APPROVED') THEN clock_timestamp() ELSE revoked_at END
          WHERE id=$1`, [row.id, redactedHash]);
        affected++;
      }
      const { rows: draftNotes } = await tx.query<{ request_key: string }>(
        'UPDATE ai_draft_alert_reviews SET note=$2 WHERE actor_id=$1 AND note<>$2 RETURNING request_key',
      [userId, redactedNote]);
      const { rows: semanticNotes } = await tx.query<{ request_key: string }>(
        'UPDATE ai_semantic_alert_reviews SET note=$2 WHERE actor_id=$1 AND note<>$2 RETURNING request_key',
      [userId, redactedNote]);
      affected += draftNotes.length + semanticNotes.length;
      const outcomes = executions[0].outcomes;
      const pending = Array.isArray(outcomes.pendingReviews) ? outcomes.pendingReviews.filter(
        item => !['UNNEEDED_DRAFT_INPUT', 'AI_SEMANTIC_INPUT'].includes(item.code)) : [];
      for (const item of [
        { code: 'AI_REQUEST_KEYS_AND_LINKS', scope: 'AI request keys, actor/event links and alert review references',
          reason: 'Keys and relation identifiers remain for idempotency, cost and audit integrity' },
        { code: 'AI_COST_PROVENANCE', scope: 'AI provider evidence and unsettled cost records',
          reason: 'Hashed provider receipts and numeric reservations remain; unknown cost is not settled by privacy cleanup' }
      ]) if (!pending.some(review => review.code === item.code)) pending.push(item);
      outcomes.unneededDraftInput = { state: 'PARTIALLY_ISOLATED_REVIEW_PENDING',
        affected: schedules[0].affected_rows + affected };
      outcomes.pendingReviews = pending;
      await tx.query('UPDATE privacy_deletion_executions SET outcomes=$2 WHERE request_id=$1',
        [requestId, JSON.stringify(outcomes)]);
      await tx.query('UPDATE privacy_ai_input_expiry SET cleanup_at=COALESCE(cleanup_at,$2),affected_rows=affected_rows+$3 WHERE request_id=$1',
        [requestId, at, affected]);
      if (affected) await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
        [randomUUID(), actor, 'PRIVACY_AI_INPUT_EXPIRED', JSON.stringify({ requestId, affected })]);
      return affected > 0;
    });
    if (changed) treatedRequests++;
  }
  return treatedRequests;
}
