import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { loginWithWechat } from '../src/auth.ts';
import { createDraft } from '../src/events.ts';
import { publishEvent } from '../src/events.ts';
import { reviewEvent } from '../src/event-review.ts';
import { changeEvent, repeatEvent } from '../src/lifecycle.ts';
import { createApp } from '../src/server.ts';
import { getPilotMetrics } from '../src/metrics.ts';

const valid = (startAt: string) => {
  const start = Date.parse(startAt);
  return { title: '指标验收活动', type: 'badminton', startAt, endAt: new Date(start + 2 * 60 * 60_000).toISOString(),
    timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED',
    minParticipants: 4, maxParticipants: 6, registrationDeadline: new Date(start - 30 * 60_000).toISOString(),
    confirmationDeadline: new Date(start - 60 * 60_000).toISOString(), feeMode: 'FREE', feeCapFen: 0,
    cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };
};
const pilotUsers = ['host', 'host2', 'host3', 'host4', 'host5', 'host6', 'host7', 'real-host',
  'reused', 'single', 'immature', 'late-repeat', 'p1', 'p2', 'p3', 'p4'];

async function metricEvent(db: Awaited<ReturnType<typeof createDatabase>>, host: string, key: string, startAt: string,
  isTest = false) {
  const draft = await createDraft(db, host, valid(startAt), `${key}-draft`, isTest);
  return publishEvent(db, host, draft.id, draft.version, `${key}-publish`);
}

async function addEvidence(db: Awaited<ReturnType<typeof createDatabase>>, eventId: string, host: string,
  count: number, feedback: 'POSITIVE' | 'NEGATIVE' | 'NONE' = 'POSITIVE') {
  const ids = [host, 'p1', 'p2', 'p3', 'p4'].slice(0, count);
  for (const userId of ids) await db.query(
    "INSERT INTO checkins(id,event_id,user_id,evidence,checked_at) VALUES($1,$2,$3,'SCAN',$4)",
    [`${eventId}-${userId}`, eventId, userId, '2027-01-02T12:00:00.000Z']);
  await db.query("UPDATE events SET status='COMPLETED' WHERE id=$1", [eventId]);
  await db.query('INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at,disputed) VALUES($1,true,$2,$3,$4,$5)',
    [eventId, count, host, '2027-01-02T15:00:00.000Z', feedback === 'NEGATIVE']);
  if (feedback !== 'NONE') await db.query('INSERT INTO outcome_feedback(event_id,user_id,held,would_repeat) VALUES($1,$2,$3,false)',
    [eventId, 'p1', feedback === 'POSITIVE']);
}

test('event test scope defaults to test and a repeated event inherits it', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', { title: 'local fixture' }, 'default-test');
    const real = await createDraft(db, 'real-host', { title: 'real fixture' }, 'explicit-real', false);
    const { rows } = await db.query<{ id: string; is_test: boolean }>('SELECT id,is_test FROM events ORDER BY id');
    assert.equal(rows.find(row => row.id === draft.id)?.is_test, true);
    assert.equal(rows.find(row => row.id === real.id)?.is_test, false);
    await db.query("UPDATE events SET status='COMPLETED' WHERE id=$1", [real.id]);
    const next = await repeatEvent(db, 'real-host', real.id, 'repeat');
    const { rows: repeated } = await db.query<{ is_test: boolean }>('SELECT is_test FROM events WHERE id=$1', [next.id]);
    assert.equal(repeated[0]?.is_test, false);
  } finally { await db.close(); }
});

test('WQCA report and safety hold review states follow the requested as-of time', async () => {
  const db = await createDatabase();
  try {
    const event = await metricEvent(db, 'host', 'asof-review', '2027-01-02T12:00:00.000Z');
    await addEvidence(db, event.id, 'host', 4);
    const asOf = Date.parse('2027-01-04T00:00:00.000Z');
    const count = async () => (await getPilotMetrics(db, asOf, ['host', 'p1', 'p2', 'p3'])).dueEventCompletion;
    await db.query(`INSERT INTO reports(id,reporter_id,event_id,kind,description,created_at,updated_at)
      VALUES('asof-report','p1',$1,'SAFETY','待核查','2027-01-05T00:00:00Z','2027-01-05T00:00:00Z')`, [event.id]);
    assert.equal((await count()).evidenceQualified, 1, 'a future report cannot pause a past weekly count');
    await db.query(`UPDATE reports SET created_at='2027-01-03T00:00:00Z',status='RESOLVED',
      updated_at='2027-01-05T00:00:00Z' WHERE id='asof-report'`);
    assert.equal((await count()).pendingReview, 1, 'a report closed later was open at the cutoff');
    await db.query("UPDATE reports SET updated_at='2027-01-03T12:00:00Z' WHERE id='asof-report'");
    assert.equal((await count()).evidenceQualified, 1, 'a report closed before the cutoff no longer pauses it');
    await db.query(`INSERT INTO event_safety_holds(id,event_id,status,reason,created_by,created_at)
      VALUES('asof-hold',$1,'ACTIVE','待核查','operator:ops','2027-01-05T00:00:00Z')`, [event.id]);
    assert.equal((await count()).evidenceQualified, 1, 'a future hold cannot pause a past weekly count');
    await db.query(`UPDATE event_safety_holds SET created_at='2027-01-03T00:00:00Z',status='RELEASED',
      released_at='2027-01-05T00:00:00Z' WHERE id='asof-hold'`);
    assert.equal((await count()).pendingReview, 1, 'a hold released later was active at the cutoff');
    await db.query("UPDATE event_safety_holds SET released_at='2027-01-03T12:00:00Z' WHERE id='asof-hold'");
    assert.equal((await count()).evidenceQualified, 1, 'a hold released before the cutoff no longer pauses it');
  } finally { await db.close(); }
});

