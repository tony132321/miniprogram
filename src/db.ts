import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface Queryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Database extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  withExternalSendFence?<T>(fn: (fenced: Pick<Database, 'query' | 'transaction'>) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// One global namespace is intentionally conservative for the small R1 pilot:
// unrelated writes and other external sends wait while a provider is in flight.
// The sender holds a session lock; normal writers take the conflicting
// transaction lock before any business row lock.
const externalSendLock: [number, number] = [1229737265, 1];
const readOnlyTopLevelQuery = /^\s*(?:SELECT|SHOW|EXPLAIN)\b/i;
const transactionSettings = /^\s*SET\s+TRANSACTION\b/i;
const protectedTable = /\b(?:events|users|registrations|offers|privacy_requests|notification_consents|event_safety_holds|emergency_gate|public_recruitment_gate|public_recruitment_coverage|notifications)\b/i;
const rowLockOrWrite = /\b(?:FOR\s+(?:UPDATE|SHARE|NO\s+KEY\s+UPDATE|KEY\s+SHARE)|INSERT|UPDATE|DELETE|TRUNCATE|MERGE)\b/i;
const needsExternalSendBarrier = (sql: string) => protectedTable.test(sql) && rowLockOrWrite.test(sql);
const canRunUnfencedRead = (sql: string) => readOnlyTopLevelQuery.test(sql) &&
  !sql.includes(';') && !needsExternalSendBarrier(sql);
const externalSendContext = new AsyncLocalStorage<boolean>();

function localGate() {
  let tail = Promise.resolve();
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await fn(); } finally { release(); }
  };
}

function localSlots(limit: number) {
  let active = 0;
  const pending: Array<() => void> = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>(resolve => pending.push(resolve));
    else active++;
    try { return await fn(); }
    finally {
      const next = pending.shift();
      if (next) next();
      else active--;
    }
  };
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
  { version: 42, path: fileURLToPath(new URL('./migrations/0042_registration_status_history.sql', import.meta.url)) },
  { version: 43, path: fileURLToPath(new URL('./migrations/0043_public_coverage.sql', import.meta.url)) },
  { version: 44, path: fileURLToPath(new URL('./migrations/0044_report_assignments.sql', import.meta.url)) },
  { version: 45, path: fileURLToPath(new URL('./migrations/0045_ai_action_proposals.sql', import.meta.url)) },
  { version: 46, path: fileURLToPath(new URL('./migrations/0046_report_response_tracking.sql', import.meta.url)) },
  { version: 47, path: fileURLToPath(new URL('./migrations/0047_privacy_delete_protection.sql', import.meta.url)) },
  { version: 48, path: fileURLToPath(new URL('./migrations/0048_invite_event_review.sql', import.meta.url)) },
  { version: 49, path: fileURLToPath(new URL('./migrations/0049_notification_delivery_contract.sql', import.meta.url)) },
  { version: 50, path: fileURLToPath(new URL('./migrations/0050_event_alias_consent.sql', import.meta.url)) },
  { version: 51, path: fileURLToPath(new URL('./migrations/0051_external_send_barrier.sql', import.meta.url)) },
  { version: 52, path: fileURLToPath(new URL('./migrations/0052_ai_event_budget.sql', import.meta.url)) },
  { version: 53, path: fileURLToPath(new URL('./migrations/0053_host_publication_limits.sql', import.meta.url)) },
  { version: 54, path: fileURLToPath(new URL('./migrations/0054_ai_draft_alert_reviews.sql', import.meta.url)) },
  { version: 55, path: fileURLToPath(new URL('./migrations/0055_content_business_events.sql', import.meta.url)) },
  { version: 56, path: fileURLToPath(new URL('./migrations/0056_privacy_deletion_execution.sql', import.meta.url)) },
  { version: 57, path: fileURLToPath(new URL('./migrations/0057_privacy_quarantine.sql', import.meta.url)) },
  { version: 58, path: fileURLToPath(new URL('./migrations/0058_ai_semantic_requests.sql', import.meta.url)) },
  { version: 59, path: fileURLToPath(new URL('./migrations/0059_privacy_shared_deidentification.sql', import.meta.url)) },
  { version: 60, path: fileURLToPath(new URL('./migrations/0060_ai_semantic_alert_reviews.sql', import.meta.url)) },
  { version: 61, path: fileURLToPath(new URL('./migrations/0061_privacy_deletion_intent_and_event_tombstones.sql', import.meta.url)) },
  { version: 62, path: fileURLToPath(new URL('./migrations/0062_notification_deletion_recipient_guard.sql', import.meta.url)) },
  { version: 63, path: fileURLToPath(new URL('./migrations/0063_privacy_tombstone_write_guard.sql', import.meta.url)) },
  { version: 64, path: fileURLToPath(new URL('./migrations/0064_privacy_ai_input_expiry.sql', import.meta.url)) },
  { version: 65, path: fileURLToPath(new URL('./migrations/0065_privacy_ordinary_profile_expiry.sql', import.meta.url)) },
  { version: 66, path: fileURLToPath(new URL('./migrations/0066_system_business_events.sql', import.meta.url)) },
  { version: 67, path: fileURLToPath(new URL('./migrations/0067_me_events_lookup_indexes.sql', import.meta.url)) }
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
  const gate = localGate();
  const rawTransaction = <T>(fn: (tx: Queryable) => Promise<T>) =>
    engine.transaction((tx) => fn({ query: (sql, params = []) => tx.query(sql, params) }));
  return {
    query: (sql, params = []) => canRunUnfencedRead(sql) ? engine.query(sql, params) :
      externalSendContext.getStore() ? Promise.reject(new Error('Use the fenced database inside external send')) :
        gate(() => engine.query(sql, params)),
    transaction: fn => externalSendContext.getStore() ? Promise.reject(new Error('Use the fenced database inside external send')) :
      gate(() => rawTransaction(fn)),
    withExternalSendFence: fn => externalSendContext.getStore()
      ? Promise.reject(new Error('Nested external send fence is not allowed'))
      : gate(() => externalSendContext.run(true, () => fn({
        query: (sql, params = []) => engine.query(sql, params),
        transaction: rawTransaction
      }))),
    close: () => engine.close()
  };
}

