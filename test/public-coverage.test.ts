import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { confirmPublicCoverage, createPublicCoverage, getPublicGate, revokePublicCoverage,
  setPublicGate } from '../src/public-gate.ts';
import { createApp } from '../src/server.ts';
import { createDraft, getEvent, type EventInput } from '../src/events.ts';
import { publishApprovedInvite } from './helpers.ts';
import { reviewEvent } from '../src/event-review.ts';
import { cancelRegistration, register } from '../src/registrations.ts';
import { createReport } from '../src/operations.ts';
import { dispatchNotification, listMemberNotifications, setConsent } from '../src/notifications.ts';
import { runDueJobs } from '../src/jobs.ts';

const hour = 60 * 60_000;
function publicInput(start: number): EventInput {
  return { title: '合成值守公开球局', type: 'badminton', startAt: new Date(start).toISOString(),
    endAt: new Date(start + 2 * hour).toISOString(), timeZone: 'Asia/Shanghai', city: '深圳',
    venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 6,
    registrationDeadline: new Date(start - hour).toISOString(),
    confirmationDeadline: new Date(start - 4 * hour).toISOString(), feeMode: 'FREE', feeCapFen: 0,
    cancellationRule: '开始前可退出', visibility: 'PUBLIC', approvalMode: 'MANUAL', hostParticipates: false };
}

async function openSyntheticCoverage(db: Awaited<ReturnType<typeof createDatabase>>, start: number) {
  const eventShift = await createPublicCoverage(db, 'synthetic-duty-owner', new Date(start - hour).toISOString(),
    new Date(start + 3 * hour).toISOString(), 'synthetic-drill-record',
    new Date(Date.now() - hour).toISOString(), `synthetic-event-cover-${start}`);
  await confirmPublicCoverage(db, 'synthetic-duty-reviewer', eventShift.id, '已复核合成活动排班',
    `synthetic-event-confirm-${start}`);
  const gateShift = await createPublicCoverage(db, 'synthetic-duty-owner', new Date(Date.now() - hour).toISOString(),
    new Date(Date.now() + 3 * hour).toISOString(), 'synthetic-current-drill',
    new Date(Date.now() - hour).toISOString(), `synthetic-current-cover-${start}`);
  await confirmPublicCoverage(db, 'synthetic-duty-reviewer', gateShift.id, '已复核当前合成排班',
    `synthetic-current-confirm-${start}`);
  await setPublicGate(db, 'synthetic-duty-reviewer', 'OPEN', '合成值守覆盖允许公开活动',
    `synthetic-open-${start}`, gateShift.id);
  return { eventShift, gateShift };
}

test('a fresh database keeps public recruitment closed without confirmed duty coverage', async () => {
  const db = await createDatabase();
  try {
    assert.equal((await getPublicGate(db)).status, 'CLOSED');
    await assert.rejects(() => setPublicGate(db, 'ops', 'OPEN', '试图在未值守时开放公众活动', 'no-duty-open'),
      { code: 'PUBLIC_COVERAGE_REQUIRED' });
    assert.equal((await getPublicGate(db)).status, 'CLOSED');
  } finally { await db.close(); }
});