test('future negative outcome feedback does not change earlier WQCA or D30 evidence', async () => {
  const db = await createDatabase();
  try {
    const event = await metricEvent(db, 'host', 'late-dispute', '2027-01-02T12:00:00.000Z');
    await addEvidence(db, event.id, 'host', 4);
    await db.query('UPDATE outcomes SET disputed=true WHERE event_id=$1', [event.id]);
    await db.query(`INSERT INTO outcome_feedback(event_id,user_id,held,would_repeat,reason,created_at)
      VALUES($1,'p2',false,false,'活动未举办','2027-01-05T00:00:00Z')`, [event.id]);
    const before = await getPilotMetrics(db, Date.parse('2027-01-04T00:00:00Z'), ['host', 'p1', 'p2', 'p3']);
    assert.equal(before.dueEventCompletion.evidenceQualified, 1);
    assert.equal(before.participantReturn30d.observedParticipants, 4);
    const after = await getPilotMetrics(db, Date.parse('2027-01-06T00:00:00Z'), ['host', 'p1', 'p2', 'p3']);
    assert.equal(after.dueEventCompletion.pendingReview, 1);
    assert.equal(after.participantReturn30d.observedParticipants, 0);
  } finally { await db.close(); }
});

test('production activity scope comes from verified pilot identity, never the request body', async () => {
  const db = await createDatabase();
  const exchange = async (code: string) => ({ openid: code });
  const real = await loginWithWechat(db, exchange, 'wx-real');
  const testHost = await loginWithWechat(db, exchange, 'wx-test');
  const server = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'test-secret',
    wechatExchange: exchange, pilotUserIds: [real.userId] });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  const create = async (token: string, key: string, isTest: boolean) => {
    const response = await fetch(base + '/events', { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: key, isTest }) });
    return response;
  };
  try {
    const admitted = await create(real.token, 'real', true);
    assert.equal(admitted.status, 201);
    const realId = (await admitted.json() as { id: string }).id;
    const denied = await create(testHost.token, 'test', false);
    assert.equal(denied.status, 403);
    assert.equal((await denied.json() as { code: string }).code, 'PILOT_NOT_VERIFIED');
    const { rows } = await db.query<{ id: string; is_test: boolean; payload: Record<string, unknown> }>('SELECT id,is_test,payload FROM events');
    assert.equal(rows.find(row => row.id === realId)?.is_test, false);
    assert.equal(rows.length, 1);
    assert.equal(Object.hasOwn(rows.find(row => row.id === realId)?.payload ?? {}, 'isTest'), false);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});

