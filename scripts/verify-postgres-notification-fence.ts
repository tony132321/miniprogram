import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, type Database } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { changeEvent } from '../src/lifecycle.ts';
import { dispatchNotification, enqueueStartReminder, setConsent } from '../src/notifications.ts';
import { createPrivacyRequest } from '../src/operations.ts';
import { cancelRegistration } from '../src/registrations.ts';
import { publishApprovedInvite, register } from '../test/helpers.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const databaseName = validatePostgresTestUrl(url);
const probe = new pg.Pool({ connectionString: url, max: 1 });
try { await assertEmptyPostgresTestDatabase(probe, databaseName); }
finally { await probe.end(); }

const start = Date.now() + 7 * 24 * 60 * 60_000;
const input = { title: '跨池通知竞争', type: 'badminton', startAt: new Date(start).toISOString(),
  endAt: new Date(start + 2 * 60 * 60_000).toISOString(), timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
  registrationDeadline: new Date(start - 30 * 60_000).toISOString(),
  confirmationDeadline: new Date(start - 90 * 60_000).toISOString(), feeMode: 'FREE',
  feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO',
  hostParticipates: true };

type Fixture = { host: string; member: string; eventId: string; version: number;
  registrationId: string; notificationId: string };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function fixture(db: Database, index: number): Promise<Fixture> {
  const host = `pg_fence_host_${index}`;
  const member = `pg_fence_member_${index}`;
  await db.query('INSERT INTO users(id,wechat_openid) VALUES($1,$2)', [member, `synthetic-fence-${index}`]);
  const draft = await createDraft(db, host, input, `fence-draft-${index}`);
  const event = await publishApprovedInvite(db, host, draft.id, draft.version, `fence-publish-${index}`);
  await setConsent(db, member, 'EVENT_REMINDER', true, `fence-grant-${index}`);
  const registration = await register(db, member, event.id, event.version, `fence-register-${index}`);
  await db.query("UPDATE events SET status='CONFIRMED' WHERE id=$1", [event.id]);
  await enqueueStartReminder(db, event.id, member, event.version);
  const { rows } = await db.query<{ id: string }>(
    "SELECT id FROM notifications WHERE event_id=$1 AND user_id=$2 AND kind='EVENT_REMINDER'",
    [event.id, member]);
  return { host, member, eventId: event.id, version: event.version,
    registrationId: registration.id, notificationId: rows[0]!.id };
}

async function waitForBusinessLock(db: Database, operation: Promise<unknown>, label: string): Promise<void> {
  let settled = false;
  operation.then(() => { settled = true; }, () => { settled = true; });
  for (let attempt = 0; attempt < 200; attempt++) {
    if (settled) throw new Error(`${label} completed while provider call was pending`);
    const { rows } = await db.query<{ waiting: number }>(`SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname=current_database() AND wait_event_type='Lock' AND pid<>pg_backend_pid()`);
    if (rows[0]!.waiting > 0) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`${label} did not reach the expected PostgreSQL lock wait`);
}

