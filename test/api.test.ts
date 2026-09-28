import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createDatabase } from '../src/db.ts';
import type { Database } from '../src/db.ts';
import { createApp } from '../src/server.ts';
import { createDraft } from '../src/events.ts';
import { approveInviteById, publishApprovedInvite } from './helpers.ts';
import { confirmEvent, createCheckInToken } from '../src/lifecycle.ts';
import { cancelRegistration } from '../src/registrations.ts';
import { register } from './helpers.ts';
import { runDueJobs } from '../src/jobs.ts';

const input = {
  title: '周六羽毛球', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共羽毛球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'AA', feeCapFen: 5000,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
};

async function fixture(adaptDb?: (db: Database) => Database) {
  const db = await createDatabase();
  const server = createApp(adaptDb?.(db) ?? db, { environment: 'development', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'test-secret' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  async function request(path: string, actor: string, method = 'GET', body?: unknown, key?: string) {
    const response = await fetch(base + path, { method, headers: {
      'X-Dev-User': actor, ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {})
    }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() as Record<string, any> };
  }
  return { db, server, request, close: async () => { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); } };
}

function databaseWithRealClock(db: Database, actualNow: () => number): Database {
  const queryWithRealClock = async <T extends Record<string, unknown> = Record<string, unknown>>(
    query: Database['query'], sql: string, params: unknown[] = []): Promise<{ rows: T[] }> => {
    const previousNow = Date.now;
    Date.now = actualNow;
    try { return await query<T>(sql, params); }
    finally { Date.now = previousNow; }
  };
  return {
    ...db,
    query: (sql, params = []) => queryWithRealClock(db.query, sql, params),
    transaction: fn => db.transaction(tx => fn({ query: (sql, params = []) => queryWithRealClock(tx.query, sql, params) }))
  };
}

test('development identity cannot be enabled in production', async () => {
  const db = await createDatabase();
  try { assert.throws(() => createApp(db, { environment: 'production', devAuth: true, checkInSecret: 'secret' }), /development identity/i); }
  finally { await db.close(); }
});

test('HTTP cancellation uses database time when the application clock is fast', async () => {
  const actualNow = Date.now;
  const f = await fixture(db => databaseWithRealClock(db, actualNow));
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'fast-http-cancel-draft');
    const event = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST',
      { expectedVersion: draft.body.version }, 'fast-http-cancel-publish');
    await approveInviteById(f.db, 'host', event.body.id);
    Date.now = () => actualNow() + 2 * 365 * 24 * 60 * 60_000;
    try {
      const result = await f.request(`/events/${event.body.id}/cancel`, 'host', 'POST',
        { expectedVersion: event.body.version }, 'fast-http-cancel');
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.status, 'CANCELLED');
    } finally { Date.now = actualNow; }
  } finally { await f.close(); }
});

test('HTTP reconfirmation uses database time when the application clock is fast', async () => {
  const actualNow = Date.now;
  const f = await fixture(db => databaseWithRealClock(db, actualNow));
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'fast-http-reconfirm-draft');
    const event = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST',
      { expectedVersion: draft.body.version }, 'fast-http-reconfirm-publish');
    await approveInviteById(f.db, 'host', event.body.id);
    const joined = await f.request(`/events/${event.body.id}/registrations`, 'p1', 'POST',
      { expectedVersion: event.body.version, inviteToken: event.body.inviteToken, acceptedRules: true }, 'fast-http-reconfirm-seat');
    assert.equal(joined.status, 201);
    const changed = await f.request(`/events/${event.body.id}/changes`, 'host', 'POST',
      { expectedVersion: event.body.version, patch: { venueName: '新的公共球馆', venueStatus: 'HOST_CONFIRMED' } }, 'fast-http-reconfirm-change');
    assert.equal(changed.status, 200);
    await approveInviteById(f.db, 'host', event.body.id);
    Date.now = () => actualNow() + 2 * 365 * 24 * 60 * 60_000;
    try {
      const accepted = await f.request(`/registrations/${joined.body.id}/reconfirm`, 'p1', 'POST',
        { expectedVersion: changed.body.version }, 'fast-http-reconfirm');
      assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
      assert.equal(accepted.body.status, 'CONFIRMED');
    } finally { Date.now = actualNow; }
  } finally { await f.close(); }
});

test('HTTP manual check-in uses database windows for request and response', async () => {
  const actualNow = Date.now;
  const f = await fixture(db => databaseWithRealClock(db, actualNow));
  try {
    const now = actualNow();
    const draft = await f.request('/events', 'host', 'POST', { ...input,
      startAt: new Date(now + 20 * 60_000).toISOString(), endAt: new Date(now + 80 * 60_000).toISOString(),
      registrationDeadline: new Date(now + 10 * 60_000).toISOString(),
      confirmationDeadline: new Date(now + 5 * 60_000).toISOString() }, 'http-manual-clock-draft');
    const event = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST',
      { expectedVersion: draft.body.version }, 'http-manual-clock-publish');
    await approveInviteById(f.db, 'host', event.body.id);
    for (const actor of ['p1', 'p2', 'p3']) {
      const joined = await f.request(`/events/${event.body.id}/registrations`, actor, 'POST',
        { expectedVersion: event.body.version, inviteToken: event.body.inviteToken, acceptedRules: true }, `http-manual-clock-${actor}`);
      assert.equal(joined.status, 201);
    }
    const formed = await f.request(`/events/${event.body.id}/confirm`, 'host', 'POST',
      { expectedVersion: event.body.version }, 'http-manual-clock-confirm');
    assert.equal(formed.status, 200);
    Date.now = () => actualNow() + 2 * 365 * 24 * 60 * 60_000;
    let requested;
    try {
      requested = await f.request(`/events/${event.body.id}/manual-checkins`, 'host', 'POST',
        { expectedVersion: event.body.version, userId: 'p1' }, 'http-manual-clock-request');
      assert.equal(requested.status, 201, JSON.stringify(requested.body));
    } finally { Date.now = actualNow; }
    await f.db.query("UPDATE events SET status='COMPLETED',payload=payload || $2::jsonb WHERE id=$1", [event.body.id,
      JSON.stringify({ startAt: new Date(now - 10 * 24 * 60 * 60_000).toISOString(),
        endAt: new Date(now - 9 * 24 * 60 * 60_000).toISOString() })]);
    Date.now = () => actualNow() - 2 * 365 * 24 * 60 * 60_000;
    try {
      const rejected = await f.request(`/manual-checkins/${requested.body.id}/respond`, 'p1', 'POST',
        { expectedVersion: event.body.version, accepted: true }, 'http-manual-clock-response');
      assert.equal(rejected.status, 400);
      assert.equal(rejected.body.code, 'INVALID_STATE');
    } finally { Date.now = actualNow; }
    const { rows } = await f.db.query<{ status: string }>('SELECT status FROM manual_checkins WHERE id=$1', [requested.body.id]);
    assert.equal(rows[0]?.status, 'PENDING');
  } finally { Date.now = actualNow; await f.close(); }
});

