import { randomUUID, randomBytes } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { claimIdempotency } from './idempotency.ts';
import { assertPublicRecruitmentOpen, publicRecruitmentOpen } from './public-gate.ts';
import { assertNewActionsOpen } from './emergency-gate.ts';
import { getCohostCapabilities, type CohostCapability } from './cohosts.ts';
import { databaseNow } from './registrations.ts';
import { assertHostCanPublish } from './host-limits.ts';

export interface EventInput {
  title?: string; type?: string; startAt?: string; endAt?: string; timeZone?: string;
  templateDurationMinutes?: number;
  city?: string; venueName?: string; venueStatus?: string; skillLevel?: string; minParticipants?: number;
  maxParticipants?: number; registrationDeadline?: string; confirmationDeadline?: string;
  feeMode?: string; feeCapFen?: number; cancellationRule?: string; visibility?: string;
  approvalMode?: string; hostParticipates?: boolean;
}
export interface EventRecord {
  id: string; hostId: string; status: string; version: number; payload: EventInput;
  recruiting: boolean; inviteToken?: string; updatedAt: string; reviewStatus: string; reviewReason?: string;
  aiSuggestionGenerated?: boolean;
  /** Present when an existing member sees a prior reviewed version; null means its text is unavailable. */
  visibleContentVersion?: number | null;
  cohostCapabilities?: CohostCapability[];
  venueEvidence?: { venueName: string; sourceType: 'HOST_STATEMENT'; phase: 'PUBLISH' | 'CHANGE' | 'FORMATION';
    recordedAt: string; expiresAt: string };
}
type EventRow = { id: string; host_id: string; status: string; version: number; payload: EventInput; recruiting: boolean; is_test: boolean;
  invite_token: string | null; updated_at: Date; review_status: string; review_reason: string | null };

function rowToEvent(row: EventRow): EventRecord {
  return { id: row.id, hostId: row.host_id, status: row.status, version: row.version,
    payload: row.payload, recruiting: row.recruiting, reviewStatus: row.review_status,
    ...(row.review_reason ? { reviewReason: row.review_reason } : {}), updatedAt: new Date(row.updated_at).toISOString(),
    ...(row.invite_token ? { inviteToken: row.invite_token } : {}) };
}

export async function hasGeneratedAiSuggestion(db: Queryable, eventId: string): Promise<boolean> {
  const { rows } = await db.query<{ generated: boolean }>(`SELECT EXISTS (
    SELECT 1 FROM ai_draft_requests WHERE event_id=$1 AND status='COMPLETED'
      AND result->>'aiStatus'='GENERATED'
  ) AS generated`, [eventId]);
  return rows[0]?.generated ?? false;
}

function parseExplicitDateTime(value: unknown): number {
  if (typeof value !== 'string' || !value) return NaN;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return NaN;
  const [, year, month, day, hour, minute, second, zone] = match;
  const y = Number(year); const m = Number(month); const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate() ||
      Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return NaN;
  if (zone !== 'Z' && (Number(zone!.slice(1, 3)) > 14 || Number(zone!.slice(4, 6)) > 59)) return NaN;
  return Date.parse(value);
}

