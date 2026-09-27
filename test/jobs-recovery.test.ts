import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createDatabase } from '../src/db.ts';
import type { Database } from '../src/db.ts';
import { runDueJobs } from '../src/jobs.ts';
import { createDraft } from '../src/events.ts';
import { createOperatorEnrollment, totpCode } from '../src/operator-auth.ts';
import { createApp } from '../src/server.ts';
import { retryFailedJob } from '../src/job-recovery.ts';

function databaseWithApplicationClock(db: Database, actualNow: () => number, appNow: () => number): Database {
  return {
    ...db,
    query: async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
      Date.now = actualNow;
      try { return await db.query<T>(sql, params); }
      finally { Date.now = appNow; }
    }
  };
}

test('a fast worker clock does not claim a future database job', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO jobs(id,kind,due_at,payload) VALUES('future-clock-job','UNRECOGNIZED',now()+interval '1 hour','{}')");
    const actualNow = Date.now;
    const fastNow = () => actualNow() + 2 * 60 * 60_000;
    Date.now = fastNow;
    try { assert.deepEqual(await runDueJobs(databaseWithApplicationClock(db, actualNow, fastNow)), { processed: 0, failed: 0 }); }
    finally { Date.now = actualNow; }
    const { rows } = await db.query<{ status: string; attempts: number }>("SELECT status,attempts FROM jobs WHERE id='future-clock-job'");
    assert.deepEqual(rows, [{ status: 'PENDING', attempts: 0 }]);
  } finally { await db.close(); }
});

test('a slow worker clock still claims a due database job', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO jobs(id,kind,due_at,payload) VALUES('past-clock-job','UNRECOGNIZED',now()-interval '1 minute','{}')");
    const actualNow = Date.now;
    const slowNow = () => actualNow() - 2 * 60 * 60_000;
    Date.now = slowNow;
    try { assert.deepEqual(await runDueJobs(databaseWithApplicationClock(db, actualNow, slowNow)), { processed: 0, failed: 1 }); }
    finally { Date.now = actualNow; }
    const { rows } = await db.query<{ status: string; attempts: number }>("SELECT status,attempts FROM jobs WHERE id='past-clock-job'");
    assert.deepEqual(rows, [{ status: 'PENDING', attempts: 1 }]);
  } finally { await db.close(); }
});

test('worker does not claim a job rescheduled after its due scan', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO jobs(id,kind,due_at,payload) VALUES('rescheduled-job','UNRECOGNIZED',now()-interval '1 minute','{}')");
    let rescheduled = false;
    const racingDb: Database = {
      ...db,
      query: async (sql, params = []) => {
        if (!rescheduled && sql.startsWith("UPDATE jobs SET status='PROCESSING'")) {
          rescheduled = true;
          await db.query("UPDATE jobs SET due_at=now()+interval '1 hour' WHERE id='rescheduled-job'");
        }
        return db.query(sql, params);
      }
    };
    assert.deepEqual(await runDueJobs(racingDb), { processed: 0, failed: 0 });
    assert.equal(rescheduled, true);
    const { rows } = await db.query<{ status: string; attempts: number }>("SELECT status,attempts FROM jobs WHERE id='rescheduled-job'");
    assert.deepEqual(rows, [{ status: 'PENDING', attempts: 0 }]);
  } finally { await db.close(); }
});

test('exhausted malformed and unknown jobs retain safe failure categories', async () => {
  const db = await createDatabase();
  try {
    await db.query(`INSERT INTO jobs(id,kind,due_at,payload) VALUES
      ('malformed-gate','PUBLIC_GATE_NOTICE',now()-interval '1 minute','{}'),
      ('malformed-formation','FORMATION_DEADLINE',now()-interval '1 minute','{}'),
      ('malformed-registration','REGISTRATION_DEADLINE',now()-interval '1 minute','{}'),
      ('malformed-reminder','EVENT_REMINDER',now()-interval '1 minute','{}'),
      ('malformed-external','SEND_EXTERNAL',now()-interval '1 minute','{}'),
      ('missing-external-target','SEND_EXTERNAL',now()-interval '1 minute','{"notificationId":"does-not-exist"}'),
      ('unknown-kind','UNRECOGNIZED',now()-interval '1 minute','{}')`);
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await runDueJobs(db);
      assert.equal(result.failed, 7);
    }
    const { rows } = await db.query<{ id: string; status: string; attempts: number; last_error_code: string }>(
      "SELECT id,status,attempts,last_error_code FROM jobs ORDER BY id");
    assert.deepEqual(rows, [
      { id: 'malformed-external', status: 'FAILED', attempts: 5, last_error_code: 'MALFORMED_JOB' },
      { id: 'malformed-formation', status: 'FAILED', attempts: 5, last_error_code: 'MALFORMED_JOB' },
      { id: 'malformed-gate', status: 'FAILED', attempts: 5, last_error_code: 'MALFORMED_JOB' },
      { id: 'malformed-registration', status: 'FAILED', attempts: 5, last_error_code: 'MALFORMED_JOB' },
      { id: 'malformed-reminder', status: 'FAILED', attempts: 5, last_error_code: 'MALFORMED_JOB' },
      { id: 'missing-external-target', status: 'FAILED', attempts: 5, last_error_code: 'MALFORMED_JOB' },
      { id: 'unknown-kind', status: 'FAILED', attempts: 5, last_error_code: 'UNKNOWN_JOB_KIND' }
    ]);
    assert.equal((await runDueJobs(db)).processed, 0);
  } finally { await db.close(); }
});

