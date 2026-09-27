import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, type Database } from '../src/db.ts';
import { getPilotMetrics } from '../src/metrics.ts';
import { exportPersonalData } from '../src/privacy.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const databaseName = validatePostgresTestUrl(url);
const probe = new pg.Pool({ connectionString: url, max: 1 });
try { await assertEmptyPostgresTestDatabase(probe, databaseName); }
finally { await probe.end(); }

let original: Database | undefined;
let first: Database | undefined;
let second: Database | undefined;
try {
  original = await createProductionDatabase(url);
  await original.transaction(async tx => {
    await tx.query('DROP TRIGGER registrations_status_history ON registrations');
    await tx.query('DROP FUNCTION record_registration_status_history()');
    await tx.query('DROP TABLE registration_status_history');
    await tx.query('DROP TRIGGER events_status_history ON events');
    await tx.query('DROP FUNCTION record_event_status_history()');
    await tx.query('DROP TABLE event_status_history');
    await tx.query('DROP TRIGGER offers_status_history ON offers');
    await tx.query('DROP FUNCTION record_offer_status_history()');
    await tx.query('DROP TABLE offer_status_history');
    await tx.query('DELETE FROM schema_migrations WHERE version>=40');
    const payload = { visibility: 'INVITE', startAt: '2026-09-20T12:00:00Z',
      endAt: '2026-09-20T14:00:00Z', registrationDeadline: '2026-09-19T23:00:00Z',
      timeZone: 'Asia/Shanghai', minParticipants: 4, maxParticipants: 6 };
    await tx.query(`INSERT INTO events(id,host_id,status,version,payload,is_test)
      VALUES('pg-legacy-history','host','COMPLETED',2,$1::jsonb,false)`, [JSON.stringify(payload)]);
    await tx.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
      VALUES('pg-legacy-history',2,$1::jsonb,'2026-09-19T00:00:00Z')`, [JSON.stringify(payload)]);
    await tx.query(`INSERT INTO registrations(id,event_id,user_id,status,created_at)
      VALUES('pg-legacy-registration','pg-legacy-history','p1','CONFIRMED','2026-09-19T01:00:00Z')`);
    await tx.query(`INSERT INTO offers(id,event_id,registration_id,expires_at,status)
      VALUES('pg-legacy-offer','pg-legacy-history','pg-legacy-registration','2026-09-29T00:00:00Z','ACCEPTED')`);
  });
  const { rows: cutoff } = await original.query<{ at: Date }>('SELECT clock_timestamp() AS at');
  await original.close(); original = undefined;
  await new Promise(resolve => setTimeout(resolve, 20));
  [first, second] = await Promise.all([createProductionDatabase(url), createProductionDatabase(url)]);
  const { rows: migrations } = await second.query<{ version: number }>(
    'SELECT version FROM schema_migrations WHERE version>=40 ORDER BY version');
  assert.deepEqual(migrations.map(row => row.version), [40, 41, 42]);
  const { rows: snapshots } = await first.query<{ offer: number; event: number; registration: number }>(`SELECT
    (SELECT count(*)::int FROM offer_status_history WHERE legacy_snapshot=true) AS offer,
    (SELECT count(*)::int FROM event_status_history WHERE legacy_snapshot=true) AS event,
    (SELECT count(*)::int FROM registration_status_history WHERE legacy_snapshot=true) AS registration`);
  assert.deepEqual(snapshots, [{ offer: 1, event: 1, registration: 1 }]);
  const before = await getPilotMetrics(second, new Date(cutoff[0]!.at).getTime(), ['host', 'p1']);
  assert.equal(before.dueEventCompletion.pendingReview, 1);
  assert.equal(before.waitlistOfferConversion.unclassified, 1);
  assert.equal(before.attendanceDiagnostic.status, 'PARTIAL');
  assert.equal(before.attendanceDiagnostic.unknownDeadlineStates, 1);
  const after = await getPilotMetrics(first, Date.now() + 1000, ['host', 'p1']);
  assert.equal(after.waitlistOfferConversion.accepted, 1);
  assert.equal(after.attendanceDiagnostic.cohortAttendanceRate, null);
  const own = await exportPersonalData(first, 'p1');
  const host = await exportPersonalData(second, 'host');
  assert.deepEqual(own.registrationStatusHistory.map(row => row.status), ['CONFIRMED']);
  assert.deepEqual(own.waitlistOfferHistory.map(row => row.status), ['ACCEPTED']);
  assert.deepEqual(host.hostedEventStatusHistory.map(row => row.status), ['COMPLETED']);
  await first.query("UPDATE registrations SET status='CANCELLED' WHERE id='pg-legacy-registration'");
  await first.query("UPDATE offers SET status='CANCELLED' WHERE id='pg-legacy-offer'");
  await first.query("UPDATE events SET status='CANCELLED' WHERE id='pg-legacy-history'");
  const { rows: counts } = await second.query<{ registrations: number; offers: number; events: number }>(`SELECT
    (SELECT count(*)::int FROM registration_status_history WHERE registration_id='pg-legacy-registration') AS registrations,
    (SELECT count(*)::int FROM offer_status_history WHERE offer_id='pg-legacy-offer') AS offers,
    (SELECT count(*)::int FROM event_status_history WHERE event_id='pg-legacy-history') AS events`);
  assert.deepEqual(counts, [{ registrations: 2, offers: 2, events: 2 }]);
  process.stdout.write(JSON.stringify({ database: databaseName, migrations: migrations.map(row => row.version),
    pools: 2, legacySnapshots: snapshots[0], before: {
      pendingReview: before.dueEventCompletion.pendingReview,
      unknownOffers: before.waitlistOfferConversion.unclassified,
      unknownDeadlineStates: before.attendanceDiagnostic.unknownDeadlineStates },
    after: { acceptedOffers: after.waitlistOfferConversion.accepted,
      attendanceRate: after.attendanceDiagnostic.cohortAttendanceRate },
    historyRowsAfterTransitions: counts[0], personalExport: true }) + '\n');
} finally {
  await Promise.all([original?.close(), first?.close(), second?.close()]);
}
