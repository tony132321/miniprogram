import { createHash } from 'node:crypto';
import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { localDraftSuggestion } from './ai.ts';
import { runDraftProvider, type DraftProvider } from './ai-provider-boundary.ts';
import { createDraft } from './events.ts';

export async function runRecordedDraftProvider(db: Database, actor: string, key: string, text: string,
  at: number, provider: DraftProvider, budgetFen: number, eventId?: string) {
  const requestHash = createHash('sha256').update(text).digest('hex');
  type PriorRequest = { request_hash: string; status: string; result: unknown; event_id: string | null };
  const priorResult = (prior: PriorRequest | undefined) => {
    if (!prior) throw new AppError('AI_REQUEST_UNCERTAIN', '草稿建议请求状态待核查，请勿重复提交', 409);
    if (prior.request_hash !== requestHash)
      throw new AppError('IDEMPOTENCY_MISMATCH', '此幂等键已用于不同草稿内容，请使用新键', 409);
    if (eventId && prior.event_id !== eventId)
      throw new AppError('IDEMPOTENCY_MISMATCH', '此幂等键已用于其他活动草稿', 409);
    if (prior.status === 'COMPLETED') return prior.result;
    throw new AppError('AI_REQUEST_UNCERTAIN', '草稿建议仍在处理或状态待核查，请勿重复提交', 409);
  };
  const readPrior = async () => {
    const { rows } = await db.query<PriorRequest>(
      'SELECT request_hash,status,result,event_id FROM ai_draft_requests WHERE actor_id=$1 AND request_key=$2', [actor, key]);
    return rows[0];
  };
  const existing = await readPrior();
  if (existing) return priorResult(existing);
  // Reject malformed input before creating a draft or reserving an external-call key.
  localDraftSuggestion(text, at);
  const draft = eventId ? null : await createDraft(db, actor, {}, `ai:${key}`);
  const targetEventId = eventId ?? draft!.id;
  const reservation = await db.transaction(async tx => {
    let available = budgetFen;
    const { rows: drafts } = await tx.query<{ host_id: string; status: string; version: number }>(
      'SELECT host_id,status,version FROM events WHERE id=$1 FOR UPDATE', [targetEventId]);
    if (!drafts[0]) throw new AppError('NOT_FOUND', '草稿不存在', 404);
    if (drafts[0].host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可提取草稿建议', 403);
    if (drafts[0].status !== 'DRAFT') throw new AppError('INVALID_EVENT', '只有未发布草稿可提取建议', 409);
    const { rows: totals } = await tx.query<{ used_fen: number }>(`SELECT COALESCE(SUM(CASE
      WHEN status='COMPLETED' AND cost_status='KNOWN' THEN known_cost_fen ELSE reserved_fen END),0)::int AS used_fen
      FROM ai_draft_requests WHERE event_id=$1`, [targetEventId]);
    available = Math.max(0, budgetFen - totals[0]!.used_fen);
    const { rows } = await tx.query<{ request_key: string }>(`INSERT INTO ai_draft_requests
      (actor_id,request_key,request_hash,status,budget_fen,event_id,reserved_fen)
      VALUES($1,$2,$3,'STARTED',$4,$5,$4) ON CONFLICT DO NOTHING RETURNING request_key`,
    [actor, key, requestHash, available, targetEventId]);
    return { started: rows.length > 0, available, version: drafts[0].version };
  });
  if (!reservation.started) return priorResult(await readPrior());
  let suggestion: Awaited<ReturnType<typeof runDraftProvider>>;
  try { suggestion = await runDraftProvider(text, at, provider, reservation.available); }
  catch (error) {
    await db.query("UPDATE ai_draft_requests SET status='UNKNOWN',finished_at=clock_timestamp() WHERE actor_id=$1 AND request_key=$2",
      [actor, key]);
    throw error;
  }
  const result = { ...suggestion, draft: { id: targetEventId, version: reservation.version } };
  await db.query(`UPDATE ai_draft_requests SET status='COMPLETED',known_cost_fen=$3,cost_status=$4,result=$5::jsonb,
    finished_at=clock_timestamp() WHERE actor_id=$1 AND request_key=$2 AND status='STARTED'`,
  [actor, key, suggestion.providerCostFen, suggestion.providerCostStatus, JSON.stringify(result)]);
  return result;
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
    const { rows } = await tx.query(`SELECT actor_id,request_key,event_id,status,budget_fen,reserved_fen,known_cost_fen,cost_status,
      result->>'fallbackReason' AS fallback_reason,created_at,finished_at
      FROM ai_draft_requests WHERE ${alertFilter}
      ORDER BY created_at,actor_id,request_key LIMIT 100 OFFSET $1`, [offset]);
    const total = totals[0]!.total;
    return { items: rows, total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
      snapshot: currentSnapshot };
  });
}

export async function listAiEventCosts(db: Database, afterEventId?: string | null) {
  if (afterEventId && !/^[0-9a-f-]{36}$/.test(afterEventId))
    throw new AppError('BAD_REQUEST', 'AI 活动成本游标无效');
  const { rows } = await db.query<{ event_id: string; request_count: number; known_cost_fen: number;
    uncertain_reserved_fen: number; uncertain_count: number }>(`SELECT event_id,
    count(*)::int AS request_count,
    COALESCE(sum(CASE WHEN status='COMPLETED' AND cost_status='KNOWN' THEN known_cost_fen ELSE 0 END),0)::int AS known_cost_fen,
    COALESCE(sum(CASE WHEN status='COMPLETED' AND cost_status='KNOWN' THEN 0 ELSE reserved_fen END),0)::int AS uncertain_reserved_fen,
    count(*) FILTER (WHERE status<>'COMPLETED' OR cost_status<>'KNOWN')::int AS uncertain_count
    FROM ai_draft_requests WHERE event_id IS NOT NULL AND ($1::text IS NULL OR event_id>$1)
    GROUP BY event_id ORDER BY event_id LIMIT 101`, [afterEventId ?? null]);
  const items = rows.slice(0, 100);
  return { items, nextCursor: rows.length > 100 ? items[items.length - 1]!.event_id : null };
}
