import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { command } from './registrations.ts';

interface SignalRow extends Record<string, unknown> {
  user_id: string;
  event_id: string;
  registrations: number;
  cancellations: number;
  last_signal_at: Date;
}

const SIGNAL_QUERY = `WITH reviewed AS (
    SELECT event_id,detail->>'userId' AS user_id,max(created_at) AS reviewed_at
    FROM audit WHERE action='REVIEW_REGISTRATION_ANOMALY' AND created_at>=now()-interval '24 hours'
    GROUP BY event_id,detail->>'userId'
  )
  SELECT a.actor_id AS user_id,a.event_id,
    count(*) FILTER (WHERE a.action IN ('REGISTER_CONFIRMED','REGISTER_WAITLISTED','REGISTER_REQUESTED'))::int AS registrations,
    count(*) FILTER (WHERE a.action='CANCEL_REGISTRATION')::int AS cancellations,
    max(a.created_at) AS last_signal_at
  FROM audit a LEFT JOIN reviewed r ON r.user_id=a.actor_id AND r.event_id=a.event_id
  WHERE a.created_at>=now()-interval '24 hours' AND a.event_id IS NOT NULL
    AND (r.reviewed_at IS NULL OR a.created_at>r.reviewed_at)
    AND a.action IN ('REGISTER_CONFIRMED','REGISTER_WAITLISTED','REGISTER_REQUESTED','CANCEL_REGISTRATION')
    AND ($1::text IS NULL OR a.actor_id=$1) AND ($2::text IS NULL OR a.event_id=$2)
  GROUP BY a.actor_id,a.event_id
  HAVING count(*) FILTER (WHERE a.action IN ('REGISTER_CONFIRMED','REGISTER_WAITLISTED','REGISTER_REQUESTED'))>=3
    AND count(*) FILTER (WHERE a.action='CANCEL_REGISTRATION')>=2`;

function convert(row: SignalRow) {
  return { userId: row.user_id, eventId: row.event_id, registrations: row.registrations,
    cancellations: row.cancellations, lastSignalAt: new Date(row.last_signal_at).toISOString() };
}

async function pendingSignal(db: Queryable, userId: string, eventId: string) {
  const { rows } = await db.query<SignalRow>(`${SIGNAL_QUERY} LIMIT 1`, [userId, eventId]);
  return rows[0] ? convert(rows[0]) : null;
}

export async function listRegistrationAnomalies(db: Database, offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647 ||
    (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot))))
    throw new AppError('BAD_REQUEST', '异常报名队列页码无效');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const totals = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(coalesce(string_agg(jsonb_build_array(user_id,event_id,registrations,cancellations,last_signal_at)::text,
        ',' ORDER BY user_id,event_id),'')) AS snapshot FROM (${SIGNAL_QUERY}) signals`, [null, null]);
    const total = totals.rows[0]!.total;
    const currentSnapshot = totals.rows[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', '异常报名队列已变化，请从第一页刷新', 409);
    const { rows } = await tx.query<SignalRow>(`${SIGNAL_QUERY} ORDER BY last_signal_at DESC,event_id,user_id LIMIT 100 OFFSET $3`,
      [null, null, offset]);
    return { items: rows.map(convert), total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
      snapshot: currentSnapshot };
  });
}

export async function getRegistrationAnomalyEvidence(db: Database, userId: string, eventId: string) {
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const signal = await pendingSignal(tx, userId, eventId);
    if (!signal) throw new AppError('NOT_FOUND', '待复核线索不存在', 404);
    const { rows: actions } = await tx.query<{ action: string; created_at: Date }>(`SELECT action,created_at FROM audit
      WHERE actor_id=$1 AND event_id=$2 AND created_at>=now()-interval '24 hours'
        AND created_at>coalesce((SELECT max(created_at) FROM audit WHERE action='REVIEW_REGISTRATION_ANOMALY'
          AND event_id=$2 AND detail->>'userId'=$1),'-infinity'::timestamptz)
        AND action IN ('REGISTER_CONFIRMED','REGISTER_WAITLISTED','REGISTER_REQUESTED','REGISTER_INTERESTED','CANCEL_REGISTRATION')
      ORDER BY created_at DESC,id DESC LIMIT 101`, [userId, eventId]);
    const { rows: registrations } = await tx.query<{ status: string }>(
      'SELECT status FROM registrations WHERE user_id=$1 AND event_id=$2', [userId, eventId]);
    return { ...signal, registrationStatus: registrations[0]?.status ?? null,
      actions: actions.slice(0, 100).map(row => ({ action: row.action, at: new Date(row.created_at).toISOString() })),
      truncated: actions.length > 100 };
  });
}

export async function reviewRegistrationAnomaly(db: Database, actor: string, input: {
  userId?: string; eventId?: string; lastSignalAt?: string; disposition?: string; note?: string;
}, key: string) {
  return command(db, actor, 'registration-anomaly-review', key, async tx => {
    if (typeof input.userId !== 'string' || !input.userId || input.userId.length > 160 ||
      typeof input.eventId !== 'string' || !input.eventId || input.eventId.length > 160 ||
      typeof input.lastSignalAt !== 'string' || !Number.isFinite(Date.parse(input.lastSignalAt)) ||
      !['MONITOR','FALSE_POSITIVE','ESCALATE'].includes(input.disposition ?? '') ||
      typeof input.note !== 'string' || input.note.trim().length < 5 || input.note.length > 1000)
      throw new AppError('BAD_REQUEST', '异常报名复核参数无效');
    const event = await tx.query<{ id: string }>('SELECT id FROM events WHERE id=$1 FOR UPDATE', [input.eventId]);
    if (!event.rows[0]) throw new AppError('NOT_FOUND', '活动不存在', 404);
    const signal = await pendingSignal(tx, input.userId, input.eventId);
    if (!signal || signal.lastSignalAt !== new Date(input.lastSignalAt).toISOString())
      throw new AppError('VERSION_CONFLICT', '异常报名线索已变化，请刷新后复核', 409);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action,detail) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), actor, input.eventId, 'REVIEW_REGISTRATION_ANOMALY', JSON.stringify({
        userId: input.userId, disposition: input.disposition, note: input.note.trim(),
        registrations: signal.registrations, cancellations: signal.cancellations, lastSignalAt: signal.lastSignalAt
      })]);
    return { reviewed: true };
  });
}
