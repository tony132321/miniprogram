import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';

test('operator report queue prioritizes unresolved safety cases and pages beyond 100 records', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  try {
    await db.query(`INSERT INTO reports(id,reporter_id,kind,description,status,created_at)
      SELECT 'resolved-'||n,'p1','OTHER','已结案','RESOLVED','2027-02-01T00:00:00.000Z'::timestamptz+n*interval '1 minute'
      FROM generate_series(1,120) AS n`);
    await db.query(`INSERT INTO reports(id,reporter_id,kind,description,status,created_at)
      SELECT 'safety-'||n,'p1','SAFETY','安全待核查','OPEN','2027-01-01T00:00:00.000Z'::timestamptz+n*interval '1 minute'
      FROM generate_series(1,105) AS n`);
    await db.query(`INSERT INTO reports(id,reporter_id,kind,description,status,created_at)
      VALUES('ordinary','p1','OTHER','普通待核查','OPEN','2027-01-01T00:00:00.000Z')`);
    const read = async (offset: number, snapshot?: string) => {
      const response = await fetch(`${base}/ops/reports?offset=${offset}${snapshot ? `&snapshot=${snapshot}` : ''}`,
        { headers: { 'X-Dev-User': 'ops' } });
      assert.equal(response.status, 200);
      return response.json() as Promise<{ items: { id: string }[]; total: number; nextOffset: number | null; snapshot: string }>;
    };
    const first = await read(0);
    assert.equal(first.total, 226);
    assert.equal(first.items.length, 100);
    assert.deepEqual(first.items.slice(0, 2).map(item => item.id), ['safety-1', 'safety-2']);
    assert.equal(first.nextOffset, 100);
    assert.match(first.snapshot, /^[a-f0-9]{32}$/);
    const second = await read(first.nextOffset!, first.snapshot);
    assert.deepEqual(second.items.slice(0, 7).map(item => item.id),
      ['safety-101', 'safety-102', 'safety-103', 'safety-104', 'safety-105', 'ordinary', 'resolved-120']);
    assert.equal(second.nextOffset, 200);
    const third = await read(second.nextOffset!, first.snapshot);
    assert.equal(third.items.length, 26);
    assert.equal(third.nextOffset, null);
    assert.equal(new Set([...first.items, ...second.items, ...third.items].map(item => item.id)).size, 226);
    const invalid = await fetch(`${base}/ops/reports?offset=-1`, { headers: { 'X-Dev-User': 'ops' } });
    assert.equal(invalid.status, 400);
    const missingSnapshot = await fetch(`${base}/ops/reports?offset=100`, { headers: { 'X-Dev-User': 'ops' } });
    assert.equal(missingSnapshot.status, 400);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('report pages reject a stale snapshot when safety work arrives or another operator changes a case', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const get = async (query: string) => fetch(`${base}/ops/reports${query}`, { headers: { 'X-Dev-User': 'ops' } });
  try {
    await db.query(`INSERT INTO reports(id,reporter_id,kind,description,status,created_at)
      SELECT 'ordinary-'||n,'p1','OTHER','普通待核查','OPEN','2027-01-01T00:00:00.000Z'::timestamptz+n*interval '1 minute'
      FROM generate_series(1,101) AS n`);
    const first = await (await get('?offset=0')).json() as { snapshot: string; nextOffset: number };
    await db.query("INSERT INTO reports(id,reporter_id,kind,description) VALUES('new-safety','p1','SAFETY','新安全举报')");
    assert.equal((await get(`?offset=${first.nextOffset}&snapshot=${first.snapshot}`)).status, 409);
    const refreshed = await (await get('?offset=0')).json() as { items: { id: string }[]; snapshot: string; nextOffset: number };
    assert.equal(refreshed.items[0]?.id, 'new-safety');
    await db.query("UPDATE reports SET status='RESOLVED' WHERE id='new-safety'");
    assert.equal((await get(`?offset=${refreshed.nextOffset}&snapshot=${refreshed.snapshot}`)).status, 409);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
