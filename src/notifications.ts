import { createHash, randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { getEvent } from './events.ts';
import { claimIdempotency } from './idempotency.ts';
import { externalNoticeContract, type ExternalNoticeContract } from './notification-contract.ts';

export type NotificationPurpose = 'EVENT_REMINDER' | 'SIMILAR_ACTIVITY_INVITES';

const consentNotices: Record<NotificationPurpose, { scope: string; text: string }> = {
  EVENT_REMINDER: { scope: 'ACTIVITY_EXTERNAL_REMINDERS',
    text: '允许发送活动提醒；站内通知始终可查看，外部消息是否可用以实际服务配置为准。' },
  SIMILAR_ACTIVITY_INVITES: { scope: 'COMPLETED_ACTIVITY_INVITE_CANDIDATES',
    text: '允许旧活动主办方在结项后看到自己的活动内身份并将自己列入类似活动邀请候选；不会自动发送邀请。' }
};

export function consentNotice(purpose: NotificationPurpose) {
  const notice = consentNotices[purpose];
  return { ...notice, version: createHash('sha256').update(`${purpose}\n${notice.scope}\n${notice.text}`).digest('hex') };
}

export interface ExternalNotification extends ExternalNoticeContract {
  id: string;
  eventId: string;
  userId: string;
  kind: string;
  eventVersion: number;
  detail: Record<string, unknown>;
}

export interface NotificationAdapter {
  send(notification: ExternalNotification): Promise<
    { status: 'ACCEPTED'; providerRef: string } |
    { status: 'REJECTED'; failureCode: string } |
    { status: 'UNKNOWN'; failureCode: string }>;
}

export async function setConsent(db: Database, actor: string, purpose: NotificationPurpose, granted: boolean, key: string): Promise<{ purpose: NotificationPurpose; granted: boolean }> {
  if (!['EVENT_REMINDER', 'SIMILAR_ACTIVITY_INVITES'].includes(purpose) || typeof granted !== 'boolean' || !actor || !key)
    throw new AppError('BAD_REQUEST', '通知同意参数无效');
  return db.transaction(async tx => {
    if (granted) {
      const { rows: users } = await tx.query<{ status: string }>('SELECT status FROM users WHERE id=$1 FOR SHARE', [actor]);
      if (users[0] && users[0].status !== 'ACTIVE') throw new AppError('ACCOUNT_DISABLED', '账号已停用', 403);
      const { rows: deletions } = await tx.query('SELECT 1 FROM privacy_requests WHERE user_id=$1 AND kind=$2 AND status NOT IN ($3,$4) LIMIT 1 FOR SHARE',
        [actor, 'DELETE', 'FULFILLED', 'CANCELLED']);
      if (deletions.length) throw new AppError('DELETE_REQUEST_PENDING', '注销或删除申请处理中，暂不能重新开启授权', 409);
    }
    if (!(await claimIdempotency(tx, actor, `consent:${purpose}`, key))) {
      const { rows } = await tx.query<{ result: { purpose: NotificationPurpose; granted: boolean } }>('SELECT result FROM idempotency WHERE actor_id=$1 AND route=$2 AND key=$3', [actor, `consent:${purpose}`, key]);
      return rows[0]!.result;
    }
    const notice = consentNotice(purpose);
    await tx.query(`INSERT INTO notification_consents(user_id,purpose,granted,scope,notice_version) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT (user_id,purpose) DO UPDATE SET granted=EXCLUDED.granted,scope=EXCLUDED.scope,
        notice_version=EXCLUDED.notice_version,updated_at=now()`, [actor, purpose, granted, notice.scope, notice.version]);
    await tx.query(`INSERT INTO notification_consent_history(id,user_id,purpose,scope,notice_version,notice_text,granted)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(), actor, purpose, notice.scope, notice.version, notice.text, granted]);
    const result = { purpose, granted };
    await tx.query('UPDATE idempotency SET result=$4 WHERE actor_id=$1 AND route=$2 AND key=$3', [actor, `consent:${purpose}`, key, JSON.stringify(result)]);
    return result;
  });
}

export async function markNotificationOpened(db: Database, actor: string, notificationId: string, key: string): Promise<{ id: string; status: 'OPENED'; externalStatus: string }> {
  if (!actor || !key) throw new AppError('BAD_REQUEST', '身份与幂等键必填');
  return db.transaction(async tx => {
    const route = `open-notification:${notificationId}`;
    if (!(await claimIdempotency(tx, actor, route, key))) {
      const { rows } = await tx.query<{ result: { id: string; status: 'OPENED'; externalStatus: string } }>('SELECT result FROM idempotency WHERE actor_id=$1 AND route=$2 AND key=$3', [actor, route, key]);
      return rows[0]!.result;
    }
    const { rows } = await tx.query<{ user_id: string; event_id: string; external_status: string }>('SELECT user_id,event_id,external_status FROM notifications WHERE id=$1 FOR UPDATE', [notificationId]);
    if (!rows[0]) throw new AppError('NOT_FOUND', '通知不存在', 404);
    if (rows[0].user_id !== actor) throw new AppError('FORBIDDEN', '只能查看自己的通知', 403);
    await tx.query("UPDATE notifications SET status='OPENED',read_at=now() WHERE id=$1", [notificationId]);
    const result = { id: notificationId, status: 'OPENED' as const, externalStatus: rows[0].external_status };
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action) VALUES($1,$2,$3,$4)', [randomUUID(), actor, rows[0].event_id, 'OPEN_NOTIFICATION']);
    await tx.query('UPDATE idempotency SET result=$4 WHERE actor_id=$1 AND route=$2 AND key=$3', [actor, route, key, JSON.stringify(result)]);
    return result;
  });
}

export async function listMemberNotifications(db: Database, actor: string, offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', '通知列表页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取通知需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(id,read_at,created_at)::text,',' ORDER BY id),'')) AS snapshot
      FROM notifications WHERE user_id=$1`, [actor]);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', '通知列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query(`SELECT n.id,n.event_id,n.kind,n.event_version,n.status,n.external_status,n.read_at,n.detail,n.created_at,
      CASE WHEN n.kind='WAITLIST_OFFER' THEN EXISTS (SELECT 1 FROM offers o WHERE o.id=n.detail->>'offerId'
        AND o.status='ACTIVE' AND o.expires_at>now()) AND NOT EXISTS
        (SELECT 1 FROM event_safety_holds h WHERE h.event_id=n.event_id AND h.status='ACTIVE')
        AND EXISTS (SELECT 1 FROM emergency_gate g WHERE g.id=1 AND g.status='OPEN')
        AND EXISTS (SELECT 1 FROM events e WHERE e.id=n.event_id AND e.review_status='APPROVED'
          AND (e.payload->>'visibility'<>'PUBLIC' OR
          public_recruitment_covered((e.payload->>'startAt')::timestamptz,
            (e.payload->>'endAt')::timestamptz))) ELSE false END AS actionable,
      CASE WHEN n.kind='WAITLIST_OFFER' THEN EXISTS (SELECT 1 FROM offers o WHERE o.id=n.detail->>'offerId'
        AND o.status='ACTIVE' AND o.expires_at>now()) ELSE false END AS declinable
      FROM notifications n WHERE n.user_id=$1
      ORDER BY CASE WHEN n.read_at IS NULL THEN 0 ELSE 1 END,n.created_at DESC,n.id DESC
      LIMIT 100 OFFSET $2`, [actor, offset]);
    const total = totals[0]!.total;
    return { items: rows, total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
      snapshot: currentSnapshot };
  });
}

export async function getAttentionItems(db: Database, actor: string, eventId: string): Promise<Array<{
  notificationId: string; userId: string; kind: string; externalStatus: string; createdAt: Date
}>> {
  const event = await getEvent(db, actor, eventId);
  if (event.hostId !== actor) throw new AppError('FORBIDDEN', '只有主办方可查看人工处理清单', 403);
  if (!['CANCELLED', 'EXPIRED'].includes(event.status)) return [];
  const { rows } = await db.query<{ id: string; user_id: string; kind: string; external_status: string; created_at: Date }>(
    `SELECT id,user_id,kind,external_status,created_at FROM notifications WHERE event_id=$1 AND user_id<>$2
      AND kind IN ('EVENT_CANCELLED','EVENT_EXPIRED') AND read_at IS NULL ORDER BY created_at,id`, [eventId, actor]);
  return rows.map(row => ({ notificationId: row.id, userId: row.user_id, kind: row.kind,
    externalStatus: row.external_status, createdAt: row.created_at }));
}

export async function enqueueNotification(tx: Queryable, eventId: string, userId: string, kind: string, eventVersion: number, detail: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID();
  const contract = externalNoticeContract(kind);
  const { rows } = await tx.query<{ id: string }>(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,detail,
    external_purpose,external_channel,template_slot,external_scheduled_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()) ON CONFLICT DO NOTHING RETURNING id`,
    [id, eventId, userId, kind, eventVersion, JSON.stringify(detail), contract.externalPurpose,
      contract.externalChannel, contract.templateSlot]);
  if (!rows.length) {
    const { rows: existing } = await tx.query<{ id: string }>('SELECT id FROM notifications WHERE event_id=$1 AND user_id=$2 AND kind=$3 AND event_version=$4',
      [eventId, userId, kind, eventVersion]);
    if (!existing[0]) throw new AppError('NOTIFICATION_CONFLICT', '通知写入冲突', 500);
    return existing[0].id;
  }
  await tx.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload)
    SELECT $1,$2,$3,external_scheduled_at,$4 FROM notifications WHERE id=$5`,
    [randomUUID(), 'SEND_EXTERNAL', eventId, JSON.stringify({ notificationId: id }), id]);
  return id;
}