test('JSON request size limit counts UTF-8 bytes', async () => {
  const f = await fixture();
  try {
    const result = await f.request('/events/drafts:suggest-local', 'host', 'POST', { text: '中'.repeat(22_000) }, 'oversized-utf8');
    assert.equal(result.status, 413);
    assert.equal(result.body.code, 'BODY_TOO_LARGE');
  } finally { await f.close(); }
});

test('JSON request preserves a Chinese character split across HTTP chunks', async () => {
  const f = await fixture();
  try {
    const port = (f.server.address() as { port: number }).port;
    const body = Buffer.from(JSON.stringify(input));
    const split = body.indexOf(Buffer.from('周')) + 1;
    assert.ok(split > 1);
    const response = await new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
      const req = httpRequest({ hostname: '127.0.0.1', port, path: '/events', method: 'POST',
        headers: { 'X-Dev-User': 'host', 'Idempotency-Key': 'split-utf8', 'Content-Type': 'application/json' } }, res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
      });
      req.on('error', reject);
      req.write(body.subarray(0, split));
      setImmediate(() => req.end(body.subarray(split)));
    });
    assert.equal(response.status, 201);
    assert.equal((response.body.payload as { title: string }).title, input.title);
  } finally { await f.close(); }
});

test('publishing a wrongly typed draft returns a machine-readable client error', async () => {
  const f = await fixture();
  try {
    const rejected = await f.request('/events', 'host', 'POST', { ...input, title: 123 }, 'typed-draft-invalid');
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.code, 'INVALID_EVENT');
    const draft = await f.request('/events', 'host', 'POST', input, 'typed-draft');
    assert.equal(draft.status, 201);
    await f.db.query('UPDATE events SET payload=payload || $2::jsonb WHERE id=$1', [draft.body.id, JSON.stringify({ title: 123 })]);
    const published = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST',
      { expectedVersion: draft.body.version }, 'typed-publish');
    assert.equal(published.status, 400);
    assert.equal(published.body.code, 'INVALID_EVENT');
  } finally { await f.close(); }
});

test('a late shortfall job leaves the started activity visible with a formation risk', async () => {
  const f = await fixture();
  try {
    const draft = await createDraft(f.db, 'host', input, 'late-risk-draft');
    const event = await publishApprovedInvite(f.db, 'host', draft.id, draft.version, 'late-risk-publish');
    const p1 = await register(f.db, 'p1', event.id, event.version, 'late-risk-p1');
    await register(f.db, 'p2', event.id, event.version, 'late-risk-p2');
    await register(f.db, 'p3', event.id, event.version, 'late-risk-p3');
    await confirmEvent(f.db, 'host', event.id, event.version, 'late-risk-confirm');
    await cancelRegistration(f.db, 'p1', p1.id, event.version, 'late-risk-leave');
    await runDueJobs(f.db, Date.parse(event.payload.startAt!) + 60_000);
    const detail = await f.request(`/events/${event.id}`, 'host');
    assert.equal(detail.status, 200);
    assert.equal(detail.body.status, 'CONFIRMED');
    assert.equal(detail.body.formationRisk, true);
    assert.equal(detail.body.stats.confirmed, 3);
  } finally { await f.close(); }
});

test('operations page is served while its data remains role protected', async () => {
  const f = await fixture();
  try {
    const page = await fetch(`http://127.0.0.1:${(f.server.address() as { port: number }).port}/ops`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /运营工作台/);
    assert.equal((await f.request('/ops/reports', 'visitor')).status, 403);
  } finally { await f.close(); }
});

test('current-fact API gives a versioned answer and creates a host-only todo for unknown facts', async () => {
  const f = await fixture();
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'fact-draft');
    const event = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST', { expectedVersion: draft.body.version }, 'fact-publish');
    await approveInviteById(f.db, 'host', event.body.id);
    await f.request(`/events/${event.body.id}/registrations`, 'p1', 'POST', { expectedVersion: event.body.version, inviteToken: event.body.inviteToken, acceptedRules: true }, 'fact-join');
    const known = await f.request(`/events/${event.body.id}/facts:ask`, 'p1', 'POST', { question: '活动几点开始？' }, 'fact-known');
    assert.equal(known.status, 200);
    assert.equal(known.body.source, 'CURRENT_EVENT');
    const unknown = await f.request(`/events/${event.body.id}/facts:ask`, 'p1', 'POST', { question: '要自带球拍吗？' }, 'fact-unknown');
    assert.equal(unknown.body.source, 'UNKNOWN');
    assert.equal((await f.request(`/events/${event.body.id}/fact-todos`, 'p1')).status, 403);
    assert.equal((await f.request(`/events/${event.body.id}/fact-todos`, 'host')).body.items.length, 0);
    const pending = await f.request('/ops/content', 'ops');
    assert.equal((await f.request(`/ops/content/${pending.body.items[0].id}/moderate`, 'ops', 'POST', { status: 'APPROVED' }, 'fact-approve')).status, 200);
    assert.equal((await f.request(`/events/${event.body.id}/fact-todos`, 'host')).body.items.length, 1);
  } finally { await f.close(); }
});

