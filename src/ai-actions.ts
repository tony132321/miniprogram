import { createHash, randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { publishEventInTransaction, updateDraftInTransaction, validateDraftFields, validatePublish,
  type EventInput } from './events.ts';
import { command, databaseNow } from './registrations.ts';
import { requireAiActorActive } from './ai-account-fence.ts';

export type AiActionKind = 'SAVE_DRAFT' | 'PUBLISH_EVENT';
export type AiActionProposal = { kind: AiActionKind; eventId: string; expectedVersion: number; payload: EventInput };
export type AiActionReceipt = { actionId: string; status: 'SUCCEEDED'; eventId: string; resourceVersion: number;
  actualChanges: Record<string, unknown>; pendingItems: string[]; providerReference: null };

type ProposalRow = { id: string; actor_id: string; event_id: string; kind: AiActionKind; expected_version: number;
  payload: EventInput; payload_hash: string; status: string; expires_at: Date; receipt: AiActionReceipt | null };
type EventRow = { id: string; host_id: string; version: number; status: string; payload: EventInput;
  recruiting: boolean; review_status: string };
const draftFields = new Set(['title', 'type', 'startAt', 'endAt', 'timeZone', 'city', 'venueName',
  'skillLevel', 'minParticipants', 'maxParticipants', 'feeMode', 'feeCapFen']);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function aiActionHash(proposal: AiActionProposal): string {
  const { kind, eventId, expectedVersion, payload } = proposal;
  return createHash('sha256').update(canonical({ kind, eventId, expectedVersion, payload })).digest('hex');
}

function validProposal(input: AiActionProposal): void {
  if (!input || !['SAVE_DRAFT', 'PUBLISH_EVENT'].includes(input.kind) ||
    typeof input.eventId !== 'string' || !input.eventId || input.eventId.length > 160 ||
    !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 ||
    !input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload))
    throw new AppError('BAD_REQUEST', 'AI 动作提议无效');
  if (input.kind === 'SAVE_DRAFT' &&
    (!Object.keys(input.payload).length || Object.keys(input.payload).some(field => !draftFields.has(field))))
    throw new AppError('BAD_REQUEST', 'AI 草稿字段不在许可范围');
}