test('development API always classifies new activities as test', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'development', devAuth: true, checkInSecret: 'test-secret' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/events`, { method: 'POST',
      headers: { 'X-Dev-User': 'host', 'Idempotency-Key': 'dev-draft', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'dev fixture', isTest: false }) });
    assert.equal(response.status, 201);
    const { id } = await response.json() as { id: string };
    const { rows } = await db.query<{ is_test: boolean }>('SELECT is_test FROM events WHERE id=$1', [id]);
    assert.equal(rows[0]?.is_test, true);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});

test('WQCA uses first published minimum, local weeks, individual evidence and excludes test activities', async () => {
  const db = await createDatabase();
  try {
    const qualified = await metricEvent(db, 'host', 'qualified', '2027-01-02T12:00:00.000Z');
    await addEvidence(db, qualified.id, 'host', 4);
    await db.query('INSERT INTO event_versions(event_id,version,payload) VALUES($1,3,$2)',
      [qualified.id, JSON.stringify({ ...qualified.payload, minParticipants: 5 })]);
    await db.query('UPDATE events SET payload=$2,version=3 WHERE id=$1',
      [qualified.id, JSON.stringify({ ...qualified.payload, minParticipants: 5 })]);

    const testEvent = await metricEvent(db, 'demo', 'test', '2027-01-02T12:00:00.000Z', true);
    await addEvidence(db, testEvent.id, 'demo', 4);

    const insufficient = await metricEvent(db, 'host2', 'insufficient', '2027-01-03T20:00:00.000Z');
    await addEvidence(db, insufficient.id, 'host2', 3);
    await db.query('UPDATE outcomes SET actual_count=4 WHERE event_id=$1', [insufficient.id]);

    const disputed = await metricEvent(db, 'host3', 'disputed', '2027-01-03T20:00:00.000Z');
    await addEvidence(db, disputed.id, 'host3', 4, 'NEGATIVE');

    const safety = await metricEvent(db, 'host4', 'safety', '2027-01-03T20:00:00.000Z');
    await addEvidence(db, safety.id, 'host4', 4);
    await db.query("INSERT INTO reports(id,reporter_id,event_id,kind,description) VALUES('safety-case','p2',$1,'SAFETY','待复核')", [safety.id]);

    const content = await metricEvent(db, 'host8', 'content', '2027-01-03T20:00:00.000Z');
    await addEvidence(db, content.id, 'host8', 4);
    await db.query("INSERT INTO reports(id,reporter_id,event_id,kind,description) VALUES('content-case','p2',$1,'CONTENT','待复核')", [content.id]);

    const noFeedback = await metricEvent(db, 'host6', 'no-feedback', '2027-01-03T20:00:00.000Z');
    await addEvidence(db, noFeedback.id, 'host6', 4, 'NONE');

    const held = await metricEvent(db, 'host7', 'held', '2027-01-03T20:00:00.000Z');
    await addEvidence(db, held.id, 'host7', 4);
    await db.query("INSERT INTO event_safety_holds(id,event_id,status,reason,created_by) VALUES('active-hold',$1,'ACTIVE','待核查','operator:ops')", [held.id]);

    const future = await metricEvent(db, 'host5', 'future', '2027-01-20T12:00:00.000Z');
    await addEvidence(db, future.id, 'host5', 4);

    const result = await getPilotMetrics(db, Date.parse('2027-01-10T00:00:00.000Z'), [...pilotUsers, 'host8']);
    assert.deepEqual(result.weeks, [
      { weekStart: '2026-12-28', qualified: 1, pendingReview: 0, unqualified: 0, reasons: {} },
      { weekStart: '2027-01-04', qualified: 0, pendingReview: 4, unqualified: 2,
        reasons: { INSUFFICIENT_CHECKINS: 1, OUTCOME_DISPUTED: 1, OPEN_EVENT_REPORT: 2,
          ACTIVE_SAFETY_HOLD: 1, NO_INDEPENDENT_FEEDBACK: 1 } }
    ]);
    assert.equal(JSON.stringify(result).includes(qualified.id), false);
    await db.query("UPDATE reports SET status='RESOLVED' WHERE id='safety-case'");
    const resolved = await getPilotMetrics(db, Date.parse('2027-01-10T00:00:00.000Z'), [...pilotUsers, 'host8']);
    assert.equal(resolved.weeks[1]?.qualified, 1);
  } finally { await db.close(); }
});

test('host reuse counts only mature non-test first-publish cohorts and does not invent profit', async () => {
  const db = await createDatabase();
  try {
    const publishedAt = async (host: string, key: string, date: string, startAt = '2027-01-20T12:00:00.000Z', isTest = false) => {
      const event = await metricEvent(db, host, key, startAt, isTest);
      await db.query('UPDATE event_versions SET created_at=$2 WHERE event_id=$1', [event.id, date]);
      return event;
    };
    await publishedAt('reused', 'first', '2026-12-01T00:00:00.000Z');
    const second = await publishedAt('reused', 'second', '2026-12-20T00:00:00.000Z');
    await addEvidence(db, second.id, 'reused', 4);
    await db.query("INSERT INTO expense_ledgers(id,event_id,total_fen,created_by,revision) VALUES('aa-note',$1,8000,'reused',1)", [second.id]);
    await publishedAt('single', 'only', '2026-12-15T00:00:00.000Z');
    await publishedAt('immature', 'young', '2027-01-20T00:00:00.000Z');
    await publishedAt('late-repeat', 'old', '2026-12-01T00:00:00.000Z');
    await publishedAt('late-repeat', 'too-late', '2027-01-05T00:00:00.000Z');
    await publishedAt('demo', 'test-first', '2026-12-01T00:00:00.000Z', '2027-01-20T12:00:00.000Z', true);
    await publishedAt('demo', 'test-second', '2026-12-20T00:00:00.000Z', '2027-01-20T12:00:00.000Z', true);

    const result = await getPilotMetrics(db, Date.parse('2027-02-01T00:00:00.000Z'), pilotUsers);
    assert.deepEqual(result.hostReuse28d, {
      maturedHosts: 3, reusedHosts: 1, rate: 1 / 3,
      secondEventDue: 1, secondEventQualified: 1, secondEventCompletionRate: 1
    });
    assert.deepEqual(result.contributionProfit, { status: 'UNAVAILABLE', missingInputs: [
      'confirmedRevenue', 'paymentFees', 'aiCosts', 'messageCosts', 'variableCloudCosts',
      'directSupportCosts', 'subsidies', 'riskLossProvision'
    ] });
    const early = await getPilotMetrics(db, Date.parse('2026-12-10T00:00:00.000Z'), pilotUsers);
    assert.equal(early.hostReuse28d.maturedHosts, 0);
    assert.equal(early.hostReuse28d.rate, null);
  } finally { await db.close(); }
});

test('public review submission is not publication for the 28-day host cohort or repeat', async () => {
  const db = await createDatabase();
  try {
    const publicDraft = await createDraft(db, 'pending-host',
      { ...valid('2027-03-10T12:00:00.000Z'), visibility: 'PUBLIC', approvalMode: 'MANUAL' }, 'pending-public-draft', false);
    const pending = await publishEvent(db, 'pending-host', publicDraft.id, publicDraft.version, 'pending-public-submit');
    await db.query('UPDATE event_versions SET created_at=$2 WHERE event_id=$1', [pending.id, '2026-12-01T00:00:00.000Z']);
    const cutoff = Date.parse('2027-02-01T00:00:00.000Z');
    assert.equal((await getPilotMetrics(db, cutoff, ['pending-host'])).hostReuse28d.maturedHosts, 0);
    assert.deepEqual((await getPilotMetrics(db, Date.parse('2027-03-20T00:00:00.000Z'), ['pending-host'])).weeks, []);

    const approvedDraft = await createDraft(db, 'approved-host',
      { ...valid('2027-03-10T12:00:00.000Z'), visibility: 'PUBLIC', approvalMode: 'MANUAL' }, 'approved-public-draft', false);
    const submitted = await publishEvent(db, 'approved-host', approvedDraft.id, approvedDraft.version, 'approved-public-submit');
    await db.query('UPDATE event_versions SET created_at=$2 WHERE event_id=$1', [submitted.id, '2026-12-01T00:00:00.000Z']);
    await reviewEvent(db, 'operator:reviewer', submitted.id, submitted.version, 'APPROVED', '场地信息已人工核实', 'approve-public');
    await db.query('UPDATE event_review_decisions SET reviewed_at=$2 WHERE event_id=$1', [submitted.id, '2026-12-15T00:00:00.000Z']);
    const repeat = await metricEvent(db, 'approved-host', 'approved-repeat', '2027-03-11T12:00:00.000Z');
    await db.query('UPDATE event_versions SET created_at=$2 WHERE event_id=$1', [repeat.id, '2026-12-30T00:00:00.000Z']);

    const initial = await metricEvent(db, 'unapproved-repeat-host', 'initial-invite', '2027-03-12T12:00:00.000Z');
    await db.query('UPDATE event_versions SET created_at=$2 WHERE event_id=$1', [initial.id, '2026-12-01T00:00:00.000Z']);
    const secondDraft = await createDraft(db, 'unapproved-repeat-host',
      { ...valid('2027-03-13T12:00:00.000Z'), visibility: 'PUBLIC', approvalMode: 'MANUAL' }, 'second-public-draft', false);
    const secondPending = await publishEvent(db, 'unapproved-repeat-host', secondDraft.id, secondDraft.version, 'second-public-submit');
    await db.query('UPDATE event_versions SET created_at=$2 WHERE event_id=$1', [secondPending.id, '2026-12-16T00:00:00.000Z']);

    const report = await getPilotMetrics(db, cutoff, ['pending-host', 'approved-host', 'unapproved-repeat-host']);
    assert.deepEqual(report.hostReuse28d, { maturedHosts: 2, reusedHosts: 1, rate: 0.5,
      secondEventDue: 0, secondEventQualified: 0, secondEventCompletionRate: null });
    assert.equal((await getPilotMetrics(db, Date.parse('2027-01-01T00:00:00.000Z'), ['approved-host']))
      .hostReuse28d.maturedHosts, 0);
  } finally { await db.close(); }
});

test('WQCA uses the minimum in the first approved public version', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'approved-public-host',
      { ...valid('2027-03-10T12:00:00.000Z'), visibility: 'PUBLIC', approvalMode: 'MANUAL' },
      'public-minimum-draft', false);
    const submitted = await publishEvent(db, 'approved-public-host', draft.id, draft.version, 'public-minimum-submit');
    await reviewEvent(db, 'operator:reviewer', submitted.id, submitted.version, 'REJECTED',
      '最低人数证据不足', 'public-minimum-reject');
    const changed = await changeEvent(db, 'approved-public-host', submitted.id, submitted.version,
      { minParticipants: 6 }, 'public-minimum-change');
    await reviewEvent(db, 'operator:reviewer', changed.id, changed.version, 'APPROVED',
      '六人最低人数已核对', 'public-minimum-approve');
    await db.query("UPDATE events SET status='COMPLETED' WHERE id=$1", [changed.id]);
    for (const userId of ['approved-public-host', 'p1', 'p2', 'p3'])
      await db.query("INSERT INTO checkins(id,event_id,user_id,evidence,checked_at) VALUES($1,$2,$3,'SCAN',$4)",
        [`${changed.id}-${userId}`, changed.id, userId, '2027-03-10T12:30:00.000Z']);
    await db.query('INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at) VALUES($1,true,4,$2,$3)',
      [changed.id, 'approved-public-host', '2027-03-10T15:00:00.000Z']);
    await db.query('INSERT INTO outcome_feedback(event_id,user_id,held,would_repeat,created_at) VALUES($1,$2,true,true,$3)',
      [changed.id, 'p1', '2027-03-10T15:01:00.000Z']);
    const report = await getPilotMetrics(db, Date.parse('2027-03-20T00:00:00.000Z'),
      ['approved-public-host', 'p1', 'p2', 'p3']);
    assert.equal(report.weeks[0]?.qualified, 0);
    assert.equal(report.weeks[0]?.unqualified, 1);
    assert.equal(report.weeks[0]?.reasons.INSUFFICIENT_ACTUAL_COUNT, 1);
  } finally { await db.close(); }
});

test('an event joined by a user outside the verified pilot allowlist is excluded from pilot metrics', async () => {
  const db = await createDatabase();
  try {
    const event = await metricEvent(db, 'real-host', 'mixed', '2027-01-02T12:00:00.000Z');
    await addEvidence(db, event.id, 'real-host', 4);
    await db.query("INSERT INTO registrations(id,event_id,user_id,status) VALUES('test-registration',$1,'p1','CONFIRMED')", [event.id]);
    const cutoff = Date.parse('2027-01-10T00:00:00.000Z');
    assert.equal((await getPilotMetrics(db, cutoff, ['real-host', 'p1'])).weeks[0]?.qualified, 1);
    assert.deepEqual((await getPilotMetrics(db, cutoff, ['real-host'])).weeks, []);
  } finally { await db.close(); }
});

test('due completion excludes an ongoing event and defers the 70 percent gate until 100 due events', async () => {
  const db = await createDatabase();
  try {
    const qualified = await metricEvent(db, 'host', 'due-qualified', '2027-01-02T12:00:00.000Z');
    await addEvidence(db, qualified.id, 'host', 4);
    await metricEvent(db, 'host2', 'due-unqualified', '2027-01-03T12:00:00.000Z');
    const pending = await metricEvent(db, 'host3', 'due-pending', '2027-01-03T12:00:00.000Z');
    await addEvidence(db, pending.id, 'host3', 4, 'NEGATIVE');
    await metricEvent(db, 'host4', 'still-running', '2027-01-04T11:00:00.000Z');
    const result = await getPilotMetrics(db, Date.parse('2027-01-04T12:00:00.000Z'), pilotUsers);
    assert.deepEqual(result.dueEventCompletion, {
      dueEvents: 3, evidenceQualified: 1, pendingReview: 1, unqualified: 1,
      evidenceQualifiedRate: 1 / 3, possibleRateAfterReview: 1 / 3,
      minimumSampleMet: false, threshold70Met: null
    });
    assert.equal(result.weeks.reduce((sum, week) => sum + week.qualified + week.pendingReview + week.unqualified, 0), 3);
    assert.equal(result.directSupportMinutes.dueEvents, 3);
    const empty = await getPilotMetrics(db, Date.parse('2027-01-01T00:00:00.000Z'), pilotUsers);
    assert.equal(empty.dueEventCompletion.evidenceQualifiedRate, null);
    assert.equal(empty.dueEventCompletion.threshold70Met, null);
  } finally { await db.close(); }
});

test('D30 counts distinct verified return participants only after a complete observation window', async () => {
  const db = await createDatabase();
  try {
    const start = '2027-01-02T12:00:00.000Z';
    const base = JSON.stringify(valid(start));
    const repeat = JSON.stringify(valid('2027-01-20T12:00:00.000Z'));
    const late = JSON.stringify(valid('2027-02-05T12:00:00.000Z'));
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test) VALUES
      ('d30-first','host','COMPLETED',2,$1::jsonb,false),
      ('d30-return','host','COMPLETED',2,$2::jsonb,false),
      ('d30-late','host','COMPLETED',2,$3::jsonb,false),
      ('d30-test','host','COMPLETED',2,$2::jsonb,true)`, [base, repeat, late]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
      SELECT id,version,payload,'2027-01-01T00:00:00.000Z' FROM events WHERE id LIKE 'd30-%'`);
    await db.query(`INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at) VALUES
      ('d30-first',true,4,'host','2027-01-02T15:00:00.000Z'),
      ('d30-return',true,4,'host','2027-01-20T15:00:00.000Z'),
      ('d30-late',true,4,'host','2027-02-05T15:00:00.000Z'),
      ('d30-test',true,4,'host','2027-01-20T15:00:00.000Z')`);
    await db.query(`INSERT INTO checkins(id,event_id,user_id,evidence,checked_at) VALUES
      ('d30-a1','d30-first','p1','SCAN','2027-01-02T12:30:00.000Z'),
      ('d30-a2','d30-return','p1','SCAN','2027-01-20T12:30:00.000Z'),
      ('d30-b1','d30-first','p2','SCAN','2027-01-02T12:30:00.000Z'),
      ('d30-b2','d30-late','p2','SCAN','2027-02-05T12:30:00.000Z'),
      ('d30-c1','d30-first','p3','SCAN','2027-01-02T12:30:00.000Z'),
      ('d30-c2','d30-return','p3','SCAN','2027-01-20T12:30:00.000Z'),
      ('d30-d1','d30-first','p4','SCAN','2027-01-02T12:30:00.000Z'),
      ('d30-d2','d30-test','p4','SCAN','2027-01-20T12:30:00.000Z')`);
    await db.query("UPDATE checkins SET disputed=true WHERE id='d30-c2'");
    const early = (await getPilotMetrics(db, Date.parse('2027-01-31T14:00:00.000Z'), pilotUsers)).participantReturn30d;
    assert.deepEqual(early, { observedParticipants: 4, maturedParticipants: 0, returnedParticipants: 0,
      pendingFirstParticipants: 0, pendingReturnParticipants: 0, rate: null, possibleRateAfterReview: null,
      minimumSampleMet: false, threshold25Met: null });
    const mature = (await getPilotMetrics(db, Date.parse('2027-02-02T14:00:00.000Z'), pilotUsers)).participantReturn30d;
    assert.deepEqual(mature, { observedParticipants: 4, maturedParticipants: 4, returnedParticipants: 1,
      pendingFirstParticipants: 0, pendingReturnParticipants: 0, rate: 0.25, possibleRateAfterReview: 0.25,
      minimumSampleMet: false, threshold25Met: null });
    await db.query("INSERT INTO registrations(id,event_id,user_id,status) VALUES('d30-outsider','d30-return','outsider','CANCELLED')");
    const excluded = (await getPilotMetrics(db, Date.parse('2027-02-02T14:00:00.000Z'), pilotUsers)).participantReturn30d;
    assert.equal(excluded.returnedParticipants, 0);
    await db.query("DELETE FROM registration_status_history WHERE registration_id='d30-outsider'");
    await db.query("DELETE FROM registrations WHERE id='d30-outsider'");
    await db.query(`INSERT INTO checkins(id,event_id,user_id,evidence,checked_at)
      SELECT 'd30-extra-'||n,'d30-first','d30-user-'||n,'SCAN','2027-01-02T12:30:00.000Z'
      FROM generate_series(1,96) AS n`);
    const cohort = [...pilotUsers, ...Array.from({ length: 96 }, (_, i) => `d30-user-${i + 1}`)];
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test)
      VALUES('d30-pending','host','IN_PROGRESS',2,$1::jsonb,false)`, [JSON.stringify(valid('2027-02-01T11:00:00.000Z'))]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
      SELECT id,version,payload,'2027-01-01T00:00:00.000Z' FROM events WHERE id='d30-pending'`);
    await db.query(`INSERT INTO checkins(id,event_id,user_id,evidence,checked_at)
      SELECT 'd30-pending-'||n,'d30-pending','d30-user-'||n,'SCAN','2027-02-01T12:00:00.000Z'
      FROM generate_series(1,30) AS n`);
    const pending = (await getPilotMetrics(db, Date.parse('2027-02-01T12:30:00.000Z'), cohort)).participantReturn30d;
    assert.equal(pending.maturedParticipants, 100);
    assert.equal(pending.returnedParticipants, 1);
    assert.equal(pending.pendingReturnParticipants, 30);
    assert.equal(pending.threshold25Met, null);
    await db.query("UPDATE events SET status='CANCELLED' WHERE id='d30-pending'");
    const below = (await getPilotMetrics(db, Date.parse('2027-02-02T14:00:00.000Z'), cohort)).participantReturn30d;
    assert.deepEqual(below, { observedParticipants: 100, maturedParticipants: 100, returnedParticipants: 1,
      pendingFirstParticipants: 0, pendingReturnParticipants: 0, rate: 0.01, possibleRateAfterReview: 0.01,
      minimumSampleMet: true, threshold25Met: false });
    await db.query(`INSERT INTO checkins(id,event_id,user_id,evidence,checked_at)
      SELECT 'd30-repeat-'||n,'d30-return','d30-user-'||n,'SCAN','2027-01-20T12:30:00.000Z'
      FROM generate_series(1,24) AS n`);
    const reached = (await getPilotMetrics(db, Date.parse('2027-02-02T14:00:00.000Z'), cohort)).participantReturn30d;
    assert.equal(reached.rate, 0.25);
    assert.equal(reached.threshold25Met, true);
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test)
      VALUES('d30-first-pending','host','IN_PROGRESS',2,$1::jsonb,false)`, [base]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
      SELECT id,version,payload,'2027-01-01T00:00:00.000Z' FROM events WHERE id='d30-first-pending'`);
    await db.query(`INSERT INTO checkins(id,event_id,user_id,evidence,checked_at)
      VALUES('d30-first-pending-check','d30-first-pending','d30-new-user','SCAN','2027-01-02T12:30:00.000Z')`);
    const uncertain = (await getPilotMetrics(db, Date.parse('2027-02-02T14:00:00.000Z'), [...cohort, 'd30-new-user']))
      .participantReturn30d;
    assert.equal(uncertain.maturedParticipants, 100);
    assert.equal(uncertain.pendingFirstParticipants, 1);
    assert.equal(uncertain.threshold25Met, null);
    await db.query("UPDATE events SET status='CANCELLED' WHERE id='d30-first-pending'");
    const resolved = (await getPilotMetrics(db, Date.parse('2027-02-02T14:00:00.000Z'), [...cohort, 'd30-new-user']))
      .participantReturn30d;
    assert.equal(resolved.pendingFirstParticipants, 0);
    assert.equal(resolved.threshold25Met, true);
  } finally { await db.close(); }
});

test('D30 return uses check-in time when the second event ends after the window boundary', async () => {
  const db = await createDatabase();
  try {
    const firstPayload = JSON.stringify(valid('2027-01-02T12:00:00.000Z'));
    const laterPayload = JSON.stringify(valid('2027-02-01T11:00:00.000Z'));
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test) VALUES
      ('boundary-first','host','COMPLETED',2,$1::jsonb,false),
      ('boundary-return','host','COMPLETED',2,$2::jsonb,false)`, [firstPayload, laterPayload]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
      SELECT id,version,payload,'2027-01-01T00:00:00.000Z' FROM events WHERE id LIKE 'boundary-%'`);
    await db.query(`INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at) VALUES
      ('boundary-first',true,4,'host','2027-01-02T15:00:00.000Z'),
      ('boundary-return',true,4,'host','2027-02-01T14:00:00.000Z')`);
    await db.query(`INSERT INTO checkins(id,event_id,user_id,evidence,checked_at) VALUES
      ('boundary-a','boundary-first','p1','SCAN','2027-01-02T12:30:00.000Z'),
      ('boundary-b','boundary-return','p1','SCAN','2027-02-01T12:00:00.000Z')`);
    const report = (await getPilotMetrics(db, Date.parse('2027-02-02T15:00:00.000Z'), ['host', 'p1'])).participantReturn30d;
    assert.equal(report.maturedParticipants, 1);
    assert.equal(report.returnedParticipants, 1);
  } finally { await db.close(); }
});

test('D30 uses event time for a manual check-in confirmed after a later scanned event', async () => {
  const db = await createDatabase();
  try {
    const firstPayload = JSON.stringify(valid('2027-01-01T12:00:00.000Z'));
    const secondPayload = JSON.stringify(valid('2027-01-05T12:00:00.000Z'));
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test) VALUES
      ('manual-first','host','COMPLETED',2,$1::jsonb,false),
      ('manual-second','host','COMPLETED',2,$2::jsonb,false)`, [firstPayload, secondPayload]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
      SELECT id,version,payload,'2026-12-31T00:00:00.000Z' FROM events WHERE id LIKE 'manual-%'`);
    await db.query(`INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at) VALUES
      ('manual-first',true,4,'host','2027-01-01T15:00:00.000Z'),
      ('manual-second',true,4,'host','2027-01-05T15:00:00.000Z')`);
    await db.query(`INSERT INTO checkins(id,event_id,user_id,evidence,checked_at) VALUES
      ('manual-a','manual-first','p1','MANUAL_CONFIRMED','2027-01-07T12:00:00.000Z'),
      ('manual-b','manual-second','p1','SCAN','2027-01-05T12:30:00.000Z')`);
    const report = (await getPilotMetrics(db, Date.parse('2027-02-01T14:30:00.000Z'), ['host', 'p1'])).participantReturn30d;
    assert.equal(report.maturedParticipants, 1);
    assert.equal(report.returnedParticipants, 1);
  } finally { await db.close(); }
});

test('a mature due cohort leaves the threshold undecided when pending review could change the result', async () => {
  const db = await createDatabase();
  try {
    const payload = JSON.stringify(valid('2027-01-02T12:00:00.000Z'));
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test)
      SELECT 'gate-'||n,'host','COMPLETED',2,$1::jsonb,false FROM generate_series(1,100) AS n`, [payload]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
      SELECT id,2,payload,'2026-12-01T00:00:00.000Z' FROM events WHERE id LIKE 'gate-%'`);
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status)
      SELECT 'host-'||id,id,'host','CONFIRMED' FROM events WHERE id LIKE 'gate-%'`);
    await db.query(`INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at,disputed)
      SELECT id,true,4,'host','2027-01-02T15:00:00.000Z',false FROM events
      WHERE id LIKE 'gate-%' AND substring(id from 6)::int<=69`);
    await db.query(`INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at,disputed)
      SELECT id,true,4,'host','2027-01-02T15:00:00.000Z',true FROM events WHERE id IN ('gate-70','gate-71')`);
    await db.query(`INSERT INTO checkins(id,event_id,user_id,evidence,checked_at)
      SELECT e.id||'-'||person.user_id,e.id,person.user_id,'SCAN','2027-01-02T12:30:00.000Z'
      FROM events e CROSS JOIN (VALUES ('host'),('p1'),('p2'),('p3')) AS person(user_id)
      WHERE e.id LIKE 'gate-%' AND substring(e.id from 6)::int<=71`);
    await db.query(`INSERT INTO outcome_feedback(event_id,user_id,held,would_repeat,created_at)
      SELECT id,'p1',true,true,'2027-01-02T15:01:00.000Z' FROM events
      WHERE id LIKE 'gate-%' AND substring(id from 6)::int<=71`);
    const at = Date.parse('2027-01-10T00:00:00.000Z');
    const first = (await getPilotMetrics(db, at, ['host', 'p1', 'p2', 'p3'])).dueEventCompletion;
    assert.equal(first.dueEvents, 100);
    assert.equal(first.evidenceQualifiedRate, 0.69);
    assert.equal(first.possibleRateAfterReview, 0.71);
    assert.equal(first.minimumSampleMet, true);
    assert.equal(first.threshold70Met, null);
    await db.query("UPDATE events SET status='CANCELLED' WHERE id IN ('gate-70','gate-71')");
    const cancelled = (await getPilotMetrics(db, at, ['host', 'p1', 'p2', 'p3'])).dueEventCompletion;
    assert.equal(cancelled.pendingReview, 2);
    assert.equal(cancelled.possibleRateAfterReview, 0.69);
    assert.equal(cancelled.threshold70Met, false);
    await db.query("UPDATE events SET status='COMPLETED' WHERE id IN ('gate-70','gate-71')");
    await db.query("UPDATE outcomes SET disputed=false,held=false WHERE event_id IN ('gate-70','gate-71')");
    const resolved = (await getPilotMetrics(db, at, ['host', 'p1', 'p2', 'p3'])).dueEventCompletion;
    assert.equal(resolved.threshold70Met, false);
    await db.query("UPDATE outcomes SET held=true WHERE event_id='gate-70'");
    const reached = (await getPilotMetrics(db, at, ['host', 'p1', 'p2', 'p3'])).dueEventCompletion;
    assert.equal(reached.evidenceQualifiedRate, 0.7);
    assert.equal(reached.threshold70Met, true);
  } finally { await db.close(); }
});