test('host QR token reports its actual remaining lifetime and is restricted to the check-in window', async () => {
  const db = await createDatabase();
  const draft = await createDraft(db, 'host', input, 'qr-draft');
  const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'qr-publish');
  await register(db, 'p1', event.id, event.version, 'qr-p1');
  await register(db, 'p2', event.id, event.version, 'qr-p2');
  await register(db, 'p3', event.id, event.version, 'qr-p3');
  await confirmEvent(db, 'host', event.id, event.version, 'qr-confirm');
  await db.query("UPDATE events SET payload=jsonb_set(jsonb_set(payload,'{startAt}',to_jsonb($2::text),true),'{endAt}',to_jsonb($3::text),true) WHERE id=$1",
    [event.id, new Date(Date.now() - 5 * 60_000).toISOString(), new Date(Date.now() + 60 * 60_000).toISOString()]);
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const requestQr = async (actor: string) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/events/${event.id}/checkin-token`, {
      method: 'POST', headers: { 'X-Dev-User': actor, 'Idempotency-Key': 'qr', 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: event.version }) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  const post = async (actor: string, path: string, body: Record<string, unknown>, key: string) => {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: 'POST',
      headers: { 'X-Dev-User': actor, 'Idempotency-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    assert.equal((await requestQr('p1')).status, 403);
    const token = await requestQr('host');
    assert.equal(token.status, 200);
    assert.match(token.body.token, /^\d+\.[A-Za-z0-9_-]{43}$/);
    assert.ok(token.body.expiresInSeconds >= 1 && token.body.expiresInSeconds <= 60);
    assert.equal((await post('p2', `/events/${event.id}/checkins`, { expectedVersion: event.version, token: token.body.token }, 'scan')).body.evidence, 'SCAN');
    const manual = await post('host', `/events/${event.id}/manual-checkins`, { expectedVersion: event.version, userId: 'p1' }, 'manual');
    assert.equal(manual.status, 201);
    const p1List = await fetch(`http://127.0.0.1:${address.port}/events/${event.id}/manual-checkins`, { headers: { 'X-Dev-User': 'p1' } });
    assert.equal(((await p1List.json()) as { items: unknown[] }).items.length, 1);
    assert.equal((await post('p2', `/manual-checkins/${manual.body.id}/respond`, { expectedVersion: event.version, accepted: true }, 'forged')).status, 403);
    assert.equal((await post('p1', `/manual-checkins/${manual.body.id}/respond`, { expectedVersion: event.version, accepted: true }, 'accepted')).body.status, 'CONFIRMED');
    const evidence = await db.query<{ evidence: string }>('SELECT evidence FROM checkins WHERE event_id=$1 AND user_id=$2', [event.id, 'p1']);
    assert.equal(evidence.rows[0]?.evidence, 'MANUAL_CONFIRMED');
    const hostCheckIns = await fetch(`http://127.0.0.1:${address.port}/events/${event.id}/checkins`, { headers: { 'X-Dev-User': 'host' } });
    const hostItems = ((await hostCheckIns.json()) as { items: Array<{ evidence: string }> }).items;
    assert.deepEqual(hostItems.map(item => item.evidence).sort(), ['MANUAL_CONFIRMED', 'SCAN']);
    const p1CheckIns = await fetch(`http://127.0.0.1:${address.port}/events/${event.id}/checkins`, { headers: { 'X-Dev-User': 'p1' } });
    assert.equal(((await p1CheckIns.json()) as { items: unknown[] }).items.length, 1);
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{endAt}',to_jsonb($2::text),true) WHERE id=$1",
      [event.id, new Date(Date.now() - 31 * 60_000).toISOString()]);
    assert.equal((await requestQr('host')).body.code, 'CHECKIN_CLOSED');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('a fast application clock cannot complete an activity before the database end time', async () => {
  const db = await createDatabase();
  const start = Date.now() + 2 * 60 * 60_000;
  const data = { ...input, startAt: new Date(start).toISOString(), endAt: new Date(start + 60 * 60_000).toISOString(),
    registrationDeadline: new Date(start - 30 * 60_000).toISOString(),
    confirmationDeadline: new Date(start - 60 * 60_000).toISOString() };
  const draft = await createDraft(db, 'host', data, 'fast-completion-draft');
  const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'fast-completion-publish');
  for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, event.id, event.version, `fast-completion-${actor}`);
  await confirmEvent(db, 'host', event.id, event.version, 'fast-completion-confirm');
  let applicationTime = Date.parse(data.endAt) + 60_000;
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret',
    clock: () => applicationTime });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/events/${event.id}/complete`, {
      method: 'POST', headers: { 'X-Dev-User': 'host', 'Idempotency-Key': 'fast-completion',
        'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: event.version, held: true, actualCount: 4, issues: [] }) });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { code: string }).code, 'INVALID_STATE');
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM outcomes WHERE event_id=$1', [event.id])).rows[0]?.n, 0);
    applicationTime = Date.now() - 90 * 60_000;
    await db.query('UPDATE events SET payload=payload || $2::jsonb WHERE id=$1', [event.id, JSON.stringify({
      startAt: new Date(Date.now() - 90 * 60_000).toISOString(),
      endAt: new Date(Date.now() - 30 * 60_000).toISOString()
    })]);
    const missingIssues = await fetch(`http://127.0.0.1:${address.port}/events/${event.id}/complete`, {
      method: 'POST', headers: { 'X-Dev-User': 'host', 'Idempotency-Key': 'missing-issues',
        'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: event.version, held: true, actualCount: 4 }) });
    assert.equal(missingIssues.status, 400);
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM outcomes WHERE event_id=$1', [event.id])).rows[0]?.n, 0);
    const valid = await fetch(`http://127.0.0.1:${address.port}/events/${event.id}/complete`, {
      method: 'POST', headers: { 'X-Dev-User': 'host', 'Idempotency-Key': 'slow-completion',
        'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: event.version, held: true, actualCount: 4, issues: ['场地问题：临时关门'] }) });
    assert.equal(valid.status, 200);
    assert.equal((await valid.json() as { held: boolean }).held, true);
    const { rows: completed } = await db.query<{ completed_at: Date; end_at: Date; issues: string[] }>(
      "SELECT o.completed_at,o.issues,(e.payload->>'endAt')::timestamptz AS end_at FROM outcomes o JOIN events e ON e.id=o.event_id WHERE o.event_id=$1",
      [event.id]);
    assert.ok(new Date(completed[0]!.completed_at).getTime() >= new Date(completed[0]!.end_at).getTime());
    assert.deepEqual(completed[0]!.issues, ['场地问题：临时关门']);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('QR issuance and HTTP scan use database time despite a skewed application clock', async () => {
  const db = await createDatabase();
  const start = Date.now() + 2 * 60 * 60_000;
  const data = { ...input, startAt: new Date(start).toISOString(), endAt: new Date(start + 60 * 60_000).toISOString(),
    registrationDeadline: new Date(start - 30 * 60_000).toISOString(),
    confirmationDeadline: new Date(start - 60 * 60_000).toISOString() };
  const draft = await createDraft(db, 'host', data, 'skewed-qr-draft');
  const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'skewed-qr-publish');
  for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, event.id, event.version, `skewed-qr-${actor}`);
  await confirmEvent(db, 'host', event.id, event.version, 'skewed-qr-confirm');
  let appNow = start + 1000;
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret',
    clock: () => appNow });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = async (path: string, actor: string, body: unknown, key: string) => {
    const response = await fetch(base + path, { method: 'POST', headers: {
      'X-Dev-User': actor, 'Content-Type': 'application/json', 'Idempotency-Key': key
    }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    const path = `/events/${event.id}`;
    assert.equal((await post(`${path}/checkin-token`, 'host', { expectedVersion: event.version }, 'ahead-token')).body.code,
      'CHECKIN_CLOSED');
    const aheadToken = createCheckInToken(event.id, 'test-secret', start + 1000);
    assert.equal((await post(`${path}/checkins`, 'p1',
      { expectedVersion: event.version, token: aheadToken }, 'ahead-scan')).body.code, 'CHECKIN_CLOSED');
    assert.equal((await db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM checkins WHERE event_id=$1', [event.id])).rows[0]?.n, 0);

    const dbStart = new Date(Date.now() - 5 * 60_000).toISOString();
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
      [event.id, dbStart]);
    appNow = Date.now() - 24 * 60 * 60_000;
    const { rows: beforeClock } = await db.query<{ current_time: Date }>('SELECT clock_timestamp() AS current_time');
    const currentToken = await post(`${path}/checkin-token`, 'host', { expectedVersion: event.version }, 'current-token');
    assert.equal(currentToken.status, 200);
    const { rows: afterClock } = await db.query<{ current_time: Date }>('SELECT clock_timestamp() AS current_time');
    const tokenMinute = Number(currentToken.body.token.split('.')[0]);
    assert.ok(tokenMinute >= Math.floor(new Date(beforeClock[0]!.current_time).getTime() / 60_000));
    assert.ok(tokenMinute <= Math.floor(new Date(afterClock[0]!.current_time).getTime() / 60_000));
    assert.equal((await post(`${path}/checkins`, 'p1',
      { expectedVersion: event.version, token: currentToken.body.token }, 'current-scan')).body.evidence, 'SCAN');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('private event requires invite token, and mutations require idempotency', async () => {
  const f = await fixture();
  try {
    const missing = await f.request('/events', 'host', 'POST', input);
    assert.equal(missing.status, 400);
    const draft = await f.request('/events', 'host', 'POST', { ...input, skillLevel: '中等水平' }, 'draft');
    assert.equal(draft.status, 201);
    const published = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST', { expectedVersion: draft.body.version }, 'publish');
    await approveInviteById(f.db, 'host', published.body.id);
    assert.equal(published.status, 200);
    const denied = await f.request(`/events/${draft.body.id}`, 'other');
    assert.equal(denied.status, 403);
    const opened = await f.request(`/i/${published.body.inviteToken}`, 'other');
    assert.equal(opened.status, 200);
    assert.equal(opened.body.title, input.title);
    assert.equal(opened.body.recruiting, true);
    assert.equal(opened.body.payload.title, input.title);
    assert.equal(opened.body.payload.approvalMode, input.approvalMode);
    assert.equal(opened.body.payload.visibility, 'INVITE');
    assert.equal(opened.body.payload.skillLevel, '中等水平');
    assert.equal(opened.body.payload.hostId, undefined);
    assert.equal(opened.body.inviteToken, undefined);
    const bypass = await f.request(`/events/${draft.body.id}/registrations`, 'other', 'POST', { expectedVersion: published.body.version, acceptedRules: true }, 'join-bypass');
    assert.equal(bypass.status, 403);
    const joined = await f.request(`/events/${draft.body.id}/registrations`, 'other', 'POST', { expectedVersion: published.body.version, inviteToken: published.body.inviteToken, acceptedRules: true }, 'join-valid');
    assert.equal(joined.status, 201);
    const hostList = await f.request('/me/events', 'host');
    const memberList = await f.request('/me/events', 'other');
    assert.equal(hostList.body.items.find((item: { id: string }) => item.id === draft.body.id)?.isHost, true);
    assert.equal(memberList.body.items.find((item: { id: string }) => item.id === draft.body.id)?.myRegistrationStatus, 'CONFIRMED');
    const detail = await f.request(`/events/${draft.body.id}`, 'other');
    assert.equal(detail.status, 200);
    assert.equal(detail.body.stats.confirmed, 2);
    assert.equal(detail.body.stats.waitlisted, 0);
    const unsure = await f.request(`/events/${draft.body.id}/interests`, 'unsure', 'POST', { expectedVersion: published.body.version, inviteToken: published.body.inviteToken }, 'interest');
    assert.equal(unsure.body.status, 'INTERESTED');
    assert.equal((await f.request(`/events/${draft.body.id}`, 'unsure')).body.stats.confirmed, 2);
    const decided = await f.request(`/events/${draft.body.id}/registrations`, 'unsure', 'POST', { expectedVersion: published.body.version, inviteToken: published.body.inviteToken, acceptedRules: true }, 'decide');
    assert.equal(decided.body.status, 'CONFIRMED');
    assert.equal((await f.request(`/events/${draft.body.id}/registrations`, 'other')).status, 403);
    assert.equal((await f.request(`/events/${draft.body.id}/registrations`, 'host')).body.items.length, 3);
  } finally { await f.close(); }
});

test('offer decline HTTP route advances the next waiting member and is owner-only', async () => {
  const f = await fixture();
  try {
    const draft = await createDraft(f.db, 'host', input, 'offer-http-draft');
    const event = await publishApprovedInvite(f.db, 'host', draft.id, draft.version, 'offer-http-publish');
    const p1 = await register(f.db, 'p1', event.id, event.version, 'offer-http-p1');
    for (const actor of ['p2', 'p3', 'p4', 'p5', 'w1', 'w2'])
      await register(f.db, actor, event.id, event.version, `offer-http-${actor}`);
    await cancelRegistration(f.db, 'p1', p1.id, event.version, 'offer-http-release');
    const { rows } = await f.db.query<{ id: string }>("SELECT id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [event.id]);
    const offerId = rows[0]!.id;
    const body = { expectedVersion: event.version };
    const forbidden = await f.request(`/offers/${offerId}/decline`, 'w2', 'POST', body, 'offer-http-forged');
    assert.equal(forbidden.status, 403);
    const result = await f.request(`/offers/${offerId}/decline`, 'w1', 'POST', body, 'offer-http-decline');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { id: offerId, status: 'DECLINED' });
    const { rows: active } = await f.db.query<{ user_id: string }>(`SELECT r.user_id FROM offers o
      JOIN registrations r ON r.id=o.registration_id WHERE o.event_id=$1 AND o.status='ACTIVE'`, [event.id]);
    assert.deepEqual(active.map(row => row.user_id), ['w2']);
  } finally { await f.close(); }
});

test('one idempotency key rejects a different request body but replays the same body', async () => {
  const f = await fixture();
  try {
    const first = await f.request('/events', 'host', 'POST', input, 'draft-fingerprint');
    assert.equal(first.status, 201);
    const replay = await f.request('/events', 'host', 'POST', Object.fromEntries(Object.entries(input).reverse()), 'draft-fingerprint');
    assert.deepEqual(replay.body, first.body);
    const mismatch = await f.request('/events', 'host', 'POST', { ...input, title: '另一个活动' }, 'draft-fingerprint');
    assert.equal(mismatch.status, 409);
    assert.equal(mismatch.body.code, 'IDEMPOTENCY_MISMATCH');
    const { rows } = await f.db.query<{ n: number }>("SELECT count(*)::int AS n FROM events WHERE host_id='host'");
    assert.equal(rows[0]?.n, 1);
    const anotherActor = await f.request('/events', 'other', 'POST', { ...input, title: '另一个活动' }, 'draft-fingerprint');
    assert.equal(anotherActor.status, 201);
    assert.notEqual(anotherActor.body.id, first.body.id);
  } finally { await f.close(); }
});

test('one idempotency key cannot silently change notification consent', async () => {
  const f = await fixture();
  try {
    await f.db.query("INSERT INTO users(id,wechat_openid) VALUES('member','api-consent-member')");
    const notice = (await f.request('/me/consents', 'member')).body.eventReminderNotice.version;
    const first = await f.request('/me/consents', 'member', 'POST', { eventReminder: true, noticeVersion: notice }, 'consent-fingerprint');
    assert.equal(first.status, 200);
    const mismatch = await f.request('/me/consents', 'member', 'POST', { eventReminder: false, noticeVersion: notice }, 'consent-fingerprint');
    assert.equal(mismatch.status, 409);
    assert.equal(mismatch.body.code, 'IDEMPOTENCY_MISMATCH');
    const current = await f.request('/me/consents', 'member');
    assert.equal(current.body.eventReminder, true);
  } finally { await f.close(); }
});

test('registration transaction rejects a changed payload for an existing key', async () => {
  const f = await fixture();
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'join-mismatch-draft');
    const event = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST',
      { expectedVersion: draft.body.version }, 'join-mismatch-publish');
    await approveInviteById(f.db, 'host', event.body.id);
    const path = `/events/${event.body.id}/registrations`;
    const firstBody = { expectedVersion: event.body.version, inviteToken: event.body.inviteToken, acceptedRules: true };
    const first = await f.request(path, 'member', 'POST', firstBody, 'join-mismatch');
    assert.equal(first.status, 201);
    const mismatch = await f.request(path, 'member', 'POST', { ...firstBody, inviteToken: 'another-token' }, 'join-mismatch');
    assert.equal(mismatch.status, 409);
    assert.equal(mismatch.body.code, 'IDEMPOTENCY_MISMATCH');
    const replay = await f.request(path, 'member', 'POST', firstBody, 'join-mismatch');
    assert.deepEqual(replay.body, first.body);
    const { rows } = await f.db.query<{ n: number }>('SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND user_id=$2',
      [event.body.id, 'member']);
    assert.equal(rows[0]?.n, 1);
  } finally { await f.close(); }
});

test('HTTP registration requires explicit acceptance of the current event rules', async () => {
  const f = await fixture();
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'rules-draft');
    const event = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST',
      { expectedVersion: draft.body.version }, 'rules-publish');
    await approveInviteById(f.db, 'host', event.body.id);
    const path = `/events/${event.body.id}/registrations`;
    const body = { expectedVersion: event.body.version, inviteToken: event.body.inviteToken };
    for (const [suffix, patch] of [['missing', {}], ['false', { acceptedRules: false }]] as const) {
      const refused = await f.request(path, 'member', 'POST', { ...body, ...patch }, `rules-${suffix}`);
      assert.equal(refused.status, 400);
      assert.equal(refused.body.code, 'RULES_NOT_ACCEPTED');
    }
    const { rows } = await f.db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND user_id=$2', [event.body.id, 'member']);
    assert.equal(rows[0]?.n, 0);
    const accepted = await f.request(path, 'member', 'POST', { ...body, acceptedRules: true }, 'rules-accepted');
    assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
    assert.equal(accepted.body.acceptedVersion, event.body.version);
  } finally { await f.close(); }
});

