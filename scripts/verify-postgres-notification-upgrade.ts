import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION, type Database } from '../src/db.ts';
import { validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const database = validatePostgresTestUrl(url);

const probe = new pg.Pool({ connectionString: url, max: 1 });
let before: Array<{ id: string; kind: string; external_status: string }> = [];
let queuedBefore = 0;
try {
  const { rows: versions } = await probe.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
  assert.deepEqual(versions.map(row => row.version), Array.from({ length: 48 }, (_, index) => index + 1),
    'target must be a copied schema 48 test database');
  before = (await probe.query<{ id: string; kind: string; external_status: string }>(
    'SELECT id,kind,external_status FROM notifications ORDER BY id')).rows;
  assert.ok(before.length > 0, 'upgrade test needs historical notices');
  const { rows: queued } = await probe.query<{ total: number }>(`SELECT count(DISTINCT n.id)::int AS total
    FROM notifications n JOIN jobs j ON j.kind='SEND_EXTERNAL' AND j.payload->>'notificationId'=n.id`);
  queuedBefore = queued[0]!.total;
  assert.ok(queuedBefore > 0, 'upgrade test needs historical external jobs');
} finally { await probe.end(); }

let first: Database | undefined;
let second: Database | undefined;
try {
  [first, second] = await Promise.all([createProductionDatabase(url), createProductionDatabase(url)]);
  const { rows: versions } = await first.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
  assert.deepEqual(versions.map(row => row.version), Array.from({ length: LATEST_SCHEMA_VERSION }, (_, index) => index + 1));
  const after = (await second.query<{ id: string; kind: string; external_status: string }>(
    'SELECT id,kind,external_status FROM notifications ORDER BY id')).rows;
  assert.deepEqual(after, before, 'migration must preserve every historical notice and outcome');
  const { rows: queued } = await second.query<{ total: number; missing_contract: number }>(`SELECT
    count(DISTINCT n.id)::int AS total,
    count(DISTINCT n.id) FILTER (WHERE n.external_purpose IS NULL OR n.template_slot IS NULL
      OR n.external_channel<>'WECHAT_SUBSCRIPTION' OR n.external_scheduled_at IS NULL)::int AS missing_contract
    FROM notifications n JOIN jobs j ON j.kind='SEND_EXTERNAL' AND j.payload->>'notificationId'=n.id`);
  assert.equal(queued[0]?.total, queuedBefore);
  assert.equal(queued[0]?.missing_contract, 0);
  console.log(JSON.stringify({ database, fromSchema: 48, toSchema: LATEST_SCHEMA_VERSION, pools: 2,
    preservedNotices: after.length, backfilledQueuedNotices: queuedBefore }));
} finally {
  await Promise.allSettled([first?.close(), second?.close()]);
}
