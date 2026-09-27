import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { command } from './registrations.ts';
import { assertNewActionsOpen } from './emergency-gate.ts';

export interface PublicGate {
  status: 'OPEN' | 'CLOSED'; reason: string; changedBy: string; changedAt: Date; coverageId: string | null;
}
type Row = { status: 'OPEN' | 'CLOSED'; reason: string; changed_by: string; changed_at: Date;
  coverage_id: string | null; coverage_valid?: boolean };

export interface PublicCoverage {
  id: string; responsibleActor: string; startsAt: string; endsAt: string; drillReference: string;
  drillCompletedAt: string; confirmedBy: string | null; confirmedAt: string | null;
  revokedBy: string | null; revokedAt: string | null;
}
type CoverageRow = { id: string; responsible_actor: string; starts_at: Date; ends_at: Date;
  drill_reference: string; drill_completed_at: Date; confirmed_by: string | null; confirmed_at: Date | null;
  revoked_by: string | null; revoked_at: Date | null };

function coverage(row: CoverageRow): PublicCoverage {
  return { id: row.id, responsibleActor: row.responsible_actor,
    startsAt: new Date(row.starts_at).toISOString(), endsAt: new Date(row.ends_at).toISOString(),
    drillReference: row.drill_reference, drillCompletedAt: new Date(row.drill_completed_at).toISOString(),
    confirmedBy: row.confirmed_by, confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
    revokedBy: row.revoked_by, revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null };
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value));
}

export async function createPublicCoverage(db: Database, actor: string, startsAt: unknown, endsAt: unknown,
  drillReference: unknown, drillCompletedAt: unknown, key: string): Promise<PublicCoverage> {
  return command(db, actor, 'public-coverage-create', key, async tx => {
    if (!validDate(startsAt) || !validDate(endsAt) || !validDate(drillCompletedAt) ||
      typeof drillReference !== 'string' || drillReference.trim().length < 8 || drillReference.length > 200)
      throw new AppError('BAD_REQUEST', '值守时段与演练引用无效');
    const { rows: time } = await tx.query<{ at: Date }>('SELECT clock_timestamp() AS at');
    const now = new Date(time[0]!.at).getTime();
    const start = Date.parse(startsAt); const end = Date.parse(endsAt); const drill = Date.parse(drillCompletedAt);
    if (end <= now || end <= start || end - start > 24 * 60 * 60_000 || drill > now)
      throw new AppError('BAD_REQUEST', '值守须覆盖尚未结束的至多 24 小时时段，演练时间不得在未来');
    const id = randomUUID();
    const { rows } = await tx.query<CoverageRow>(`INSERT INTO public_recruitment_coverage
      (id,responsible_actor,starts_at,ends_at,drill_reference,drill_completed_at)
      VALUES($1,$2,$3::timestamptz,$4::timestamptz,$5,$6::timestamptz) RETURNING *`,
    [id, actor, startsAt, endsAt, drillReference.trim(), drillCompletedAt]);
    await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
      [randomUUID(), actor, 'PUBLIC_COVERAGE_PROPOSED', JSON.stringify({ coverageId: id, startsAt, endsAt })]);
    return coverage(rows[0]!);
  });
}

export async function confirmPublicCoverage(db: Database, actor: string, id: string, reason: unknown,
  key: string): Promise<PublicCoverage> {
  return command(db, actor, `public-coverage-confirm:${id}`, key, async tx => {
    if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500)
      throw new AppError('BAD_REQUEST', '复核原因需填写 5 至 500 字');
    const { rows: found } = await tx.query<CoverageRow>('SELECT * FROM public_recruitment_coverage WHERE id=$1 FOR UPDATE', [id]);
    const prior = found[0];
    if (!prior) throw new AppError('NOT_FOUND', '值守记录不存在', 404);
    if (prior.responsible_actor === actor)
      throw new AppError('COVERAGE_SELF_CONFIRMATION', '具名值守须由另一位安全运营复核', 409);
    if (prior.confirmed_at || prior.revoked_at) throw new AppError('INVALID_STATE', '值守记录已确认或撤销', 409);
    const { rows } = await tx.query<CoverageRow>(`UPDATE public_recruitment_coverage
      SET confirmed_by=$2,confirmed_at=clock_timestamp() WHERE id=$1
        AND ends_at>clock_timestamp() AND drill_completed_at<=clock_timestamp() RETURNING *`, [id, actor]);
    if (!rows[0]) throw new AppError('PUBLIC_COVERAGE_REQUIRED', '值守时段已结束或演练记录无效', 409);
    await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
      [randomUUID(), actor, 'PUBLIC_COVERAGE_CONFIRMED', JSON.stringify({ coverageId: id, reason: reason.trim() })]);
    return coverage(rows[0]);
  });
}

