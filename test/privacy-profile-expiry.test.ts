import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { createPrivacyRequest, getPrivacyRequestImpact } from '../src/operations.ts';
import { dryRunPrivacyDeletion } from '../src/privacy-deletion.ts';
import { createLocalBackup } from '../src/local-backup.ts';
import { FileDeletionMarkerStore, executePrivacyDeletionWithMarker,
  restoreLocalBackupWithPrivacyReplay } from '../src/privacy-deletion-journal.ts';
import { expireOrdinaryProfile, ordinaryProfileExpiryEligible,
  purgeExpiredOrdinaryProfiles } from '../src/privacy-profile-expiry.ts';

const policy = JSON.stringify({ schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
  approved_by: 'synthetic-test-owner', approved_at: '2026-09-27T00:00:00.000Z',
  records: [...['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup'].map(name => ({
    class: name, status: 'APPROVED', approved_days: 1,
    ...(name === 'ordinary_profile' || name === 'dispute_or_required_logs'
      ? { approved_trigger: 'DELETE_EXECUTION' } : {}),
    legal_basis: 'Synthetic test basis only', deletion_action: 'Synthetic test action', access_roles: ['PRIVACY']
  })), ...['voice_raw', 'photo'].map(name => ({ class: name, status: 'NOT_ENABLED' }))] });
const hash = createHash('sha256').update(policy).digest('hex');

