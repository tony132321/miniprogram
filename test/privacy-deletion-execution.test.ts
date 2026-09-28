import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { createPrivacyRequest, listPrivacyRequests } from '../src/operations.ts';
import { dryRunPrivacyDeletion, executePrivacyDeletionSafeguards,
  getPrivacyDeletionDisposition } from '../src/privacy-deletion.ts';

const syntheticPolicy = JSON.stringify({
  schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
  approved_by: 'synthetic-test-owner', approved_at: '2026-09-27T00:00:00.000Z',
  records: [...['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup']
    .map(name => ({ class: name, status: 'APPROVED', approved_days: 30,
      legal_basis: 'Synthetic test basis only', deletion_action: 'Synthetic test action', access_roles: ['PRIVACY'] })),
    ...['voice_raw', 'photo'].map(name => ({ class: name, status: 'NOT_ENABLED' }))]
});

test('deletion dry run classifies personal and shared impacts without changing them', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','dry-run-openid')");
    await db.query(`INSERT INTO ai_draft_requests(actor_id,request_key,request_hash,status,budget_fen,known_cost_fen,cost_status,result)
      VALUES('p1','draft-prompt',$1,'COMPLETED',0,0,'KNOWN','{}')`, ['a'.repeat(64)]);
    const event = await createDraft(db, 'p1', { title: '共享活动事实' }, 'dry-run-draft');
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'dry-run-request');
    const plan = await dryRunPrivacyDeletion(db, receipt.id);
    assert.equal(plan.requestId, receipt.id);
    assert.equal(plan.classifications.ordinaryProfile.account, 1);
    assert.equal(plan.classifications.sharedActivity.hostedEvents, 1);
    assert.equal(plan.classifications.disputeOrRequiredLogs.privacyRequests, 1);
    assert.equal(plan.classifications.unneededDraftInput.aiDraftRequests, 1);
    assert.equal(plan.classifications.backup.status, 'EXTERNAL_INVENTORY_REQUIRED');
    assert.equal((await db.query<{ status: string }>('SELECT status FROM users WHERE id=$1', ['p1'])).rows[0]?.status, 'ACTIVE');
    assert.equal((await db.query('SELECT id FROM events WHERE id=$1', [event.id])).rows.length, 1);
  } finally { await db.close(); }
});

test('unapproved policy cannot execute even account safeguards; approved execution is idempotent and honest', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','execution-openid')");
    const event = await createDraft(db, 'p1', { title: '共享活动事实' }, 'execution-draft');
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'execution-request');
    await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES('session-token','p1',now()+interval '1 day')");
    await db.query("INSERT INTO personal_export_tickets(id,user_id,expires_at) VALUES('ticket','p1',now()+interval '1 day')");
    await assert.rejects(() => executePrivacyDeletionSafeguards(db, 'operator:privacy', receipt.id, undefined), /RETENTION_POLICY_JSON/);
    assert.equal((await db.query<{ status: string }>("SELECT status FROM users WHERE id='p1'")).rows[0]?.status, 'ACTIVE');
    const result = await executePrivacyDeletionSafeguards(db, 'operator:privacy', receipt.id, syntheticPolicy);
    assert.equal(result.outcomes.account.state, 'DISABLED');
    assert.equal(result.outcomes.sessions.state, 'DELETED');
    assert.equal(result.outcomes.personalExportTickets.state, 'DELETED');
    assert.equal(result.outcomes.sharedActivity.state, 'DEIDENTIFICATION_PENDING');
    assert.equal(result.outcomes.disputeOrRequiredLogs.state, 'ISOLATION_PENDING');
    assert.equal(result.outcomes.unneededDraftInput.state, 'ISOLATION_PENDING');
    assert.equal(result.outcomes.backup.state, 'ISOLATION_PENDING');
    assert.equal((await db.query<{ status: string }>("SELECT status FROM users WHERE id='p1'")).rows[0]?.status, 'DISABLED');
    assert.equal((await db.query("SELECT * FROM sessions WHERE user_id='p1'")).rows.length, 0);
    assert.equal((await db.query("SELECT * FROM personal_export_tickets WHERE user_id='p1'")).rows.length, 0);
    assert.equal((await db.query('SELECT id FROM events WHERE id=$1', [event.id])).rows.length, 1);
    const progress = (await listPrivacyRequests(db, 'p1')).find(item => item.id === receipt.id);
    assert.equal(progress?.status, 'SAFEGUARDS_APPLIED_PENDING_REVIEW');
    assert.match(progress?.notice ?? '', /账号已停用/);
    assert.doesNotMatch(progress?.notice ?? '', /尚未停用账号/);
    assert.deepEqual(await executePrivacyDeletionSafeguards(db, 'operator:privacy', receipt.id, syntheticPolicy), result);
    assert.equal((await db.query('SELECT request_id FROM privacy_deletion_executions WHERE request_id=$1', [receipt.id])).rows.length, 1);
    await assert.rejects(() => getPrivacyDeletionDisposition(db, 'p1', receipt.id), { code: 'FORBIDDEN' });
    const disposition = await getPrivacyDeletionDisposition(db, 'operator:privacy', receipt.id);
    assert.equal(disposition.status, 'SAFEGUARDS_APPLIED_PENDING_REVIEW');
    assert.equal(disposition.outcomes?.sharedActivity.state, 'DEIDENTIFICATION_PENDING');
    assert.doesNotMatch(JSON.stringify(disposition), /execution-openid|共享活动事实/);
  } finally { await db.close(); }
});
