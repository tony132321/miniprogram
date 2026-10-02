import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { publishApprovedInvite } from './helpers.ts';
import { recordSupportMinutes } from '../src/support-minutes.ts';
import { getPilotMetrics } from '../src/metrics.ts';
import { createOperatorEnrollment, totpCode } from '../src/operator-auth.ts';
import { createApp } from '../src/server.ts';

const start = Date.now() + 7 * 24 * 60 * 60_000;
const input = { title: '直接人工时间', type: 'badminton', startAt: new Date(start).toISOString(),
  endAt: new Date(start + 2 * 60 * 60_000).toISOString(), timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 6,
  registrationDeadline: new Date(start - 60 * 60_000).toISOString(),
  confirmationDeadline: new Date(start - 2 * 60 * 60_000).toISOString(), feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };

test('support minutes are immutable, idempotent, attributed to the operator and validate the event', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'pilot-host', input, 'support-draft', false);
    const event = await publishApprovedInvite(db, 'pilot-host', draft.id, draft.version, 'support-publish');
    const first = await recordSupportMinutes(db, 'operator:metrics', event.id, 12, 'SUPPORT', 'support-1');
    const replay = await recordSupportMinutes(db, 'operator:metrics', event.id, 12, 'SUPPORT', 'support-1');
    assert.deepEqual(replay, first);
    const zero = await recordSupportMinutes(db, 'operator:metrics', event.id, 0, 'SAFETY', 'support-zero');
    assert.notEqual(zero.id, first.id);
    const { rows } = await db.query<{ minutes: number; recorded_by: string }>('SELECT minutes,recorded_by FROM support_minutes WHERE event_id=$1 ORDER BY minutes', [event.id]);
    assert.deepEqual(rows, [{ minutes: 0, recorded_by: 'operator:metrics' }, { minutes: 12, recorded_by: 'operator:metrics' }]);
    const { rows: audits } = await db.query<{ action: string }>("SELECT action FROM audit WHERE event_id=$1 AND action='RECORD_SUPPORT_MINUTES'", [event.id]);
    assert.equal(audits.length, 2);
    await assert.rejects(recordSupportMinutes(db, 'operator:metrics', event.id, -1, 'SUPPORT', 'invalid-neg'));
    await assert.rejects(recordSupportMinutes(db, 'operator:metrics', event.id, 1.5, 'SUPPORT', 'invalid-fraction'));
    await assert.rejects(recordSupportMinutes(db, 'operator:metrics', event.id, 1441, 'SUPPORT', 'invalid-large'));
    await assert.rejects(recordSupportMinutes(db, 'operator:metrics', event.id, 10, 'OTHER', 'invalid-category'));
    await assert.rejects(recordSupportMinutes(db, 'operator:metrics', 'missing-event', 10, 'SUPPORT', 'invalid-event'));
    assert.equal((await db.query('SELECT id FROM support_minutes')).rows.length, 2);
  } finally { await db.close(); }
});

test('pilot report labels recorded direct minutes as partial and excludes test or unlisted activity', async () => {
  const db = await createDatabase();
  try {
    const realDraft = await createDraft(db, 'pilot-host', input, 'real-draft', false);
    const real = await publishApprovedInvite(db, 'pilot-host', realDraft.id, realDraft.version, 'real-publish');
    const testDraft = await createDraft(db, 'pilot-host', input, 'test-draft', true);
    const testEvent = await publishApprovedInvite(db, 'pilot-host', testDraft.id, testDraft.version, 'test-publish');
    await recordSupportMinutes(db, 'operator:metrics', real.id, 15, 'SUPPORT', 'real-work');
    await recordSupportMinutes(db, 'operator:metrics', testEvent.id, 50, 'SUPPORT', 'test-work');
    const result = await getPilotMetrics(db, start + 3 * 60 * 60_000, ['pilot-host']);
    assert.deepEqual(result.directSupportMinutes, { status: 'PARTIAL', dueEvents: 1,
      eventsWithEntries: 1, entries: 1, recordedMinutes: 15 });
    assert.deepEqual((await getPilotMetrics(db, start + 3 * 60 * 60_000)).directSupportMinutes,
      { status: 'PARTIAL', dueEvents: 0, eventsWithEntries: 0, entries: 0, recordedMinutes: 0 });
    assert.equal(result.contributionProfit.status, 'UNAVAILABLE');
  } finally { await db.close(); }
});

test('support minute HTTP write requires a recorder role while METRICS remains read-only', async () => {
  const db = await createDatabase();
  const password = 'support minutes password';
  const metricAccount = { ...createOperatorEnrollment('metricstaff', password), permissions: ['METRICS'] };
  const recorderAccount = { ...createOperatorEnrollment('recorderstaff', password), permissions: ['SUPPORT_MINUTES'] };
  const reportAccount = { ...createOperatorEnrollment('reportstaff', password), permissions: ['REPORTS'] };
  const app = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'secret',
    operatorAccounts: [metricAccount, recorderAccount, reportAccount] });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const login = async (account: typeof metricAccount) => {
    const response = await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: account.username, password, code: totpCode(account.totpSecret) }) });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  };
  try {
    const draft = await createDraft(db, 'pilot-host', input, 'http-draft', false);
    const event = await publishApprovedInvite(db, 'pilot-host', draft.id, draft.version, 'http-publish');
    const metricToken = await login(metricAccount);
    const recorderToken = await login(recorderAccount);
    const reportToken = await login(reportAccount);
    const post = (token: string, minutes: unknown, key: string) => fetch(base + `/ops/events/${event.id}/support-minutes`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ minutes, category: 'SUPPORT', recordedBy: 'operator:forged', isTest: true }) });
    assert.equal((await post(reportToken, 7, 'denied')).status, 403);
    assert.equal((await post(metricToken, 7, 'metrics-readonly')).status, 403);
    assert.equal((await post(recorderToken, '7', 'invalid')).status, 400);
    const response = await post(recorderToken, 7, 'allowed');
    assert.equal(response.status, 201);
    const recorded = await response.json() as { id: string; recordedBy: string; minutes: number };
    assert.equal(recorded.recordedBy, 'operator:recorderstaff');
    assert.equal(recorded.minutes, 7);
    assert.deepEqual(await (await post(recorderToken, 7, 'allowed')).json(), recorded);
    assert.equal((await fetch(base + '/ops/support-minutes', { headers: { Authorization: `Bearer ${metricToken}` } })).status, 403);
    const history = await fetch(base + '/ops/support-minutes', { headers: { Authorization: `Bearer ${recorderToken}` } });
    assert.equal(history.status, 200);
    assert.equal((await history.json() as { items: unknown[] }).items.length, 1);
    assert.equal((await db.query('SELECT id FROM support_minutes')).rows.length, 1);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
