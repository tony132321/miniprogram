import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createDatabase } from '../src/db.ts';
import type { Database } from '../src/db.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { grantCohost, revokeCohost, hasCohostCapability } from '../src/cohosts.ts';
import { createApp } from '../src/server.ts';
import { loginWithWechat } from '../src/auth.ts';
import { register } from './helpers.ts';
import { checkIn, createCheckInToken, requestManualCheckIn } from '../src/lifecycle.ts';
import { approveRegistration } from '../src/registrations.ts';
import { createContent } from '../src/collaboration.ts';

const input = { title: '协办权限测试', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z',
  timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 6,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };

test('one event check-in grant is revocable and never grants approval or another event', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'cohost-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'cohost-publish');
    const otherDraft = await createDraft(db, 'host', { ...input, title: '另一场' }, 'other-draft');
    const other = await publishEvent(db, 'host', otherDraft.id, otherDraft.version, 'other-publish');
    const grant = await grantCohost(db, 'host', event.id, event.version, 'helper', ['CHECKIN_MANAGE'],
      '2027-01-04T14:00:00.000Z', 'grant-one');
    assert.equal(await hasCohostCapability(db, 'helper', event.id, 'CHECKIN_MANAGE'), true);
    assert.equal(await hasCohostCapability(db, 'helper', event.id, 'APPROVE_REGISTRATION'), false);
    assert.equal(await hasCohostCapability(db, 'helper', other.id, 'CHECKIN_MANAGE'), false);
    assert.deepEqual(await grantCohost(db, 'host', event.id, event.version, 'helper', ['CHECKIN_MANAGE'],
      '2027-01-04T14:00:00.000Z', 'grant-one'), grant);
    await assert.rejects(() => revokeCohost(db, 'helper', grant.id, 'forged-revoke'), { code: 'FORBIDDEN' });
    const revoked = await revokeCohost(db, 'host', grant.id, 'revoke-one');
    assert.equal(revoked.status, 'REVOKED');
    assert.equal(await hasCohostCapability(db, 'helper', event.id, 'CHECKIN_MANAGE'), false);
    assert.deepEqual(await revokeCohost(db, 'host', grant.id, 'revoke-one'), revoked);
    const { rows: audit } = await db.query<{ action: string }>("SELECT action FROM audit WHERE event_id=$1 AND action IN ('GRANT_COHOST','REVOKE_COHOST') ORDER BY created_at,id", [event.id]);
    assert.equal(audit.filter(row => row.action === 'GRANT_COHOST').length, 1);
    assert.equal(audit.filter(row => row.action === 'REVOKE_COHOST').length, 1);
  } finally { await db.close(); }
});

test('grant validates actor, capability, expiry and event version', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'validation-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'validation-publish');
    const grant = (actor: string, version: number, caps: string[], expiresAt: string, key: string) =>
      grantCohost(db, actor, event.id, version, 'helper', caps, expiresAt, key);
    await assert.rejects(() => grant('helper', event.version, ['CHECKIN_MANAGE'], '2027-01-04T14:00:00.000Z', 'self'), { code: 'FORBIDDEN' });
    await assert.rejects(() => grant('host', event.version - 1, ['CHECKIN_MANAGE'], '2027-01-04T14:00:00.000Z', 'old'), { code: 'VERSION_CONFLICT' });
    await assert.rejects(() => grant('host', event.version, ['HOST_ALL'], '2027-01-04T14:00:00.000Z', 'broad'), { code: 'BAD_REQUEST' });
    await assert.rejects(() => grant('host', event.version, ['CHECKIN_MANAGE'], '2000-01-01T00:00:00.000Z', 'expired'), { code: 'BAD_REQUEST' });
    assert.equal((await db.query('SELECT id FROM cohost_grants')).rows.length, 0);
  } finally { await db.close(); }
});

test('a fast application clock cannot reject a grant that is valid by database time', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'fast-cohost-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'fast-cohost-publish');
    const actualNow = Date.now;
    const expiresAt = new Date(actualNow() + 30 * 60_000).toISOString();
    const fastNow = () => actualNow() + 2 * 60 * 60_000;
    const clockDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
          Date.now = actualNow;
          try { return await tx.query<T>(sql, params); }
          finally { Date.now = fastNow; }
        }
      }))
    };
    Date.now = fastNow;
    try {
      const grant = await grantCohost(clockDb, 'host', event.id, event.version, 'helper', ['CHECKIN_MANAGE'],
        expiresAt, 'fast-cohost-grant');
      assert.equal(grant.status, 'ACTIVE');
    } finally { Date.now = actualNow; }
    assert.equal(await hasCohostCapability(db, 'helper', event.id, 'CHECKIN_MANAGE'), true);
  } finally { await db.close(); }
});

