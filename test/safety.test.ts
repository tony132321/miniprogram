import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createDatabase, type Database } from '../src/db.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { publishApprovedInvite } from './helpers.ts';
import { confirmEvent } from '../src/lifecycle.ts';
import { acceptOffer, cancelRegistration, reserveSeats } from '../src/registrations.ts';
import { register } from './helpers.ts';
import { placeEventHold, releaseEventHold, getActiveEventHold } from '../src/safety.ts';
import { createApp } from '../src/server.ts';
import { reviewEvent } from '../src/event-review.ts';
import { setEmergencyGate } from '../src/emergency-gate.ts';
import { setPublicGate } from '../src/public-gate.ts';
import { openSyntheticPublicCoverage } from './helpers/public-coverage.ts';

const input = {
  title: '安全流程测试', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 4, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
};

test('active safety hold blocks pending approval until released', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'held-review-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'held-review-publish');
    assert.equal(event.reviewStatus, 'PENDING');
    assert.equal(event.recruiting, false);
    const hold = await placeEventHold(db, 'ops', event.id, '场地风险仍在核查中', 'held-review-place');

    await assert.rejects(() => reviewEvent(db, 'ops', event.id, event.version, 'APPROVED',
      '场地风险尚未解除，不能通过审核', 'held-review-approve'), { code: 'RISK_HOLD' });
    const { rows: pending } = await db.query<{ review_status: string; recruiting: boolean }>(
      'SELECT review_status,recruiting FROM events WHERE id=$1', [event.id]);
    assert.deepEqual(pending[0], { review_status: 'PENDING', recruiting: false });
    const { rows: decisions } = await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM event_review_decisions WHERE event_id=$1', [event.id]);
    assert.equal(decisions[0]?.count, 0);

    await releaseEventHold(db, 'ops', hold.id, '场地风险核查完成并允许审核', 'held-review-release');
    const approved = await reviewEvent(db, 'ops', event.id, event.version, 'APPROVED',
      '风险解除后重新核对活动信息', 'held-review-approve');
    assert.equal(approved.reviewStatus, 'APPROVED');
    assert.equal(approved.recruiting, true);
  } finally { await db.close(); }
});

test('active safety hold still permits rejecting a pending event', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'held-reject-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'held-reject-publish');
    await placeEventHold(db, 'ops', event.id, '活动资料存在待核查风险', 'held-reject-place');

    const rejected = await reviewEvent(db, 'ops', event.id, event.version, 'REJECTED',
      '存在风险，活动审核不通过', 'held-reject-review');
    assert.equal(rejected.reviewStatus, 'REJECTED');
    assert.equal(rejected.recruiting, false);
    assert.equal((await getActiveEventHold(db, event.id))?.status, 'ACTIVE');
  } finally { await db.close(); }
});

