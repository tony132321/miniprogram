import { randomUUID } from 'node:crypto';
import type { Database } from './db.ts';
import { audit, databaseNow, promote, type EventRow } from './registrations.ts';
import { expireOffers, expireReservations } from './registrations.ts';
import { dispatchNotification, enqueueInAppOutcomePrompt, enqueueNotification, enqueueStartReminder, type NotificationAdapter } from './notifications.ts';
import { pruneRateLimits } from './rate-limits.ts';
import { AppError } from './errors.ts';

type JobPayload = { version?: number; notificationId?: string;
  eventId?: string; eventVersion?: number; userId?: string; status?: string };
type Job = { id: string; kind: string; event_id: string | null; created_at: Date; payload: JobPayload;
  status: string; claim_token: string };

async function createPublicGateNotice(db: Database, job: Job): Promise<void> {
  const { eventId, eventVersion, userId, status } = job.payload;
  if (!eventId || !userId || !Number.isInteger(eventVersion) || !['OPEN', 'CLOSED'].includes(status ?? ''))
    throw new AppError('MALFORMED_JOB', '公开招募通知任务参数无效');
  await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,detail,external_status,created_at)
    SELECT $1,$2,$3,$4,$5,$6,'UNAVAILABLE',j.created_at FROM jobs j WHERE j.id=$1
    ON CONFLICT (id) DO NOTHING`,
    [job.id, eventId, userId, `PUBLIC_RECRUITMENT_${status}`, eventVersion,
      JSON.stringify({ status })]);
}

async function resumeWaitlist(db: Database, job: Job): Promise<void> {
  if (!job.event_id || !Number.isInteger(job.payload.eventVersion))
    throw new AppError('MALFORMED_JOB', '候补恢复任务参数无效');
  await db.transaction(async tx => {
    const { rows } = await tx.query<EventRow>(
      'SELECT id,host_id,status,version,payload,recruiting FROM events WHERE id=$1 FOR UPDATE', [job.event_id]);
    const event = rows[0];
    if (!event || event.version !== job.payload.eventVersion || !event.recruiting ||
      !['RECRUITING', 'CONFIRMED'].includes(event.status)) return;
    await promote(tx, event);
  });
}

async function expireUnformed(db: Database, job: Job): Promise<void> {
  if (!job.event_id) throw new AppError('MALFORMED_JOB', '成局截止任务缺少活动');
  await db.transaction(async tx => {
    const { rows } = await tx.query<{ id: string; status: string; version: number }>('SELECT id,status,version FROM events WHERE id=$1 FOR UPDATE', [job.event_id]);
    const event = rows[0];
    if (!event || event.version !== job.payload.version || event.status !== 'RECRUITING') return;
    await tx.query("UPDATE events SET status='EXPIRED',recruiting=false,updated_at=now() WHERE id=$1", [event.id]);
    const { rows: participants } = await tx.query<{ user_id: string }>("SELECT user_id FROM registrations WHERE event_id=$1 AND status IN ('CONFIRMED','RECONFIRM_REQUIRED','OFFERED','WAITLISTED')", [event.id]);
    for (const person of participants) await enqueueNotification(tx, event.id, person.user_id, 'EVENT_EXPIRED', event.version);
    await tx.query("UPDATE registrations SET status='EXPIRED',updated_at=now() WHERE event_id=$1 AND status='RECONFIRM_REQUIRED'", [event.id]);
    await audit(tx, 'system', event.id, 'FORMATION_EXPIRED');
  });
}

async function cancelShortfall(db: Database, job: Job, at: number): Promise<void> {
  if (!job.event_id) throw new AppError('MALFORMED_JOB', '报名截止任务缺少活动');
  await db.transaction(async tx => {
    const { rows } = await tx.query<{ id: string; status: string; version: number; payload: { minParticipants: number; startAt: string } }>('SELECT id,status,version,payload FROM events WHERE id=$1 FOR UPDATE', [job.event_id]);
    const event = rows[0];
    if (!event || event.version !== job.payload.version || event.status !== 'CONFIRMED') return;
    const { rows: counts } = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND status='CONFIRMED' AND accepted_version=$2", [event.id, event.version]);
    if ((counts[0]?.n ?? 0) >= event.payload.minParticipants) return;
    if (at >= Date.parse(event.payload.startAt)) {
      await audit(tx, 'system', event.id, 'SHORTFALL_AFTER_START');
      return;
    }
    const { rows: cancelled } = await tx.query<{ id: string }>(`UPDATE events
      SET status='CANCELLED',recruiting=false,updated_at=now()
      WHERE id=$1 AND status='CONFIRMED' AND version=$2
        AND clock_timestamp() < (payload->>'startAt')::timestamptz RETURNING id`, [event.id, event.version]);
    if (!cancelled.length) {
      await audit(tx, 'system', event.id, 'SHORTFALL_AFTER_START');
      return;
    }
    const { rows: participants } = await tx.query<{ user_id: string }>("SELECT user_id FROM registrations WHERE event_id=$1 AND status IN ('CONFIRMED','RECONFIRM_REQUIRED','OFFERED','WAITLISTED')", [event.id]);
    for (const person of participants) await enqueueNotification(tx, event.id, person.user_id, 'EVENT_CANCELLED', event.version, { reason: 'CONFIRMED_COUNT_BELOW_MINIMUM' });
    await audit(tx, 'system', event.id, 'CANCEL_SHORTFALL');
  });
}

async function sendStartReminder(db: Database, job: Job): Promise<void> {
  if (!job.event_id) throw new AppError('MALFORMED_JOB', '开始提醒任务缺少活动');
  await db.transaction(async tx => {
    const { rows } = await tx.query<{ id: string; status: string; version: number; review_status: string }>('SELECT id,status,version,review_status FROM events WHERE id=$1 FOR UPDATE', [job.event_id]);
    const event = rows[0];
    if (!event || event.version !== job.payload.version || event.status !== 'CONFIRMED' ||
      !['NOT_REQUIRED', 'APPROVED'].includes(event.review_status)) return;
    const { rows: participants } = await tx.query<{ user_id: string }>("SELECT user_id FROM registrations WHERE event_id=$1 AND status='CONFIRMED' AND accepted_version=$2", [event.id, event.version]);
    for (const person of participants) await enqueueStartReminder(tx, event.id, person.user_id, event.version);
  });
}

async function startEvent(db: Database, job: Job): Promise<void> {
  if (!job.event_id || !Number.isInteger(job.payload.version))
    throw new AppError('MALFORMED_JOB', '活动开始任务参数无效');
  await db.transaction(async tx => {
    const { rows } = await tx.query<{ id: string; status: string; version: number }>(
      'SELECT id,status,version FROM events WHERE id=$1 FOR UPDATE', [job.event_id]);
    const event = rows[0];
    if (!event || event.version !== job.payload.version || event.status !== 'CONFIRMED') return;
    const { rows: started } = await tx.query<{ id: string }>(`UPDATE events SET status='IN_PROGRESS',recruiting=false,updated_at=now()
      WHERE id=$1 AND status='CONFIRMED' AND version=$2
        AND clock_timestamp() >= (payload->>'startAt')::timestamptz RETURNING id`, [event.id, event.version]);
    if (started.length) await audit(tx, 'system', event.id, 'EVENT_STARTED');
  });
}

async function promptEventOutcome(db: Database, job: Job): Promise<void> {
  if (!job.event_id || !Number.isInteger(job.payload.version))
    throw new AppError('MALFORMED_JOB', '活动结束任务参数无效');
  await db.transaction(async tx => {
    const { rows } = await tx.query<{ id: string; host_id: string; status: string; version: number; payload: { endAt: string } }>(
      'SELECT id,host_id,status,version,payload FROM events WHERE id=$1 FOR UPDATE', [job.event_id]);
    const event = rows[0];
    if (!event || event.version !== job.payload.version || !['CONFIRMED', 'IN_PROGRESS'].includes(event.status) ||
      await databaseNow(tx) < Date.parse(event.payload.endAt)) return;
    await enqueueInAppOutcomePrompt(tx, event.id, event.host_id, 'EVENT_OUTCOME_DUE', event.version);
  });
}

export async function runDueJobs(db: Database, at?: number, notificationAdapter?: NotificationAdapter): Promise<{ processed: number; failed: number }> {
  await pruneRateLimits(db);
  const now = at ?? await databaseNow(db);
  const { rows } = await db.query<Job>(`SELECT id,kind,event_id,payload,status,created_at FROM jobs
    WHERE ((kind IN ('EVENT_START','EVENT_END') AND due_at<=clock_timestamp()) OR
      (kind NOT IN ('EVENT_START','EVENT_END') AND due_at<=$1))
      AND (status='PENDING' OR (status='PROCESSING' AND
        ((kind IN ('EVENT_START','EVENT_END') AND locked_at<clock_timestamp()-interval '5 minutes') OR
         (kind NOT IN ('EVENT_START','EVENT_END') AND locked_at<$2))))
    ORDER BY due_at,id LIMIT 100`, [new Date(now).toISOString(), new Date(now - 5 * 60_000).toISOString()]);
  let processed = 0; let failed = 0;
  for (const job of rows) {
    const { rows: claimed } = await db.query<Job>(`UPDATE jobs SET status='PROCESSING',locked_at=now(),attempts=attempts+1,claim_token=$3
      WHERE id=$1 AND ((kind IN ('EVENT_START','EVENT_END') AND due_at<=clock_timestamp()) OR
        (kind NOT IN ('EVENT_START','EVENT_END') AND due_at<=$4::timestamptz))
        AND (status='PENDING' OR (status='PROCESSING' AND
          ((kind IN ('EVENT_START','EVENT_END') AND locked_at<clock_timestamp()-interval '5 minutes') OR
           (kind NOT IN ('EVENT_START','EVENT_END') AND locked_at<$2))))
      RETURNING id,kind,event_id,payload,status,created_at,claim_token`,
      [job.id, new Date(now - 5 * 60_000).toISOString(), randomUUID(), new Date(now).toISOString()]);
    const current = claimed[0];
    if (!current) continue;
    try {
      if (!current.payload || typeof current.payload !== 'object' || Array.isArray(current.payload))
        throw new AppError('MALFORMED_JOB', '后台任务参数无效');
      if (current.kind === 'EXPIRE_OFFER') await expireOffers(db);
      else if (current.kind === 'EXPIRE_RESERVATION') await expireReservations(db);
      else if (current.kind === 'FORMATION_DEADLINE') await expireUnformed(db, current);
      else if (current.kind === 'REGISTRATION_DEADLINE') await cancelShortfall(db, current, now);
      else if (current.kind === 'EVENT_REMINDER') await sendStartReminder(db, current);
      else if (current.kind === 'EVENT_START') await startEvent(db, current);
      else if (current.kind === 'EVENT_END') await promptEventOutcome(db, current);
      else if (current.kind === 'PUBLIC_GATE_NOTICE') await createPublicGateNotice(db, current);
      else if (current.kind === 'RESUME_WAITLIST') await resumeWaitlist(db, current);
      else if (current.kind === 'SEND_EXTERNAL') {
        if (!current.payload.notificationId) throw new AppError('MALFORMED_JOB', '外部通知任务参数无效');
        await dispatchNotification(db, current.payload.notificationId, notificationAdapter);
      } else throw new AppError('UNKNOWN_JOB_KIND', '未知后台任务类型');
      const { rows: finished } = await db.query<{ id: string }>(
        "UPDATE jobs SET status='DONE',locked_at=NULL,claim_token=NULL,last_error_code=NULL WHERE id=$1 AND status='PROCESSING' AND claim_token=$2 RETURNING id",
        [current.id, current.claim_token]);
      if (finished.length) processed++;
    } catch (error) {
      const code = error instanceof AppError && /^[A-Z_]{2,64}$/.test(error.code) ? error.code : 'INTERNAL_ERROR';
      const { rows: failedClaim } = await db.query<{ id: string }>(
        "UPDATE jobs SET status=CASE WHEN attempts>=5 THEN 'FAILED' ELSE 'PENDING' END,locked_at=NULL,claim_token=NULL,last_error_code=$2 WHERE id=$1 AND status='PROCESSING' AND claim_token=$3 RETURNING id",
        [current.id, code, current.claim_token]);
      if (failedClaim.length) failed++;
    }
  }
  return { processed, failed };
}
