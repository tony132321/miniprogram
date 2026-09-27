import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';

test('member notifications prioritize unread notices and page beyond 100 without cross-user access', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const read = (user: string, query: string) => fetch(`${base}/me/notifications${query}`, { headers: { 'X-Dev-User': user } });
  try {
    await db.query("INSERT INTO events(id,host_id,status,version,payload) VALUES('notice-event','host','DRAFT',1,'{}')");
    await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,created_at)
      SELECT 'unread-'||n,'notice-event','member','EVENT_CANCELLED',1,
      '2027-01-01T00:00:00.000Z'::timestamptz+n*interval '1 minute'
      FROM generate_series(1,105) AS n`);
    await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,read_at,created_at)
      SELECT 'read-'||n,'notice-event','member','EVENT_CANCELLED',1,
      '2027-02-02T00:00:00.000Z'::timestamptz,
      '2027-02-01T00:00:00.000Z'::timestamptz+n*interval '1 minute'
      FROM generate_series(1,120) AS n`);
    const firstResponse = await read('member', '?offset=0');
    assert.equal(firstResponse.status, 200);
    const first = await firstResponse.json() as { items: { id: string; actionable: boolean }[]; total: number; nextOffset: number | null; snapshot: string };
    assert.equal(first.total, 225);
    assert.deepEqual(first.items.slice(0, 2).map(item => item.id), ['unread-105', 'unread-104']);
    assert.equal(first.items.length, 100);
    assert.equal(first.nextOffset, 100);
    assert.equal(first.items[0]?.actionable, false);
    const secondResponse = await read('member', `?offset=100&snapshot=${first.snapshot}`);
    assert.equal(secondResponse.status, 200);
    const second = await secondResponse.json() as typeof first;
    assert.deepEqual(second.items.slice(0, 6).map(item => item.id),
      ['unread-5', 'unread-4', 'unread-3', 'unread-2', 'unread-1', 'read-120']);
    const thirdResponse = await read('member', `?offset=${second.nextOffset}&snapshot=${first.snapshot}`);
    assert.equal(thirdResponse.status, 200);
    const third = await thirdResponse.json() as typeof first;
    assert.equal(third.items.length, 25);
    assert.equal(third.nextOffset, null);
    assert.equal(new Set([...first.items, ...second.items, ...third.items].map(item => item.id)).size, 225);
    assert.equal((await read('other', '?offset=0')).status, 200);
    assert.equal((await (await read('other', '?offset=0')).json()).total, 0);
    assert.equal((await read('member', '?offset=100')).status, 400);
    await db.query("UPDATE notifications SET read_at=now() WHERE id='unread-105'");
    const stale = await read('member', `?offset=100&snapshot=${first.snapshot}`);
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).code, 'QUEUE_CHANGED');
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