test('JSONB null payload is classified and external retry rejects it safely', async () => {
  const db = await createDatabase();
  try {
    await db.query(`INSERT INTO jobs(id,kind,due_at,payload) VALUES
      ('null-gate','PUBLIC_GATE_NOTICE',now()-interval '1 minute','null'::jsonb),
      ('null-external','SEND_EXTERNAL',now()-interval '1 minute','null'::jsonb)`);
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await runDueJobs(db)).failed, 2);
    const { rows } = await db.query<{ id: string; last_error_code: string }>(
      "SELECT id,last_error_code FROM jobs WHERE status='FAILED' ORDER BY id");
    assert.deepEqual(rows, [
      { id: 'null-external', last_error_code: 'MALFORMED_JOB' },
      { id: 'null-gate', last_error_code: 'MALFORMED_JOB' }
    ]);
    await assert.rejects(() => retryFailedJob(db, 'operator:jobs', 'null-external', 'null-retry'),
      { code: 'MALFORMED_JOB' });
  } finally { await db.close(); }
});

test('expired worker cannot overwrite a failed job after operator retry', async () => {
  const db = await createDatabase();
  let releaseFirst!: () => void;
  let signalFirst!: () => void;
  const firstPaused = new Promise<void>(resolve => { signalFirst = resolve; });
  const firstRelease = new Promise<void>(resolve => { releaseFirst = resolve; });
  let held = false;
  const firstWorker: Database = {
    query: async (sql, params) => {
      if (!held && sql.includes('UPDATE jobs SET status=CASE')) {
        held = true; signalFirst(); await firstRelease;
      }
      return db.query(sql, params);
    },
    transaction: fn => db.transaction(fn),
    close: async () => {}
  };
  try {
    await db.query(`INSERT INTO jobs(id,kind,due_at,payload,attempts)
      VALUES('leased-unknown','UNRECOGNIZED',now()-interval '1 minute','{}',3)`);
    const staleRun = runDueJobs(firstWorker);
    await firstPaused;
    await db.query("UPDATE jobs SET locked_at=now()-interval '6 minutes' WHERE id='leased-unknown'");
    assert.equal((await runDueJobs(db)).failed, 1);
    assert.equal((await db.query<{ status: string }>("SELECT status FROM jobs WHERE id='leased-unknown'")).rows[0]?.status, 'FAILED');
    await retryFailedJob(db, 'operator:jobs', 'leased-unknown', 'leased-retry');
    releaseFirst();
    assert.deepEqual(await staleRun, { processed: 0, failed: 0 });
    const { rows } = await db.query<{ status: string; attempts: number; last_error_code: string | null }>(
      "SELECT status,attempts,last_error_code FROM jobs WHERE id='leased-unknown'");
    assert.deepEqual(rows, [{ status: 'PENDING', attempts: 0, last_error_code: null }]);
  } finally { releaseFirst(); await db.close(); }
});

