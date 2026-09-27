import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { register } from './helpers.ts';
import { approveRegistration, cancelRegistration, declineOffer, removeRegistration } from '../src/registrations.ts';
import { confirmEvent, completeEvent } from '../src/lifecycle.ts';
import { setConsent, markNotificationOpened, listMemberNotifications, dispatchNotification } from '../src/notifications.ts';
import { placeEventHold, releaseEventHold } from '../src/safety.ts';
import { reviewEvent } from '../src/event-review.ts';
import { setPublicGate } from '../src/public-gate.ts';
import { runDueJobs } from '../src/jobs.ts';
import { openSyntheticPublicCoverage } from './helpers/public-coverage.ts';

const input = { title: '通知测试', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z',
  timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE',
  feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };

async function published(db: Awaited<ReturnType<typeof createDatabase>>) {
  const d = await createDraft(db, 'host', input, 'draft');
  return publishEvent(db, 'host', d.id, d.version, 'publish');
}

test('event end prompts a host to conclude and completed outcome prompts members once', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, event.id, event.version, `end-${actor}`);
    await confirmEvent(db, 'host', event.id, event.version, 'end-confirm');
    const { rows: endJobs } = await db.query<{ id: string; due_at: Date }>(
      "SELECT id,due_at FROM jobs WHERE event_id=$1 AND kind='EVENT_END'", [event.id]);
    assert.equal(endJobs.length, 1);
    assert.equal(new Date(endJobs[0]!.due_at).toISOString(), input.endAt);
    const startAt = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    const endAt = new Date(Date.now() - 60 * 60_000).toISOString();
    await db.query('UPDATE events SET payload=payload || $2::jsonb WHERE id=$1',
      [event.id, JSON.stringify({ startAt, endAt })]);
    await db.query("UPDATE jobs SET due_at=now()-interval '1 second' WHERE event_id=$1 AND kind IN ('EVENT_START','EVENT_END')", [event.id]);
    await runDueJobs(db);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [event.id])).rows[0]?.status,
      'IN_PROGRESS');
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM outcomes WHERE event_id=$1', [event.id])).rows[0]?.n, 0);
    const count = async (kind: string, userId: string) => (await db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM notifications WHERE event_id=$1 AND kind=$2 AND user_id=$3',
      [event.id, kind, userId])).rows[0]?.n;
    assert.equal(await count('EVENT_OUTCOME_DUE', 'host'), 1);
    assert.equal(await count('EVENT_OUTCOME_DUE', 'p1'), 0);
    await db.query("UPDATE jobs SET status='PENDING',due_at=now()-interval '1 second' WHERE id=$1", [endJobs[0]!.id]);
    await runDueJobs(db);
    assert.equal(await count('EVENT_OUTCOME_DUE', 'host'), 1);
    await completeEvent(db, 'host', event.id, event.version, { held: true, actualCount: 4, issues: [] }, 'end-complete');
    for (const actor of ['p1', 'p2', 'p3']) assert.equal(await count('EVENT_OUTCOME_REVIEW', actor), 1);
    assert.equal(await count('EVENT_OUTCOME_REVIEW', 'host'), 0);
  } finally { await db.close(); }
});

test('early or cancelled end tasks do not assert that an activity took place', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, event.id, event.version, `early-end-${actor}`);
    await confirmEvent(db, 'host', event.id, event.version, 'early-end-confirm');
    await runDueJobs(db, Date.parse(input.endAt) + 1000);
    assert.equal((await db.query<{ attempts: number }>(
      "SELECT attempts FROM jobs WHERE event_id=$1 AND kind='EVENT_END'", [event.id])).rows[0]?.attempts, 0);
    await db.query("UPDATE jobs SET due_at=now()-interval '1 second' WHERE event_id=$1 AND kind='EVENT_END'", [event.id]);
    await runDueJobs(db, Date.parse(input.endAt) + 1000);
    assert.equal((await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM notifications WHERE event_id=$1 AND kind='EVENT_OUTCOME_DUE'", [event.id])).rows[0]?.n, 0);
    await db.query("UPDATE events SET status='CANCELLED',payload=jsonb_set(payload,'{endAt}',to_jsonb($2::text),true) WHERE id=$1",
      [event.id, new Date(Date.now() - 60_000).toISOString()]);
    await db.query("UPDATE jobs SET status='PENDING' WHERE event_id=$1 AND kind='EVENT_END'", [event.id]);
    await runDueJobs(db);
    assert.equal((await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM notifications WHERE event_id=$1 AND kind='EVENT_OUTCOME_DUE'", [event.id])).rows[0]?.n, 0);
  } finally { await db.close(); }
});

test('withdrawing consent before dispatch prevents external message', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'grant');
    await register(db, 'p1', e.id, e.version, 'register');
    await setConsent(db, 'p1', 'EVENT_REMINDER', false, 'withdraw');
    let sends = 0;
    await runDueJobs(db, Date.now(), { send: async () => { sends++; return { status: 'ACCEPTED', providerRef: 'ref' }; } });
    assert.equal(sends, 0);
    const { rows } = await db.query<{ external_status: string }>("SELECT external_status FROM notifications WHERE event_id=$1 AND user_id='p1' AND kind='REGISTRATION_STATUS'", [e.id]);
    assert.equal(rows[0]?.external_status, 'CONSENT_WITHDRAWN');
    const inApp = await listMemberNotifications(db, 'p1');
    assert.ok(inApp.items.some((item: any) => item.event_id === e.id && item.kind === 'REGISTRATION_STATUS'));
  } finally { await db.close(); }
});