test('public recruitment opens only for a confirmed named shift with a drill reference', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['duty-owner', 'duty-reviewer'],
    checkInSecret: 'synthetic-test-secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  let requestNumber = 0;
  const post = async (path: string, actor: string, body: unknown) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'X-Dev-User': actor,
      'Content-Type': 'application/json', 'Idempotency-Key': `synthetic-duty-${++requestNumber}` },
    body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  const start = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const end = new Date(Date.now() + 27 * 60 * 60_000).toISOString();
  const drillCompletedAt = new Date(Date.now() - 60 * 60_000).toISOString();
  try {
    const proposed = await post('/ops/public-coverage', 'duty-owner', {
      startsAt: start, endsAt: end, drillReference: 'synthetic-drill-record', drillCompletedAt,
      responsibleActor: 'forged-operator'
    });
    assert.equal(proposed.status, 201);
    assert.equal(proposed.body.responsibleActor, 'duty-owner');
    assert.equal(proposed.body.confirmedBy, null);
    assert.equal((await post('/ops/public-recruitment', 'duty-owner', {
      status: 'OPEN', reason: '只有未确认的合成值守', coverageId: proposed.body.id })).status, 409);
    assert.equal((await post(`/ops/public-coverage/${proposed.body.id}/confirm`, 'duty-owner',
      { reason: '本人不能复核自己的排班' })).status, 409);
    const confirmed = await post(`/ops/public-coverage/${proposed.body.id}/confirm`, 'duty-reviewer',
      { reason: '已核对合成值守及演练记录' });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.confirmedBy, 'duty-reviewer');
    const futureOnly = await post('/ops/public-recruitment', 'duty-reviewer',
      { status: 'OPEN', reason: '未来才开始的排班不能视为当前值守', coverageId: proposed.body.id });
    assert.equal(futureOnly.status, 409);
    assert.equal(futureOnly.body.code, 'PUBLIC_COVERAGE_REQUIRED');
    const currentShift = await post('/ops/public-coverage', 'duty-owner', {
      startsAt: new Date(Date.now() - hour).toISOString(), endsAt: new Date(Date.now() + 3 * hour).toISOString(),
      drillReference: 'synthetic-current-drill', drillCompletedAt
    });
    assert.equal(currentShift.status, 201);
    assert.equal((await post(`/ops/public-coverage/${currentShift.body.id}/confirm`, 'duty-reviewer',
      { reason: '已核对当前合成班次' })).status, 200);
    const opened = await post('/ops/public-recruitment', 'duty-reviewer',
      { status: 'OPEN', reason: '合成值守记录已双人确认', coverageId: currentShift.body.id });
    assert.equal(opened.status, 200);
    assert.equal(opened.body.status, 'OPEN');
    assert.equal(opened.body.coverageId, currentShift.body.id);
    const { rows } = await db.query<{ responsible_actor: string; confirmed_by: string; drill_reference: string }>(
      'SELECT responsible_actor,confirmed_by,drill_reference FROM public_recruitment_coverage WHERE id=$1', [proposed.body.id]);
    assert.deepEqual(rows[0], { responsible_actor: 'duty-owner', confirmed_by: 'duty-reviewer',
      drill_reference: 'synthetic-drill-record' });
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('confirmed current duty and event shift permit only public events whose full activity time is covered', async () => {
  const db = await createDatabase();
  const start = Date.now() + 48 * hour;
  try {
    await openSyntheticCoverage(db, start);
    const inside = await createDraft(db, 'host', publicInput(start), 'inside-shift-draft');
    const published = await publishApprovedInvite(db, 'host', inside.id, inside.version, 'inside-shift-publish');
    assert.equal(published.reviewStatus, 'PENDING');
    const outside = await createDraft(db, 'host', publicInput(start + 48 * hour), 'outside-shift-draft');
    await assert.rejects(() => publishApprovedInvite(db, 'host', outside.id, outside.version, 'outside-shift-publish'),
      { code: 'PUBLIC_COVERAGE_REQUIRED' });
  } finally { await db.close(); }
});

