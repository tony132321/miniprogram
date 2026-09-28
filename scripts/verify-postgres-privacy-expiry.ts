import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION } from '../src/db.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const databaseName = validatePostgresTestUrl(url);
const probe = new pg.Pool({ connectionString: url, max: 1 });
try { await assertEmptyPostgresTestDatabase(probe, databaseName,
  { allowContainerServiceAddress: process.env.GITHUB_ACTIONS === 'true' && databaseName === 'irl_r1_test_ci' }); }
finally { await probe.end(); }

const migrated = await createProductionDatabase(url);
try {
  const { rows } = await migrated.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations');
  assert.equal(rows[0]?.version, LATEST_SCHEMA_VERSION, 'latest migration was not installed');
  assert.ok(LATEST_SCHEMA_VERSION >= 65, 'privacy expiry migrations 0064 and 0065 are required');
} finally { await migrated.close(); }

const pool = new pg.Pool({ connectionString: url, max: 3 });

async function waitForLock(pid: number, label: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const { rows } = await pool.query<{ waiting: boolean }>(
      "SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1", [pid]);
    if (rows[0]?.waiting) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`${label} did not reach a PostgreSQL row-lock wait`);
}

async function race(label: string, userId: string, cleanupSql: string, cleanupParams: unknown[],
  lateSql: string, lateParams: unknown[], rejection: RegExp): Promise<void> {
  const owner = await pool.connect();
  const writer = await pool.connect();
  let transactionOpen = false;
  try {
    const { rows: pidRows } = await writer.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    await owner.query('BEGIN');
    transactionOpen = true;
    await owner.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    await owner.query(cleanupSql, cleanupParams);
    const pending = writer.query(lateSql, lateParams).then(
      () => ({ accepted: true, message: '' }),
      (error: unknown) => ({ accepted: false, message: String(error) }));
    await waitForLock(pidRows[0]!.pid, label);
    await owner.query('COMMIT');
    transactionOpen = false;
    const outcome = await pending;
    assert.equal(outcome.accepted, false, `${label} was accepted after expiry committed`);
    assert.match(outcome.message, rejection, `${label} failed for an unexpected reason`);
  } finally {
    if (transactionOpen) await owner.query('ROLLBACK');
    owner.release();
    writer.release();
  }
}

