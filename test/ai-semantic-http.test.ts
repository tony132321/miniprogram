import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { createContent, moderateContent } from '../src/collaboration.ts';
import { createApp } from '../src/server.ts';
import { publishApprovedInvite, register } from './helpers.ts';

const input = { title: '语义问答 HTTP', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共场馆',
  venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z',
  feeMode: 'FREE', feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE',
  approvalMode: 'AUTO', hostParticipates: true };

test('test-only semantic fixture uses the existing facts route and restricts alert reads', async () => {
  const db = await createDatabase();
  const draft = await createDraft(db, 'host', input, 'semantic-http-draft');
  const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'semantic-http-publish');
  await register(db, 'p1', event.id, event.version, 'semantic-http-join');
  const faq = await createContent(db, 'host', event.id, 'ANNOUNCEMENT',
    '问：需要自带球拍吗？\n答：请自带球拍。', null, 'semantic-http-faq');
  await moderateContent(db, 'ops', faq.id, 'APPROVED', 'semantic-http-approve');
  let calls = 0;
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'],
    checkInSecret: 'secret', aiDraftBudgetFen: 10,
    aiSemanticProvider: { estimateUpperBoundFen: () => 5, suggest: async () => {
      calls++;
      return { sourceContentId: faq.id, eventVersion: event.version, confidence: 0.96, costFen: 5,
        evidence: { modelVersion: 'fixture-v1', promptHash: 'c'.repeat(64),
          usage: { inputTokens: 10, outputTokens: 3 },
          receipt: { status: 'ACCEPTED', reference: 'fixture-semantic-http' } } };
    } } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const url = `${base}/events/${event.id}/facts:ask`;
  const post = (question = '要自带球拍吗？', key = 'semantic-http-answer') => fetch(url, { method: 'POST',
    headers: { 'X-Dev-User': 'p1', 'Idempotency-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }) });
  try {
    const response = await post();
    assert.equal(response.status, 200);
    const answer = await response.json() as { source: string; answer: string };
    assert.equal(answer.source, 'APPROVED_ANNOUNCEMENT');
    assert.match(answer.answer, /请自带球拍/);
    assert.deepEqual(await (await post()).json(), answer);
    assert.equal(calls, 1);
    const memberAlerts = await fetch(`${base}/ops/ai-semantic-alerts`, { headers: { 'X-Dev-User': 'p1' } });
    assert.equal(memberAlerts.status, 403);
    const operatorAlerts = await fetch(`${base}/ops/ai-semantic-alerts`, { headers: { 'X-Dev-User': 'ops' } });
    assert.equal(operatorAlerts.status, 200);
    const unrelated = await post('活动有停车场吗？', 'semantic-http-unrelated');
    assert.equal(unrelated.status, 200);
    assert.equal((await unrelated.json() as { source: string }).source, 'UNKNOWN');
    const pending = await fetch(`${base}/ops/ai-semantic-alerts`, { headers: { 'X-Dev-User': 'ops' } });
    assert.equal((await pending.json() as { total: number }).total, 1);
    const reviewBody = JSON.stringify({ userId: 'p1', requestKey: 'semantic-http-unrelated',
      note: '已核对来源不匹配，保留人工待办与费用记录。' });
    const reviewHeaders = { 'Content-Type': 'application/json', 'Idempotency-Key': 'semantic-http-review' };
    assert.equal((await fetch(`${base}/ops/ai-semantic-alerts/review`, { method: 'POST',
      headers: { ...reviewHeaders, 'X-Dev-User': 'p1' }, body: reviewBody })).status, 403);
    const reviewed = await fetch(`${base}/ops/ai-semantic-alerts/review`, { method: 'POST',
      headers: { ...reviewHeaders, 'X-Dev-User': 'ops' }, body: reviewBody });
    assert.equal(reviewed.status, 200);
    const history = await fetch(`${base}/ops/ai-semantic-alerts/reviews`, { headers: { 'X-Dev-User': 'ops' } });
    assert.equal(history.status, 200);
    assert.equal((await history.json() as { total: number }).total, 1);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('semantic fixture cannot be enabled outside isolated tests', async () => {
  const db = await createDatabase();
  try {
    const provider = { estimateUpperBoundFen: () => 1, suggest: async () => ({}) };
    assert.throws(() => createApp(db, { environment: 'development', devAuth: true,
      checkInSecret: 'secret', aiDraftBudgetFen: 10, aiSemanticProvider: provider }), /isolated test fixtures/);
  } finally { await db.close(); }
});