test('revoking covered duty closes public reads and recruitment but preserves member exit and reports', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['synthetic-duty-reviewer'],
    checkInSecret: 'synthetic-test-secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const start = Date.now() + 48 * hour;
  try {
    const shifts = await openSyntheticCoverage(db, start);
    const draft = await createDraft(db, 'host', publicInput(start), 'revoke-covered-draft');
    const published = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'revoke-covered-publish');
    await reviewEvent(db, 'synthetic-duty-reviewer', published.id, published.version, 'APPROVED',
      '合成审核已核对活动资料', 'revoke-covered-review');
    const member = await register(db, 'member', published.id, published.version, 'revoke-covered-join', null);
    assert.equal((await getEvent(db, 'outsider', published.id)).id, published.id);
    const response = await fetch(`${base}/ops/public-coverage/${shifts.gateShift.id}/revoke`, { method: 'POST',
      headers: { 'X-Dev-User': 'synthetic-duty-reviewer', 'Content-Type': 'application/json',
        'Idempotency-Key': 'synthetic-revoke-key' },
      body: JSON.stringify({ reason: '合成排班临时无法继续值守' }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { revokedBy: string }).revokedBy, 'synthetic-duty-reviewer');
    assert.equal((await getPublicGate(db)).status, 'CLOSED');
    await assert.rejects(() => getEvent(db, 'outsider', published.id), { code: 'FORBIDDEN' });
    await assert.rejects(() => register(db, 'late-person', published.id, published.version, 'late-after-revoke', null),
      { code: 'PUBLIC_RECRUITMENT_PAUSED' });
    assert.equal((await getEvent(db, 'member', published.id)).id, published.id);
    assert.equal((await cancelRegistration(db, 'member', member.id, published.version, 'member-exit-after-revoke')).status, 'CANCELLED');
    assert.equal((await createReport(db, 'member', { eventId: published.id, kind: 'SAFETY',
      description: '值守撤销后仍可提交安全举报' }, 'report-after-revoke')).status, 'OPEN');
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('revoking a confirmed event shift fails closed for that event while current duty remains open', async () => {
  const db = await createDatabase();
  const start = Date.now() + 48 * hour;
  try {
    const shifts = await openSyntheticCoverage(db, start);
    const draft = await createDraft(db, 'host', publicInput(start), 'event-shift-revoke-draft');
    const published = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'event-shift-revoke-publish');
    await reviewEvent(db, 'synthetic-duty-reviewer', published.id, published.version, 'APPROVED',
      '合成审核已核对活动资料', 'event-shift-revoke-review');
    const member = await register(db, 'member', published.id, published.version, 'event-shift-revoke-join', null);
    await revokePublicCoverage(db, 'synthetic-duty-reviewer', shifts.eventShift.id,
      '活动时段值守无法履行，撤销合成覆盖', 'event-shift-revoke');
    assert.equal((await getPublicGate(db)).status, 'OPEN');
    const { rows: queued } = await db.query<{ user_id: string; status: string }>(`SELECT
      payload->>'userId' AS user_id,payload->>'status' AS status FROM jobs
      WHERE kind='PUBLIC_GATE_NOTICE' AND payload->>'eventId'=$1 ORDER BY payload->>'userId'`, [published.id]);
    assert.deepEqual(queued, [{ user_id: 'host', status: 'CLOSED' }, { user_id: 'member', status: 'CLOSED' }]);
    const { rows: exactTimes } = await db.query<{ exact: boolean }>(`SELECT bool_and(
      j.created_at=c.revoked_at AND j.due_at=c.revoked_at) AS exact
      FROM jobs j JOIN public_recruitment_coverage c ON c.id=$1
      WHERE j.kind='PUBLIC_GATE_NOTICE' AND j.payload->>'eventId'=$2`,
    [shifts.eventShift.id, published.id]);
    assert.equal(exactTimes[0]?.exact, true);
    await runDueJobs(db);
    const { rows: notices } = await db.query<{ user_id: string; detail: Record<string, unknown> }>(`SELECT user_id,detail
      FROM notifications WHERE event_id=$1 AND kind='PUBLIC_RECRUITMENT_CLOSED' ORDER BY user_id`, [published.id]);
    assert.deepEqual(notices.map(row => row.user_id), ['host', 'member']);
    assert.equal(JSON.stringify(notices).includes('活动时段值守无法履行'), false);
    await assert.rejects(() => getEvent(db, 'outsider', published.id), { code: 'FORBIDDEN' });
    await assert.rejects(() => register(db, 'late-person', published.id, published.version,
      'event-shift-revoke-late', null), { code: 'PUBLIC_COVERAGE_REQUIRED' });
    assert.equal((await getEvent(db, 'member', published.id)).id, published.id);
    assert.equal((await cancelRegistration(db, 'member', member.id, published.version,
      'event-shift-revoke-exit')).status, 'CANCELLED');
  } finally { await db.close(); }
});

test('a stored OPEN gate reports closed at both the future-start and expired-end duty boundaries', async () => {
  const db = await createDatabase();
  const start = Date.now() + 48 * hour;
  try {
    const shifts = await openSyntheticCoverage(db, start);
    const draft = await createDraft(db, 'host', publicInput(start), 'duty-boundary-draft');
    const published = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'duty-boundary-publish');
    await reviewEvent(db, 'synthetic-duty-reviewer', published.id, published.version, 'APPROVED',
      '合成审核已核对活动资料', 'duty-boundary-review');
    assert.equal((await getPublicGate(db)).status, 'OPEN');
    await db.query(`UPDATE public_recruitment_coverage SET starts_at=clock_timestamp()+interval '1 minute'
      WHERE id=$1`, [shifts.gateShift.id]);
    assert.equal((await getPublicGate(db)).status, 'CLOSED');
    await assert.rejects(() => register(db, 'future-duty-visitor', published.id, published.version,
      'future-duty-register', null), { code: 'PUBLIC_COVERAGE_REQUIRED' });
    await db.query(`UPDATE public_recruitment_coverage SET starts_at=clock_timestamp()-interval '1 hour',
      ends_at=clock_timestamp() WHERE id=$1`, [shifts.gateShift.id]);
    assert.equal((await getPublicGate(db)).status, 'CLOSED');
    await assert.rejects(() => register(db, 'expired-duty-visitor', published.id, published.version,
      'expired-duty-register', null), { code: 'PUBLIC_COVERAGE_REQUIRED' });
  } finally { await db.close(); }
});

