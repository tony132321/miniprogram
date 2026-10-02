import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { command } from './registrations.ts';

function boundedSetting(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  return value;
}

/** Provisional R1 values; deployment can set these after a recorded product decision. */
export function newHostLimits() {
  return {
    publications: boundedSetting('NEW_HOST_PUBLICATIONS_PER_WINDOW', 1, 1, 10),
    windowDays: boundedSetting('NEW_HOST_WINDOW_DAYS', 7, 1, 90),
    participants: boundedSetting('NEW_HOST_MAX_PARTICIPANTS', 6, 4, 12)
  };
}

export async function assertHostCanPublish(tx: Queryable, hostId: string, maxParticipants: number): Promise<void> {
  const limits = newHostLimits();
  await tx.query("INSERT INTO host_publication_status(host_id) VALUES($1) ON CONFLICT(host_id) DO NOTHING", [hostId]);
  const { rows: statuses } = await tx.query<{ status: 'NEW' | 'ESTABLISHED' }>(
    'SELECT status FROM host_publication_status WHERE host_id=$1 FOR UPDATE', [hostId]);
  if (statuses[0]?.status === 'ESTABLISHED') return;
  if (maxParticipants > limits.participants)
    throw new AppError('NEW_HOST_PARTICIPANT_LIMIT', `新主办方单场人数上限为 ${limits.participants} 人`, 409);
  const { rows } = await tx.query<{ count: number }>(`SELECT count(*)::int AS count FROM events e
    WHERE e.host_id=$1 AND e.is_test=false AND e.status<>'DRAFT' AND
      COALESCE((SELECT min(a.created_at) FROM audit a WHERE a.event_id=e.id
        AND a.action IN ('PUBLISH','SUBMIT_PUBLIC_REVIEW','SUBMIT_INVITE_REVIEW')),
        e.updated_at)>=clock_timestamp()-($2::integer * interval '1 day')`, [hostId, limits.windowDays]);
  if (rows[0]!.count >= limits.publications)
    throw new AppError('NEW_HOST_FREQUENCY_LIMIT', `新主办方每 ${limits.windowDays} 天最多发起 ${limits.publications} 场活动`, 429);
}

export async function assertHostParticipantCap(tx: Queryable, eventId: string, hostId: string,
  maxParticipants: number, lockStatus = false): Promise<void> {
  const { rows: events } = await tx.query<{ is_test: boolean }>('SELECT is_test FROM events WHERE id=$1', [eventId]);
  if (!events[0] || events[0].is_test) return;
  if (lockStatus) await tx.query('INSERT INTO host_publication_status(host_id) VALUES($1) ON CONFLICT(host_id) DO NOTHING', [hostId]);
  const { rows: statuses } = await tx.query<{ status: string }>(
    `SELECT status FROM host_publication_status WHERE host_id=$1 ${lockStatus ? 'FOR UPDATE' : ''}`, [hostId]);
  if (statuses[0]?.status === 'ESTABLISHED') return;
  const limit = newHostLimits().participants;
  if (maxParticipants > limit)
    throw new AppError('NEW_HOST_PARTICIPANT_LIMIT', `新主办方单场人数上限为 ${limit} 人`, 409);
}

export async function reviewHostStatus(db: Database, actor: string, hostId: string,
  status: 'NEW' | 'ESTABLISHED', reason: string, key: string) {
  if (!actor.startsWith('operator:')) throw new AppError('FORBIDDEN', '仅安全运营人员可审核主办方级别', 403);
  if (typeof hostId !== 'string' || !hostId.trim() || !['NEW', 'ESTABLISHED'].includes(status) ||
      typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500)
    throw new AppError('BAD_REQUEST', '主办方审核资料无效');
  return command(db, actor, `host-status:${hostId}`, key, async tx => {
    const { rows: users } = await tx.query<{ id: string }>(
      'SELECT id FROM users WHERE id=$1 FOR UPDATE', [hostId]);
    if (!users[0]) throw new AppError('NOT_FOUND', '主办方不存在', 404);
    await tx.query('INSERT INTO host_publication_status(host_id) VALUES($1) ON CONFLICT(host_id) DO NOTHING', [hostId]);
    const { rows } = await tx.query<{ host_id: string; status: string; reviewed_by: string; reviewed_at: Date; reason: string }>(
      `UPDATE host_publication_status SET status=$2,reviewed_by=$3,reviewed_at=clock_timestamp(),reason=$4
       WHERE host_id=$1 RETURNING *`, [hostId, status, actor, reason.trim()]);
    await tx.query(`INSERT INTO audit(id,actor_id,action,detail)
      VALUES($1,$2,'HOST_STATUS_REVIEW',$3::jsonb)`,
    [randomUUID(), actor, JSON.stringify({ hostId, status, reason: reason.trim() })]);
    const row = rows[0]!;
    return { hostId: row.host_id, status: row.status, reviewedBy: row.reviewed_by,
      reviewedAt: new Date(row.reviewed_at).toISOString(), reason: row.reason };
  });
}