test('waitlist offer diagnostic separates accepted, expired, cancelled and still active invitations', async () => {
  const db = await createDatabase();
  try {
    const asOf = Date.parse('2027-01-10T00:00:00.000Z');
    const event = await metricEvent(db, 'host', 'offer-metric', '2027-01-02T12:00:00.000Z');
    const states = [
      ['p1', 'ACCEPTED', '2027-01-03T00:00:00.000Z', 'CONFIRMED'],
      ['p2', 'EXPIRED', '2027-01-03T00:00:00.000Z', 'EXPIRED'],
      ['p3', 'ACTIVE', '2027-01-03T00:00:00.000Z', 'OFFERED'],
      ['p4', 'CANCELLED', '2027-01-03T00:00:00.000Z', 'CANCELLED'],
      ['p5', 'ACTIVE', '2027-01-20T00:00:00.000Z', 'OFFERED']
    ] as const;
    for (const [user, status, expiresAt, registrationStatus] of states) {
      await db.query('INSERT INTO registrations(id,event_id,user_id,status) VALUES($1,$2,$3,$4)',
        [`offer-reg-${user}`, event.id, user, registrationStatus]);
      await db.query('INSERT INTO offers(id,event_id,registration_id,expires_at,status) VALUES($1,$2,$3,$4,$5)',
        [`offer-${user}`, event.id, `offer-reg-${user}`, expiresAt, status]);
    }
    const testEvent = await metricEvent(db, 'host', 'offer-test', '2027-01-02T12:00:00.000Z', true);
    await db.query("INSERT INTO registrations(id,event_id,user_id,status) VALUES('test-offer-reg',$1,'p1','CONFIRMED')", [testEvent.id]);
    await db.query("INSERT INTO offers(id,event_id,registration_id,expires_at,status) VALUES('test-offer',$1,'test-offer-reg','2027-01-03','ACCEPTED')", [testEvent.id]);
    const outside = await metricEvent(db, 'host', 'offer-outside', '2027-01-02T12:00:00.000Z');
    await db.query("INSERT INTO registrations(id,event_id,user_id,status) VALUES('outside-offer-reg',$1,'outsider','CONFIRMED')", [outside.id]);
    await db.query("INSERT INTO offers(id,event_id,registration_id,expires_at,status) VALUES('outside-offer',$1,'outside-offer-reg','2027-01-03','ACCEPTED')", [outside.id]);
    const result = await getPilotMetrics(db, asOf, ['host', 'p1', 'p2', 'p3', 'p4', 'p5']);
    assert.deepEqual(result.waitlistOfferConversion, { issued: 5, accepted: 1, expired: 2, cancelled: 1,
      active: 1, unclassified: 0, matured: 3, acceptanceRate: 1 / 3 });
    assert.equal(JSON.stringify(result).includes(event.id), false);
  } finally { await db.close(); }
});

