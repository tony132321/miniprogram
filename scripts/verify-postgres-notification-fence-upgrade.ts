import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION, type Database } from '../src/db.ts';
import { validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const database = validatePostgresTestUrl(url);
const direct = new pg.Pool({ connectionString: url, max: 1 });
const tableNames = ['events', 'users', 'registrations', 'offers', 'privacy_requests',
  'notification_consents', 'event_safety_holds', 'emergency_gate',
  'public_recruitment_gate', 'public_recruitment_coverage', 'notifications'];
let first: Database | undefined;
let second: Database | undefined;
try {
  const { rows: beforeVersion } = await direct.query<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version');
  assert.deepEqual(beforeVersion.map(row => row.version), Array.from({ length: 50 }, (_, i) => i + 1),
    'target must be a copied, populated schema 50 test database');
  const before = (await direct.query<{ id: string; external_status: string; provider_ref: string | null }>(
    'SELECT id,external_status,provider_ref FROM notifications ORDER BY id')).rows;
  assert.ok(before.length > 0);
  const { rows: priorJobs } = await direct.query<{ total: number }>('SELECT count(*)::int AS total FROM jobs');
  [first, second] = await Promise.all([createProductionDatabase(url), createProductionDatabase(url)]);
  const { rows: afterVersion } = await first.query<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version');
  assert.deepEqual(afterVersion.map(row => row.version),
    Array.from({ length: LATEST_SCHEMA_VERSION }, (_, i) => i + 1));
  const after = (await second.query<{ id: string; external_status: string; provider_ref: string | null }>(
    'SELECT id,external_status,provider_ref FROM notifications ORDER BY id')).rows;
  assert.deepEqual(after, before, 'historical notification results changed during upgrade');
  const { rows: jobs } = await second.query<{ total: number }>('SELECT count(*)::int AS total FROM jobs');
  assert.equal(jobs[0]?.total, priorJobs[0]?.total);
  const { rows: installed } = await direct.query<{ table_name: string }>(`SELECT c.relname AS table_name
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE NOT t.tgisinternal AND t.tgname LIKE '%_external_send_barrier'`);
  assert.deepEqual(installed.map(row => row.table_name).sort(), [...tableNames].sort());
  const accepted = after.find(row => row.external_status === 'PROVIDER_ACCEPTED');
  assert.ok(accepted, 'upgrade fixture needs a historical provider acceptance');
  await assert.rejects(direct.query("UPDATE notifications SET external_status='NOT_REQUESTED' WHERE id=$1",
    [accepted.id]), /cannot return to NOT_REQUESTED/);
  console.log(JSON.stringify({ database, fromSchema: 50, toSchema: LATEST_SCHEMA_VERSION,
    pools: 3, preservedNotices: after.length, preservedJobs: jobs[0]?.total,
    protectedTables: tableNames.length, resetRejected: true }));
} finally {
  await Promise.allSettled([first?.close(), second?.close(), direct.end()]);
}