test('queued external notice skips a disabled account while keeping its in-app record and active member exit', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    await db.query(`INSERT INTO users(id,wechat_openid,status) VALUES
      ('p1','synthetic-disabled-openid','ACTIVE'),('p2','synthetic-active-openid','ACTIVE')`);
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'disabled-consent-p1');
    await setConsent(db, 'p2', 'EVENT_REMINDER', true, 'disabled-consent-p2');
    await register(db, 'p1', event.id, event.version, 'disabled-register-p1');
    const p2 = await register(db, 'p2', event.id, event.version, 'disabled-register-p2');
    await db.query("UPDATE users SET status='DISABLED' WHERE id='p1'");
    const sentTo: string[] = [];
    await runDueJobs(db, Date.now(), { send: async item => {
      sentTo.push(item.userId);
      return { status: 'ACCEPTED', providerRef: `synthetic-${item.userId}` };
    } });
    assert.deepEqual(sentTo, ['p2']);
    const { rows: notices } = await db.query<{ user_id: string; status: string; external_status: string }>(
      "SELECT user_id,status,external_status FROM notifications WHERE event_id=$1 AND kind='REGISTRATION_STATUS' ORDER BY user_id",
      [event.id]);
    assert.deepEqual(notices, [
      { user_id: 'p1', status: 'IN_APP', external_status: 'ACCOUNT_DISABLED' },
      { user_id: 'p2', status: 'IN_APP', external_status: 'PROVIDER_ACCEPTED' }
    ]);
    const { rows: audits } = await db.query<{ action: string }>(
      "SELECT action FROM audit WHERE actor_id='p1' AND event_id=$1", [event.id]);
    assert.ok(audits.some(row => row.action === 'REGISTER_CONFIRMED'));
    const exit = await cancelRegistration(db, 'p2', p2.id, event.version, 'active-exit-after-disable');
    assert.equal(exit.status, 'CANCELLED');
  } finally { await db.close(); }
});

test('an unresolved deletion request blocks queued external delivery and renewed consent', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    await db.query(`INSERT INTO users(id,wechat_openid) VALUES
      ('p1','synthetic-delete-p1'),('p2','synthetic-delete-p2')`);
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'before-delete-p1');
    await setConsent(db, 'p2', 'EVENT_REMINDER', true, 'before-delete-p2');
    await register(db, 'p1', event.id, event.version, 'delete-register-p1');
    await register(db, 'p2', event.id, event.version, 'delete-register-p2');
    await db.query("INSERT INTO privacy_requests(id,user_id,kind) VALUES('delete-p1','p1','DELETE')");
    await assert.rejects(() => setConsent(db, 'p1', 'EVENT_REMINDER', true, 'renew-after-delete'),
      { code: 'DELETE_REQUEST_PENDING' });
    await assert.rejects(() => setConsent(db, 'p1', 'EVENT_REMINDER', true, 'before-delete-p1'),
      { code: 'DELETE_REQUEST_PENDING' }, 'old idempotency key cannot replay a grant while deletion is pending');
    const sentTo: string[] = [];
    await runDueJobs(db, Date.now(), { send: async item => {
      sentTo.push(item.userId);
      return { status: 'ACCEPTED', providerRef: `synthetic-${item.userId}` };
    } });
    assert.deepEqual(sentTo, ['p2']);
    const { rows } = await db.query<{ user_id: string; external_status: string }>(
      "SELECT user_id,external_status FROM notifications WHERE event_id=$1 AND kind='REGISTRATION_STATUS' ORDER BY user_id",
      [event.id]);
    assert.deepEqual(rows, [
      { user_id: 'p1', external_status: 'DELETE_REQUEST_PENDING' },
      { user_id: 'p2', external_status: 'PROVIDER_ACCEPTED' }
    ]);
    assert.equal((await setConsent(db, 'p1', 'EVENT_REMINDER', false, 'withdraw-during-delete')).granted, false);
  } finally { await db.close(); }
});

