import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { createPrivacyRequest } from '../src/operations.ts';
import { FileDeletionMarkerStore, executePrivacyDeletionWithMarker } from '../src/privacy-deletion-journal.ts';
import { isolateDisputeRecords, purgeExpiredQuarantine, readQuarantinedRecord } from '../src/privacy-quarantine.ts';

const policy = JSON.stringify({
  schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
  approved_by: 'synthetic-test-owner', approved_at: '2026-09-27T00:00:00.000Z',
  records: [...['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup']
    .map(name => ({ class: name, status: 'APPROVED', approved_days: 30,
      ...(name === 'dispute_or_required_logs' ? { approved_trigger: 'DELETE_EXECUTION' } : {}),
      legal_basis: 'Synthetic test basis only', deletion_action: 'Synthetic test action', access_roles: ['PRIVACY'] })),
    ...['voice_raw', 'photo'].map(name => ({ class: name, status: 'NOT_ENABLED' }))]
});

test('approved purpose policy isolates dispute originals and expires them without publishing raw text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-privacy-hold-'));
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','quarantine-openid')");
    const event = await createDraft(db, 'p1', { title: '活动' }, 'quarantine-event');
    await db.query(`INSERT INTO reports(id,reporter_id,event_id,kind,description,resolution)
      VALUES('report-1','p1',$1,'ATTENDANCE','private dispute evidence','private resolution')`, [event.id]);
    await db.query(`INSERT INTO appeals(id,report_id,appellant_id,description,resolution)
      VALUES('appeal-1','report-1','p1','private appeal evidence','private appeal resolution')`);
    await db.query(`INSERT INTO outcome_reviews(id,event_id,report_id,decision,reason,reviewed_by)
      VALUES('review-1',$1,'report-1','INCONCLUSIVE','private review reason','operator:reports')`, [event.id]);
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'quarantine-request');
    await executePrivacyDeletionWithMarker(db, new FileDeletionMarkerStore(join(root, 'markers.jsonl')),
      'operator:privacy', receipt.id, policy);
    const isolated = await isolateDisputeRecords(db, 'operator:privacy', receipt.id, policy);
    assert.equal(isolated.disposition, 'PARTIALLY_ISOLATED_REVIEW_PENDING');
    assert.equal(isolated.records, 3);
    assert.deepEqual(await isolateDisputeRecords(db, 'operator:privacy', receipt.id, policy), isolated);
    const original = await db.query<{ description: string; resolution: string; reporter_id: string }>(
      "SELECT description,resolution,reporter_id FROM reports WHERE id='report-1'");
    assert.doesNotMatch(JSON.stringify(original.rows), /private dispute|private resolution|"p1"/);
    assert.doesNotMatch(JSON.stringify((await db.query("SELECT * FROM appeals WHERE id='appeal-1'")).rows), /private appeal|"p1"/);
    assert.doesNotMatch(JSON.stringify((await db.query("SELECT reason FROM outcome_reviews WHERE id='review-1'")).rows), /private review/);
    await assert.rejects(() => readQuarantinedRecord(db, 'operator:reports', async () => ['REPORTS'],
      receipt.id, 'reports', 'report-1'), { code: 'FORBIDDEN' });
    const held = await readQuarantinedRecord(db, 'operator:privacy', async () => ['PRIVACY'], receipt.id, 'reports', 'report-1');
    assert.equal(held.payload.description, 'private dispute evidence');
    assert.ok(Date.parse(held.expiresAt) > Date.now());
    assert.equal((await db.query<{ status: string }>('SELECT status FROM privacy_requests WHERE id=$1', [receipt.id]))
      .rows[0]?.status, 'SAFEGUARDS_APPLIED_PENDING_REVIEW');
    await db.query('UPDATE privacy_quarantine SET expires_at=now()-interval \'1 day\' WHERE request_id=$1', [receipt.id]);
    assert.equal(await purgeExpiredQuarantine(db, 'operator:privacy'), 3);
    assert.equal((await db.query('SELECT request_id FROM privacy_quarantine WHERE request_id=$1', [receipt.id])).rows.length, 0);
  } finally { await db.close(); await rm(root, { recursive: true, force: true }); }
});

test('trigger-only retention policy cannot schedule disputed material for automated deletion', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','trigger-only-openid')");
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'trigger-request');
    const triggerPolicy = JSON.parse(policy);
    const dispute = triggerPolicy.records.find((item: { class: string }) => item.class === 'dispute_or_required_logs');
    delete dispute.approved_days;
    dispute.approved_trigger = 'After an explicit dispute end decision';
    await assert.rejects(() => isolateDisputeRecords(db, 'operator:privacy', receipt.id,
      JSON.stringify(triggerPolicy)), /approved_days|expiry/i);
    dispute.approved_days = 30;
    await assert.rejects(() => isolateDisputeRecords(db, 'operator:privacy', receipt.id,
      JSON.stringify(triggerPolicy)), /DELETE_EXECUTION/);
  } finally { await db.close(); }
});
