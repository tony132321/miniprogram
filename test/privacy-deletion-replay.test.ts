import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createDatabase, LATEST_SCHEMA_VERSION } from '../src/db.ts';
import { createLocalBackup } from '../src/local-backup.ts';
import { createPrivacyRequest } from '../src/operations.ts';
import { getPrivacyDeletionDisposition } from '../src/privacy-deletion.ts';
import { setConsent } from '../src/notifications.ts';
import { register } from '../src/registrations.ts';
import { FileDeletionMarkerStore, executePrivacyDeletionWithMarker,
  replayPrivacyDeletionMarkers, restoreLocalBackupWithPrivacyReplay } from '../src/privacy-deletion-journal.ts';
import { publishApprovedInvite } from './helpers.ts';

const policy = JSON.stringify({
  schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
  approved_by: 'synthetic-test-owner', approved_at: '2026-09-27T00:00:00.000Z',
  records: [...['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup']
    .map(name => ({ class: name, status: 'APPROVED', approved_days: 30,
      ...(name === 'dispute_or_required_logs' ? { approved_trigger: 'DELETE_EXECUTION' } : {}),
      legal_basis: 'Synthetic test basis only', deletion_action: 'Synthetic test action', access_roles: ['PRIVACY'] })),
    ...['voice_raw', 'photo'].map(name => ({ class: name, status: 'NOT_ENABLED' }))]
});