test('AI unavailable exposes a labeled rule fallback without inventing venue', async () => {
  const f = await fixture();
  try {
    const answer = await f.request('/events/drafts:suggest-local', 'host', 'POST', { text: '六个人打羽毛球，AA大概每人五十' }, 'ai-1');
    assert.equal(answer.status, 200);
    assert.equal(answer.body.aiStatus, 'UNAVAILABLE');
    assert.equal(answer.body.source, 'RULE_FALLBACK');
    assert.equal(answer.body.fields.maxParticipants, 6);
    assert.equal(answer.body.fields.venueName, undefined);
    const duration = await f.request('/events/drafts:suggest-local', 'host', 'POST',
      { text: '周六晚上八点打三小时羽毛球' }, 'ai-duration');
    assert.equal(duration.body.fields.templateDurationMinutes, 180);
    assert.equal(duration.body.fields.startAt, undefined);
    const draft = await f.request('/events', 'host', 'POST', duration.body.fields, 'ai-duration-draft');
    assert.equal(draft.status, 201);
    assert.equal((await f.request(`/events/${draft.body.id}`, 'host')).body.payload.templateDurationMinutes, 180);
  } finally { await f.close(); }
});

test('host can revoke an old invite without changing participant consent version', async () => {
  const f = await fixture();
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'draft-revoke');
    const e = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST', { expectedVersion: draft.body.version }, 'pub-revoke');
    await approveInviteById(f.db, 'host', e.body.id);
    const rotated = await f.request(`/events/${e.body.id}/invite:rotate`, 'host', 'POST', { expectedVersion: e.body.version }, 'rotate');
    assert.equal(rotated.status, 200);
    assert.notEqual(rotated.body.inviteToken, e.body.inviteToken);
    assert.equal(rotated.body.version, e.body.version);
    assert.equal((await f.request(`/i/${e.body.inviteToken}`, 'visitor')).status, 404);
    assert.equal((await f.request(`/i/${rotated.body.inviteToken}`, 'visitor')).status, 200);
    const oldJoin = await f.request(`/events/${e.body.id}/registrations`, 'p1', 'POST', { expectedVersion: e.body.version, inviteToken: e.body.inviteToken, acceptedRules: true }, 'old-join');
    assert.equal(oldJoin.status, 403);
  } finally { await f.close(); }
});

