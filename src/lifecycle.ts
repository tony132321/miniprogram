import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Database } from './db.ts';
import type { EventInput, EventRecord } from './events.ts';
import { createDraft, getEvent, validatePublish } from './events.ts';
import { AppError } from './errors.ts';
import { audit, command, databaseNow, lockEvent, occupancy } from './registrations.ts';
import type { Registration } from './registrations.ts';
import { consentNotice, enqueueInAppOutcomePrompt, enqueueNotification } from './notifications.ts';
import { assertEventNotHeld } from './safety.ts';
import { assertPublicRecruitmentOpen } from './public-gate.ts';
import { assertNewActionsOpen } from './emergency-gate.ts';
import { hasCohostCapability } from './cohosts.ts';
import { assertHostParticipantCap } from './host-limits.ts';

type EventDatabaseRow = { id: string; host_id: string; status: string; version: number; payload: EventInput; recruiting: boolean;
  invite_token: string | null; updated_at: Date; review_status: string; review_reason: string | null; is_test: boolean };
type RegistrationRow = { id: string; event_id: string; user_id: string; status: string; accepted_version: number | null };

function eventResult(row: EventDatabaseRow): EventRecord {
  return { id: row.id, hostId: row.host_id, status: row.status, version: row.version,
    payload: row.payload, recruiting: row.recruiting, reviewStatus: row.review_status,
    ...(row.review_reason ? { reviewReason: row.review_reason } : {}), updatedAt: new Date(row.updated_at).toISOString(),
    ...(row.invite_token ? { inviteToken: row.invite_token } : {}) };
}
function registrationResult(row: RegistrationRow): Registration {
  return { id: row.id, eventId: row.event_id, userId: row.user_id, status: row.status, acceptedVersion: row.accepted_version };
}

const materialFields: Array<keyof EventInput> = ['startAt', 'endAt', 'timeZone', 'city', 'venueName', 'venueStatus',
  'feeMode', 'feeCapFen', 'type', 'skillLevel', 'visibility', 'minParticipants', 'maxParticipants', 'registrationDeadline',
  'confirmationDeadline', 'cancellationRule', 'approvalMode', 'hostParticipates'];

function eventChanges(before: EventInput, after: EventInput) {
  return (Object.keys(after) as Array<keyof EventInput>).filter(field => before[field] !== after[field])
    .map(field => ({ field, before: before[field] ?? null, after: after[field] ?? null }));
}

function assertVenueReassertion(before: EventInput, patch: Partial<EventInput>): void {
  if (['venueName', 'startAt', 'endAt'].some(field =>
    patch[field as keyof EventInput] !== undefined && patch[field as keyof EventInput] !== before[field as keyof EventInput]) &&
    patch.venueStatus !== 'HOST_CONFIRMED')
    throw new AppError('VENUE_REASSERT_REQUIRED', '场馆或活动时间已改变，请重新确认场地可用及预约情况');
}

export async function previewEventChange(db: Database, actor: string, eventId: string, expectedVersion: number,
  patch: Partial<EventInput>): Promise<{ material: boolean; affectedCount: number; changes: ReturnType<typeof eventChanges> }> {
  const event = await getEvent(db, actor, eventId);
  if (event.hostId !== actor) throw new AppError('FORBIDDEN', '只有主办方可以预览活动变更', 403);
  if (event.version !== expectedVersion) throw new AppError('VERSION_CONFLICT', '活动规则已更新，请刷新', 409);
  const now = await databaseNow(db);
  if (!['RECRUITING', 'CONFIRMED'].includes(event.status) || now >= Date.parse(event.payload.startAt!))
    throw new AppError('INVALID_STATE', '活动当前不能修改');
  const next = { ...event.payload, ...patch };
  assertVenueReassertion(event.payload, patch);
  validatePublish(next);
  await assertHostParticipantCap(db, eventId, actor, next.maxParticipants!);
  if (Date.parse(next.startAt!) <= now) throw new AppError('INVALID_EVENT', '活动开始时间必须在未来');
  if (await occupancy(db, eventId) > next.maxParticipants!) throw new AppError('EVENT_FULL', '新人数上限小于已占名额');
  const changes = eventChanges(event.payload, next);
  if (!changes.length) throw new AppError('BAD_REQUEST', '活动内容没有变化');
  const material = changes.some(change => materialFields.includes(change.field));
  if (material && Date.parse(next.confirmationDeadline!) <= now) throw new AppError('INVALID_EVENT', '重大变更需设置未来的确认截止时间');
  const { rows } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND status='CONFIRMED'", [eventId]);
  return { material, affectedCount: material ? rows[0]?.n ?? 0 : 0, changes };
}

export async function getPendingReconfirmation(db: Database, actor: string, eventId: string): Promise<{
  fromVersion: number; toVersion: number; deadline: string; changes: ReturnType<typeof eventChanges>
} | null> {
  return db.transaction(async tx => {
    // Shared-activity deidentification keeps the event version unchanged. Lock
    // the event through both the current and prior-version reads.
    await tx.query('SELECT id FROM events WHERE id=$1 FOR SHARE', [eventId]);
    const event = await getEvent(tx, actor, eventId);
    if (event.reviewStatus !== 'APPROVED') return null;
    const { rows: registrations } = await tx.query<{ accepted_version: number | null; status: string }>(
      'SELECT accepted_version,status FROM registrations WHERE event_id=$1 AND user_id=$2', [eventId, actor]);
    const registration = registrations[0];
    if (registration?.status !== 'RECONFIRM_REQUIRED') return null;
    if (!registration.accepted_version) throw new AppError('VERSION_NOT_FOUND', '旧活动版本不存在', 500);
    const { rows: versions } = await tx.query<{ payload: EventInput }>('SELECT payload FROM event_versions WHERE event_id=$1 AND version=$2',
      [eventId, registration.accepted_version]);
    if (!versions[0]) throw new AppError('VERSION_NOT_FOUND', '旧活动版本不存在', 500);
    return { fromVersion: registration.accepted_version, toVersion: event.version,
      deadline: event.payload.confirmationDeadline!, changes: eventChanges(versions[0].payload, event.payload) };
  });
}