test('an external deletion marker prevents an old backup from reviving an account', async t => {
  const root = await mkdtemp(join(tmpdir(), 'irl-deletion-replay-'));
  const source = join(root, 'live');
  const archive = join(root, 'before-delete.tgz');
  const restored = join(root, 'restored');
  const journal = new FileDeletionMarkerStore(join(root, 'markers.jsonl'));
  try {
    let db = await createDatabase(source);
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','replay-openid')");
    const { createDraft } = await import('../src/events.ts');
    const event = await createDraft(db, 'p1', { title: 'private title before backup' }, 'replay-draft');
    await db.query(`INSERT INTO reports(id,reporter_id,event_id,kind,description)
      VALUES('replay-report','p1',$1,'ATTENDANCE','private report before backup')`, [event.id]);
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('backup-member','backup-member-openid')");
    const memberDraft = await createDraft(db, 'backup-host', {
      title: '恢复后保留的合成活动', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
      endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
      venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
      maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
      confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
      cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
    }, 'replay-member-draft');
    const memberEvent = await publishApprovedInvite(db, 'backup-host', memberDraft.id,
      memberDraft.version, 'replay-member-publish');
    await register(db, 'backup-member', memberEvent.id, memberEvent.version,
      'replay-member-register', memberEvent.inviteToken!);
    await setConsent(db, 'backup-member', 'EVENT_REMINDER', true, 'replay-member-consent');
    await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,detail)
      VALUES('replay-outbox-notice',$1,'backup-member','MATERIAL_CHANGE',$2,'{}'::jsonb)`,
    [memberEvent.id, memberEvent.version]);
    await db.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload,status)
      VALUES('replay-outbox-job','SEND_EXTERNAL',$1,now(),$2::jsonb,'PENDING')`,
    [memberEvent.id, JSON.stringify({ notificationId: 'replay-outbox-notice' })]);
    const preservedBefore = {
      registration: (await db.query(`SELECT event_id,user_id,status,accepted_version FROM registrations
        WHERE event_id=$1 AND user_id='backup-member'`, [memberEvent.id])).rows,
      consent: (await db.query(`SELECT user_id,purpose,granted,scope,notice_version FROM notification_consents
        WHERE user_id='backup-member'`)).rows,
      outbox: (await db.query(`SELECT j.id,j.kind,j.status,j.payload,n.external_status
        FROM jobs j JOIN notifications n ON n.id=j.payload->>'notificationId'
        WHERE j.id='replay-outbox-job'`)).rows
    };
    assert.equal(preservedBefore.registration.length, 1);
    assert.equal(preservedBefore.consent.length, 1);
    assert.equal(preservedBefore.outbox.length, 1);
    await db.close();
    await createLocalBackup(source, archive);
    db = await createDatabase(source);
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'delete-after-backup');
    const executed = await executePrivacyDeletionWithMarker(db, journal, 'operator:privacy', receipt.id, policy);
    const markerBeforePolicyRetry = await readFile(join(root, 'markers.jsonl'), 'utf8');
    const otherPolicy = JSON.parse(policy) as { approved_by: string };
    otherPolicy.approved_by = 'another-synthetic-owner';
    await assert.rejects(() => executePrivacyDeletionWithMarker(db, journal, 'operator:privacy',
      receipt.id, JSON.stringify(otherPolicy)), { code: 'POLICY_MISMATCH' });
    assert.equal(await readFile(join(root, 'markers.jsonl'), 'utf8'), markerBeforePolicyRetry);
    const disposition = await getPrivacyDeletionDisposition(db, 'operator:privacy', receipt.id);
    assert.deepEqual(executed.outcomes, disposition.outcomes);
    assert.equal(disposition.status, 'SAFEGUARDS_APPLIED_PENDING_REVIEW');
    assert.equal(disposition.outcomes?.sharedActivity.state, 'DEIDENTIFIED_REVIEW_PENDING');
    assert.equal(disposition.outcomes?.disputeOrRequiredLogs.state, 'PARTIALLY_ISOLATED_REVIEW_PENDING');
    assert.ok(disposition.outcomes?.pendingReviews.some(item => item.code === 'DISPUTE_RELATED_COPIES'));
    assert.ok(disposition.outcomes?.pendingReviews.some(item => item.code === 'NOTIFICATION_DETAIL'));
    const originalExpiry = (await db.query<{ expires_at: Date }>(`SELECT expires_at FROM privacy_quarantine
      WHERE request_id=$1 AND source_table='reports' AND source_id='replay-report'`, [receipt.id])).rows[0]!.expires_at;
    await journal.append({ schema: 'project-irl/deletion-marker-v1', requestId: receipt.id, userId: 'p1',
      policySha256: createHash('sha256').update(policy).digest('hex'),
      recordedAt: new Date(Date.now() + 86_400_000).toISOString() });
    assert.notEqual((await db.query<{ host_id: string }>('SELECT host_id FROM events WHERE id=$1', [event.id]))
      .rows[0]?.host_id, 'p1');
    await db.close();

    const recoveryStartedAt = Date.now();
    await restoreLocalBackupWithPrivacyReplay(archive, restored, journal, policy);
    const recovered = await createDatabase(restored);
    try {
      assert.equal((await recovered.query<{ status: string }>("SELECT status FROM users WHERE id='p1'"))
        .rows[0]?.status, 'DISABLED');
      assert.equal((await recovered.query("SELECT id FROM privacy_requests WHERE user_id='p1' AND kind='DELETE'"))
        .rows.length, 1);
      assert.equal((await recovered.query('SELECT request_id FROM privacy_deletion_executions WHERE request_id=$1', [receipt.id]))
        .rows.length, 1);
      assert.notEqual((await recovered.query<{ host_id: string }>('SELECT host_id FROM events WHERE id=$1', [event.id]))
        .rows[0]?.host_id, 'p1');
      assert.equal((await recovered.query('SELECT request_id FROM privacy_shared_deidentifications WHERE request_id=$1', [receipt.id]))
        .rows.length, 1);
      assert.deepEqual((await recovered.query(`SELECT event_id,user_id,status,accepted_version FROM registrations
        WHERE event_id=$1 AND user_id='backup-member'`, [memberEvent.id])).rows, preservedBefore.registration);
      assert.deepEqual((await recovered.query(`SELECT user_id,purpose,granted,scope,notice_version FROM notification_consents
        WHERE user_id='backup-member'`)).rows, preservedBefore.consent);
      assert.deepEqual((await recovered.query(`SELECT j.id,j.kind,j.status,j.payload,n.external_status
        FROM jobs j JOIN notifications n ON n.id=j.payload->>'notificationId'
        WHERE j.id='replay-outbox-job'`)).rows, preservedBefore.outbox);
      const restoredExpiry = (await recovered.query<{ expires_at: Date }>(`SELECT expires_at FROM privacy_quarantine
        WHERE request_id=$1 AND source_table='reports' AND source_id='replay-report'`, [receipt.id])).rows[0]!.expires_at;
      assert.ok(Math.abs(new Date(restoredExpiry).getTime() - new Date(originalExpiry).getTime()) < 5_000,
        'duplicate marker must not extend retention after backup restore');
      t.diagnostic(JSON.stringify({ schemaVersion: LATEST_SCHEMA_VERSION,
        localRestoreMarkerReplayAndReadbackMs: Date.now() - recoveryStartedAt,
        deletionMarkerReplayed: true, restoredAccountDisabled: true,
        preservedOtherMemberRegistrationConsentAndOutbox: true }));
    } finally { await recovered.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('replay fails closed if the marker source or matching approved policy is unavailable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-deletion-replay-'));
  try {
    const db = await createDatabase(join(root, 'source'));
    await db.close();
    await createLocalBackup(join(root, 'source'), join(root, 'backup.tgz'));
    await assert.rejects(() => restoreLocalBackupWithPrivacyReplay(join(root, 'backup.tgz'),
      join(root, 'restored'), new FileDeletionMarkerStore(join(root, 'missing.jsonl')), policy), /marker|journal/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('invalid actor or unprotected request cannot create a durable deletion marker', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-deletion-marker-denial-'));
  const journalPath = join(root, 'markers.jsonl');
  const journal = new FileDeletionMarkerStore(journalPath);
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','denial-openid')");
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'denial-request');
    await assert.rejects(() => executePrivacyDeletionWithMarker(db, journal, 'p1', receipt.id, policy),
      { code: 'FORBIDDEN' });
    await assert.rejects(() => stat(journalPath), { code: 'ENOENT' });
    await db.query('UPDATE privacy_requests SET protection_applied_at=NULL WHERE id=$1', [receipt.id]);
    await assert.rejects(() => executePrivacyDeletionWithMarker(db, journal,
      'operator:privacy', receipt.id, policy), { code: 'DELETE_NOT_PROTECTED' });
    await assert.rejects(() => stat(journalPath), { code: 'ENOENT' });
  } finally { await db.close(); await rm(root, { recursive: true, force: true }); }
});