test('a legacy reminder grant without the current notice version cannot authorize external dispatch', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    await db.query("INSERT INTO notification_consents(user_id,purpose,granted) VALUES('p1','EVENT_REMINDER',true)");
    await register(db, 'p1', event.id, event.version, 'legacy-consent-register');
    let sends = 0;
    await runDueJobs(db, Date.now(), { send: async () => { sends++; return { status: 'ACCEPTED', providerRef: 'ref' }; } });
    assert.equal(sends, 0);
    const { rows } = await db.query<{ external_status: string }>(
      "SELECT external_status FROM notifications WHERE event_id=$1 AND user_id='p1' AND kind='REGISTRATION_STATUS'", [event.id]);
    assert.equal(rows[0]?.external_status, 'CONSENT_RECONFIRM_REQUIRED');
    assert.ok((await listMemberNotifications(db, 'p1')).items.some(item => item.event_id === event.id));
  } finally { await db.close(); }
});

test('provider acceptance is recorded without claiming delivery', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'grant');
    await register(db, 'p1', e.id, e.version, 'register');
    await runDueJobs(db, Date.now(), { send: async () => ({ status: 'ACCEPTED', providerRef: 'provider-1' }) });
    const { rows } = await db.query<{ external_status: string }>("SELECT external_status FROM notifications WHERE event_id=$1 AND user_id='p1' AND kind='REGISTRATION_STATUS'", [e.id]);
    assert.equal(rows[0]?.external_status, 'PROVIDER_ACCEPTED');
  } finally { await db.close(); }
});

test('an interrupted dispatch is marked for reconciliation and never blindly resent', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'grant');
    await register(db, 'p1', e.id, e.version, 'register');
    await db.query("UPDATE notifications SET external_status='DISPATCHING' WHERE event_id=$1 AND user_id='p1' AND kind='REGISTRATION_STATUS'", [e.id]);
    let sends = 0;
    await runDueJobs(db, Date.now(), { send: async () => { sends++; return { status: 'ACCEPTED', providerRef: 'ref' }; } });
    assert.equal(sends, 0);
    const { rows } = await db.query<{ external_status: string }>("SELECT external_status FROM notifications WHERE event_id=$1 AND user_id='p1' AND kind='REGISTRATION_STATUS'", [e.id]);
    assert.equal(rows[0]?.external_status, 'UNKNOWN_REQUIRES_RECONCILIATION');
  } finally { await db.close(); }
});

test('replaying the start reminder job creates at most one reminder per member', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    await register(db, 'p1', e.id, e.version, 'join1');
    await register(db, 'p2', e.id, e.version, 'join2');
    await register(db, 'p3', e.id, e.version, 'join3');
    await confirmEvent(db, 'host', e.id, e.version, 'confirm');
    await db.query("UPDATE jobs SET due_at=now()-interval '1 second' WHERE event_id=$1 AND kind='EVENT_REMINDER'", [e.id]);
    await runDueJobs(db);
    await db.query("UPDATE jobs SET status='PENDING',due_at=now()-interval '1 second' WHERE event_id=$1 AND kind='EVENT_REMINDER'", [e.id]);
    await runDueJobs(db);
    const { rows } = await db.query<{ n: string }>("SELECT count(*)::text AS n FROM notifications WHERE event_id=$1 AND kind='EVENT_REMINDER'", [e.id]);
    assert.equal(rows[0]?.n, '4');
  } finally { await db.close(); }
});

test('a delayed start reminder job creates no new reminder after the event starts', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, e.id, e.version, `late-reminder-${actor}`);
    await confirmEvent(db, 'host', e.id, e.version, 'late-reminder-confirm');
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
      [e.id, new Date(Date.now() - 1000).toISOString()]);
    await db.query("UPDATE jobs SET due_at=now()-interval '1 second' WHERE event_id=$1 AND kind='EVENT_REMINDER'", [e.id]);
    await runDueJobs(db);
    const { rows } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM notifications WHERE event_id=$1 AND kind='EVENT_REMINDER'", [e.id]);
    assert.equal(rows[0]?.n, 0);
  } finally { await db.close(); }
});