test('operator safety hold blocks new seats and formation while preserving exits; release resumes FIFO', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'publish');
    const p1 = await register(db, 'p1', event.id, event.version, 'p1');
    const p2 = await register(db, 'p2', event.id, event.version, 'p2');
    await register(db, 'p3', event.id, event.version, 'p3');
    const waiting = await register(db, 'p4', event.id, event.version, 'p4');
    const waitingSecond = await register(db, 'p5', event.id, event.version, 'p5');
    assert.equal(waiting.status, 'WAITLISTED');

    const hold = await placeEventHold(db, 'ops', event.id, '需要人工核查场地安全举报', 'hold');
    assert.equal((await getActiveEventHold(db, event.id))?.id, hold.id);
    assert.equal((await placeEventHold(db, 'ops', event.id, '需要人工核查场地安全举报', 'hold')).id, hold.id);
    await assert.rejects(() => register(db, 'p6', event.id, event.version, 'p6'), { code: 'RISK_HOLD' });
    await assert.rejects(() => reserveSeats(db, 'host', event.id, event.version, 1, 'reserve'), { code: 'RISK_HOLD' });
    await assert.rejects(() => confirmEvent(db, 'host', event.id, event.version, 'confirm'), { code: 'RISK_HOLD' });
    await cancelRegistration(db, 'p1', p1.id, event.version, 'exit');
    await cancelRegistration(db, 'p2', p2.id, event.version, 'exit-2');
    assert.equal((await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1', [waiting.id])).rows[0]?.status, 'WAITLISTED');

    const released = await releaseEventHold(db, 'ops', hold.id, '人工核查完成，允许继续招募', 'release');
    assert.equal(released.status, 'RELEASED');
    assert.equal(await getActiveEventHold(db, event.id), null);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1', [waiting.id])).rows[0]?.status, 'OFFERED');
    assert.equal((await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1', [waitingSecond.id])).rows[0]?.status, 'OFFERED');
    const actions = await db.query<{ action: string }>("SELECT action FROM audit WHERE event_id=$1 AND action LIKE 'SAFETY_HOLD_%' ORDER BY created_at", [event.id]);
    assert.deepEqual(actions.rows.map(row => row.action).sort(), ['SAFETY_HOLD_PLACE', 'SAFETY_HOLD_RELEASE']);
  } finally { await db.close(); }
});

test('an offer issued before a hold cannot be accepted until release', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'offer-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'offer-publish');
    const p1 = await register(db, 'p1', event.id, event.version, 'offer-p1');
    for (const actor of ['p2', 'p3', 'p4']) await register(db, actor, event.id, event.version, `offer-${actor}`);
    await cancelRegistration(db, 'p1', p1.id, event.version, 'offer-exit');
    const { rows } = await db.query<{ id: string }>("SELECT id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [event.id]);
    const hold = await placeEventHold(db, 'ops', event.id, '核查期间不能接受旧补位', 'offer-hold');
    await assert.rejects(() => acceptOffer(db, 'p4', rows[0]!.id, event.version, 'offer-accept'), { code: 'RISK_HOLD' });
    await releaseEventHold(db, 'ops', hold.id, '核查完成可接受有效补位', 'offer-release');
    assert.equal((await acceptOffer(db, 'p4', rows[0]!.id, event.version, 'offer-accept')).status, 'CONFIRMED');
  } finally { await db.close(); }
});

test('closing a hold after an event expires does not announce that recruiting resumed', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'expired-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'expired-publish');
    const hold = await placeEventHold(db, 'ops', event.id, '等待安全核查结果后结案', 'expired-hold');
    await db.query("UPDATE events SET status='EXPIRED',recruiting=false WHERE id=$1", [event.id]);
    await releaseEventHold(db, 'ops', hold.id, '已记录结案结果不再招募', 'expired-release');
    const { rows } = await db.query<{ kind: string }>("SELECT kind FROM notifications WHERE event_id=$1 AND kind LIKE 'EVENT_SAFETY_%' ORDER BY created_at", [event.id]);
    assert.deepEqual(rows.map(row => row.kind), ['EVENT_SAFETY_PAUSED', 'EVENT_SAFETY_REVIEW_CLOSED']);
  } finally { await db.close(); }
});

test('a delayed start transition cannot make a safety release announce recruiting resumed', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'late-start-hold-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'late-start-hold-publish');
    const hold = await placeEventHold(db, 'ops', event.id, '核查开始时间附近的风险', 'late-start-hold');
    const lateDatabaseClock = new Date(Date.parse(input.startAt) + 1000);
    const clockDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
          sql === 'SELECT clock_timestamp() AS current_time'
            ? Promise.resolve({ rows: [{ current_time: lateDatabaseClock } as unknown as T] })
            : tx.query(sql, params)
      }))
    };
    await releaseEventHold(clockDb, 'ops', hold.id, '活动已开始，仅完成核查结案', 'late-start-release');
    const { rows } = await db.query<{ kind: string }>(
      "SELECT kind FROM notifications WHERE event_id=$1 AND kind LIKE 'EVENT_SAFETY_%' ORDER BY created_at", [event.id]);
    assert.deepEqual(rows.map(row => row.kind), ['EVENT_SAFETY_PAUSED', 'EVENT_SAFETY_REVIEW_CLOSED']);
  } finally { await db.close(); }
});

