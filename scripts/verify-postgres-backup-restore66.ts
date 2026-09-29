// Synthetic, loopback-only PostgreSQL backup/restore rehearsal. Leaves its two
// newly-created irl_r1_test_* databases for inspection; never drops a database.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION, type Database } from '../src/db.ts';
import { createDraft, getEvent, publishEvent } from '../src/events.ts';
import { reviewEvent } from '../src/event-review.ts';
import { register } from '../src/registrations.ts';
import { grantCohost } from '../src/cohosts.ts';
import { setConsent } from '../src/notifications.ts';
import { createPrivacyRequest } from '../src/operations.ts';
import { FileDeletionMarkerStore, executePrivacyDeletionWithMarker,
  replayPrivacyDeletionMarkers } from '../src/privacy-deletion-journal.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const policy = JSON.stringify({
  schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
  approved_by: 'synthetic-test-owner', approved_at: '2026-09-27T00:00:00.000Z',
  records: [...['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup']
    .map(name => ({ class: name, status: 'APPROVED', approved_days: 30,
      ...(name === 'dispute_or_required_logs' ? { approved_trigger: 'DELETE_EXECUTION' } : {}),
      legal_basis: 'Synthetic test basis only', deletion_action: 'Synthetic test action', access_roles: ['PRIVACY'] })),
    ...['voice_raw', 'photo'].map(name => ({ class: name, status: 'NOT_ENABLED' }))]
});

function run(binary: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], env });
    let errorText = '';
    child.stderr.on('data', chunk => { errorText += String(chunk); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolveRun() : reject(new Error(`${binary} exited ${code}: ${errorText}`)));
  });
}

async function snapshot(db: Database, eventId: string) {
  const get = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;
  return {
    migrations: await get('SELECT version,checksum FROM schema_migrations ORDER BY version'),
    event: await get('SELECT id,status,version,payload,review_status FROM events WHERE id=$1', [eventId]),
    registrations: await get('SELECT event_id,user_id,status,accepted_version FROM registrations WHERE event_id=$1 ORDER BY user_id', [eventId]),
    cohostGrants: await get('SELECT event_id,user_id,granted_by,capabilities,expires_at,revoked_at FROM cohost_grants WHERE event_id=$1', [eventId]),
    consents: await get("SELECT user_id,purpose,granted,scope,notice_version FROM notification_consents WHERE user_id='pg66_member' ORDER BY purpose"),
    consentHistory: await get("SELECT user_id,purpose,granted,scope,notice_version,notice_text FROM notification_consent_history WHERE user_id='pg66_member' ORDER BY changed_at,id"),
    outbox: await get("SELECT j.id,j.kind,j.status,j.payload,n.external_status,n.detail FROM jobs j JOIN notifications n ON n.id=j.payload->>'notificationId' WHERE j.id='pg66_outbox_job'"),
    audit: await get('SELECT actor_id,event_id,action,detail FROM audit WHERE event_id=$1 ORDER BY created_at,id', [eventId])
  };
}

const port = process.env.IRL_PG_TEST_PORT ?? '55432';
if (!/^\d{2,5}$/.test(port)) throw new Error('IRL_PG_TEST_PORT must be a numeric local port');
const binDir = resolve(process.env.IRL_PG_BIN_DIR ?? '.data/tools/pgsql-18.6/bin');
const base = new URL(`postgresql://127.0.0.1:${port}/postgres`);
const suffix = `${Date.now()}_${randomBytes(3).toString('hex')}`;
const sourceName = `irl_r1_test_backup66_src_${suffix}`;
const targetName = `irl_r1_test_backup66_dst_${suffix}`;
const urlFor = (name: string) => { const url = new URL(base); url.pathname = `/${name}`; return url.toString(); };
validatePostgresTestUrl(urlFor(sourceName));
validatePostgresTestUrl(urlFor(targetName));
const admin = new pg.Client({ connectionString: base.toString() });
await admin.connect();
try {
  const state = await admin.query("SELECT current_database() AS database, host(inet_server_addr()) AS server_address");
  assert.equal(state.rows[0]?.database, 'postgres');
  assert.equal(state.rows[0]?.server_address, '127.0.0.1');
  for (const name of [sourceName, targetName]) {
    assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount, 0,
      `new test database ${name} must not already exist`);
    await admin.query(`CREATE DATABASE "${name}"`);
  }
} finally { await admin.end(); }

