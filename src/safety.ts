import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { audit, command, databaseNow, promote, type EventRow } from './registrations.ts';
import { enqueueNotification } from './notifications.ts';
import { newActionsOpen } from './emergency-gate.ts';
import { publicRecruitmentOpen } from './public-gate.ts';

export interface EventSafetyHold {
  id: string; eventId: string; status: 'ACTIVE' | 'RELEASED'; reason: string;
  createdBy: string; createdAt: Date; releasedBy: string | null;
  releaseReason: string | null; releasedAt: Date | null;
}
type Row = { id: string; event_id: string; status: 'ACTIVE' | 'RELEASED'; reason: string;
  created_by: string; created_at: Date; released_by: string | null;
  release_reason: string | null; released_at: Date | null };

function convert(row: Row): EventSafetyHold {
  return { id: row.id, eventId: row.event_id, status: row.status, reason: row.reason,
    createdBy: row.created_by, createdAt: row.created_at, releasedBy: row.released_by,
    releaseReason: row.release_reason, releasedAt: row.released_at };
}

function validReason(reason: unknown): reason is string {
  return typeof reason === 'string' && reason.trim().length >= 5 && reason.length <= 500;
}

export async function getActiveEventHold(db: Queryable, eventId: string): Promise<EventSafetyHold | null> {
  const { rows } = await db.query<Row>("SELECT * FROM event_safety_holds WHERE event_id=$1 AND status='ACTIVE'", [eventId]);
  return rows[0] ? convert(rows[0]) : null;
}

export async function assertEventNotHeld(tx: Queryable, eventId: string): Promise<void> {
  if (await getActiveEventHold(tx, eventId)) throw new AppError('RISK_HOLD', '活动因风险核查已暂停新增操作，仍可查看和退出', 409);
}

async function notifyMembers(tx: Queryable, event: EventRow, kind: string, holdId: string): Promise<void> {
  const { rows } = await tx.query<{ user_id: string }>("SELECT DISTINCT user_id FROM registrations WHERE event_id=$1 AND status IN ('CONFIRMED','RECONFIRM_REQUIRED','WAITLISTED','OFFERED','REQUESTED') UNION SELECT $2", [event.id, event.host_id]);
  for (const row of rows) await enqueueNotification(tx, event.id, row.user_id, kind, event.version, { holdId });
}

export async function placeEventHold(db: Database, actor: string, eventId: string, reason: string, key: string): Promise<EventSafetyHold> {
  return command(db, actor, `safety-hold:${eventId}`, key, async tx => {
    if (!validReason(reason)) throw new AppError('BAD_REQUEST', '暂停原因需为 5 至 500 字');
    const { rows: events } = await tx.query<EventRow>('SELECT id,host_id,status,version,payload,recruiting FROM events WHERE id=$1 FOR UPDATE', [eventId]);
    const event = events[0];
    if (!event) throw new AppError('NOT_FOUND', '活动不存在', 404);
    if (!['RECRUITING', 'CONFIRMED'].includes(event.status) || await databaseNow(tx) >= Date.parse(event.payload.startAt!))
      throw new AppError('INVALID_STATE', '当前活动不可暂停');
    if (await getActiveEventHold(tx, eventId)) throw new AppError('INVALID_STATE', '活动已暂停');
    const { rows } = await tx.query<Row>(`INSERT INTO event_safety_holds(id,event_id,status,reason,created_by)
      SELECT $1,id,'ACTIVE',$3,$4 FROM events WHERE id=$2
        AND status IN ('RECRUITING','CONFIRMED')
        AND clock_timestamp() < (payload->>'startAt')::timestamptz RETURNING *`,
      [randomUUID(), eventId, reason.trim(), actor]);
    if (!rows[0]) throw new AppError('INVALID_STATE', '当前活动不可暂停');
    await notifyMembers(tx, event, 'EVENT_SAFETY_PAUSED', rows[0]!.id);
    await audit(tx, actor, eventId, 'SAFETY_HOLD_PLACE');
    return convert(rows[0]!);
  });
}

export async function releaseEventHold(db: Database, actor: string, holdId: string, reason: string, key: string): Promise<EventSafetyHold> {
  return command(db, actor, `safety-release:${holdId}`, key, async tx => {
    if (!validReason(reason)) throw new AppError('BAD_REQUEST', '解除原因需为 5 至 500 字');
    const { rows: initial } = await tx.query<Row>('SELECT * FROM event_safety_holds WHERE id=$1', [holdId]);
    if (!initial[0]) throw new AppError('NOT_FOUND', '暂停记录不存在', 404);
    const { rows: events } = await tx.query<EventRow>('SELECT id,host_id,status,version,payload,recruiting FROM events WHERE id=$1 FOR UPDATE', [initial[0].event_id]);
    const event = events[0]!;
    const { rows: current } = await tx.query<Row>('SELECT * FROM event_safety_holds WHERE id=$1 FOR UPDATE', [holdId]);
    if (current[0]?.status !== 'ACTIVE') throw new AppError('INVALID_STATE', '暂停记录已解除');
    const { rows } = await tx.query<Row>("UPDATE event_safety_holds SET status='RELEASED',released_by=$2,release_reason=$3,released_at=now() WHERE id=$1 RETURNING *", [holdId, actor, reason.trim()]);
    const now = await databaseNow(tx);
    const canResume = ['RECRUITING', 'CONFIRMED'].includes(event.status) && event.recruiting &&
      now < Date.parse(event.payload.registrationDeadline!) && now < Date.parse(event.payload.startAt!) &&
      await newActionsOpen(tx, true) &&
      (event.payload.visibility !== 'PUBLIC' || await publicRecruitmentOpen(tx, true, event.payload));
    await notifyMembers(tx, event, canResume ? 'EVENT_SAFETY_RESUMED' : 'EVENT_SAFETY_REVIEW_CLOSED', holdId);
    await audit(tx, actor, event.id, 'SAFETY_HOLD_RELEASE');
    if (canResume) await promote(tx, event);
    return convert(rows[0]!);
  });
}

export async function listEventHolds(db: Database): Promise<EventSafetyHold[]> {
  const { rows } = await db.query<Row>('SELECT * FROM event_safety_holds ORDER BY created_at DESC,id DESC LIMIT 100');
  return rows.map(convert);
}