test('an offer accepted after the report cutoff stays active in the earlier report', async () => {
  const db = await createDatabase();
  try {
    const event = await metricEvent(db, 'host', 'offer-history', '2027-01-02T12:00:00.000Z');
    await db.query("INSERT INTO registrations(id,event_id,user_id,status) VALUES('offer-history-reg',$1,'p1','OFFERED')", [event.id]);
    await db.query(`INSERT INTO offers(id,event_id,registration_id,expires_at,status)
      VALUES('offer-history-one',$1,'offer-history-reg','2027-01-01T00:00:00Z','ACTIVE')`, [event.id]);
    const { rows: cutoff } = await db.query<{ at: Date }>('SELECT clock_timestamp() AS at');
    await new Promise(resolve => setTimeout(resolve, 20));
    await db.query("UPDATE offers SET status='ACCEPTED' WHERE id='offer-history-one'");
    const pilot = ['host', 'p1'];
    const earlier = (await getPilotMetrics(db, new Date(cutoff[0]!.at).getTime() + 1, pilot)).waitlistOfferConversion;
    assert.equal(earlier.issued, 1);
    assert.equal(earlier.active, 1);
    assert.equal(earlier.accepted, 0);
    const later = (await getPilotMetrics(db, Date.now() + 1000, pilot)).waitlistOfferConversion;
    assert.equal(later.accepted, 1);
    assert.equal(later.active, 0);
  } finally { await db.close(); }
});