let first: Database | undefined;
let second: Database | undefined;
let direct: pg.Pool | undefined;
try {
  [first, second] = await Promise.all([createProductionDatabase(url), createProductionDatabase(url)]);
  direct = new pg.Pool({ connectionString: url, max: 1 });
  const protectedTables = ['events', 'users', 'registrations', 'offers', 'privacy_requests',
    'notification_consents', 'event_safety_holds', 'emergency_gate',
    'public_recruitment_gate', 'public_recruitment_coverage', 'notifications'];
  const { rows: installed } = await direct.query<{ table_name: string }>(`SELECT c.relname AS table_name
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE NOT t.tgisinternal AND t.tgname LIKE '%_external_send_barrier'`);
  assert.deepEqual(installed.map(row => row.table_name).sort(), [...protectedTables].sort());
  const unrelated = await fixture(first, 999);
  const cases: Array<{ name: string; mutate: (item: Fixture, index: number) => Promise<unknown> }> = [
    { name: 'consent withdrawal', mutate: (item, index) =>
      setConsent(second!, item.member, 'EVENT_REMINDER', false, `fence-withdraw-${index}`) },
    { name: 'account disable', mutate: item =>
      second!.query("UPDATE users SET status='DISABLED' WHERE id=$1", [item.member]) },
    { name: 'direct SQL account disable', mutate: item =>
      direct!.query("UPDATE users SET status='DISABLED' WHERE id=$1", [item.member]) },
    { name: 'deletion request', mutate: (item, index) =>
      createPrivacyRequest(second!, item.member, { kind: 'DELETE' }, `fence-delete-${index}`) },
    { name: 'event version change', mutate: (item, index) =>
      changeEvent(second!, item.host, item.eventId, item.version,
        { title: `活动版本已变更 ${index}` }, `fence-change-${index}`) },
    { name: 'unrelated event version change', mutate: (_item, index) =>
      changeEvent(second!, unrelated.host, unrelated.eventId, unrelated.version,
        { title: `另一活动版本变更 ${index}` }, `fence-unrelated-change-${index}`) },
    { name: 'registration exit', mutate: (item, index) =>
      cancelRegistration(second!, item.member, item.registrationId, item.version, `fence-exit-${index}`) },
    { name: 'direct SQL registration exit', mutate: item =>
      direct!.query("UPDATE registrations SET status='CANCELLED' WHERE id=$1", [item.registrationId]) }
  ];
  let unrelatedProtectedWriteWaitMs = 0;
  for (const [index, scenario] of cases.entries()) {
    const item = await fixture(first, index);
    const entered = deferred();
    const release = deferred();
    let sends = 0;
    const sending = dispatchNotification(first, item.notificationId, { send: async () => {
      sends++;
      const { rows: openTransactions } = await second!.query<{ total: number }>(`SELECT count(*)::int AS total
        FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction'
          AND pid<>pg_backend_pid()`);
      assert.equal(openTransactions[0]!.total, 0, 'provider call held an open business transaction');
      entered.resolve();
      await release.promise;
      return { status: 'ACCEPTED', providerRef: `synthetic-fence-${index}` };
    } });
    let changing: Promise<unknown> | undefined;
    let changingStarted = 0;
    try {
      await Promise.race([entered.promise, sending.then(() => { throw new Error('provider was not entered'); })]);
      changingStarted = Date.now();
      changing = scenario.mutate(item, index);
      await waitForBusinessLock(first, changing, scenario.name);
      if (scenario.name === 'unrelated event version change')
        await new Promise(resolve => setTimeout(resolve, 200));
    } finally { release.resolve(); }
    await sending;
    await changing;
    if (scenario.name === 'unrelated event version change') {
      unrelatedProtectedWriteWaitMs = Date.now() - changingStarted;
      assert.ok(unrelatedProtectedWriteWaitMs >= 180,
        'unrelated event write did not visibly wait for the provider call');
    }
    await dispatchNotification(second, item.notificationId, { send: async () => {
      sends++;
      throw new Error('completed change must not start a second send');
    } });
    assert.equal(sends, 1, scenario.name);
    assert.equal((await second.query<{ external_status: string }>(
      'SELECT external_status FROM notifications WHERE id=$1', [item.notificationId]
    )).rows[0]?.external_status, 'PROVIDER_ACCEPTED', scenario.name);
    await assert.rejects(direct.query("UPDATE notifications SET external_status='NOT_REQUESTED' WHERE id=$1",
      [item.notificationId]), /cannot return to NOT_REQUESTED/);
  }
  const gapItem = await fixture(first, cases.length);
  const claimed = deferred();
  const resume = deferred();
  let firstTransaction = true;
  const paused: Database = { ...first, transaction: async fn => {
    const result = await first!.transaction(fn);
    if (firstTransaction) {
      firstTransaction = false;
      claimed.resolve();
      await resume.promise;
    }
    return result;
  } };
  let gapSends = 0;
  const gapDispatch = dispatchNotification(paused, gapItem.notificationId, { send: async () => {
    gapSends++;
    return { status: 'ACCEPTED', providerRef: 'must-not-send-after-withdrawal' };
  } });
  try {
    await Promise.race([claimed.promise, gapDispatch.then(() => { throw new Error('claim was not reached'); })]);
    await setConsent(second, gapItem.member, 'EVENT_REMINDER', false, 'gap-withdraw');
  } finally { resume.resolve(); }
  await gapDispatch;
  assert.equal(gapSends, 0, 'withdrawal after claim must suppress provider call');
  assert.equal((await second.query<{ external_status: string }>(
    'SELECT external_status FROM notifications WHERE id=$1', [gapItem.notificationId]
  )).rows[0]?.external_status, 'CONSENT_WITHDRAWN');
  const driftItem = await fixture(first, cases.length + 1);
  const driftClaimed = deferred();
  const driftResume = deferred();
  let driftFirstTransaction = true;
  const driftPaused: Database = { ...first, transaction: async fn => {
    const result = await first!.transaction(fn);
    if (driftFirstTransaction) {
      driftFirstTransaction = false;
      driftClaimed.resolve();
      await driftResume.promise;
    }
    return result;
  } };
  let driftSends = 0;
  const driftDispatch = dispatchNotification(driftPaused, driftItem.notificationId, { send: async () => {
    driftSends++;
    return { status: 'ACCEPTED', providerRef: 'must-not-send-after-metadata-drift' };
  } });
  try {
    await Promise.race([driftClaimed.promise, driftDispatch.then(() => { throw new Error('drift claim was not reached'); })]);
    await direct.query('UPDATE notifications SET detail=detail || $2::jsonb WHERE id=$1',
      [driftItem.notificationId, JSON.stringify({ drift: true })]);
  } finally { driftResume.resolve(); }
  await driftDispatch;
  assert.equal(driftSends, 0, 'metadata change after claim must suppress provider call');
  assert.equal((await second.query<{ external_status: string }>(
    'SELECT external_status FROM notifications WHERE id=$1', [driftItem.notificationId]
  )).rows[0]?.external_status, 'STALE_STATE');
  process.stdout.write(JSON.stringify({ database: databaseName, pools: 3,
    protectedRaces: cases.map(item => item.name), protectedTables,
    claimGapWithdrawalSuppressed: true, claimGapMetadataDriftSuppressed: true,
    providerCallHasOpenTransaction: false,
    unrelatedProtectedWriteWaitMs, syntheticProviderOnly: true }) + '\n');
} finally {
  await Promise.allSettled([first?.close(), second?.close(), direct?.end()]);
}