test('share intent and attributed opens are counted separately without trusting a share click as delivery', async () => {
  const f = await fixture();
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'share-draft');
    const e = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST', { expectedVersion: draft.body.version }, 'share-publish');
    await approveInviteById(f.db, 'host', e.body.id);
    const sourceToken = 'a'.repeat(32);
    assert.equal((await f.request(`/i/${e.body.inviteToken}?source=${sourceToken}`, 'p1')).status, 200);
    const intent = await f.request(`/events/${e.body.id}/share-intents`, 'host', 'POST',
      { expectedVersion: e.body.version, sourceToken }, 'share-intent');
    assert.equal(intent.status, 201);
    await f.request(`/i/${e.body.inviteToken}?source=${sourceToken}`, 'p1');
    await f.request(`/i/${e.body.inviteToken}?source=${sourceToken}`, 'p2');
    await f.request(`/i/${e.body.inviteToken}?source=${sourceToken}`, 'host');
    assert.equal((await f.request(`/events/${e.body.id}/share-metrics`, 'p1')).status, 403);
    const metrics = await f.request(`/events/${e.body.id}/share-metrics`, 'host');
    assert.deepEqual(metrics.body, { shareIntents: 1, attributedOpens: 2, unknownSourceOpens: 1 });
    const rotated = await f.request(`/events/${e.body.id}/invite:rotate`, 'host', 'POST', { expectedVersion: e.body.version }, 'share-rotate');
    await f.request(`/i/${rotated.body.inviteToken}?source=${sourceToken}`, 'p3');
    assert.equal((await f.request(`/events/${e.body.id}/share-metrics`, 'host')).body.attributedOpens, 2);
    assert.equal((await f.request(`/events/${e.body.id}/share-metrics`, 'host')).body.unknownSourceOpens, 2);
  } finally { await f.close(); }
});

