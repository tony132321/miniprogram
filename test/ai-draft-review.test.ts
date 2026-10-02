import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';

test('AI draft alert review is named, durable, single-writer and leaves uncertain cost reserved', async () => {
  const db = await createDatabase();
  await db.query(`INSERT INTO ai_draft_requests
    (actor_id,request_key,request_hash,status,budget_fen,reserved_fen)
    VALUES('host','uncertain',$1,'UNKNOWN',20,20)`, ['a'.repeat(64)]);
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret', operationsUsers: ['ops', 'ops2'] });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const review = (actor: string, key: string, note = '已核查内部异常记录，仍待供应商账单') => fetch(base + '/ops/ai-draft-alerts/review', {
    method: 'POST', headers: { 'X-Dev-User': actor, 'Idempotency-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'host', requestKey: 'uncertain', note })
  });
  try {
    assert.equal((await review('host', 'member-key')).status, 403);
    assert.equal((await review('ops', 'invalid-note', '短')).status, 400);
    const [left, right] = await Promise.all([review('ops', 'first'), review('ops2', 'second')]);
    assert.deepEqual([left.status, right.status].sort(), [200, 409]);
    const winner = left.status === 200 ? 'ops' : 'ops2';
    const winnerKey = left.status === 200 ? 'first' : 'second';
    const first = await (left.status === 200 ? left : right).json() as { reviewedBy: string; reviewState: string };
    assert.equal(first.reviewedBy, winner);
    assert.equal(first.reviewState, 'REVIEW_RECORDED');
    const replay = await review(winner, winnerKey);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json() as { reviewedBy: string }).reviewedBy, winner);
    assert.equal((await review(winner, 'third')).status, 409);
    const pending = await fetch(base + '/ops/ai-draft-alerts', { headers: { 'X-Dev-User': 'ops' } });
    assert.equal((await pending.json() as { total: number }).total, 0);
    const history = await fetch(base + '/ops/ai-draft-alerts/reviews', { headers: { 'X-Dev-User': 'ops' } });
    const historyBody = await history.json() as { items: Array<Record<string, unknown>> };
    assert.equal(historyBody.items.length, 1);
    assert.equal(historyBody.items[0]?.reviewed_by, winner);
    assert.doesNotMatch(JSON.stringify(historyBody), /request_hash|"result"/);
    const original = (await db.query<{ status: string; reserved_fen: number; cost_status: string | null }>(
      "SELECT status,reserved_fen,cost_status FROM ai_draft_requests WHERE actor_id='host' AND request_key='uncertain'"
    )).rows[0];
    assert.deepEqual(original, { status: 'UNKNOWN', reserved_fen: 20, cost_status: null });
    assert.equal((await db.query<{ count: number }>("SELECT count(*)::int AS count FROM audit WHERE action='AI_DRAFT_ALERT_REVIEW'"))
      .rows[0]?.count, 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('reviewing a stalled STARTED request does not hide later UNKNOWN and COMPLETED alerts', async () => {
  const db = await createDatabase();
  await db.query(`INSERT INTO ai_draft_requests
    (actor_id,request_key,request_hash,status,budget_fen,reserved_fen,created_at)
    VALUES('host','changing',$1,'STARTED',20,20,clock_timestamp()-interval '2 minutes')`, ['b'.repeat(64)]);
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret', operationsUsers: ['ops'] });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const pending = async () => (await (await fetch(base + '/ops/ai-draft-alerts',
    { headers: { 'X-Dev-User': 'ops' } })).json() as { items: Array<{ status: string }> }).items.map(item => item.status);
  const review = (key: string) => fetch(base + '/ops/ai-draft-alerts/review', { method: 'POST',
    headers: { 'X-Dev-User': 'ops', 'Idempotency-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'host', requestKey: 'changing', note: '已复核本次状态，后续仍需跟进' }) });
  try {
    assert.deepEqual(await pending(), ['STARTED']);
    assert.equal((await review('review-started')).status, 200);
    assert.deepEqual(await pending(), []);
    await db.query(`UPDATE ai_draft_requests SET status='UNKNOWN',finished_at=clock_timestamp()
      WHERE actor_id='host' AND request_key='changing'`);
    assert.deepEqual(await pending(), ['UNKNOWN']);
    assert.equal((await review('review-unknown')).status, 200);
    assert.deepEqual(await pending(), []);
    await db.query(`UPDATE ai_draft_requests SET status='COMPLETED',cost_status='UNKNOWN',known_cost_fen=0,
      result='{"fallbackReason":"COST_BOUND_VIOLATION"}'::jsonb WHERE actor_id='host' AND request_key='changing'`);
    assert.deepEqual(await pending(), ['COMPLETED']);
    assert.equal((await review('review-completed')).status, 200);
    assert.deepEqual(await pending(), []);
    const history = await (await fetch(base + '/ops/ai-draft-alerts/reviews',
      { headers: { 'X-Dev-User': 'ops' } })).json() as { items: Array<{ status: string }> };
    assert.deepEqual(history.items.map(item => item.status).sort(), ['COMPLETED', 'STARTED', 'UNKNOWN']);
    const original = (await db.query<{ reserved_fen: number; cost_status: string }>(
      "SELECT reserved_fen,cost_status FROM ai_draft_requests WHERE actor_id='host' AND request_key='changing'"
    )).rows[0];
    assert.deepEqual(original, { reserved_fen: 20, cost_status: 'UNKNOWN' });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('AI draft review history reads every page and rejects a changed snapshot', async () => {
  const db = await createDatabase();
  await db.query(`INSERT INTO ai_draft_requests(actor_id,request_key,request_hash,status,budget_fen,reserved_fen)
    SELECT 'host','request-' || lpad(n::text,3,'0'),$1,'UNKNOWN',20,20 FROM generate_series(1,105) n`,
  ['c'.repeat(64)]);
  await db.query(`INSERT INTO ai_draft_alert_reviews(actor_id,request_key,alert_state,status_at_review,
      reserved_fen_at_review,reviewed_by,note)
    SELECT actor_id,request_key,md5(jsonb_build_array(status,cost_status,result->>'fallbackReason')::text),
      status,reserved_fen,'operator:ops','本机内部复核，外部账单待查'
      FROM ai_draft_requests`);
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret', operationsUsers: ['ops'] });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/ops/ai-draft-alerts/reviews`;
  const headers = { 'X-Dev-User': 'ops' };
  try {
    assert.equal((await fetch(base, { headers: { 'X-Dev-User': 'host' } })).status, 403);
    const firstResponse = await fetch(base + '?offset=0', { headers });
    assert.equal(firstResponse.status, 200);
    const first = await firstResponse.json() as { items: Array<{ request_key: string }>; total: number;
      nextOffset: number | null; snapshot: string };
    assert.equal(first.total, 105);
    assert.equal(first.items.length, 100);
    assert.equal(first.nextOffset, 100);
    assert.match(first.snapshot, /^[a-f0-9]{32}$/);
    assert.doesNotMatch(JSON.stringify(first), /request_hash|"result"/);
    assert.equal((await fetch(base + '?offset=100', { headers })).status, 400);
    const secondResponse = await fetch(base + `?offset=100&snapshot=${first.snapshot}`, { headers });
    assert.equal(secondResponse.status, 200);
    const second = await secondResponse.json() as typeof first;
    assert.equal(second.items.length, 5);
    assert.equal(second.nextOffset, null);
    assert.equal(new Set([...first.items, ...second.items].map(item => item.request_key)).size, 105);
    await db.query(`INSERT INTO ai_draft_requests(actor_id,request_key,request_hash,status,budget_fen,reserved_fen)
      VALUES('host','new-request',$1,'UNKNOWN',20,20)`, ['d'.repeat(64)]);
    await db.query(`INSERT INTO ai_draft_alert_reviews(actor_id,request_key,alert_state,status_at_review,
      reserved_fen_at_review,reviewed_by,note)
      SELECT actor_id,request_key,md5(jsonb_build_array(status,cost_status,result->>'fallbackReason')::text),
        status,reserved_fen,'operator:ops','本机内部复核，外部账单待查'
        FROM ai_draft_requests WHERE request_key='new-request'`);
    const changed = await fetch(base + `?offset=100&snapshot=${first.snapshot}`, { headers });
    assert.equal(changed.status, 409);
    assert.equal((await changed.json() as { code: string }).code, 'QUEUE_CHANGED');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});