test('later activity cancellation and schedule change do not rewrite an earlier pilot report', async () => {
  const db = await createDatabase();
  try {
    const first = valid('2026-07-01T12:00:00.000Z');
    const later = valid('2027-07-01T12:00:00.000Z');
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test,created_at)
      VALUES('history-event','host','CONFIRMED',2,$1::jsonb,false,'2026-06-30T00:00:00Z')`, [JSON.stringify(first)]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
      VALUES('history-event',2,$1::jsonb,'2026-06-30T00:00:00Z')`, [JSON.stringify(first)]);
    await db.query(`INSERT INTO checkins(id,event_id,user_id,evidence,checked_at)
      VALUES('history-checkin','history-event','p1','SCAN','2026-07-01T12:30:00Z')`);
    const { rows: cutoff } = await db.query<{ at: Date }>('SELECT clock_timestamp() AS at');
    await new Promise(resolve => setTimeout(resolve, 20));
    await db.query(`UPDATE events SET status='CANCELLED',version=3,payload=$1::jsonb WHERE id='history-event'`,
      [JSON.stringify(later)]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload)
      VALUES('history-event',3,$1::jsonb)`, [JSON.stringify(later)]);
    const earlier = await getPilotMetrics(db, new Date(cutoff[0]!.at).getTime() + 1, ['host', 'p1']);
    assert.equal(earlier.dueEventCompletion.dueEvents, 1);
    assert.equal(earlier.participantReturn30d.pendingFirstParticipants, 1);
    const current = await getPilotMetrics(db, Date.now() + 1000, ['host', 'p1']);
    assert.equal(current.dueEventCompletion.dueEvents, 0);
    assert.equal(current.participantReturn30d.pendingFirstParticipants, 0);
  } finally { await db.close(); }
});

test('a later outside-pilot registration does not remove an earlier cohort from diagnostics', async () => {
  const db = await createDatabase();
  try {
    const payload = valid('2026-12-01T12:00:00.000Z');
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test,created_at)
      VALUES('cohort-membership','host','CONFIRMED',2,$1::jsonb,false,'2026-07-01T00:00:00Z')`,
    [JSON.stringify(payload)]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
      VALUES('cohort-membership',2,$1::jsonb,'2026-07-01T00:00:00Z')`, [JSON.stringify(payload)]);
    await db.query(`INSERT INTO audit(id,actor_id,event_id,action,created_at)
      VALUES('cohort-confirm','host','cohort-membership','CONFIRM_EVENT','2026-08-01T00:00:00Z')`);
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status)
      VALUES('cohort-p1','cohort-membership','p1','OFFERED')`);
    await db.query(`INSERT INTO offers(id,event_id,registration_id,expires_at,status)
      VALUES('cohort-offer','cohort-membership','cohort-p1','2026-12-01T00:00:00Z','ACTIVE')`);
    const { rows: cutoff } = await db.query<{ at: Date }>('SELECT clock_timestamp() AS at');
    await new Promise(resolve => setTimeout(resolve, 20));
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status)
      VALUES('cohort-late','cohort-membership','outside-pilot','CONFIRMED')`);
    const earlier = await getPilotMetrics(db, new Date(cutoff[0]!.at).getTime() + 1, ['host', 'p1']);
    assert.equal(earlier.hostReuse28d.maturedHosts, 1);
    assert.equal(earlier.formationTime.formedEvents, 1);
    assert.equal(earlier.waitlistOfferConversion.issued, 1);
    const current = await getPilotMetrics(db, Date.now() + 1000, ['host', 'p1']);
    assert.equal(current.hostReuse28d.maturedHosts, 0);
    assert.equal(current.formationTime.formedEvents, 0);
    assert.equal(current.waitlistOfferConversion.issued, 0);
  } finally { await db.close(); }
});

test('attendance diagnostic preserves the deadline cohort and separates later withdrawal from actual attendance', async () => {
  const db = await createDatabase();
  try {
    const start = Date.now() - 2 * 24 * 60 * 60_000;
    const payload = valid(new Date(start).toISOString());
    const deadline = Date.parse(payload.registrationDeadline);
    const joinedAt = new Date(deadline - 60 * 60_000).toISOString();
    const publishedAt = new Date(deadline - 24 * 60 * 60_000).toISOString();
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test)
      VALUES('attendance-diagnostic','host','COMPLETED',2,$1::jsonb,false)`, [JSON.stringify(payload)]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
      VALUES('attendance-diagnostic',2,$1::jsonb,$2)`, [JSON.stringify(payload), publishedAt]);
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status,created_at) VALUES
      ('attendance-p1','attendance-diagnostic','p1','CONFIRMED',$1),
      ('attendance-p2','attendance-diagnostic','p2','CONFIRMED',$1)`, [joinedAt]);
    await db.query(`UPDATE registration_status_history SET changed_at=$1
      WHERE registration_id IN ('attendance-p1','attendance-p2')`, [joinedAt]);
    await db.query(`INSERT INTO checkins(id,event_id,user_id,evidence,checked_at)
      VALUES('attendance-scan','attendance-diagnostic','p1','SCAN',$1)`, [new Date(start + 15 * 60_000).toISOString()]);
    const { rows: cutoff } = await db.query<{ at: Date }>('SELECT clock_timestamp() AS at');
    await new Promise(resolve => setTimeout(resolve, 20));
    await db.query("UPDATE registrations SET status='CANCELLED' WHERE id='attendance-p2'");
    const before = (await getPilotMetrics(db, new Date(cutoff[0]!.at).getTime() + 1,
      ['host', 'p1', 'p2'])).attendanceDiagnostic;
    assert.deepEqual(before, { status: 'COMPLETE', dueEvents: 1, confirmedAtDeadline: 2,
      attendedFromDeadlineCohort: 1, finalActualAttended: 1, cancelledAfterDeadline: 0,
      removedAfterDeadline: 0, unknownDeadlineStates: 0, missingDeadlineEvents: 0,
      cohortAttendanceRate: 0.5 });
    const after = (await getPilotMetrics(db, Date.now() + 1000, ['host', 'p1', 'p2'])).attendanceDiagnostic;
    assert.equal(after.cancelledAfterDeadline, 1);
    assert.equal(after.confirmedAtDeadline, 2);
    assert.equal(after.cohortAttendanceRate, 0.5);
    await db.query("UPDATE registrations SET status='CONFIRMED' WHERE id='attendance-p2'");
    const rejoined = (await getPilotMetrics(db, Date.now() + 1000, ['host', 'p1', 'p2'])).attendanceDiagnostic;
    assert.equal(rejoined.cancelledAfterDeadline, 1, 'a temporary exit remains visible after rejoining');
  } finally { await db.close(); }
});