test('ordinary profile expiry waits for the approved trigger and retains required evidence', async () => {
  assert.equal(ordinaryProfileExpiryEligible(policy), true);
  assert.equal(ordinaryProfileExpiryEligible(policy.replace('"approved_trigger":"DELETE_EXECUTION"',
    '"approved_trigger":"LEGACY_APPROVAL"')), false);
  const root = await mkdtemp(join(tmpdir(), 'irl-profile-expiry-'));
  const db = await createDatabase();
  const journal = new FileDeletionMarkerStore(join(root, 'markers.jsonl'));
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','profile-original-openid')");
    const event = await createDraft(db, 'p1', { title: 'profile-hosted-event' }, 'profile-event');
    await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,detail,provider_ref,external_status)
      VALUES('profile-notice',$1,'p1','EVENT_REMINDER',1,$2::jsonb,'provider-proof','PROVIDER_ACCEPTED')`,
    [event.id, JSON.stringify({ text: 'profile-private-detail' })]);
    await db.query("INSERT INTO notification_consents(user_id,purpose,granted) VALUES('p1','EVENT_REMINDER',true)");
    await db.query(`INSERT INTO notification_consent_history(id,user_id,purpose,scope,notice_version,notice_text,granted)
      VALUES('profile-history','p1','EVENT_REMINDER','event','v1','consent evidence',true)`);
    const request = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'profile-delete');
    await executePrivacyDeletionWithMarker(db, journal, 'operator:privacy', request.id, policy);
    const current = (await journal.list())[0]!;
    assert.equal((await expireOrdinaryProfile(db, 'operator:privacy', request.id, policy, current)).disposition, 'NOT_DUE');
    assert.equal((await db.query("SELECT user_id FROM notifications WHERE id='profile-notice'")).rows[0]?.user_id, 'p1');
    const older = { ...current, recordedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() };
    const applied = await expireOrdinaryProfile(db, 'operator:privacy', request.id, policy, older);
    assert.equal(applied.disposition, 'PARTIALLY_PURGED_REVIEW_PENDING');
    assert.equal(applied.counts.notificationConsentsDeleted, 1);
    assert.equal(applied.counts.notificationDetailsCleared, 1);
    assert.equal(applied.counts.notificationRecipientsTombstoned, 1);
    assert.match(applied.recipientTombstone, /^deleted:notification:[a-f0-9]{40}$/);
    assert.notEqual(applied.recipientTombstone, 'p1');
    const { rows: notices } = await db.query<{ user_id: string; detail: unknown; provider_ref: string; external_status: string }>(
      "SELECT user_id,detail,provider_ref,external_status FROM notifications WHERE id='profile-notice'");
    assert.deepEqual(notices[0], { user_id: applied.recipientTombstone, detail: {},
      provider_ref: 'provider-proof', external_status: 'PROVIDER_ACCEPTED' });
    assert.equal((await db.query("SELECT 1 FROM notification_consents WHERE user_id='p1'")).rows.length, 0);
    assert.equal((await db.query("SELECT user_id FROM notification_consent_history WHERE id='profile-history'")).rows[0]?.user_id, 'p1');
    assert.equal((await db.query("SELECT status FROM users WHERE id='p1'")).rows[0]?.status, 'DISABLED');
    assert.equal((await db.query("SELECT 1 FROM users WHERE id=$1", [applied.recipientTombstone])).rows.length, 0);
    await assert.rejects(() => db.query(
      "UPDATE notifications SET user_id='p1',detail='{" + '"text":"resurrected"' + "}'::jsonb WHERE id='profile-notice'"));
    await assert.rejects(() => db.query(
      "UPDATE notifications SET detail='{" + '"text":"resurrected"' + "}'::jsonb WHERE id='profile-notice'"));
    await assert.rejects(() => db.query(
      "INSERT INTO notification_consents(user_id,purpose,granted) VALUES('p1','EVENT_REMINDER',true)"));
    await db.query("UPDATE notifications SET provider_ref='provider-settled' WHERE id='profile-notice'");
    assert.equal((await db.query<{ provider_ref: string }>(
      "SELECT provider_ref FROM notifications WHERE id='profile-notice'")).rows[0]?.provider_ref, 'provider-settled');
    const { rows: executions } = await db.query<{ outcomes: { ordinaryProfile: { state: string };
      pendingReviews: Array<{ code: string; reason: string }> } }>('SELECT outcomes FROM privacy_deletion_executions WHERE request_id=$1', [request.id]);
    assert.equal(executions[0]?.outcomes.ordinaryProfile.state, 'PARTIALLY_PURGED_REVIEW_PENDING');
    assert.ok(executions[0]?.outcomes.pendingReviews.some(item => item.code === 'ORDINARY_PROFILE_REMAINDERS'));
    assert.match(executions[0]?.outcomes.pendingReviews.find(item => item.code === 'ORDINARY_PROFILE_PURGE')?.reason ?? '',
      /only for classified fields/);
    const impact = await getPrivacyRequestImpact(db, 'operator:privacy', request.id);
    const dryRun = await dryRunPrivacyDeletion(db, request.id);
    assert.equal(impact.counts.notifications, 0, 'existing count continues to mean rows under the original user ID');
    assert.equal(impact.ordinaryProfileDisposition?.retainedNotificationRows, 1);
    assert.equal(dryRun.ordinaryProfileDisposition?.retainedNotificationRows, 1);
    assert.equal(dryRun.ordinaryProfileDisposition?.counts.notificationRecipientsTombstoned, 1);
    assert.equal((await expireOrdinaryProfile(db, 'operator:privacy', request.id, policy, older)).disposition,
      'PARTIALLY_PURGED_REVIEW_PENDING');
    await assert.rejects(() => expireOrdinaryProfile(db, 'p1', request.id, policy, older), { code: 'FORBIDDEN' });
  } finally { await db.close(); await rm(root, { recursive: true, force: true }); }
});

test('restore replay uses the original marker clock before applying ordinary profile expiry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-profile-restore-'));
  const source = join(root, 'source'); const restored = join(root, 'restored');
  const archive = join(root, 'before-delete.tgz');
  const journal = new FileDeletionMarkerStore(join(root, 'markers.jsonl'));
  try {
    let db = await createDatabase(source);
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','restore-profile-openid')");
    const event = await createDraft(db, 'p1', { title: 'profile before restore' }, 'restore-profile-event');
    await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,detail)
      VALUES('restore-notice',$1,'p1','EVENT_REMINDER',1,$2::jsonb)`, [event.id, JSON.stringify({ text: 'restore-secret' })]);
    await db.close();
    await createLocalBackup(source, archive);
    db = await createDatabase(source);
    const request = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'restore-profile-delete');
    await executePrivacyDeletionWithMarker(db, journal, 'operator:privacy', request.id, policy);
    await journal.append({ schema: 'project-irl/deletion-marker-v1', requestId: request.id, userId: 'p1',
      policySha256: hash, recordedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() });
    await db.close();
    await restoreLocalBackupWithPrivacyReplay(archive, restored, journal, policy);
    const recovered = await createDatabase(restored);
    try {
      assert.match((await recovered.query<{ user_id: string }>(
        "SELECT user_id FROM notifications WHERE id='restore-notice'")).rows[0]?.user_id ?? '',
      /^deleted:notification:/);
      assert.equal(await purgeExpiredOrdinaryProfiles(recovered, journal, policy, 'operator:restore'), 0);
      const { rows } = await recovered.query<{ user_id: string; detail: unknown }>(
        "SELECT user_id,detail FROM notifications WHERE id='restore-notice'");
      assert.match(rows[0]?.user_id ?? '', /^deleted:notification:/);
      assert.deepEqual(rows[0]?.detail, {});
      assert.equal((await recovered.query('SELECT 1 FROM privacy_ordinary_profile_expiries WHERE request_id=$1',
        [request.id])).rows.length, 1);
    } finally { await recovered.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});
