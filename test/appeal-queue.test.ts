import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';

test('operator appeal queue prioritizes unresolved cases and pages every case', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const read = (query: string) => fetch(`${base}/ops/appeals${query}`, { headers: { 'X-Dev-User': 'ops' } });
  try {
    await db.query(`INSERT INTO reports(id,reporter_id,kind,description)
      SELECT 'appeal-source-'||n,'p1','OTHER','用于申诉列表验证' FROM generate_series(1,226) AS n`);
    await db.query(`INSERT INTO appeals(id,report_id,appellant_id,description,status,created_at)
      SELECT 'open-appeal-'||n,'appeal-source-'||n,'p1','尚待复核','OPEN',
      '2027-01-01T00:00:00.000Z'::timestamptz+n*interval '1 minute'
      FROM generate_series(1,105) AS n`);
    await db.query(`INSERT INTO appeals(id,report_id,appellant_id,description,status,created_at)
      SELECT 'resolved-appeal-'||n,'appeal-source-'||(n+105),'p1','已复核','RESOLVED',
      '2027-02-01T00:00:00.000Z'::timestamptz+n*interval '1 minute'
      FROM generate_series(1,120) AS n`);
    const firstResponse = await read('?offset=0');
    assert.equal(firstResponse.status, 200);
    const first = await firstResponse.json() as { items: { id: string }[]; total: number; nextOffset: number | null; snapshot: string };
    assert.equal(first.total, 225);
    assert.equal(first.items.length, 100);
    assert.deepEqual(first.items.slice(0, 2).map(item => item.id), ['open-appeal-1', 'open-appeal-2']);
    const secondResponse = await read(`?offset=${first.nextOffset}&snapshot=${first.snapshot}`);
    assert.equal(secondResponse.status, 200);
    const second = await secondResponse.json() as typeof first;
    assert.deepEqual(second.items.slice(0, 6).map(item => item.id),
      ['open-appeal-101', 'open-appeal-102', 'open-appeal-103', 'open-appeal-104', 'open-appeal-105', 'resolved-appeal-120']);
    const thirdResponse = await read(`?offset=${second.nextOffset}&snapshot=${first.snapshot}`);
    assert.equal(thirdResponse.status, 200);
    const third = await thirdResponse.json() as typeof first;
    assert.equal(third.items.length, 25);
    assert.equal(third.nextOffset, null);
    assert.equal(new Set([...first.items, ...second.items, ...third.items].map(item => item.id)).size, 225);
    assert.equal((await read('?offset=100')).status, 400);
    await db.query("UPDATE appeals SET status='IN_REVIEW',updated_at=now() WHERE id='open-appeal-1'");
    const stale = await read(`?offset=100&snapshot=${first.snapshot}`);
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).code, 'QUEUE_CHANGED');
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
