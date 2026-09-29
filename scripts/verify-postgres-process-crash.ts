// Synthetic PostgreSQL process-crash proof. Creates a fresh irl_r1_test_* DB
// and kills only child processes started by this script; leaves DB for audit.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION } from '../src/db.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { reviewEvent } from '../src/event-review.ts';
import { runDueJobs } from '../src/jobs.ts';
import { enqueueStartReminder, setConsent } from '../src/notifications.ts';
import { register, reserveSeats } from '../src/registrations.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const baseUrl = process.env.IRL_PG_TEST_URL ??
  `postgresql://127.0.0.1:${process.env.IRL_PG_TEST_PORT ?? '55432'}/irl_r1_test_local`;
validatePostgresTestUrl(baseUrl);
const connection = new URL(baseUrl);
const name = `irl_r1_test_process_crash_${Date.now()}_${randomBytes(3).toString('hex')}`;
connection.pathname = `/${name}`;
const url = connection.toString();
validatePostgresTestUrl(url);
connection.pathname = '/postgres';
const admin = new pg.Client({ connectionString: connection.toString() });
await admin.connect();
try {
  const { rows } = await admin.query<{ database: string; address: string | null }>(
    'SELECT current_database() AS database,host(inet_server_addr()) AS address');
  assert.equal(rows[0]?.database, 'postgres');
  assert.ok(rows[0]?.address, 'PostgreSQL must expose a network address through loopback');
  assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount, 0);
  await admin.query(`CREATE DATABASE "${name}"`);
} finally { await admin.end(); }

const probe = new pg.Client({ connectionString: url });
await probe.connect();
try { await assertEmptyPostgresTestDatabase(probe, name, { allowContainerServiceAddress: true }); }
finally { await probe.end(); }

const childFile = fileURLToPath(new URL('./verify-postgres-process-crash-child.ts', import.meta.url));
type Marker = { stage: string; result?: { processed: number; failed: number } };
async function worker(mode: string, args: string[] = [], pauseAt?: string): Promise<Marker> {
  const child = spawn(process.execPath, ['--import', 'tsx', childFile, mode, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, IRL_PG_TEST_URL: url }
  });
  let stdout = ''; let stderr = ''; let marker: Marker | undefined;
  let resolveMarker!: (value: Marker) => void;
  let rejectMarker!: (error: Error) => void;
  const found = new Promise<Marker>((resolve, reject) => { resolveMarker = resolve; rejectMarker = reject; });
  const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  child.once('error', error => rejectMarker(error));
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  child.stdout.on('data', chunk => {
    stdout += String(chunk);
    for (;;) {
      const newline = stdout.indexOf('\n');
      if (newline < 0) break;
      const line = stdout.slice(0, newline); stdout = stdout.slice(newline + 1);
      try {
        const candidate = JSON.parse(line) as Marker;
        if (candidate.stage === (pauseAt ?? 'DONE')) { marker = candidate; resolveMarker(candidate); }
      } catch { /* A runtime diagnostic is captured in stdout for the error below. */ }
    }
  });
  const timeout = setTimeout(() => {
    child.kill('SIGKILL');
    rejectMarker(new Error(`${mode} worker timed out; stderr=${stderr}`));
  }, 30_000);
  try {
    const result = await Promise.race([found, exit.then(state => {
      if (marker) return marker;
      throw new Error(`${mode} worker exited before ${pauseAt ?? 'DONE'}: ${JSON.stringify(state)}; stderr=${stderr}; stdout=${stdout}`);
    })]);
    if (pauseAt) {
      assert.equal(child.kill('SIGKILL'), true, 'only the spawned child should be killed');
      const state = await exit;
      assert.equal(state.signal, 'SIGKILL');
    } else {
      const state = await exit;
      assert.equal(state.code, 0, `${mode} worker failed: ${stderr}`);
    }
    return result;
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
}

