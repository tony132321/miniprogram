import { randomUUID } from 'node:crypto';
import type { Database } from './db.ts';
import type { EventInput, EventRecord } from './events.ts';
import { AppError } from './errors.ts';
import { command, databaseNow } from './registrations.ts';
import { enqueueNotification } from './notifications.ts';
import { assertPublicRecruitmentOpen } from './public-gate.ts';

type ReviewRow = { id: string; host_id: string; status: string; version: number; payload: EventInput;
  recruiting: boolean; review_status: string; review_reason: string | null;
  resume_recruiting_after_review: boolean; updated_at: Date };

export async function listPendingEventReviews(db: Database, offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', '公开活动审核列表页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取公开活动审核需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(id,version,updated_at,payload)::text,',' ORDER BY id),'')) AS snapshot
      FROM events WHERE review_status='PENDING'`);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', '公开活动审核列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query<ReviewRow>(`SELECT id,host_id,status,version,payload,recruiting,review_status,review_reason,
      resume_recruiting_after_review,updated_at FROM events WHERE review_status='PENDING'
      ORDER BY updated_at,id LIMIT 100 OFFSET $1`, [offset]);
    const total = totals[0]!.total;
    return { items: rows.map(row => ({ id: row.id, hostId: row.host_id, version: row.version, payload: row.payload,
      title: row.payload.title, city: row.payload.city, venueName: row.payload.venueName,
      startAt: row.payload.startAt, feeMode: row.payload.feeMode, feeCapFen: row.payload.feeCapFen,
      status: row.status, reviewStatus: row.review_status })), total,
      nextOffset: offset + rows.length < total ? offset + rows.length : null, snapshot: currentSnapshot };
  });
}

export async function reviewEvent(db: Database, actor: string, eventId: string, expectedVersion: number,
  decision: string, reason: string, key: string): Promise<EventRecord> {
  return command(db, actor, `review-event:${eventId}`, key, async tx => {
    if (!['APPROVED', 'REJECTED'].includes(decision) || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500)
      throw new AppError('BAD_REQUEST', '审核结论及原因需完整填写（5 至 500 字）');
    const { rows: found } = await tx.query<ReviewRow>('SELECT * FROM events WHERE id=$1 FOR UPDATE', [eventId]);
    const current = found[0];
    if (!current) throw new AppError('NOT_FOUND', '活动不存在', 404);
    if (current.version !== expectedVersion) throw new AppError('VERSION_CONFLICT', '活动已更新，请重新审核当前版本', 409);
    if (current.payload.visibility !== 'PUBLIC' || current.review_status !== 'PENDING')
      throw new AppError('INVALID_STATE', '活动当前无需此审核');
    if (decision === 'APPROVED' && current.payload.approvalMode !== 'MANUAL')
      throw new AppError('REVIEW_REQUIRES_MANUAL_APPROVAL', '公开活动需先由主办方改为逐人审批报名', 409);
    if (decision === 'APPROVED') await assertPublicRecruitmentOpen(tx, 'PUBLIC', current.payload);
    if (decision === 'APPROVED') {
      const now = await databaseNow(tx);
      if (!((current.status === 'RECRUITING' && now < Date.parse(current.payload.confirmationDeadline!)) ||
        (current.status === 'CONFIRMED' && now < Date.parse(current.payload.startAt!))))
        throw new AppError('REVIEW_WINDOW_CLOSED', '活动当前不在可通过审核的时间窗', 409);
    }
    const { rows } = await tx.query<ReviewRow>(`UPDATE events SET review_status=$2,review_reason=$3,
      recruiting=CASE WHEN $2='APPROVED' THEN resume_recruiting_after_review ELSE false END,
      resume_recruiting_after_review=CASE WHEN $2='APPROVED' THEN false ELSE resume_recruiting_after_review END,
      updated_at=now() WHERE id=$1 AND ($2::text<>'APPROVED' OR
        (status='RECRUITING' AND (payload->>'confirmationDeadline')::timestamptz>clock_timestamp()) OR
        (status='CONFIRMED' AND (payload->>'startAt')::timestamptz>clock_timestamp())) RETURNING *`,
      [eventId, decision, decision === 'REJECTED' ? reason.trim() : null]);
    if (!rows[0]) throw new AppError('REVIEW_WINDOW_CLOSED', '活动当前不在可通过审核的时间窗', 409);
    await tx.query('INSERT INTO event_review_decisions(id,event_id,event_version,decision,reason,reviewed_by) VALUES($1,$2,$3,$4,$5,$6)',
      [randomUUID(), eventId, current.version, decision, reason.trim(), actor]);
    const recipients = await tx.query<{ user_id: string }>("SELECT DISTINCT user_id FROM registrations WHERE event_id=$1 AND status IN ('CONFIRMED','RECONFIRM_REQUIRED','WAITLISTED','OFFERED','REQUESTED') UNION SELECT $2", [eventId, current.host_id]);
    for (const item of recipients.rows) await enqueueNotification(tx, eventId, item.user_id, `EVENT_REVIEW_${decision}`, current.version);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action,detail) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), actor, eventId, 'EVENT_REVIEW', JSON.stringify({ version: current.version, decision })]);
    const row = rows[0]!;
    return { id: row.id, hostId: row.host_id, status: row.status, version: row.version,
      payload: row.payload, recruiting: row.recruiting, reviewStatus: row.review_status,
      ...(row.review_reason ? { reviewReason: row.review_reason } : {}), updatedAt: new Date(row.updated_at).toISOString() };
  });
}
