import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

export interface Queryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Database extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
const migrations = [
  { version: 1, path: schemaPath },
  { version: 2, path: fileURLToPath(new URL('./migrations/0002_event_aliases.sql', import.meta.url)) },
  { version: 3, path: fileURLToPath(new URL('./migrations/0003_event_safety_holds.sql', import.meta.url)) },
  { version: 4, path: fileURLToPath(new URL('./migrations/0004_rate_limit_buckets.sql', import.meta.url)) },
  { version: 5, path: fileURLToPath(new URL('./migrations/0005_event_reviews.sql', import.meta.url)) },
  { version: 6, path: fileURLToPath(new URL('./migrations/0006_operator_auth.sql', import.meta.url)) },
  { version: 7, path: fileURLToPath(new URL('./migrations/0007_operator_session_binding.sql', import.meta.url)) },
  { version: 8, path: fileURLToPath(new URL('./migrations/0008_public_recruitment_gate.sql', import.meta.url)) },
  { version: 9, path: fileURLToPath(new URL('./migrations/0009_notification_followups.sql', import.meta.url)) },
  { version: 10, path: fileURLToPath(new URL('./migrations/0010_event_test_scope.sql', import.meta.url)) },
  { version: 11, path: fileURLToPath(new URL('./migrations/0011_support_minutes.sql', import.meta.url)) },
  { version: 12, path: fileURLToPath(new URL('./migrations/0012_business_events.sql', import.meta.url)) },
  { version: 13, path: fileURLToPath(new URL('./migrations/0013_report_resolution.sql', import.meta.url)) },
  { version: 14, path: fileURLToPath(new URL('./migrations/0014_appeal_notices.sql', import.meta.url)) },
  { version: 15, path: fileURLToPath(new URL('./migrations/0015_content_appeals.sql', import.meta.url)) },
  { version: 16, path: fileURLToPath(new URL('./migrations/0016_content_event_version.sql', import.meta.url)) },
  { version: 17, path: fileURLToPath(new URL('./migrations/0017_job_failure_codes.sql', import.meta.url)) },
  { version: 18, path: fileURLToPath(new URL('./migrations/0018_job_claim_tokens.sql', import.meta.url)) },
  { version: 19, path: fileURLToPath(new URL('./migrations/0019_expense_revisions.sql', import.meta.url)) },
  { version: 20, path: fileURLToPath(new URL('./migrations/0020_idempotency_request_hash.sql', import.meta.url)) },
  { version: 21, path: fileURLToPath(new URL('./migrations/0021_user_blocks.sql', import.meta.url)) },
  { version: 22, path: fileURLToPath(new URL('./migrations/0022_personal_export_tickets.sql', import.meta.url)) },
  { version: 23, path: fileURLToPath(new URL('./migrations/0023_registration_enqueue_sequence.sql', import.meta.url)) },
  { version: 24, path: fileURLToPath(new URL('./migrations/0024_emergency_gate.sql', import.meta.url)) },
  { version: 25, path: fileURLToPath(new URL('./migrations/0025_wechat_login_replay.sql', import.meta.url)) },
  { version: 26, path: fileURLToPath(new URL('./migrations/0026_cohost_grants.sql', import.meta.url)) },
  { version: 27, path: fileURLToPath(new URL('./migrations/0027_event_start_jobs.sql', import.meta.url)) },
  { version: 28, path: fileURLToPath(new URL('./migrations/0028_registration_anomaly_audit_index.sql', import.meta.url)) },
  { version: 29, path: fileURLToPath(new URL('./migrations/0029_event_end_prompts.sql', import.meta.url)) },
  { version: 30, path: fileURLToPath(new URL('./migrations/0030_outcome_issues.sql', import.meta.url)) },
  { version: 31, path: fileURLToPath(new URL('./migrations/0031_share_open_events.sql', import.meta.url)) },
  { version: 32, path: fileURLToPath(new URL('./migrations/0032_venue_evidence.sql', import.meta.url)) },
  { version: 33, path: fileURLToPath(new URL('./migrations/0033_venue_statement_phases.sql', import.meta.url)) },
  { version: 34, path: fileURLToPath(new URL('./migrations/0034_operational_business_events.sql', import.meta.url)) },
  { version: 35, path: fileURLToPath(new URL('./migrations/0035_notification_consent_history.sql', import.meta.url)) },
  { version: 36, path: fileURLToPath(new URL('./migrations/0036_current_consent_notice.sql', import.meta.url)) },
  { version: 37, path: fileURLToPath(new URL('./migrations/0037_ai_draft_requests.sql', import.meta.url)) },
  { version: 38, path: fileURLToPath(new URL('./migrations/0038_outcome_reviews.sql', import.meta.url)) },
  { version: 39, path: fileURLToPath(new URL('./migrations/0039_outcome_review_business_event.sql', import.meta.url)) },
  { version: 40, path: fileURLToPath(new URL('./migrations/0040_offer_status_history.sql', import.meta.url)) },
  { version: 41, path: fileURLToPath(new URL('./migrations/0041_event_status_history.sql', import.meta.url)) },
  { version: 42, path: fileURLToPath(new URL('./migrations/0042_registration_status_history.sql', import.meta.url)) }
];
export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1]!.version;
type MigrationExecutor = Queryable & { exec(sql: string): Promise<unknown> };

async function migrate(executor: MigrationExecutor): Promise<void> {
  await executor.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  for (const migration of migrations) {
    const sql = await readFile(migration.path, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const { rows } = await executor.query<{ checksum: string }>('SELECT checksum FROM schema_migrations WHERE version=$1', [migration.version]);
    if (rows[0]) {
      if (rows[0].checksum !== checksum) throw new Error(`Schema migration ${migration.version} checksum mismatch; add a new migration instead of editing applied SQL`);
      continue;
    }
    await executor.exec(sql);
    await executor.query('INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)', [migration.version, checksum]);
  }
}

export async function createDatabase(path?: string): Promise<Database> {
  const engine = path ? await PGlite.create(path) : await PGlite.create();
  try { await engine.transaction(tx => migrate(tx)); }
  catch (error) { await engine.close(); throw error; }
  return {
    query: (sql, params = []) => engine.query(sql, params),
    transaction: (fn) => engine.transaction((tx) => fn({ query: (sql, params = []) => tx.query(sql, params) })),
    close: () => engine.close()
  };
}

export async function createProductionDatabase(connectionString: string): Promise<Database> {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool({ connectionString });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(1229737265)');
      await migrate({
        query: async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => ({ rows: (await client.query(sql, params)).rows as T[] }),
        exec: async sql => { await client.query(sql); }
      });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } catch (error) { await pool.end(); throw error; }
  return {
    query: (sql, params = []) => pool.query(sql, params),
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (sql, params = []) => client.query(sql, params) });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
    close: () => pool.end()
  };
}