test('host sees unacknowledged cancellation notices as manual follow-up work', async () => {
  const f = await fixture();
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'attention-draft');
    const e = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST', { expectedVersion: draft.body.version }, 'attention-publish');
    await approveInviteById(f.db, 'host', e.body.id);
    await f.request(`/events/${e.body.id}/registrations`, 'p1', 'POST',
      { expectedVersion: e.body.version, inviteToken: e.body.inviteToken, acceptedRules: true }, 'attention-join');
    await f.request(`/events/${e.body.id}/cancel`, 'host', 'POST', { expectedVersion: e.body.version }, 'attention-cancel');
    assert.equal((await f.request(`/events/${e.body.id}/attention`, 'p1')).status, 403);
    const pending = await f.request(`/events/${e.body.id}/attention`, 'host');
    assert.equal(pending.body.items.length, 1);
    assert.equal(pending.body.items[0].userId, 'p1');
    const notices = await f.request('/me/notifications', 'p1');
    const cancellation = notices.body.items.find((item: Record<string, any>) => item.kind === 'EVENT_CANCELLED');
    await f.request(`/me/notifications/${cancellation.id}/open`, 'p1', 'POST', {}, 'attention-open');
    assert.equal((await f.request(`/events/${e.body.id}/attention`, 'host')).body.items.length, 0);
  } finally { await f.close(); }
});

test('report list is operations-only and privacy requests stay with owner', async () => {
  const f = await fixture();
  try {
    const report = await f.request('/reports', 'p1', 'POST', { kind: 'SAFETY', description: '活动信息与实际不符' }, 'report-1');
    assert.equal(report.status, 201);
    assert.equal((await f.request('/ops/reports', 'p1')).status, 403);
    const reports = await f.request('/ops/reports', 'ops');
    assert.equal(reports.status, 200);
    assert.equal(reports.body.items.length, 1);
    assert.equal((await f.request(`/ops/reports/${report.body.id}/status`, 'p1', 'POST', { status: 'IN_REVIEW' }, 'bad-triage')).status, 403);
    assert.equal((await f.request(`/ops/reports/${report.body.id}/status`, 'ops', 'POST', { status: 'IN_REVIEW' }, 'triage')).body.status, 'IN_REVIEW');
    assert.equal((await f.request(`/ops/reports/${report.body.id}/status`, 'ops', 'POST',
      { status: 'RESOLVED', resolution: '已核查并完成处理' }, 'resolve-report')).body.status, 'RESOLVED');
    const appeal = await f.request('/appeals', 'p1', 'POST', { reportId: report.body.id, description: '请复核处理' }, 'appeal');
    assert.equal(appeal.status, 201);
    assert.equal((await f.request('/ops/appeals', 'ops')).body.items.length, 1);
    const privacy = await f.request('/privacy/requests', 'p1', 'POST', { kind: 'EXPORT' }, 'privacy-1');
    assert.equal(privacy.status, 201);
    assert.equal((await f.request('/privacy/requests', 'other')).body.items.length, 0);
    assert.equal((await f.request('/privacy/requests', 'p1')).body.items.length, 1);
    assert.equal((await f.request('/ops/privacy', 'ops')).body.items.length, 1);
    const deletion = await f.request('/privacy/requests', 'p1', 'POST', { kind: 'DELETE' }, 'privacy-delete');
    assert.equal(deletion.status, 201);
    assert.equal(deletion.body.status, 'PROTECTED_PENDING_POLICY');
    assert.equal(deletion.body.protection.state, 'APPLIED');
    assert.match(deletion.body.notice, /已阻止.*外部通知.*尚未.*停用.*删除.*去标识/);
    const ownDeletion = (await f.request('/privacy/requests', 'p1')).body.items.find((item: Record<string, any>) => item.id === deletion.body.id);
    assert.equal(ownDeletion.notice, deletion.body.notice);
    assert.equal((await f.request('/privacy/requests', 'other')).body.items.length, 0);
  } finally { await f.close(); }
});

test('personal data export contains only the authenticated person’s records', async () => {
  const f = await fixture();
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'export-draft');
    const event = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST', { expectedVersion: draft.body.version }, 'export-publish');
    await approveInviteById(f.db, 'host', event.body.id);
    await f.request(`/events/${event.body.id}/registrations`, 'p1', 'POST', { expectedVersion: event.body.version, inviteToken: event.body.inviteToken, acceptedRules: true }, 'export-p1');
    await f.request(`/events/${event.body.id}/registrations`, 'p2', 'POST', { expectedVersion: event.body.version, inviteToken: event.body.inviteToken, acceptedRules: true }, 'export-p2');
    const own = await f.request('/privacy/export', 'p1');
    assert.equal(own.status, 200);
    assert.equal(own.body.registrations.length, 1);
    assert.equal(own.body.registrations[0].user_id, 'p1');
    assert.equal(own.body.hostedEvents.length, 0);
    assert.ok(!JSON.stringify(own.body).includes('p2'));
    const host = await f.request('/privacy/export', 'host');
    assert.equal(host.body.hostedEvents.length, 1);
    assert.equal(host.body.registrations.length, 1);
    assert.ok(!JSON.stringify(host.body).includes('p2'));
  } finally { await f.close(); }
});

