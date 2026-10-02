import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION, type Database } from '../src/db.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { reviewEvent } from '../src/event-review.ts';
import { createContent, moderateContent } from '../src/collaboration.ts';
import { markNotificationOpened } from '../src/notifications.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const databaseName = validatePostgresTestUrl(url);
const probe = new pg.Pool({ connectionString: url, max: 1 });
try { await assertEmptyPostgresTestDatabase(probe, databaseName); }
finally { await probe.end(); }

const startAt = Date.now() + 7 * 24 * 60 * 60_000;
const input = {
  title: '事件流验证活动', type: 'badminton', startAt: new Date(startAt).toISOString(),
  endAt: new Date(startAt + 2 * 60 * 60_000).toISOString(), timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: new Date(startAt - 30 * 60_000).toISOString(),
  confirmationDeadline: new Date(startAt - 90 * 60_000).toISOString(), feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
} as const;

let first: Database | undefined;
let second: Database | undefined;
try {
  [first, second] = await Promise.all([createProductionDatabase(url), createProductionDatabase(url)]);
  const version = await first.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations');
  assert.equal(version.rows[0]?.version, LATEST_SCHEMA_VERSION);
  const draft = await createDraft(first, 'synthetic-host', input, 'business-event-draft');
  const submitted = await publishEvent(first, 'synthetic-host', draft.id, draft.version, 'business-event-submit');
  await reviewEvent(first, 'operator:reviewer', draft.id, submitted.version, 'APPROVED',
    '隔离库合成活动审核', 'business-event-approve');
  const question = await createContent(first, 'synthetic-host', draft.id, 'QUESTION',
    '不得进入事件流的私人提问', null, 'business-event-question');
  await moderateContent(first, 'operator:reviewer', question.id, 'APPROVED', 'business-event-moderate');
  await first.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,status,external_status)
    VALUES('business-event-notice',$1,'synthetic-host','EVENT_UPDATED',$2,'IN_APP','UNAVAILABLE')`,
  [draft.id, submitted.version]);
  const opened = await Promise.allSettled([
    markNotificationOpened(first, 'synthetic-host', 'business-event-notice', 'open-first'),
    markNotificationOpened(second, 'synthetic-host', 'business-event-notice', 'open-second')
  ]);
  assert.equal(opened.filter(result => result.status === 'fulfilled').length, 2);
  const { rows } = await first.query<{ event_name: string; user_id_pseudonymous: string | null }>(
    `SELECT event_name,user_id_pseudonymous FROM business_events WHERE activity_id=$1
      AND event_name IN ('CONTENT_QUESTION','MODERATE_APPROVED','OPEN_NOTIFICATION')`, [draft.id]);
  assert.deepEqual(rows.map(row => row.event_name).sort(),
    ['CONTENT_QUESTION','MODERATE_APPROVED','OPEN_NOTIFICATION']);
  assert.ok(rows.every(row => /^[a-f0-9]{64}$/.test(row.user_id_pseudonymous ?? '')));
  assert.equal(JSON.stringify(rows).includes('私人提问'), false);
  process.stdout.write(JSON.stringify({ databaseName, schemaVersion: LATEST_SCHEMA_VERSION,
    contentEvents: rows.length, firstOpenEvents: rows.filter(row => row.event_name === 'OPEN_NOTIFICATION').length }) + '\n');
} finally {
  await Promise.all([first?.close(), second?.close()]);
}
