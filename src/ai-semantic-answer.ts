import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { buildAiEventContext, type AiEventContext } from './ai-context.ts';
import { answerFromCurrentEvent, askCurrentFact, currentApprovedAnswerBody,
  requireMember, type FactAnswer } from './collaboration.ts';
import { parseAnnouncementFaq } from './announcement-faq.ts';
import { redactAiContactText } from './ai-data-minimization.ts';
import { createHash, randomUUID } from 'node:crypto';
import { validatedEvidence, type ProviderEvidence } from './ai-provider-boundary.ts';
import { command } from './registrations.ts';
import { aiActorActive, requireAiActorActive } from './ai-account-fence.ts';

// The provider can select a source, but it never supplies an answer or a tool grant.
export interface SemanticFactProvider {
  estimateUpperBoundFen(question: string, context: AiEventContext): number;
  suggest(question: string, context: AiEventContext, signal: AbortSignal): Promise<unknown>;
}

type RequestRow = { event_id: string; request_hash: string; status: string; result: FactAnswer | null };
type CostStatus = 'KNOWN' | 'LOWER_BOUND' | 'UNKNOWN';

function similarQuestion(question: string, sourceQuestion: string): boolean {
  const clean = (value: string) => Array.from(value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '')).join('');
  const grams = (value: string) => {
    const chars = Array.from(clean(value));
    return new Set(chars.slice(0, -1).map((char, index) => char + chars[index + 1]));
  };
  const asked = grams(question); const source = grams(sourceQuestion);
  if (asked.size < 2 || source.size < 2) return false;
  let shared = 0;
  for (const gram of asked) if (source.has(gram)) shared++;
  return shared >= 2 && shared / Math.min(asked.size, source.size) >= 0.5;
}

