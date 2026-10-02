import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { register, approveRegistration, listPendingApprovals } from '../src/registrations.ts';
import { listMemberNotifications, markAllNotificationsOpened } from '../src/notifications.ts';
import { grantCohost, revokeCohost } from '../src/cohosts.ts';
import { placeEventHold, releaseEventHold } from '../src/safety.ts';
import { createApp } from '../src/server.ts';
import { publishApprovedInvite } from './helpers.ts';

const input = { title: '审核消息测试', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 6,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z',
  feeMode: 'FREE', feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE',
  approvalMode: 'MANUAL', hostParticipates: true };

test('approval inbox contains only live requests for a current host or approved cohost', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'inbox-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'inbox-publish');
    const first = await register(db, 'one', event.id, event.version, 'inbox-one', event.inviteToken ?? null);
    const second = await register(db, 'two', event.id, event.version, 'inbox-two', event.inviteToken ?? null);
    const hostInbox = await listPendingApprovals(db, 'host', 0);
    assert.deepEqual(hostInbox.items.map(item => item.registrationId), [first.id, second.id]);
    assert.equal(hostInbox.items[0]?.eventTitle, input.title);
    assert.equal(hostInbox.items[0]?.expectedVersion, event.version);
    assert.equal(hostInbox.items[0]?.isHost, true);
    assert.deepEqual((await listPendingApprovals(db, 'stranger', 0)).items, []);
    const grant = await grantCohost(db, 'host', event.id, event.version, 'helper',
      ['APPROVE_REGISTRATION'], '2027-01-04T14:00:00.000Z', 'inbox-grant');
    assert.equal((await listPendingApprovals(db, 'helper', 0)).items.length, 2);
    assert.equal((await listPendingApprovals(db, 'helper', 0)).items[0]?.isHost, false);
    const hold = await placeEventHold(db, 'operator:safety', event.id, '报名信息需要人工核查', 'inbox-hold');
    assert.deepEqual((await listPendingApprovals(db, 'host', 0)).items, []);
    await releaseEventHold(db, 'operator:safety', hold.id, '核查完成可以恢复报名', 'inbox-release');
    assert.equal((await listPendingApprovals(db, 'host', 0)).items.length, 2);
    await db.query("UPDATE emergency_gate SET status='CLOSED' WHERE id=1");
    assert.deepEqual((await listPendingApprovals(db, 'host', 0)).items, []);
    await db.query("UPDATE emergency_gate SET status='OPEN' WHERE id=1");
    const beforeApproval = await listPendingApprovals(db, 'host', 0);
    await assert.rejects(() => listPendingApprovals(db, 'host', 1), { code: 'BAD_REQUEST' });
    assert.equal((await listPendingApprovals(db, 'host', 1, beforeApproval.snapshot)).items[0]?.registrationId,
      second.id);
    await approveRegistration(db, 'helper', first.id, event.version, 'inbox-approve');
    await assert.rejects(() => listPendingApprovals(db, 'host', 1, beforeApproval.snapshot),
      { code: 'QUEUE_CHANGED' });
    assert.deepEqual((await listPendingApprovals(db, 'host', 0)).items.map(item => item.registrationId), [second.id]);
    await revokeCohost(db, 'host', grant.id, 'inbox-revoke');
    assert.deepEqual((await listPendingApprovals(db, 'helper', 0)).items, []);
  } finally { await db.close(); }
});

test('approval inbox keeps full-capacity requests visible but marks them unavailable', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', { ...input, maxParticipants: 4 }, 'full-inbox-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'full-inbox-publish');
    const requests: Array<{ id: string }> = [];
    for (const actor of ['one', 'two', 'three', 'four']) {
      requests.push(await register(db, actor, event.id, event.version, `full-inbox-${actor}`, event.inviteToken ?? null));
    }
    assert.equal((await listPendingApprovals(db, 'host')).items[0]?.canApprove, true);
    for (const [index, request] of requests.slice(0, 3).entries()) {
      await approveRegistration(db, 'host', request.id, event.version, `full-inbox-approve-${index}`);
    }
    const inbox = await listPendingApprovals(db, 'host');
    assert.deepEqual(inbox.items.map(item => item.registrationId), [requests[3]!.id]);
    assert.equal(inbox.items[0]?.canApprove, false);
    await assert.rejects(() => approveRegistration(db, 'host', requests[3]!.id, event.version,
      'full-inbox-over-capacity'), { code: 'EVENT_FULL' });
  } finally { await db.close(); }
});

test('mark all read changes only the actor notices and is idempotent', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'read-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'read-publish');
    await register(db, 'one', event.id, event.version, 'read-one', event.inviteToken ?? null);
    await register(db, 'two', event.id, event.version, 'read-two', event.inviteToken ?? null);
    assert.ok((await listMemberNotifications(db, 'one')).items.some(item => item.status !== 'OPENED'));
    const result = await markAllNotificationsOpened(db, 'one', 'read-all');
    assert.ok(result.opened >= 1);
    const openedAudit = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM audit
      WHERE actor_id='one' AND action='OPEN_NOTIFICATION'`);
    assert.equal(openedAudit.rows[0]?.total, result.opened);
    assert.deepEqual(await markAllNotificationsOpened(db, 'one', 'read-all'), result);
    assert.equal((await listMemberNotifications(db, 'one')).items.every(item => item.status === 'OPENED'), true);
    assert.ok((await listMemberNotifications(db, 'two')).items.some(item => item.status !== 'OPENED'));
    assert.equal((await markAllNotificationsOpened(db, 'one', 'read-again')).opened, 0);
  } finally { await db.close(); }
});

test('message action HTTP routes enforce actor scope and approval version', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'development', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'test-secret' });
  server.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const request = async (path: string, actor: string, method = 'GET', body?: object) => {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method,
        headers: { 'X-Dev-User': actor, 'Idempotency-Key': `${actor}-${path}-key`,
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() as Record<string, any> };
    };
    const draft = await createDraft(db, 'host', input, 'http-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'http-publish');
    const registration = await register(db, 'one', event.id, event.version, 'http-one', event.inviteToken ?? null);
    assert.equal((await request('/me/approval-requests?offset=0', 'one')).body.items.length, 0);
    const inbox = await request('/me/approval-requests?offset=0', 'host');
    assert.equal(inbox.body.items[0].registrationId, registration.id);
    assert.equal((await request('/me/notifications/open-all', 'one', 'POST', {})).status, 200);
    assert.equal((await request('/me/notifications', 'one')).body.items.every((item: any) => item.status === 'OPENED'), true);
    assert.equal((await request(`/registrations/${registration.id}/approve`, 'one', 'POST',
      { expectedVersion: event.version })).status, 403);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});
