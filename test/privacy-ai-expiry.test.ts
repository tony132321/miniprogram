import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { createPrivacyRequest } from '../src/operations.ts';
import { executePrivacyDeletionSafeguards } from '../src/privacy-deletion.ts';
import { FileDeletionMarkerStore, executePrivacyDeletionWithMarker,
  replayPrivacyDeletionMarkers } from '../src/privacy-deletion-journal.ts';
import { purgeExpiredAiInput, scheduleAiInputCleanup } from '../src/privacy-ai-expiry.ts';

function policy(trigger = 'DELETE_EXECUTION') {
  return JSON.stringify({ schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
    approved_by: 'synthetic-test-owner', approved_at: '2026-09-27T00:00:00.000Z', records: [
      ...['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup'].map(name => ({
        class: name, status: 'APPROVED', approved_days: 30,
        ...(name === 'unneeded_draft_input' ? { approved_trigger: trigger } : {}),
        ...(name === 'dispute_or_required_logs' ? { approved_trigger: 'DELETE_EXECUTION' } : {}),
        legal_basis: 'Synthetic test basis only', deletion_action: 'Synthetic test action', access_roles: ['PRIVACY']
      })), ...['voice_raw', 'photo'].map(name => ({ class: name, status: 'NOT_ENABLED' }))] });
}

