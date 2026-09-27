import { randomUUID } from 'node:crypto';
import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { command } from './registrations.ts';

type FailedJobRow = { id: string; kind: string; event_id: string | null; due_at: Date; attempts: number;
  last_error_code: string | null; created_at: Date };

export async function listFailedJobs(db: Database, offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', '失败任务列表页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取失败任务需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(id,kind,due_at,attempts,last_error_code)::text,',' ORDER BY id),'')) AS snapshot
      FROM jobs WHERE status='FAILED'`);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', '失败任务列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query<FailedJobRow>(`SELECT id,kind,event_id,due_at,attempts,last_error_code,created_at
      FROM jobs WHERE status='FAILED' ORDER BY due_at,id LIMIT 100 OFFSET $1`, [offset]);
    const total = totals[0]!.total;
    return { items: rows.map(row => ({ id: row.id, kind: row.kind, eventId: row.event_id, dueAt: row.due_at,
      attempts: row.attempts, errorCode: row.last_error_code, createdAt: row.created_at })), total,
      nextOffset: offset + rows.length < total ? offset + rows.length : null, snapshot: currentSnapshot };
  });
}

export async function retryFailedJob(db: Database, actor: string, jobId: string, key: string) {
  if (!jobId) throw new AppError('BAD_REQUEST', '任务 ID 必填');
  return command(db, actor, `retry-job:${jobId}`, key, async tx => {
    const { rows } = await tx.query<{ kind: string; event_id: string | null; payload: { notificationId?: string };
      status: string; attempts: number; last_error_code: string | null }>(
      'SELECT kind,event_id,payload,status,attempts,last_error_code FROM jobs WHERE id=$1 FOR UPDATE', [jobId]);
    const job = rows[0];
    if (!job) throw new AppError('NOT_FOUND', '任务不存在', 404);
    if (job.status !== 'FAILED') throw new AppError('INVALID_STATE', '任务当前不是失败状态', 409);
    if (job.kind === 'SEND_EXTERNAL') {
      if (!job.payload || typeof job.payload !== 'object' || Array.isArray(job.payload) ||
        typeof job.payload.notificationId !== 'string' || !job.payload.notificationId)
        throw new AppError('MALFORMED_JOB', '外部通知任务参数无效', 409);
      const { rows: notices } = await tx.query<{ external_status: string }>(
        'SELECT external_status FROM notifications WHERE id=$1 FOR UPDATE', [job.payload.notificationId]);
      if (notices[0]?.external_status !== 'NOT_REQUESTED')
        throw new AppError('RECONCILIATION_REQUIRED', '外部通知状态需先人工核对', 409);
    }
    await tx.query("UPDATE jobs SET status='PENDING',attempts=0,due_at=now(),locked_at=NULL,claim_token=NULL,last_error_code=NULL WHERE id=$1", [jobId]);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action,detail) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), actor, job.event_id, 'RETRY_JOB', JSON.stringify({ jobId, kind: job.kind,
        previousAttempts: job.attempts, previousErrorCode: job.last_error_code })]);
    return { jobId, status: 'PENDING' as const };
  });
}