test('an expired current shift hides a public invitation even while its old gate row says OPEN', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'synthetic-test-secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const start = Date.now() + 48 * hour;
  try {
    const shifts = await openSyntheticCoverage(db, start);
    const draft = await createDraft(db, 'host', publicInput(start), 'expiry-draft');
    const published = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'expiry-publish');
    await reviewEvent(db, 'synthetic-duty-reviewer', published.id, published.version, 'APPROVED',
      '合成审核已核对活动资料', 'expiry-review');
    assert.equal((await fetch(`${base}/i/${published.inviteToken}`)).status, 200);
    await db.query(`UPDATE public_recruitment_coverage SET ends_at=clock_timestamp()-interval '30 minutes'
      WHERE id=$1`, [shifts.gateShift.id]);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM public_recruitment_gate WHERE id=1')).rows[0]?.status, 'OPEN');
    assert.equal((await getPublicGate(db)).status, 'CLOSED');
    assert.equal((await fetch(`${base}/i/${published.inviteToken}`)).status, 404);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('an expired current shift makes a queued public offer nonactionable and suppresses external dispatch', async () => {
  const db = await createDatabase();
  const start = Date.now() + 48 * hour;
  try {
    const shifts = await openSyntheticCoverage(db, start);
    const draft = await createDraft(db, 'host', publicInput(start), 'offer-expiry-draft');
    const published = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'offer-expiry-publish');
    await reviewEvent(db, 'synthetic-duty-reviewer', published.id, published.version, 'APPROVED',
      '合成审核已核对活动资料', 'offer-expiry-review');
    const waiting = await register(db, 'waiting', published.id, published.version, 'offer-expiry-join', null);
    await db.query("UPDATE registrations SET status='OFFERED' WHERE id=$1", [waiting.id]);
    await db.query(`INSERT INTO offers(id,event_id,registration_id,expires_at,status)
      VALUES('synthetic-offer',$1,$2,clock_timestamp()+interval '1 hour','ACTIVE')`, [published.id, waiting.id]);
    await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,detail)
      VALUES('synthetic-offer-notice',$1,'waiting','WAITLIST_OFFER',$2,'{"offerId":"synthetic-offer"}'::jsonb)`,
    [published.id, published.version]);
    await setConsent(db, 'waiting', 'EVENT_REMINDER', true, 'offer-expiry-consent');
    assert.equal((await listMemberNotifications(db, 'waiting')).items.find((item: any) => item.id === 'synthetic-offer-notice')?.actionable, true);
    await db.query(`UPDATE public_recruitment_coverage SET ends_at=clock_timestamp()-interval '30 minutes'
      WHERE id=$1`, [shifts.gateShift.id]);
    assert.equal((await listMemberNotifications(db, 'waiting')).items.find((item: any) => item.id === 'synthetic-offer-notice')?.actionable, false);
    let sends = 0;
    await dispatchNotification(db, 'synthetic-offer-notice', { send: async () => {
      sends++;
      return { status: 'ACCEPTED', providerRef: 'should-not-be-sent' };
    } });
    assert.equal(sends, 0);
    const { rows } = await db.query<{ external_status: string }>('SELECT external_status FROM notifications WHERE id=$1',
      ['synthetic-offer-notice']);
    assert.equal(rows[0]?.external_status, 'STALE_STATE');
  } finally { await db.close(); }
});

test('a due current-duty expiry job closes recruitment once and queues durable participant notices', async () => {
  const db = await createDatabase();
  const start = Date.now() + 48 * hour;
  try {
    const shifts = await openSyntheticCoverage(db, start);
    const draft = await createDraft(db, 'host', publicInput(start), 'expiry-job-draft');
    const published = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'expiry-job-publish');
    await reviewEvent(db, 'synthetic-duty-reviewer', published.id, published.version, 'APPROVED',
      '合成审核已核对活动资料', 'expiry-job-review');
    await register(db, 'member', published.id, published.version, 'expiry-job-join', null);
    const { rows: scheduled } = await db.query<{ exact: boolean }>(`SELECT j.due_at=c.ends_at AS exact
      FROM jobs j JOIN public_recruitment_coverage c ON c.id=j.payload->>'coverageId'
      WHERE j.kind='PUBLIC_COVERAGE_EXPIRE' AND c.id=$1`, [shifts.gateShift.id]);
    assert.deepEqual(scheduled, [{ exact: true }]);
    await db.query(`UPDATE public_recruitment_coverage SET ends_at=clock_timestamp()-interval '1 second'
      WHERE id=$1`, [shifts.gateShift.id]);
    await db.query(`UPDATE jobs SET due_at=clock_timestamp()-interval '1 second'
      WHERE kind='PUBLIC_COVERAGE_EXPIRE' AND payload->>'coverageId'=$1`, [shifts.gateShift.id]);
    assert.equal((await getPublicGate(db)).status, 'CLOSED');
    await runDueJobs(db);
    const { rows: gate } = await db.query<{ status: string; changed_by: string }>(
      'SELECT status,changed_by FROM public_recruitment_gate WHERE id=1');
    assert.deepEqual(gate[0], { status: 'CLOSED', changed_by: 'system:coverage-expiry' });
    const { rows: queued } = await db.query<{ user_id: string }>(`SELECT payload->>'userId' AS user_id
      FROM jobs WHERE kind='PUBLIC_GATE_NOTICE' AND payload->>'status'='CLOSED'
        AND payload->>'eventId'=$1 ORDER BY payload->>'userId'`, [published.id]);
    assert.deepEqual(queued.map(row => row.user_id), ['host', 'member']);
    await runDueJobs(db);
    await runDueJobs(db);
    assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM audit
      WHERE actor_id='system:coverage-expiry' AND action='PUBLIC_RECRUITMENT_CLOSED'`)).rows[0]?.n, 1);
    assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM notifications
      WHERE event_id=$1 AND kind='PUBLIC_RECRUITMENT_CLOSED'`, [published.id])).rows[0]?.n, 2);
  } finally { await db.close(); }
});

test('an old duty expiry job cannot close a gate handed over to another confirmed shift', async () => {
  const db = await createDatabase();
  const start = Date.now() + 48 * hour;
  try {
    const old = await openSyntheticCoverage(db, start);
    await runDueJobs(db, Date.now() + 7 * hour);
    assert.equal((await db.query<{ status: string }>(`SELECT status FROM jobs
      WHERE kind='PUBLIC_COVERAGE_EXPIRE' AND payload->>'coverageId'=$1`,
    [old.gateShift.id])).rows[0]?.status, 'PENDING');
    const next = await createPublicCoverage(db, 'synthetic-next-owner',
      new Date(Date.now() - hour).toISOString(), new Date(Date.now() + 5 * hour).toISOString(),
      'synthetic-next-drill', new Date(Date.now() - hour).toISOString(), 'next-current-propose');
    await confirmPublicCoverage(db, 'synthetic-duty-reviewer', next.id,
      '已确认接班的合成排班与演练', 'next-current-confirm');
    await setPublicGate(db, 'synthetic-duty-reviewer', 'OPEN', '已确认新的合成班次接续值守',
      'next-current-open', next.id);
    await db.query(`UPDATE public_recruitment_coverage SET ends_at=clock_timestamp()-interval '1 second'
      WHERE id=$1`, [old.gateShift.id]);
    await db.query(`UPDATE jobs SET due_at=clock_timestamp()-interval '1 second'
      WHERE kind='PUBLIC_COVERAGE_EXPIRE' AND payload->>'coverageId'=$1`, [old.gateShift.id]);
    await runDueJobs(db);
    const gate = await getPublicGate(db);
    assert.equal(gate.status, 'OPEN');
    assert.equal(gate.coverageId, next.id);
    assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM audit
      WHERE actor_id='system:coverage-expiry' AND action='PUBLIC_RECRUITMENT_CLOSED'`)).rows[0]?.n, 0);
  } finally { await db.close(); }
});
