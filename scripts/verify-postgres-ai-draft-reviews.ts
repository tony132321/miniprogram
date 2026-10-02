import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION, type Database } from '../src/db.ts';
import { listAiDraftAlerts, listAiDraftAlertReviews, reviewAiDraftAlert } from '../src/ai-draft-requests.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const mode = process.argv[2];
if (mode !== 'empty' && mode !== 'upgrade') throw new Error('mode must be empty or upgrade');
const databaseName = validatePostgresTestUrl(url);
const probe = new pg.Pool({ connectionString: url, max: 1 });
try {
  if (mode === 'empty') await assertEmptyPostgresTestDatabase(probe, databaseName);
  else {
    const { rows } = await probe.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations');
    assert.equal(rows[0]?.version, 53, 'upgrade fixture must be at schema 53');
    await probe.query(`INSERT INTO ai_draft_requests
      (actor_id,request_key,request_hash,status,budget_fen,reserved_fen,created_at)
      VALUES('pg-host','pre54-changing',$1,'STARTED',20,20,clock_timestamp()-interval '2 minutes')`, ['a'.repeat(64)]);
  }
} finally { await probe.end(); }

let first: Database | undefined;
let second: Database | undefined;
try {
  [first, second] = await Promise.all([createProductionDatabase(url), createProductionDatabase(url)]);
  const { rows: versions } = await first.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations');
  assert.equal(versions[0]?.version, LATEST_SCHEMA_VERSION);
  const requestKey = mode === 'empty' ? 'fresh54-changing' : 'pre54-changing';
  if (mode === 'empty') await first.query(`INSERT INTO ai_draft_requests
    (actor_id,request_key,request_hash,status,budget_fen,reserved_fen,created_at)
    VALUES('pg-host',$1,$2,'STARTED',20,20,clock_timestamp()-interval '2 minutes')`, [requestKey, 'a'.repeat(64)]);
  const [left, right] = await Promise.allSettled([
    reviewAiDraftAlert(first, 'operator:one', 'pg-host', requestKey, '本机复核记录，外部账单待查', 'pg-review-one'),
    reviewAiDraftAlert(second, 'operator:two', 'pg-host', requestKey, '本机复核记录，外部账单待查', 'pg-review-two')
  ]);
  assert.equal([left, right].filter(item => item.status === 'fulfilled').length, 1);
  assert.equal([left, right].filter(item => item.status === 'rejected').length, 1);
  assert.equal((await listAiDraftAlerts(first)).total, 0);
  assert.equal((await listAiDraftAlertReviews(second)).items.length, 1);
  await first.query(`UPDATE ai_draft_requests SET status='UNKNOWN',finished_at=clock_timestamp()
    WHERE actor_id='pg-host' AND request_key=$1`, [requestKey]);
  assert.deepEqual((await listAiDraftAlerts(second)).items.map(item => item.status), ['UNKNOWN']);
  await reviewAiDraftAlert(second, 'operator:three', 'pg-host', requestKey,
    '本机复核未知状态，外部账单待查', 'pg-review-three');
  assert.equal((await listAiDraftAlerts(first)).total, 0);
  await second.query(`UPDATE ai_draft_requests SET status='COMPLETED',cost_status='UNKNOWN',known_cost_fen=0,
    result='{"fallbackReason":"COST_BOUND_VIOLATION"}'::jsonb
    WHERE actor_id='pg-host' AND request_key=$1`, [requestKey]);
  assert.deepEqual((await listAiDraftAlerts(first)).items.map(item => item.status), ['COMPLETED']);
  await reviewAiDraftAlert(first, 'operator:four', 'pg-host', requestKey,
    '本机复核完成异常，外部账单待查', 'pg-review-four');
  assert.deepEqual((await listAiDraftAlertReviews(second)).items.map(item => item.status).sort(),
    ['COMPLETED', 'STARTED', 'UNKNOWN']);
  assert.equal((await listAiDraftAlerts(second)).total, 0);
  const { rows: original } = await second.query<{ status: string; reserved_fen: number; cost_status: string | null }>(
    'SELECT status,reserved_fen,cost_status FROM ai_draft_requests WHERE actor_id=$1 AND request_key=$2',
    ['pg-host', requestKey]);
  assert.deepEqual(original[0], { status: 'COMPLETED', reserved_fen: 20, cost_status: 'UNKNOWN' });
  const { rows: audits } = await first.query<{ count: number }>("SELECT count(*)::int AS count FROM audit WHERE action='AI_DRAFT_ALERT_REVIEW'");
  assert.equal(audits[0]?.count, 3);
  process.stdout.write(JSON.stringify({ database: databaseName, mode, schemaVersion: LATEST_SCHEMA_VERSION,
    concurrentSuccesses: 1, reviewCount: 3, reviewedStates: ['STARTED', 'UNKNOWN', 'COMPLETED'],
    reservedFen: 20, costStatus: 'UNKNOWN' }) + '\n');
} finally { await Promise.all([first?.close(), second?.close()]); }
