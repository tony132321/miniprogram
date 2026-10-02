// Child entry point for verify-postgres-process-crash.ts. It is never run alone.
import pg from 'pg';
import { createProductionDatabase, type Database } from '../src/db.ts';
import { runDueJobs } from '../src/jobs.ts';
import { register } from '../src/registrations.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const [mode, ...args] = process.argv.slice(2);
const db = await createProductionDatabase(url);
const signal = (stage: string, result?: { processed: number; failed: number }) =>
  process.stdout.write(JSON.stringify({ stage, ...(result ? { result } : {}) }) + '\n');
const waitForParentKill = async () => {
  const keepAlive = setInterval(() => {}, 1000);
  try { await new Promise<never>(() => {}); }
  finally { clearInterval(keepAlive); }
};

try {
  if (mode === 'produce') {
    const [eventId, version, inviteToken] = args;
    if (!eventId || !version || !inviteToken) throw new Error('produce requires event ID, version, and invitation');
    await register(db, 'crash_member', eventId, Number(version), 'process-crash-register', inviteToken);
    signal('COMMITTED');
    await waitForParentKill();
  } else if (mode === 'claim') {
    const [jobId] = args;
    if (!jobId) throw new Error('claim requires a job ID');
    let paused = false;
    const pausedDb: Database = {
      ...db,
      query: async <T extends Record<string, unknown> = Record<string, unknown>>(
        sql: string, params: unknown[] = []): Promise<{ rows: T[] }> => {
        const result = await db.query<T>(sql, params);
        if (!paused && sql.startsWith("UPDATE jobs SET status='PROCESSING'") && result.rows[0]?.id === jobId) {
          paused = true;
          signal('CLAIMED');
          await waitForParentKill();
        }
        return result;
      }
    };
    await runDueJobs(pausedDb);
    if (!paused) throw new Error('target job was never claimed');
  } else if (mode === 'send' || mode === 'run') {
    const provider = new pg.Client({ connectionString: url });
    await provider.connect();
    try {
      const result = await runDueJobs(db, undefined, { send: async notice => {
        await provider.query('INSERT INTO synthetic_provider_calls(notification_id,worker_mode) VALUES($1,$2)',
          [notice.id, mode]);
        if (mode === 'send') {
          if (notice.id !== args[0]) throw new Error('unexpected notification reached synthetic provider');
          signal('SEND_ENTERED');
          await waitForParentKill();
        }
        return { status: 'ACCEPTED', providerRef: `synthetic-${mode}` };
      } });
      if (mode === 'send') throw new Error('target notification did not reach synthetic provider');
      signal('DONE', result);
    } finally { await provider.end(); }
  } else throw new Error(`unknown child mode: ${mode}`);
} finally { await db.close(); }
