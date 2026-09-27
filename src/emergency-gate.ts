import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { command } from './registrations.ts';

export interface EmergencyGate {
  status: 'OPEN' | 'CLOSED'; reason: string; changedBy: string; changedAt: Date;
}
type Row = { status: 'OPEN' | 'CLOSED'; reason: string; changed_by: string; changed_at: Date };

function convert(row: Row): EmergencyGate {
  return { status: row.status, reason: row.reason, changedBy: row.changed_by, changedAt: row.changed_at };
}

export async function getEmergencyGate(db: Queryable): Promise<EmergencyGate> {
  const { rows } = await db.query<Row>('SELECT status,reason,changed_by,changed_at FROM emergency_gate WHERE id=1');
  if (!rows[0]) throw new AppError('EMERGENCY_PAUSED', '全局安全开关不可用', 503);
  return convert(rows[0]);
}

export async function newActionsOpen(tx: Queryable, lock = false): Promise<boolean> {
  const { rows } = await tx.query<{ status: string }>(`SELECT status FROM emergency_gate WHERE id=1${lock ? ' FOR SHARE' : ''}`);
  return rows[0]?.status === 'OPEN';
}

export async function assertNewActionsOpen(tx: Queryable): Promise<void> {
  if (!(await newActionsOpen(tx, true))) throw new AppError('EMERGENCY_PAUSED', '新增活动和报名已暂停，仍可查看、退出和举报', 409);
}

export async function setEmergencyGate(db: Database, actor: string, status: string, reason: string, key: string): Promise<EmergencyGate> {
  return command(db, actor, 'emergency-gate', key, async tx => {
    if (!['OPEN', 'CLOSED'].includes(status) || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500)
      throw new AppError('BAD_REQUEST', '状态和原因需完整填写（原因 5 至 500 字）');
    const { rows: current } = await tx.query<Row>('SELECT * FROM emergency_gate WHERE id=1 FOR UPDATE');
    if (!current[0]) throw new AppError('EMERGENCY_PAUSED', '全局安全开关不可用', 503);
    if (current[0].status === status) throw new AppError('INVALID_STATE', '全局安全开关已处于该状态', 409);
    const { rows } = await tx.query<Row>(`UPDATE emergency_gate SET status=$1,reason=$2,changed_by=$3,
      changed_at=GREATEST(clock_timestamp(),changed_at + interval '1 microsecond') WHERE id=1 RETURNING *`,
      [status, reason.trim(), actor]);
    await tx.query(`INSERT INTO audit(id,actor_id,action,detail,created_at)
      SELECT $1,$2,$3,$4,changed_at FROM emergency_gate WHERE id=1`,
      [randomUUID(), actor, `EMERGENCY_${status}`, JSON.stringify({ previous: current[0].status, status, reason: reason.trim() })]);
    if (status === 'OPEN') await tx.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload,created_at)
      SELECT gen_random_uuid()::text,'RESUME_WAITLIST',e.id,g.changed_at,
        jsonb_build_object('eventVersion',e.version),g.changed_at
      FROM emergency_gate g JOIN events e ON e.recruiting=true AND e.status IN ('RECRUITING','CONFIRMED')
      WHERE g.id=1 AND EXISTS (SELECT 1 FROM registrations r WHERE r.event_id=e.id AND r.status='WAITLISTED')`);
    return convert(rows[0]!);
  });
}
