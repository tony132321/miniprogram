import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createDatabase } from '../src/db.ts';
import { runDueJobs } from '../src/jobs.ts';
import { createApp } from '../src/server.ts';
import { approveInviteById } from './helpers.ts';

test('API workflow with four independent seats fills, promotes, checks in, completes, and repeats one activity', async () => {
  const db = await createDatabase();
  let now = Date.now();
  const start = now + 2 * 60 * 60_000;
  const end = start + 60 * 60_000;
  const server = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'],
    checkInSecret: 'smoke-secret', clock: () => now });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  async function api(path: string, actor: string, method = 'GET', body?: unknown, key?: string) {
    const response = await fetch(base + path, { method, headers: { 'X-Dev-User': actor,
      ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
    body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() as Record<string, any> };
  }
  try {
    const data = { title: '独立席位整链路测试', type: 'badminton', startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(), timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共羽毛球馆',
      venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
      registrationDeadline: new Date(start - 30 * 60_000).toISOString(), confirmationDeadline: new Date(start - 60 * 60_000).toISOString(),
      feeMode: 'AA', feeCapFen: 5000, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: false };
    const draft = await api('/events', 'host', 'POST', data, 'draft');
    assert.equal(draft.status, 201);
    const e = await api(`/events/${draft.body.id}/publish`, 'host', 'POST', { expectedVersion: draft.body.version }, 'publish');
    assert.equal(e.status, 200);
    await approveInviteById(db, 'host', e.body.id);
    assert.equal((await api(`/events/${e.body.id}`, 'host')).body.stats.confirmed, 0);
    const sourceToken = 'a'.repeat(32);
    assert.equal((await api(`/events/${e.body.id}/share-intents`, 'host', 'POST',
      { expectedVersion: e.body.version, sourceToken }, 'share-intent')).status, 201);
    assert.equal((await api(`/i/${e.body.inviteToken}`, 'visitor')).status, 200);
    assert.equal((await api(`/i/${e.body.inviteToken}?source=${sourceToken}`, 'p1')).status, 200);
    assert.deepEqual((await api(`/events/${e.body.id}/share-metrics`, 'host')).body,
      { shareIntents: 1, attributedOpens: 1, unknownSourceOpens: 1 });
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('waiting','smoke-waiting')");
    const consent = await api('/me/consents', 'waiting');
    assert.equal((await api('/me/consents', 'waiting', 'POST',
      { eventReminder: true, noticeVersion: consent.body.eventReminderNotice.version }, 'waiting-consent')).status, 200);
    const join = (user: string) => api(`/events/${e.body.id}/registrations`, user, 'POST', { expectedVersion: e.body.version, inviteToken: e.body.inviteToken, acceptedRules: true }, `join-${user}`);
    const p1 = await join('p1'); await join('p2'); await join('p3'); await join('p4');
    assert.equal((await api(`/events/${e.body.id}`, 'host')).body.stats.confirmed, 4);
    const waiting = await join('waiting');
    assert.equal(waiting.body.status, 'WAITLISTED');
    assert.equal((await api(`/registrations/${p1.body.id}/cancel`, 'p1', 'POST',
      { expectedVersion: e.body.version }, 'cancel-p1')).status, 200);
    await runDueJobs(db);
    const inbox = await api('/me/notifications', 'waiting');
    const offerNotice = inbox.body.items.find((item: any) => item.kind === 'WAITLIST_OFFER');
    assert.equal(offerNotice?.actionable, true);
    assert.equal(offerNotice?.external_status, 'PURPOSE_NOT_CONFIGURED');
    const followups = await api('/ops/notifications/followups', 'ops');
    assert.equal(followups.status, 200);
    assert.equal(followups.body.items.some((item: any) => item.notificationId === offerNotice.id &&
      item.externalStatus === 'PURPOSE_NOT_CONFIGURED' && item.failureCode === 'PURPOSE_NOT_CONFIGURED'), true);
    const offerId = offerNotice?.detail.offerId;
    assert.ok(offerId);
    const accepted = await api(`/offers/${offerId}/accept`, 'waiting', 'POST', { expectedVersion: e.body.version }, 'accept');
    assert.equal(accepted.body.status, 'CONFIRMED');
    assert.equal((await api('/me/notifications', 'waiting')).body.items.find((item: any) => item.kind === 'WAITLIST_OFFER')?.actionable, false);
    assert.equal((await api('/me/registrations', 'waiting')).body.items[0].status, 'CONFIRMED');
    assert.equal((await api(`/events/${e.body.id}`, 'host')).body.stats.confirmed, 4);
    const confirmed = await api(`/events/${e.body.id}/confirm`, 'host', 'POST', { expectedVersion: e.body.version }, 'confirm');
    assert.equal(confirmed.body.status, 'CONFIRMED');
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
      [e.body.id, new Date(Date.now() - 5 * 60_000).toISOString()]);
    now = start + 5 * 60_000;
    const token = await api(`/events/${e.body.id}/checkin-token`, 'host', 'POST', { expectedVersion: e.body.version }, 'token');
    const checked = await api(`/events/${e.body.id}/checkins`, 'p2', 'POST', { expectedVersion: e.body.version, token: token.body.token }, 'checkin');
    assert.equal(checked.body.evidence, 'SCAN');
    now = end + 5 * 60_000;
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{endAt}',to_jsonb($2::text),true) WHERE id=$1",
      [e.body.id, new Date(Date.now() - 60_000).toISOString()]);
    const completed = await api(`/events/${e.body.id}/complete`, 'host', 'POST', { expectedVersion: e.body.version, held: true, actualCount: 4, issues: [] }, 'complete');
    assert.equal(completed.status, 200);
    assert.equal(completed.body.held, true);
    assert.equal((await api(`/events/${e.body.id}/outcome`, 'waiting')).body.level, 'HOST_ONLY');
    assert.equal((await api(`/events/${e.body.id}/feedback`, 'waiting', 'POST', { expectedVersion: e.body.version, held: true, wouldRepeat: true }, 'feedback-positive')).status, 201);
    assert.equal((await api(`/events/${e.body.id}/outcome`, 'waiting')).body.level, 'MEMBER_CORROBORATED');
    assert.equal((await api(`/events/${e.body.id}/feedback`, 'p2', 'POST', { expectedVersion: e.body.version, held: false, wouldRepeat: false, reason: '实际活动与描述不符' }, 'feedback-dispute')).status, 201);
    assert.equal((await api(`/events/${e.body.id}/outcome`, 'waiting')).body.level, 'DISPUTED');
    const next = await api(`/events/${e.body.id}/repeat`, 'host', 'POST', { expectedVersion: e.body.version }, 'repeat');
    assert.equal(next.body.status, 'DRAFT');
    assert.equal(next.body.payload.startAt, undefined);
    assert.equal(next.body.payload.venueName, undefined);
    assert.equal(next.body.payload.feeMode, undefined);
    assert.equal(next.body.payload.feeCapFen, undefined);
    assert.equal(next.body.inviteToken, undefined);
    const inherited = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM registrations WHERE event_id=$1', [next.body.id]);
    assert.equal(inherited.rows[0]?.count, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});