test('formation time uses first accessible publication and first confirmed audit, excluding test and unlisted activity', async () => {
  const db = await createDatabase();
  try {
    const base = Date.parse('2027-01-01T00:00:00.000Z');
    const sample = [
      ['formation-30', false, false, 30],
      ['formation-90', false, false, 90],
      ['formation-test', true, false, 10],
      ['formation-outsider', false, true, 10]
    ] as const;
    for (const [key, isTest, hasOutsider, minutes] of sample) {
      const event = await metricEvent(db, 'host', key, '2027-01-02T12:00:00.000Z', isTest);
      await db.query('UPDATE event_versions SET created_at=$2 WHERE event_id=$1 AND version=2',
        [event.id, new Date(base).toISOString()]);
      if (hasOutsider) await db.query('INSERT INTO registrations(id,event_id,user_id,status) VALUES($1,$2,$3,$4)',
        [`${key}-registration`, event.id, 'outsider', 'CONFIRMED']);
      await db.query('INSERT INTO audit(id,actor_id,event_id,action,created_at) VALUES($1,$2,$3,$4,$5)',
        [`${key}-confirm`, 'host', event.id, 'CONFIRM_EVENT', new Date(base + minutes * 60_000).toISOString()]);
      if (key === 'formation-30') await db.query('INSERT INTO audit(id,actor_id,event_id,action,created_at) VALUES($1,$2,$3,$4,$5)',
        [`${key}-repeat-confirm`, 'host', event.id, 'CONFIRM_EVENT', new Date(base + 150 * 60_000).toISOString()]);
    }
    const publicDraft = await createDraft(db, 'public-host',
      { ...valid('2027-01-02T12:00:00.000Z'), visibility: 'PUBLIC', approvalMode: 'MANUAL' }, 'formation-public-draft', false);
    const publicEvent = await publishEvent(db, 'public-host', publicDraft.id, publicDraft.version, 'formation-public-submit');
    await reviewEvent(db, 'operator:reviewer', publicEvent.id, publicEvent.version,
      'APPROVED', '活动事实已核实', 'formation-public-approve');
    await db.query('UPDATE event_review_decisions SET reviewed_at=$2 WHERE event_id=$1',
      [publicEvent.id, new Date(base + 15 * 60_000).toISOString()]);
    await db.query('INSERT INTO audit(id,actor_id,event_id,action,created_at) VALUES($1,$2,$3,$4,$5)',
      ['formation-public-confirm', 'public-host', publicEvent.id, 'CONFIRM_EVENT', new Date(base + 75 * 60_000).toISOString()]);
    const report = await getPilotMetrics(db, Date.parse('2027-01-10T00:00:00.000Z'), ['host', 'public-host']);
    assert.deepEqual(report.formationTime, { formedEvents: 3, medianMinutes: 60 });
  } finally { await db.close(); }
});