const policyHash = 'a'.repeat(64);
const executedAt = '2026-01-01T00:00:00.000Z';
const expiresAt = '2026-01-02T00:00:00.000Z';
const cases = [
  { user: 'pg_privacy_ai', request: 'pg_privacy_ai_delete' },
  { user: 'pg_privacy_consent', request: 'pg_privacy_consent_delete' },
  { user: 'pg_privacy_notice', request: 'pg_privacy_notice_delete' }
];
try {
  await pool.query(`INSERT INTO events(id,host_id,status,version,payload)
    VALUES('pg_privacy_notice_event','synthetic-host','DRAFT',1,'{}'::jsonb)`);
  for (const item of cases) {
    await pool.query('INSERT INTO users(id,wechat_openid,status) VALUES($1,$2,$3)',
      [item.user, `synthetic-${item.user}`, item.user === cases[2]!.user ? 'ACTIVE' : 'DISABLED']);
    if (item.user === cases[2]!.user) {
      await pool.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,detail)
        VALUES('pg_privacy_notice_row','pg_privacy_notice_event',$1,'EVENT_REMINDER',1,'{}'::jsonb)`,
      [item.user]);
      await pool.query("UPDATE users SET status='DISABLED' WHERE id=$1", [item.user]);
    }
    await pool.query("INSERT INTO privacy_requests(id,user_id,kind,status) VALUES($1,$2,'DELETE','SAFEGUARDS_APPLIED_PENDING_REVIEW')",
      [item.request, item.user]);
  }
  await pool.query(`INSERT INTO privacy_deletion_executions
    (request_id,user_id,policy_sha256,outcomes,applied_by,applied_at)
    VALUES($1,$2,$3,'{}'::jsonb,'operator:pg-verification',$4)`,
  [cases[0]!.request, cases[0]!.user, policyHash, executedAt]);
  await pool.query(`INSERT INTO privacy_ai_input_expiry
    (request_id,user_id,policy_sha256,execution_at,expires_at)
    VALUES($1,$2,$3,$4,$5)`,
  [cases[0]!.request, cases[0]!.user, policyHash, executedAt, expiresAt]);
  await pool.query(`INSERT INTO ai_draft_requests
    (actor_id,request_key,request_hash,status,budget_fen,reserved_fen,known_cost_fen,cost_status,result)
    VALUES($1,'existing',$2,'COMPLETED',1,1,0,'UNKNOWN',$3::jsonb)`,
  [cases[0]!.user, 'b'.repeat(64), JSON.stringify({ fields: { title: 'synthetic personal content' } })]);
  await race('AI content update', cases[0]!.user,
    'UPDATE privacy_ai_input_expiry SET cleanup_at=clock_timestamp() WHERE request_id=$1',
    [cases[0]!.request],
    "UPDATE ai_draft_requests SET result=$2::jsonb WHERE actor_id=$1 AND request_key='existing'",
    [cases[0]!.user, JSON.stringify({ fields: { title: 'late personal content' } })],
    /AI personal content is closed after privacy expiry/);
  await assert.rejects(pool.query(`INSERT INTO ai_draft_requests
    (actor_id,request_key,request_hash,status,budget_fen,reserved_fen)
    VALUES($1,'late',$2,'STARTED',1,1)`, [cases[0]!.user, 'c'.repeat(64)]),
  /AI personal content is closed after privacy expiry/);

  await race('ordinary consent insert', cases[1]!.user,
    `INSERT INTO privacy_ordinary_profile_expiries
      (request_id,user_id,recipient_tombstone,policy_sha256,marker_recorded_at,expires_at,
       disposition_counts,performed_by)
      VALUES($1,$2,$3,$4,$5,$6,'{}'::jsonb,'operator:pg-verification')`,
    [cases[1]!.request, cases[1]!.user, 'deleted:notification:pg_privacy_consent',
      policyHash, executedAt, expiresAt],
    "INSERT INTO notification_consents(user_id,purpose,granted) VALUES($1,'EVENT_REMINDER',true)",
    [cases[1]!.user], /expired ordinary profile notification consent cannot be recreated/);

  await race('ordinary notification detail update', cases[2]!.user,
    `INSERT INTO privacy_ordinary_profile_expiries
      (request_id,user_id,recipient_tombstone,policy_sha256,marker_recorded_at,expires_at,
       disposition_counts,performed_by)
      VALUES($1,$2,$3,$4,$5,$6,'{}'::jsonb,'operator:pg-verification')`,
    [cases[2]!.request, cases[2]!.user, 'deleted:notification:pg_privacy_notice',
      policyHash, executedAt, expiresAt],
    "UPDATE notifications SET detail=$2::jsonb WHERE id='pg_privacy_notice_row' AND user_id=$1",
    [cases[2]!.user, JSON.stringify({ text: 'late personal content' })],
    /expired ordinary profile notification fields cannot be restored/);
  const { rows: noticeRows } = await pool.query<{ detail: unknown }>(
    "SELECT detail FROM notifications WHERE id='pg_privacy_notice_row'");
  assert.deepEqual(noticeRows[0]?.detail, {});
  process.stdout.write(JSON.stringify({ database: databaseName, schemaVersion: LATEST_SCHEMA_VERSION,
    independentConnections: 2, lockWaitObserved: true,
    rejectedAfterCommit: ['AI content update', 'AI content insert',
      'ordinary consent insert', 'ordinary notification detail update'] }) + '\n');
} finally { await pool.end(); }