test('personal export ticket is bound to its owner and expires before another download', async () => {
  const db = await createDatabase();
  const now = Date.now() - 60 * 60_000;
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret', clock: () => now });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  const request = async (path: string, actor: string, method = 'GET', key?: string) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method,
      headers: { 'X-Dev-User': actor, ...(key ? { 'Idempotency-Key': key } : {}) } });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    const { rows: before } = await db.query<{ current_time: Date }>('SELECT clock_timestamp() AS current_time');
    const issued = await request('/privacy/exports', 'p1', 'POST', 'export-ticket');
    assert.equal(issued.status, 201);
    assert.match(issued.body.path, /^\/privacy\/exports\/[a-f0-9-]+$/);
    const { rows: after } = await db.query<{ current_time: Date }>('SELECT clock_timestamp() AS current_time');
    assert.ok(Date.parse(issued.body.expiresAt) >= new Date(before[0]!.current_time).getTime() + 10 * 60_000);
    assert.ok(Date.parse(issued.body.expiresAt) <= new Date(after[0]!.current_time).getTime() + 10 * 60_000);
    assert.equal((await request(issued.body.path, 'p2')).status, 404);
    const own = await request(issued.body.path, 'p1');
    assert.equal(own.status, 200);
    assert.ok('account' in own.body);
    await db.query("UPDATE personal_export_tickets SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [issued.body.path.split('/').at(-1)]);
    await runDueJobs(db);
    const expired = await request(issued.body.path, 'p1');
    assert.equal(expired.status, 410);
    assert.equal(expired.body.code, 'EXPORT_EXPIRED');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('activity alias API requires member consent and hides unconsented identities', async () => {
  const f = await fixture();
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'alias-draft');
    const event = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST', { expectedVersion: draft.body.version }, 'alias-publish');
    await approveInviteById(f.db, 'host', event.body.id);
    await f.request(`/events/${event.body.id}/registrations`, 'p1', 'POST', { expectedVersion: event.body.version, inviteToken: event.body.inviteToken, acceptedRules: true }, 'alias-p1');
    assert.equal((await f.request(`/events/${event.body.id}/aliases`, 'outsider')).status, 403);
    assert.deepEqual((await f.request(`/events/${event.body.id}/aliases`, 'host')).body.items, []);
    const notice = (await f.request(`/events/${event.body.id}/aliases`, 'p1')).body.notice;
    const set = await f.request(`/events/${event.body.id}/aliases`, 'p1', 'POST',
      { displayName: '小明', granted: true, noticeVersion: notice.version }, 'alias-set');
    assert.equal(set.status, 200);
    const visible = (await f.request(`/events/${event.body.id}/aliases`, 'host')).body.items;
    assert.equal(visible.length, 1);
    assert.deepEqual({ displayName: visible[0].displayName, isHost: visible[0].isHost, isMine: visible[0].isMine },
      { displayName: '小明', isHost: false, isMine: false });
    assert.match(visible[0].id, /^[a-f0-9]{16}$/);
    await f.request(`/events/${event.body.id}/aliases`, 'p1', 'POST', { displayName: null, granted: false }, 'alias-revoke');
    assert.deepEqual((await f.request(`/events/${event.body.id}/aliases`, 'host')).body.items, []);
  } finally { await f.close(); }
});

test('removed participant sees the private reason and can appeal the decision', async () => {
  const f = await fixture();
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'remove-draft');
    const event = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST', { expectedVersion: draft.body.version }, 'remove-publish');
    await approveInviteById(f.db, 'host', event.body.id);
    const joined = await f.request(`/events/${event.body.id}/registrations`, 'p1', 'POST',
      { expectedVersion: event.body.version, inviteToken: event.body.inviteToken, acceptedRules: true }, 'remove-join');
    const removed = await f.request(`/registrations/${joined.body.id}/remove`, 'host', 'POST',
      { expectedVersion: event.body.version, reason: '不符合本场公开的参与规则' }, 'remove-action');
    assert.equal(removed.status, 200);
    assert.equal(removed.body.status, 'REMOVED');
    assert.equal((await f.request('/me/removals', 'other')).body.items.length, 0);
    const mine = await f.request('/me/removals', 'p1');
    assert.equal(mine.body.items[0].reason, '不符合本场公开的参与规则');
    assert.equal((await f.request(`/events/${event.body.id}`, 'p1')).status, 403);
    assert.equal((await f.request('/appeals', 'other', 'POST',
      { removalId: removed.body.removalId, description: '请重新核查' }, 'remove-fake-appeal')).status, 403);
    const appeal = await f.request('/appeals', 'p1', 'POST',
      { removalId: removed.body.removalId, description: '请重新核查' }, 'remove-appeal');
    assert.equal(appeal.status, 201);
    assert.equal((await f.request('/ops/appeals', 'ops')).body.items[0].removal_id, removed.body.removalId);
    assert.equal((await f.request('/ops/appeals', 'ops')).body.items[0].removal_reason, '不符合本场公开的参与规则');
    assert.equal((await f.request(`/ops/appeals/${appeal.body.id}/status`, 'p1', 'POST', { status: 'IN_REVIEW' }, 'bad-review')).status, 403);
    assert.equal((await f.request(`/ops/appeals/${appeal.body.id}/status`, 'ops', 'POST', { status: 'IN_REVIEW' }, 'review')).body.status, 'IN_REVIEW');
    assert.equal((await f.request(`/ops/appeals/${appeal.body.id}/status`, 'ops', 'POST', { status: 'RESOLVED', resolution: '已核查移除依据，并告知双方复核结果' }, 'resolve')).body.status, 'RESOLVED');
    assert.equal((await f.request('/me/appeals', 'p1')).body.items[0].status, 'RESOLVED');
    assert.equal((await f.request('/me/appeals', 'other')).body.items.length, 0);
    assert.equal((await f.request('/me/notifications', 'p1')).body.items.filter((item: { kind: string }) => item.kind === 'APPEAL_RESOLVED').length, 1);
    assert.equal((await f.request('/me/notifications', 'other')).body.items.filter((item: { kind: string }) => item.kind === 'APPEAL_RESOLVED').length, 0);
  } finally { await f.close(); }
});

