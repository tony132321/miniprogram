import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { PGlite } from '@electric-sql/pglite';
import { createDatabase, LATEST_SCHEMA_VERSION } from '../src/db.ts';
import { getPilotMetrics } from '../src/metrics.ts';
import { changeReportStatus, listReportResponseAlerts } from '../src/operations.ts';

test('content creation time uses the insert clock across a later review boundary after upgrade', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-content-clock-upgrade-'));
  try {
    const old = await createDatabase(directory);
    try {
      await old.query('ALTER TABLE activity_content ALTER COLUMN created_at SET DEFAULT now()');
      await old.query('DELETE FROM schema_migrations WHERE version=70');
    } finally { await old.close(); }

    const upgraded = await createDatabase(directory);
    try {
      await upgraded.query("INSERT INTO events(id,host_id,status,version,payload) VALUES('content-clock','host','RECRUITING',2,'{}')");
      const { began, boundary, inserted } = await upgraded.transaction(async tx => {
        const began = (await tx.query<{ at: Date }>('SELECT transaction_timestamp() AS at')).rows[0]!.at;
        await delay(25);
        const boundary = (await tx.query<{ at: Date }>('SELECT clock_timestamp() AS at')).rows[0]!.at;
        await delay(25);
        const { rows } = await tx.query<{ created_at: Date }>(`INSERT INTO activity_content
          (id,event_id,author_id,kind,body,event_version)
          VALUES('content-clock-row','content-clock','host','QUESTION','跨边界内容',2)
          RETURNING created_at`);
        return { began, boundary, inserted: rows[0]!.created_at };
      });
      assert.ok(new Date(boundary).getTime() > new Date(began).getTime());
      assert.ok(new Date(inserted).getTime() > new Date(boundary).getTime(),
        'a transaction started before a review boundary must not backdate a later content insert');
      assert.equal((await upgraded.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations'))
        .rows[0]?.version, LATEST_SCHEMA_VERSION);
    } finally { await upgraded.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('notification provider acceptance migration does not backfill old responses', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-provider-events-upgrade-'));
  try {
    const old = await createDatabase(directory);
    try {
      await old.query('DROP TRIGGER notifications_provider_accepted_business_event ON notifications');
      await old.query('DROP FUNCTION record_notification_provider_accepted_business_event()');
      await old.query('DROP TABLE notification_provider_accepted_event_keys');
      await old.query('DELETE FROM schema_migrations WHERE version=69');
      await old.query(`INSERT INTO events(id,host_id,status,version,payload,is_test)
        VALUES('analytics-upgrade','host','CONFIRMED',3,'{}',false)`);
      await old.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version)
        VALUES('legacy-provider-notice','analytics-upgrade','old-recipient','EVENT_REMINDER',2)`);
      await old.query("UPDATE notifications SET external_status='DISPATCHING' WHERE id='legacy-provider-notice'");
      await old.query(`UPDATE notifications SET external_status='PROVIDER_ACCEPTED',
        provider_ref='legacy-private-ref',provider_responded_at=clock_timestamp()
        WHERE id='legacy-provider-notice'`);
      assert.equal((await old.query("SELECT 1 FROM business_events WHERE event_name='NOTIFICATION_PROVIDER_ACCEPTED'"))
        .rows.length, 0);
    } finally { await old.close(); }

    const upgraded = await createDatabase(directory);
    try {
      assert.equal((await upgraded.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations'))
        .rows[0]?.version, LATEST_SCHEMA_VERSION);
      assert.equal((await upgraded.query("SELECT 1 FROM business_events WHERE event_name='NOTIFICATION_PROVIDER_ACCEPTED'"))
        .rows.length, 0, 'migration must not invent a historical recipient or response time');
      await upgraded.query(`UPDATE notifications SET external_status='UNKNOWN_REQUIRES_RECONCILIATION'
        WHERE id='legacy-provider-notice'`);
      await upgraded.query(`UPDATE notifications SET external_status='PROVIDER_ACCEPTED'
        WHERE id='legacy-provider-notice'`);
      assert.equal((await upgraded.query("SELECT 1 FROM business_events WHERE event_name='NOTIFICATION_PROVIDER_ACCEPTED'"))
        .rows.length, 0, 'a status-only toggle must not reuse an old provider response as a new success');
      await upgraded.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version)
        VALUES('new-provider-notice','analytics-upgrade','new-recipient','EVENT_REMINDER',2)`);
      await upgraded.query("UPDATE notifications SET external_status='DISPATCHING' WHERE id='new-provider-notice'");
      await upgraded.query(`UPDATE notifications SET external_status='PROVIDER_ACCEPTED',
        provider_ref='new-private-ref',provider_responded_at=clock_timestamp()
        WHERE id='new-provider-notice'`);
      const { rows } = await upgraded.query<{ event_name: string; version: number; source: string;
        is_test: boolean; user_id_pseudonymous: string }>(
        "SELECT event_name,version,source,is_test,user_id_pseudonymous FROM business_events WHERE activity_id='analytics-upgrade'");
      assert.equal(rows.length, 1);
      assert.deepEqual({ event_name: rows[0]?.event_name, version: rows[0]?.version,
        source: rows[0]?.source, is_test: rows[0]?.is_test },
      { event_name: 'NOTIFICATION_PROVIDER_ACCEPTED', version: 2, source: 'JOB', is_test: false });
      assert.match(rows[0]!.user_id_pseudonymous, /^[a-f0-9]{64}$/);
      assert.equal(JSON.stringify(rows).includes('new-recipient'), false);
      assert.equal(JSON.stringify(rows).includes('new-private-ref'), false);
    } finally { await upgraded.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('draft event migration preserves old audit history and records only new success actions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-draft-events-upgrade-'));
  try {
    const old = await createDatabase(directory);
    try {
      await old.query('DROP TRIGGER audit_draft_business_event ON audit');
      await old.query('DROP FUNCTION record_draft_business_event()');
      await old.query('DELETE FROM schema_migrations WHERE version=68');
      await old.query("INSERT INTO events(id,host_id,status,version,payload,is_test) VALUES('draft-upgrade','owner','DRAFT',2,'{}',true)");
      await old.query(`INSERT INTO audit(id,actor_id,event_id,action)
        VALUES('old-draft-audit','owner','draft-upgrade','CREATE_DRAFT')`);
      assert.equal((await old.query("SELECT 1 FROM business_events WHERE activity_id='draft-upgrade'")).rows.length, 0);
    } finally { await old.close(); }

    const upgraded = await createDatabase(directory);
    try {
      assert.equal((await upgraded.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations'))
        .rows[0]?.version, LATEST_SCHEMA_VERSION);
      assert.equal((await upgraded.query("SELECT 1 FROM business_events WHERE event_uuid='old-draft-audit'"))
        .rows.length, 0);
      await upgraded.query(`INSERT INTO audit(id,actor_id,event_id,action)
        VALUES('new-draft-audit','owner','draft-upgrade','UPDATE_DRAFT')`);
      const { rows } = await upgraded.query<{ event_uuid: string; event_name: string; version: number; is_test: boolean }>(
        "SELECT event_uuid,event_name,version,is_test FROM business_events WHERE activity_id='draft-upgrade'");
      assert.deepEqual(rows, [{ event_uuid: 'new-draft-audit', event_name: 'DRAFT_UPDATED', version: 2, is_test: true }]);
    } finally { await upgraded.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('legacy in-review reports keep first response unknown through upgrade and closure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-report-response-upgrade-'));
  try {
    const old = await PGlite.create(directory);
    try {
      const migrationNames = (await readdir(new URL('../src/migrations/', import.meta.url)))
        .filter(name => /^\d{4}_.*\.sql$/.test(name) && Number(name.slice(0, 4)) <= 45).sort();
      assert.equal(migrationNames.length, 44);
      await old.transaction(async tx => {
        await tx.exec(`CREATE TABLE schema_migrations (
          version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
        const files = [{ version: 1, url: new URL('../src/schema.sql', import.meta.url) },
          ...migrationNames.map(name => ({ version: Number(name.slice(0, 4)),
            url: new URL(`../src/migrations/${name}`, import.meta.url) }))];
        for (const { version, url } of files) {
          const sql = await readFile(url, 'utf8');
          await tx.exec(sql);
          await tx.query('INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)',
            [version, createHash('sha256').update(sql).digest('hex')]);
        }
      });
      assert.equal((await old.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations'))
        .rows[0]?.version, 45);
      await old.query(`INSERT INTO reports(id,reporter_id,kind,description,status)
        VALUES('legacy-review','member','SAFETY','旧工单已在处理中','IN_REVIEW')`);
      await old.query(`INSERT INTO report_assignments(report_id,assignee_id,assigned_by,assignment_reason)
        VALUES('legacy-review','operator:reviewer','operator:safety','迁移前已分配的工单')`);
    } finally { await old.close(); }

    const upgraded = await createDatabase(directory);
    try {
      const expectedChecksum = createHash('sha256').update(await readFile(
        new URL('../src/migrations/0046_report_response_tracking.sql', import.meta.url), 'utf8')).digest('hex');
      const migration = await upgraded.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE version=46');
      assert.equal(migration.rows[0]?.checksum, expectedChecksum);
      const before = await upgraded.query<{ first_response_state: string; first_responded_at: Date | null;
        first_responded_by: string | null }>(
        "SELECT first_response_state,first_responded_at,first_responded_by FROM reports WHERE id='legacy-review'");
      assert.deepEqual(before.rows, [{ first_response_state: 'LEGACY_UNKNOWN',
        first_responded_at: null, first_responded_by: null }]);
      const attention = await listReportResponseAlerts(upgraded);
      assert.equal(attention.items.some(item => item.id === 'legacy-review'), false);
      await changeReportStatus(upgraded, 'operator:reviewer', 'legacy-review', 'RESOLVED',
        '已完成迁移后核查并通知举报人', 'legacy-response-close');
      const after = await upgraded.query<{ first_response_state: string; first_responded_at: Date | null;
        first_responded_by: string | null }>(
        "SELECT first_response_state,first_responded_at,first_responded_by FROM reports WHERE id='legacy-review'");
      assert.deepEqual(after.rows, before.rows);
    } finally { await upgraded.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('schema migration is recorded once and rejects a changed checksum on restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-migration-'));
  try {
    const db = await createDatabase(directory);
    const first = await db.query<{ version: number; checksum: string }>('SELECT version,checksum FROM schema_migrations ORDER BY version');
    assert.equal(first.rows.length, LATEST_SCHEMA_VERSION);
    assert.equal(first.rows[0]?.version, 1);
    await db.close();
    const reopened = await createDatabase(directory);
    assert.equal((await reopened.query('SELECT version FROM schema_migrations')).rows.length, LATEST_SCHEMA_VERSION);
    await reopened.query("UPDATE schema_migrations SET checksum='tampered' WHERE version=1");
    await reopened.close();
    await assert.rejects(() => createDatabase(directory), /checksum/i);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('event-start migration schedules existing confirmed activities without changing their facts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-start-upgrade-'));
  try {
    const db = await createDatabase(directory);
    const startAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    await db.query("INSERT INTO events(id,host_id,status,version,payload,recruiting) VALUES('legacy-confirmed','host','CONFIRMED',3,$1,true)",
      [JSON.stringify({ startAt })]);
    await db.query('DELETE FROM schema_migrations WHERE version=27');
    await db.close();
    const upgraded = await createDatabase(directory);
    const { rows } = await upgraded.query<{ due_at: Date; payload: { version: number } }>(
      "SELECT due_at,payload FROM jobs WHERE event_id='legacy-confirmed' AND kind='EVENT_START'");
    assert.equal(rows.length, 1);
    assert.equal(new Date(rows[0]!.due_at).toISOString(), startAt);
    assert.equal(rows[0]!.payload.version, 3);
    assert.deepEqual((await upgraded.query<{ status: string; recruiting: boolean }>(
      "SELECT status,recruiting FROM events WHERE id='legacy-confirmed'")).rows,
    [{ status: 'CONFIRMED', recruiting: true }]);
    await upgraded.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('event-end migration schedules an existing in-progress activity without declaring it completed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-end-upgrade-'));
  try {
    const db = await createDatabase(directory);
    const endAt = new Date(Date.now() + 60 * 60_000).toISOString();
    await db.query("INSERT INTO events(id,host_id,status,version,payload,recruiting) VALUES('legacy-in-progress','host','IN_PROGRESS',4,$1,false)",
      [JSON.stringify({ endAt })]);
    await db.query('DELETE FROM schema_migrations WHERE version=29');
    await db.close();
    const upgraded = await createDatabase(directory);
    const { rows } = await upgraded.query<{ due_at: Date; payload: { version: number } }>(
      "SELECT due_at,payload FROM jobs WHERE event_id='legacy-in-progress' AND kind='EVENT_END'");
    assert.equal(rows.length, 1);
    assert.equal(new Date(rows[0]!.due_at).toISOString(), endAt);
    assert.equal(rows[0]!.payload.version, 4);
    assert.equal((await upgraded.query<{ status: string }>(
      "SELECT status FROM events WHERE id='legacy-in-progress'")).rows[0]?.status, 'IN_PROGRESS');
    await upgraded.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('outcome-issues migration leaves a legacy completion intact with no invented issue', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-outcome-issues-upgrade-'));
  try {
    const db = await createDatabase(directory);
    await db.query("INSERT INTO events(id,host_id,status,version,payload,recruiting) VALUES('legacy-completed','host','COMPLETED',2,'{}',false)");
    await db.query("INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at) VALUES('legacy-completed',true,4,'host',now())");
    await db.query('ALTER TABLE outcomes DROP COLUMN issues');
    await db.query('DELETE FROM schema_migrations WHERE version=30');
    await db.close();
    const upgraded = await createDatabase(directory);
    const { rows } = await upgraded.query<{ held: boolean; actual_count: number; issues: string[] }>(
      "SELECT held,actual_count,issues FROM outcomes WHERE event_id='legacy-completed'");
    assert.deepEqual(rows, [{ held: true, actual_count: 4, issues: [] }]);
    await upgraded.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('appeal migration restores an auditable legacy report resolver', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-appeal-upgrade-'));
  try {
    const db = await createDatabase(directory);
    await db.query(`INSERT INTO reports(id,reporter_id,kind,description,status)
      VALUES('legacy-case','member','SAFETY','旧版举报','RESOLVED')`);
    await db.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
      ['legacy-case-close', 'operator:original', 'REPORT_STATUS', JSON.stringify({ reportId: 'legacy-case', status: 'RESOLVED' })]);
    await db.query('DELETE FROM schema_migrations WHERE version=14');
    await db.close();
    const upgraded = await createDatabase(directory);
    assert.equal((await upgraded.query<{ resolved_by: string }>('SELECT resolved_by FROM reports WHERE id=$1', ['legacy-case'])).rows[0]?.resolved_by,
      'operator:original');
    await upgraded.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('expense migration preserves multiple legacy ledgers and identifies the latest revision', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-expense-upgrade-'));
  try {
    const db = await createDatabase(directory);
    await db.query("INSERT INTO events(id,host_id,status,version,payload) VALUES('event-aa','host','DRAFT',1,'{}')");
    await db.query('DROP INDEX expense_one_current_per_event');
    await db.query('DROP INDEX expense_event_revision_unique');
    await db.query('ALTER TABLE expense_ledgers DROP CONSTRAINT expense_revision_positive');
    await db.query('ALTER TABLE expense_ledgers DROP COLUMN revision');
    await db.query('ALTER TABLE expense_ledgers DROP COLUMN superseded_by');
    await db.query("INSERT INTO expense_ledgers(id,event_id,total_fen,created_by,created_at) VALUES('old','event-aa',9000,'host','2026-01-01T00:00:00Z')");
    await db.query("INSERT INTO expense_ledgers(id,event_id,total_fen,created_by,created_at) VALUES('new','event-aa',12000,'host','2026-01-02T00:00:00Z')");
    await db.query('DELETE FROM schema_migrations WHERE version=19');
    await db.close();
    const upgraded = await createDatabase(directory);
    const { rows } = await upgraded.query<{ id: string; revision: number; superseded_by: string | null }>(
      "SELECT id,revision,superseded_by FROM expense_ledgers WHERE event_id='event-aa' ORDER BY revision");
    assert.deepEqual(rows, [{ id: 'old', revision: 1, superseded_by: 'new' },
      { id: 'new', revision: 2, superseded_by: null }]);
    await assert.rejects(() => upgraded.query(
      "INSERT INTO expense_ledgers(id,event_id,total_fen,created_by,revision) VALUES('duplicate','event-aa',13000,'host',3)"));
    await upgraded.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('registration sequence migration backfills existing members in their saved time order', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-queue-upgrade-'));
  try {
    const db = await createDatabase(directory);
    await db.query("INSERT INTO events(id,host_id,status,version,payload) VALUES('legacy-queue','host','DRAFT',1,'{}')");
    await db.query('DROP INDEX registrations_enqueue_seq_unique');
    await db.query('ALTER TABLE registrations ALTER COLUMN enqueue_seq DROP DEFAULT');
    await db.query('ALTER TABLE registrations DROP COLUMN enqueue_seq');
    await db.query('DROP SEQUENCE registration_enqueue_seq');
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status,created_at) VALUES
      ('later','legacy-queue','later-member','WAITLISTED','2026-02-01T00:00:00Z'),
      ('earlier','legacy-queue','earlier-member','WAITLISTED','2026-01-01T00:00:00Z')`);
    await db.query('DELETE FROM schema_migrations WHERE version=23');
    await db.close();
    const upgraded = await createDatabase(directory);
    const { rows } = await upgraded.query<{ user_id: string; enqueue_seq: number }>(
      "SELECT user_id,enqueue_seq FROM registrations WHERE event_id='legacy-queue' ORDER BY enqueue_seq");
    assert.deepEqual(rows.map(row => row.user_id), ['earlier-member', 'later-member']);
    assert.deepEqual(rows.map(row => row.enqueue_seq), [1, 2]);
    await upgraded.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('offer history migration snapshots legacy state without inventing its earlier acceptance time', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-offer-history-upgrade-'));
  try {
    const db = await createDatabase(directory);
    await db.query('DROP TRIGGER offers_status_history ON offers');
    await db.query('DROP FUNCTION record_offer_status_history()');
    await db.query('DROP TABLE offer_status_history');
    await db.query('DELETE FROM schema_migrations WHERE version=40');
    const payload = { visibility: 'INVITE', startAt: '2027-01-02T12:00:00Z', endAt: '2027-01-02T14:00:00Z',
      timeZone: 'Asia/Shanghai' };
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test,review_status)
      VALUES('legacy-offer-event','host','RECRUITING',2,$1::jsonb,false,'APPROVED')`, [JSON.stringify(payload)]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload)
      VALUES('legacy-offer-event',2,$1::jsonb)`, [JSON.stringify(payload)]);
    // This fixture exercises migration 40 offer history in today's schema;
    // make its invitation event accessible under the current review policy.
    await db.query(`INSERT INTO event_review_decisions(id,event_id,event_version,decision,reason,reviewed_by)
      VALUES('legacy-offer-review','legacy-offer-event',2,'APPROVED','合成活动已审核','operator:fixture')`);
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status)
      VALUES('legacy-offer-reg','legacy-offer-event','p1','CONFIRMED')`);
    await db.query(`INSERT INTO offers(id,event_id,registration_id,expires_at,status)
      VALUES('legacy-offer','legacy-offer-event','legacy-offer-reg','2027-01-01T00:00:00Z','ACCEPTED')`);
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status)
      VALUES('legacy-unknown-reg','legacy-offer-event','p2','WAITLISTED')`);
    await db.query(`INSERT INTO offers(id,event_id,registration_id,expires_at,status)
      VALUES('legacy-unknown','legacy-offer-event','legacy-unknown-reg','2027-01-01T00:00:00Z','LEGACY_UNKNOWN')`);
    const { rows: captured } = await db.query<{ at: Date }>('SELECT clock_timestamp() AS at');
    await db.close();
    await new Promise(resolve => setTimeout(resolve, 20));
    const upgraded = await createDatabase(directory);
    try {
      const { rows: history } = await upgraded.query<{ status: string; legacy_snapshot: boolean }>(
        'SELECT status,legacy_snapshot FROM offer_status_history ORDER BY offer_id');
      assert.deepEqual(history, [{ status: 'ACCEPTED', legacy_snapshot: true },
        { status: 'LEGACY_UNKNOWN', legacy_snapshot: true }]);
      const pilot = ['host', 'p1', 'p2'];
      const before = (await getPilotMetrics(upgraded, new Date(captured[0]!.at).getTime(), pilot)).waitlistOfferConversion;
      assert.equal(before.issued, 2);
      assert.equal(before.accepted, 0);
      assert.equal(before.unclassified, 2);
      const after = (await getPilotMetrics(upgraded, Date.now() + 1000, pilot)).waitlistOfferConversion;
      assert.equal(after.accepted, 1);
      assert.equal(after.unclassified, 1);
    } finally { await upgraded.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('event status migration leaves pre-upgrade pilot history unresolved', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-event-status-upgrade-'));
  try {
    const db = await createDatabase(directory);
    await db.query('DROP TRIGGER events_status_history ON events');
    await db.query('DROP FUNCTION record_event_status_history()');
    await db.query('DROP TABLE event_status_history');
    await db.query('DELETE FROM schema_migrations WHERE version=41');
    const payload = { visibility: 'INVITE', startAt: '2026-07-01T12:00:00Z', endAt: '2026-07-01T14:00:00Z',
      timeZone: 'Asia/Shanghai', minParticipants: 4 };
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test,created_at) VALUES
      ('legacy-completed','host','COMPLETED',2,$1::jsonb,false,'2026-06-30T00:00:00Z'),
      ('legacy-unknown','host','LEGACY_STATE',2,$1::jsonb,false,'2026-06-30T00:00:00Z')`,
    [JSON.stringify(payload)]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
      SELECT id,2,payload,'2026-06-30T00:00:00Z' FROM events WHERE id LIKE 'legacy-%'`);
    const { rows: captured } = await db.query<{ at: Date }>('SELECT clock_timestamp() AS at');
    await db.close();
    await new Promise(resolve => setTimeout(resolve, 20));
    const upgraded = await createDatabase(directory);
    try {
      const { rows: history } = await upgraded.query<{ status: string; legacy_snapshot: boolean }>(
        'SELECT status,legacy_snapshot FROM event_status_history ORDER BY event_id');
      assert.deepEqual(history, [{ status: 'COMPLETED', legacy_snapshot: true },
        { status: 'LEGACY_STATE', legacy_snapshot: true }]);
      const before = (await getPilotMetrics(upgraded, new Date(captured[0]!.at).getTime(), ['host']))
        .dueEventCompletion;
      assert.equal(before.dueEvents, 2);
      assert.equal(before.pendingReview, 2);
      const after = (await getPilotMetrics(upgraded, Date.now() + 1000, ['host']))
        .dueEventCompletion;
      assert.equal(after.dueEvents, 2);
      assert.equal(after.pendingReview, 0);
    } finally { await upgraded.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('registration status migration does not fabricate an old deadline cohort', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-registration-status-upgrade-'));
  try {
    const db = await createDatabase(directory);
    await db.query('DROP TRIGGER registrations_status_history ON registrations');
    await db.query('DROP FUNCTION record_registration_status_history()');
    await db.query('DROP TABLE registration_status_history');
    await db.query('DELETE FROM schema_migrations WHERE version=42');
    const payload = { visibility: 'INVITE', startAt: '2026-07-01T12:00:00Z',
      endAt: '2026-07-01T14:00:00Z', registrationDeadline: '2026-07-01T11:30:00Z',
      timeZone: 'Asia/Shanghai', minParticipants: 4 };
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test)
      VALUES('legacy-attendance','host','COMPLETED',2,$1::jsonb,false)`, [JSON.stringify(payload)]);
    await db.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
      VALUES('legacy-attendance',2,$1::jsonb,'2026-06-30T00:00:00Z')`, [JSON.stringify(payload)]);
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status,created_at)
      VALUES('legacy-attendance-p1','legacy-attendance','p1','CANCELLED','2026-06-30T01:00:00Z')`);
    const { rows: captured } = await db.query<{ at: Date }>('SELECT clock_timestamp() AS at');
    await db.close();
    await new Promise(resolve => setTimeout(resolve, 20));
    const upgraded = await createDatabase(directory);
    try {
      const report = (await getPilotMetrics(upgraded, new Date(captured[0]!.at).getTime(), ['host', 'p1']))
        .attendanceDiagnostic;
      assert.equal(report.status, 'PARTIAL');
      assert.equal(report.unknownDeadlineStates, 1);
      assert.equal(report.confirmedAtDeadline, 0);
      assert.equal(report.cohortAttendanceRate, null);
      await upgraded.query("UPDATE registrations SET status='CONFIRMED' WHERE id='legacy-attendance-p1'");
      const { rows: history } = await upgraded.query<{ status: string; legacy_snapshot: boolean }>(
        "SELECT status,legacy_snapshot FROM registration_status_history WHERE registration_id='legacy-attendance-p1' ORDER BY id");
      assert.deepEqual(history, [{ status: 'CANCELLED', legacy_snapshot: true },
        { status: 'CONFIRMED', legacy_snapshot: false }]);
    } finally { await upgraded.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
