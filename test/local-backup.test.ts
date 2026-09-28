import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, LATEST_SCHEMA_VERSION } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { publishApprovedInvite } from './helpers.ts';
import { register } from '../src/registrations.ts';
import { createLocalBackup, restoreLocalBackupUnprotectedSynthetic } from '../src/local-backup.ts';
import { setConsent } from '../src/notifications.ts';
import { exportPersonalData } from '../src/privacy.ts';

const input = {
  title: '恢复演练羽毛球', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
};

test('local backup restores event, registration, audit, and migration state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-backup-'));
  const source = join(root, 'source');
  const archive = join(root, 'backup.tgz');
  const restored = join(root, 'restored');
  try {
    const db = await createDatabase(source);
    const draft = await createDraft(db, 'host', input, 'backup-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'backup-publish');
    await register(db, 'p1', event.id, event.version, 'backup-join', event.inviteToken!);
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','backup-p1')");
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'backup-reminder-grant');
    await setConsent(db, 'p1', 'SIMILAR_ACTIVITY_INVITES', true, 'backup-similar-grant');
    await setConsent(db, 'p1', 'EVENT_REMINDER', false, 'backup-reminder-withdraw');
    const before = {
      events: (await db.query('SELECT id,status,version,payload FROM events ORDER BY id')).rows,
      registrations: (await db.query('SELECT event_id,user_id,status FROM registrations ORDER BY user_id')).rows,
      audit: (await db.query('SELECT action,event_id,actor_id FROM audit ORDER BY action')).rows,
      migrations: (await db.query('SELECT version,checksum FROM schema_migrations ORDER BY version')).rows,
      consents: (await db.query('SELECT user_id,purpose,granted,scope,notice_version FROM notification_consents ORDER BY user_id,purpose')).rows,
      consentHistory: (await db.query('SELECT user_id,purpose,scope,notice_version,notice_text,granted,changed_at FROM notification_consent_history ORDER BY changed_at,id')).rows
    };
    await db.close();
    const backup = await createLocalBackup(source, archive);
    assert.match(backup.sha256, /^[0-9a-f]{64}$/);
    assert.ok((await readFile(archive)).length > 0);
    await restoreLocalBackupUnprotectedSynthetic(archive, restored);
    const recovered = await createDatabase(restored);
    try {
      assert.deepEqual((await recovered.query('SELECT id,status,version,payload FROM events ORDER BY id')).rows, before.events);
      assert.deepEqual((await recovered.query('SELECT event_id,user_id,status FROM registrations ORDER BY user_id')).rows, before.registrations);
      assert.deepEqual((await recovered.query('SELECT action,event_id,actor_id FROM audit ORDER BY action')).rows, before.audit);
      assert.deepEqual((await recovered.query('SELECT version,checksum FROM schema_migrations ORDER BY version')).rows, before.migrations);
      assert.equal(before.migrations.length, LATEST_SCHEMA_VERSION);
      assert.deepEqual((await recovered.query('SELECT user_id,purpose,granted,scope,notice_version FROM notification_consents ORDER BY user_id,purpose')).rows, before.consents);
      assert.deepEqual((await recovered.query('SELECT user_id,purpose,scope,notice_version,notice_text,granted,changed_at FROM notification_consent_history ORDER BY changed_at,id')).rows, before.consentHistory);
      assert.equal((await exportPersonalData(recovered, 'p1')).notificationConsentHistory.length, 3);
    } finally { await recovered.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('backup refuses to overwrite an existing archive and restore refuses an existing directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-backup-'));
  try {
    const source = join(root, 'source');
    const archive = join(root, 'backup.tgz');
    const db = await createDatabase(source);
    await db.close();
    await writeFile(archive, 'keep this archive');
    await assert.rejects(() => createLocalBackup(source, archive), /exists|EEXIST/i);
    assert.equal((await readFile(archive, 'utf8')), 'keep this archive');
    await assert.rejects(() => restoreLocalBackupUnprotectedSynthetic(archive, source), /exists|EEXIST/i);
    const reopened = await createDatabase(source);
    await reopened.close();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('corrupted archive leaves no accepted restored database', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-backup-'));
  try {
    const archive = join(root, 'broken.tgz');
    const target = join(root, 'restored');
    await writeFile(archive, 'not a database archive');
    await assert.rejects(() => restoreLocalBackupUnprotectedSynthetic(archive, target));
    await assert.rejects(() => readFile(join(target, 'PG_VERSION')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('backup rejects an empty directory instead of initializing and archiving a new database', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-backup-'));
  try {
    const archive = join(root, 'backup.tgz');
    await assert.rejects(() => createLocalBackup(root, archive), /PGlite|PG_VERSION/i);
    await assert.rejects(() => readFile(archive));
  } finally { await rm(root, { recursive: true, force: true }); }
});