test('grant expires at the database write boundary without leaving authorization or audit', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'boundary-cohost-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'boundary-cohost-publish');
    const actualNow = Date.now;
    const expiresAt = new Date(actualNow() + 30 * 60_000).toISOString();
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
          if (!crossed && sql.startsWith('INSERT INTO cohost_grants')) {
            crossed = true;
            Date.now = () => actualNow() + 60 * 60_000;
            try { return await tx.query<T>(sql, params); }
            finally { Date.now = actualNow; }
          }
          return tx.query<T>(sql, params);
        }
      }))
    };
    await assert.rejects(() => grantCohost(racingDb, 'host', event.id, event.version, 'helper',
      ['CHECKIN_MANAGE'], expiresAt, 'boundary-cohost-grant'), { code: 'BAD_REQUEST' });
    assert.equal(crossed, true);
    assert.equal((await db.query('SELECT id FROM cohost_grants WHERE event_id=$1', [event.id])).rows.length, 0);
    assert.equal((await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM audit WHERE event_id=$1 AND action='GRANT_COHOST'", [event.id])).rows[0]?.count, 0);
  } finally { await db.close(); }
});

test('cohost bearer session has only current event capability and loses it immediately on revoke', async () => {
  const db = await createDatabase();
  const exchange = async (code: string) => ({ openid: code });
  const host = await loginWithWechat(db, exchange, 'cohost-host');
  const helper = await loginWithWechat(db, exchange, 'cohost-helper');
  const participant = await loginWithWechat(db, exchange, 'cohost-participant');
  const draft = await createDraft(db, host.userId, input, 'http-cohost-draft');
  const event = await publishEvent(db, host.userId, draft.id, draft.version, 'http-cohost-publish');
  const otherDraft = await createDraft(db, host.userId, { ...input, title: '活动 B' }, 'http-cohost-other-draft');
  const other = await publishEvent(db, host.userId, otherDraft.id, otherDraft.version, 'http-cohost-other-publish');
  await register(db, participant.userId, event.id, event.version, 'http-cohost-join');
  await db.query("UPDATE events SET status='CONFIRMED' WHERE id=$1", [event.id]);
  await db.query("UPDATE events SET status='CONFIRMED' WHERE id=$1", [other.id]);
  await db.query("UPDATE events SET payload=jsonb_set(jsonb_set(payload,'{startAt}',to_jsonb($2::text),true),'{endAt}',to_jsonb($3::text),true) WHERE id=$1",
    [event.id, new Date(Date.now() - 5 * 60_000).toISOString(), new Date(Date.now() + 60 * 60_000).toISOString()]);
  const server = createApp(db, { environment: 'test', devAuth: false, checkInSecret: 'cohost-secret', wechatExchange: exchange });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const get = (path: string, token: string) => fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
  const post = (path: string, token: string, body: unknown, key: string) => fetch(base + path, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body)
  });
  try {
    assert.equal((await get(`/events/${event.id}`, helper.token)).status, 403);
    const granted = await post(`/events/${event.id}/cohosts`, host.token,
      { expectedVersion: event.version, userId: helper.userId, capabilities: ['CHECKIN_MANAGE'],
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }, 'http-grant');
    assert.equal(granted.status, 200);
    const grant = await granted.json() as { id: string };
    const grants = await get(`/events/${event.id}/cohosts`, host.token);
    assert.equal(grants.status, 200);
    assert.equal(((await grants.json() as { items: unknown[] }).items).length, 1);
    assert.equal((await get(`/events/${event.id}/cohosts`, helper.token)).status, 403);
    const detail = await get(`/events/${event.id}`, helper.token);
    assert.equal(detail.status, 200);
    const eventBody = await detail.json() as { inviteToken?: string; cohostCapabilities?: string[] };
    assert.equal(eventBody.inviteToken, undefined);
    assert.deepEqual(eventBody.cohostCapabilities, ['CHECKIN_MANAGE']);
    assert.equal((await get(`/events/${other.id}`, helper.token)).status, 403);
    assert.equal((await post(`/events/${event.id}/checkin-token`, helper.token,
      { expectedVersion: event.version }, 'http-checkin-token')).status, 200);
    const roster = await get(`/events/${event.id}/registrations`, helper.token);
    assert.equal(roster.status, 200);
    const rosterItems = (await roster.json() as { items: Array<{ status: string }> }).items;
    assert.ok(rosterItems.length > 0);
    assert.ok(rosterItems.every(item => item.status === 'CONFIRMED'));
    assert.equal((await post(`/events/${event.id}/content`, helper.token,
      { kind: 'ANNOUNCEMENT', body: '协办不应发布公告' }, 'http-denied-announcement')).status, 403);
    assert.equal((await post(`/events/${other.id}/checkin-token`, helper.token,
      { expectedVersion: other.version }, 'http-cross-event')).status, 403);
    const revoked = await post(`/cohost-grants/${grant.id}:revoke`, host.token, {}, 'http-revoke');
    assert.equal(revoked.status, 200);
    assert.equal((await post(`/events/${event.id}/checkin-token`, helper.token,
      { expectedVersion: event.version }, 'http-revoked-token')).status, 403);
    assert.equal((await get(`/events/${event.id}`, helper.token)).status, 403);
    assert.equal((await get('/me/events', helper.token)).status, 200);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('revocation removes management but preserves a participant own check-in', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'participant-cohost-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'participant-cohost-publish');
    await register(db, 'helper', event.id, event.version, 'participant-cohost-join');
    await register(db, 'p2', event.id, event.version, 'participant-cohost-p2');
    await register(db, 'p3', event.id, event.version, 'participant-cohost-p3');
    await db.query("UPDATE events SET status='CONFIRMED' WHERE id=$1", [event.id]);
    const grant = await grantCohost(db, 'host', event.id, event.version, 'helper', ['CHECKIN_MANAGE'],
      '2027-01-04T14:00:00.000Z', 'participant-cohost-grant');
    await revokeCohost(db, 'host', grant.id, 'participant-cohost-revoke');
    const at = Date.parse(input.startAt) + 1_000;
    await assert.rejects(() => requestManualCheckIn(db, 'helper', event.id, event.version, 'p2',
      'revoked-manual', at), { code: 'FORBIDDEN' });
    const checked = await checkIn(db, 'helper', event.id, event.version,
      createCheckInToken(event.id, 'participant-secret', at), 'participant-secret', 'self-scan', at);
    assert.equal(checked.userId, 'helper');
  } finally { await db.close(); }
});

