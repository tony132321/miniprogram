import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION, type Database } from '../src/db.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { reviewHostStatus } from '../src/host-limits.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const databaseName = validatePostgresTestUrl(url);
const probe = new pg.Pool({ connectionString: url, max: 1 });
try { await assertEmptyPostgresTestDatabase(probe, databaseName); }
finally { await probe.end(); }

const startAt = Date.now() + 7 * 24 * 60 * 60_000;
const input = {
  title: '受控球局', type: 'badminton', startAt: new Date(startAt).toISOString(),
  endAt: new Date(startAt + 2 * 60 * 60_000).toISOString(), timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: new Date(startAt - 30 * 60_000).toISOString(),
  confirmationDeadline: new Date(startAt - 90 * 60_000).toISOString(), feeMode: 'AA', feeCapFen: 5000,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
} as const;

let first: Database | undefined;
let second: Database | undefined;
try {
  [first, second] = await Promise.all([createProductionDatabase(url), createProductionDatabase(url)]);
  const version = await first.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations');
  assert.equal(version.rows[0]?.version, LATEST_SCHEMA_VERSION);
  await first.query('INSERT INTO users(id,wechat_openid) VALUES($1,$2)',
    ['new-real-host', 'synthetic:pg-host-limits']);
  const drafts = await Promise.all([0, 1].map(index =>
    createDraft(first!, 'new-real-host', input, `pg-host-draft-${index}`, false)));
  const outcomes = await Promise.allSettled(drafts.map((draft, index) =>
    publishEvent(index === 0 ? first! : second!, 'new-real-host', draft.id, draft.version,
      `pg-host-publish-${index}`)));
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(outcome => outcome.status === 'rejected' &&
    (outcome.reason as { code?: string }).code === 'NEW_HOST_FREQUENCY_LIMIT').length, 1);
  const status = await reviewHostStatus(first, 'operator:safety', 'new-real-host', 'ESTABLISHED',
    '隔离库人工复核验证，不代表真实资质', 'pg-promote');
  assert.equal(status.status, 'ESTABLISHED');
  const remaining = outcomes.findIndex(outcome => outcome.status === 'rejected');
  const promoted = await publishEvent(second, 'new-real-host', drafts[remaining]!.id,
    drafts[remaining]!.version, `pg-host-promoted-${remaining}`);
  assert.equal(promoted.status, 'RECRUITING');
  process.stdout.write(JSON.stringify({ databaseName, schemaVersion: LATEST_SCHEMA_VERSION,
    concurrentAccepted: 1, concurrentRejected: 1, promotedStatus: status.status }) + '\n');
} finally {
  await Promise.all([first?.close(), second?.close()]);
}