export function validateDraftFields(input: EventInput): void {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new AppError('INVALID_EVENT', '草稿内容必须是字段对象');
  const fail = (field: string) => { throw new AppError('INVALID_EVENT', `草稿${field}无效，请修改后重试`); };
  for (const field of ['title', 'city', 'venueName', 'cancellationRule'] as const) {
    const value = input[field];
    if (value !== undefined && typeof value !== 'string') fail(field);
  }
  if (input.skillLevel !== undefined && (typeof input.skillLevel !== 'string' || input.skillLevel.length > 40 ||
      (input.skillLevel.length > 0 && !input.skillLevel.trim()))) fail('水平要求');
  for (const [field, allowed] of Object.entries({ type: ['badminton'], timeZone: ['Asia/Shanghai'],
    venueStatus: ['UNCONFIRMED', 'HOST_CONFIRMED'], feeMode: ['FREE', 'AA'], visibility: ['INVITE', 'PUBLIC'],
    approvalMode: ['AUTO', 'MANUAL'] }) as Array<[keyof EventInput, string[]]>) {
    const value = input[field];
    if (value !== undefined && value !== '' && (typeof value !== 'string' || !allowed.includes(value))) fail(field);
  }
  if (input.hostParticipates !== undefined && typeof input.hostParticipates !== 'boolean') fail('主办参加状态');
  for (const field of ['minParticipants', 'maxParticipants'] as const) {
    const value = input[field];
    if (value !== undefined && (!Number.isSafeInteger(value) || value! < 4 || value! > 12)) fail(field);
  }
  if (input.minParticipants !== undefined && input.maxParticipants !== undefined &&
      input.maxParticipants < input.minParticipants) fail('人数上限');
  if (input.feeCapFen !== undefined && (!Number.isSafeInteger(input.feeCapFen) || input.feeCapFen < 0)) fail('费用上限');
  if (input.feeMode === 'FREE' && input.feeCapFen !== undefined && input.feeCapFen !== 0) fail('免费活动费用');
  if (input.templateDurationMinutes !== undefined &&
      (!Number.isSafeInteger(input.templateDurationMinutes) || input.templateDurationMinutes <= 0)) fail('上场时长');
  const times = {} as Record<'startAt' | 'endAt' | 'registrationDeadline' | 'confirmationDeadline', number>;
  for (const field of ['startAt', 'endAt', 'registrationDeadline', 'confirmationDeadline'] as const) {
    const value = input[field];
    if (value === undefined || value === '') continue;
    const parsed = parseExplicitDateTime(value);
    if (!Number.isFinite(parsed)) fail(field);
    times[field] = parsed;
  }
  if (times.startAt !== undefined && times.endAt !== undefined && times.endAt <= times.startAt) fail('结束时间');
  if (times.registrationDeadline !== undefined && times.startAt !== undefined &&
      times.registrationDeadline >= times.startAt) fail('报名截止时间');
  if (times.confirmationDeadline !== undefined && times.registrationDeadline !== undefined &&
      times.confirmationDeadline >= times.registrationDeadline) fail('成局确认截止时间');
}

export function validatePublish(input: EventInput): void {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new AppError('INVALID_EVENT', '活动字段不完整或不符合发布规则');
  const nonBlank = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
  const start = parseExplicitDateTime(input.startAt);
  const end = parseExplicitDateTime(input.endAt);
  const registration = parseExplicitDateTime(input.registrationDeadline);
  const confirmation = parseExplicitDateTime(input.confirmationDeadline);
  const valid = input.type === 'badminton' && nonBlank(input.title) && nonBlank(input.city) &&
    nonBlank(input.venueName) && input.venueStatus === 'HOST_CONFIRMED' &&
    input.timeZone === 'Asia/Shanghai' && Number.isFinite(start) && Number.isFinite(end) &&
    Number.isFinite(registration) && Number.isFinite(confirmation) &&
    confirmation < registration && registration < start && start < end &&
    Number.isInteger(input.minParticipants) && Number.isInteger(input.maxParticipants) &&
    input.minParticipants! >= 4 && input.maxParticipants! <= 12 && input.maxParticipants! >= input.minParticipants! &&
    ((input.feeMode === 'FREE' && (input.feeCapFen === undefined || input.feeCapFen === 0)) ||
      (input.feeMode === 'AA' && Number.isSafeInteger(input.feeCapFen) && input.feeCapFen! >= 0)) &&
    nonBlank(input.cancellationRule) && (input.skillLevel === undefined || input.skillLevel === '' ||
      (typeof input.skillLevel === 'string' && input.skillLevel.length <= 40 && nonBlank(input.skillLevel))) &&
    ['INVITE', 'PUBLIC'].includes(input.visibility ?? '') &&
    ['AUTO', 'MANUAL'].includes(input.approvalMode ?? '') &&
    (input.visibility !== 'PUBLIC' || input.approvalMode === 'MANUAL') && typeof input.hostParticipates === 'boolean';
  if (!valid) throw new AppError('INVALID_EVENT', '活动字段不完整或不符合发布规则');
}