export async function changeEvent(db: Database, actor: string, eventId: string, expectedVersion: number, patch: Partial<EventInput>, key: string): Promise<EventRecord> {
  return command(db, actor, `change-event:${eventId}`, key, async tx => {
    const event = await lockEvent(tx, eventId, expectedVersion);
    if (event.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可以修改活动', 403);
    const now = await databaseNow(tx);
    if (!['RECRUITING', 'CONFIRMED'].includes(event.status) || now >= Date.parse(event.payload.startAt!)) throw new AppError('INVALID_STATE', '活动当前不能修改');
    const next = { ...event.payload, ...patch };
    assertVenueReassertion(event.payload, patch);
    if (next.maxParticipants! > event.payload.maxParticipants! ||
      Date.parse(next.registrationDeadline!) > Date.parse(event.payload.registrationDeadline!))
      await assertNewActionsOpen(tx);
    if (next.visibility === 'PUBLIC' && event.payload.visibility !== 'PUBLIC') await assertPublicRecruitmentOpen(tx, next.visibility, next);
    validatePublish(next);
    await assertHostParticipantCap(tx, eventId, actor, next.maxParticipants!, true);
    if (Date.parse(next.startAt!) <= now) throw new AppError('INVALID_EVENT', '活动开始时间必须在未来');
    if (await occupancy(tx, eventId) > next.maxParticipants!) throw new AppError('EVENT_FULL', '新人数上限小于已占名额');
    const changes = eventChanges(event.payload, next);
    if (!changes.length) throw new AppError('BAD_REQUEST', '活动内容没有变化');
    const material = changes.some(change => materialFields.includes(change.field));
    if (material && Date.parse(next.confirmationDeadline!) <= now) throw new AppError('INVALID_EVENT', '重大变更需设置未来的确认截止时间');
    const resumeAfterReview = !material && (event.review_status === 'APPROVED'
      ? event.recruiting : event.resume_recruiting_after_review);
    const { rows } = await tx.query<EventDatabaseRow>(`UPDATE events SET payload=$2,version=version+1,
      status=CASE WHEN $3 THEN 'RECRUITING' ELSE status END,
      recruiting=false,review_status='PENDING',
      review_reason=NULL,resume_recruiting_after_review=$4,
      invite_expires_at=$5,
      updated_at=now() WHERE id=$1 AND clock_timestamp() < (payload->>'startAt')::timestamptz
        AND clock_timestamp() < $6::timestamptz
        AND (NOT $3::boolean OR clock_timestamp() < $7::timestamptz) RETURNING *`,
    [eventId, JSON.stringify(next), material, resumeAfterReview, next.registrationDeadline,
      next.startAt, next.confirmationDeadline]);
    if (!rows[0]) throw new AppError('INVALID_STATE', '活动开始时间或重大变更确认截止时间已过，请刷新');
    const result = eventResult(rows[0]!);
    await tx.query('INSERT INTO event_versions(event_id,version,payload) VALUES($1,$2,$3)', [eventId, result.version, JSON.stringify(next)]);
    if (changes.some(change => ['venueName', 'startAt', 'endAt'].includes(change.field)))
      await tx.query(`INSERT INTO venue_evidence(event_id,event_version,venue_name,source_type,phase,recorded_by,expires_at,activity_end_at)
        VALUES($1,$2,$3,'HOST_STATEMENT','CHANGE',$4,$5,$6)`,
        [eventId, result.version, next.venueName, actor, next.startAt, next.endAt]);
    await tx.query("INSERT INTO activity_content(id,event_id,author_id,kind,body,status,event_version) VALUES($1,$2,'system','ANNOUNCEMENT',$3,'APPROVED',$4)",
      [randomUUID(), eventId, material
        ? `活动规则新版本 ${result.version} 审核中；审核通过后参与者需要重新确认。审核前请查看活动页的已审核信息。`
        : `活动信息新版本 ${result.version} 审核中；审核前请查看活动页的已审核信息。`, result.version]);
    await tx.query('INSERT INTO jobs(id,kind,event_id,due_at,payload) VALUES($1,$2,$3,$4,$5)', [randomUUID(), 'FORMATION_DEADLINE', eventId, next.confirmationDeadline, JSON.stringify({ version: result.version })]);
    await tx.query('INSERT INTO jobs(id,kind,event_id,due_at,payload) VALUES($1,$2,$3,$4,$5)', [randomUUID(), 'REGISTRATION_DEADLINE', eventId, next.registrationDeadline, JSON.stringify({ version: result.version })]);
    if (material) {
      await tx.query("UPDATE registrations SET status='RECONFIRM_REQUIRED',updated_at=now() WHERE event_id=$1 AND status='CONFIRMED'", [eventId]);
      await tx.query("UPDATE registrations SET status='WAITLISTED',updated_at=now() WHERE event_id=$1 AND status='OFFERED'", [eventId]);
      await tx.query("UPDATE offers SET status='CANCELLED' WHERE event_id=$1 AND status='ACTIVE'", [eventId]);
      await tx.query('UPDATE reservations SET released_at=now() WHERE event_id=$1 AND claimed_by IS NULL AND released_at IS NULL', [eventId]);
      const { rows: recipients } = await tx.query<{ user_id: string }>("SELECT user_id FROM registrations WHERE event_id=$1 AND status='RECONFIRM_REQUIRED'", [eventId]);
      for (const recipient of recipients) await enqueueNotification(tx, eventId, recipient.user_id, 'MATERIAL_CHANGE', result.version);
    } else {
      await tx.query("UPDATE registrations SET accepted_version=$3,updated_at=now() WHERE event_id=$1 AND status='CONFIRMED' AND accepted_version=$2", [eventId, event.version, result.version]);
      if (event.status === 'CONFIRMED') {
        await tx.query('INSERT INTO jobs(id,kind,event_id,due_at,payload) VALUES($1,$2,$3,$4,$5)', [randomUUID(), 'EVENT_REMINDER', eventId,
          new Date(Date.parse(next.startAt!) - 30 * 60_000).toISOString(), JSON.stringify({ version: result.version })]);
        await tx.query('INSERT INTO jobs(id,kind,event_id,due_at,payload) VALUES($1,$2,$3,$4,$5)', [randomUUID(), 'EVENT_START', eventId,
          next.startAt, JSON.stringify({ version: result.version })]);
        await tx.query('INSERT INTO jobs(id,kind,event_id,due_at,payload) VALUES($1,$2,$3,$4,$5)', [randomUUID(), 'EVENT_END', eventId,
          next.endAt, JSON.stringify({ version: result.version })]);
      }
    }
    await audit(tx, actor, eventId, material ? 'MATERIAL_CHANGE' : 'EDIT_EVENT');
    return result;
  });
}

export async function reconfirm(db: Database, actor: string, registrationId: string, expectedVersion: number, key: string, at?: number): Promise<Registration> {
  return command(db, actor, `reconfirm:${registrationId}`, key, async tx => {
    const { rows: found } = await tx.query<RegistrationRow>('SELECT * FROM registrations WHERE id=$1', [registrationId]);
    const registration = found[0];
    if (!registration) throw new AppError('NOT_FOUND', '报名不存在', 404);
    const event = await lockEvent(tx, registration.event_id, expectedVersion);
    if (registration.user_id !== actor) throw new AppError('FORBIDDEN', '只能确认自己的报名', 403);
    if (event.review_status !== 'APPROVED') throw new AppError('REVIEW_PENDING', '活动内容尚未通过审核', 409);
    const now = at ?? await databaseNow(tx);
    if (event.status !== 'RECRUITING' || registration.status !== 'RECONFIRM_REQUIRED' || now >= Date.parse(event.payload.confirmationDeadline!))
      throw new AppError('INVALID_STATE', '重新确认期限已结束');
    const { rows } = await tx.query<RegistrationRow>(`UPDATE registrations SET status='CONFIRMED',accepted_version=$2,updated_at=now()
      WHERE id=$1 AND EXISTS (SELECT 1 FROM events WHERE id=$3
        AND clock_timestamp() < (payload->>'confirmationDeadline')::timestamptz) RETURNING *`,
    [registrationId, event.version, event.id]);
    if (!rows[0]) throw new AppError('INVALID_STATE', '重新确认期限已结束');
    await audit(tx, actor, event.id, 'RECONFIRM');
    return registrationResult(rows[0]!);
  });
}

export async function confirmEvent(db: Database, actor: string, eventId: string, expectedVersion: number, key: string): Promise<EventRecord> {
  return command(db, actor, `confirm-event:${eventId}`, key, async tx => {
    const event = await lockEvent(tx, eventId, expectedVersion);
    if (event.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可以确认成局', 403);
    if (event.review_status !== 'APPROVED') throw new AppError('REVIEW_PENDING', '活动内容尚未通过人工审核', 409);
    await assertEventNotHeld(tx, eventId);
    await assertPublicRecruitmentOpen(tx, event.payload.visibility, event.payload);
    if (event.status !== 'RECRUITING' || await databaseNow(tx) >= Date.parse(event.payload.confirmationDeadline!))
      throw new AppError('INVALID_STATE', '当前不能确认成局');
    const { rows: counts } = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND status='CONFIRMED' AND accepted_version=$2", [eventId, event.version]);
    if ((counts[0]?.n ?? 0) < event.payload.minParticipants!) throw new AppError('NOT_ENOUGH_PEOPLE', '真实确认人数不足');
    if (event.payload.hostParticipates) {
      const { rows: hostSeat } = await tx.query("SELECT 1 FROM registrations WHERE event_id=$1 AND user_id=$2 AND status='CONFIRMED' AND accepted_version=$3",
        [eventId, actor, event.version]);
      if (!hostSeat.length) throw new AppError('HOST_NOT_RECONFIRMED', '主办方声明参加，须先本人确认当前规则');
    }
    if (event.payload.venueStatus !== 'HOST_CONFIRMED') throw new AppError('VENUE_UNCONFIRMED', '场地尚未确认');
    const { rows } = await tx.query<EventDatabaseRow>(`UPDATE events SET status='CONFIRMED',recruiting=true,updated_at=now()
      WHERE id=$1 AND clock_timestamp() < (payload->>'confirmationDeadline')::timestamptz RETURNING *`, [eventId]);
    if (!rows[0]) throw new AppError('INVALID_STATE', '当前不能确认成局');
    await tx.query(`INSERT INTO venue_evidence(event_id,event_version,venue_name,source_type,phase,recorded_by,expires_at,activity_end_at)
      VALUES($1,$2,$3,'HOST_STATEMENT','FORMATION',$4,$5,$6)`,
      [eventId, event.version, event.payload.venueName, actor, event.payload.startAt, event.payload.endAt]);
    const { rows: recipients } = await tx.query<{ user_id: string }>("SELECT user_id FROM registrations WHERE event_id=$1 AND status='CONFIRMED' AND accepted_version=$2", [eventId, event.version]);
    for (const recipient of recipients) await enqueueNotification(tx, eventId, recipient.user_id, 'EVENT_CONFIRMED', event.version);
    await tx.query('INSERT INTO jobs(id,kind,event_id,due_at,payload) VALUES($1,$2,$3,$4,$5)', [randomUUID(), 'EVENT_REMINDER', eventId,
      new Date(Date.parse(event.payload.startAt!) - 30 * 60_000).toISOString(), JSON.stringify({ version: event.version })]);
    await tx.query('INSERT INTO jobs(id,kind,event_id,due_at,payload) VALUES($1,$2,$3,$4,$5)', [randomUUID(), 'EVENT_START', eventId,
      event.payload.startAt, JSON.stringify({ version: event.version })]);
    await tx.query('INSERT INTO jobs(id,kind,event_id,due_at,payload) VALUES($1,$2,$3,$4,$5)', [randomUUID(), 'EVENT_END', eventId,
      event.payload.endAt, JSON.stringify({ version: event.version })]);
    await audit(tx, actor, eventId, 'CONFIRM_EVENT');
    return eventResult(rows[0]!);
  });
}

export async function cancelEvent(db: Database, actor: string, eventId: string, expectedVersion: number, key: string, at?: number): Promise<EventRecord> {
  return command(db, actor, `cancel-event:${eventId}`, key, async tx => {
    const event = await lockEvent(tx, eventId, expectedVersion);
    if (event.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可以取消活动', 403);
    const now = at ?? await databaseNow(tx);
    if (!['RECRUITING', 'CONFIRMED'].includes(event.status) || now >= Date.parse(event.payload.startAt!))
      throw new AppError('INVALID_STATE', '活动开始后不能按普通取消处理');
    const { rows } = await tx.query<EventDatabaseRow>(`UPDATE events SET status='CANCELLED',recruiting=false,updated_at=now()
      WHERE id=$1 AND clock_timestamp() < (payload->>'startAt')::timestamptz RETURNING *`, [eventId]);
    if (!rows[0]) throw new AppError('INVALID_STATE', '活动开始后不能按普通取消处理');
    const { rows: recipients } = await tx.query<{ user_id: string }>("SELECT user_id FROM registrations WHERE event_id=$1 AND status IN ('CONFIRMED','RECONFIRM_REQUIRED','OFFERED','WAITLISTED')", [eventId]);
    for (const recipient of recipients) await enqueueNotification(tx, eventId, recipient.user_id, 'EVENT_CANCELLED', event.version);
    await tx.query("UPDATE offers SET status='CANCELLED' WHERE event_id=$1 AND status='ACTIVE'", [eventId]);
    await tx.query("UPDATE registrations SET status='EXPIRED',updated_at=now() WHERE event_id=$1 AND status='OFFERED'", [eventId]);
    await tx.query('UPDATE reservations SET released_at=now() WHERE event_id=$1 AND claimed_by IS NULL AND released_at IS NULL', [eventId]);
    await audit(tx, actor, eventId, 'CANCEL_EVENT');
    return eventResult(rows[0]!);
  });
}

export function createCheckInToken(eventId: string, secret: string, at = Date.now()): string {
  if (!secret) throw new AppError('CONFIG_ERROR', '签到密钥未配置', 500);
  const bucket = Math.floor(at / 60_000);
  const signature = createHmac('sha256', secret).update(`${eventId}:${bucket}`).digest('base64url');
  return `${bucket}.${signature}`;
}

function verifyCheckInToken(eventId: string, token: string, secret: string, at: number): boolean {
  const [bucketString, signature] = token.split('.');
  const bucket = Number(bucketString);
  if (!Number.isSafeInteger(bucket) || !signature || Math.floor(at / 60_000) !== bucket) return false;
  const expected = createCheckInToken(eventId, secret, bucket * 60_000).split('.')[1]!;
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export async function checkIn(db: Database, actor: string, eventId: string, expectedVersion: number, token: string, secret: string, key: string, at?: number): Promise<{ id: string; eventId: string; userId: string; evidence: string }> {
  return command(db, actor, `checkin:${eventId}`, key, async tx => {
    const event = await lockEvent(tx, eventId, expectedVersion);
    const now = at ?? await databaseNow(tx);
    const start = Date.parse(event.payload.startAt!); const end = Date.parse(event.payload.endAt!);
    if (!['CONFIRMED', 'IN_PROGRESS'].includes(event.status) || now < start - 30 * 60_000 || now > end + 30 * 60_000)
      throw new AppError('CHECKIN_CLOSED', '当前不在签到时间内');
    const { rows: registered } = await tx.query<RegistrationRow>("SELECT * FROM registrations WHERE event_id=$1 AND user_id=$2 AND status='CONFIRMED'", [eventId, actor]);
    if (!registered[0]) throw new AppError('NOT_REGISTERED', '只有已确认参与者可以签到', 403);
    if (!verifyCheckInToken(eventId, token, secret, now)) throw new AppError('INVALID_CHECKIN_TOKEN', '签到码已失效');
    const id = randomUUID();
    const { rows: inserted } = await tx.query<{ id: string; event_id: string; user_id: string; evidence: string }>("INSERT INTO checkins(id,event_id,user_id,evidence,checked_at) VALUES($1,$2,$3,'SCAN',$4) ON CONFLICT(event_id,user_id) DO NOTHING RETURNING *", [id, eventId, actor, new Date(now).toISOString()]);
    const row = inserted[0] ?? (await tx.query<{ id: string; event_id: string; user_id: string; evidence: string }>(
      'SELECT id,event_id,user_id,evidence FROM checkins WHERE event_id=$1 AND user_id=$2', [eventId, actor])).rows[0]!;
    if (now >= start && event.status === 'CONFIRMED') {
      const { rows: started } = await tx.query<{ id: string }>(`UPDATE events
        SET status='IN_PROGRESS',recruiting=false,updated_at=now()
        WHERE id=$1 AND status='CONFIRMED' AND clock_timestamp()>=(payload->>'startAt')::timestamptz
        RETURNING id`, [eventId]);
      if (started.length) await audit(tx, actor, eventId, 'EVENT_STARTED');
    }
    if (inserted.length) await audit(tx, actor, eventId, 'CHECK_IN');
    return { id: row.id, eventId, userId: actor, evidence: row.evidence };
  });
}

export async function listCheckIns(db: Database, actor: string, eventId: string): Promise<Array<{
  id: string; userId: string; evidence: string; checkedAt: Date; disputed: boolean
}>> {
  const event = await getEvent(db, actor, eventId);
  const canManage = event.hostId === actor || await hasCohostCapability(db, actor, eventId, 'CHECKIN_MANAGE');
  const { rows } = await db.query<{ id: string; user_id: string; evidence: string; checked_at: Date; disputed: boolean }>(
    'SELECT id,user_id,evidence,checked_at,disputed FROM checkins WHERE event_id=$1 AND ($2=user_id OR $3=true) ORDER BY checked_at,id',
    [eventId, actor, canManage]);
  return rows.map(row => ({ id: row.id, userId: row.user_id, evidence: row.evidence,
    checkedAt: row.checked_at, disputed: row.disputed }));
}

type ManualCheckIn = { id: string; eventId: string; userId: string; status: string; requestedAt: string; respondedAt: string | null };
type ManualCheckInRow = { id: string; event_id: string; user_id: string; status: string; requested_at: Date; responded_at: Date | null };

function manualCheckInResult(row: ManualCheckInRow): ManualCheckIn {
  return { id: row.id, eventId: row.event_id, userId: row.user_id, status: row.status,
    requestedAt: new Date(row.requested_at).toISOString(), respondedAt: row.responded_at ? new Date(row.responded_at).toISOString() : null };
}

export async function requestManualCheckIn(db: Database, actor: string, eventId: string, expectedVersion: number,
  userId: string, key: string, at?: number): Promise<ManualCheckIn> {
  return command(db, actor, `manual-checkin:${eventId}:${userId}`, key, async tx => {
    if (typeof userId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) throw new AppError('BAD_REQUEST', '补记参与者身份无效');
    const event = await lockEvent(tx, eventId, expectedVersion);
    if (event.host_id !== actor && !(await hasCohostCapability(tx, actor, eventId, 'CHECKIN_MANAGE')))
      throw new AppError('FORBIDDEN', '没有本活动签到管理权限', 403);
    const now = at ?? await databaseNow(tx);
    const start = Date.parse(event.payload.startAt!); const end = Date.parse(event.payload.endAt!);
    if (!['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(event.status) || now < start - 30 * 60_000 || now > end + 48 * 60 * 60_000)
      throw new AppError('INVALID_STATE', '当前不在到场补记期限内');
    const { rows: registered } = await tx.query("SELECT 1 FROM registrations WHERE event_id=$1 AND user_id=$2 AND status='CONFIRMED'", [eventId, userId]);
    if (!registered.length) throw new AppError('NOT_REGISTERED', '仅可补记已确认参与者', 403);
    const { rows: checked } = await tx.query('SELECT 1 FROM checkins WHERE event_id=$1 AND user_id=$2', [eventId, userId]);
    if (checked.length) throw new AppError('INVALID_STATE', '该参与者已有到场记录');
    const { rows: existing } = await tx.query('SELECT 1 FROM manual_checkins WHERE event_id=$1 AND user_id=$2', [eventId, userId]);
    if (existing.length) throw new AppError('INVALID_STATE', '该参与者已有补记申请');
    const { rows } = await tx.query<ManualCheckInRow>(`INSERT INTO manual_checkins(id,event_id,user_id,requested_by,requested_at)
      SELECT $1,$2,$3,$4,$5 FROM events WHERE id=$2 AND status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
        AND COALESCE($6::timestamptz,clock_timestamp()) >= (payload->>'startAt')::timestamptz - interval '30 minutes'
        AND COALESCE($6::timestamptz,clock_timestamp()) <= (payload->>'endAt')::timestamptz + interval '48 hours'
      RETURNING *`,
    [randomUUID(), eventId, userId, actor, new Date(now).toISOString(), at === undefined ? null : new Date(at).toISOString()]);
    if (!rows[0]) throw new AppError('INVALID_STATE', '当前不在到场补记期限内');
    await enqueueNotification(tx, eventId, userId, 'MANUAL_CHECKIN_REQUEST', event.version, { requestId: rows[0]!.id });
    await audit(tx, actor, eventId, 'REQUEST_MANUAL_CHECKIN');
    return manualCheckInResult(rows[0]!);
  });
}

export async function respondManualCheckIn(db: Database, actor: string, requestId: string, expectedVersion: number,
  accepted: boolean, key: string, at?: number): Promise<ManualCheckIn> {
  return command(db, actor, `respond-manual-checkin:${requestId}`, key, async tx => {
    if (typeof accepted !== 'boolean') throw new AppError('BAD_REQUEST', '必须明确确认或拒绝补记');
    const { rows: found } = await tx.query<ManualCheckInRow>('SELECT * FROM manual_checkins WHERE id=$1', [requestId]);
    if (!found[0]) throw new AppError('NOT_FOUND', '补记申请不存在', 404);
    const event = await lockEvent(tx, found[0].event_id, expectedVersion);
    const { rows } = await tx.query<ManualCheckInRow>('SELECT * FROM manual_checkins WHERE id=$1 FOR UPDATE', [requestId]);
    const request = rows[0]!;
    if (request.user_id !== actor) throw new AppError('FORBIDDEN', '只有参与者本人可以确认补记', 403);
    if (request.status !== 'PENDING') throw new AppError('INVALID_STATE', '补记申请已处理');
    const now = at ?? await databaseNow(tx);
    if (!['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(event.status) || now > Date.parse(event.payload.endAt!) + 7 * 24 * 60 * 60_000)
      throw new AppError('INVALID_STATE', '补记确认期限已结束');
    let status = accepted ? 'CONFIRMED' : 'REJECTED';
    if (accepted) {
      const { rows: inserted } = await tx.query('INSERT INTO checkins(id,event_id,user_id,evidence,checked_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(event_id,user_id) DO NOTHING RETURNING id',
        [randomUUID(), event.id, actor, 'MANUAL_CONFIRMED', new Date(now).toISOString()]);
      if (!inserted.length) status = 'SUPERSEDED';
    }
    const { rows: updated } = await tx.query<ManualCheckInRow>(`UPDATE manual_checkins SET status=$2,responded_at=$3
      WHERE id=$1 AND EXISTS (SELECT 1 FROM events WHERE id=$4 AND status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
        AND COALESCE($5::timestamptz,clock_timestamp()) <= (payload->>'endAt')::timestamptz + interval '7 days')
      RETURNING *`,
    [requestId, status, new Date(now).toISOString(), event.id, at === undefined ? null : new Date(at).toISOString()]);
    if (!updated[0]) throw new AppError('INVALID_STATE', '补记确认期限已结束');
    await audit(tx, actor, event.id, status === 'SUPERSEDED' ? 'SUPERSEDE_MANUAL_CHECKIN' : accepted ? 'CONFIRM_MANUAL_CHECKIN' : 'REJECT_MANUAL_CHECKIN');
    return manualCheckInResult(updated[0]!);
  });
}

export async function listManualCheckIns(db: Database, actor: string, eventId: string): Promise<ManualCheckIn[]> {
  const event = await getEvent(db, actor, eventId);
  const canManage = event.hostId === actor || await hasCohostCapability(db, actor, eventId, 'CHECKIN_MANAGE');
  const { rows } = await db.query<ManualCheckInRow>(`SELECT id,event_id,user_id,status,requested_at,responded_at FROM manual_checkins
    WHERE event_id=$1 AND ($2=user_id OR $3=true) ORDER BY requested_at,id`, [eventId, actor, canManage]);
  return rows.map(manualCheckInResult);
}

export async function completeEvent(db: Database, actor: string, eventId: string, expectedVersion: number,
  input: { held: boolean; actualCount: number; issues: string[] }, key: string): Promise<{ eventId: string; held: boolean; actualCount: number }> {
  return command(db, actor, `complete-event:${eventId}`, key, async tx => {
    const event = await lockEvent(tx, eventId, expectedVersion);
    if (event.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可以结项', 403);
    if (!['CONFIRMED', 'IN_PROGRESS'].includes(event.status) || await databaseNow(tx) < Date.parse(event.payload.endAt!))
      throw new AppError('INVALID_STATE', '活动尚不能结项');
    if (typeof input.held !== 'boolean' || !Number.isInteger(input.actualCount) || input.actualCount < 0 ||
      input.actualCount > event.payload.maxParticipants! || (!input.held && input.actualCount !== 0))
      throw new AppError('BAD_REQUEST', '结项人数无效');
    const issues = input.issues;
    if (!Array.isArray(issues) || issues.length > 10 || issues.some(issue =>
      typeof issue !== 'string' || !issue.trim() || issue.trim().length > 500))
      throw new AppError('BAD_REQUEST', '结项异常记录无效');
    const normalizedIssues = issues.map(issue => issue.trim());
    const { rows: completed } = await tx.query<{ event_id: string }>(`WITH completion_time AS MATERIALIZED (SELECT clock_timestamp() AS current_time)
      INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at,issues)
      SELECT $1,$2,$3,$4,completion_time.current_time,$5::jsonb FROM events CROSS JOIN completion_time WHERE id=$1
        AND status IN ('CONFIRMED','IN_PROGRESS')
        AND completion_time.current_time >= (payload->>'endAt')::timestamptz RETURNING event_id`,
    [eventId, input.held, input.actualCount, actor, JSON.stringify(normalizedIssues)]);
    if (!completed.length) throw new AppError('INVALID_STATE', '活动尚不能结项');
    await tx.query("UPDATE events SET status='COMPLETED',recruiting=false,updated_at=now() WHERE id=$1", [eventId]);
    const { rows: participants } = await tx.query<{ user_id: string }>(
      "SELECT user_id FROM registrations WHERE event_id=$1 AND status='CONFIRMED' AND user_id<>$2", [eventId, actor]);
    for (const participant of participants)
      await enqueueInAppOutcomePrompt(tx, eventId, participant.user_id, 'EVENT_OUTCOME_REVIEW', event.version);
    await audit(tx, actor, eventId, 'COMPLETE_EVENT');
    return { eventId, held: input.held, actualCount: input.actualCount };
  });
}

export async function recordOutcomeFeedback(db: Database, actor: string, eventId: string, expectedVersion: number,
  input: { held: boolean; wouldRepeat: boolean; reason?: string }, key: string): Promise<{ eventId: string; userId: string; disputed: boolean }> {
  return command(db, actor, `outcome-feedback:${eventId}`, key, async tx => {
    const event = await lockEvent(tx, eventId, expectedVersion);
    if (event.status !== 'COMPLETED') throw new AppError('INVALID_STATE', '活动结项后才能反馈');
    if (event.host_id === actor) throw new AppError('FORBIDDEN', '主办方结项不能替代独立参与者反馈', 403);
    const { rows: registrations } = await tx.query("SELECT 1 FROM registrations WHERE event_id=$1 AND user_id=$2 AND status='CONFIRMED'", [eventId, actor]);
    if (!registrations.length) throw new AppError('FORBIDDEN', '只有确认参与者可反馈', 403);
    if (typeof input.held !== 'boolean' || typeof input.wouldRepeat !== 'boolean' ||
      (input.reason !== undefined && (typeof input.reason !== 'string' || input.reason.length > 1000)) ||
      (!input.held && !input.reason?.trim())) throw new AppError('BAD_REQUEST', '反馈内容无效');
    const { rows: previous } = await tx.query('SELECT 1 FROM outcome_feedback WHERE event_id=$1 AND user_id=$2', [eventId, actor]);
    if (previous.length) throw new AppError('INVALID_STATE', '本次活动已提交反馈');
    await tx.query('INSERT INTO outcome_feedback(event_id,user_id,held,would_repeat,reason) VALUES($1,$2,$3,$4,$5)',
      [eventId, actor, input.held, input.wouldRepeat, input.reason?.trim() ?? null]);
    if (!input.held) {
      await tx.query('UPDATE outcomes SET disputed=true WHERE event_id=$1', [eventId]);
      await tx.query('INSERT INTO reports(id,reporter_id,event_id,kind,description) VALUES($1,$2,$3,$4,$5)',
        [randomUUID(), actor, eventId, 'ATTENDANCE', input.reason!.trim()]);
    }
    await audit(tx, actor, eventId, 'OUTCOME_FEEDBACK');
    return { eventId, userId: actor, disputed: !input.held };
  });
}

export async function getOutcomeEvidence(db: Database, actor: string, eventId: string): Promise<{
  eventId: string; held: boolean; actualCount: number; disputed: boolean; independentFeedback: number; myFeedbackSubmitted: boolean;
  issues: string[];
  reviewDecision: 'HELD_CONFIRMED' | 'NOT_HELD_CONFIRMED' | 'INCONCLUSIVE' | null;
  level: 'NOT_HELD' | 'HOST_ONLY' | 'MEMBER_CORROBORATED' | 'DISPUTED'
}> {
  const event = await getEvent(db, actor, eventId);
  const { rows } = await db.query<{ held: boolean; actual_count: number; disputed: boolean; issues: string[] }>('SELECT held,actual_count,disputed,issues FROM outcomes WHERE event_id=$1', [eventId]);
  const outcome = rows[0];
  if (!outcome) throw new AppError('NOT_FOUND', '活动尚无结项记录', 404);
  const { rows: feedback } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM outcome_feedback WHERE event_id=$1 AND held=true', [eventId]);
  const { rows: mine } = await db.query('SELECT 1 FROM outcome_feedback WHERE event_id=$1 AND user_id=$2', [eventId, actor]);
  const { rows: reviews } = await db.query<{ decision: 'HELD_CONFIRMED' | 'NOT_HELD_CONFIRMED' | 'INCONCLUSIVE' }>(`
    SELECT rv.decision FROM outcome_reviews rv WHERE rv.event_id=$1 AND NOT EXISTS (
      SELECT 1 FROM outcome_feedback f WHERE f.event_id=$1 AND f.held=false AND f.created_at>rv.created_at)
    AND NOT EXISTS (SELECT 1 FROM reports r WHERE r.event_id=$1 AND r.kind='ATTENDANCE' AND r.status<>'RESOLVED')
    ORDER BY rv.created_at DESC,rv.id DESC LIMIT 1`, [eventId]);
  const independentFeedback = feedback[0]?.n ?? 0;
  const reviewDecision = reviews[0]?.decision ?? null;
  const disputed = outcome.disputed && (!reviewDecision || reviewDecision === 'INCONCLUSIVE');
  const level = disputed ? 'DISPUTED' : reviewDecision === 'NOT_HELD_CONFIRMED' || !outcome.held
    ? 'NOT_HELD' : independentFeedback > 0 ? 'MEMBER_CORROBORATED' : 'HOST_ONLY';
  return { eventId, held: outcome.held, actualCount: outcome.actual_count, disputed, independentFeedback,
    reviewDecision,
    issues: event.hostId === actor ? outcome.issues : [],
    myFeedbackSubmitted: mine.length > 0, level };
}

export async function repeatEvent(db: Database, actor: string, eventId: string, key: string): Promise<EventRecord> {
  const { rows } = await db.query<EventDatabaseRow>('SELECT * FROM events WHERE id=$1', [eventId]);
  const old = rows[0];
  if (!old) throw new AppError('NOT_FOUND', '活动不存在', 404);
  if (old.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可以再约', 403);
  if (old.status !== 'COMPLETED') throw new AppError('INVALID_STATE', '活动结项后才能再约');
  const p = old.payload;
  const durationMinutes = Math.round((Date.parse(p.endAt ?? '') - Date.parse(p.startAt ?? '')) / 60_000);
  return createDraft(db, actor, { title: p.title, type: p.type, timeZone: p.timeZone, city: p.city, skillLevel: p.skillLevel,
    minParticipants: p.minParticipants, maxParticipants: p.maxParticipants, cancellationRule: p.cancellationRule,
    visibility: p.visibility, approvalMode: p.approvalMode, hostParticipates: p.hostParticipates,
    ...(Number.isSafeInteger(durationMinutes) && durationMinutes > 0 ? { templateDurationMinutes: durationMinutes } : {})
  }, `repeat:${eventId}:${key}`, old.is_test);
}

export async function listRepeatCandidates(db: Database, actor: string, eventId: string): Promise<string[]> {
  const event = await getEvent(db, actor, eventId);
  if (event.hostId !== actor) throw new AppError('FORBIDDEN', '只有主办方可查看候选名单', 403);
  if (event.status !== 'COMPLETED') throw new AppError('INVALID_STATE', '活动结项后才能查看候选名单');
  const { rows } = await db.query<{ user_id: string }>(`SELECT r.user_id FROM registrations r
    JOIN users u ON u.id=r.user_id AND u.status='ACTIVE'
    JOIN notification_consents c ON c.user_id=r.user_id AND c.purpose='SIMILAR_ACTIVITY_INVITES' AND c.granted=true
      AND c.notice_version=$3
    WHERE r.event_id=$1 AND r.status='CONFIRMED' AND r.user_id<>$2
      AND NOT EXISTS (SELECT 1 FROM privacy_requests pr WHERE pr.user_id=r.user_id
        AND pr.kind='DELETE' AND pr.status NOT IN ('FULFILLED','CANCELLED'))
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.revoked_at IS NULL
        AND ((b.blocker_id=$2 AND b.blocked_id=r.user_id) OR (b.blocker_id=r.user_id AND b.blocked_id=$2)))
    ORDER BY r.created_at,r.id`, [eventId, actor, consentNotice('SIMILAR_ACTIVITY_INVITES').version]);
  return rows.map(row => row.user_id);
}

export async function recordExpense(db: Database, actor: string, eventId: string, expectedVersion: number, totalFen: number, key: string,
  expectedLedgerRevision?: number): Promise<{ id: string; status: string; revision: number; shares: Array<{ userId: string; amountFen: number }> }> {
  return command(db, actor, `expense:${eventId}`, key, async tx => {
    const event = await lockEvent(tx, eventId, expectedVersion);
    if (event.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可以记录费用', 403);
    if (event.payload.feeMode !== 'AA' || !Number.isSafeInteger(totalFen) || totalFen < 0) throw new AppError('BAD_REQUEST', '费用必须为非负整数分');
    const { rows: currentRows } = await tx.query<{ id: string; revision: number; total_fen: number }>(
      'SELECT id,revision,total_fen FROM expense_ledgers WHERE event_id=$1 AND superseded_by IS NULL FOR UPDATE', [eventId]);
    const current = currentRows[0];
    if ((current && expectedLedgerRevision !== current.revision) || (!current && expectedLedgerRevision !== undefined && expectedLedgerRevision !== 0))
      throw new AppError('LEDGER_VERSION_CONFLICT', '费用记录已变化，请刷新后确认新金额', 409);
    if (current?.total_fen === totalFen) throw new AppError('BAD_REQUEST', '费用金额没有变化');
    const { rows: people } = await tx.query<{ user_id: string }>("SELECT user_id FROM registrations WHERE event_id=$1 AND status='CONFIRMED' ORDER BY user_id", [eventId]);
    if (!people.length) throw new AppError('INVALID_STATE', '没有确认参与者');
    const base = Math.floor(totalFen / people.length); const remainder = totalFen % people.length;
    const shares = people.map((p, i) => ({ userId: p.user_id, amountFen: base + (i < remainder ? 1 : 0) }));
    if (shares.some(s => s.amountFen > event.payload.feeCapFen!)) throw new AppError('FEE_CAP_EXCEEDED', '人均费用超过发布时上限');
    const id = randomUUID();
    if (current) await tx.query('UPDATE expense_ledgers SET superseded_by=$2 WHERE id=$1', [current.id, id]);
    const revision = (current?.revision ?? 0) + 1;
    await tx.query('INSERT INTO expense_ledgers(id,event_id,total_fen,created_by,revision) VALUES($1,$2,$3,$4,$5)',
      [id, eventId, totalFen, actor, revision]);
    for (const share of shares) await tx.query('INSERT INTO expense_shares(ledger_id,user_id,amount_fen) VALUES($1,$2,$3)', [id, share.userId, share.amountFen]);
    await audit(tx, actor, eventId, 'RECORD_EXPENSE');
    return { id, status: 'RECORD_ONLY', revision, shares };
  });
}

export interface ExpenseView { id: string; totalFen: number; status: 'RECORD_ONLY'; revision: number; current: boolean;
  shares: Array<{ userId: string; amountFen: number; participantHandled: boolean; hostReceived: boolean }> }

export async function listExpenses(db: Database, actor: string, eventId: string): Promise<ExpenseView[]> {
  const { rows: events } = await db.query<{ host_id: string }>('SELECT host_id FROM events WHERE id=$1', [eventId]);
  if (!events[0]) throw new AppError('NOT_FOUND', '活动不存在', 404);
  const isHost = events[0].host_id === actor;
  if (!isHost) {
    const { rows: memberships } = await db.query<{ member: number }>(`SELECT 1 AS member FROM registrations
      WHERE event_id=$1 AND user_id=$2 AND status IN ('CONFIRMED','RECONFIRM_REQUIRED') LIMIT 1`, [eventId, actor]);
    if (!memberships[0]) throw new AppError('FORBIDDEN', '无权查看费用记录', 403);
  }
  const { rows } = await db.query<{ id: string; total_fen: number; status: 'RECORD_ONLY'; revision: number; superseded_by: string | null;
    user_id: string; amount_fen: number; participant_handled: boolean; host_received: boolean }>(
    `SELECT l.id,l.total_fen,l.status,l.revision,l.superseded_by,s.user_id,s.amount_fen,s.participant_handled,s.host_received
     FROM expense_ledgers l JOIN expense_shares s ON s.ledger_id=l.id
     WHERE l.event_id=$1 AND ($2 OR (s.user_id=$3 AND EXISTS (
       SELECT 1 FROM registrations r WHERE r.event_id=l.event_id AND r.user_id=$3
         AND r.status IN ('CONFIRMED','RECONFIRM_REQUIRED'))))
     ORDER BY l.revision DESC,l.id,s.user_id`, [eventId, isHost, actor]);
  const byId = new Map<string, ExpenseView>();
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, { id: row.id, totalFen: row.total_fen, status: row.status,
      revision: row.revision, current: row.superseded_by === null, shares: [] });
    byId.get(row.id)!.shares.push({ userId: row.user_id, amountFen: row.amount_fen, participantHandled: row.participant_handled, hostReceived: row.host_received });
  }
  return [...byId.values()];
}

export async function markExpenseShare(db: Database, actor: string, ledgerId: string, userId: string, expectedVersion: number,
  field: 'PARTICIPANT_HANDLED' | 'HOST_RECEIVED', value: boolean, key: string): Promise<{ userId: string; participantHandled: boolean; hostReceived: boolean }> {
  if (!['PARTICIPANT_HANDLED', 'HOST_RECEIVED'].includes(field) || typeof value !== 'boolean') throw new AppError('BAD_REQUEST', '费用标记参数无效');
  return command(db, actor, `expense-share:${ledgerId}:${userId}:${field}`, key, async tx => {
    const { rows } = await tx.query<{ event_id: string }>('SELECT event_id FROM expense_ledgers WHERE id=$1', [ledgerId]);
    if (!rows[0]) throw new AppError('NOT_FOUND', '费用记录不存在', 404);
    const event = await lockEvent(tx, rows[0].event_id, expectedVersion);
    if (field === 'HOST_RECEIVED' && event.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可以标记收到', 403);
    if (field === 'PARTICIPANT_HANDLED' && actor !== userId) throw new AppError('FORBIDDEN', '只能标记自己的处理状态', 403);
    if (field === 'PARTICIPANT_HANDLED') {
      const { rows: memberships } = await tx.query<{ member: number }>(`SELECT 1 AS member FROM registrations
        WHERE event_id=$1 AND user_id=$2 AND status IN ('CONFIRMED','RECONFIRM_REQUIRED') LIMIT 1`, [event.id, actor]);
      if (!memberships[0]) throw new AppError('FORBIDDEN', '已退出本活动，不能再修改费用状态', 403);
    }
    const { rows: ledgerRows } = await tx.query<{ superseded_by: string | null }>(
      'SELECT superseded_by FROM expense_ledgers WHERE id=$1 FOR UPDATE', [ledgerId]);
    if (ledgerRows[0]?.superseded_by) throw new AppError('LEDGER_SUPERSEDED', '旧版费用记录仅供历史查看，请打开当前版本', 409);
    const column = field === 'HOST_RECEIVED' ? 'host_received' : 'participant_handled';
    const { rows: updated } = await tx.query<{ user_id: string; participant_handled: boolean; host_received: boolean }>(
      `UPDATE expense_shares SET ${column}=$3 WHERE ledger_id=$1 AND user_id=$2 AND ${column} IS DISTINCT FROM $3
       RETURNING user_id,participant_handled,host_received`, [ledgerId, userId, value]);
    if (!updated[0]) {
      const { rows: unchanged } = await tx.query<{ user_id: string; participant_handled: boolean; host_received: boolean }>(
        'SELECT user_id,participant_handled,host_received FROM expense_shares WHERE ledger_id=$1 AND user_id=$2', [ledgerId, userId]);
      if (!unchanged[0]) throw new AppError('NOT_FOUND', '分摊项不存在', 404);
      return { userId, participantHandled: unchanged[0].participant_handled, hostReceived: unchanged[0].host_received };
    }
    await audit(tx, actor, event.id, `EXPENSE_${field}`);
    return { userId: userId, participantHandled: updated[0].participant_handled, hostReceived: updated[0].host_received };
  });
}