test('fsynced marker survives failed safeguards and restart replay completes irrevocable intent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-deletion-fault-'));
  const journal = new FileDeletionMarkerStore(join(root, 'markers.jsonl'));
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','fault-openid')");
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'fault-request');
    await db.query(`CREATE FUNCTION synthetic_block_disable() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.status='DISABLED' THEN RAISE EXCEPTION 'synthetic safeguard failure'; END IF;
      RETURN NEW; END; $$`);
    await db.query(`CREATE TRIGGER synthetic_block_disable BEFORE UPDATE OF status ON users
      FOR EACH ROW EXECUTE FUNCTION synthetic_block_disable()`);
    await assert.rejects(() => executePrivacyDeletionWithMarker(db, journal, 'operator:privacy',
      receipt.id, policy), /synthetic safeguard failure/);
    assert.match(await readFile(join(root, 'markers.jsonl'), 'utf8'), /deletion-marker-v1/);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM privacy_requests WHERE id=$1', [receipt.id]))
      .rows[0]?.status, 'EXECUTION_INTENT_RECORDED');
    assert.equal((await db.query<{ status: string }>("SELECT status FROM users WHERE id='p1'"))
      .rows[0]?.status, 'ACTIVE');
    await assert.rejects(() => db.query("UPDATE privacy_requests SET status='CANCELLED' WHERE id=$1", [receipt.id]),
      /durable deletion execution intent/);
    await db.query('DROP TRIGGER synthetic_block_disable ON users');
    await db.query('DROP FUNCTION synthetic_block_disable()');
    assert.equal(await replayPrivacyDeletionMarkers(db, journal, policy), 1);
    assert.equal((await db.query<{ status: string }>("SELECT status FROM users WHERE id='p1'"))
      .rows[0]?.status, 'DISABLED');
  } finally { await db.close(); await rm(root, { recursive: true, force: true }); }
});

test('marker fsync followed by transaction rollback is still replayed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-deletion-append-fault-'));
  const path = join(root, 'markers.jsonl');
  class FailsAfterFsync extends FileDeletionMarkerStore {
    override async append(marker: Parameters<FileDeletionMarkerStore['append']>[0]): Promise<void> {
      await super.append(marker);
      throw new Error('synthetic failure after fsync');
    }
  }
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','append-fault-openid')");
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'append-fault-request');
    await assert.rejects(() => executePrivacyDeletionWithMarker(db, new FailsAfterFsync(path),
      'operator:privacy', receipt.id, policy), /synthetic failure after fsync/);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM privacy_requests WHERE id=$1', [receipt.id]))
      .rows[0]?.status, 'PROTECTED_PENDING_POLICY');
    assert.match(await readFile(path, 'utf8'), /deletion-marker-v1/);
    await db.query("UPDATE privacy_requests SET status='CANCELLED' WHERE id=$1", [receipt.id]);
    assert.equal(await replayPrivacyDeletionMarkers(db, new FileDeletionMarkerStore(path), policy), 1);
    assert.equal((await db.query<{ status: string }>("SELECT status FROM users WHERE id='p1'"))
      .rows[0]?.status, 'DISABLED');
  } finally { await db.close(); await rm(root, { recursive: true, force: true }); }
});

test('a valid marker also recovers a fulfilled pre-intent request after fsync rollback', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-deletion-fulfilled-rollback-'));
  const path = join(root, 'markers.jsonl');
  class FailsAfterFsync extends FileDeletionMarkerStore {
    override async append(marker: Parameters<FileDeletionMarkerStore['append']>[0]): Promise<void> {
      await super.append(marker);
      throw new Error('synthetic failure after fsync');
    }
  }
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','fulfilled-fault-openid')");
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'fulfilled-fault-request');
    await assert.rejects(() => executePrivacyDeletionWithMarker(db, new FailsAfterFsync(path),
      'operator:privacy', receipt.id, policy), /synthetic failure after fsync/);
    await db.query("UPDATE privacy_requests SET status='FULFILLED' WHERE id=$1", [receipt.id]);
    assert.equal(await replayPrivacyDeletionMarkers(db, new FileDeletionMarkerStore(path), policy), 1);
    assert.equal((await db.query<{ status: string }>("SELECT status FROM users WHERE id='p1'"))
      .rows[0]?.status, 'DISABLED');
    assert.equal((await db.query<{ status: string }>('SELECT status FROM privacy_requests WHERE id=$1', [receipt.id]))
      .rows[0]?.status, 'SAFEGUARDS_APPLIED_PENDING_REVIEW');
  } finally { await db.close(); await rm(root, { recursive: true, force: true }); }
});
