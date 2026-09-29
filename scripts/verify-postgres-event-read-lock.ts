// Synthetic local PostgreSQL proof for same-version event text cleanup.
// Creates one new irl_r1_test_* database and leaves it for inspection.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION, type Database } from '../src/db.ts';
import { getEvent } from '../src/events.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const port = process.env.IRL_PG_TEST_PORT ?? '55432';
if (!/^\d{2,5}$/.test(port)) throw new Error('IRL_PG_TEST_PORT must be numeric');
const baseUrl = process.env.IRL_PG_TEST_URL ?? `postgresql://127.0.0.1:${port}/irl_r1_test_local`;
validatePostgresTestUrl(baseUrl);
const connection = new URL(baseUrl);
const name = `irl_r1_test_event_read_lock_${Date.now()}_${randomBytes(3).toString('hex')}`;
connection.pathname = `/${name}`;
const url = connection.toString();
validatePostgresTestUrl(url);
connection.pathname = '/postgres';
const admin = new pg.Client({ connectionString: connection.toString() });
await admin.connect();
try {
  const state = await admin.query('SELECT current_database() AS database,host(inet_server_addr()) AS address');
  assert.equal(state.rows[0]?.database, 'postgres');
  assert.ok(state.rows[0]?.address, 'PostgreSQL must expose a network address through loopback');
  assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount, 0);
  await admin.query(`CREATE DATABASE "${name}"`);
} finally { await admin.end(); }

const probe = new pg.Client({ connectionString: url });
await probe.connect();
try { await assertEmptyPostgresTestDatabase(probe, name, { allowContainerServiceAddress: true }); }
finally { await probe.end(); }

const db = await createProductionDatabase(url);
const writer = new pg.Client({ connectionString: url });
const observer = new pg.Client({ connectionString: url });
await Promise.all([writer.connect(), observer.connect()]);
let releaseRead!: () => void;
let writerTransaction = false;
try {
  const eventId = 'pg-event-read-lock';
  const payload = {
    title: 'private host event text', visibility: 'INVITE', venueName: 'private host venue',
    cancellationRule: 'private host rule', startAt: '2027-01-02T12:00:00.000Z',
    endAt: '2027-01-02T14:00:00.000Z', registrationDeadline: '2027-01-02T11:30:00.000Z',
    confirmationDeadline: '2027-01-02T10:30:00.000Z'
  };
  await db.query("INSERT INTO users(id,wechat_openid) VALUES('pg-lock-host','pg-lock-host-openid'),('pg-lock-member','pg-lock-member-openid')");
  await db.query(`INSERT INTO events(id,host_id,status,version,payload,review_status)
    VALUES($1,'pg-lock-host','CONFIRMED',1,$2,'APPROVED')`, [eventId, JSON.stringify(payload)]);
  await db.query('INSERT INTO event_versions(event_id,version,payload) VALUES($1,1,$2)', [eventId, JSON.stringify(payload)]);
  await db.query(`INSERT INTO registrations(id,event_id,user_id,status)
    VALUES('pg-lock-registration',$1,'pg-lock-member','CONFIRMED')`, [eventId]);

  let reachedLock!: () => void;
  const locked = new Promise<void>(resolve => { reachedLock = resolve; });
  const holdRead = new Promise<void>(resolve => { releaseRead = resolve; });
  let pauseOnce = true;
  const reader: Database = {
    ...db,
    transaction: fn => db.transaction(tx => fn({
      query: async <T extends Record<string, unknown> = Record<string, unknown>>(
        sql: string, params: unknown[] = []): Promise<{ rows: T[] }> => {
        const result = await tx.query<T>(sql, params);
        if (pauseOnce && sql === 'SELECT id FROM events WHERE id=$1 FOR SHARE' && params[0] === eventId) {
          pauseOnce = false;
          reachedLock();
          await holdRead;
        }
        return result;
      }
    }))
  };
  const priorRead = getEvent(reader, 'pg-lock-member', eventId);
  await locked;
  const pid = Number((await writer.query('SELECT pg_backend_pid() AS pid')).rows[0]?.pid);
  await writer.query('BEGIN');
  writerTransaction = true;
  const update = writer.query(`UPDATE events SET payload=payload || $2::jsonb WHERE id=$1`,
    [eventId, JSON.stringify({ title: '已注销账号的活动', venueName: '已隐藏集合地点',
      cancellationRule: '原个人规则已移除' })]);
  let waiting = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    const { rows } = await observer.query<{ wait_event_type: string | null }>(
      'SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid]);
    if (rows[0]?.wait_event_type === 'Lock') { waiting = true; break; }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(waiting, true, 'same-version cleanup must wait for the event detail FOR SHARE lock');
  releaseRead();
  const before = await priorRead;
  assert.equal(before.payload.title, 'private host event text');
  await update;
  await writer.query(`UPDATE event_versions SET payload=payload || $2::jsonb WHERE event_id=$1`,
    [eventId, JSON.stringify({ title: '已注销账号的活动', venueName: '已隐藏集合地点',
      cancellationRule: '原个人规则已移除' })]);
  await writer.query('COMMIT');
  writerTransaction = false;
  const after = await getEvent(db, 'pg-lock-member', eventId);
  assert.equal(after.version, before.version);
  assert.equal(after.payload.title, '已注销账号的活动');
  assert.doesNotMatch(JSON.stringify(after), /private host event text|private host venue|private host rule/);
  console.log(JSON.stringify({ database: name, schemaVersion: LATEST_SCHEMA_VERSION,
    independentConnections: 2, writerWaitedOnEventLock: waiting,
    readBeforeCommit: before.payload.title, readAfterCommit: after.payload.title,
    versionUnchanged: before.version === after.version }));
} finally {
  if (releaseRead) releaseRead();
  if (writerTransaction) await writer.query('ROLLBACK');
  await Promise.all([writer.end(), observer.end(), db.close()]);
}