const db = await createProductionDatabase(url);
try {
  await db.query(`CREATE TABLE synthetic_provider_calls (
    notification_id text NOT NULL, worker_mode text NOT NULL, called_at timestamptz NOT NULL DEFAULT now())`);
  await db.query(`INSERT INTO users(id,wechat_openid) VALUES
    ('crash_host','crash-host-openid'),('crash_member','crash-member-openid'),
    ('crash_member_2','crash-member-2-openid'),('crash_member_3','crash-member-3-openid'),
    ('crash_member_4','crash-member-4-openid')`);
  const start = Date.now() + 7 * 24 * 60 * 60_000;
  const input = { title: '进程崩溃恢复合成活动', type: 'badminton', startAt: new Date(start).toISOString(),
    endAt: new Date(start + 2 * 60 * 60_000).toISOString(), timeZone: 'Asia/Shanghai', city: '深圳',
    venueName: '合成场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
    registrationDeadline: new Date(start - 60 * 60_000).toISOString(),
    confirmationDeadline: new Date(start - 2 * 60 * 60_000).toISOString(), feeMode: 'FREE', feeCapFen: 0,
    cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };
  const draft = await createDraft(db, 'crash_host', input, 'crash-draft');
  const pending = await publishEvent(db, 'crash_host', draft.id, draft.version, 'crash-publish');
  const event = await reviewEvent(db, 'operator:crash-reviewer', pending.id, pending.version,
    'APPROVED', '本机合成活动审核通过', 'crash-approve');
  await runDueJobs(db); // Drain publication notice; the registration outbox is created next.

  await worker('produce', [event.id, String(event.version), pending.inviteToken!], 'COMMITTED');
  const registrations = await db.query<{ id: string; status: string }>(
    "SELECT id,status FROM registrations WHERE event_id=$1 AND user_id='crash_member'", [event.id]);
  assert.equal(registrations.rows.length, 1);
  assert.equal(registrations.rows[0]?.status, 'CONFIRMED');
  const notices = await db.query<{ id: string; external_status: string }>(
    "SELECT id,external_status FROM notifications WHERE event_id=$1 AND user_id='crash_member' AND kind='REGISTRATION_STATUS'", [event.id]);
  assert.equal(notices.rows.length, 1);
  assert.equal(notices.rows[0]?.external_status, 'NOT_REQUESTED');
  const registrationJob = await db.query<{ id: string; status: string; attempts: number }>(
    "SELECT id,status,attempts FROM jobs WHERE kind='SEND_EXTERNAL' AND payload->>'notificationId'=$1",
    [notices.rows[0]!.id]);
  assert.equal(registrationJob.rows.length, 1);
  assert.deepEqual([registrationJob.rows[0]?.status, registrationJob.rows[0]?.attempts], ['PENDING', 0]);
  const registrationJobId = registrationJob.rows[0]!.id;

  await worker('claim', [registrationJobId], 'CLAIMED');
  const stale = await db.query<{ status: string; attempts: number; claim_token: string | null }>(
    'SELECT status,attempts,claim_token FROM jobs WHERE id=$1', [registrationJobId]);
  assert.equal(stale.rows[0]?.status, 'PROCESSING');
  assert.equal(stale.rows[0]?.attempts, 1);
  assert.ok(stale.rows[0]?.claim_token);
  await db.query("UPDATE jobs SET locked_at=now()-interval '6 minutes' WHERE id=$1", [registrationJobId]);
  const resumed = await worker('run');
  assert.deepEqual(resumed.result, { processed: 1, failed: 0 });
  const recovered = await db.query<{ status: string; attempts: number; claim_token: string | null }>(
    'SELECT status,attempts,claim_token FROM jobs WHERE id=$1', [registrationJobId]);
  assert.deepEqual(recovered.rows, [{ status: 'DONE', attempts: 2, claim_token: null }]);
  const noticeAfter = await db.query<{ external_status: string }>(
    'SELECT external_status FROM notifications WHERE id=$1', [notices.rows[0]!.id]);
  assert.equal(noticeAfter.rows[0]?.external_status, 'PURPOSE_NOT_CONFIGURED');
  assert.equal((await db.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND actor_id='crash_member' AND action='REGISTER_CONFIRMED'",
    [event.id])).rows[0]?.n, 1);
  assert.equal((await db.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM notifications WHERE event_id=$1 AND user_id='crash_member' AND kind='REGISTRATION_STATUS'",
    [event.id])).rows[0]?.n, 1);
  assert.deepEqual((await worker('run')).result, { processed: 0, failed: 0 });

  const reserved = await reserveSeats(db, 'crash_host', event.id, event.version, 1, 'crash-reserve');
  assert.equal(reserved.length, 1);
  await db.query("UPDATE reservations SET expires_at=now()-interval '1 second' WHERE id=$1", [reserved[0]!.id]);
  await db.query("UPDATE jobs SET due_at=now()-interval '1 second' WHERE kind='EXPIRE_RESERVATION' AND payload->>'reservationId'=$1",
    [reserved[0]!.id]);
  assert.deepEqual((await worker('run')).result, { processed: 1, failed: 0 });
  assert.ok((await db.query<{ released_at: Date | null }>('SELECT released_at FROM reservations WHERE id=$1',
    [reserved[0]!.id])).rows[0]?.released_at);
  for (const member of ['crash_member_2', 'crash_member_3', 'crash_member_4']) {
    await register(db, member, event.id, event.version, `crash-register-${member}`, pending.inviteToken!);
  }
  const seats = await db.query<{ status: string; n: number }>(
    'SELECT status,count(*)::int AS n FROM registrations WHERE event_id=$1 GROUP BY status ORDER BY status', [event.id]);
  assert.deepEqual(seats.rows, [{ status: 'CONFIRMED', n: 4 }, { status: 'WAITLISTED', n: 1 }]);
  await worker('run'); // Drain ordinary registration notices before the external send crash.

  await setConsent(db, 'crash_member', 'EVENT_REMINDER', true, 'crash-consent');
  await db.query("UPDATE events SET status='CONFIRMED' WHERE id=$1", [event.id]);
  await enqueueStartReminder(db, event.id, 'crash_member', event.version);
  const reminder = await db.query<{ id: string; external_status: string }>(
    "SELECT id,external_status FROM notifications WHERE event_id=$1 AND user_id='crash_member' AND kind='EVENT_REMINDER'",
    [event.id]);
  assert.equal(reminder.rows.length, 1);
  assert.equal(reminder.rows[0]?.external_status, 'NOT_REQUESTED');
  const reminderJob = await db.query<{ id: string }>(
    "SELECT id FROM jobs WHERE kind='SEND_EXTERNAL' AND payload->>'notificationId'=$1", [reminder.rows[0]!.id]);
  assert.equal(reminderJob.rows.length, 1);
  await worker('send', [reminder.rows[0]!.id], 'SEND_ENTERED');
  assert.equal((await db.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM synthetic_provider_calls WHERE notification_id=$1', [reminder.rows[0]!.id])).rows[0]?.n, 1);
  assert.equal((await db.query<{ external_status: string }>(
    'SELECT external_status FROM notifications WHERE id=$1', [reminder.rows[0]!.id])).rows[0]?.external_status, 'DISPATCHING');
  const sendingJob = await db.query<{ status: string; attempts: number }>(
    'SELECT status,attempts FROM jobs WHERE id=$1', [reminderJob.rows[0]!.id]);
  assert.deepEqual(sendingJob.rows, [{ status: 'PROCESSING', attempts: 1 }]);
  await db.query("UPDATE jobs SET locked_at=now()-interval '6 minutes' WHERE id=$1", [reminderJob.rows[0]!.id]);
  assert.deepEqual((await worker('run')).result, { processed: 1, failed: 0 });
  const uncertain = await db.query<{ external_status: string; external_failure_code: string }>(
    'SELECT external_status,external_failure_code FROM notifications WHERE id=$1', [reminder.rows[0]!.id]);
  assert.deepEqual(uncertain.rows, [{ external_status: 'UNKNOWN_REQUIRES_RECONCILIATION',
    external_failure_code: 'INTERRUPTED_DISPATCH' }]);
  const recoveredReminderJob = await db.query<{ status: string; attempts: number; claim_token: string | null }>(
    'SELECT status,attempts,claim_token FROM jobs WHERE id=$1', [reminderJob.rows[0]!.id]);
  assert.deepEqual(recoveredReminderJob.rows, [{ status: 'DONE', attempts: 2, claim_token: null }]);
  assert.equal((await db.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM synthetic_provider_calls WHERE notification_id=$1', [reminder.rows[0]!.id])).rows[0]?.n, 1);
  assert.deepEqual((await worker('run')).result, { processed: 0, failed: 0 });

  process.stdout.write(JSON.stringify({ database: name, schemaVersion: LATEST_SCHEMA_VERSION,
    registrationCommittedBeforeCrash: true, registrationOutboxRecoveredAfterLeaseExpiry: true,
    registrationAuditRows: 1, registrationNoticeRows: 1, confirmedSeats: 4, waitlisted: 1,
    expiredReservationReleased: true, syntheticProviderCallsAfterRestart: 1,
    interruptedExternalStatus: uncertain.rows[0]?.external_status, actualProviderDeliveryProven: false }) + '\n');
} finally { await db.close(); }