export async function getEvent(db: Queryable, actorId: string, id: string): Promise<EventRecord> {
  const { rows } = await db.query<EventRow>('SELECT * FROM events WHERE id=$1', [id]);
  const row = rows[0];
  if (!row) throw new AppError('NOT_FOUND', '活动不存在', 404);
  const cohostCapabilities = row.host_id === actorId ? [] : await getCohostCapabilities(db, actorId, id);
  let visiblePayload = row.payload;
  let visibleContentVersion: number | null | undefined;
  if (row.host_id !== actorId) {
    if (row.status === 'DRAFT') throw new AppError('FORBIDDEN', '无权查看此活动', 403);
    if (row.payload.visibility === 'PUBLIC' && (row.review_status !== 'APPROVED' || !(await publicRecruitmentOpen(db, false, row.payload)))) {
      const access = cohostCapabilities.length ? { rows: [1] } : await db.query(row.review_status === 'APPROVED'
        ? 'SELECT 1 FROM registrations WHERE event_id=$1 AND user_id=$2'
        : "SELECT 1 FROM registrations WHERE event_id=$1 AND user_id=$2 AND status IN ('INTERESTED','REQUESTED','WAITLISTED','OFFERED','CONFIRMED','RECONFIRM_REQUIRED')", [id, actorId]);
      if (!access.rows.length) throw new AppError('FORBIDDEN', '活动暂不可公开查看', 403);
    }
    if (row.payload.visibility === 'INVITE') {
      const legacyHistory = row.review_status === 'NOT_REQUIRED' &&
        (['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'].includes(row.status) ||
          await databaseNow(db) >= Date.parse(row.status === 'RECRUITING'
            ? row.payload.confirmationDeadline! : row.payload.startAt!));
      const access = cohostCapabilities.length ? { rows: [1] } : await db.query("SELECT 1 FROM registrations WHERE event_id=$1 AND user_id=$2 AND status IN ('INTERESTED','REQUESTED','WAITLISTED','OFFERED','CONFIRMED','RECONFIRM_REQUIRED')", [id, actorId]);
      if (!access.rows.length) throw new AppError('FORBIDDEN', '无权查看此活动', 403);
      if (row.review_status !== 'APPROVED' && !legacyHistory) visibleContentVersion = null;
    } else if (row.payload.visibility === 'PUBLIC' && row.review_status !== 'APPROVED') {
      visibleContentVersion = null;
    }
    if (visibleContentVersion === null) {
      // Only versions explicitly approved by an operator, or INVITE versions already
      // published before migration 48, may supply member-facing event text.
      const { rows: snapshots } = await db.query<{ version: number; payload: EventInput }>(`SELECT v.version,v.payload
        FROM event_versions v WHERE v.event_id=$1 AND v.version<=$2 AND (
          EXISTS (SELECT 1 FROM event_review_decisions d WHERE d.event_id=v.event_id
            AND d.event_version=v.version AND d.decision='APPROVED')
          OR (v.payload->>'visibility'='INVITE' AND v.created_at<
            (SELECT applied_at FROM schema_migrations WHERE version=48))
        ) ORDER BY v.version DESC LIMIT 1`, [id, row.version]);
      if (snapshots[0]) {
        visiblePayload = snapshots[0].payload;
        visibleContentVersion = snapshots[0].version;
      } else {
        visiblePayload = { title: '活动审核中', visibility: row.payload.visibility };
      }
    }
  }
  const result = rowToEvent(row);
  if (row.review_status !== 'APPROVED') result.recruiting = false;
  if (visibleContentVersion !== undefined) {
    result.payload = visiblePayload;
    result.recruiting = false;
    result.visibleContentVersion = visibleContentVersion;
  }
  if (row.status !== 'DRAFT' && visibleContentVersion !== null) {
    const { rows: evidence } = await db.query<{ venue_name: string; source_type: 'HOST_STATEMENT';
      phase: 'PUBLISH' | 'CHANGE' | 'FORMATION'; recorded_at: Date; expires_at: Date }>(
      `SELECT venue_name,source_type,phase,recorded_at,expires_at FROM venue_evidence
       WHERE event_id=$1 AND venue_name=$2 AND expires_at=$3 AND activity_end_at=$4
         AND ($5::integer IS NULL OR event_version<=$5)
       ORDER BY event_version DESC,recorded_at DESC LIMIT 1`,
      [id, visiblePayload.venueName, visiblePayload.startAt, visiblePayload.endAt, visibleContentVersion ?? null]);
    if (evidence[0]) result.venueEvidence = { venueName: evidence[0].venue_name,
      sourceType: evidence[0].source_type, phase: evidence[0].phase,
      recordedAt: new Date(evidence[0].recorded_at).toISOString(),
      expiresAt: new Date(evidence[0].expires_at).toISOString() };
  }
  if (row.host_id !== actorId) delete result.inviteToken;
  if (row.host_id !== actorId) delete result.reviewReason;
  if (cohostCapabilities.length) result.cohostCapabilities = cohostCapabilities;
  result.aiSuggestionGenerated = await hasGeneratedAiSuggestion(db, id);
  return result;
}

async function replay(tx: Queryable, actor: string, route: string, key: string): Promise<EventRecord | undefined> {
  if (await claimIdempotency(tx, actor, route, key)) return undefined;
  const { rows } = await tx.query<{ result: EventRecord }>('SELECT result FROM idempotency WHERE actor_id=$1 AND route=$2 AND key=$3', [actor, route, key]);
  return rows[0]?.result;
}

