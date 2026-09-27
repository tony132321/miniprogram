import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';
import type { DraftProvider } from '../src/ai-provider-boundary.ts';
import { exportPersonalData } from '../src/privacy.ts';
import { createDraft } from '../src/events.ts';
import { listAiEventCosts } from '../src/ai-draft-requests.ts';

const provider: DraftProvider = {
  estimateUpperBoundFen: () => 10,
  generate: async () => ({ costFen: 7, fields: { title: '周末球局', venueName: '待主办确认的公共球馆', venueStatus: 'HOST_CONFIRMED' } })
};

test('the injected draft provider uses the authenticated HTTP path and keeps venue unconfirmed', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret',
    clock: () => Date.parse('2026-09-23T04:00:00.000Z'), aiDraftProvider: provider, aiDraftBudgetFen: 20 });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const port = (server.address() as { port: number }).port;
    const response = await fetch(`http://127.0.0.1:${port}/events/drafts:suggest-local`, {
      method: 'POST', headers: { 'X-Dev-User': 'host', 'Content-Type': 'application/json', 'Idempotency-Key': 'provider-fixture' },
      body: JSON.stringify({ text: '本周六晚上8点在深圳打羽毛球，六个人' })
    });
    const body = await response.json() as Record<string, any>;
    assert.equal(response.status, 200);
    assert.equal(body.aiStatus, 'GENERATED');
    assert.equal(body.fields.title, '周末球局');
    assert.equal(body.fields.startAt, '2026-09-26T12:00:00.000Z');
    assert.equal(body.fields.venueStatus, undefined);
    assert.equal(body.fieldSources.venueName, 'NEEDS_CONFIRMATION');
    assert.equal(body.aiContentLabel, 'AI_GENERATED_UNVERIFIED');
    const eventResponse = await fetch(`http://127.0.0.1:${port}/events/${body.draft.id}`,
      { headers: { 'X-Dev-User': 'host' } });
    assert.equal(eventResponse.status, 200);
    assert.equal((await eventResponse.json()).aiSuggestionGenerated, true);
    const manualDraft = await createDraft(db, 'host', {}, 'manual-label-control');
    const manualResponse = await fetch(`http://127.0.0.1:${port}/events/${manualDraft.id}`,
      { headers: { 'X-Dev-User': 'host' } });
    assert.equal((await manualResponse.json()).aiSuggestionGenerated, false);
    const ownExport = await exportPersonalData(db, 'host');
    assert.equal(ownExport.hostedEvents.find((event: any) => event.id === body.draft.id)?.ai_suggestion_generated, true);
    assert.equal(ownExport.hostedEvents.find((event: any) => event.id === manualDraft.id)?.ai_suggestion_generated, false);
    await db.query(`UPDATE events SET status='RECRUITING',review_status='APPROVED',
      invite_token='ai-label-invite',invite_expires_at=clock_timestamp()+interval '1 hour',
      payload=$2::jsonb WHERE id=$1`, [body.draft.id,
      JSON.stringify({ title: '周末球局', visibility: 'INVITE' })]);
    const invite = await fetch(`http://127.0.0.1:${port}/i/ai-label-invite`);
    assert.equal(invite.status, 200);
    assert.equal((await invite.json()).aiSuggestionGenerated, true);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});

test('production cannot activate an unapproved draft provider', async () => {
  const db = await createDatabase();
  try {
    assert.throws(() => createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'test-secret',
      aiDraftProvider: provider, aiDraftBudgetFen: 20 }), /AI draft.*disabled/i);
  } finally { await db.close(); }
});

