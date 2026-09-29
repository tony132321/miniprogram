import { randomBytes, randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import type { EventInput } from './events.ts';
import { AppError } from './errors.ts';
import { enqueueNotification } from './notifications.ts';
import { assertEventNotHeld, getActiveEventHold } from './safety.ts';
import { assertPublicRecruitmentOpen, publicRecruitmentOpen } from './public-gate.ts';
import { claimIdempotency } from './idempotency.ts';
import { newActionsOpen } from './emergency-gate.ts';
import { hasCohostCapability } from './cohosts.ts';

export interface Registration { id: string; eventId: string; userId: string; status: string; acceptedVersion: number | null }
type RegistrationRow = { id: string; event_id: string; user_id: string; status: string; accepted_version: number | null };
export type EventRow = { id: string; host_id: string; status: string; version: number; payload: EventInput; recruiting: boolean;
  invite_token: string | null; invite_expires_at: Date | null; review_status: string; resume_recruiting_after_review: boolean };
type Reservation = { id: string; token: string; event_id: string; expires_at: Date; claimed_by: string | null; released_at: Date | null };
type Offer = { id: string; event_id: string; registration_id: string; expires_at: Date; status: string };

function convert(row: RegistrationRow): Registration {
  return { id: row.id, eventId: row.event_id, userId: row.user_id, status: row.status, acceptedVersion: row.accepted_version };
}

export async function command<T>(db: Database, actor: string, route: string, key: string, run: (tx: Queryable) => Promise<T>): Promise<T> {
  if (!actor || !key) throw new AppError('BAD_REQUEST', '身份与幂等键必填');
  return db.transaction(async tx => {
    if (!(await claimIdempotency(tx, actor, route, key))) {
      const previous = await tx.query<{ result: T }>('SELECT result FROM idempotency WHERE actor_id=$1 AND route=$2 AND key=$3', [actor, route, key]);
      return previous.rows[0]!.result;
    }
    const result = await run(tx);
    await tx.query('UPDATE idempotency SET result=$4 WHERE actor_id=$1 AND route=$2 AND key=$3', [actor, route, key, JSON.stringify(result)]);
    return result;
  });
}

export async function lockEvent(tx: Queryable, eventId: string, expectedVersion: number): Promise<EventRow> {
  const { rows } = await tx.query<EventRow>('SELECT id,host_id,status,version,payload,recruiting,invite_token,invite_expires_at,review_status,resume_recruiting_after_review FROM events WHERE id=$1 FOR UPDATE', [eventId]);
  const event = rows[0];
  if (!event) throw new AppError('NOT_FOUND', '活动不存在', 404);
  if (event.version !== expectedVersion) throw new AppError('VERSION_CONFLICT', '活动规则已更新，请刷新', 409);
  return event;
}

async function requireInvitation(tx: Queryable, event: EventRow, actor: string, inviteToken: string | null): Promise<void> {
  if (event.payload.visibility !== 'INVITE' || actor === event.host_id) return;
  if (!inviteToken || inviteToken !== event.invite_token || !event.invite_expires_at ||
    new Date(event.invite_expires_at).getTime() <= await databaseNow(tx))
    throw new AppError('FORBIDDEN', '需要有效邀请', 403);
}

export async function occupancy(tx: Queryable, eventId: string): Promise<number> {
  const { rows } = await tx.query<{ n: number }>(`SELECT
    (SELECT count(*)::int FROM registrations WHERE event_id=$1 AND status IN ('CONFIRMED','RECONFIRM_REQUIRED')) +
    (SELECT count(*)::int FROM offers WHERE event_id=$1 AND status='ACTIVE' AND expires_at>clock_timestamp()) +
    (SELECT count(*)::int FROM reservations WHERE event_id=$1 AND claimed_by IS NULL AND released_at IS NULL AND expires_at>clock_timestamp()) AS n`, [eventId]);
  return rows[0]?.n ?? 0;
}

export async function databaseNow(tx: Queryable): Promise<number> {
  const { rows } = await tx.query<{ current_time: Date }>('SELECT clock_timestamp() AS current_time');
  return new Date(rows[0]!.current_time).getTime();
}

export async function audit(tx: Queryable, actor: string, eventId: string, action: string): Promise<void> {
  await tx.query('INSERT INTO audit(id,actor_id,event_id,action) VALUES($1,$2,$3,$4)', [randomUUID(), actor, eventId, action]);
}

export async function promote(tx: Queryable, event: EventRow): Promise<void> {
  if (!event.recruiting) return;
  const { rows: reviews } = await tx.query<{ review_status: string }>('SELECT review_status FROM events WHERE id=$1', [event.id]);
  if (reviews[0]?.review_status !== 'APPROVED') return;
  if (!(await newActionsOpen(tx, true))) return;
  if (await getActiveEventHold(tx, event.id)) return;
  if (event.payload.visibility === 'PUBLIC' && !(await publicRecruitmentOpen(tx, true, event.payload))) return;
  const deadline = Date.parse(event.payload.registrationDeadline!);
  while (await occupancy(tx, event.id) < event.payload.maxParticipants!) {
    const now = await databaseNow(tx);
    if (deadline - now < 5 * 60_000) {
      const waiting = await tx.query<{ id: string }>("SELECT id FROM registrations WHERE event_id=$1 AND status='WAITLISTED' LIMIT 1", [event.id]);
      if (waiting.rows.length) {
        const existing = await tx.query<{ id: string }>(
          "SELECT id FROM notifications WHERE event_id=$1 AND user_id=$2 AND kind='WAITLIST_WINDOW_CLOSED' AND event_version=$3 LIMIT 1",
          [event.id, event.host_id, event.version]);
        if (!existing.rows.length) await enqueueNotification(tx, event.id, event.host_id, 'WAITLIST_WINDOW_CLOSED', event.version,
          { registrationDeadline: event.payload.registrationDeadline });
      }
      return;
    }
    const { rows } = await tx.query<RegistrationRow>("SELECT * FROM registrations WHERE event_id=$1 AND status='WAITLISTED' ORDER BY enqueue_seq LIMIT 1 FOR UPDATE", [event.id]);
    const next = rows[0];
    if (!next) return;
    const expiresAt = new Date(Math.min(now + 15 * 60_000, deadline));
    const offerId = randomUUID();
    await tx.query("UPDATE registrations SET status='OFFERED',updated_at=now() WHERE id=$1", [next.id]);
    await tx.query("INSERT INTO offers(id,event_id,registration_id,expires_at,status) VALUES($1,$2,$3,$4,'ACTIVE')", [offerId, event.id, next.id, expiresAt.toISOString()]);
    await enqueueNotification(tx, event.id, next.user_id, 'WAITLIST_OFFER', event.version, { offerId, expiresAt: expiresAt.toISOString() });
    await tx.query('INSERT INTO jobs(id,kind,event_id,due_at,payload) VALUES($1,$2,$3,$4,$5)', [randomUUID(), 'EXPIRE_OFFER', event.id, expiresAt.toISOString(), JSON.stringify({ offerId })]);
  }
}

export async function register(db: Database, actor: string, eventId: string, expectedVersion: number, key: string, inviteToken: string | null): Promise<Registration> {
  return command(db, actor, `register:${eventId}`, key, async tx => {
    const event = await lockEvent(tx, eventId, expectedVersion);
    await requireInvitation(tx, event, actor, inviteToken);
    const inviteRequired = event.payload.visibility === 'INVITE' && actor !== event.host_id;
    await assertEventNotHeld(tx, eventId);
    await assertPublicRecruitmentOpen(tx, event.payload.visibility, event.payload);
    if (event.review_status !== 'APPROVED') throw new AppError('REVIEW_PENDING', '活动内容尚未通过审核', 409);
    if (!event.recruiting || !['RECRUITING', 'CONFIRMED'].includes(event.status) ||
      await databaseNow(tx) >= Date.parse(event.payload.registrationDeadline!))
      throw new AppError('REGISTRATION_CLOSED', '当前不能报名');
    await promote(tx, event);
    const { rows: existing } = await tx.query<RegistrationRow>('SELECT * FROM registrations WHERE event_id=$1 AND user_id=$2', [eventId, actor]);
    if (existing[0]?.status === 'REMOVED') throw new AppError('REMOVED', '已被本次活动移除，可在个人中心申诉', 403);
    if (existing[0] && !['CANCELLED', 'EXPIRED', 'REJECTED', 'INTERESTED'].includes(existing[0].status)) return convert(existing[0]);
    const status = event.payload.approvalMode === 'MANUAL' ? 'REQUESTED' : await occupancy(tx, eventId) < event.payload.maxParticipants! ? 'CONFIRMED' : 'WAITLISTED';
    let row: RegistrationRow;
    if (existing[0]) {
      const result = await tx.query<RegistrationRow>(`UPDATE registrations SET status=$2,accepted_version=$3,
        enqueue_seq=nextval('registration_enqueue_seq'),created_at=now(),updated_at=now()
        WHERE id=$1 AND EXISTS (SELECT 1 FROM events WHERE id=$4
          AND (payload->>'registrationDeadline')::timestamptz>clock_timestamp()
          AND ($5::boolean=false OR invite_expires_at>clock_timestamp())) RETURNING *`,
      [existing[0].id, status, status === 'CONFIRMED' ? event.version : null, eventId, inviteRequired]);
      if (!result.rows[0]) throw new AppError('REGISTRATION_CLOSED', '当前不能报名');
      row = result.rows[0];
    } else {
      const result = await tx.query<RegistrationRow>(`INSERT INTO registrations(id,event_id,user_id,status,accepted_version)
        SELECT $1,$2,$3,$4,$5 FROM events WHERE id=$2
          AND (payload->>'registrationDeadline')::timestamptz>clock_timestamp()
          AND ($6::boolean=false OR invite_expires_at>clock_timestamp()) RETURNING *`,
      [randomUUID(), eventId, actor, status, status === 'CONFIRMED' ? event.version : null, inviteRequired]);
      if (!result.rows[0]) throw new AppError('REGISTRATION_CLOSED', '当前不能报名');
      row = result.rows[0];
    }
    await audit(tx, actor, eventId, `REGISTER_${status}`);
    await enqueueNotification(tx, eventId, actor, 'REGISTRATION_STATUS', event.version, { status });
    return convert(row);
  });
}

export async function expressInterest(db: Database, actor: string, eventId: string, expectedVersion: number, key: string, inviteToken: string | null): Promise<Registration> {
  return command(db, actor, `interest:${eventId}`, key, async tx => {
    const event = await lockEvent(tx, eventId, expectedVersion);
    await requireInvitation(tx, event, actor, inviteToken);
    const inviteRequired = event.payload.visibility === 'INVITE' && actor !== event.host_id;
    await assertEventNotHeld(tx, eventId);
    await assertPublicRecruitmentOpen(tx, event.payload.visibility, event.payload);
    if (event.review_status !== 'APPROVED') throw new AppError('REVIEW_PENDING', '活动内容尚未通过审核', 409);
    if (!event.recruiting || !['RECRUITING', 'CONFIRMED'].includes(event.status) ||
      await databaseNow(tx) >= Date.parse(event.payload.registrationDeadline!))
      throw new AppError('REGISTRATION_CLOSED', '当前不能表达待定意向');
    const { rows: existing } = await tx.query<RegistrationRow>('SELECT * FROM registrations WHERE event_id=$1 AND user_id=$2', [eventId, actor]);
    if (existing[0]?.status === 'INTERESTED') return convert(existing[0]);
    if (existing[0] && !['CANCELLED', 'EXPIRED', 'REJECTED'].includes(existing[0].status)) throw new AppError('INVALID_STATE', '当前报名状态不能改为待定');
    const { rows } = existing[0]
      ? await tx.query<RegistrationRow>(`UPDATE registrations SET status='INTERESTED',accepted_version=NULL,
          created_at=now(),updated_at=now() WHERE id=$1 AND EXISTS (SELECT 1 FROM events WHERE id=$2
          AND (payload->>'registrationDeadline')::timestamptz>clock_timestamp()
          AND ($3::boolean=false OR invite_expires_at>clock_timestamp())) RETURNING *`,
        [existing[0].id, eventId, inviteRequired])
      : await tx.query<RegistrationRow>(`INSERT INTO registrations(id,event_id,user_id,status)
          SELECT $1,$2,$3,'INTERESTED' FROM events WHERE id=$2
          AND (payload->>'registrationDeadline')::timestamptz>clock_timestamp()
          AND ($4::boolean=false OR invite_expires_at>clock_timestamp()) RETURNING *`,
        [randomUUID(), eventId, actor, inviteRequired]);
    if (!rows[0]) throw new AppError('REGISTRATION_CLOSED', '当前不能表达待定意向');
    await enqueueNotification(tx, eventId, actor, 'REGISTRATION_STATUS', event.version, { status: 'INTERESTED' });
    await audit(tx, actor, eventId, 'REGISTER_INTERESTED');
    return convert(rows[0]!);
  });
}

export async function cancelRegistration(db: Database, actor: string, registrationId: string, expectedVersion: number, key: string): Promise<Registration> {
  return command(db, actor, `cancel-registration:${registrationId}`, key, async tx => {
    const { rows: found } = await tx.query<RegistrationRow>('SELECT * FROM registrations WHERE id=$1', [registrationId]);
    const registration = found[0];
    if (!registration) throw new AppError('NOT_FOUND', '报名不存在', 404);
    const event = await lockEvent(tx, registration.event_id, expectedVersion);
    if (registration.user_id !== actor) throw new AppError('FORBIDDEN', '只能退出自己的报名', 403);
    if (registration.status === 'CANCELLED') return convert(registration);
    if (await databaseNow(tx) >= Date.parse(event.payload.startAt!))
      throw new AppError('INVALID_STATE', '活动开始后不能按普通退出处理');
    if (!['CONFIRMED', 'RECONFIRM_REQUIRED', 'WAITLISTED', 'OFFERED', 'REQUESTED', 'INTERESTED'].includes(registration.status))
      throw new AppError('INVALID_STATE', '该报名不能退出');
    if (event.status === 'COMPLETED') throw new AppError('INVALID_STATE', '活动已结束');
    const released = ['CONFIRMED', 'RECONFIRM_REQUIRED', 'OFFERED'].includes(registration.status);
    if (registration.status === 'OFFERED') await tx.query("UPDATE offers SET status='CANCELLED' WHERE registration_id=$1 AND status='ACTIVE'", [registration.id]);
    const { rows } = await tx.query<RegistrationRow>(`UPDATE registrations SET status='CANCELLED',updated_at=now()
      WHERE id=$1 AND EXISTS (SELECT 1 FROM events WHERE id=$2
        AND (payload->>'startAt')::timestamptz>clock_timestamp()) RETURNING *`, [registration.id, event.id]);
    if (!rows[0]) throw new AppError('INVALID_STATE', '活动开始后不能按普通退出处理');
    if (released) await promote(tx, event);
    await audit(tx, actor, event.id, 'CANCEL_REGISTRATION');
    return convert(rows[0]!);
  });
}

export async function removeRegistration(db: Database, actor: string, registrationId: string, expectedVersion: number,
  reason: string, key: string): Promise<Registration & { removalId: string }> {
  return command(db, actor, `remove-registration:${registrationId}`, key, async tx => {
    const { rows: found } = await tx.query<RegistrationRow>('SELECT * FROM registrations WHERE id=$1', [registrationId]);
    const registration = found[0];
    if (!registration) throw new AppError('NOT_FOUND', '报名不存在', 404);
    const event = await lockEvent(tx, registration.event_id, expectedVersion);
    if (event.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可以移除参与者', 403);
    if (registration.user_id === actor) throw new AppError('INVALID_STATE', '主办方本人应使用退出报名');
    if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500)
      throw new AppError('BAD_REQUEST', '移除原因需为 5 至 500 字');
    if (!['RECRUITING', 'CONFIRMED'].includes(event.status) || await databaseNow(tx) >= Date.parse(event.payload.startAt!) ||
      !['CONFIRMED', 'RECONFIRM_REQUIRED', 'WAITLISTED', 'OFFERED', 'REQUESTED', 'INTERESTED'].includes(registration.status))
      throw new AppError('INVALID_STATE', '当前不能移除该参与者');
    const released = ['CONFIRMED', 'RECONFIRM_REQUIRED', 'OFFERED'].includes(registration.status);
    if (registration.status === 'OFFERED') await tx.query("UPDATE offers SET status='CANCELLED' WHERE registration_id=$1 AND status='ACTIVE'", [registration.id]);
    const { rows: removed } = await tx.query<{ id: string }>(`UPDATE registrations SET status='REMOVED',updated_at=now()
      WHERE id=$1 AND EXISTS (SELECT 1 FROM events WHERE id=$2
        AND (payload->>'startAt')::timestamptz>clock_timestamp()) RETURNING id`, [registration.id, event.id]);
    if (!removed[0]) throw new AppError('INVALID_STATE', '活动开始后不能移除参与者');
    const removalId = randomUUID();
    await tx.query('INSERT INTO registration_removals(id,registration_id,event_id,user_id,removed_by,reason) VALUES($1,$2,$3,$4,$5,$6)',
      [removalId, registration.id, event.id, registration.user_id, actor, reason.trim()]);
    await enqueueNotification(tx, event.id, registration.user_id, 'REGISTRATION_REMOVED', event.version, { removalId });
    if (released) await promote(tx, event);
    await audit(tx, actor, event.id, 'REMOVE_REGISTRATION');
    return { ...convert(registration), status: 'REMOVED', removalId };
  });
}

export async function reserveSeats(db: Database, actor: string, eventId: string, expectedVersion: number, count: number, key: string): Promise<Array<{ id: string; token: string }>> {
  return command(db, actor, `reserve:${eventId}`, key, async tx => {
    const event = await lockEvent(tx, eventId, expectedVersion);
    if (event.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可以预留', 403);
    await assertEventNotHeld(tx, eventId);
    await assertPublicRecruitmentOpen(tx, event.payload.visibility, event.payload);
    if (event.review_status !== 'APPROVED') throw new AppError('REVIEW_PENDING', '活动内容尚未通过审核', 409);
    if (!event.recruiting || !Number.isInteger(count) || count < 1 || count > 12) throw new AppError('INVALID_RESERVATION', '预留数量无效');
    if (await occupancy(tx, eventId) + count > event.payload.maxParticipants!) throw new AppError('EVENT_FULL', '名额不足');
    const expiry = event.payload.confirmationDeadline!;
    if (Date.parse(expiry) <= await databaseNow(tx)) throw new AppError('INVALID_RESERVATION', '成局确认截止时间已过');
    const result: Array<{ id: string; token: string }> = [];
    for (let i = 0; i < count; i++) {
      const id = randomUUID(); const token = randomBytes(24).toString('base64url');
      const inserted = await tx.query<{ id: string }>(`INSERT INTO reservations(id,event_id,token,expires_at)
        SELECT $1,$2,$3,$4 FROM events WHERE id=$2
          AND (payload->>'confirmationDeadline')::timestamptz>clock_timestamp()
          AND $4::timestamptz>clock_timestamp() RETURNING id`, [id, eventId, token, expiry]);
      if (!inserted.rows[0]) throw new AppError('INVALID_RESERVATION', '成局确认截止时间已过');
      await tx.query('INSERT INTO jobs(id,kind,event_id,due_at,payload) VALUES($1,$2,$3,$4,$5)', [randomUUID(), 'EXPIRE_RESERVATION', eventId, expiry, JSON.stringify({ reservationId: id })]);
      result.push({ id, token });
    }
    await audit(tx, actor, eventId, 'RESERVE_SEATS');
    return result;
  });
}

export async function claimReservation(db: Database, actor: string, token: string, expectedVersion: number, key: string,
  expectedEventId?: string): Promise<Registration> {
  const result = await command(db, actor, `claim-reservation:${token}`, key, async tx => {
    const { rows: found } = await tx.query<Reservation>('SELECT * FROM reservations WHERE token=$1', [token]);
    const initial = found[0];
    if (!initial) throw new AppError('RESERVATION_UNAVAILABLE', '预留不存在或不可用', 404);
    if (expectedEventId !== undefined && initial.event_id !== expectedEventId)
      throw new AppError('RESERVATION_EVENT_MISMATCH', '此认领口令属于另一场活动，请在对应活动中打开', 409);
    const event = await lockEvent(tx, initial.event_id, expectedVersion);
    await assertEventNotHeld(tx, event.id);
    await assertPublicRecruitmentOpen(tx, event.payload.visibility, event.payload);
    if (event.review_status !== 'APPROVED') throw new AppError('REVIEW_PENDING', '活动内容尚未通过审核', 409);
    const { rows } = await tx.query<Reservation>('SELECT * FROM reservations WHERE id=$1 FOR UPDATE', [initial.id]);
    const reservation = rows[0]!;
    if (reservation.claimed_by || reservation.released_at || new Date(reservation.expires_at).getTime() <= await databaseNow(tx) || !event.recruiting)
      throw new AppError('RESERVATION_UNAVAILABLE', '预留已失效');
    const { rows: existing } = await tx.query<RegistrationRow>('SELECT * FROM registrations WHERE event_id=$1 AND user_id=$2', [event.id, actor]);
    if (existing[0] && !['WAITLISTED', 'CANCELLED', 'EXPIRED'].includes(existing[0].status)) throw new AppError('ALREADY_REGISTERED', '已经报名');
    const { rows: claimed } = await tx.query<{ id: string }>(`UPDATE reservations SET claimed_by=$2
      WHERE id=$1 AND claimed_by IS NULL AND released_at IS NULL AND expires_at>clock_timestamp()
        AND EXISTS (SELECT 1 FROM events WHERE id=$3 AND recruiting=true
          AND status IN ('RECRUITING','CONFIRMED')) RETURNING id`, [reservation.id, actor, event.id]);
    if (!claimed[0]) throw new AppError('RESERVATION_UNAVAILABLE', '预留已失效');
    const result = existing[0]
      ? await tx.query<RegistrationRow>("UPDATE registrations SET status='CONFIRMED',accepted_version=$2,updated_at=now() WHERE id=$1 RETURNING *", [existing[0].id, event.version])
      : await tx.query<RegistrationRow>("INSERT INTO registrations(id,event_id,user_id,status,accepted_version) VALUES($1,$2,$3,'CONFIRMED',$4) RETURNING *", [randomUUID(), event.id, actor, event.version]);
    await audit(tx, actor, event.id, 'CLAIM_RESERVATION');
    return convert(result.rows[0]!);
  });
  if (expectedEventId !== undefined && result.eventId !== expectedEventId)
    throw new AppError('RESERVATION_EVENT_MISMATCH', '此认领口令属于另一场活动，请在对应活动中打开', 409);
  return result;
}

export async function acceptOffer(db: Database, actor: string, offerId: string, expectedVersion: number, key: string): Promise<Registration> {
  return command(db, actor, `accept-offer:${offerId}`, key, async tx => {
    const { rows: found } = await tx.query<Offer>('SELECT * FROM offers WHERE id=$1', [offerId]);
    const initial = found[0];
    if (!initial) throw new AppError('NOT_FOUND', '补位邀请不存在', 404);
    const event = await lockEvent(tx, initial.event_id, expectedVersion);
    await assertEventNotHeld(tx, event.id);
    await assertPublicRecruitmentOpen(tx, event.payload.visibility, event.payload);
    if (event.review_status !== 'APPROVED') throw new AppError('REVIEW_PENDING', '活动内容尚未通过审核', 409);
    const { rows } = await tx.query<Offer>('SELECT * FROM offers WHERE id=$1 FOR UPDATE', [offerId]);
    const offer = rows[0]!;
    const { rows: registrations } = await tx.query<RegistrationRow>('SELECT * FROM registrations WHERE id=$1 FOR UPDATE', [offer.registration_id]);
    const registration = registrations[0]!;
    if (registration.user_id !== actor) throw new AppError('FORBIDDEN', '只能接受自己的补位邀请', 403);
    const now = await databaseNow(tx);
    if (!event.recruiting || !['RECRUITING', 'CONFIRMED'].includes(event.status) || now >= Date.parse(event.payload.registrationDeadline!) ||
      offer.status !== 'ACTIVE' || registration.status !== 'OFFERED' || new Date(offer.expires_at).getTime() <= now)
      throw new AppError('OFFER_UNAVAILABLE', '补位邀请已失效');
    const { rows: accepted } = await tx.query<{ id: string }>(`UPDATE offers SET status='ACCEPTED'
      WHERE id=$1 AND status='ACTIVE' AND expires_at>clock_timestamp()
        AND EXISTS (SELECT 1 FROM events WHERE id=$2 AND recruiting=true
          AND status IN ('RECRUITING','CONFIRMED')
          AND clock_timestamp() < (payload->>'registrationDeadline')::timestamptz) RETURNING id`, [offerId, event.id]);
    if (!accepted[0]) throw new AppError('OFFER_UNAVAILABLE', '补位邀请已失效');
    const { rows: updated } = await tx.query<RegistrationRow>("UPDATE registrations SET status='CONFIRMED',accepted_version=$2,updated_at=now() WHERE id=$1 RETURNING *", [registration.id, event.version]);
    await audit(tx, actor, event.id, 'ACCEPT_OFFER');
    return convert(updated[0]!);
  });
}

export async function declineOffer(db: Database, actor: string, offerId: string, expectedVersion: number, key: string): Promise<{ id: string; status: 'DECLINED' }> {
  return command(db, actor, `decline-offer:${offerId}`, key, async tx => {
    const { rows: found } = await tx.query<Offer>('SELECT * FROM offers WHERE id=$1', [offerId]);
    if (!found[0]) throw new AppError('NOT_FOUND', '补位邀请不存在', 404);
    const event = await lockEvent(tx, found[0].event_id, expectedVersion);
    const { rows: offers } = await tx.query<Offer>('SELECT * FROM offers WHERE id=$1 FOR UPDATE', [offerId]);
    const offer = offers[0]!;
    const { rows: registrations } = await tx.query<RegistrationRow>('SELECT * FROM registrations WHERE id=$1 FOR UPDATE', [offer.registration_id]);
    const registration = registrations[0]!;
    if (registration.user_id !== actor) throw new AppError('FORBIDDEN', '只能拒绝自己的补位邀请', 403);
    if (offer.status === 'DECLINED') return { id: offerId, status: 'DECLINED' };
    if (offer.status !== 'ACTIVE' || registration.status !== 'OFFERED' ||
      new Date(offer.expires_at).getTime() <= await databaseNow(tx))
      throw new AppError('OFFER_UNAVAILABLE', '补位邀请已失效');
    await tx.query("UPDATE offers SET status='DECLINED' WHERE id=$1", [offerId]);
    await tx.query("UPDATE registrations SET status='CANCELLED',updated_at=now() WHERE id=$1", [registration.id]);
    await promote(tx, event);
    await audit(tx, actor, event.id, 'DECLINE_OFFER');
    return { id: offerId, status: 'DECLINED' };
  });
}

export async function expireOffers(db: Database): Promise<number> {
  const { rows } = await db.query<Offer>("SELECT * FROM offers WHERE status='ACTIVE' AND expires_at<=now() ORDER BY expires_at,id");
  let expired = 0;
  for (const stale of rows) {
    await db.transaction(async tx => {
      const { rows: eventRows } = await tx.query<EventRow>('SELECT id,host_id,status,version,payload,recruiting FROM events WHERE id=$1 FOR UPDATE', [stale.event_id]);
      const event = eventRows[0]!;
      const { rows: current } = await tx.query<Offer>('SELECT * FROM offers WHERE id=$1 FOR UPDATE', [stale.id]);
      if (current[0]?.status !== 'ACTIVE' || new Date(current[0].expires_at).getTime() > await databaseNow(tx)) return;
      await tx.query("UPDATE offers SET status='EXPIRED' WHERE id=$1", [stale.id]);
      await tx.query("UPDATE registrations SET status='EXPIRED',updated_at=now() WHERE id=$1 AND status='OFFERED'", [stale.registration_id]);
      await promote(tx, event);
      expired++;
    });
  }
  return expired;
}

export async function approveRegistration(db: Database, actor: string, registrationId: string, expectedVersion: number, key: string): Promise<Registration> {
  return command(db, actor, `approve-registration:${registrationId}`, key, async tx => {
    const { rows } = await tx.query<RegistrationRow>('SELECT * FROM registrations WHERE id=$1', [registrationId]);
    const registration = rows[0];
    if (!registration) throw new AppError('NOT_FOUND', '报名申请不存在', 404);
    const event = await lockEvent(tx, registration.event_id, expectedVersion);
    if (event.host_id !== actor && !(await hasCohostCapability(tx, actor, event.id, 'APPROVE_REGISTRATION')))
      throw new AppError('FORBIDDEN', '没有本活动报名审批权限', 403);
    await assertEventNotHeld(tx, event.id);
    await assertPublicRecruitmentOpen(tx, event.payload.visibility, event.payload);
    if (event.review_status !== 'APPROVED') throw new AppError('REVIEW_PENDING', '活动内容尚未通过审核', 409);
    if (registration.status !== 'REQUESTED') throw new AppError('INVALID_STATE', '申请不可审核');
    if (!event.recruiting || !['RECRUITING', 'CONFIRMED'].includes(event.status) ||
      await databaseNow(tx) >= Date.parse(event.payload.registrationDeadline!))
      throw new AppError('REGISTRATION_CLOSED', '报名已截止，不能再批准申请');
    if (await occupancy(tx, event.id) >= event.payload.maxParticipants!) throw new AppError('EVENT_FULL', '名额不足');
    const { rows: updated } = await tx.query<RegistrationRow>(`UPDATE registrations SET status='CONFIRMED',accepted_version=$2,updated_at=now()
      WHERE id=$1 AND status='REQUESTED' AND EXISTS (SELECT 1 FROM events WHERE id=$3
        AND recruiting=true AND status IN ('RECRUITING','CONFIRMED')
        AND clock_timestamp() < (payload->>'registrationDeadline')::timestamptz) RETURNING *`,
    [registration.id, event.version, event.id]);
    if (!updated[0]) throw new AppError('REGISTRATION_CLOSED', '报名已截止，不能再批准申请');
    await enqueueNotification(tx, event.id, registration.user_id, 'REGISTRATION_APPROVED', event.version);
    await audit(tx, actor, event.id, 'APPROVE_REGISTRATION');
    return convert(updated[0]!);
  });
}

export async function listPendingApprovals(db: Database, actor: string, offset = 0, snapshot?: string | null): Promise<{
  items: Array<{ registrationId: string; eventId: string; eventTitle: string; expectedVersion: number;
    isHost: boolean; canApprove: boolean; createdAt: Date }>;
  total: number; nextOffset: number | null; snapshot: string;
}> {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', '审核列表页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取审核列表需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const from = `FROM registrations r JOIN events e ON e.id=r.event_id
      CROSS JOIN LATERAL (SELECT
        (SELECT count(*)::int FROM registrations occupied WHERE occupied.event_id=e.id
          AND occupied.status IN ('CONFIRMED','RECONFIRM_REQUIRED')) +
        (SELECT count(*)::int FROM offers o WHERE o.event_id=e.id AND o.status='ACTIVE'
          AND o.expires_at>clock_timestamp()) +
        (SELECT count(*)::int FROM reservations reserved WHERE reserved.event_id=e.id
          AND reserved.claimed_by IS NULL AND reserved.released_at IS NULL
          AND reserved.expires_at>clock_timestamp()) AS occupied) capacity
      WHERE r.status='REQUESTED' AND e.review_status='APPROVED' AND e.recruiting=true
        AND e.status IN ('RECRUITING','CONFIRMED')
        AND clock_timestamp() < (e.payload->>'registrationDeadline')::timestamptz
        AND EXISTS (SELECT 1 FROM emergency_gate g WHERE g.id=1 AND g.status='OPEN')
        AND NOT EXISTS (SELECT 1 FROM event_safety_holds h WHERE h.event_id=e.id AND h.status='ACTIVE')
        AND (e.payload->>'visibility'<>'PUBLIC' OR public_recruitment_covered(
          (e.payload->>'startAt')::timestamptz,(e.payload->>'endAt')::timestamptz))
        AND (e.host_id=$1 OR EXISTS (SELECT 1 FROM cohost_grants c WHERE c.event_id=e.id AND c.user_id=$1
          AND c.revoked_at IS NULL AND c.expires_at>clock_timestamp()
          AND 'APPROVE_REGISTRATION'=ANY(c.capabilities)))`;
    const { rows: counts } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(r.id,r.updated_at,e.version,capacity.occupied)::text,',' ORDER BY r.id),'')) AS snapshot
      ${from}`, [actor]);
    const currentSnapshot = counts[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', '审核列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query<{ registration_id: string; event_id: string; event_title: string;
      expected_version: number; is_host: boolean; can_approve: boolean; created_at: Date }>(`SELECT r.id AS registration_id,e.id AS event_id,
        e.payload->>'title' AS event_title,e.version AS expected_version,(e.host_id=$1) AS is_host,
        (capacity.occupied < (e.payload->>'maxParticipants')::int) AS can_approve,r.created_at ${from}
        ORDER BY r.created_at,r.id LIMIT 100 OFFSET $2`, [actor, offset]);
    const total = counts[0]?.total ?? 0;
    return { items: rows.map(row => ({ registrationId: row.registration_id, eventId: row.event_id,
      eventTitle: row.event_title, expectedVersion: row.expected_version, isHost: row.is_host,
      canApprove: row.can_approve,
      createdAt: row.created_at })),
    total, nextOffset: offset + rows.length < total ? offset + rows.length : null, snapshot: currentSnapshot };
  });
}

export async function expireReservations(db: Database): Promise<number> {
  const { rows } = await db.query<Reservation>('SELECT * FROM reservations WHERE claimed_by IS NULL AND released_at IS NULL AND expires_at<=now() ORDER BY expires_at,id');
  let count = 0;
  for (const stale of rows) {
    await db.transaction(async tx => {
      const { rows: eventRows } = await tx.query<EventRow>('SELECT id,host_id,status,version,payload,recruiting FROM events WHERE id=$1 FOR UPDATE', [stale.event_id]);
      const event = eventRows[0]!;
      const { rows: current } = await tx.query<Reservation>('SELECT * FROM reservations WHERE id=$1 FOR UPDATE', [stale.id]);
      if (current[0]?.claimed_by || current[0]?.released_at || new Date(current[0]!.expires_at).getTime() > await databaseNow(tx)) return;
      await tx.query('UPDATE reservations SET released_at=now() WHERE id=$1', [stale.id]);
      await promote(tx, event);
      count++;
    });
  }
  return count;
}