test('approved expiry removes AI content while preserving cost reservations and uncertain status', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','private-openid')");
    const event = await createDraft(db, 'p1', { title: 'private event' }, 'ai-cleanup-draft');
    const evidence = [{ attempt: 1, modelVersion: 'safe-model', promptHash: 'a'.repeat(64),
      usage: { inputTokens: 9, outputTokens: 4 }, receipt: { status: 'UNKNOWN', referenceHash: 'b'.repeat(64) }, costFen: 2 }];
    await db.query(`INSERT INTO ai_draft_requests
      (actor_id,request_key,request_hash,status,budget_fen,reserved_fen,known_cost_fen,cost_status,result,event_id)
      VALUES('p1','draft-key',$1,'COMPLETED',10,10,2,'LOWER_BOUND',$2::jsonb,$3)`,
    ['c'.repeat(64), JSON.stringify({ fields: { title: 'private suggestion' }, fallbackReason: 'TIMEOUT', providerEvidence: evidence }), event.id]);
    await db.query(`INSERT INTO ai_semantic_requests
      (actor_id,event_id,request_key,fallback_key,request_hash,status,budget_fen,reserved_fen,known_cost_fen,
        cost_status,provider_evidence,result)
      VALUES('p1',$1,'semantic-key',$2,$3,'COMPLETED',7,7,1,'UNKNOWN',$4::jsonb,$5::jsonb)`,
    [event.id, randomUUID(), 'd'.repeat(64), JSON.stringify(evidence), JSON.stringify({ answer: 'private answer' })]);
    const proposalId = randomUUID();
    await db.query(`INSERT INTO ai_action_proposals
      (id,actor_id,event_id,kind,expected_version,payload,payload_hash,status,expires_at)
      VALUES($1,'p1',$2,'SAVE_DRAFT',1,$3::jsonb,$4,'APPROVED',now()+interval '1 day')`,
    [proposalId, event.id, JSON.stringify({ title: 'private proposal' }), 'e'.repeat(64)]);
    await db.query(`INSERT INTO ai_draft_alert_reviews
      (actor_id,request_key,alert_state,status_at_review,cost_status_at_review,reserved_fen_at_review,
        known_cost_fen_at_review,reviewed_by,note)
      VALUES('p1','draft-key',$1,'COMPLETED','LOWER_BOUND',10,2,'operator:review','private draft note')`, ['a'.repeat(32)]);
    await db.query(`INSERT INTO ai_semantic_alert_reviews
      (actor_id,request_key,alert_state,status_at_review,cost_status_at_review,reserved_fen_at_review,
        known_cost_fen_at_review,reviewed_by,note)
      VALUES('p1','semantic-key',$1,'COMPLETED','UNKNOWN',7,1,'operator:review','private semantic note')`, ['b'.repeat(32)]);
    const request = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'ai-cleanup-delete');
    await executePrivacyDeletionSafeguards(db, 'operator:privacy', request.id, policy());
    const executionAt = '2026-09-01T00:00:00.000Z';
    const scheduled = await scheduleAiInputCleanup(db, 'operator:privacy', request.id, policy(), executionAt);
    assert.equal(scheduled.expiresAt, '2026-10-01T00:00:00.000Z');
    assert.equal(await purgeExpiredAiInput(db, 'operator:jobs', new Date('2026-09-30T23:59:59.000Z')), 0);
    const before = await db.query<{ used: number }>(`SELECT (
      (SELECT SUM(CASE WHEN status='COMPLETED' AND cost_status='KNOWN' THEN known_cost_fen ELSE reserved_fen END)
       FROM ai_draft_requests WHERE event_id=$1) +
      (SELECT SUM(CASE WHEN status='COMPLETED' AND cost_status='KNOWN' THEN known_cost_fen ELSE reserved_fen END)
       FROM ai_semantic_requests WHERE event_id=$1))::int AS used`, [event.id]);
    assert.equal(before.rows[0]?.used, 17);

    assert.equal(await purgeExpiredAiInput(db, 'operator:jobs', new Date('2026-10-01T00:00:00.000Z')), 1);
    const after = await db.query<{ used: number }>(`SELECT (
      (SELECT SUM(CASE WHEN status='COMPLETED' AND cost_status='KNOWN' THEN known_cost_fen ELSE reserved_fen END)
       FROM ai_draft_requests WHERE event_id=$1) +
      (SELECT SUM(CASE WHEN status='COMPLETED' AND cost_status='KNOWN' THEN known_cost_fen ELSE reserved_fen END)
       FROM ai_semantic_requests WHERE event_id=$1))::int AS used`, [event.id]);
    assert.equal(after.rows[0]?.used, 17);
    const rows = await db.query<{ draft_result: unknown; semantic_result: unknown; provider_evidence: unknown;
      draft_cost: string; semantic_cost: string; proposal_payload: unknown; proposal_status: string;
      draft_note: string; semantic_note: string }>(`SELECT
      (SELECT result FROM ai_draft_requests WHERE actor_id='p1') AS draft_result,
      (SELECT result FROM ai_semantic_requests WHERE actor_id='p1') AS semantic_result,
      (SELECT provider_evidence FROM ai_semantic_requests WHERE actor_id='p1') AS provider_evidence,
      (SELECT cost_status FROM ai_draft_requests WHERE actor_id='p1') AS draft_cost,
      (SELECT cost_status FROM ai_semantic_requests WHERE actor_id='p1') AS semantic_cost,
      (SELECT payload FROM ai_action_proposals WHERE actor_id='p1') AS proposal_payload,
      (SELECT status FROM ai_action_proposals WHERE actor_id='p1') AS proposal_status,
      (SELECT note FROM ai_draft_alert_reviews WHERE actor_id='p1') AS draft_note,
      (SELECT note FROM ai_semantic_alert_reviews WHERE actor_id='p1') AS semantic_note`);
    const state = rows.rows[0]!;
    assert.doesNotMatch(JSON.stringify(state), /private suggestion|private answer|private proposal|private draft note|private semantic note/);
    assert.equal(state.draft_cost, 'LOWER_BOUND');
    assert.equal(state.semantic_cost, 'UNKNOWN');
    assert.equal(state.proposal_status, 'REVOKED');
    assert.deepEqual(state.provider_evidence, evidence);
    assert.equal(await purgeExpiredAiInput(db, 'operator:jobs', new Date('2026-10-02T00:00:00.000Z')), 0);
    const receipt = await db.query<{ outcomes: { pendingReviews: Array<{ code: string }> } }>(
      'SELECT outcomes FROM privacy_deletion_executions WHERE request_id=$1', [request.id]);
    assert.equal(receipt.rows[0]?.outcomes.pendingReviews.some(x => x.code === 'UNNEEDED_DRAFT_INPUT'), false);
    assert.equal(receipt.rows[0]?.outcomes.pendingReviews.some(x => x.code === 'AI_SEMANTIC_INPUT'), false);
    assert.equal(receipt.rows[0]?.outcomes.pendingReviews.some(x => x.code === 'AI_COST_PROVENANCE'), true);
    await assert.rejects(() => db.query(`INSERT INTO ai_draft_requests
      (actor_id,request_key,request_hash,status,budget_fen,reserved_fen)
      VALUES('p1','late-key',$1,'STARTED',1,1)`, ['f'.repeat(64)]),
    /AI personal content is closed/);
    await assert.rejects(() => db.query(`UPDATE ai_semantic_requests SET result=$2::jsonb
      WHERE actor_id=$1`, ['p1', JSON.stringify({ answer: 'late private answer' })]),
    /AI personal content is closed/);
    await db.query(`UPDATE ai_semantic_requests SET known_cost_fen=3 WHERE actor_id='p1'`);
    const reconciled = await db.query<{ known_cost_fen: number; cost_status: string }>(
      "SELECT known_cost_fen,cost_status FROM ai_semantic_requests WHERE actor_id='p1'");
    assert.equal(reconciled.rows[0]?.known_cost_fen, 3);
    assert.equal(reconciled.rows[0]?.cost_status, 'UNKNOWN');
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p2','another-private-openid')");
    await db.query(`INSERT INTO ai_draft_requests
      (actor_id,request_key,request_hash,status,budget_fen,reserved_fen,known_cost_fen,cost_status,result)
      VALUES('p2','second-key',$1,'COMPLETED',0,0,0,'KNOWN',$2::jsonb)`,
    ['f'.repeat(64), JSON.stringify({ fields: { title: 'second private suggestion' } })]);
    const secondRequest = await createPrivacyRequest(db, 'p2', { kind: 'DELETE' }, 'ai-cleanup-second-delete');
    await executePrivacyDeletionSafeguards(db, 'operator:privacy', secondRequest.id, policy());
    await scheduleAiInputCleanup(db, 'operator:privacy', secondRequest.id, policy(), '2026-09-02T00:00:00.000Z');
    assert.equal(await purgeExpiredAiInput(db, 'operator:jobs', new Date('2026-10-03T00:00:00.000Z')), 1,
      'an already cleaned earlier schedule must not starve a later one');
    const second = await db.query<{ result: unknown }>(
      "SELECT result FROM ai_draft_requests WHERE actor_id='p2' AND request_key='second-key'");
    assert.doesNotMatch(JSON.stringify(second.rows[0]?.result), /second private suggestion/);
  } finally { await db.close(); }
});