test('one event cannot spend its full AI draft budget on every new request', async () => {
  const db = await createDatabase();
  const draft = await createDraft(db, 'host', {}, 'budget-draft');
  let calls = 0;
  const counted: DraftProvider = { estimateUpperBoundFen: () => 7,
    generate: async () => { calls++; return { costFen: 6, fields: { title: '活动建议' } }; } };
  const server = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'test-secret',
    aiDraftProvider: counted, aiDraftBudgetFen: 10 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/events/drafts:suggest-local`;
  const post = async (key: string) => {
    const response = await fetch(url, { method: 'POST', headers: { 'X-Dev-User': 'host',
      'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ text: '周六晚上打羽毛球', eventId: draft.id }) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    const first = await post('budget-first');
    const second = await post('budget-second');
    assert.equal(first.status, 200);
    assert.equal(first.body.aiStatus, 'GENERATED');
    assert.equal(second.status, 200);
    assert.equal(second.body.fallbackReason, 'BUDGET');
    assert.equal(calls, 1);
    const costs = await listAiEventCosts(db);
    assert.deepEqual(costs.items, [{ event_id: draft.id, request_count: 2,
      known_cost_fen: 6, uncertain_reserved_fen: 0, uncertain_count: 0 }]);
    const ownRead = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/ops/ai-event-costs`,
      { headers: { 'X-Dev-User': 'host' } });
    assert.equal(ownRead.status, 403);
    const opsRead = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/ops/ai-event-costs`,
      { headers: { 'X-Dev-User': 'ops' } });
    assert.equal(opsRead.status, 200);
    const opsBody = await opsRead.json() as Record<string, any>;
    assert.equal(opsBody.items[0]?.event_id, draft.id);
    await db.query("UPDATE events SET status='RECRUITING' WHERE id=$1", [draft.id]);
    assert.equal((await post('budget-after-publish')).status, 409);
    assert.equal(calls, 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('the first model suggestion creates one reusable server draft', async () => {
  const db = await createDatabase();
  let calls = 0;
  const counted: DraftProvider = { estimateUpperBoundFen: () => 7,
    generate: async () => { calls++; return { costFen: 6, fields: { title: '活动建议' } }; } };
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret',
    aiDraftProvider: counted, aiDraftBudgetFen: 10 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/events/drafts:suggest-local`;
  const post = async (key: string, eventId?: string) => {
    const response = await fetch(url, { method: 'POST', headers: { 'X-Dev-User': 'host',
      'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ text: '周六晚上打羽毛球', ...(eventId ? { eventId } : {}) }) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    const first = await post('model-first');
    const replay = await post('model-first');
    assert.equal(first.status, 200);
    assert.deepEqual(replay, first);
    assert.equal(first.body.draft.version, 1);
    const second = await post('model-second', first.body.draft.id);
    assert.equal(second.body.fallbackReason, 'BUDGET');
    assert.equal(second.body.draft.id, first.body.draft.id);
    assert.equal(calls, 1);
    const otherDraft = await createDraft(db, 'host', {}, 'other-budget-draft');
    assert.equal((await post('model-first', otherDraft.id)).status, 409);
    const { rows: drafts } = await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [first.body.draft.id]);
    assert.equal(drafts[0]?.status, 'DRAFT');
    const { rows } = await db.query<{ event_id: string }>(
      "SELECT event_id FROM ai_draft_requests WHERE actor_id='host' ORDER BY request_key");
    assert.deepEqual(rows.map(row => row.event_id), [first.body.draft.id, first.body.draft.id]);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('a pending model call reserves the same event budget across different request keys', async () => {
  const db = await createDatabase();
  const draft = await createDraft(db, 'host', {}, 'pending-budget-draft');
  let calls = 0;
  let signalStarted!: () => void;
  let release!: () => void;
  const started = new Promise<void>(resolve => { signalStarted = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  const provider: DraftProvider = { estimateUpperBoundFen: () => 10,
    generate: async () => { calls++; signalStarted(); await held; return { costFen: 6, fields: { title: '活动建议' } }; } };
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret',
    aiDraftProvider: provider, aiDraftBudgetFen: 10 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/events/drafts:suggest-local`;
  const post = async (key: string) => {
    const response = await fetch(url, { method: 'POST', headers: { 'X-Dev-User': 'host',
      'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ text: '周六晚上打羽毛球', eventId: draft.id }) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    const first = post('pending-first');
    await started;
    const overlapping = await post('pending-second');
    assert.equal(overlapping.status, 200);
    assert.equal(overlapping.body.fallbackReason, 'BUDGET');
    assert.equal(calls, 1);
    release();
    assert.equal((await first).body.aiStatus, 'GENERATED');
  } finally { release(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('another host cannot spend or inspect a draft AI budget', async () => {
  const db = await createDatabase();
  const draft = await createDraft(db, 'host', {}, 'private-budget-draft');
  let calls = 0;
  const provider: DraftProvider = { estimateUpperBoundFen: () => 1,
    generate: async () => { calls++; return { costFen: 1, fields: { title: '活动建议' } }; } };
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret',
    aiDraftProvider: provider, aiDraftBudgetFen: 10 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const port = (server.address() as { port: number }).port;
    const response = await fetch(`http://127.0.0.1:${port}/events/drafts:suggest-local`, {
      method: 'POST', headers: { 'X-Dev-User': 'other', 'Content-Type': 'application/json',
        'Idempotency-Key': 'wrong-host' },
      body: JSON.stringify({ text: '周六晚上打羽毛球', eventId: draft.id }) });
    assert.equal(response.status, 403);
    assert.equal(calls, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('an uncertain provider cost keeps its full event reservation', async () => {
  const db = await createDatabase();
  const draft = await createDraft(db, 'host', {}, 'uncertain-budget-draft');
  let calls = 0;
  const provider: DraftProvider = { estimateUpperBoundFen: () => 10,
    generate: async () => { calls++; throw new Error('provider connection lost'); } };
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret',
    aiDraftProvider: provider, aiDraftBudgetFen: 10 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/events/drafts:suggest-local`;
  const post = async (key: string) => {
    const response = await fetch(url, { method: 'POST', headers: { 'X-Dev-User': 'host',
      'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ text: '周六晚上打羽毛球', eventId: draft.id }) });
    return await response.json() as Record<string, any>;
  };
  try {
    const first = await post('uncertain-first');
    const second = await post('uncertain-second');
    assert.equal(first.providerCostStatus, 'UNKNOWN');
    assert.equal(second.fallbackReason, 'BUDGET');
    assert.equal(calls, 1);
    const costs = await listAiEventCosts(db);
    assert.deepEqual(costs.items, [{ event_id: draft.id, request_count: 2,
      known_cost_fen: 0, uncertain_reserved_fen: 10, uncertain_count: 1 }]);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('invalid draft input never creates an uncertain provider request or consumes its key', async () => {
  const db = await createDatabase();
  let calls = 0;
  const counted: DraftProvider = { estimateUpperBoundFen: () => 10,
    generate: async () => { calls++; return { costFen: 7, fields: { title: '建议标题' } }; } };
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret',
    aiDraftProvider: counted, aiDraftBudgetFen: 20 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/events/drafts:suggest-local`;
  const post = async (text: string) => {
    const response = await fetch(url, { method: 'POST', headers: { 'X-Dev-User': 'host',
      'Content-Type': 'application/json', 'Idempotency-Key': 'corrected-input-key' }, body: JSON.stringify({ text }) });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };
  try {
    assert.equal((await post('   ')).status, 400);
    const { rows: invalidRows } = await db.query<{ status: string }>(
      "SELECT status FROM ai_draft_requests WHERE actor_id='host' AND request_key='corrected-input-key'");
    assert.deepEqual(invalidRows, []);
    assert.equal(calls, 0);
    const corrected = await post('周六晚上打羽毛球');
    assert.equal(corrected.status, 200);
    assert.equal(corrected.body.aiStatus, 'GENERATED');
    assert.equal(calls, 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('draft provider retries replay one durable result and never bill another call for the same key', async () => {
  const db = await createDatabase();
  let calls = 0;
  const counted: DraftProvider = { estimateUpperBoundFen: () => 10,
    generate: async () => { calls++; return { costFen: 7, fields: { title: '建议标题' } }; } };
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret',
    aiDraftProvider: counted, aiDraftBudgetFen: 20 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/events/drafts:suggest-local`;
  const post = async (actor: string, key: string, prompt: string) => {
    const response = await fetch(url, { method: 'POST', headers: { 'X-Dev-User': actor,
      'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ text: prompt }) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    const first = await post('host', 'same-key', '周六晚上打球');
    const replay = await post('host', 'same-key', '周六晚上打球');
    assert.equal(first.status, 200);
    assert.deepEqual(replay, first);
    assert.equal(calls, 1);
    const mismatch = await post('host', 'same-key', '周日晚上打球');
    assert.equal(mismatch.status, 409);
    const malformedMismatch = await post('host', 'same-key', '   ');
    assert.equal(malformedMismatch.status, 409);
    assert.equal(malformedMismatch.body.code, 'IDEMPOTENCY_MISMATCH');
    assert.equal(calls, 1);
    assert.equal((await post('other', 'same-key', '周六晚上打球')).status, 200);
    assert.equal(calls, 2);
    const { rows } = await db.query<{ status: string; known_cost_fen: number; cost_status: string; budget_fen: number; request_hash: string }>(
      "SELECT status,known_cost_fen,cost_status,budget_fen,request_hash FROM ai_draft_requests WHERE actor_id='host'");
    assert.equal(rows[0]?.status, 'COMPLETED');
    assert.equal(rows[0]?.known_cost_fen, 7);
    assert.equal(rows[0]?.cost_status, 'KNOWN');
    assert.equal(rows[0]?.budget_fen, 20);
    assert.match(rows[0]?.request_hash ?? '', /^[a-f0-9]{64}$/);
    const own = await exportPersonalData(db, 'host');
    const other = await exportPersonalData(db, 'other');
    assert.equal(own.aiDraftRequests.length, 1);
    assert.equal(own.aiDraftRequests[0]?.known_cost_fen, 7);
    assert.equal(own.aiDraftRequests[0]?.cost_status, 'KNOWN');
    assert.equal(own.aiDraftRequests[0]?.event_id, first.body.draft.id);
    assert.equal(own.aiDraftRequests[0]?.reserved_fen, 20);
    assert.equal(other.aiDraftRequests.length, 1);
    assert.equal(JSON.stringify(own.aiDraftRequests).includes('other'), false);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('an overlapping retry cannot start a second provider call while the first is unresolved', async () => {
  const db = await createDatabase();
  let calls = 0;
  let signalStarted!: () => void;
  let release!: () => void;
  const started = new Promise<void>(resolve => { signalStarted = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  const slow: DraftProvider = { estimateUpperBoundFen: () => 5,
    generate: async () => { calls++; signalStarted(); await held; return { costFen: 3, fields: { title: '待确认建议' } }; } };
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret',
    aiDraftProvider: slow, aiDraftBudgetFen: 10 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/events/drafts:suggest-local`;
  const post = async () => {
    const response = await fetch(url, { method: 'POST', headers: { 'X-Dev-User': 'host',
      'Content-Type': 'application/json', 'Idempotency-Key': 'overlap-key' }, body: JSON.stringify({ text: '明晚打球' }) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    const first = post();
    await started;
    const overlapping = await post();
    assert.equal(overlapping.status, 409);
    assert.equal(overlapping.body.code, 'AI_REQUEST_UNCERTAIN');
    assert.equal(calls, 1);
    release();
    assert.equal((await first).status, 200);
    assert.equal((await post()).status, 200);
    assert.equal(calls, 1);
  } finally { release(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});
