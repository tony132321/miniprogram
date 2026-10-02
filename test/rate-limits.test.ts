import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { consumeRateLimit, listRateLimitViolations, pruneRateLimits } from '../src/rate-limits.ts';
import { createApp } from '../src/server.ts';
import { createDraft } from '../src/events.ts';
import { publishApprovedInvite } from './helpers.ts';

test('database rate limit is atomic across concurrent callers and resets at the window boundary', async () => {
  const db = await createDatabase();
  try {
    const results = await Promise.allSettled(Array.from({ length: 25 }, () => consumeRateLimit(db, 'join:person', 20, 60_000)));
    const buckets = (await db.query<{ attempts: number; rejected_count: number }>(
      "SELECT attempts,rejected_count FROM rate_limit_buckets WHERE scope='join:person'")).rows;
    assert.equal(buckets.reduce((sum, bucket) => sum + bucket.attempts, 0), 25);
    assert.ok(buckets.every(bucket => bucket.rejected_count === Math.max(0, bucket.attempts - 20)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 25 - buckets.reduce((sum, bucket) => sum + bucket.rejected_count, 0));
    assert.equal(results.filter(result => result.status === 'rejected' && result.reason?.code === 'RATE_LIMITED').length,
      buckets.reduce((sum, bucket) => sum + bucket.rejected_count, 0));
    const violations = await listRateLimitViolations(db);
    assert.equal(violations.filter(item => item.scope === 'join:person').reduce((sum, item) => sum + item.rejectedCount, 0),
      buckets.reduce((sum, bucket) => sum + bucket.rejected_count, 0));
    await db.query("UPDATE rate_limit_buckets SET window_start=window_start-interval '2 minutes' WHERE scope='join:person'");
    await consumeRateLimit(db, 'join:person', 20, 60_000);
    const reset = await db.query<{ count: number }>("SELECT count(*)::int AS count FROM rate_limit_buckets WHERE scope='join:person' AND window_start>now()-interval '1 minute'");
    assert.equal(reset.rows[0]?.count, 1);
    await db.query("INSERT INTO rate_limit_buckets(scope,window_start,attempts,rejected_count) VALUES('join:old',now()-interval '8 days',1,0)");
    await pruneRateLimits(db);
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM rate_limit_buckets WHERE scope='join:old'")).rows[0]?.n, 0);
  } finally { await db.close(); }
});

test('application clock skew cannot split one host creation budget into separate buckets', async () => {
  const db = await createDatabase();
  let applicationTime = Date.now() - 2 * 60 * 60_000;
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'secret', clock: () => applicationTime });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const post = async (actor: string, index: number) => fetch(`http://127.0.0.1:${address.port}/events`, { method: 'POST',
    headers: { 'X-Dev-User': actor, 'Idempotency-Key': `clock-create-${index}`,
      'Content-Type': 'application/json' }, body: '{}' });
  const databaseHour = async () => (await db.query<{ hour: Date }>(
    "SELECT date_trunc('hour',clock_timestamp()) AS hour")).rows[0]!.hour.getTime();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const actor = `clock-skewed-host-${attempt}`;
      applicationTime = Date.now() - 2 * 60 * 60_000;
      const startedHour = await databaseHour();
      for (let index = 0; index < 10; index++) {
        if (index === 5) applicationTime = Date.now() + 2 * 60 * 60_000;
        assert.notEqual((await post(actor, index)).status, 429);
      }
      const blocked = await post(actor, 10);
      if (startedHour !== await databaseHour()) continue;
      assert.equal(blocked.status, 429);
      assert.equal((await blocked.json() as { code: string }).code, 'RATE_LIMITED');
      const { rows } = await db.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM rate_limit_buckets WHERE scope=$1', [`host-create:${actor}`]);
      assert.equal(rows[0]?.count, 1);
      return;
    }
    throw new Error('database hour changed during every clock-skew trial');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('join throttling returns 429 while member exit and safety reports stay available', async () => {
  const db = await createDatabase();
  const now = Date.now();
  const server = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret', clock: () => now });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  async function post(path: string, actor: string, body: Record<string, unknown>, key: string) {
    const response = await fetch(base + path, { method: 'POST', headers: { 'X-Dev-User': actor,
      'Idempotency-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, headers: response.headers, body: await response.json() as Record<string, any> };
  }
  const input = { title: '限流测试', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z',
    timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
    maxParticipants: 4, registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z',
    feeMode: 'FREE', feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };
  try {
    const draft = await createDraft(db, 'host', input, 'draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'publish');
    const first = await post(`/events/${event.id}/registrations`, 'member', { expectedVersion: event.version, inviteToken: event.inviteToken, acceptedRules: true }, 'join-0');
    assert.equal(first.status, 201);
    for (let i = 1; i < 20; i++) assert.equal((await post(`/events/${event.id}/registrations`, 'member', { expectedVersion: event.version, inviteToken: event.inviteToken, acceptedRules: true }, `join-${i}`)).status, 201);
    const blocked = await post(`/events/${event.id}/registrations`, 'member', { expectedVersion: event.version, inviteToken: event.inviteToken, acceptedRules: true }, 'join-20');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.code, 'RATE_LIMITED');
    assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
    assert.equal((await post(`/registrations/${first.body.id}/cancel`, 'member', { expectedVersion: event.version }, 'exit')).status, 200);
    assert.equal((await post('/reports', 'member', { kind: 'SAFETY', eventId: event.id, description: '活动情况需要运营立即核查' }, 'report')).status, 201);
    const response = await fetch(base + '/ops/rate-limits', { headers: { 'X-Dev-User': 'ops' } });
    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as { items: unknown[] }).items.length, 1);
    assert.equal((await fetch(base + '/ops/rate-limits', { headers: { 'X-Dev-User': 'member' } })).status, 403);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('untrusted forwarded headers cannot evade invite-token lookup throttling', async () => {
  const db = await createDatabase();
  const now = Date.now();
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'secret', clock: () => now });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    let blocked: Response | undefined;
    // A real database minute may roll over during the loop. Two full windows
    // still must not let rotating untrusted headers evade one peer's limit.
    for (let i = 0; i < 121; i++) {
      const response = await fetch(`${base}/i/guess-${i}`, { headers: { 'X-Forwarded-For': `198.51.100.${i % 250}` } });
      if (response.status === 429) { blocked = response; break; }
      assert.equal(response.status, 404);
    }
    assert.ok(blocked, 'rotating untrusted forwarded addresses must still hit the shared peer limit');
    assert.equal((await blocked.json() as { code: string }).code, 'RATE_LIMITED');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('a configured trusted proxy uses the nearest untrusted forwarded client', async () => {
  const db = await createDatabase();
  const now = Date.now();
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'secret', clock: () => now,
    trustedProxyIps: ['127.0.0.1'] });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (let i = 0; i < 60; i++) {
      const response = await fetch(`${base}/i/guess-${i}`, { headers: { 'X-Forwarded-For': '198.51.100.1, 127.0.0.1' } });
      assert.equal(response.status, 404);
    }
    assert.equal((await fetch(`${base}/i/guess-blocked`, { headers: { 'X-Forwarded-For': '198.51.100.1' } })).status, 429);
    assert.equal((await fetch(`${base}/i/other-client`, { headers: { 'X-Forwarded-For': '203.0.113.2' } })).status, 404);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('authenticated event detail reads are limited without blocking a member report', async () => {
  const db = await createDatabase();
  const now = Date.now();
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'secret', clock: () => now });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    let blocked = false;
    for (let i = 0; i < 241; i++) {
      const response = await fetch(`${base}/events/nonexistent-${i}`, { headers: { 'X-Dev-User': 'reader' } });
      if (response.status === 429) { blocked = true; break; }
      assert.equal(response.status, 404);
    }
    assert.equal(blocked, true, 'a bounded burst must exceed one database window budget');
    const reported = await fetch(`${base}/reports`, { method: 'POST', headers: { 'X-Dev-User': 'reader',
      'Idempotency-Key': 'report-after-reads', 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'SAFETY', description: '发现异常活动，请人工核查' }) });
    assert.equal(reported.status, 201);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('repeating a completed event consumes the host creation budget', async () => {
  const db = await createDatabase();
  const now = Date.now();
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'secret', clock: () => now });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const draft = await createDraft(db, 'host', { title: '再约限流', type: 'badminton', timeZone: 'Asia/Shanghai', city: '深圳',
      minParticipants: 4, maxParticipants: 6, cancellationRule: '提前退出', visibility: 'PUBLIC', approvalMode: 'AUTO',
      hostParticipates: true }, 'source');
    await db.query("UPDATE events SET status='COMPLETED' WHERE id=$1", [draft.id]);
    async function repeat(index: number) {
      const response = await fetch(`${base}/events/${draft.id}/repeat`, { method: 'POST', headers: { 'X-Dev-User': 'host',
        'Idempotency-Key': `repeat-${index}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: draft.version }) });
      return { status: response.status, body: await response.json() as { code?: string } };
    }
    for (let i = 0; i < 10; i++) assert.equal((await repeat(i)).status, 201);
    const blocked = await repeat(10);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.code, 'RATE_LIMITED');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});