async function saveReplay(tx: Queryable, actor: string, route: string, key: string, result: EventRecord): Promise<void> {
  await tx.query('UPDATE idempotency SET result=$4 WHERE actor_id=$1 AND route=$2 AND key=$3', [actor, route, key, JSON.stringify(result)]);
}

export async function createDraft(db: Database, actorId: string, input: EventInput, key: string, isTest = true): Promise<EventRecord> {
  if (!actorId || !key) throw new AppError('BAD_REQUEST', '身份与幂等键必填');
  validateDraftFields(input);
  return db.transaction(async (tx) => {
    const old = await replay(tx, actorId, 'create-draft', key);
    if (old) return old;
    await assertNewActionsOpen(tx);
    const id = randomUUID();
    const { isTest: _ignored, ...payload } = input as EventInput & { isTest?: unknown };
    const { rows } = await tx.query<EventRow>('INSERT INTO events(id,host_id,status,version,payload,is_test) VALUES($1,$2,$3,1,$4,$5) RETURNING *',
      [id, actorId, 'DRAFT', JSON.stringify(payload), isTest]);
    const result = rowToEvent(rows[0]!);
    await saveReplay(tx, actorId, 'create-draft', key, result);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action) VALUES($1,$2,$3,$4)', [randomUUID(), actorId, id, 'CREATE_DRAFT']);
    return result;
  });
}

export async function updateDraft(db: Database, actorId: string, id: string, expectedVersion: number, patch: EventInput, key: string): Promise<EventRecord> {
  return db.transaction(tx => updateDraftInTransaction(tx, actorId, id, expectedVersion, patch, key));
}

export async function updateDraftInTransaction(tx: Queryable, actorId: string, id: string, expectedVersion: number,
  patch: EventInput, key: string): Promise<EventRecord> {
  if (!key || !patch || typeof patch !== 'object' || Array.isArray(patch)) throw new AppError('BAD_REQUEST', '草稿修改内容无效');
    const route = `update-draft:${id}`;
    const old = await replay(tx, actorId, route, key);
    if (old) return old;
    const { rows } = await tx.query<EventRow>('SELECT * FROM events WHERE id=$1 FOR UPDATE', [id]);
    const row = rows[0];
    if (!row) throw new AppError('NOT_FOUND', '草稿不存在', 404);
    if (row.host_id !== actorId) throw new AppError('FORBIDDEN', '只有主办方可修改草稿', 403);
    if (row.version !== expectedVersion) throw new AppError('VERSION_CONFLICT', '草稿已更新，请刷新', 409);
    if (row.status !== 'DRAFT') throw new AppError('INVALID_STATE', '仅草稿可修改');
    const nextPayload = { ...row.payload, ...patch };
    validateDraftFields(nextPayload);
    const { rows: updated } = await tx.query<EventRow>('UPDATE events SET payload=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *', [id, JSON.stringify(nextPayload)]);
    const result = rowToEvent(updated[0]!);
    await saveReplay(tx, actorId, route, key, result);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action) VALUES($1,$2,$3,$4)', [randomUUID(), actorId, id, 'UPDATE_DRAFT']);
    return result;
}

export async function publishEvent(db: Database, actorId: string, id: string, expectedVersion: number, key: string): Promise<EventRecord> {
  return db.transaction(tx => publishEventInTransaction(tx, actorId, id, expectedVersion, key));
}

