import assert from 'node:assert/strict';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { createProductionDatabase } from '../src/db.ts';
import { loginWithWechat } from '../src/auth.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { reviewEvent } from '../src/event-review.ts';
import { confirmPublicCoverage, createPublicCoverage, setPublicGate } from '../src/public-gate.ts';
import { createApp } from '../src/server.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const scriptStarted = performance.now();
const profile = process.env.IRL_BENCHMARK_PROFILE ?? 'sample';
if (profile !== 'sample' && profile !== 'pilot') throw new Error('IRL_BENCHMARK_PROFILE must be sample or pilot');
const registeredUserTarget = profile === 'pilot' ? 10_000 : 20;
const actorTarget = profile === 'pilot' ? 500 : 20;
const seedDraftTarget = profile === 'pilot' ? actorTarget : 0;
const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const database = validatePostgresTestUrl(url);
const probe = new pg.Pool({ connectionString: url, max: 1 });
try { await assertEmptyPostgresTestDatabase(probe, database); }
finally { await probe.end(); }

const db = await createProductionDatabase(url);
let app: ReturnType<typeof createApp> | undefined;
async function databaseCounts() {
  const { rows } = await db.query<{ registeredUsers: number; sessions: number; events: number;
    drafts: number; registrations: number }>(`SELECT
    (SELECT count(*)::int FROM users) AS "registeredUsers",
    (SELECT count(*)::int FROM sessions) AS sessions,
    (SELECT count(*)::int FROM events) AS events,
    (SELECT count(*)::int FROM events WHERE status='DRAFT') AS drafts,
    (SELECT count(*)::int FROM registrations) AS registrations`);
  return rows[0]!;
}
try {
  const now = Date.now();
  const start = now + 4 * 60 * 60_000;
  const input = {
    title: '本机负载测试活动', type: 'badminton', startAt: new Date(start).toISOString(),
    endAt: new Date(start + 2 * 60 * 60_000).toISOString(), timeZone: 'Asia/Shanghai', city: '深圳',
    venueName: '公共羽毛球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
    maxParticipants: 6, registrationDeadline: new Date(start - 60 * 60_000).toISOString(),
    confirmationDeadline: new Date(start - 2 * 60 * 60_000).toISOString(), feeMode: 'FREE', feeCapFen: 0,
    cancellationRule: '开始前可退出', visibility: 'PUBLIC', approvalMode: 'MANUAL', hostParticipates: true
  };
  if (profile === 'pilot') await db.query(`INSERT INTO users(id,wechat_openid)
    SELECT 'benchmark-user-id-' || n,'benchmark-user-' || n FROM generate_series(0,$1::int-1) AS n`,
  [registeredUserTarget]);
  const identities = await Promise.all(Array.from({ length: actorTarget }, (_, i) =>
    loginWithWechat(db, async () => ({ openid: `benchmark-user-${i}` }), `benchmark-code-${i}`)));
  const seedDrafts = new Map<string, string>();
  if (profile === 'pilot') for (const [index, identity] of identities.entries()) {
    const seeded = await createDraft(db, identity.userId,
      { title: `本机本人活动种子 ${index}`, type: 'badminton' }, `benchmark-seed-draft-${index}`);
    seedDrafts.set(identity.userId, seeded.id);
  }
  const duty = await createPublicCoverage(db, 'operator:benchmark-duty',
    new Date(now - 5 * 60_000).toISOString(), new Date(start + 3 * 60 * 60_000).toISOString(),
    'local-benchmark-emergency-drill', new Date(now - 60_000).toISOString(), 'benchmark-coverage');
  await confirmPublicCoverage(db, 'operator:benchmark-review', duty.id,
    '本机压测合成值守复核', 'benchmark-coverage-confirm');
  await setPublicGate(db, 'operator:benchmark-gate', 'OPEN', '仅本机隔离压测开放',
    'benchmark-open', duty.id);
  const draft = await createDraft(db, identities[0]!.userId, input, 'benchmark-event');
  const published = await publishEvent(db, identities[0]!.userId, draft.id, draft.version, 'benchmark-publish');
  await reviewEvent(db, 'operator:benchmark', published.id, published.version,
    'APPROVED', '仅供本机性能测试', 'benchmark-review');
  const seedCounts = await databaseCounts();
  app = createApp(db, { environment: 'test', devAuth: false, checkInSecret: 'benchmark-only-secret' });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const rate = 20;
  const seconds = 30;
  const requestTarget = rate * seconds;
  // Generator tolerance: dispatch no more than one request interval late.
  const scheduleToleranceMs = 1000 / rate;
  const p95LimitMs = 800;
  const requestTimeoutMs = 5000;
  const samples: number[] = [];
  const successfulActors = new Set<string>();
  const requestCounts = { eventReads: 0, myEventsReads: 0, draftWrites: 0 };
  const successfulRequestCounts = { eventReads: 0, myEventsReads: 0, draftWrites: 0 };
  type Operation = keyof typeof requestCounts;
  const endpointSamples: Record<Operation, number[]> = { eventReads: [], myEventsReads: [], draftWrites: [] };
  const failures: Array<{ index: number; operation: Operation; status: number;
    kind: 'HTTP' | 'NETWORK' | 'CONTENT'; message?: string }> = [];
  const dispatchLateness: number[] = [];
  let seededMyEventsReads = 0;
  const started = performance.now();
  await Promise.all(Array.from({ length: requestTarget }, (_, index) => (async () => {
    const due = started + index * 1000 / rate;
    await new Promise(resolve => setTimeout(resolve, Math.max(0, due - performance.now())));
    const identity = identities[(profile === 'pilot' ? index : Math.floor(index / 10)) % identities.length]!;
    const action = index % 10;
    const operation = action === 0 ? 'draftWrites' : action <= 2 ? 'myEventsReads' : 'eventReads';
    requestCounts[operation]++;
    const path = action === 0 ? '/events' : action <= 2 ? '/me/events' : `/events/${published.id}`;
    const method = action === 0 ? 'POST' : 'GET';
    const requestStarted = performance.now();
    dispatchLateness.push(Math.max(0, requestStarted - due));
    try {
      const response = await fetch(base + path, {
        method, signal: AbortSignal.timeout(requestTimeoutMs),
        headers: { Authorization: `Bearer ${identity.token}`,
          ...(method === 'POST' ? { 'Idempotency-Key': `benchmark-draft-${index}`, 'Content-Type': 'application/json' } : {}) },
        ...(method === 'POST' ? { body: JSON.stringify({ title: `本机草稿 ${index}`, type: 'badminton' }) } : {})
      });
      const body = await response.text();
      const latencyMs = performance.now() - requestStarted;
      samples.push(latencyMs);
      endpointSamples[operation].push(latencyMs);
      if (response.status !== (method === 'POST' ? 201 : 200)) {
        failures.push({ index, operation, status: response.status, kind: 'HTTP' });
        return;
      }
      if (profile === 'pilot' && operation === 'myEventsReads') {
        let payload: { items?: Array<{ id?: string }> };
        try { payload = JSON.parse(body); }
        catch {
          failures.push({ index, operation, status: response.status, kind: 'CONTENT', message: '本人活动列表不是 JSON' });
          return;
        }
        if (!Array.isArray(payload?.items) ||
          !payload.items.some(item => item?.id === seedDrafts.get(identity.userId))) {
          failures.push({ index, operation, status: response.status, kind: 'CONTENT', message: '本人活动列表未包含该身份的种子草稿' });
          return;
        }
        seededMyEventsReads++;
      }
      successfulActors.add(identity.userId);
      successfulRequestCounts[operation]++;
    } catch (error) {
      failures.push({ index, operation, status: 0, kind: 'NETWORK',
        message: error instanceof Error ? error.message : String(error) });
    }
  })()));
  // The final request starts at 29.95 s; retain the full 30 s measurement window.
  while (performance.now() < started + seconds * 1000) {
    await new Promise(resolve => setTimeout(resolve, Math.ceil(started + seconds * 1000 - performance.now())));
  }
  assert.equal(samples.length, requestTarget - failures.filter(item => item.kind === 'NETWORK').length);
  const elapsedSeconds = (performance.now() - started) / 1000;
  samples.sort((a, b) => a - b);
  dispatchLateness.sort((a, b) => a - b);
  const percentile = (values: number[], fraction: number) => values[Math.ceil(values.length * fraction) - 1] ?? 0;
  const p95Ms = percentile(samples, 0.95);
  const endpointSummary = (operation: Operation) => {
    const values = endpointSamples[operation].sort((a, b) => a - b);
    const p95 = percentile(values, 0.95);
    return { requests: requestCounts[operation], responses: values.length,
      successes: successfulRequestCounts[operation], errors: failures.filter(item => item.operation === operation).length,
      p95Ms: p95, p95WithinTarget: values.length > 0 && p95 <= p95LimitMs };
  };
  const endpoints = { eventReads: endpointSummary('eventReads'),
    myEventsReads: endpointSummary('myEventsReads'), draftWrites: endpointSummary('draftWrites') };
  const finalCounts = await databaseCounts();
  const httpFailures = failures.filter(item => item.kind !== 'CONTENT').length;
  const gates = {
    registeredUsers: seedCounts.registeredUsers === registeredUserTarget && finalCounts.registeredUsers === registeredUserTarget,
    sessions: seedCounts.sessions === actorTarget && finalCounts.sessions === actorTarget,
    seedData: seedDrafts.size === seedDraftTarget && seedCounts.events === seedDraftTarget + 1 &&
      seedCounts.drafts === seedDraftTarget && seedCounts.registrations === 1,
    requestMix: requestCounts.eventReads === 420 && requestCounts.myEventsReads === 120 && requestCounts.draftWrites === 60,
    completeResponses: samples.length === requestTarget,
    successfulActors: successfulActors.size === actorTarget,
    seededMyEventsReads: profile !== 'pilot' || seededMyEventsReads === 120,
    noUnexpectedFailures: failures.length === 0,
    persistedWrites: finalCounts.events === seedCounts.events + 60 && finalCounts.drafts === seedCounts.drafts + 60 &&
      finalCounts.registrations === seedCounts.registrations,
    measurementWindow: elapsedSeconds >= seconds,
    offeredLoad: (dispatchLateness.at(-1) ?? Number.POSITIVE_INFINITY) <= scheduleToleranceMs,
    p95: p95Ms <= p95LimitMs && Object.values(endpoints).every(item => item.p95WithinTarget)
  };
  const localGatePassed = Object.values(gates).every(Boolean);
  process.stdout.write(JSON.stringify({ database, profile, registeredUsers: finalCounts.registeredUsers,
    sessions: finalCounts.sessions, activeIdentities: identities.length, uniqueActors: successfulActors.size,
    seedDrafts: seedDrafts.size, seedCounts, finalCounts,
    rateTargetRps: rate, durationSeconds: seconds, elapsedSeconds, preparationSeconds: (started - scriptStarted) / 1000,
    requests: requestTarget, responses: samples.length, achievedRps: requestTarget / elapsedSeconds,
    requestCounts, successfulRequestCounts, endpoints, seededMyEventsReads,
    dispatchLatenessMs: { max: dispatchLateness.at(-1) ?? 0, p95: percentile(dispatchLateness, 0.95) },
    errors: failures.length, httpFailures, contentFailures: failures.length - httpFailures,
    failureExamples: failures.slice(0, 5),
    p50Ms: percentile(samples, 0.5), p95Ms, p99Ms: percentile(samples, 0.99),
    mix: { eventReads: 0.7, myEventsReads: 0.2, draftWrites: 0.1 },
    p95LimitMs, requestTimeoutMs, scheduleToleranceMs, gates, localGatePassed, localOnly: true }) + '\n');
  if (!localGatePassed) process.exitCode = 1;
} finally {
  if (app) await new Promise<void>(resolve => app!.close(() => resolve()));
  await db.close();
}