test('a delayed registration deadline transition cannot make a safety release announce recruiting resumed', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'late-deadline-hold-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'late-deadline-hold-publish');
    const hold = await placeEventHold(db, 'ops', event.id, '核查报名截止时间附近的风险', 'late-deadline-hold');
    const lateDatabaseClock = new Date(Date.parse(input.registrationDeadline) + 1000);
    const clockDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
          sql === 'SELECT clock_timestamp() AS current_time'
            ? Promise.resolve({ rows: [{ current_time: lateDatabaseClock } as unknown as T] })
            : tx.query(sql, params)
      }))
    };
    await releaseEventHold(clockDb, 'ops', hold.id, '报名截止后完成核查结案', 'late-deadline-release');
    const { rows } = await db.query<{ kind: string }>(
      "SELECT kind FROM notifications WHERE event_id=$1 AND kind LIKE 'EVENT_SAFETY_%' ORDER BY created_at", [event.id]);
    assert.deepEqual(rows.map(row => row.kind), ['EVENT_SAFETY_PAUSED', 'EVENT_SAFETY_REVIEW_CLOSED']);
  } finally { await db.close(); }
});

test('a safety hold cannot be placed after the database start time even if status is still recruiting', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'late-place-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'late-place-publish');
    const lateDatabaseClock = new Date(Date.parse(input.startAt) + 1000);
    const clockDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
          sql === 'SELECT clock_timestamp() AS current_time'
            ? Promise.resolve({ rows: [{ current_time: lateDatabaseClock } as unknown as T] })
            : tx.query(sql, params)
      }))
    };
    await assert.rejects(() => placeEventHold(clockDb, 'ops', event.id, '开始后不能按招募暂停处理', 'late-place'),
      { code: 'INVALID_STATE' });
    assert.equal((await getActiveEventHold(db, event.id)), null);
  } finally { await db.close(); }
});

test('a safety hold cannot be inserted if the activity starts before the final write', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'place-write-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'place-write-publish');
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async (sql, params = []) => {
          if (!crossed && sql.startsWith('INSERT INTO event_safety_holds')) {
            crossed = true;
            await tx.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
              [event.id, new Date(Date.now() - 1000).toISOString()]);
          }
          return tx.query(sql, params);
        }
      }))
    };
    await assert.rejects(() => placeEventHold(racingDb, 'ops', event.id, '开始边界前暂停风险操作', 'place-write'),
      { code: 'INVALID_STATE' });
    assert.equal(crossed, true);
    assert.equal(await getActiveEventHold(db, event.id), null);
  } finally { await db.close(); }
});

test('releasing a hold does not claim recruiting resumed while another activity rule still pauses it', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'paused-rule-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'paused-rule-publish');
    const hold = await placeEventHold(db, 'ops', event.id, '核查仍需保持招募暂停', 'paused-rule-hold');
    await db.query('UPDATE events SET recruiting=false WHERE id=$1', [event.id]);
    await releaseEventHold(db, 'ops', hold.id, '单场安全核查已经结案', 'paused-rule-release');
    const { rows } = await db.query<{ kind: string }>(
      "SELECT kind FROM notifications WHERE event_id=$1 AND kind LIKE 'EVENT_SAFETY_%' ORDER BY created_at", [event.id]);
    assert.deepEqual(rows.map(row => row.kind), ['EVENT_SAFETY_PAUSED', 'EVENT_SAFETY_REVIEW_CLOSED']);
  } finally { await db.close(); }
});

