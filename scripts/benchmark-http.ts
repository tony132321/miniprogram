import assert from 'node:assert/strict';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { createProductionDatabase } from '../src/db.ts';
import { loginWithWechat } from '../src/auth.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { reviewEvent } from '../src/event-review.ts';
import { createApp } from '../src/server.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const database = validatePostgresTestUrl(url);
const probe = new pg.Pool({ connectionString: url, max: 1 });
try { await assertEmptyPostgresTestDatabase(probe, database); }
finally { await probe.end(); }

const db = await createProductionDatabase(url);
let app: ReturnType<typeof createApp> | undefined;
try {
  const start = Date.now() + 7 * 24 * 60 * 60_000;
  const input = {
    title: '本机负载测试活动', type: 'badminton', startAt: new Date(start).toISOString(),
    endAt: new Date(start + 2 * 60 * 60_000).toISOString(), timeZone: 'Asia/Shanghai', city: '深圳',
    venueName: '公共羽毛球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
    maxParticipants: 6, registrationDeadline: new Date(start - 60 * 60_000).toISOString(),
    confirmationDeadline: new Date(start - 2 * 60 * 60_000).toISOString(), feeMode: 'FREE', feeCapFen: 0,
    cancellationRule: '开始前可退出', visibility: 'PUBLIC', approvalMode: 'MANUAL', hostParticipates: true
  };
  const identities = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    loginWithWechat(db, async () => ({ openid: `benchmark-user-${i}` }), `benchmark-code-${i}`)));
  const draft = await createDraft(db, identities[0]!.userId, input, 'benchmark-event');
  const published = await publishEvent(db, identities[0]!.userId, draft.id, draft.version, 'benchmark-publish');
  await reviewEvent(db, 'operator:benchmark', published.id, published.version,
    'APPROVED', '仅供本机性能测试', 'benchmark-review');
  app = createApp(db, { environment: 'test', devAuth: false, checkInSecret: 'benchmark-only-secret' });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const rate = 20;
  const seconds = 30;
  const samples: number[] = [];
  const failures: Array<{ index: number; status: number }> = [];
  const started = performance.now();
  await Promise.all(Array.from({ length: rate * seconds }, (_, index) => (async () => {
    const due = started + index * 1000 / rate;
    await new Promise(resolve => setTimeout(resolve, Math.max(0, due - performance.now())));
    const identity = identities[Math.floor(index / 10) % identities.length]!;
    const action = index % 10;
    const path = action === 0 ? '/events' : action <= 2 ? '/me/events' : `/events/${published.id}`;
    const method = action === 0 ? 'POST' : 'GET';
    const requestStarted = performance.now();
    try {
      const response = await fetch(base + path, {
        method,
        headers: { Authorization: `Bearer ${identity.token}`,
          ...(method === 'POST' ? { 'Idempotency-Key': `benchmark-draft-${index}`, 'Content-Type': 'application/json' } : {}) },
        ...(method === 'POST' ? { body: JSON.stringify({ title: `本机草稿 ${index}`, type: 'badminton' }) } : {})
      });
      await response.arrayBuffer();
      samples.push(performance.now() - requestStarted);
      if (response.status !== (method === 'POST' ? 201 : 200)) failures.push({ index, status: response.status });
    } catch { failures.push({ index, status: 0 }); }
  })()));
  assert.equal(samples.length, rate * seconds - failures.filter(item => item.status === 0).length);
  const elapsedSeconds = (performance.now() - started) / 1000;
  samples.sort((a, b) => a - b);
  const percentile = (fraction: number) => Math.round(samples[Math.ceil(samples.length * fraction) - 1] ?? 0);
  process.stdout.write(JSON.stringify({ database, rateTargetRps: rate, durationSeconds: seconds,
    requests: rate * seconds, achievedRps: Math.round(rate * seconds / elapsedSeconds * 10) / 10,
    httpFailures: failures.length, failureExamples: failures.slice(0, 5),
    p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99),
    mix: { eventReads: 0.7, myEventsReads: 0.2, draftWrites: 0.1 },
    localOnly: true }) + '\n');
  if (failures.length) process.exitCode = 1;
} finally {
  if (app) await new Promise<void>(resolve => app!.close(() => resolve()));
  await db.close();
}
