import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { runRecordedDraftProvider } from '../src/ai-draft-requests.ts';
import { prepareAiAction, approveAiAction, executeAiAction } from '../src/ai-actions.ts';
import { askSemanticCurrentFact } from '../src/ai-semantic-answer.ts';
import { askCurrentFact, createContent, moderateContent } from '../src/collaboration.ts';
import { publishApprovedInvite, register } from './helpers.ts';
import { exportPersonalData } from '../src/privacy.ts';
import { getPrivacyRequestImpact } from '../src/operations.ts';
import { dryRunPrivacyDeletion } from '../src/privacy-deletion.ts';

const input = { title: 'AI 隐私竞态', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z',
  timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE',
  feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };
const evidence = { modelVersion: 'fixture-v1', promptHash: 'a'.repeat(64),
  usage: { inputTokens: 2, outputTokens: 2 }, receipt: { status: 'ACCEPTED', reference: 'fixture-secret' } };
const deletePending = (db: Awaited<ReturnType<typeof createDatabase>>, user: string) => db.query(
  "INSERT INTO privacy_requests(id,user_id,kind,status) VALUES($1,$2,'DELETE','OPEN')", [`delete-${user}`, user]);

test('pending DELETE blocks new AI draft reservations and all AI action transitions', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('host','ai-privacy-host')");
    const draft = await createDraft(db, 'host', { title: '原题' }, 'ai-privacy-draft');
    const proposal = { kind: 'SAVE_DRAFT' as const, eventId: draft.id,
      expectedVersion: draft.version, payload: { title: '新题' } };
    const prepared = await prepareAiAction(db, 'host', proposal, 'before-delete');
    await deletePending(db, 'host');
    let calls = 0;
    await assert.rejects(() => runRecordedDraftProvider(db, 'host', 'after-delete', '周六打羽毛球',
      Date.parse('2026-09-23T04:00:00Z'), { estimateUpperBoundFen: () => 5,
        generate: async () => { calls++; return { costFen: 5, evidence, fields: { title: '建议' } }; } }, 10, draft.id),
    { code: 'ACCOUNT_DISABLED' });
    assert.equal(calls, 0);
    await assert.rejects(() => prepareAiAction(db, 'host', proposal, 'prepare-after-delete'), { code: 'ACCOUNT_DISABLED' });
    await assert.rejects(() => approveAiAction(db, 'host', prepared.id, true, prepared.payloadHash, 'approve-after-delete'),
      { code: 'ACCOUNT_DISABLED' });
    await db.query("UPDATE privacy_requests SET status='CANCELLED' WHERE user_id='host'");
    await approveAiAction(db, 'host', prepared.id, true, prepared.payloadHash, 'approve-allowed');
    await db.query("UPDATE privacy_requests SET status='OPEN' WHERE user_id='host'");
    await assert.rejects(() => executeAiAction(db, 'host', prepared.id, { ...proposal, payloadHash: prepared.payloadHash },
      'execute-after-delete'), { code: 'ACCOUNT_DISABLED' });
    await assert.rejects(() => askCurrentFact(db, 'host', draft.id, '活动几点开始？', 'fact-after-delete'),
      { code: 'ACCOUNT_DISABLED' });
    assert.equal((await db.query<{ title: string }>('SELECT payload->>\'title\' AS title FROM events WHERE id=$1', [draft.id])).rows[0]?.title, '原题');
  } finally { await db.close(); }
});