async function enqueueGateNotices(tx: Queryable, status: 'OPEN' | 'CLOSED') {
  await tx.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload,created_at)
    SELECT gen_random_uuid()::text,'PUBLIC_GATE_NOTICE',NULL,g.changed_at,
      jsonb_build_object('eventId',recipient.event_id,'eventVersion',recipient.version,
        'userId',recipient.user_id,'status',$1::text),g.changed_at
    FROM public_recruitment_gate g CROSS JOIN (
      SELECT e.id AS event_id,e.version,e.host_id AS user_id FROM events e
        WHERE e.payload->>'visibility'='PUBLIC' AND e.status IN ('RECRUITING','CONFIRMED')
          AND e.recruiting=true AND e.review_status='APPROVED'
      UNION
      SELECT e.id AS event_id,e.version,r.user_id FROM events e
        JOIN registrations r ON r.event_id=e.id
        WHERE e.payload->>'visibility'='PUBLIC' AND e.status IN ('RECRUITING','CONFIRMED')
          AND e.recruiting=true AND e.review_status='APPROVED'
          AND r.status IN ('INTERESTED','REQUESTED','WAITLISTED','OFFERED','CONFIRMED','RECONFIRM_REQUIRED')
    ) recipient WHERE g.id=1`, [status]);
}

async function enqueueEventCoverageNotices(tx: Queryable, eventIds: string[], coverageId: string) {
  if (!eventIds.length) return;
  await tx.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload,created_at)
    SELECT gen_random_uuid()::text,'PUBLIC_GATE_NOTICE',NULL,coverage.revoked_at,
      jsonb_build_object('eventId',recipient.event_id,'eventVersion',recipient.version,
        'userId',recipient.user_id,'status','CLOSED'),coverage.revoked_at
    FROM public_recruitment_coverage coverage CROSS JOIN (
      SELECT e.id AS event_id,e.version,e.host_id AS user_id FROM events e
        WHERE e.id=ANY($1::text[]) AND e.status IN ('RECRUITING','CONFIRMED')
          AND e.recruiting=true AND e.review_status='APPROVED'
      UNION
      SELECT e.id AS event_id,e.version,r.user_id FROM events e
        JOIN registrations r ON r.event_id=e.id
        WHERE e.id=ANY($1::text[]) AND e.status IN ('RECRUITING','CONFIRMED')
          AND e.recruiting=true AND e.review_status='APPROVED'
          AND r.status IN ('INTERESTED','REQUESTED','WAITLISTED','OFFERED','CONFIRMED','RECONFIRM_REQUIRED')
    ) recipient WHERE coverage.id=$2`, [eventIds, coverageId]);
}

export async function revokePublicCoverage(db: Database, actor: string, id: string, reason: unknown,
  key: string): Promise<PublicCoverage> {
  return command(db, actor, `public-coverage-revoke:${id}`, key, async tx => {
    if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500)
      throw new AppError('BAD_REQUEST', '撤销原因需填写 5 至 500 字');
    const { rows: gate } = await tx.query<Row>('SELECT * FROM public_recruitment_gate WHERE id=1 FOR UPDATE');
    const { rows: found } = await tx.query<CoverageRow>('SELECT * FROM public_recruitment_coverage WHERE id=$1 FOR UPDATE', [id]);
    if (!found[0]) throw new AppError('NOT_FOUND', '值守记录不存在', 404);
    if (found[0].revoked_at) throw new AppError('INVALID_STATE', '值守记录已撤销', 409);
    const eventCoverage = gate[0]?.status === 'OPEN' && gate[0].coverage_id !== id
      ? await tx.query<{ id: string }>(`SELECT e.id FROM events e
        JOIN public_recruitment_coverage shift ON shift.id=$1
        WHERE e.payload->>'visibility'='PUBLIC' AND e.status IN ('RECRUITING','CONFIRMED')
          AND e.recruiting=true AND e.review_status='APPROVED'
          AND shift.starts_at<=(e.payload->>'startAt')::timestamptz
          AND shift.ends_at>=(e.payload->>'endAt')::timestamptz
          AND public_recruitment_covered((e.payload->>'startAt')::timestamptz,
            (e.payload->>'endAt')::timestamptz)`, [id])
      : { rows: [] as Array<{ id: string }> };
    const { rows } = await tx.query<CoverageRow>(`UPDATE public_recruitment_coverage
      SET revoked_by=$2,revoked_at=clock_timestamp(),revocation_reason=$3 WHERE id=$1 RETURNING *`,
      [id, actor, reason.trim()]);
    await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
      [randomUUID(), actor, 'PUBLIC_COVERAGE_REVOKED', JSON.stringify({ coverageId: id, reason: reason.trim() })]);
    if (gate[0]?.status === 'OPEN' && gate[0].coverage_id === id) {
      await tx.query(`UPDATE public_recruitment_gate SET status='CLOSED',coverage_id=NULL,
        reason='值守覆盖已撤销，公开招募暂停',changed_by=$1,
        changed_at=GREATEST(clock_timestamp(),changed_at + interval '1 microsecond') WHERE id=1`, [actor]);
      await tx.query(`INSERT INTO audit(id,actor_id,action,detail,created_at)
        SELECT $1,$2,'PUBLIC_RECRUITMENT_CLOSED',$3,changed_at FROM public_recruitment_gate WHERE id=1`,
        [randomUUID(), actor, JSON.stringify({ previous: 'OPEN', status: 'CLOSED', coverageId: id,
          reason: 'COVERAGE_REVOKED' })]);
      await enqueueGateNotices(tx, 'CLOSED');
    } else if (eventCoverage.rows.length) {
      const { rows: paused } = await tx.query<{ id: string }>(`SELECT e.id FROM events e
        WHERE e.id=ANY($1::text[]) AND NOT public_recruitment_covered(
          (e.payload->>'startAt')::timestamptz,(e.payload->>'endAt')::timestamptz)`,
      [eventCoverage.rows.map(event => event.id)]);
      if (paused.length) {
        const eventIds = paused.map(event => event.id);
        await enqueueEventCoverageNotices(tx, eventIds, id);
        await tx.query(`INSERT INTO audit(id,actor_id,event_id,action,detail,created_at)
          SELECT gen_random_uuid()::text,$2,e.id,'PUBLIC_COVERAGE_EVENT_PAUSED',
            jsonb_build_object('coverageId',$3::text),coverage.revoked_at
          FROM events e JOIN public_recruitment_coverage coverage ON coverage.id=$3
          WHERE e.id=ANY($1::text[])`, [eventIds, actor, id]);
      }
    }
    return coverage(rows[0]!);
  });
}

