import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase, createProductionDatabase, type Database } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { checkIn, confirmEvent, createCheckInToken } from '../src/lifecycle.ts';
import { validatePostgresTestUrl } from '../scripts/verify-postgres-guard.ts';
import { publishApprovedInvite, register } from './helpers.ts';

const secret = 'checkin-final-write-secret';
const postgresUrl = process.env.IRL_PG_CHECKIN_TEST_URL;
if (postgresUrl) validatePostgresTestUrl(postgresUrl);
const openDatabase = () => postgresUrl ? createProductionDatabase(postgresUrl) : createDatabase();
const input = { title: '签到写入边界', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z',
  feeMode: 'FREE', feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE',
  approvalMode: 'AUTO', hostParticipates: true };

async function confirmed(db: Database, key: string) {
  const draft = await createDraft(db, 'host', input, `${key}-draft`);
  const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, `${key}-publish`);
  for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, event.id, event.version, `${key}-${actor}`);
  await confirmEvent(db, 'host', event.id, event.version, `${key}-confirm`);
  return event;
}

async function noScanEvidence(db: Database, eventId: string) {
  const { rows: checkins } = await db.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM checkins WHERE event_id=$1', [eventId]);
  const { rows: audits } = await db.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action IN ('CHECK_IN','EVENT_STARTED')", [eventId]);
  assert.equal(checkins[0]?.n, 0);
  assert.equal(audits[0]?.n, 0);
}

test('scan writes one check-in at the final database time when the window and token are current', async () => {
  const db = await openDatabase();
  try {
    const event = await confirmed(db, 'current-write');
    const now = Date.now();
    await db.transaction(tx => tx.query("UPDATE events SET payload=payload || $2::jsonb WHERE id=$1", [event.id,
      JSON.stringify({ startAt: new Date(now - 10 * 60_000).toISOString(),
        endAt: new Date(now + 50 * 60_000).toISOString() })]));
    const token = createCheckInToken(event.id, secret);
    const result = await checkIn(db, 'host', event.id, event.version, token, secret, 'current-write-scan');
    assert.equal(result.evidence, 'SCAN');
    const { rows } = await db.query<{ evidence: string; checked_at: Date }>(
      'SELECT evidence,checked_at FROM checkins WHERE event_id=$1 AND user_id=$2', [event.id, 'host']);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.evidence, 'SCAN');
    assert.ok(Math.abs(new Date(rows[0]!.checked_at).getTime() - now) < 10_000);
  } finally { await db.close(); }
});

test('scan rolls back when the database check-in window closes before the final insert', async () => {
  const db = await openDatabase();
  try {
    const event = await confirmed(db, 'window-boundary');
    const deadline = Date.now() + 1500;
    const end = deadline - 30 * 60_000;
    await db.transaction(tx => tx.query("UPDATE events SET payload=payload || $2::jsonb WHERE id=$1", [event.id,
      JSON.stringify({ startAt: new Date(end - 60 * 60_000).toISOString(), endAt: new Date(end).toISOString() })]));
    const token = createCheckInToken(event.id, secret);
    let reachedInsert = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({ query: async (sql, params = []) => {
        if (sql.includes('INSERT INTO checkins(')) {
          reachedInsert = true;
          await new Promise(resolve => setTimeout(resolve, Math.max(0, deadline - Date.now() + 100)));
        }
        return tx.query(sql, params);
      } }))
    };
    await assert.rejects(() => checkIn(racingDb, 'host', event.id, event.version, token, secret,
      'window-boundary-scan'), { code: 'CHECKIN_CLOSED' });
    assert.equal(reachedInsert, true);
    await noScanEvidence(db, event.id);
  } finally { await db.close(); }
});

test('scan rolls back when the verified minute bucket is stale at final insert', async () => {
  const db = await openDatabase();
  try {
    const event = await confirmed(db, 'bucket-boundary');
    const priorMinute = Math.floor(Date.now() / 60_000) * 60_000 - 1000;
    await db.transaction(tx => tx.query("UPDATE events SET payload=payload || $2::jsonb WHERE id=$1", [event.id,
      JSON.stringify({ startAt: new Date(priorMinute - 60 * 60_000).toISOString(),
        endAt: new Date(priorMinute + 60 * 60_000).toISOString() })]));
    const token = createCheckInToken(event.id, secret, priorMinute);
    const stalePrecheckDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async <T extends Record<string, unknown> = Record<string, unknown>>(
          sql: string, params: unknown[] = []) => sql === 'SELECT clock_timestamp() AS current_time'
          ? { rows: [{ current_time: new Date(priorMinute) } as unknown as T] }
          : tx.query<T>(sql, params)
      }))
    };
    await assert.rejects(() => checkIn(stalePrecheckDb, 'host', event.id, event.version, token, secret,
      'bucket-boundary-scan'), { code: 'INVALID_CHECKIN_TOKEN' });
    await noScanEvidence(db, event.id);
  } finally { await db.close(); }
});
