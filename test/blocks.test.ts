import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createDatabase } from '../src/db.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { register } from './helpers.ts';
import { setConsent } from '../src/notifications.ts';
import { listEventAliases, setEventAlias } from '../src/event-aliases.ts';
import { listRepeatCandidates } from '../src/lifecycle.ts';
import { blockEventMember, listMyBlocks, revokeBlock } from '../src/blocks.ts';
import { exportPersonalData } from '../src/privacy.ts';
import { createApp } from '../src/server.ts';

const input = { title: '活动内昵称', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z',
  timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 6,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };

test('blocking an identified event member hides aliases both ways and excludes later invite candidates', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'block-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'block-publish');
    await register(db, 'p1', event.id, event.version, 'block-p1');
    await register(db, 'p2', event.id, event.version, 'block-p2');
    await setEventAlias(db, 'p1', event.id, '小明', true, 'block-alias-p1');
    await setEventAlias(db, 'p2', event.id, '小红', true, 'block-alias-p2');
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p2','block-p2-openid')");
    const target = (await listEventAliases(db, 'p1', event.id)).find(item => item.displayName === '小红');
    assert.ok(target);
    await setConsent(db, 'p2', 'SIMILAR_ACTIVITY_INVITES', true, 'block-consent');
    await db.query("UPDATE events SET status='COMPLETED' WHERE id=$1", [event.id]);
    assert.deepEqual(await listRepeatCandidates(db, 'host', event.id), ['p2']);

    await assert.rejects(() => blockEventMember(db, 'outsider', event.id, target.id, 'block-outsider'), { code: 'FORBIDDEN' });
    const block = await blockEventMember(db, 'p1', event.id, target.id, 'block-member');
    assert.equal((await listMyBlocks(db, 'p1')).length, 1);
    const exported = await exportPersonalData(db, 'p1');
    assert.equal(exported.blocks.length, 1);
    assert.equal(exported.blocks[0]?.id, block.id);
    assert.equal(JSON.stringify(exported.blocks).includes('p2'), false);
    assert.equal((await listEventAliases(db, 'p1', event.id)).some(item => item.displayName === '小红'), false);
    assert.equal((await listEventAliases(db, 'p2', event.id)).some(item => item.displayName === '小明'), false);
    assert.deepEqual(await listRepeatCandidates(db, 'host', event.id), ['p2']);
    const hostTarget = (await listEventAliases(db, 'host', event.id)).find(item => item.displayName === '小红');
    assert.ok(hostTarget);
    const hostBlock = await blockEventMember(db, 'host', event.id, hostTarget.id, 'block-host');
    assert.deepEqual(await listRepeatCandidates(db, 'host', event.id), []);
    await revokeBlock(db, 'host', hostBlock.id, 'unblock-host');
    await revokeBlock(db, 'p1', block.id, 'unblock-member');
    assert.equal((await listEventAliases(db, 'p1', event.id)).some(item => item.displayName === '小红'), true);
    assert.deepEqual(await listRepeatCandidates(db, 'host', event.id), ['p2']);
  } finally { await db.close(); }
});

test('blocking routes keep another member from reading or revoking a block', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'development', devAuth: true, checkInSecret: 'test-secret' });
  try {
    const draft = await createDraft(db, 'host', input, 'block-api-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'block-api-publish');
    await register(db, 'p1', event.id, event.version, 'block-api-p1');
    await register(db, 'p2', event.id, event.version, 'block-api-p2');
    await setEventAlias(db, 'p2', event.id, '可屏蔽成员', true, 'block-api-alias');
    const memberId = (await listEventAliases(db, 'p1', event.id))[0]!.id;
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const port = (server.address() as { port: number }).port;
    const request = async (path: string, actor: string, method = 'GET', body?: unknown, key?: string) => {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, { method,
        headers: { 'X-Dev-User': actor, ...(key ? { 'Idempotency-Key': key } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, body: await response.json() as Record<string, any> };
    };
    const blocked = await request(`/events/${event.id}/blocks`, 'p1', 'POST', { memberId }, 'block-api');
    assert.equal(blocked.status, 201);
    assert.equal((await request('/me/blocks', 'p1')).body.items.length, 1);
    assert.equal((await request('/me/blocks', 'p2')).body.items.length, 0);
    assert.equal((await request(`/me/blocks/${blocked.body.id}/revoke`, 'p2', 'POST', {}, 'revoke-forged')).status, 404);
    assert.equal((await request(`/me/blocks/${blocked.body.id}/revoke`, 'p1', 'POST', {}, 'revoke-owner')).status, 200);
    assert.equal((await request('/me/blocks', 'p1')).body.items.length, 0);
  } finally { if (server.listening) await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});
