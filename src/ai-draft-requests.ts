import { createHash } from 'node:crypto';
import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { localDraftSuggestion } from './ai.ts';
import { runDraftProvider, type DraftProvider } from './ai-provider-boundary.ts';

export async function runRecordedDraftProvider(db: Database, actor: string, key: string, text: string,
  at: number, provider: DraftProvider, budgetFen: number) {
  const requestHash = createHash('sha256').update(text).digest('hex');
  type PriorRequest = { request_hash: string; status: string; result: unknown };
  const priorResult = (prior: PriorRequest | undefined) => {
    if (!prior) throw new AppError('AI_REQUEST_UNCERTAIN', '草稿建议请求状态待核查，请勿重复提交', 409);
    if (prior.request_hash !== requestHash)
      throw new AppError('IDEMPOTENCY_MISMATCH', '此幂等键已用于不同草稿内容，请使用新键', 409);
    if (prior.status === 'COMPLETED') return prior.result;
    throw new AppError('AI_REQUEST_UNCERTAIN', '草稿建议仍在处理或状态待核查，请勿重复提交', 409);
  };
  const readPrior = async () => {
    const { rows } = await db.query<PriorRequest>(
      'SELECT request_hash,status,result FROM ai_draft_requests WHERE actor_id=$1 AND request_key=$2', [actor, key]);
    return rows[0];
  };
  const existing = await readPrior();
  if (existing) return priorResult(existing);
  // Reject malformed input before reserving a key for an external call that never happened.
  localDraftSuggestion(text, at);
  const { rows: started } = await db.query<{ request_key: string }>(`INSERT INTO ai_draft_requests
    (actor_id,request_key,request_hash,status,budget_fen)
    VALUES($1,$2,$3,'STARTED',$4) ON CONFLICT DO NOTHING RETURNING request_key`,
  [actor, key, requestHash, budgetFen]);
  if (!started.length) return priorResult(await readPrior());
  let suggestion: Awaited<ReturnType<typeof runDraftProvider>>;
  try { suggestion = await runDraftProvider(text, at, provider, budgetFen); }
  catch (error) {
    await db.query("UPDATE ai_draft_requests SET status='UNKNOWN',finished_at=clock_timestamp() WHERE actor_id=$1 AND request_key=$2",
      [actor, key]);
    throw error;
  }
  await db.query(`UPDATE ai_draft_requests SET status='COMPLETED',known_cost_fen=$3,cost_status=$4,result=$5::jsonb,
    finished_at=clock_timestamp() WHERE actor_id=$1 AND request_key=$2 AND status='STARTED'`,
  [actor, key, suggestion.providerCostFen, suggestion.providerCostStatus, JSON.stringify(suggestion)]);
  return suggestion;
}

const alertFilter = `(status='UNKNOWN' OR (status='STARTED' AND created_at<now()-interval '1 minute')
  OR (status='COMPLETED' AND (result->>'fallbackReason' IS NOT NULL OR cost_status<>'KNOWN')))`;

export async function listAiDraftAlerts(db: Database, offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', 'AI 草稿异常列表页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取 AI 草稿异常需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(actor_id,request_key,status,known_cost_fen,
        cost_status,result->>'fallbackReason',created_at,finished_at)::text,','
        ORDER BY actor_id,request_key),'')) AS snapshot FROM ai_draft_requests WHERE ${alertFilter}`);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', 'AI 草稿异常列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query(`SELECT actor_id,request_key,status,budget_fen,known_cost_fen,cost_status,
      result->>'fallbackReason' AS fallback_reason,created_at,finished_at
      FROM ai_draft_requests WHERE ${alertFilter}
      ORDER BY created_at,actor_id,request_key LIMIT 100 OFFSET $1`, [offset]);
    const total = totals[0]!.total;
    return { items: rows, total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
      snapshot: currentSnapshot };
  });
}