test('an already queued start reminder is not sent externally after the event starts', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, e.id, e.version, `queued-reminder-${actor}`);
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'queued-reminder-consent');
    await setConsent(db, 'p2', 'EVENT_REMINDER', true, 'prestart-reminder-consent');
    await confirmEvent(db, 'host', e.id, e.version, 'queued-reminder-confirm');
    await db.query("UPDATE jobs SET due_at=now()-interval '1 second' WHERE event_id=$1 AND kind='EVENT_REMINDER'", [e.id]);
    await runDueJobs(db);
    const { rows: notices } = await db.query<{ id: string; user_id: string }>(
      "SELECT id,user_id FROM notifications WHERE event_id=$1 AND user_id IN ('p1','p2') AND kind='EVENT_REMINDER'", [e.id]);
    assert.equal(notices.length, 2);
    let prestartSends = 0;
    await dispatchNotification(db, notices.find(notice => notice.user_id === 'p2')!.id,
      { send: async () => { prestartSends++; return { status: 'ACCEPTED', providerRef: 'prestart-reminder' }; } });
    assert.equal(prestartSends, 1);
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
      [e.id, new Date(Date.now() - 1000).toISOString()]);
    let sends = 0;
    const staleId = notices.find(notice => notice.user_id === 'p1')!.id;
    await dispatchNotification(db, staleId, { send: async () => {
      sends++;
      return { status: 'ACCEPTED', providerRef: 'late-reminder' };
    } });
    assert.equal(sends, 0);
    const { rows: after } = await db.query<{ external_status: string }>('SELECT external_status FROM notifications WHERE id=$1', [staleId]);
    assert.equal(after[0]?.external_status, 'STALE_STATE');
  } finally { await db.close(); }
});

test('opening an in-app notice is owner-only and does not imply provider delivery', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    await register(db, 'p1', e.id, e.version, 'register');
    const { rows } = await db.query<{ id: string }>("SELECT id FROM notifications WHERE event_id=$1 AND user_id='p1' AND kind='REGISTRATION_STATUS'", [e.id]);
    const id = rows[0]!.id;
    await assert.rejects(() => markNotificationOpened(db, 'other', id, 'other-open'), { code: 'FORBIDDEN' });
    const opened = await markNotificationOpened(db, 'p1', id, 'open');
    assert.equal(opened.status, 'OPENED');
    assert.equal(opened.externalStatus, 'NOT_REQUESTED');
  } finally { await db.close(); }
});

test('removal suppresses stale reminders but preserves the removal notice', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'grant');
    const registration = await register(db, 'p1', e.id, e.version, 'join');
    await removeRegistration(db, 'host', registration.id, e.version, '报名规则不符合本场要求', 'remove');
    const sent: string[] = [];
    await runDueJobs(db, Date.now(), { send: async item => { sent.push(item.kind); return { status: 'ACCEPTED', providerRef: 'ref' }; } });
    assert.deepEqual(sent, ['REGISTRATION_REMOVED']);
    const { rows } = await db.query<{ kind: string; external_status: string }>('SELECT kind,external_status FROM notifications WHERE event_id=$1 AND user_id=$2', [e.id, 'p1']);
    assert.equal(rows.find(row => row.kind === 'REGISTRATION_STATUS')?.external_status, 'STALE_STATE');
    assert.equal(rows.find(row => row.kind === 'REGISTRATION_REMOVED')?.external_status, 'PROVIDER_ACCEPTED');
  } finally { await db.close(); }
});

