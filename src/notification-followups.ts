import { randomUUID } from 'node:crypto';
import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { command } from './registrations.ts';

interface NotificationFollowupItem {
  notificationId: string;
  eventId: string;
  userId: string;
  kind: string;
  externalStatus: string;
  failureCode: string | null;
  externalPurpose: string | null;
  externalChannel: string;
  templateSlot: string | null;
  scheduledAt: Date | null;
  providerRespondedAt: Date | null;
  createdAt: Date;
  readAt: Date | null;
}

type Row = { id: string; event_id: string; user_id: string; kind: string; external_status: string;
  external_failure_code: string | null; external_purpose: string | null; external_channel: string;
  template_slot: string | null; external_scheduled_at: Date | null; provider_responded_at: Date | null;
  created_at: Date; read_at: Date | null };

const pendingWhere = `(n.external_status='UNKNOWN_REQUIRES_RECONCILIATION'
      OR n.external_status='PROVIDER_REJECTED'
      OR (n.external_status IN ('UNAVAILABLE','PURPOSE_NOT_CONFIGURED') AND n.read_at IS NULL))
      AND EXISTS (SELECT 1 FROM jobs j WHERE j.kind='SEND_EXTERNAL' AND j.payload->>'notificationId'=n.id)
      AND NOT EXISTS (SELECT 1 FROM notification_followups f WHERE f.notification_id=n.id)`;

export async function listNotificationFollowups(db: Database, offset = 0, snapshot?: string | null): Promise<{
  items: NotificationFollowupItem[]; total: number; nextOffset: number | null; snapshot: string;
}> {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', '通知待跟进列表页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取通知待跟进需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(n.id,n.external_status,n.external_failure_code,n.read_at,n.created_at)::text,',' ORDER BY n.id),'')) AS snapshot
      FROM notifications n WHERE ${pendingWhere}`);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', '通知待跟进列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query<Row>(`SELECT n.id,n.event_id,n.user_id,n.kind,n.external_status,
      n.external_failure_code,n.external_purpose,n.external_channel,n.template_slot,
      n.external_scheduled_at,n.provider_responded_at,n.created_at,n.read_at
      FROM notifications n WHERE ${pendingWhere} ORDER BY n.created_at,n.id LIMIT 100 OFFSET $1`, [offset]);
    const total = totals[0]!.total;
    return { items: rows.map(row => ({ notificationId: row.id, eventId: row.event_id, userId: row.user_id, kind: row.kind,
      externalStatus: row.external_status, failureCode: row.external_failure_code,
      externalPurpose: row.external_purpose, externalChannel: row.external_channel,
      templateSlot: row.template_slot, scheduledAt: row.external_scheduled_at,
      providerRespondedAt: row.provider_responded_at, createdAt: row.created_at, readAt: row.read_at })),
      total, nextOffset: offset + rows.length < total ? offset + rows.length : null, snapshot: currentSnapshot };
  });
}

export async function listNotificationFollowupHistory(db: Database) {
  const { rows } = await db.query<Row & { note: string; recorded_by: string; recorded_at: Date }>(`SELECT n.id,n.event_id,n.user_id,n.kind,n.external_status,
    n.external_failure_code,n.external_purpose,n.external_channel,n.template_slot,
    n.external_scheduled_at,n.provider_responded_at,n.created_at,n.read_at,
    f.note,f.recorded_by,f.recorded_at FROM notification_followups f
    JOIN notifications n ON n.id=f.notification_id ORDER BY f.recorded_at DESC,f.notification_id LIMIT 100`);
  return rows.map(row => ({ notificationId: row.id, eventId: row.event_id, userId: row.user_id, kind: row.kind,
    externalStatus: row.external_status, failureCode: row.external_failure_code,
    externalPurpose: row.external_purpose, externalChannel: row.external_channel,
    templateSlot: row.template_slot, scheduledAt: row.external_scheduled_at,
    providerRespondedAt: row.provider_responded_at,
    createdAt: row.created_at, readAt: row.read_at, note: row.note,
    recordedBy: row.recorded_by, recordedAt: row.recorded_at }));
}

export async function recordNotificationFollowup(db: Database, actor: string, notificationId: string, note: unknown, key: string) {
  const length = typeof note === 'string' ? Array.from(note.trim()).length : 0;
  if (typeof note !== 'string' || length < 5 || length > 500)
    throw new AppError('BAD_REQUEST', '人工跟进说明须为 5 至 500 字');
  if (!notificationId) throw new AppError('BAD_REQUEST', '通知 ID 必填');
  return command(db, actor, `notification-followup:${notificationId}`, key, async tx => {
    const { rows } = await tx.query<Row>(`SELECT id,event_id,user_id,kind,external_status,external_failure_code,
      external_purpose,external_channel,template_slot,external_scheduled_at,provider_responded_at,
      created_at,read_at FROM notifications WHERE id=$1 FOR UPDATE`, [notificationId]);
    const row = rows[0];
    if (!row) throw new AppError('NOT_FOUND', '通知不存在', 404);
    const { rows: jobs } = await tx.query('SELECT id FROM jobs WHERE kind=$1 AND payload->>\'notificationId\'=$2 LIMIT 1', ['SEND_EXTERNAL', notificationId]);
    if (!jobs.length || (row.external_status !== 'UNKNOWN_REQUIRES_RECONCILIATION' &&
      row.external_status !== 'PROVIDER_REJECTED' &&
      !(row.read_at === null && ['UNAVAILABLE','PURPOSE_NOT_CONFIGURED'].includes(row.external_status))))
      throw new AppError('INVALID_STATE', '该通知不需要人工跟进', 409);
    const { rows: existing } = await tx.query('SELECT notification_id FROM notification_followups WHERE notification_id=$1', [notificationId]);
    if (existing.length) throw new AppError('ALREADY_HANDLED', '该通知已记录人工跟进', 409);
    const { rows: recorded } = await tx.query<{ recorded_at: Date }>(`INSERT INTO notification_followups(notification_id,recorded_by,note)
      VALUES($1,$2,$3) RETURNING recorded_at`, [notificationId, actor, note.trim()]);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action,detail) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), actor, row.event_id, 'NOTIFICATION_FOLLOWUP', JSON.stringify({ notificationId,
        externalStatus: row.external_status, failureCode: row.external_failure_code })]);
    return { notificationId, recordedBy: actor, recordedAt: recorded[0]!.recorded_at,
      externalStatus: row.external_status, failureCode: row.external_failure_code };
  });
}