const sourceUrl = urlFor(sourceName);
const targetUrl = urlFor(targetName);
const targetProbe = new pg.Client({ connectionString: targetUrl });
await targetProbe.connect();
try { await assertEmptyPostgresTestDatabase(targetProbe, targetName); }
finally { await targetProbe.end(); }

const work = await mkdtemp(join(tmpdir(), 'irl-pg66-restore-'));
const archive = join(work, 'before-delete.dump');
const journal = new FileDeletionMarkerStore(join(work, 'deletion-markers.jsonl'));
let source: Database | undefined;
let restored: Database | undefined;
let report: Record<string, unknown> | undefined;
try {
  source = await createProductionDatabase(sourceUrl);
  assert.equal(LATEST_SCHEMA_VERSION, 66, 'this rehearsal is scoped to schema 66');
  const start = Date.now() + 14 * 86_400_000;
  const input = {
    title: '第66版备份恢复合成活动', type: 'badminton', startAt: new Date(start).toISOString(),
    endAt: new Date(start + 7_200_000).toISOString(), timeZone: 'Asia/Shanghai', city: '深圳',
    venueName: '测试球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 6,
    registrationDeadline: new Date(start - 3_600_000).toISOString(),
    confirmationDeadline: new Date(start - 7_200_000).toISOString(),
    feeMode: 'FREE', feeCapFen: 0, cancellationRule: '开始前可退出',
    visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
  };
  await source.query("INSERT INTO users(id,wechat_openid) VALUES('pg66_member','pg66-member-openid'),('pg66_deleted','pg66-deleted-openid')");
  const draft = await createDraft(source, 'pg66_host', input, 'pg66-draft');
  const submitted = await publishEvent(source, 'pg66_host', draft.id, draft.version, 'pg66-publish');
  await reviewEvent(source, 'operator:pg66_reviewer', draft.id, submitted.version,
    'APPROVED', '合成活动文本已核对', 'pg66-review');
  const event = await getEvent(source, 'pg66_host', draft.id);
  await register(source, 'pg66_member', event.id, event.version, 'pg66-register', event.inviteToken!);
  await grantCohost(source, 'pg66_host', event.id, event.version, 'pg66_cohost',
    ['APPROVE_REGISTRATION'], new Date(start + 3_600_000).toISOString(), 'pg66-cohost');
  await setConsent(source, 'pg66_member', 'EVENT_REMINDER', true, 'pg66-consent');
  await source.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,detail)
    VALUES('pg66_outbox_notice',$1,'pg66_member','MATERIAL_CHANGE',$2,'{}'::jsonb)`, [event.id, event.version]);
  await source.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload,status)
    VALUES('pg66_outbox_job','SEND_EXTERNAL',$1,now(),$2::jsonb,'PENDING')`,
  [event.id, JSON.stringify({ notificationId: 'pg66_outbox_notice' })]);
  const privateDraft = await createDraft(source, 'pg66_deleted', { title: '恢复前私人草稿' }, 'pg66-private-draft');
  await source.query(`INSERT INTO reports(id,reporter_id,event_id,kind,description)
    VALUES('pg66_private_report','pg66_deleted',$1,'ATTENDANCE','恢复前私人举报')`, [privateDraft.id]);
  const before = await snapshot(source, event.id);
  assert.equal(before.migrations.length, 66);
  assert.ok(before.registrations.some(row => (row as { user_id: string }).user_id === 'pg66_member'));
  assert.equal(before.cohostGrants.length, 1);
  assert.equal(before.consents.length, 1);
  assert.equal(before.outbox.length, 1);
  assert.ok(before.audit.length >= 4);
  const backupStarted = Date.now();
  await run(join(binDir, 'pg_dump'), ['--format=custom', '--file', archive, '--dbname', sourceUrl], process.env);
  const backupCompleted = Date.now();
  const archiveBytes = (await stat(archive)).size;
  const archiveSha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
  // Delete after the snapshot. The journal is outside the database archive.
  const receipt = await createPrivacyRequest(source, 'pg66_deleted', { kind: 'DELETE' }, 'pg66-delete');
  await executePrivacyDeletionWithMarker(source, journal, 'operator:pg66_privacy', receipt.id, policy);
  assert.equal((await source.query("SELECT status FROM users WHERE id='pg66_deleted'")).rows[0]?.status, 'DISABLED');
  await source.close(); source = undefined;
  const recoveryStarted = Date.now();
  await run(join(binDir, 'pg_restore'), ['--no-owner', '--no-acl', '--exit-on-error', '--dbname', targetUrl, archive], process.env);
  restored = await createProductionDatabase(targetUrl);
  const recoveredBeforeReplay = await snapshot(restored, event.id);
  assert.deepEqual(recoveredBeforeReplay, before);
  assert.equal((await restored.query("SELECT status FROM users WHERE id='pg66_deleted'")).rows[0]?.status, 'ACTIVE');
  const { rows: originalPrivateDraft } = await restored.query<{ host_id: string }>(
    'SELECT host_id FROM events WHERE id=$1', [privateDraft.id]);
  assert.equal(originalPrivateDraft.length, 1);
  assert.equal(originalPrivateDraft[0]?.host_id, 'pg66_deleted');
  assert.equal(await replayPrivacyDeletionMarkers(restored, journal, policy), 1);
  assert.equal((await restored.query("SELECT status FROM users WHERE id='pg66_deleted'")).rows[0]?.status, 'DISABLED');
  assert.equal((await restored.query('SELECT request_id FROM privacy_deletion_executions WHERE request_id=$1', [receipt.id])).rows.length, 1);
  const { rows: deidentifiedPrivateDraft } = await restored.query<{ host_id: string }>(
    'SELECT host_id FROM events WHERE id=$1', [privateDraft.id]);
  assert.equal(deidentifiedPrivateDraft.length, 1);
  assert.match(deidentifiedPrivateDraft[0]!.host_id, /^deleted:[a-f0-9]{32}$/);
  assert.deepEqual(await snapshot(restored, event.id), before);
  const recoveryCompleted = Date.now();
  report = { postgresVersion: (await restored.query('SHOW server_version')).rows[0]?.server_version,
    schemaVersion: LATEST_SCHEMA_VERSION, sourceDatabase: sourceName, restoredDatabase: targetName,
    archive, archiveBytes, archiveSha256, markerJournal: join(work, 'deletion-markers.jsonl'),
    backupDurationMs: backupCompleted - backupStarted,
    restoreReplayReadbackMs: recoveryCompleted - recoveryStarted,
    snapshotRecordsMissing: 0, sampledRpoMs: null,
    sampledRpoMeaning: 'RPO cannot be measured without a fault time, backup schedule, or continuous-log position',
    restoredEventId: event.id, deletionRequestId: receipt.id,
    recoveredRegistration: true, recoveredCohostGrant: true, recoveredConsentAndHistory: true,
    recoveredPendingOutbox: true, recoveredAudit: true, deletionMarkerReplayed: true };
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (restored) await restored.close();
  if (source) await source.close();
  if (!report) console.error(JSON.stringify({ sourceDatabase: sourceName, restoredDatabase: targetName, archive,
    markerJournal: join(work, 'deletion-markers.jsonl'), note: 'failure left only synthetic test databases for inspection' }));
}
