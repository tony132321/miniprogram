import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { createApp } from '../src/server.ts';

test('my registrations can be scoped to one activity without exposing another person', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  async function get(path: string, actor: string) {
    const response = await fetch(base + path, { headers: { 'X-Dev-User': actor } });
    return { status: response.status, body: await response.json() as Record<string, any> };
  }
  try {
    const first = await createDraft(db, 'host', { title: '第一场' }, 'first');
    const second = await createDraft(db, 'host', { title: '第二场' }, 'second');
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status) VALUES
      ('first-alice',$1,'alice','CONFIRMED'),
      ('second-alice',$2,'alice','WAITLISTED'),
      ('first-bob',$1,'bob','CONFIRMED')`, [first.id, second.id]);

    const scoped = await get(`/me/registrations?eventId=${encodeURIComponent(first.id)}`, 'alice');
    assert.equal(scoped.status, 200);
    assert.deepEqual(scoped.body.items.map((item: { id: string }) => item.id), ['first-alice']);
    assert.deepEqual((await get(`/me/registrations?eventId=${encodeURIComponent(first.id)}`, 'bob'))
      .body.items.map((item: { id: string }) => item.id), ['first-bob']);
    assert.deepEqual((await get(`/me/registrations?eventId=${encodeURIComponent(second.id)}`, 'bob')).body.items, []);
    assert.deepEqual(new Set((await get('/me/registrations', 'alice')).body.items.map((item: { id: string }) => item.id)),
      new Set(['first-alice', 'second-alice']));
    assert.equal((await get('/me/registrations?eventId=', 'alice')).status, 400);
    assert.equal((await get(`/me/registrations?eventId=${'x'.repeat(129)}`, 'alice')).status, 400);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});