export async function expirePublicCoverage(db: Database, coverageId: string): Promise<void> {
  if (typeof coverageId !== 'string' || !/^[a-f0-9-]{36}$/.test(coverageId))
    throw new AppError('MALFORMED_JOB', '公开值守到期任务缺少记录 ID');
  await db.transaction(async tx => {
    const { rows: gate } = await tx.query<Row>('SELECT * FROM public_recruitment_gate WHERE id=1 FOR UPDATE');
    if (!gate[0]) throw new AppError('PUBLIC_RECRUITMENT_PAUSED', '公开活动招募状态不可用', 503);
    if (gate[0].status !== 'OPEN' || gate[0].coverage_id !== coverageId) return;
    const { rows: expired } = await tx.query<{ id: string }>(`SELECT id FROM public_recruitment_coverage
      WHERE id=$1 AND ends_at<=clock_timestamp()`, [coverageId]);
    if (!expired.length) return;
    await tx.query(`UPDATE public_recruitment_gate SET status='CLOSED',coverage_id=NULL,
      reason='当前具名值守已到期，公开招募暂停',changed_by='system:coverage-expiry',
      changed_at=GREATEST(clock_timestamp(),changed_at + interval '1 microsecond') WHERE id=1`);
    await tx.query(`INSERT INTO audit(id,actor_id,action,detail,created_at)
      SELECT $1,'system:coverage-expiry','PUBLIC_RECRUITMENT_CLOSED',$2,changed_at
      FROM public_recruitment_gate WHERE id=1`, [randomUUID(),
      JSON.stringify({ previous: 'OPEN', status: 'CLOSED', coverageId, reason: 'COVERAGE_EXPIRED' })]);
    await enqueueGateNotices(tx, 'CLOSED');
  });
}

function convert(row: Row): PublicGate {
  return { status: row.status === 'OPEN' && row.coverage_valid ? 'OPEN' : 'CLOSED',
    reason: row.status === 'OPEN' && !row.coverage_valid ? '值守覆盖已失效，公开招募已暂停' : row.reason,
    changedBy: row.changed_by, changedAt: row.changed_at, coverageId: row.coverage_id };
}

export async function getPublicGate(db: Queryable): Promise<PublicGate> {
  const { rows } = await db.query<Row>(`SELECT g.status,g.reason,g.changed_by,g.changed_at,g.coverage_id,
    (c.id IS NOT NULL AND c.confirmed_at IS NOT NULL AND c.revoked_at IS NULL
      AND c.starts_at<=clock_timestamp() AND c.ends_at>clock_timestamp()
      AND c.drill_completed_at<=c.confirmed_at) AS coverage_valid
    FROM public_recruitment_gate g LEFT JOIN public_recruitment_coverage c ON c.id=g.coverage_id WHERE g.id=1`);
  if (!rows[0]) throw new AppError('PUBLIC_RECRUITMENT_PAUSED', '公开活动招募状态不可用', 503);
  return convert(rows[0]);
}