test('uncertain external notification is not silently requeued as a send', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', { title: '通知恢复验证', type: 'badminton',
      startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
      venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 6,
      registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z',
      feeMode: 'FREE', feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true }, 'uncertain-draft');
    await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,external_status)
      VALUES('uncertain-notice',$1,'host','EVENT_REMINDER',1,'UNKNOWN_REQUIRES_RECONCILIATION')`, [draft.id]);
    await db.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload,status,attempts,last_error_code)
      VALUES('uncertain-job','SEND_EXTERNAL',$1,now()-interval '1 minute',
      '{"notificationId":"uncertain-notice"}','FAILED',5,'INTERNAL_ERROR')`, [draft.id]);
    await assert.rejects(() => retryFailedJob(db, 'operator:jobs', 'uncertain-job', 'uncertain-retry'),
      { code: 'RECONCILIATION_REQUIRED' });
    assert.equal((await db.query<{ status: string }>("SELECT status FROM jobs WHERE id='uncertain-job'")).rows[0]?.status, 'FAILED');
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM audit WHERE action='RETRY_JOB'")).rows[0]?.n, 0);
  } finally { await db.close(); }
});

test('named job operator pages failed tasks and audits one safe retry', async () => {
  const db = await createDatabase();
  const password = 'job recovery operator password';
  const jobOperator = { ...createOperatorEnrollment('joboperator', password), permissions: ['JOBS'] };
  const reportOperator = { ...createOperatorEnrollment('reportoperator', password), permissions: ['REPORTS'] };
  const app = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'secret',
    operatorAccounts: [jobOperator, reportOperator] });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const login = async (account: typeof jobOperator) => {
    const response = await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: account.username, password, code: totpCode(account.totpSecret) }) });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  };
  try {
    const draft = await createDraft(db, 'host', { title: '失败任务验证', type: 'badminton',
      startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
      venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 6,
      registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z',
      feeMode: 'FREE', feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true }, 'job-draft');
    await db.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload,status,attempts,last_error_code)
      SELECT 'failed-'||n,'PUBLIC_GATE_NOTICE',$1,now()-interval '1 minute',
        jsonb_build_object('eventId',$1::text,'eventVersion',1,'userId','host','status','CLOSED','privateToken','must-not-leak'),
        'FAILED',5,'INTERNAL_ERROR' FROM generate_series(1,105) n`, [draft.id]);
    const jobToken = await login(jobOperator);
    const reportToken = await login(reportOperator);
    const get = (query = '', token = jobToken) => fetch(`${base}/ops/jobs/failed${query}`, { headers: { Authorization: `Bearer ${token}` } });
    const retry = (id: string, token = jobToken, key = 'retry-one') => fetch(`${base}/ops/jobs/${id}/retry`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key } });
    assert.equal((await get('', reportToken)).status, 403);
    assert.equal((await retry('failed-1', reportToken)).status, 403);
    const first = await (await get('?offset=0')).json() as { items: Array<{ id: string }>; total: number; nextOffset: number | null; snapshot: string };
    assert.equal(first.total, 105);
    assert.equal(first.items.length, 100);
    assert.equal(first.nextOffset, 100);
    assert.equal(JSON.stringify(first).includes('privateToken'), false);
    assert.equal(JSON.stringify(first).includes('must-not-leak'), false);
    const second = await (await get(`?offset=100&snapshot=${first.snapshot}`)).json() as typeof first;
    assert.equal(second.items.length, 5);
    assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 105);
    assert.equal((await get('?offset=100')).status, 400);
    assert.equal((await get('?offset=-1')).status, 400);
    const queued = await retry('failed-1');
    assert.equal(queued.status, 202);
    assert.equal((await queued.json() as { status: string }).status, 'PENDING');
    assert.equal((await retry('failed-1')).status, 202);
    assert.equal((await retry('failed-1', jobToken, 'different-key')).status, 409);
    assert.equal((await retry('missing', jobToken, 'missing-key')).status, 404);
    const stale = await get(`?offset=100&snapshot=${first.snapshot}`);
    assert.equal(stale.status, 409);
    assert.equal((await stale.json() as { code: string }).code, 'QUEUE_CHANGED');
    const { rows: audit } = await db.query<{ action: string; actor_id: string }>("SELECT action,actor_id FROM audit WHERE action='RETRY_JOB'");
    assert.deepEqual(audit, [{ action: 'RETRY_JOB', actor_id: 'operator:joboperator' }]);
    const { rows: reset } = await db.query<{ status: string; attempts: number; last_error_code: string | null }>(
      "SELECT status,attempts,last_error_code FROM jobs WHERE id='failed-1'");
    assert.deepEqual(reset, [{ status: 'PENDING', attempts: 0, last_error_code: null }]);
    assert.equal((await runDueJobs(db)).processed, 1);
    assert.equal((await db.query<{ status: string }>("SELECT status FROM jobs WHERE id='failed-1'")).rows[0]?.status, 'DONE');
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM notifications WHERE id='failed-1'")).rows[0]?.n, 1);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