async function ownedDraft(tx: Queryable, actor: string, eventId: string, expectedVersion: number,
  lock: 'SHARE' | 'UPDATE' = 'SHARE'): Promise<EventRow> {
  const { rows } = await tx.query<EventRow>(`SELECT id,host_id,version,status,payload,recruiting,review_status
    FROM events WHERE id=$1 FOR ${lock}`, [eventId]);
  const event = rows[0];
  if (!event) throw new AppError('NOT_FOUND', '活动不存在', 404);
  if (event.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可授权 AI 动作', 403);
  if (event.version !== expectedVersion) throw new AppError('VERSION_CONFLICT', '活动规则已更新，请刷新', 409);
  if (event.status !== 'DRAFT') throw new AppError('INVALID_STATE', 'AI 动作仅适用于草稿', 409);
  return event;
}

async function actionRow(tx: Queryable, id: string): Promise<ProposalRow> {
  const { rows } = await tx.query<ProposalRow>('SELECT * FROM ai_action_proposals WHERE id=$1 FOR UPDATE', [id]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'AI 动作提议不存在', 404);
  return rows[0];
}

function assertOwner(row: ProposalRow, actor: string): void {
  if (row.actor_id !== actor) throw new AppError('FORBIDDEN', '无权处理此 AI 动作', 403);
}

async function assertLive(tx: Queryable, row: ProposalRow): Promise<void> {
  if (new Date(row.expires_at).getTime() <= await databaseNow(tx))
    throw new AppError('AI_APPROVAL_EXPIRED', 'AI 动作审批已过期，请重新生成提议', 409);
}

export async function prepareAiAction(db: Database, actor: string, input: AiActionProposal, key: string) {
  validProposal(input);
  return command(db, actor, 'ai-action-prepare', key, async tx => {
    await requireAiActorActive(tx, actor);
    const event = await ownedDraft(tx, actor, input.eventId, input.expectedVersion);
    if (input.kind === 'PUBLISH_EVENT') {
      if (canonical(input.payload) !== canonical(event.payload))
        throw new AppError('AI_PAYLOAD_MISMATCH', '发布内容与当前草稿不一致', 409);
      validatePublish(event.payload);
    } else validateDraftFields({ ...event.payload, ...input.payload });
    const id = randomUUID(); const payloadHash = aiActionHash(input);
    const { rows } = await tx.query<{ expires_at: Date }>(`INSERT INTO ai_action_proposals
      (id,actor_id,event_id,kind,expected_version,payload,payload_hash,status,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,'PROPOSED',clock_timestamp()+interval '5 minutes') RETURNING expires_at`,
    [id, actor, input.eventId, input.kind, input.expectedVersion, JSON.stringify(input.payload), payloadHash]);
    return { id, actorId: actor, eventId: input.eventId, kind: input.kind,
      expectedVersion: input.expectedVersion, payloadHash, status: 'PROPOSED' as const,
      expiresAt: new Date(rows[0]!.expires_at).toISOString(), preview: input.payload };
  });
}

export async function approveAiAction(db: Database, actor: string, id: string, approved: unknown,
  payloadHash: unknown, key: string) {
  if (approved !== true || typeof payloadHash !== 'string' || !/^[a-f0-9]{64}$/.test(payloadHash))
    throw new AppError('BAD_REQUEST', '请明确批准当前 AI 动作内容');
  return command(db, actor, `ai-action-approve:${id}`, key, async tx => {
    await requireAiActorActive(tx, actor);
    const row = await actionRow(tx, id); assertOwner(row, actor);
    if (row.status !== 'PROPOSED') throw new AppError('AI_APPROVAL_INVALID', 'AI 动作提议已失效', 409);
    await assertLive(tx, row);
    if (payloadHash !== row.payload_hash) throw new AppError('AI_PAYLOAD_MISMATCH', '审批内容与提议不一致', 409);
    const event = await ownedDraft(tx, actor, row.event_id, row.expected_version);
    if (row.kind === 'PUBLISH_EVENT' && canonical(event.payload) !== canonical(row.payload))
      throw new AppError('AI_PAYLOAD_MISMATCH', '草稿内容已变化', 409);
    await assertLive(tx, row);
    const { rows: approvedRows } = await tx.query<{ id: string }>(`UPDATE ai_action_proposals
      SET status='APPROVED',approved_at=clock_timestamp()
      WHERE id=$1 AND status='PROPOSED' AND expires_at>clock_timestamp() RETURNING id`, [id]);
    if (!approvedRows.length) throw new AppError('AI_APPROVAL_EXPIRED', 'AI 动作审批已过期，请重新生成提议', 409);
    return { id, status: 'APPROVED' as const, payloadHash: row.payload_hash };
  });
}

export async function revokeAiAction(db: Database, actor: string, id: string, key: string) {
  return command(db, actor, `ai-action-revoke:${id}`, key, async tx => {
    await requireAiActorActive(tx, actor);
    const row = await actionRow(tx, id); assertOwner(row, actor);
    if (!['PROPOSED', 'APPROVED'].includes(row.status))
      throw new AppError('AI_APPROVAL_INVALID', 'AI 动作提议已失效', 409);
    await tx.query("UPDATE ai_action_proposals SET status='REVOKED',revoked_at=clock_timestamp() WHERE id=$1", [id]);
    return { id, status: 'REVOKED' as const };
  });
}

export async function executeAiAction(db: Database, actor: string, id: string, input: AiActionProposal & { payloadHash: string },
  key: string): Promise<AiActionReceipt> {
  validProposal(input);
  if (typeof input.payloadHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.payloadHash))
    throw new AppError('BAD_REQUEST', 'AI 动作内容哈希无效');
  return command(db, actor, `ai-action-execute:${id}`, key, async tx => {
    await requireAiActorActive(tx, actor);
    const row = await actionRow(tx, id); assertOwner(row, actor);
    if (row.status !== 'APPROVED') throw new AppError('AI_APPROVAL_INVALID', 'AI 动作尚未获批或已执行', 409);
    await assertLive(tx, row);
    if (row.kind !== input.kind || row.event_id !== input.eventId || row.expected_version !== input.expectedVersion ||
      row.payload_hash !== input.payloadHash || row.payload_hash !== aiActionHash(input))
      throw new AppError('AI_PAYLOAD_MISMATCH', '执行内容与已批准内容不一致', 409);
    const event = await ownedDraft(tx, actor, row.event_id, row.expected_version, 'UPDATE');
    await assertLive(tx, row);
    if (row.kind === 'PUBLISH_EVENT' && canonical(event.payload) !== canonical(row.payload))
      throw new AppError('AI_PAYLOAD_MISMATCH', '草稿内容已变化', 409);
    const changed = row.kind === 'SAVE_DRAFT'
      ? await updateDraftInTransaction(tx, actor, row.event_id, row.expected_version, row.payload, `ai-action:${id}`)
      : await publishEventInTransaction(tx, actor, row.event_id, row.expected_version, `ai-action:${id}`);
    const actualChanges: Record<string, unknown> = {};
    if (row.kind === 'SAVE_DRAFT') {
      for (const [field, value] of Object.entries(row.payload))
        if (canonical((event.payload as Record<string, unknown>)[field]) !== canonical(value))
          actualChanges[field] = (changed.payload as Record<string, unknown>)[field];
    } else {
      if (event.status !== changed.status) actualChanges.status = changed.status;
      if (event.recruiting !== changed.recruiting) actualChanges.recruiting = changed.recruiting;
      if (event.review_status !== changed.reviewStatus) actualChanges.reviewStatus = changed.reviewStatus;
      if (event.payload.hostParticipates) actualChanges.hostSeatReserved = true;
      actualChanges.inviteIssued = true;
      actualChanges.venueStatementRecorded = true;
      actualChanges.deadlineJobsScheduled = 2;
    }
    const receipt: AiActionReceipt = { actionId: randomUUID(), status: 'SUCCEEDED', eventId: row.event_id,
      resourceVersion: changed.version,
      actualChanges,
      pendingItems: changed.reviewStatus === 'PENDING'
        ? [changed.payload.visibility === 'PUBLIC' ? 'PUBLIC_REVIEW' : 'INVITE_REVIEW'] : [], providerReference: null };
    await tx.query(`INSERT INTO audit(id,actor_id,event_id,action,detail)
      VALUES($1,$2,$3,'AI_ACTION_EXECUTE',$4::jsonb)`,
    [receipt.actionId, actor, row.event_id, JSON.stringify({ proposalId: id, kind: row.kind })]);
    const { rows: completedRows } = await tx.query<{ id: string }>(`UPDATE ai_action_proposals
      SET status='SUCCEEDED',action_id=$2,receipt=$3::jsonb,executed_at=clock_timestamp()
      WHERE id=$1 AND status='APPROVED' AND expires_at>clock_timestamp() RETURNING id`,
    [id, receipt.actionId, JSON.stringify(receipt)]);
    if (!completedRows.length) throw new AppError('AI_APPROVAL_EXPIRED', 'AI 动作审批已过期，请重新生成提议', 409);
    return receipt;
  });
}