test('verified code exchange creates a bearer session without trusting client identity', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'test', devAuth: false, checkInSecret: 'secret',
    wechatExchange: async code => code === 'valid-code' ? { openid: 'wechat-openid-1' } : null });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const login = await fetch(base + '/auth/wechat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'valid-code', userId: 'forged-id' }) });
    assert.equal(login.status, 200);
    const session = await login.json() as { token: string; userId: string };
    assert.notEqual(session.userId, 'forged-id');
    const created = await fetch(base + '/events', { method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Idempotency-Key': 'bearer-draft', 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '真实登录草稿' }) });
    assert.equal(created.status, 201);
    const draft = await created.json() as { hostId: string };
    assert.equal(draft.hostId, session.userId);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('member logout revokes only the presented bearer and records an audit action', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'secret',
    wechatExchange: async code => ['logout-one', 'logout-two'].includes(code) ? { openid: 'logout-member' } : null });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    async function login(code: string) {
      const response = await fetch(base + '/auth/wechat', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      assert.equal(response.status, 200);
      return response.json() as Promise<{ token: string; userId: string }>;
    }
    const first = await login('logout-one');
    const second = await login('logout-two');
    const read = (token: string) => fetch(base + '/me/events', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal((await read(first.token)).status, 200);
    assert.equal((await fetch(base + '/auth/logout', { method: 'POST', headers: { 'X-Dev-User': 'forged-member' } })).status, 401);
    assert.equal((await read(first.token)).status, 200);
    const logout = await fetch(base + '/auth/logout', { method: 'POST',
      headers: { Authorization: `Bearer ${first.token}`, 'X-Dev-User': 'forged-member' } });
    assert.equal(logout.status, 200);
    assert.equal((await read(first.token)).status, 401);
    assert.equal((await read(second.token)).status, 200);
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM audit WHERE actor_id=$1 AND action='MEMBER_LOGOUT'",
      [first.userId])).rows[0]?.n, 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('content review endpoints enforce operator role and member visibility', async () => {
  const f = await fixture();
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'content-draft');
    const event = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST', { expectedVersion: draft.body.version }, 'content-publish');
    await approveInviteById(f.db, 'host', event.body.id);
    const joined = await f.request(`/events/${event.body.id}/registrations`, 'member', 'POST',
      { expectedVersion: event.body.version, inviteToken: event.body.inviteToken, acceptedRules: true }, 'content-join');
    const created = await f.request(`/events/${event.body.id}/content`, 'member', 'POST', { kind: 'QUESTION', body: '要带球拍吗？' }, 'content-question');
    assert.equal(created.status, 201);
    assert.equal((await f.request(`/events/${event.body.id}/content`, 'host')).body.items.length, 0);
    assert.equal((await f.request('/ops/content', 'member')).status, 403);
    assert.equal((await f.request('/ops/content', 'ops')).body.items.length, 1);
    assert.equal((await f.request(`/ops/content/${created.body.id}/moderate`, 'member', 'POST', { status: 'APPROVED' }, 'bad-mod')).status, 403);
    assert.equal((await f.request(`/ops/content/${created.body.id}/moderate`, 'ops', 'POST', { status: 'APPROVED' }, 'good-mod')).status, 200);
    assert.equal((await f.request(`/events/${event.body.id}/content`, 'host')).body.items.length, 1);
    const rejected = await f.request(`/events/${event.body.id}/content`, 'member', 'POST', { kind: 'QUESTION', body: '活动内容申诉测试' }, 'rejected-question');
    assert.equal((await f.request(`/ops/content/${rejected.body.id}/moderate`, 'ops', 'POST',
      { status: 'REJECTED', reason: '请重新核对活动提问语境' }, 'reject-question')).status, 200);
    assert.equal((await f.request('/me/content', 'member')).body.items[0].moderation_reason, '请重新核对活动提问语境');
    assert.deepEqual((await f.request('/me/content', 'stranger')).body.items, []);
    assert.equal((await f.request('/appeals', 'stranger', 'POST',
      { contentId: rejected.body.id, description: '冒名申诉' }, 'fake-content-appeal')).status, 403);
    const contentAppeal = await f.request('/appeals', 'member', 'POST',
      { contentId: rejected.body.id, description: '请重新审核该问题' }, 'content-appeal');
    assert.equal(contentAppeal.status, 201);
    assert.equal((await f.request('/me/content', 'member')).body.items[0].appeal_id, contentAppeal.body.id);
    assert.equal((await f.request(`/ops/appeals/${contentAppeal.body.id}/status`, 'ops', 'POST',
      { status: 'RESOLVED', resolution: '维持原决定', outcome: 'UPHOLD' }, 'self-content-review')).status, 409);
    assert.equal((await f.request(`/registrations/${joined.body.id}/cancel`, 'member', 'POST',
      { expectedVersion: event.body.version }, 'content-author-exit')).status, 200);
    assert.equal((await f.request('/me/content', 'member')).body.items[0].id, rejected.body.id);
    assert.equal((await f.request(`/events/${event.body.id}/content`, 'stranger')).status, 403);
  } finally { await f.close(); }
});

test('content moderation queue pages every pending item and rejects stale continuation', async () => {
  const f = await fixture();
  try {
    const draft = await f.request('/events', 'host', 'POST', input, 'content-page-draft');
    const event = await f.request(`/events/${draft.body.id}/publish`, 'host', 'POST', { expectedVersion: draft.body.version }, 'content-page-publish');
    await approveInviteById(f.db, 'host', event.body.id);
    await f.db.query(`INSERT INTO activity_content(id,event_id,author_id,kind,body,status)
      SELECT 'content-page-'||n,$1,'host','QUESTION','待审核问题 '||n,'PENDING_REVIEW'
      FROM generate_series(1,105) n`, [event.body.id]);
    assert.equal((await f.request('/ops/content?offset=0', 'visitor')).status, 403);
    const first = await f.request('/ops/content?offset=0', 'ops');
    assert.equal(first.body.total, 105);
    assert.equal(first.body.items.length, 100);
    assert.equal(first.body.nextOffset, 100);
    const second = await f.request(`/ops/content?offset=100&snapshot=${first.body.snapshot}`, 'ops');
    assert.equal(second.body.items.length, 5);
    assert.equal(second.body.nextOffset, null);
    assert.equal(new Set([...first.body.items, ...second.body.items].map((item: { id: string }) => item.id)).size, 105);
    assert.equal((await f.request('/ops/content?offset=100', 'ops')).status, 400);
    assert.equal((await f.request('/ops/content?offset=-1', 'ops')).status, 400);
    assert.equal((await f.request(`/ops/content/${first.body.items[0].id}/moderate`, 'ops', 'POST', { status: 'APPROVED' }, 'content-page-approve')).status, 200);
    const stale = await f.request(`/ops/content?offset=100&snapshot=${first.body.snapshot}`, 'ops');
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, 'QUEUE_CHANGED');
  } finally { await f.close(); }
});
