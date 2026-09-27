import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { command } from './registrations.ts';
import { assertNewActionsOpen } from './emergency-gate.ts';

export interface PublicGate {
  status: 'OPEN' | 'CLOSED'; reason: string; changedBy: string; changedAt: Date;
}
type Row = { status: 'OPEN' | 'CLOSED'; reason: string; changed_by: string; changed_at: Date };

function convert(row: Row): PublicGate {
  return { status: row.status, reason: row.reason, changedBy: row.changed_by, changedAt: row.changed_at };
}

export async function getPublicGate(db: Queryable): Promise<PublicGate> {
  const { rows } = await db.query<Row>('SELECT status,reason,changed_by,changed_at FROM public_recruitment_gate WHERE id=1');
  if (!rows[0]) throw new AppError('PUBLIC_RECRUITMENT_PAUSED', '公开活动招募状态不可用', 503);
  return convert(rows[0]);
}

export async function assertPublicRecruitmentOpen(tx: Queryable, visibility: string | undefined): Promise<void> {
  await assertNewActionsOpen(tx);
  if (visibility !== 'PUBLIC') return;
  const { rows } = await tx.query<{ status: string }>('SELECT status FROM public_recruitment_gate WHERE id=1 FOR SHARE');
  if (rows[0]?.status !== 'OPEN') throw new AppError('PUBLIC_RECRUITMENT_PAUSED', '公开活动招募已暂停，仍可查看和退出', 409);
}

export async function publicRecruitmentOpen(db: Queryable, lock = false): Promise<boolean> {
  const { rows } = await db.query<{ status: string }>(`SELECT status FROM public_recruitment_gate WHERE id=1${lock ? ' FOR SHARE' : ''}`);
  return rows[0]?.status === 'OPEN';
}

export async function setPublicGate(db: Database, actor: string, status: string, reason: string, key: string): Promise<PublicGate> {
  return command(db, actor, 'public-recruitment-gate', key, async tx => {
    if (!['OPEN', 'CLOSED'].includes(status) || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500)
      throw new AppError('BAD_REQUEST', '状态和原因需完整填写（原因 5 至 500 字）');
    const { rows: current } = await tx.query<Row>('SELECT * FROM public_recruitment_gate WHERE id=1 FOR UPDATE');
    if (!current[0]) throw new AppError('PUBLIC_RECRUITMENT_PAUSED', '公开活动招募状态不可用', 503);
    if (current[0].status === status) throw new AppError('INVALID_STATE', '公开活动招募已处于该状态', 409);
    const { rows } = await tx.query<Row>(`UPDATE public_recruitment_gate SET status=$1,reason=$2,changed_by=$3,
      changed_at=GREATEST(clock_timestamp(),changed_at + interval '1 microsecond') WHERE id=1 RETURNING *`,
      [status, reason.trim(), actor]);
    await tx.query(`INSERT INTO audit(id,actor_id,action,detail,created_at)
      SELECT $1,$2,$3,$4,changed_at FROM public_recruitment_gate WHERE id=1`,
      [randomUUID(), actor, `PUBLIC_RECRUITMENT_${status}`, JSON.stringify({ previous: current[0].status, status, reason: reason.trim() })]);
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
    return convert(rows[0]!);
  });
}
