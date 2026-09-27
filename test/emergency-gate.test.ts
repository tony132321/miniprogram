import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft, getEvent, publishEvent } from '../src/events.ts';
import { acceptOffer, cancelRegistration, declineOffer, register } from '../src/registrations.ts';
import { createReport } from '../src/operations.ts';
import { createApp } from '../src/server.ts';
import { dispatchNotification, listMemberNotifications, setConsent } from '../src/notifications.ts';
import { runDueJobs } from '../src/jobs.ts';
import { setEmergencyGate } from '../src/emergency-gate.ts';
import { changeEvent } from '../src/lifecycle.ts';

const input = {
  title: '全局止损验证', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
};

test('safety operator pauses all new activity and seats while reads, exits and reports remain available', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  async function call(path: string, actor: string, method = 'GET', body?: unknown, key = 'emergency-key') {
    const response = await fetch(base + path, { method, headers: { 'X-Dev-User': actor,
      ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': key } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() as Record<string, any> };
  }
  try {
    const draft = await createDraft(db, 'host', input, 'emergency-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'emergency-publish');
    const member = await register(db, 'member', event.id, event.version, 'emergency-member', event.inviteToken!);
    for (const actor of ['p2', 'p3', 'p4', 'p5'])
      await register(db, actor, event.id, event.version, `emergency-${actor}`, event.inviteToken!);
    for (const actor of ['w1', 'w2', 'w3'])
      assert.equal((await register(db, actor, event.id, event.version, `emergency-${actor}`, event.inviteToken!)).status, 'WAITLISTED');
    const { rows: p5 } = await db.query<{ id: string }>("SELECT id FROM registrations WHERE event_id=$1 AND user_id='p5'", [event.id]);
    await cancelRegistration(db, 'p5', p5[0]!.id, event.version, 'emergency-release-before');
    const { rows: firstOffer } = await db.query<{ id: string }>("SELECT id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [event.id]);
    assert.equal(firstOffer.length, 1);
    assert.equal((await call('/ops/emergency', 'member')).status, 403);
    assert.equal((await call('/ops/emergency', 'ops')).body.status, 'OPEN');
    const close = await call('/ops/emergency', 'ops', 'POST',
      { status: 'CLOSED', reason: '发现报名容量不一致，暂停新增进行核查' }, 'close-emergency');
    assert.equal(close.status, 200);
    assert.equal(close.body.status, 'CLOSED');
    assert.equal((await call('/system/safety', 'member')).body.status, 'CLOSED');
    assert.equal(JSON.stringify((await call('/system/safety', 'member')).body).includes('容量不一致'), false);
    await assert.rejects(() => createDraft(db, 'another-host', input, 'emergency-block-draft'), { code: 'EMERGENCY_PAUSED' });
    await assert.rejects(() => register(db, 'newcomer', event.id, event.version, 'emergency-block-register', event.inviteToken!),
      { code: 'EMERGENCY_PAUSED' });
    await assert.rejects(() => changeEvent(db, 'host', event.id, event.version, { maxParticipants: 7 },
      'emergency-block-capacity-expansion'), { code: 'EMERGENCY_PAUSED' });
    await assert.rejects(() => acceptOffer(db, 'w1', firstOffer[0]!.id, event.version, 'emergency-block-accept'),
      { code: 'EMERGENCY_PAUSED' });
    const offerNotice = (await listMemberNotifications(db, 'w1')).items.find((item: any) => item.kind === 'WAITLIST_OFFER') as any;
    assert.equal(offerNotice?.actionable, false);
    assert.equal(offerNotice?.declinable, true);
    await setConsent(db, 'w1', 'EVENT_REMINDER', true, 'emergency-reminder-consent');
    let externalSends = 0;
    await dispatchNotification(db, offerNotice.id, { async send() {
      externalSends++; return { status: 'ACCEPTED', providerRef: 'must-not-send' };
    } });
    assert.equal(externalSends, 0);
    assert.equal((await db.query<{ external_status: string }>('SELECT external_status FROM notifications WHERE id=$1', [offerNotice.id])).rows[0]?.external_status, 'STALE_STATE');
    assert.equal((await getEvent(db, 'member', event.id)).id, event.id);
    assert.equal((await cancelRegistration(db, 'member', member.id, event.version, 'emergency-exit')).status, 'CANCELLED');
    await declineOffer(db, 'w1', firstOffer[0]!.id, event.version, 'emergency-decline');
    assert.equal((await db.query("SELECT id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [event.id])).rows.length, 0);
    assert.equal((await createReport(db, 'member', { eventId: event.id, kind: 'SAFETY', description: '报名异常需复核' },
      'emergency-report')).status, 'OPEN');
    assert.equal((await db.query<{ id: string }>("SELECT id FROM registrations WHERE event_id=$1 AND user_id='newcomer'", [event.id])).rows.length, 0);
    assert.equal((await call('/ops/emergency', 'member', 'POST',
      { status: 'OPEN', reason: '越权开启' }, 'forged-open')).status, 403);
    assert.equal((await call('/ops/emergency', 'ops', 'POST',
      { status: 'OPEN', reason: '完成核查并确认容量一致' }, 'reopen-emergency')).body.status, 'OPEN');
    await runDueJobs(db);
    const { rows: resumedOffers } = await db.query<{ user_id: string }>(
      `SELECT r.user_id FROM offers o JOIN registrations r ON r.id=o.registration_id
        WHERE o.event_id=$1 AND o.status='ACTIVE' ORDER BY r.enqueue_seq`, [event.id]);
    assert.deepEqual(resumedOffers.map(row => row.user_id), ['w2', 'w3']);
    assert.equal((await register(db, 'newcomer', event.id, event.version, 'emergency-join-after', event.inviteToken!)).status, 'WAITLISTED');
    const { rows: audit } = await db.query<{ action: string; actor_id: string; detail: { reason: string } }>(
      "SELECT action,actor_id,detail FROM audit WHERE action LIKE 'EMERGENCY_%' ORDER BY created_at");
    assert.deepEqual(audit.map(row => row.action), ['EMERGENCY_CLOSED', 'EMERGENCY_OPEN']);
    assert.ok(audit.every(row => row.actor_id === 'ops' && row.detail.reason.length >= 5));
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('a stale reopen job cannot promote during a second stop, and a new join cannot skip waiting members', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', { ...input, maxParticipants: 4 }, 'reopen-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'reopen-publish');
    const p1 = await register(db, 'p1', event.id, event.version, 'reopen-p1', event.inviteToken!);
    await register(db, 'p2', event.id, event.version, 'reopen-p2', event.inviteToken!);
    await register(db, 'p3', event.id, event.version, 'reopen-p3', event.inviteToken!);
    assert.equal((await register(db, 'w1', event.id, event.version, 'reopen-w1', event.inviteToken!)).status, 'WAITLISTED');
    await setEmergencyGate(db, 'ops', 'CLOSED', '发现报名容量异常先暂停', 'reopen-stop-one');
    await cancelRegistration(db, 'p1', p1.id, event.version, 'reopen-p1-exit');
    await setEmergencyGate(db, 'ops', 'OPEN', '已复核首轮容量记录', 'reopen-first-open');
    await setEmergencyGate(db, 'ops', 'CLOSED', '出现新线索再次暂停', 'reopen-stop-two');
    await runDueJobs(db, Date.now() + 1000);
    assert.equal((await db.query("SELECT id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [event.id])).rows.length, 0);
    await setEmergencyGate(db, 'ops', 'OPEN', '二次复核完成恢复新增', 'reopen-second-open');
    assert.equal((await register(db, 'newcomer', event.id, event.version, 'reopen-newcomer', event.inviteToken!)).status, 'WAITLISTED');
    await runDueJobs(db, Date.now() + 1000);
    const { rows: offers } = await db.query<{ user_id: string }>(
      `SELECT r.user_id FROM offers o JOIN registrations r ON r.id=o.registration_id
        WHERE o.event_id=$1 AND o.status='ACTIVE'`, [event.id]);
    assert.deepEqual(offers.map(row => row.user_id), ['w1']);
  } finally { await db.close(); }
});