test('releasing a hold while the global safety gate is closed does not announce recruiting resumed', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'global-gate-hold-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'global-gate-hold-publish');
    const hold = await placeEventHold(db, 'ops', event.id, '核查全局暂停期间的活动', 'global-gate-hold');
    await setEmergencyGate(db, 'ops', 'CLOSED', '暂停所有新报名及成局操作', 'global-gate-close');
    await releaseEventHold(db, 'ops', hold.id, '本场核查已完成结案', 'global-gate-release');
    const { rows } = await db.query<{ kind: string }>(
      "SELECT kind FROM notifications WHERE event_id=$1 AND kind LIKE 'EVENT_SAFETY_%' ORDER BY created_at", [event.id]);
    assert.deepEqual(rows.map(row => row.kind), ['EVENT_SAFETY_PAUSED', 'EVENT_SAFETY_REVIEW_CLOSED']);
  } finally { await db.close(); }
});

test('releasing a public activity hold while public recruitment is closed does not announce recruiting resumed', async () => {
  const db = await createDatabase();
  try {
    await openSyntheticPublicCoverage(db, [input]);
    const draft = await createDraft(db, 'host', { ...input, visibility: 'PUBLIC', approvalMode: 'MANUAL' }, 'public-gate-hold-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'public-gate-hold-publish');
    await reviewEvent(db, 'ops', event.id, event.version, 'APPROVED', '审核通过公开活动', 'public-gate-review');
    const hold = await placeEventHold(db, 'ops', event.id, '核查公开活动的风险状态', 'public-gate-hold');
    await setPublicGate(db, 'ops', 'CLOSED', '暂停所有公开活动招募', 'public-gate-close');
    await releaseEventHold(db, 'ops', hold.id, '本场风险核查已经结案', 'public-gate-release');
    const { rows } = await db.query<{ kind: string }>(
      "SELECT kind FROM notifications WHERE event_id=$1 AND kind LIKE 'EVENT_SAFETY_%' ORDER BY created_at", [event.id]);
    assert.deepEqual(rows.map(row => row.kind), ['EVENT_SAFETY_PAUSED', 'EVENT_SAFETY_REVIEW_CLOSED']);
  } finally { await db.close(); }
});

test('safety hold API is operator-only and event viewers see no investigation reason', async () => {
  const db = await createDatabase();
  await openSyntheticPublicCoverage(db, [input]);
  const server = createApp(db, { environment: 'development', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  async function request(path: string, actor: string, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, { method, headers: { 'X-Dev-User': actor,
      ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': `key-${path}` } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }
  try {
    const draft = await createDraft(db, 'host', { ...input, visibility: 'PUBLIC', approvalMode: 'MANUAL' }, 'api-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'api-publish');
    await reviewEvent(db, 'ops', event.id, event.version, 'APPROVED', '核对公开活动安全信息', 'api-review');
    assert.equal((await request('/ops/holds', 'host')).status, 403);
    assert.equal((await request(`/ops/events/${event.id}/hold`, 'host', 'POST', { reason: '私密举报详情不能展示' })).status, 403);
    const hold = await request(`/ops/events/${event.id}/hold`, 'ops', 'POST', { reason: '私密举报详情不能展示' });
    assert.equal(hold.status, 201);
    assert.equal((await request('/ops/holds', 'ops')).status, 200);
    const publicDetail = await request(`/events/${event.id}`, 'visitor');
    assert.equal(publicDetail.body.riskPaused, true);
    assert.equal(JSON.stringify(publicDetail.body).includes('私密举报'), false);
    const joined = await request(`/events/${event.id}/registrations`, 'visitor', 'POST', { expectedVersion: event.version, acceptedRules: true });
    assert.equal(joined.body.code, 'RISK_HOLD');
    assert.equal((await request(`/ops/holds/${hold.body.id}/release`, 'host', 'POST', { reason: '经核查可以解除暂停' })).status, 403);
    assert.equal((await request(`/ops/holds/${hold.body.id}/release`, 'ops', 'POST', { reason: '经核查可以解除暂停' })).status, 200);
    assert.equal((await request(`/events/${event.id}`, 'visitor')).body.riskPaused, false);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});