export async function publishEventInTransaction(tx: Queryable, actorId: string, id: string, expectedVersion: number,
  key: string): Promise<EventRecord> {
  if (!key) throw new AppError('BAD_REQUEST', '幂等键必填');
    const route = `publish:${id}`;
    const old = await replay(tx, actorId, route, key);
    if (old) return old;
    const { rows } = await tx.query<EventRow>('SELECT * FROM events WHERE id=$1 FOR UPDATE', [id]);
    const row = rows[0];
    if (!row) throw new AppError('NOT_FOUND', '活动不存在', 404);
    if (row.host_id !== actorId) throw new AppError('FORBIDDEN', '只有主办方可发布', 403);
    if (row.version !== expectedVersion) throw new AppError('VERSION_CONFLICT', '活动已更新，请刷新', 409);
    if (row.status !== 'DRAFT') throw new AppError('INVALID_STATE', '仅草稿可发布');
    validatePublish(row.payload);
    if (!row.is_test) await assertHostCanPublish(tx, actorId, row.payload.maxParticipants!);
    await assertPublicRecruitmentOpen(tx, row.payload.visibility, row.payload);
    if (Date.parse(row.payload.confirmationDeadline!) <= await databaseNow(tx))
      throw new AppError('INVALID_EVENT', '成局确认截止时间已过');
    const token = randomBytes(24).toString('base64url');
    const { rows: updated } = await tx.query<EventRow>(`UPDATE events SET status='RECRUITING',recruiting=false,
      review_status='PENDING',resume_recruiting_after_review=true,review_reason=NULL,version=version+1,
      invite_token=$2,invite_expires_at=$3,payload=payload-'templateDurationMinutes',updated_at=now() WHERE id=$1
        AND (payload->>'confirmationDeadline')::timestamptz>clock_timestamp() RETURNING *`,
      [id, token, row.payload.registrationDeadline]);
    if (!updated[0]) throw new AppError('INVALID_EVENT', '成局确认截止时间已过');
    const result = rowToEvent(updated[0]!);
    await tx.query('INSERT INTO event_versions(event_id,version,payload) VALUES($1,$2,$3)', [id, result.version, JSON.stringify(result.payload)]);
    await tx.query(`INSERT INTO venue_evidence(event_id,event_version,venue_name,source_type,phase,recorded_by,expires_at,activity_end_at)
      VALUES($1,$2,$3,'HOST_STATEMENT','PUBLISH',$4,$5,$6)`,
      [id, result.version, result.payload.venueName, actorId, result.payload.startAt, result.payload.endAt]);
    await tx.query('INSERT INTO jobs(id,kind,event_id,due_at,payload) VALUES($1,$2,$3,$4,$5)', [randomUUID(), 'FORMATION_DEADLINE', id, result.payload.confirmationDeadline, JSON.stringify({ version: result.version })]);
    await tx.query('INSERT INTO jobs(id,kind,event_id,due_at,payload) VALUES($1,$2,$3,$4,$5)', [randomUUID(), 'REGISTRATION_DEADLINE', id, result.payload.registrationDeadline, JSON.stringify({ version: result.version })]);
    if (result.payload.hostParticipates) {
      await tx.query('INSERT INTO registrations(id,event_id,user_id,status,accepted_version) VALUES($1,$2,$3,$4,$5)', [randomUUID(), id, actorId, 'CONFIRMED', result.version]);
    }
    await saveReplay(tx, actorId, route, key, result);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action) VALUES($1,$2,$3,$4)',
      [randomUUID(), actorId, id, row.payload.visibility === 'PUBLIC' ? 'SUBMIT_PUBLIC_REVIEW' : 'SUBMIT_INVITE_REVIEW']);
    if (result.payload.hostParticipates) await tx.query('INSERT INTO audit(id,actor_id,event_id,action) VALUES($1,$2,$3,$4)',
      [randomUUID(), actorId, id, 'REGISTER_CONFIRMED']);
    return result;
}

export async function rotateInvite(db: Database, actorId: string, id: string, expectedVersion: number, key: string): Promise<EventRecord> {
  if (!key) throw new AppError('BAD_REQUEST', '幂等键必填');
  return db.transaction(async tx => {
    const route = `rotate-invite:${id}`;
    const old = await replay(tx, actorId, route, key);
    if (old) return old;
    const { rows } = await tx.query<EventRow>('SELECT * FROM events WHERE id=$1 FOR UPDATE', [id]);
    const row = rows[0];
    if (!row) throw new AppError('NOT_FOUND', '活动不存在', 404);
    if (row.host_id !== actorId) throw new AppError('FORBIDDEN', '只有主办方可以撤销邀请', 403);
    if (row.version !== expectedVersion) throw new AppError('VERSION_CONFLICT', '活动已更新，请刷新', 409);
    await assertPublicRecruitmentOpen(tx, row.payload.visibility, row.payload);
    if (row.review_status !== 'APPROVED') throw new AppError('REVIEW_PENDING', '活动内容尚未通过审核', 409);
    if (!row.recruiting || await databaseNow(tx) >= Date.parse(row.payload.registrationDeadline!))
      throw new AppError('INVALID_STATE', '邀请已停止');
    const token = randomBytes(24).toString('base64url');
    const { rows: updated } = await tx.query<EventRow>(`UPDATE events SET invite_token=$2,updated_at=now()
      WHERE id=$1 AND recruiting=true AND (payload->>'registrationDeadline')::timestamptz>clock_timestamp()
      RETURNING *`, [id, token]);
    if (!updated[0]) throw new AppError('INVALID_STATE', '邀请已停止');
    const result = rowToEvent(updated[0]!);
    await saveReplay(tx, actorId, route, key, result);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action) VALUES($1,$2,$3,$4)', [randomUUID(), actorId, id, 'ROTATE_INVITE']);
    return result;
  });
}
