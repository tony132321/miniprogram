import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { loginWithWechat } from '../src/auth.ts';
import { createApp } from '../src/server.ts';
import { createDraft } from '../src/events.ts';
import { publishApprovedInvite } from './helpers.ts';
import { requiresVerifiedPilot } from '../src/pilot-access.ts';

const eventInput = {
  title: '成人受控试点', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
};

test('adult pilot admission covers seat creation and acceptance while keeping exit and safety routes open', () => {
  for (const path of ['/events', '/events/e1/publish', '/events/e1/registrations', '/events/e1/interests',
    '/events/e1/reservations', '/events/e1/confirm', '/events/e1/repeat', '/events/e1/checkins',
    '/events/e1/content', '/reservations/token/claim', '/offers/o1/accept', '/registrations/r1/approve',
    '/registrations/r1/reconfirm']) assert.equal(requiresVerifiedPilot('POST', path), true, path);
  for (const path of ['/registrations/r1/cancel', '/offers/o1/decline', '/events/e1/cancel',
    '/reports', '/privacy/requests']) assert.equal(requiresVerifiedPilot('POST', path), false, path);
  assert.equal(requiresVerifiedPilot('GET', '/me/events'), false);
});

test('production login alone cannot create or join a controlled adult pilot', async () => {
  const db = await createDatabase();
  const exchange = async (code: string) => ({ openid: code });
  const host = await loginWithWechat(db, exchange, 'verified-host');
  const member = await loginWithWechat(db, exchange, 'verified-member');
  const stranger = await loginWithWechat(db, exchange, 'unverified-stranger');
  const server = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'test-secret',
    wechatExchange: exchange, pilotUserIds: [host.userId, member.userId] });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = async (path: string, token: string, body: unknown, key: string) => {
    const response = await fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    const deniedDraft = await post('/events', stranger.token, eventInput, 'stranger-draft');
    assert.equal(deniedDraft.status, 403);
    assert.equal(deniedDraft.body.code, 'PILOT_NOT_VERIFIED');
    assert.equal((await db.query('SELECT id FROM events')).rows.length, 0);
    const draft = await createDraft(db, host.userId, eventInput, 'pilot-draft', false);
    const event = await publishApprovedInvite(db, host.userId, draft.id, draft.version, 'pilot-publish');
    const deniedJoin = await post(`/events/${event.id}/registrations`, stranger.token,
      { expectedVersion: event.version, inviteToken: event.inviteToken, acceptedRules: true }, 'stranger-join');
    assert.equal(deniedJoin.status, 403);
    assert.equal(deniedJoin.body.code, 'PILOT_NOT_VERIFIED');
    assert.equal((await db.query('SELECT id FROM registrations WHERE user_id=$1', [stranger.userId])).rows.length, 0);
    const joined = await post(`/events/${event.id}/registrations`, member.token,
      { expectedVersion: event.version, inviteToken: event.inviteToken, acceptedRules: true }, 'member-join');
    assert.equal(joined.status, 201);
    assert.equal(joined.body.status, 'CONFIRMED');
    assert.equal((await fetch(base + '/me/events', { headers: { Authorization: `Bearer ${stranger.token}` } })).status, 200);
    const revokedServer = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'test-secret',
      wechatExchange: exchange, pilotUserIds: [host.userId] });
    revokedServer.listen(0, '127.0.0.1'); await once(revokedServer, 'listening');
    try {
      const revokedBase = `http://127.0.0.1:${(revokedServer.address() as { port: number }).port}`;
      const response = await fetch(`${revokedBase}/registrations/${joined.body.id}/cancel`, { method: 'POST',
        headers: { Authorization: `Bearer ${member.token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'revoked-exit' },
        body: JSON.stringify({ expectedVersion: event.version }) });
      assert.equal(response.status, 200);
      assert.equal((await response.json() as { status: string }).status, 'CANCELLED');
    } finally { await new Promise<void>(resolve => revokedServer.close(() => resolve())); }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('empty production pilot list closes new participation without blocking reads', async () => {
  const db = await createDatabase();
  const exchange = async (code: string) => ({ openid: code });
  const account = await loginWithWechat(db, exchange, 'signed-in-unverified');
  const server = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'test-secret', wechatExchange: exchange });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const response = await fetch(base + '/events', { method: 'POST', headers: { Authorization: `Bearer ${account.token}`,
      'Content-Type': 'application/json', 'Idempotency-Key': 'no-list' }, body: JSON.stringify(eventInput) });
    assert.equal(response.status, 403);
    assert.equal((await response.json() as { code: string }).code, 'PILOT_NOT_VERIFIED');
    assert.equal((await fetch(base + '/me/events', { headers: { Authorization: `Bearer ${account.token}` } })).status, 200);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});
