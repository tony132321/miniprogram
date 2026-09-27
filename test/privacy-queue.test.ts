import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';

test('privacy queue pages beyond 100 requests without losing older requests', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const read = (query: string) => fetch(`${base}/ops/privacy${query}`, { headers: { 'X-Dev-User': 'ops' } });
  try {
    await db.query(`INSERT INTO privacy_requests(id,user_id,kind,created_at)
      SELECT 'privacy-'||n,'p1','DELETE','2027-01-01T00:00:00.000Z'::timestamptz+n*interval '1 minute'
      FROM generate_series(1,105) AS n`);
    const firstResponse = await read('?offset=0');
    assert.equal(firstResponse.status, 200);
    const first = await firstResponse.json() as { items: { id: string }[]; total: number; nextOffset: number | null; snapshot: string };
    assert.equal(first.total, 105);
    assert.equal(first.items.length, 100);
    assert.equal(first.items[0]?.id, 'privacy-1');
    assert.equal(first.nextOffset, 100);
    const secondResponse = await read(`?offset=100&snapshot=${first.snapshot}`);
    assert.equal(secondResponse.status, 200);
    const second = await secondResponse.json() as typeof first;
    assert.deepEqual(second.items.map(item => item.id), ['privacy-101', 'privacy-102', 'privacy-103', 'privacy-104', 'privacy-105']);
    assert.equal(second.nextOffset, null);
    assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 105);
    assert.equal((await read('?offset=100')).status, 400);
    await db.query("INSERT INTO privacy_requests(id,user_id,kind) VALUES('privacy-new','p2','EXPORT')");
    const stale = await read(`?offset=100&snapshot=${first.snapshot}`);
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).code, 'QUEUE_CHANGED');
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