export async function createProductionDatabase(connectionString: string): Promise<Database> {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  // Four pinned send sessions leave eight connections for reads and writers.
  const pool = new pg.Pool({ connectionString, max: 12 });
  const sendSlots = localSlots(4);
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(1229737265)');
      await client.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)', externalSendLock);
      await migrate({
        query: async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => ({ rows: (await client.query(sql, params)).rows as T[] }),
        exec: async sql => { await client.query(sql); }
      });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } catch (error) { await pool.end(); throw error; }
  const rawTransaction = async <T>(client: pg.PoolClient, fn: (tx: Queryable) => Promise<T>): Promise<T> => {
    await client.query('BEGIN');
    try {
      const result = await fn({ query: (sql, params = []) => client.query(sql, params) });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  };
  const guardedTransaction = async <T>(fn: (tx: Queryable) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      return await rawTransaction(client, async tx => {
        let guarded = false;
        return fn({ query: async <R extends Record<string, unknown>>(sql: string, params: unknown[] = []) => {
          if (!guarded && transactionSettings.test(sql)) return tx.query<R>(sql, params);
          if (!guarded && needsExternalSendBarrier(sql)) {
            await tx.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)', externalSendLock);
            guarded = true;
          }
          return tx.query<R>(sql, params);
        } });
      });
    } finally { client.release(); }
  };
  return {
    query: (sql, params = []) => externalSendContext.getStore() && !canRunUnfencedRead(sql)
      ? Promise.reject(new Error('Use the fenced database inside external send')) :
        needsExternalSendBarrier(sql) || sql.includes(';')
          ? guardedTransaction(tx => tx.query(sql, params)) : pool.query(sql, params),
    transaction: fn => externalSendContext.getStore() ? Promise.reject(new Error('Use the fenced database inside external send')) :
      guardedTransaction(fn),
    withExternalSendFence: fn => {
      if (externalSendContext.getStore()) throw new Error('Nested external send fence is not allowed');
      return sendSlots(async () => {
        const client = await pool.connect();
        let locked = false;
        let broken = false;
        try {
          await client.query('SELECT pg_advisory_lock($1::integer,$2::integer)', externalSendLock);
          locked = true;
          return await externalSendContext.run(true, () => fn({
            query: (sql, params = []) => client.query(sql, params),
            transaction: txFn => rawTransaction(client, txFn)
          }));
        } finally {
          if (locked) {
            try {
              const { rows } = await client.query<{ unlocked: boolean }>(
                'SELECT pg_advisory_unlock($1::integer,$2::integer) AS unlocked', externalSendLock);
              if (rows[0]?.unlocked !== true) broken = true;
            } catch { broken = true; }
          }
          client.release(broken ? new Error('External send lock connection lost') : undefined);
        }
      });
    },
    close: () => pool.end()
  };
}