test('a held activity still lets a member decline an existing offer while acceptance stays closed', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'hold-decline-p1');
    await register(db, 'p2', e.id, e.version, 'hold-decline-p2');
    await register(db, 'p3', e.id, e.version, 'hold-decline-p3');
    await register(db, 'w1', e.id, e.version, 'hold-decline-w1');
    await register(db, 'w2', e.id, e.version, 'hold-decline-w2');
    await cancelRegistration(db, 'p1', p1.id, e.version, 'hold-decline-release-seat');
    const { rows: offers } = await db.query<{ id: string }>("SELECT id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id]);
    const hold = await placeEventHold(db, 'ops', e.id, '等待核查线下安全问题', 'hold-decline');
    const notices = await listMemberNotifications(db, 'w1');
    const offerNotice = notices.items.find((item: any) => item.kind === 'WAITLIST_OFFER') as any;
    assert.equal(offerNotice?.actionable, false);
    assert.equal(offerNotice?.declinable, true);
    await declineOffer(db, 'w1', offers[0]!.id, e.version, 'hold-decline-owner');
    assert.equal((await db.query("SELECT id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id])).rows.length, 0);
    await releaseEventHold(db, 'ops', hold.id, '核查完成允许恢复招募', 'release-decline');
    const { rows: promoted } = await db.query<{ user_id: string }>(`SELECT r.user_id FROM offers o JOIN registrations r ON r.id=o.registration_id
      WHERE o.event_id=$1 AND o.status='ACTIVE'`, [e.id]);
    assert.deepEqual(promoted.map(row => row.user_id), ['w2']);
  } finally { await db.close(); }
});

test('an event safety hold suppresses a queued external waitlist offer', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const first = await register(db, 'p1', event.id, event.version, 'held-offer-p1');
    for (const actor of ['p2', 'p3', 'w1']) await register(db, actor, event.id, event.version, `held-offer-${actor}`);
    await setConsent(db, 'w1', 'EVENT_REMINDER', true, 'held-offer-consent');
    await cancelRegistration(db, 'p1', first.id, event.version, 'held-offer-release');
    const notice = (await listMemberNotifications(db, 'w1')).items.find((item: any) => item.kind === 'WAITLIST_OFFER') as any;
    assert.ok(notice?.id);
    await placeEventHold(db, 'ops', event.id, '需要核查现场安全风险', 'held-offer-hold');
    assert.equal((await listMemberNotifications(db, 'w1')).items.find((item: any) => item.id === notice.id)?.actionable, false);
    let sends = 0;
    await dispatchNotification(db, notice.id, { send: async () => {
      sends++;
      return { status: 'ACCEPTED', providerRef: 'held-offer' };
    } });
    assert.equal(sends, 0);
    const { rows } = await db.query<{ external_status: string }>('SELECT external_status FROM notifications WHERE id=$1', [notice.id]);
    assert.equal(rows[0]?.external_status, 'STALE_STATE');
  } finally { await db.close(); }
});

