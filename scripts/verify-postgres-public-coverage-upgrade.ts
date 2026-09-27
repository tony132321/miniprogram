import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION, type Database } from '../src/db.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const databaseName = validatePostgresTestUrl(url);
const probe = new pg.Pool({ connectionString: url, max: 1 });
try { await assertEmptyPostgresTestDatabase(probe, databaseName); }
finally { await probe.end(); }

let db: Database | undefined;
try {
  // Reconstruct a version-42 schema and its historical OPEN row in an isolated synthetic database.
  db = await createProductionDatabase(url);
  assert.equal(LATEST_SCHEMA_VERSION, 44);
  await db.transaction(async tx => {
    await tx.query('DROP TABLE report_assignments');
    await tx.query('DROP FUNCTION public_recruitment_covered(timestamptz,timestamptz)');
    await tx.query('ALTER TABLE public_recruitment_gate DROP COLUMN coverage_id');
    await tx.query('DROP TABLE public_recruitment_coverage');
    await tx.query('DELETE FROM schema_migrations WHERE version>=43');
    await tx.query("DELETE FROM audit WHERE actor_id='system:migration-0043'");
    await tx.query(`UPDATE public_recruitment_gate SET status='OPEN',reason='旧版合成开放状态',
      changed_by='system:synthetic-version-42' WHERE id=1`);
  });
  assert.equal((await db.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations')).rows[0]?.version, 42);
  assert.equal((await db.query<{ status: string }>('SELECT status FROM public_recruitment_gate WHERE id=1')).rows[0]?.status, 'OPEN');
  await db.close(); db = undefined;

  db = await createProductionDatabase(url);
  const { rows: gate } = await db.query<{ status: string; changed_by: string; coverage_id: string | null }>(
    'SELECT status,changed_by,coverage_id FROM public_recruitment_gate WHERE id=1');
  assert.deepEqual(gate[0], { status: 'CLOSED', changed_by: 'system:migration-0043', coverage_id: null });
  const { rows: audit } = await db.query<{ reason: string }>(`SELECT detail->>'reason' AS reason FROM audit
    WHERE actor_id='system:migration-0043' AND action='PUBLIC_RECRUITMENT_CLOSED'`);
  assert.deepEqual(audit, [{ reason: 'COVERAGE_REQUIRED' }]);
  assert.equal((await db.query<{ covered: boolean }>(`SELECT public_recruitment_covered(
    clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day 2 hours') AS covered`)).rows[0]?.covered, false);
  assert.equal((await db.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations')).rows[0]?.version,
    LATEST_SCHEMA_VERSION);
  process.stdout.write(JSON.stringify({ database: databaseName, upgrade: '42-to-43',
    latestVersion: LATEST_SCHEMA_VERSION, historicalOpenClosed: true, systemAudit: true,
    noCoverageFailClosed: true }) + '\n');
} finally { await db?.close(); }