test('draft provider completion after DELETE records its cost without returning a business suggestion', async () => {
  const db = await createDatabase();
  let release!: () => void;
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('host','ai-privacy-race-host')");
    const draft = await createDraft(db, 'host', {}, 'ai-privacy-race-draft');
    let called!: () => void;
    const started = new Promise<void>(resolve => { called = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    const running = runRecordedDraftProvider(db, 'host', 'race-draft', '周六打羽毛球',
      Date.parse('2026-09-23T04:00:00Z'), { estimateUpperBoundFen: () => 5,
        generate: async () => { called(); await held; return { costFen: 5, evidence, fields: { title: '泄露建议' } }; } }, 10, draft.id);
    await started;
    await deletePending(db, 'host');
    release();
    await assert.rejects(running, { code: 'ACCOUNT_DISABLED' });
    const { rows } = await db.query<{ status: string; known_cost_fen: number; result: unknown }>(
      "SELECT status,known_cost_fen,result FROM ai_draft_requests WHERE request_key='race-draft'");
    assert.equal(rows[0]?.status, 'UNKNOWN');
    assert.equal(rows[0]?.known_cost_fen, 5);
    assert.equal(rows[0]?.result, null);
    const { rows: audits } = await db.query<{ detail: { providerEvidence: unknown } }>(
      "SELECT detail FROM audit WHERE actor_id='host' AND action='AI_DRAFT_ABORTED_FOR_DELETION'");
    assert.equal(audits.length, 1);
    assert.equal(JSON.stringify(audits[0]?.detail).includes('fixture-secret'), false);
    assert.equal(JSON.stringify(audits[0]?.detail.providerEvidence).includes('fixture-v1'), true);
  } finally { release?.(); await db.close(); }
});

test('semantic provider completion after DELETE preserves evidence and never creates a fact todo', async () => {
  const db = await createDatabase();
  let release!: () => void;
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('host','ai-privacy-sem-host'),('p1','ai-privacy-sem-p1')");
    const draft = await createDraft(db, 'host', input, 'ai-privacy-sem-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'ai-privacy-sem-publish');
    await register(db, 'p1', event.id, event.version, 'ai-privacy-sem-register');
    const faq = await createContent(db, 'host', event.id, 'ANNOUNCEMENT', '问：带球拍吗？\n答：带。', null, 'ai-privacy-faq');
    await moderateContent(db, 'ops', faq.id, 'APPROVED', 'ai-privacy-faq-approve');
    let called!: () => void;
    const started = new Promise<void>(resolve => { called = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    const running = askSemanticCurrentFact(db, 'p1', event.id, '有停车场吗？', 'race-semantic', {
      estimateUpperBoundFen: () => 5,
      suggest: async () => { called(); await held; return { sourceContentId: faq.id, eventVersion: event.version,
        confidence: 0.99, costFen: 5, evidence }; }
    }, { budgetFen: 10, environment: 'test' });
    await started;
    await deletePending(db, 'p1');
    release();
    await assert.rejects(running, { code: 'ACCOUNT_DISABLED' });
    const { rows } = await db.query<{ status: string; known_cost_fen: number; result: unknown; provider_evidence: unknown }>(
      "SELECT status,known_cost_fen,result,provider_evidence FROM ai_semantic_requests WHERE request_key='race-semantic'");
    assert.equal(rows[0]?.status, 'UNKNOWN');
    assert.equal(rows[0]?.known_cost_fen, 5);
    assert.equal(rows[0]?.result, null);
    assert.equal(JSON.stringify(rows[0]?.provider_evidence).includes('fixture-secret'), false);
    assert.equal((await db.query("SELECT 1 FROM activity_fact_todos WHERE requester_id='p1'")).rows.length, 0);
  } finally { release?.(); await db.close(); }
});

test('disabled account cannot start a semantic provider call', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('host','ai-disabled-host'),('p1','ai-disabled-member')");
    const draft = await createDraft(db, 'host', input, 'disabled-sem-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'disabled-sem-publish');
    await register(db, 'p1', event.id, event.version, 'disabled-sem-register');
    await db.query("UPDATE users SET status='DISABLED' WHERE id='p1'");
    let calls = 0;
    await assert.rejects(() => askSemanticCurrentFact(db, 'p1', event.id, '几点开始？', 'disabled-sem', {
      estimateUpperBoundFen: () => 5, suggest: async () => { calls++; return {}; }
    }, { budgetFen: 10, environment: 'test' }), { code: 'ACCOUNT_DISABLED' });
    assert.equal(calls, 0);
    assert.equal((await db.query("SELECT 1 FROM ai_semantic_requests WHERE actor_id='p1'")).rows.length, 0);
  } finally { await db.close(); }
});

test('semantic privacy inventory and export show only owner metadata and redacted evidence', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','ai-inventory-p1'),('p2','ai-inventory-p2')");
    const draft = await createDraft(db, 'p1', { title: 'AI 清单活动' }, 'ai-inventory-draft');
    await db.query(`INSERT INTO ai_semantic_requests
      (actor_id,event_id,request_key,fallback_key,request_hash,status,budget_fen,reserved_fen,
        known_cost_fen,cost_status,provider_evidence,result)
      VALUES('p1',$1,'own-sem','own-fallback',$2,'COMPLETED',10,5,5,'KNOWN',$3::jsonb,$4::jsonb),
        ('p2',$1,'other-sem','other-fallback',$2,'COMPLETED',10,5,5,'KNOWN',$3::jsonb,$4::jsonb)`,
    [draft.id, 'a'.repeat(64), JSON.stringify([{ modelVersion: 'fixture-v1', promptHash: 'a'.repeat(64),
      usage: { inputTokens: 2, outputTokens: 2 }, receipt: { status: 'ACCEPTED', referenceHash: 'b'.repeat(64) } }]),
    JSON.stringify({ answer: '已确认公开事实', source: 'CURRENT_EVENT', eventVersion: 1 })]);
    await db.query(`INSERT INTO ai_semantic_alert_reviews
      (actor_id,request_key,alert_state,status_at_review,reserved_fen_at_review,
        known_cost_fen_at_review,reviewed_by,note)
      VALUES('p1','own-sem',$1,'COMPLETED',5,5,'operator:ai','已核对账单状态')`, ['c'.repeat(32)]);
    const owner = await exportPersonalData(db, 'p1');
    const other = await exportPersonalData(db, 'p2');
    assert.equal(owner.aiSemanticRequests.length, 1);
    assert.equal(owner.aiSemanticAlertReviews.length, 1);
    assert.equal(other.aiSemanticRequests.length, 1);
    assert.equal(other.aiSemanticAlertReviews.length, 0);
    assert.equal(JSON.stringify(owner.aiSemanticRequests).includes('other-sem'), false);
    assert.equal(JSON.stringify(owner.aiSemanticRequests).includes('fixture-secret'), false);
    const request = await deletePending(db, 'p1');
    void request;
    const impact = await getPrivacyRequestImpact(db, 'operator:privacy', 'delete-p1');
    assert.equal(impact.counts.aiSemanticRequests, 1);
    assert.equal(impact.counts.aiSemanticAlertReviews, 1);
    const dryRun = await dryRunPrivacyDeletion(db, 'delete-p1');
    assert.equal(dryRun.classifications.unneededDraftInput.aiSemanticRequests, 1);
    assert.equal(dryRun.classifications.unneededDraftInput.aiSemanticAlertReviews, 1);
  } finally { await db.close(); }
});