export async function enqueueInAppOutcomePrompt(tx: Queryable, eventId: string, userId: string,
  kind: 'EVENT_OUTCOME_DUE' | 'EVENT_OUTCOME_REVIEW', eventVersion: number): Promise<void> {
  await tx.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,external_status)
    VALUES($1,$2,$3,$4,$5,'UNAVAILABLE') ON CONFLICT DO NOTHING`,
  [randomUUID(), eventId, userId, kind, eventVersion]);
}

export async function enqueueStartReminder(tx: Queryable, eventId: string, userId: string, eventVersion: number): Promise<void> {
  const id = randomUUID();
  const contract = externalNoticeContract('EVENT_REMINDER');
  const { rows } = await tx.query<{ id: string }>(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,
    external_purpose,external_channel,template_slot,external_scheduled_at)
    SELECT $1,$2,$3,'EVENT_REMINDER',$4,$5,$6,$7,now() FROM events
    WHERE id=$2 AND clock_timestamp() < (payload->>'startAt')::timestamptz
    ON CONFLICT DO NOTHING RETURNING id`, [id, eventId, userId, eventVersion, contract.externalPurpose,
      contract.externalChannel, contract.templateSlot]);
  if (rows[0]) await tx.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload)
    SELECT $1,$2,$3,external_scheduled_at,$4 FROM notifications WHERE id=$5`,
    [randomUUID(), 'SEND_EXTERNAL', eventId, JSON.stringify({ notificationId: id }), id]);
}

type NotificationRow = { id: string; event_id: string; user_id: string; kind: string; event_version: number;
  detail: Record<string, unknown>; external_status: string; external_purpose: string | null;
  external_channel: string; template_slot: string | null };

function safeFailureCode(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value) ? value : fallback;
}

export async function dispatchNotification(db: Database, notificationId: string, adapter?: NotificationAdapter): Promise<void> {
  // Commit the in-flight marker before contacting the provider. If the process
  // stops after sending, the next worker records uncertainty instead of retrying.
  const claimed = await db.transaction(async tx => {
    const { rows } = await tx.query<NotificationRow>('SELECT * FROM notifications WHERE id=$1 FOR UPDATE', [notificationId]);
    const item = rows[0];
    if (!item) throw new AppError('MALFORMED_JOB', '外部通知任务关联记录不存在');
    if (item.external_status === 'DISPATCHING') {
      await tx.query(`UPDATE notifications SET external_status='UNKNOWN_REQUIRES_RECONCILIATION',
        external_failure_code='INTERRUPTED_DISPATCH' WHERE id=$1`, [item.id]);
      return null;
    }
    if (item.external_status !== 'NOT_REQUESTED') return null;
    await tx.query(`UPDATE notifications SET external_status='DISPATCHING',
      external_dispatch_started_at=clock_timestamp() WHERE id=$1`, [item.id]);
    return item;
  });
  if (!claimed) return;
  await db.transaction(async tx => {
    // Hold these locks through the provider call: a completed account disable,
    // consent withdrawal, event change, or registration exit cannot be followed by a new send.
    const { rows: events } = await tx.query<{ version: number; status: string; review_status: string; visibility: string; before_start: boolean }>(
      `SELECT version,status,review_status,payload->>'visibility' AS visibility,
        clock_timestamp() < (payload->>'startAt')::timestamptz AS before_start
        FROM events WHERE id=$1 FOR SHARE`, [claimed.event_id]);
    const { rows: users } = await tx.query<{ status: string }>(
      'SELECT status FROM users WHERE id=$1 FOR SHARE', [claimed.user_id]);
    const { rows: deletions } = await tx.query(`SELECT 1 FROM privacy_requests
      WHERE user_id=$1 AND kind='DELETE' AND status NOT IN ('FULFILLED','CANCELLED') LIMIT 1 FOR SHARE`, [claimed.user_id]);
    const { rows: registrations } = await tx.query<{ status: string }>('SELECT status FROM registrations WHERE event_id=$1 AND user_id=$2 FOR SHARE', [claimed.event_id, claimed.user_id]);
    const contract = externalNoticeContract(claimed.kind);
    const purposeConfigured = claimed.kind === 'EVENT_REMINDER' && claimed.external_purpose === 'EVENT_REMINDER' &&
      claimed.external_channel === contract.externalChannel && claimed.template_slot === contract.templateSlot;
    const { rows: consents } = purposeConfigured
      ? await tx.query<{ granted: boolean; notice_version: string | null }>(
        'SELECT granted,notice_version FROM notification_consents WHERE user_id=$1 AND purpose=$2 FOR SHARE',
        [claimed.user_id, 'EVENT_REMINDER']) : { rows: [] };
    const { rows: emergency } = claimed.kind === 'WAITLIST_OFFER'
      ? await tx.query<{ status: string }>('SELECT status FROM emergency_gate WHERE id=1 FOR SHARE') : { rows: [] };
    const { rows: holds } = claimed.kind === 'WAITLIST_OFFER'
      ? await tx.query<{ id: string }>("SELECT id FROM event_safety_holds WHERE event_id=$1 AND status='ACTIVE' FOR SHARE", [claimed.event_id]) : { rows: [] };
    const { rows: publicGate } = claimed.kind === 'WAITLIST_OFFER' && events[0]?.visibility === 'PUBLIC'
      ? await tx.query<{ open: boolean }>(`SELECT public_recruitment_covered(
          (e.payload->>'startAt')::timestamptz,(e.payload->>'endAt')::timestamptz) AS open
          FROM public_recruitment_gate g JOIN events e ON e.id=$1 WHERE g.id=1 FOR SHARE OF g`,
        [claimed.event_id]) : { rows: [] };
    const { rows: offers } = claimed.kind === 'WAITLIST_OFFER'
      ? await tx.query<{ active: boolean }>(`SELECT (status='ACTIVE' AND expires_at>clock_timestamp()) AS active
          FROM offers WHERE id=$1 AND event_id=$2 FOR SHARE`, [claimed.detail.offerId, claimed.event_id]) : { rows: [] };
    const { rows: current } = await tx.query<NotificationRow>('SELECT * FROM notifications WHERE id=$1 FOR UPDATE', [notificationId]);
    if (current[0]?.external_status !== 'DISPATCHING') return;
    const event = events[0];
    const registrationStatus = registrations[0]?.status;
    const noLongerRelevant = (['CANCELLED', 'EXPIRED'].includes(event?.status ?? '') && !['EVENT_CANCELLED', 'EVENT_EXPIRED'].includes(claimed.kind)) ||
      (['CANCELLED', 'EXPIRED', 'REJECTED', 'REMOVED'].includes(registrationStatus ?? '') &&
        !['EVENT_CANCELLED', 'EVENT_EXPIRED', 'REGISTRATION_REMOVED'].includes(claimed.kind)) ||
      (claimed.kind === 'EVENT_REMINDER' && (!['NOT_REQUIRED', 'APPROVED'].includes(event?.review_status ?? '') || !event?.before_start)) ||
      (claimed.kind === 'WAITLIST_OFFER' && (registrationStatus !== 'OFFERED' || event?.review_status !== 'APPROVED' ||
        emergency[0]?.status !== 'OPEN' ||
        holds.length > 0 || (event?.visibility === 'PUBLIC' && publicGate[0]?.open !== true) || !offers[0]?.active));
    const outcome = users[0] && users[0].status !== 'ACTIVE' ? 'ACCOUNT_DISABLED' :
      deletions.length ? 'DELETE_REQUEST_PENDING' :
      !event || event.version !== claimed.event_version ? 'STALE_VERSION' :
      noLongerRelevant ? 'STALE_STATE' :
      !purposeConfigured ? 'PURPOSE_NOT_CONFIGURED' :
      !consents[0]?.granted ? 'CONSENT_WITHDRAWN' :
      consents[0].notice_version !== consentNotice('EVENT_REMINDER').version ? 'CONSENT_RECONFIRM_REQUIRED' :
      !adapter ? 'UNAVAILABLE' : null;
    if (outcome) {
      await tx.query('UPDATE notifications SET external_status=$2,external_failure_code=$3 WHERE id=$1',
        [notificationId, outcome, outcome === 'UNAVAILABLE' ? 'NO_PROVIDER' : outcome]);
      return;
    }
    try {
      const result = await adapter!.send({ id: claimed.id, eventId: claimed.event_id, userId: claimed.user_id, kind: claimed.kind,
        eventVersion: claimed.event_version, detail: claimed.detail, ...contract });
      if (result.status === 'ACCEPTED' && typeof result.providerRef === 'string' &&
        result.providerRef.trim() && result.providerRef.length <= 200) {
        await tx.query(`UPDATE notifications SET external_status='PROVIDER_ACCEPTED',provider_ref=$2,
          provider_responded_at=clock_timestamp(),external_failure_code=NULL WHERE id=$1`,
          [notificationId, result.providerRef]);
      } else if (result.status === 'REJECTED') {
        await tx.query(`UPDATE notifications SET external_status='PROVIDER_REJECTED',
          provider_responded_at=clock_timestamp(),external_failure_code=$2 WHERE id=$1`,
          [notificationId, safeFailureCode(result.failureCode, 'PROVIDER_REJECTION_UNSPECIFIED')]);
      } else {
        await tx.query(`UPDATE notifications SET external_status='UNKNOWN_REQUIRES_RECONCILIATION',
          external_failure_code=$2 WHERE id=$1`,
          [notificationId, result.status === 'UNKNOWN'
            ? safeFailureCode(result.failureCode, 'PROVIDER_RESULT_UNKNOWN') : 'INVALID_PROVIDER_RESPONSE']);
      }
    } catch {
      await tx.query(`UPDATE notifications SET external_status='UNKNOWN_REQUIRES_RECONCILIATION',
        external_failure_code='PROVIDER_EXCEPTION' WHERE id=$1`, [notificationId]);
    }
  });
}
