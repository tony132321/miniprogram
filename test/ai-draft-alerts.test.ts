import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';

test('AI draft cost and unresolved request alerts are operator-only and omit prompt content', async () => {
  const db = await createDatabase();
  const hash = 'a'.repeat(64);
  const insert = async (key: string, status: string, result: unknown, createdAt: string, costStatus?: string) => {
    await db.query(`INSERT INTO ai_draft_requests
      (actor_id,request_key,request_hash,status,budget_fen,known_cost_fen,cost_status,result,created_at)
      VALUES('host',$1,$2,$3,20,$4,$5,$6::jsonb,$7::timestamptz)`,
    [key, hash, status, result ? 7 : null, costStatus ?? null, result ? JSON.stringify(result) : null, createdAt]);
  };
  await insert('normal', 'COMPLETED', { aiStatus: 'GENERATED', fields: { title: 'private-title' } }, '2026-09-26T01:00:00Z', 'KNOWN');
  await insert('over-budget', 'COMPLETED', { fallbackReason: 'COST_BOUND_VIOLATION', fields: { title: 'private-title' } }, '2026-09-26T02:00:00Z', 'UNKNOWN');
  await insert('unknown', 'UNKNOWN', null, '2026-09-26T03:00:00Z');
  await insert('stale', 'STARTED', null, '2026-09-26T04:00:00Z');
  await insert('current', 'STARTED', null, new Date().toISOString());
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret', operationsUsers: ['ops'] });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/ops/ai-draft-alerts`;
  try {
    assert.equal((await fetch(url, { headers: { 'X-Dev-User': 'host' } })).status, 403);
    const response = await fetch(url, { headers: { 'X-Dev-User': 'ops' } });
    assert.equal(response.status, 200);
    const body = await response.json() as { items: Array<Record<string, unknown>>; total: number; nextOffset: number | null; snapshot: string };
    assert.equal(body.total, 3);
    assert.deepEqual(body.items.map(row => row.request_key).sort(), ['over-budget', 'stale', 'unknown']);
    assert.equal(body.nextOffset, null);
    assert.match(body.snapshot, /^[a-f0-9]{32}$/);
    assert.equal(body.items.find(row => row.request_key === 'over-budget')?.fallback_reason, 'COST_BOUND_VIOLATION');
    assert.doesNotMatch(JSON.stringify(body), /private-title|request_hash|"result"/);
    assert.equal((await fetch(url + '?offset=-1', { headers: { 'X-Dev-User': 'ops' } })).status, 400);
    assert.equal((await fetch(url + '?offset=1', { headers: { 'X-Dev-User': 'ops' } })).status, 400);
    assert.equal((await fetch(url + `?offset=1&snapshot=${body.snapshot}`,
      { headers: { 'X-Dev-User': 'ops' } })).status, 200);
    await insert('new-alert', 'UNKNOWN', null, '2026-09-26T05:00:00Z');
    const stale = await fetch(url + `?offset=1&snapshot=${body.snapshot}`, { headers: { 'X-Dev-User': 'ops' } });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json() as { code: string }).code, 'QUEUE_CHANGED');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});