test('closing public recruitment suppresses a persisted queued offer for a public event', async () => {
  const db = await createDatabase();
  try {
    await openSyntheticPublicCoverage(db, [input]);
    const draft = await createDraft(db, 'host', { ...input, visibility: 'PUBLIC', approvalMode: 'MANUAL' }, 'public-offer-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'public-offer-publish');
    await reviewEvent(db, 'ops', event.id, event.version, 'APPROVED', '已核对公开活动资料', 'public-offer-review');
    const first = await register(db, 'p1', event.id, event.version, 'public-offer-p1');
    await approveRegistration(db, 'host', first.id, event.version, 'public-offer-approve-p1');
    for (const actor of ['p2', 'p3']) {
      const requested = await register(db, actor, event.id, event.version, `public-offer-${actor}`);
      await approveRegistration(db, 'host', requested.id, event.version, `public-offer-approve-${actor}`);
    }
    const waiting = await register(db, 'w1', event.id, event.version, 'public-offer-w1');
    // A persisted waitlist row from an earlier import must still obey the current gate.
    await db.query("UPDATE registrations SET status='WAITLISTED' WHERE id=$1", [waiting.id]);
    await setConsent(db, 'w1', 'EVENT_REMINDER', true, 'public-offer-consent');
    await cancelRegistration(db, 'p1', first.id, event.version, 'public-offer-release');
    const notice = (await listMemberNotifications(db, 'w1')).items.find((item: any) => item.kind === 'WAITLIST_OFFER') as any;
    assert.ok(notice?.id);
    await setPublicGate(db, 'ops', 'CLOSED', '公开招募暂停核查安全事件', 'public-offer-close');
    assert.equal((await listMemberNotifications(db, 'w1')).items.find((item: any) => item.id === notice.id)?.actionable, false);
    let sends = 0;
    await dispatchNotification(db, notice.id, { send: async () => {
      sends++;
      return { status: 'ACCEPTED', providerRef: 'closed-public-offer' };
    } });
    assert.equal(sends, 0);
    const { rows } = await db.query<{ external_status: string }>('SELECT external_status FROM notifications WHERE id=$1', [notice.id]);
    assert.equal(rows[0]?.external_status, 'STALE_STATE');
  } finally { await db.close(); }
});

test('public recruitment closure leaves private event offers eligible for external dispatch', async () => {
  const db = await createDatabase();
  try {
    await openSyntheticPublicCoverage(db);
    const event = await published(db);
    const first = await register(db, 'p1', event.id, event.version, 'private-gate-p1');
    for (const actor of ['p2', 'p3', 'w1']) await register(db, actor, event.id, event.version, `private-gate-${actor}`);
    await setConsent(db, 'w1', 'EVENT_REMINDER', true, 'private-gate-consent');
    await cancelRegistration(db, 'p1', first.id, event.version, 'private-gate-release');
    const notice = (await listMemberNotifications(db, 'w1')).items.find((item: any) => item.kind === 'WAITLIST_OFFER') as any;
    await setPublicGate(db, 'ops', 'CLOSED', '仅暂停公开活动招募流程', 'private-gate-close');
    let sends = 0;
    await dispatchNotification(db, notice.id, { send: async () => {
      sends++;
      return { status: 'ACCEPTED', providerRef: 'private-offer' };
    } });
    assert.equal(sends, 1);
    const { rows } = await db.query<{ external_status: string }>('SELECT external_status FROM notifications WHERE id=$1', [notice.id]);
    assert.equal(rows[0]?.external_status, 'PROVIDER_ACCEPTED');
  } finally { await db.close(); }
});

test('expired waitlist offer is not sent externally before the expiry job runs', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    const first = await register(db, 'p1', e.id, e.version, 'expiry-p1');
    await register(db, 'p2', e.id, e.version, 'expiry-p2');
    await register(db, 'p3', e.id, e.version, 'expiry-p3');
    await setConsent(db, 'w1', 'EVENT_REMINDER', true, 'expiry-consent');
    await register(db, 'w1', e.id, e.version, 'expiry-w1');
    await cancelRegistration(db, 'p1', first.id, e.version, 'expiry-release');
    const { rows } = await db.query<{ id: string; offer_id: string }>(`SELECT n.id,n.detail->>'offerId' AS offer_id
      FROM notifications n WHERE n.event_id=$1 AND n.user_id='w1' AND n.kind='WAITLIST_OFFER'`, [e.id]);
    await db.query("UPDATE offers SET expires_at=now()-interval '1 second' WHERE id=$1", [rows[0]!.offer_id]);
    let sends = 0;
    await dispatchNotification(db, rows[0]!.id, { send: async () => {
      sends++;
      return { status: 'ACCEPTED', providerRef: 'late-provider' };
    } });
    assert.equal(sends, 0);
    const { rows: notices } = await db.query<{ external_status: string }>('SELECT external_status FROM notifications WHERE id=$1', [rows[0]!.id]);
    assert.equal(notices[0]?.external_status, 'STALE_STATE');
  } finally { await db.close(); }
});

test('provider failure leaves one offer and its original in-app deadline until expiry', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    const first = await register(db, 'p1', e.id, e.version, 'failed-offer-p1');
    await register(db, 'p2', e.id, e.version, 'failed-offer-p2');
    await register(db, 'p3', e.id, e.version, 'failed-offer-p3');
    await setConsent(db, 'w1', 'EVENT_REMINDER', true, 'failed-offer-consent');
    await register(db, 'w1', e.id, e.version, 'failed-offer-w1');
    await cancelRegistration(db, 'p1', first.id, e.version, 'failed-offer-release');
    const notice = (await listMemberNotifications(db, 'w1')).items.find((item: any) => item.kind === 'WAITLIST_OFFER') as any;
    const offerId = notice.detail.offerId as string;
    const originalDeadline = notice.detail.expiresAt as string;
    await dispatchNotification(db, notice.id, { send: async () => { throw new Error('provider timeout'); } });
    const afterFailure = (await listMemberNotifications(db, 'w1')).items.find((item: any) => item.id === notice.id) as any;
    assert.equal(afterFailure.external_status, 'UNKNOWN_REQUIRES_RECONCILIATION');
    assert.equal(afterFailure.actionable, true);
    assert.equal(afterFailure.detail.expiresAt, originalDeadline);
    assert.equal((await db.query("SELECT id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id])).rows.length, 1);
    await db.query("UPDATE offers SET expires_at=now()-interval '1 second' WHERE id=$1", [offerId]);
    await db.query("UPDATE jobs SET due_at=now()-interval '1 second' WHERE event_id=$1 AND kind='EXPIRE_OFFER'", [e.id]);
    await runDueJobs(db);
    assert.equal((await db.query("SELECT id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id])).rows.length, 0);
  } finally { await db.close(); }
});