type ActivityWindow = { startAt?: unknown; endAt?: unknown };

async function publicAccess(tx: Queryable, activity: ActivityWindow | undefined, lock: boolean) {
  const start = validDate(activity?.startAt) ? activity.startAt : null;
  const end = validDate(activity?.endAt) ? activity.endAt : null;
  const { rows } = await tx.query<{ status: string; covered: boolean }>(`SELECT g.status,
    public_recruitment_covered($1::timestamptz,$2::timestamptz) AS covered
    FROM public_recruitment_gate g
    WHERE g.id=1${lock ? ' FOR SHARE OF g' : ''}`, [start, end]);
  return rows[0];
}

export async function assertPublicRecruitmentOpen(tx: Queryable, visibility: string | undefined,
  activity?: ActivityWindow): Promise<void> {
  await assertNewActionsOpen(tx);
  if (visibility !== 'PUBLIC') return;
  const state = await publicAccess(tx, activity, true);
  if (state?.status !== 'OPEN') throw new AppError('PUBLIC_RECRUITMENT_PAUSED', '公开活动招募已暂停，仍可查看和退出', 409);
  if (!state.covered) throw new AppError('PUBLIC_COVERAGE_REQUIRED', '活动时段缺少已确认的具名值守和应急演练，公开招募已暂停', 409);
}

export async function publicRecruitmentOpen(db: Queryable, lock = false, activity?: ActivityWindow): Promise<boolean> {
  const state = await publicAccess(db, activity, lock);
  return state?.status === 'OPEN' && state.covered === true;
}

export async function setPublicGate(db: Database, actor: string, status: string, reason: string, key: string,
  coverageId?: string): Promise<PublicGate> {
  return command(db, actor, 'public-recruitment-gate', key, async tx => {
    if (!['OPEN', 'CLOSED'].includes(status) || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500)
      throw new AppError('BAD_REQUEST', '状态和原因需完整填写（原因 5 至 500 字）');
    const { rows: current } = await tx.query<Row>('SELECT * FROM public_recruitment_gate WHERE id=1 FOR UPDATE');
    if (!current[0]) throw new AppError('PUBLIC_RECRUITMENT_PAUSED', '公开活动招募状态不可用', 503);
    if (status === 'OPEN') {
      if (!coverageId) throw new AppError('PUBLIC_COVERAGE_REQUIRED', '缺少已确认的具名值守和应急演练记录，公开招募保持关闭', 409);
      const { rows: valid } = await tx.query<{ id: string }>(`SELECT id FROM public_recruitment_coverage WHERE id=$1
        AND confirmed_at IS NOT NULL AND revoked_at IS NULL AND drill_completed_at<=confirmed_at
        AND starts_at<=clock_timestamp() AND ends_at>clock_timestamp() FOR SHARE`, [coverageId]);
      if (!valid.length) throw new AppError('PUBLIC_COVERAGE_REQUIRED', '具名值守或应急演练尚未确认，公开招募保持关闭', 409);
    }
    if (current[0].status === status && (status === 'CLOSED' || current[0].coverage_id === coverageId))
      throw new AppError('INVALID_STATE', '公开活动招募已处于该状态', 409);
    const { rows } = await tx.query<Row>(`UPDATE public_recruitment_gate SET status=$1,reason=$2,changed_by=$3,coverage_id=$4,
      changed_at=GREATEST(clock_timestamp(),changed_at + interval '1 microsecond') WHERE id=1 RETURNING *`,
      [status, reason.trim(), actor, status === 'OPEN' ? coverageId : null]);
    await tx.query(`INSERT INTO audit(id,actor_id,action,detail,created_at)
      SELECT $1,$2,$3,$4,changed_at FROM public_recruitment_gate WHERE id=1`,
      [randomUUID(), actor, `PUBLIC_RECRUITMENT_${status}`, JSON.stringify({ previous: current[0].status, status,
        reason: reason.trim(), coverageId: status === 'OPEN' ? coverageId : null })]);
    await enqueueGateNotices(tx, status as 'OPEN' | 'CLOSED');
    if (status === 'OPEN') await tx.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload)
      SELECT gen_random_uuid()::text,'PUBLIC_COVERAGE_EXPIRE',NULL,ends_at,
        jsonb_build_object('coverageId',id) FROM public_recruitment_coverage WHERE id=$1`, [coverageId]);
    return { ...convert({ ...rows[0]!, coverage_valid: status === 'OPEN' }), coverageId: status === 'OPEN' ? coverageId! : null };
  });
}