test('approval and announcement grants each authorize only their named action', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', { ...input, approvalMode: 'MANUAL' }, 'capability-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'capability-publish');
    const approvalGrant = await grantCohost(db, 'host', event.id, event.version, 'approver',
      ['APPROVE_REGISTRATION'], '2027-01-04T14:00:00.000Z', 'approve-grant');
    await grantCohost(db, 'host', event.id, event.version, 'announcer',
      ['MANAGE_ANNOUNCEMENTS'], '2027-01-04T14:00:00.000Z', 'announce-grant');
    const first = await register(db, 'p1', event.id, event.version, 'requested-one');
    assert.equal(first.status, 'REQUESTED');
    await assert.rejects(() => approveRegistration(db, 'announcer', first.id, event.version, 'wrong-approve'), { code: 'FORBIDDEN' });
    assert.equal((await approveRegistration(db, 'approver', first.id, event.version, 'right-approve')).status, 'CONFIRMED');
    await assert.rejects(() => createContent(db, 'approver', event.id, 'ANNOUNCEMENT', '无公告权限', null, 'wrong-announcement'),
      { code: 'FORBIDDEN' });
    assert.equal((await createContent(db, 'announcer', event.id, 'ANNOUNCEMENT', '请提前十分钟到场', null,
      'right-announcement')).status, 'PENDING_REVIEW');
    await revokeCohost(db, 'host', approvalGrant.id, 'approve-revoke');
    const second = await register(db, 'p2', event.id, event.version, 'requested-two');
    await assert.rejects(() => approveRegistration(db, 'approver', second.id, event.version, 'revoked-approve'), { code: 'FORBIDDEN' });
    assert.equal((await approveRegistration(db, 'host', second.id, event.version, 'host-approve')).status, 'CONFIRMED');
  } finally { await db.close(); }
});