export async function askSemanticCurrentFact(db: Database, actor: string, eventId: string, question: string,
  key: string, provider?: SemanticFactProvider, options: { budgetFen?: number; deadlineMs?: number;
    environment?: 'test' | 'development' | 'production' } = {}): Promise<FactAnswer> {
  if (typeof question !== 'string' || !question.trim() || question.length > 200)
    throw new AppError('BAD_REQUEST', '问题需为 1 至 200 字');
  if (!actor || !key) throw new AppError('BAD_REQUEST', '身份与幂等键必填');
  if (provider && options.environment !== 'test')
    throw new AppError('AI_PROVIDER_DISABLED', '真实语义模型尚未通过接入闸门', 503);
  const budgetFen = options.budgetFen ?? 0;
  const deadlineMs = options.deadlineMs ?? 30_000;
  if (!Number.isSafeInteger(budgetFen) || budgetFen < 0 || (provider && options.budgetFen === undefined))
    throw new AppError('BAD_REQUEST', '语义问答需要已配置的非负整数活动预算');
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 30_000)
    throw new AppError('BAD_REQUEST', '语义问答期限无效');
  const context = await buildAiEventContext(db, actor, eventId);
  if (!['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(context.event.status))
    throw new AppError('INVALID_STATE', '当前活动不能提问');
  const requestHash = createHash('sha256').update(question).digest('hex');
  const reservation = await db.transaction(async tx => {
    await requireAiActorActive(tx, actor);
    const { rows: locked } = await tx.query<{ version: number }>('SELECT version FROM events WHERE id=$1 FOR UPDATE', [eventId]);
    const current = await requireMember(tx, actor, eventId);
    if (locked[0]?.version !== context.event.version || current.version !== context.event.version)
      throw new AppError('VERSION_CONFLICT', '活动规则已更新，请刷新', 409);
    if (!['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(current.status))
      throw new AppError('INVALID_STATE', '当前活动不能提问');
    const { rows: existing } = await tx.query<RequestRow>(
      'SELECT event_id,request_hash,status,result FROM ai_semantic_requests WHERE actor_id=$1 AND request_key=$2', [actor, key]);
    if (existing[0]) return { prior: existing[0], available: 0, fallbackKey: null };
    const { rows: totals } = await tx.query<{ used_fen: number }>(`SELECT (
      (SELECT COALESCE(SUM(CASE WHEN status='COMPLETED' AND cost_status='KNOWN' THEN known_cost_fen ELSE reserved_fen END),0)
       FROM ai_draft_requests WHERE event_id=$1) +
      (SELECT COALESCE(SUM(CASE WHEN status='COMPLETED' AND cost_status='KNOWN' THEN known_cost_fen ELSE reserved_fen END),0)
       FROM ai_semantic_requests WHERE event_id=$1))::int AS used_fen`, [eventId]);
    const available = Math.max(0, budgetFen - totals[0]!.used_fen);
    const fallbackKey = randomUUID();
    const { rows: inserted } = await tx.query(`INSERT INTO ai_semantic_requests
      (actor_id,event_id,request_key,fallback_key,request_hash,status,budget_fen,reserved_fen)
      VALUES($1,$2,$3,$4,$5,'STARTED',$6,$6) ON CONFLICT DO NOTHING RETURNING request_key`,
    [actor, eventId, key, fallbackKey, requestHash, available]);
    if (!inserted.length) {
      const { rows: raced } = await tx.query<RequestRow>(
        'SELECT event_id,request_hash,status,result FROM ai_semantic_requests WHERE actor_id=$1 AND request_key=$2', [actor, key]);
      return { prior: raced[0], available: 0, fallbackKey: null };
    }
    return { prior: undefined, available, fallbackKey };
  });
  if (reservation.prior) {
    const prior = reservation.prior;
    if (prior.event_id !== eventId || prior.request_hash !== requestHash)
      throw new AppError('IDEMPOTENCY_MISMATCH', '此幂等键已用于不同活动或问题，请使用新键', 409);
    if (prior.status !== 'COMPLETED' || !prior.result)
      throw new AppError('AI_REQUEST_UNCERTAIN', '事实建议仍在处理或状态待核查，请勿重复提交', 409);
    const stillCurrent = await db.transaction(async tx => {
      const { rows: locked } = await tx.query<{ version: number }>('SELECT version FROM events WHERE id=$1 FOR SHARE', [eventId]);
      const event = await requireMember(tx, actor, eventId);
      const sourceVersion = event.visibleContentVersion ?? event.version;
      const replayVersion = prior.result!.source === 'UNKNOWN' ? event.version : sourceVersion;
      if (locked[0]?.version !== event.version || prior.result!.eventVersion !== replayVersion ||
        !['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(event.status)) return false;
      if (prior.result!.source === 'APPROVED_ANSWER') {
        const body = await currentApprovedAnswerBody(tx, eventId, sourceVersion, question, prior.result!.todoId);
        const label = sourceVersion === event.version ? `当前版本 ${event.version}` : `已审核版本 ${sourceVersion}`;
        return body !== undefined && prior.result!.answer === `${label}，主办方已审核回答：${body}`;
      }
      if (prior.result!.source === 'CURRENT_EVENT')
        return answerFromCurrentEvent(question.trim(), event) === prior.result!.answer;
      if (prior.result!.source !== 'APPROVED_ANNOUNCEMENT') return true;
      const { rows } = await tx.query<{ body: string }>(`SELECT body FROM activity_content WHERE id=$1 AND event_id=$2
        AND event_version=$3 AND kind='ANNOUNCEMENT' AND status='APPROVED'`,
      [prior.result!.sourceContentId, eventId, sourceVersion]);
      const faq = rows[0] && parseAnnouncementFaq(rows[0].body);
      const label = sourceVersion === event.version ? `当前版本 ${event.version}` : `已审核版本 ${sourceVersion}`;
      return !!faq && similarQuestion(question, faq.question) &&
        prior.result!.answer === `${label}，已审核公告：${faq.answer}`;
    });
    if (!stillCurrent) throw new AppError('VERSION_CONFLICT', '事实来源已更新，请使用新请求键重新提问', 409);
    return prior.result;
  }
  const complete = async (answer: FactAnswer, costFen = 0, costStatus: CostStatus = 'KNOWN',
    evidence: ProviderEvidence[] = [], fallbackReason?: string, retriedAfterStaleSource = false): Promise<FactAnswer> => {
    const persisted = await db.transaction(async tx => {
      if (!(await aiActorActive(tx, actor))) {
        await tx.query(`UPDATE ai_semantic_requests SET status='UNKNOWN',known_cost_fen=$4,cost_status=$5,
          provider_evidence=$6::jsonb,fallback_reason='ACCOUNT_DELETION',finished_at=clock_timestamp()
          WHERE actor_id=$1 AND event_id=$2 AND request_key=$3 AND status='STARTED'`,
        [actor, eventId, key, costFen, costStatus, JSON.stringify(evidence)]);
        return 'ACCOUNT_DISABLED' as const;
      }
      // Content can be revoked or deidentified between the provider validation
      // and this write. Lock it before the event to match content writers.
      const { rows: source } = answer.source === 'APPROVED_ANNOUNCEMENT'
        ? await tx.query<{ body: string }>(`SELECT body FROM activity_content WHERE id=$1 AND event_id=$2
          AND event_version=$3 AND kind='ANNOUNCEMENT' AND status='APPROVED' FOR SHARE`,
        [answer.sourceContentId, eventId, answer.eventVersion]) : { rows: [] as Array<{ body: string }> };
      const approvedAnswerBody = answer.source === 'APPROVED_ANSWER'
        ? await currentApprovedAnswerBody(tx, eventId, answer.eventVersion, question, answer.todoId, true) : undefined;
      const { rows: locked } = await tx.query<{ version: number }>('SELECT version FROM events WHERE id=$1 FOR SHARE NOWAIT', [eventId]);
      const current = await requireMember(tx, actor, eventId);
      const sourceVersion = current.visibleContentVersion ?? current.version;
      const faq = source[0] && parseAnnouncementFaq(source[0].body);
      const label = sourceVersion === current.version ? `当前版本 ${current.version}` : `已审核版本 ${sourceVersion}`;
      const stale = locked[0]?.version !== current.version ||
        !['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(current.status) ||
        answer.eventVersion !== (answer.source === 'UNKNOWN' ? current.version : sourceVersion) ||
        (answer.source === 'CURRENT_EVENT' && answerFromCurrentEvent(question.trim(), current) !== answer.answer) ||
        (answer.source === 'APPROVED_ANNOUNCEMENT' && (
          (!retriedAfterStaleSource && current.version !== context.event.version) ||
          !faq || !similarQuestion(question, faq.question) ||
          answer.answer !== `${label}，已审核公告：${faq.answer}`)) ||
        (answer.source === 'APPROVED_ANSWER' && (
          approvedAnswerBody === undefined || answer.answer !== `${label}，主办方已审核回答：${approvedAnswerBody}`));
      if (stale) return 'STALE_SOURCE' as const;
      const { rows } = await tx.query(`UPDATE ai_semantic_requests SET status='COMPLETED',result=$4::jsonb,
      known_cost_fen=$5,cost_status=$6,provider_evidence=$7::jsonb,fallback_reason=$8,finished_at=clock_timestamp()
      WHERE actor_id=$1 AND event_id=$2 AND request_key=$3 AND request_hash=$9 AND status='STARTED' RETURNING request_key`,
    [actor, eventId, key, JSON.stringify(answer), costFen, costStatus, JSON.stringify(evidence), fallbackReason ?? null, requestHash]);
      if (!rows.length) throw new AppError('AI_REQUEST_UNCERTAIN', '事实建议结果未能持久化，请人工核查', 409);
      return 'COMPLETED' as const;
    });
    if (persisted === 'ACCOUNT_DISABLED') throw new AppError('ACCOUNT_DISABLED', '账号当前不可使用或注销申请处理中', 403);
    if (persisted === 'STALE_SOURCE') {
      if (retriedAfterStaleSource) throw new AppError('VERSION_CONFLICT', '事实来源已更新，请使用新请求键重新提问', 409);
      return complete(await fallback(true), costFen, costStatus, evidence, fallbackReason ?? 'UNVERIFIED_SOURCE', true);
    }
    return answer;
  };
  const fallback = (freshKey = false) => askCurrentFact(db, actor, eventId, question,
    freshKey ? randomUUID() : reservation.fallbackKey!);
  let observedCostFen = 0;
  let observedCostStatus: CostStatus = 'UNKNOWN';
  let observedEvidence: ProviderEvidence[] = [];
  try {
    if (!provider || !context.announcements.length) return await complete(await fallback(), 0, 'KNOWN', [], 'UNAVAILABLE');
    if (reservation.available === 0) return await complete(await fallback(), 0, 'KNOWN', [], 'BUDGET');
    const providerQuestion = redactAiContactText(question.trim());
    let bound: number;
    try { bound = provider.estimateUpperBoundFen(providerQuestion, context); }
    catch { return await complete(await fallback(), 0, 'KNOWN', [], 'BUDGET'); }
    if (!Number.isSafeInteger(bound) || bound < 0 || bound > reservation.available)
      return await complete(await fallback(), 0, 'KNOWN', [], 'BUDGET');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deadlineMs);
    let raw: unknown;
    let timedOut = false;
    try {
      raw = await Promise.race([provider.suggest(providerQuestion, context, controller.signal),
        new Promise<never>((_resolve, reject) => controller.signal.addEventListener('abort', () => {
          timedOut = true; reject(new Error('semantic deadline'));
        }, { once: true }))]);
    } catch { return await complete(await fallback(), 0, 'UNKNOWN', [], timedOut ? 'TIMEOUT' : 'PROVIDER_ERROR'); }
    finally { clearTimeout(timer); }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      return await complete(await fallback(), 0, 'UNKNOWN', [], 'INVALID_RESPONSE');
    const candidate = raw as Record<string, unknown>;
    if (!Number.isSafeInteger(candidate.costFen) || Number(candidate.costFen) < 0 || Number(candidate.costFen) > bound)
      return await complete(await fallback(), 0, 'UNKNOWN', [], 'COST_BOUND_VIOLATION');
    const costFen = Number(candidate.costFen);
    observedCostFen = costFen;
    const evidence = validatedEvidence(candidate.evidence, 1, costFen);
    if (!evidence) return await complete(await fallback(), 0, 'UNKNOWN', [], 'INVALID_RESPONSE');
    observedEvidence = [evidence];
    if (evidence.receipt.status !== 'ACCEPTED')
      return await complete(await fallback(), costFen, costFen > 0 ? 'LOWER_BOUND' : 'UNKNOWN', [evidence], 'PROVIDER_ERROR');
    observedCostStatus = 'KNOWN';
    if (typeof candidate.sourceContentId !== 'string' || !candidate.sourceContentId ||
      candidate.eventVersion !== (context.event.visibleContentVersion ?? context.event.version) ||
      typeof candidate.confidence !== 'number' || !Number.isFinite(candidate.confidence) ||
      candidate.confidence < 0.9 || candidate.confidence > 1 ||
      !context.announcements.some(item => item.sourceContentId === candidate.sourceContentId))
      return await complete(await fallback(), costFen, 'KNOWN', [evidence], 'UNVERIFIED_SOURCE');
    const sourceContentId = candidate.sourceContentId;
    // Re-read authoritative membership, version and moderation state after the provider call.
    const answer = await db.transaction(async tx => {
    await requireAiActorActive(tx, actor);
    const { rows: locked } = await tx.query<{ version: number }>('SELECT version FROM events WHERE id=$1 FOR SHARE', [eventId]);
    const event = await requireMember(tx, actor, eventId);
    const sourceVersion = event.visibleContentVersion ?? event.version;
    if (locked[0]?.version !== context.event.version || event.version !== context.event.version ||
      sourceVersion !== candidate.eventVersion || !['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(event.status)) return null;
    const { rows: pending } = await tx.query(`SELECT 1 FROM activity_fact_todos WHERE event_id=$1 AND event_version=$2
      AND requester_id=$3 AND question_text=$4 AND status='OPEN' LIMIT 1`, [eventId, event.version, actor, question.trim()]);
    if (pending.length) return null;
    const { rows } = await tx.query<{ body: string }>(`SELECT body FROM activity_content WHERE id=$1 AND event_id=$2
      AND event_version=$3 AND kind='ANNOUNCEMENT' AND status='APPROVED'`, [sourceContentId, eventId, sourceVersion]);
    const faq = rows[0] && parseAnnouncementFaq(rows[0].body);
    if (!faq || !similarQuestion(question, faq.question)) return null;
    const label = sourceVersion === event.version ? `当前版本 ${event.version}` : `已审核版本 ${sourceVersion}`;
    return { answer: `${label}，已审核公告：${faq.answer}`, source: 'APPROVED_ANNOUNCEMENT' as const,
      eventVersion: sourceVersion, sourceContentId };
    });
    return await complete(answer ?? await fallback(), costFen, 'KNOWN', [evidence], answer ? undefined : 'UNVERIFIED_SOURCE');
  } catch (error) {
    await db.query(`UPDATE ai_semantic_requests SET status='UNKNOWN',known_cost_fen=$3,cost_status=$4,
      provider_evidence=$5::jsonb,fallback_reason=$6,finished_at=clock_timestamp()
      WHERE actor_id=$1 AND request_key=$2 AND status='STARTED'`,
    [actor, key, observedCostFen, observedCostStatus, JSON.stringify(observedEvidence),
      error instanceof AppError && error.code === 'ACCOUNT_DISABLED' ? 'ACCOUNT_DELETION' : 'UNEXPECTED_ERROR']);
    if (error && typeof error === 'object' && 'code' in error && error.code === '55P03')
      throw new AppError('VERSION_CONFLICT', '事实来源正在更新，请使用新请求键重新提问', 409);
    throw error;
  }
}

const semanticAlertFilter = `(status='UNKNOWN' OR (status='STARTED' AND created_at<now()-interval '1 minute')
  OR (status='COMPLETED' AND (cost_status<>'KNOWN' OR fallback_reason IS NOT NULL)))`;
const semanticAlertStateSql = `md5(jsonb_build_array(status,cost_status,fallback_reason)::text)`;
const pendingSemanticAlertFilter = `${semanticAlertFilter} AND NOT EXISTS (SELECT 1 FROM ai_semantic_alert_reviews r
  WHERE r.actor_id=ai_semantic_requests.actor_id AND r.request_key=ai_semantic_requests.request_key
    AND r.alert_state=${semanticAlertStateSql})`;

export async function reviewAiSemanticAlert(db: Database, reviewer: string, userId: unknown,
  requestKey: unknown, note: unknown, key: string) {
  if (typeof userId !== 'string' || !userId || typeof requestKey !== 'string' || !requestKey)
    throw new AppError('BAD_REQUEST', 'AI 语义请求身份与键必填');
  const trimmed = typeof note === 'string' ? note.trim() : '';
  if (Array.from(trimmed).length < 5 || Array.from(trimmed).length > 500)
    throw new AppError('BAD_REQUEST', '人工复核说明须为 5 至 500 字');
  const route = `ai-semantic-alert-review:${createHash('sha256').update(JSON.stringify([userId, requestKey])).digest('hex')}`;
  return command(db, reviewer, route, key, async tx => {
    const { rows } = await tx.query<{ event_id: string; status: string; cost_status: string | null;
      reserved_fen: number; known_cost_fen: number; fallback_reason: string | null; alert_state: string }>(
      `SELECT event_id,status,cost_status,reserved_fen,known_cost_fen,fallback_reason,
        ${semanticAlertStateSql} AS alert_state FROM ai_semantic_requests
        WHERE actor_id=$1 AND request_key=$2 FOR UPDATE`, [userId, requestKey]);
    if (!rows.length) throw new AppError('NOT_FOUND', 'AI 语义请求不存在', 404);
    const { rows: alerts } = await tx.query(`SELECT 1 FROM ai_semantic_requests
      WHERE actor_id=$1 AND request_key=$2 AND ${semanticAlertFilter}`, [userId, requestKey]);
    if (!alerts.length) throw new AppError('INVALID_STATE', '该请求不需要人工复核', 409);
    const row = rows[0]!;
    const { rows: inserted } = await tx.query<{ reviewed_at: Date }>(`INSERT INTO ai_semantic_alert_reviews
      (actor_id,request_key,alert_state,status_at_review,cost_status_at_review,reserved_fen_at_review,
        known_cost_fen_at_review,fallback_reason_at_review,reviewed_by,note)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING reviewed_at`,
    [userId, requestKey, row.alert_state, row.status, row.cost_status, row.reserved_fen,
      row.known_cost_fen, row.fallback_reason, reviewer, trimmed]);
    if (!inserted.length) throw new AppError('ALREADY_HANDLED', '该请求状态已记录人工复核', 409);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action,detail) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), reviewer, row.event_id, 'AI_SEMANTIC_ALERT_REVIEW',
        JSON.stringify({ userId, requestKey, requestStatus: row.status, alertState: row.alert_state })]);
    return { userId, requestKey, reviewState: 'REVIEW_RECORDED', reviewedBy: reviewer,
      requestStatus: row.status, reviewedAt: inserted[0]!.reviewed_at };
  });
}

export async function listAiSemanticAlerts(db: Database, offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', 'AI 语义异常列表页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取 AI 语义异常需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(actor_id,request_key,event_id,status,reserved_fen,
        known_cost_fen,cost_status,fallback_reason,created_at,finished_at)::text,','
        ORDER BY actor_id,request_key),'')) AS snapshot FROM ai_semantic_requests WHERE ${pendingSemanticAlertFilter}`);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', 'AI 语义异常列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query(`SELECT actor_id,event_id,request_key,status,budget_fen,reserved_fen,
      known_cost_fen,cost_status,fallback_reason,created_at,finished_at
      FROM ai_semantic_requests WHERE ${pendingSemanticAlertFilter}
      ORDER BY created_at,actor_id,request_key LIMIT 100 OFFSET $1`, [offset]);
    const total = totals[0]!.total;
    return { items: rows, total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
      snapshot: currentSnapshot };
  });
}

export async function listAiSemanticAlertReviews(db: Database, offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', 'AI 语义复核历史页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取 AI 语义复核历史需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(actor_id,request_key,alert_state,reviewed_by,note,reviewed_at)::text,','
        ORDER BY reviewed_at DESC,actor_id,request_key,alert_state),'')) AS snapshot
      FROM ai_semantic_alert_reviews`);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', 'AI 语义复核历史已变化，请从第一页刷新', 409);
    const { rows } = await tx.query(`SELECT r.actor_id,r.request_key,r.reviewed_by,r.note,r.reviewed_at,
      q.event_id,r.status_at_review AS status,r.reserved_fen_at_review AS reserved_fen,
      r.known_cost_fen_at_review AS known_cost_fen,r.cost_status_at_review AS cost_status,
      r.fallback_reason_at_review AS fallback_reason,r.alert_state
      FROM ai_semantic_alert_reviews r JOIN ai_semantic_requests q
        ON q.actor_id=r.actor_id AND q.request_key=r.request_key
      ORDER BY r.reviewed_at DESC,r.actor_id,r.request_key,r.alert_state LIMIT 100 OFFSET $1`, [offset]);
    const total = totals[0]!.total;
    return { items: rows, total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
      snapshot: currentSnapshot };
  });
}
