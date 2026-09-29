import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION } from '../src/db.ts';
import { createPrivacyRequest } from '../src/operations.ts';
import { executePrivacyDeletionSafeguards } from '../src/privacy-deletion.ts';
import { deidentifySharedActivity } from '../src/privacy-shared-deidentification.ts';
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

async function waitForDeletionLock(label: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const { rows } = await pool.query<{ count: number }>(`SELECT count(*)::int AS count
      FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'
      AND query LIKE 'SELECT id FROM users WHERE id=$1 FOR UPDATE%'`);
    if ((rows[0]?.count ?? 0) > 0) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`${label} did not reach the user row lock`);
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
const deletionPolicy = JSON.stringify({
  schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
  approved_by: 'synthetic-postgres-test-owner', approved_at: '2026-09-29T00:00:00.000Z',
  records: [...['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup']
    .map(name => ({ class: name, status: 'APPROVED', approved_days: 30,
      ...(name === 'dispute_or_required_logs' ? { approved_trigger: 'DELETE_EXECUTION' } : {}),
      legal_basis: 'Synthetic test basis only', deletion_action: 'Synthetic test action', access_roles: ['PRIVACY'] })),
  ...['voice_raw', 'photo'].map(name => ({ class: name, status: 'NOT_ENABLED' }))]
});
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

  // A normal writer first holds the person's SHARE lock through its insert.
  // The real safeguard transaction must wait, then see and scrub that row.
  await pool.query("INSERT INTO users(id,wechat_openid) VALUES('pg_privacy_race','synthetic-pg-privacy-race')");
  const deletionDb = await createProductionDatabase(url);
  try {
    const request = await createPrivacyRequest(deletionDb, 'pg_privacy_race',
      { kind: 'DELETE' }, 'pg-privacy-race-request');
    const writer = await pool.connect();
    let writerOpen = false;
    try {
      await writer.query('BEGIN');
      writerOpen = true;
      await writer.query(`INSERT INTO activity_content(id,event_id,author_id,kind,body)
        VALUES('pg_privacy_race_content','pg_privacy_notice_event','pg_privacy_race','QUESTION','synthetic private question')`);
      const deleting = executePrivacyDeletionSafeguards(deletionDb, 'operator:pg-verification',
        request.id, deletionPolicy);
      await waitForDeletionLock('ordinary writer before deletion');
      await writer.query('COMMIT');
      writerOpen = false;
      await deleting;
      await deidentifySharedActivity(deletionDb, 'operator:pg-verification', request.id, deletionPolicy);
      const { rows } = await pool.query<{ author_id: string; body: string }>(
        "SELECT author_id,body FROM activity_content WHERE id='pg_privacy_race_content'");
      assert.notEqual(rows[0]?.author_id, 'pg_privacy_race');
      assert.equal(rows[0]?.body, '[已移除的个人内容]');
      await assert.rejects(pool.query(`INSERT INTO activity_content(id,event_id,author_id,kind,body)
        VALUES('pg_privacy_race_resurrection','pg_privacy_notice_event','pg_privacy_race','QUESTION','resurrected text')`),
      /deleted account identity/);
    } finally {
      if (writerOpen) await writer.query('ROLLBACK');
      writer.release();
    }
  } finally { await deletionDb.close(); }

  // When deletion already owns the person's row, the ordinary insert must
  // fail immediately instead of deadlocking behind a shared activity row.
  await pool.query("INSERT INTO users(id,wechat_openid) VALUES('pg_privacy_race_late','synthetic-pg-privacy-race-late')");
  const deletionOwner = await pool.connect();
  const lateWriter = await pool.connect();
  let deletionOpen = false;
  try {
    await deletionOwner.query('BEGIN');
    deletionOpen = true;
    await deletionOwner.query("SELECT id FROM users WHERE id='pg_privacy_race_late' FOR UPDATE");
    const { rows: latePid } = await lateWriter.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const attempt = lateWriter.query(`INSERT INTO activity_content(id,event_id,author_id,kind,body)
      VALUES('pg_privacy_race_late_content','pg_privacy_notice_event','pg_privacy_race_late','QUESTION','late private question')`)
      .then(() => ({ accepted: true, message: '' }),
        (error: unknown) => ({ accepted: false, message: String(error) }));
    const outcome = await Promise.race([attempt, new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('ordinary insert waited behind deletion row lock')), 2000))]);
    assert.equal(outcome.accepted, false);
    assert.match(outcome.message, /could not obtain lock on row/);
    const { rows: lateWait } = await pool.query<{ waiting: boolean }>(
      "SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1", [latePid[0]!.pid]);
    assert.equal(lateWait[0]?.waiting, false);
    await deletionOwner.query('COMMIT');
    deletionOpen = false;
  } finally {
    if (deletionOpen) await deletionOwner.query('ROLLBACK');
    deletionOwner.release();
    lateWriter.release();
  }
  assert.equal((await pool.query("SELECT 1 FROM activity_content WHERE id='pg_privacy_race_late_content'")).rows.length, 0);

  // Exercise migration 0066 on PostgreSQL itself. The PGlite unit tests cover
  // more transitions; this checks trigger semantics, rollback, and the exact
  // aggregate-only row shape on the database used by CI.
  await pool.query("INSERT INTO users(id,wechat_openid) VALUES('pg_business_actor','synthetic-pg-business-actor')");
  await pool.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,detail)
    VALUES('pg_business_notice','pg_privacy_notice_event','pg_business_actor','EVENT_CANCELLED',1,$1::jsonb)`,
  [JSON.stringify({ privateText: 'pg-business-secret' })]);
  await pool.query("UPDATE notifications SET external_status='DISPATCHING' WHERE id='pg_business_notice'");
  await pool.query("UPDATE notifications SET external_status='UNKNOWN_REQUIRES_RECONCILIATION' WHERE id='pg_business_notice'");
  await pool.query("UPDATE notifications SET external_status='PROVIDER_ACCEPTED' WHERE id='pg_business_notice'");
  await pool.query(`INSERT INTO reports(id,reporter_id,kind,description)
    VALUES('pg_business_report','pg_business_actor','OTHER','pg-business-report-secret')`);
  await pool.query("UPDATE reports SET status='IN_REVIEW' WHERE id='pg_business_report'");
  await pool.query("UPDATE reports SET status='RESOLVED' WHERE id='pg_business_report'");
  await pool.query(`INSERT INTO appeals(id,report_id,appellant_id,description)
    VALUES('pg_business_appeal','pg_business_report','pg_business_actor','pg-business-appeal-secret')`);
  const { rows: businessRows } = await pool.query<{
    event_name: string; occurred_at: Date; is_test: boolean | null }>(
    'SELECT * FROM system_business_events ORDER BY occurred_at');
  const businessNames = businessRows.map(row => row.event_name);
  for (const name of ['EXTERNAL_DISPATCH_CLAIMED', 'EXTERNAL_OUTCOME_UNKNOWN',
    'EXTERNAL_RECONCILED_ACCEPTED', 'REPORT_CREATED_UNSCOPED',
    'REPORT_IN_REVIEW_UNSCOPED', 'REPORT_RESOLVED_UNSCOPED', 'APPEAL_CREATED'])
    assert.equal(businessNames.filter(item => item === name).length, 1, name);
  assert.equal(businessNames.filter(name => name === 'PRIVACY_DELETE_REQUESTED').length, cases.length + 1);
  assert.deepEqual(Object.keys(businessRows[0]!).sort(), ['event_name', 'is_test', 'occurred_at']);
  const serializedBusinessRows = JSON.stringify(businessRows);
  for (const secret of ['pg_business_actor', 'pg_business_notice', 'pg_business_report',
    'pg_business_appeal', 'pg-business-secret', 'pg-business-report-secret',
    'pg-business-appeal-secret']) assert.equal(serializedBusinessRows.includes(secret), false, secret);
  const beforeRollback = businessRows.length;
  const rollbackClient = await pool.connect();
  try {
    await rollbackClient.query('BEGIN');
    await rollbackClient.query(`INSERT INTO reports(id,reporter_id,kind,description)
      VALUES('pg_business_rollback','pg_business_actor','OTHER','rolled back')`);
    await rollbackClient.query('ROLLBACK');
  } finally { rollbackClient.release(); }
  assert.equal((await pool.query('SELECT 1 FROM system_business_events')).rows.length, beforeRollback);
  process.stdout.write(JSON.stringify({ database: databaseName, schemaVersion: LATEST_SCHEMA_VERSION,
    independentConnections: 2, lockWaitObserved: true,
    rejectedAfterCommit: ['AI content update', 'AI content insert',
      'ordinary consent insert', 'ordinary notification detail update'],
    privacySharedWriteRace: { writerBeforeDeletion: 'scrubbed', deletionBeforeWriter: 'rejected_without_wait' },
    systemBusinessEvents: businessRows.length, systemEventRollbackVerified: true }) + '\n');
} finally { await pool.end(); }