test('deletion journal and replay restore the approved AI expiry plan before scheduled cleanup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-ai-expiry-journal-'));
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p3','p3-private-openid')");
    await db.query(`INSERT INTO ai_draft_requests
      (actor_id,request_key,request_hash,status,budget_fen,reserved_fen,known_cost_fen,cost_status,result)
      VALUES('p3','journal-key',$1,'COMPLETED',0,0,0,'KNOWN',$2::jsonb)`,
    ['b'.repeat(64), JSON.stringify({ fields: { title: 'journal private suggestion' } })]);
    const request = await createPrivacyRequest(db, 'p3', { kind: 'DELETE' }, 'ai-journal-delete');
    const markerStore = new FileDeletionMarkerStore(join(root, 'markers.jsonl'));
    await executePrivacyDeletionWithMarker(db, markerStore, 'operator:privacy', request.id, policy());
    const { rows: initial } = await db.query<{ expires_at: Date }>(
      'SELECT expires_at FROM privacy_ai_input_expiry WHERE request_id=$1', [request.id]);
    assert.equal(initial.length, 1);
    await db.query('DELETE FROM privacy_ai_input_expiry WHERE request_id=$1', [request.id]);
    assert.equal(await replayPrivacyDeletionMarkers(db, markerStore, policy()), 1);
    const { rows: restored } = await db.query<{ expires_at: Date }>(
      'SELECT expires_at FROM privacy_ai_input_expiry WHERE request_id=$1', [request.id]);
    assert.equal(new Date(restored[0]!.expires_at).toISOString(), new Date(initial[0]!.expires_at).toISOString());
    assert.equal(await purgeExpiredAiInput(db, 'operator:jobs', new Date(Date.now() + 31 * 86_400_000)), 1);
    const { rows: redacted } = await db.query<{ result: unknown }>(
      "SELECT result FROM ai_draft_requests WHERE actor_id='p3'");
    assert.doesNotMatch(JSON.stringify(redacted[0]?.result), /journal private suggestion/);
  } finally { await db.close(); await rm(root, { recursive: true, force: true }); }
});

test('AI expiry refuses unsupported trigger or mismatched execution policy before scheduling', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','private-openid')");
    const request = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'invalid-ai-cleanup-delete');
    await executePrivacyDeletionSafeguards(db, 'operator:privacy', request.id, policy());
    await assert.rejects(() => scheduleAiInputCleanup(db, 'operator:privacy', request.id, policy('ACCOUNT_CREATION')),
      /DELETE_EXECUTION/);
    const wrong = policy().replace('Synthetic test action', 'Another approved action');
    assert.notEqual(createHash('sha256').update(wrong).digest('hex'), createHash('sha256').update(policy()).digest('hex'));
    await assert.rejects(() => scheduleAiInputCleanup(db, 'operator:privacy', request.id, wrong),
      (error: unknown) => (error as { code?: string }).code === 'POLICY_MISMATCH');
  } finally { await db.close(); }
});
