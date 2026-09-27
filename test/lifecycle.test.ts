import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import type { Database } from '../src/db.ts';
import { createDraft, updateDraft, getEvent } from '../src/events.ts';
import { changeApprovedInvite, publishApprovedInvite } from './helpers.ts';
import { cancelRegistration, removeRegistration } from '../src/registrations.ts';
import { register } from './helpers.ts';
import { previewEventChange, getPendingReconfirmation, reconfirm, confirmEvent, cancelEvent, createCheckInToken, checkIn, requestManualCheckIn, respondManualCheckIn, listManualCheckIns, completeEvent, repeatEvent, recordExpense, listExpenses, markExpenseShare, recordOutcomeFeedback, getOutcomeEvidence } from '../src/lifecycle.ts';
import { runDueJobs } from '../src/jobs.ts';
import { setConsent } from '../src/notifications.ts';
import { listRepeatCandidates } from '../src/lifecycle.ts';
import { exportPersonalData } from '../src/privacy.ts';

const input = {
  title: '周六羽毛球', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共羽毛球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 4, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'AA', feeCapFen: 5000,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO',
  hostParticipates: true
};

async function published(db: Awaited<ReturnType<typeof createDatabase>>, overrides = {}) {
  const draft = await createDraft(db, 'host', { ...input, ...overrides }, `draft-${Math.random()}`);
  return publishApprovedInvite(db, 'host', draft.id, draft.version, `publish-${Math.random()}`);
}

test('formation records a versioned host venue statement only after successful confirmation', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    await assert.rejects(() => confirmEvent(db, 'host', event.id, event.version, 'venue-too-early'),
      { code: 'NOT_ENOUGH_PEOPLE' });
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, event.id, event.version, `venue-${actor}`);
    await confirmEvent(db, 'host', event.id, event.version, 'venue-confirm');
    await confirmEvent(db, 'host', event.id, event.version, 'venue-confirm');
    const { rows } = await db.query<{ phase: string; event_version: number; venue_name: string; source_type: string;
      recorded_by: string; expires_at: Date; recorded_at: Date }>(
      'SELECT phase,event_version,venue_name,source_type,recorded_by,expires_at,recorded_at FROM venue_evidence WHERE event_id=$1', [event.id]);
    assert.equal(rows.length, 2);
    const formation = rows.find(row => row.phase === 'FORMATION')!;
    assert.equal(formation.event_version, event.version);
    assert.equal(formation.venue_name, '公共羽毛球馆');
    assert.equal(formation.source_type, 'HOST_STATEMENT');
    assert.equal(formation.recorded_by, 'host');
    assert.equal(new Date(formation.expires_at).toISOString(), event.payload.startAt);
    assert.ok(new Date(formation.recorded_at).getTime() <= Date.now());
    const viewed = await getEvent(db, 'p1', event.id);
    assert.equal(viewed.venueEvidence?.sourceType, 'HOST_STATEMENT');
    assert.equal(viewed.venueEvidence?.venueName, '公共羽毛球馆');
    assert.equal(viewed.venueEvidence?.phase, 'FORMATION');
    assert.equal(viewed.venueEvidence?.recordedAt, new Date(formation.recorded_at).toISOString());
    const hostExport = await exportPersonalData(db, 'host');
    const memberExport = await exportPersonalData(db, 'p1');
    assert.equal(hostExport.hostedVenueEvidence[0]?.source_type, 'HOST_STATEMENT');
    assert.equal(memberExport.hostedVenueEvidence.length, 0);
  } finally { await db.close(); }
});

test('changing venue or scheduled time requires an explicit new host venue statement', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const newVenue = { venueName: '另一家公共球馆' };
    await assert.rejects(() => previewEventChange(db, 'host', event.id, event.version, newVenue),
      { code: 'VENUE_REASSERT_REQUIRED' });
    await assert.rejects(() => changeApprovedInvite(db, 'host', event.id, event.version, newVenue, 'venue-without-statement'),
      { code: 'VENUE_REASSERT_REQUIRED' });
    const changed = await changeApprovedInvite(db, 'host', event.id, event.version,
      { ...newVenue, venueStatus: 'HOST_CONFIRMED' }, 'venue-with-statement');
    const { rows } = await db.query<{ phase: string; event_version: number; venue_name: string }>(
      'SELECT phase,event_version,venue_name FROM venue_evidence WHERE event_id=$1 ORDER BY event_version,phase', [event.id]);
    assert.deepEqual(rows.map(row => row.phase), ['PUBLISH', 'CHANGE']);
    assert.equal(rows[1]?.event_version, changed.version);
    assert.equal(rows[1]?.venue_name, '另一家公共球馆');
    const laterStart = new Date(Date.parse(changed.payload.startAt!) + 60 * 60_000).toISOString();
    await assert.rejects(() => previewEventChange(db, 'host', event.id, changed.version, { startAt: laterStart }),
      { code: 'VENUE_REASSERT_REQUIRED' });
  } finally { await db.close(); }
});

async function moveEventPastEnd(db: Database, eventId: string): Promise<void> {
  const now = Date.now();
  await db.query('UPDATE events SET payload=payload || $2::jsonb WHERE id=$1', [eventId, JSON.stringify({
    startAt: new Date(now - 90 * 60_000).toISOString(),
    endAt: new Date(now - 30 * 60_000).toISOString()
  })]);
}

function databaseWithApplicationClock(db: Database, actualNow: () => number, appNow: () => number): Database {
  const queryWithDatabaseClock = async <T extends Record<string, unknown> = Record<string, unknown>>(
    query: Database['query'], sql: string, params: unknown[] = []): Promise<{ rows: T[] }> => {
    Date.now = actualNow;
    try { return await query<T>(sql, params); }
    finally { Date.now = appNow; }
  };
  return {
    ...db,
    query: (sql, params = []) => queryWithDatabaseClock(db.query, sql, params),
    transaction: fn => db.transaction(tx => fn({
      query: (sql, params = []) => queryWithDatabaseClock(tx.query, sql, params)
    }))
  };
}

test('a fast application clock does not reject an editable event change', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const actualNow = Date.now;
    const fastNow = () => actualNow() + 2 * 365 * 24 * 60 * 60_000;
    const clockDb = databaseWithApplicationClock(db, actualNow, fastNow);
    Date.now = fastNow;
    try {
      const preview = await previewEventChange(clockDb, 'host', event.id, event.version, { title: '羽毛球新标题' });
      assert.equal(preview.material, false);
      const changed = await changeApprovedInvite(clockDb, 'host', event.id, event.version,
        { title: '羽毛球新标题' }, 'fast-clock-title');
      assert.equal(changed.payload.title, '羽毛球新标题');
    } finally { Date.now = actualNow; }
  } finally { await db.close(); }
});

test('a fast application clock does not reject formation before the database confirmation deadline', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, event.id, event.version, `fast-formation-${actor}`);
    const actualNow = Date.now;
    const fastNow = () => actualNow() + 2 * 365 * 24 * 60 * 60_000;
    const clockDb = databaseWithApplicationClock(db, actualNow, fastNow);
    Date.now = fastNow;
    try {
      const formed = await confirmEvent(clockDb, 'host', event.id, event.version, 'fast-formation');
      assert.equal(formed.status, 'CONFIRMED');
    } finally { Date.now = actualNow; }
  } finally { await db.close(); }
});

test('a fast application clock does not reject cancellation before the database start time', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const actualNow = Date.now;
    const fastNow = () => actualNow() + 2 * 365 * 24 * 60 * 60_000;
    const clockDb = databaseWithApplicationClock(db, actualNow, fastNow);
    Date.now = fastNow;
    try {
      const cancelled = await cancelEvent(clockDb, 'host', event.id, event.version, 'fast-clock-cancel');
      assert.equal(cancelled.status, 'CANCELLED');
    } finally { Date.now = actualNow; }
  } finally { await db.close(); }
});

test('a fast application clock does not reject reconfirmation before the database deadline', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const registration = await register(db, 'p1', event.id, event.version, 'fast-reconfirm-seat');
    const changed = await changeApprovedInvite(db, 'host', event.id, event.version,
      { venueName: '新的公共球馆', venueStatus: 'HOST_CONFIRMED' }, 'fast-reconfirm-change');
    const actualNow = Date.now;
    const fastNow = () => actualNow() + 2 * 365 * 24 * 60 * 60_000;
    const clockDb = databaseWithApplicationClock(db, actualNow, fastNow);
    Date.now = fastNow;
    try {
      const accepted = await reconfirm(clockDb, 'p1', registration.id, changed.version, 'fast-reconfirm');
      assert.equal(accepted.status, 'CONFIRMED');
    } finally { Date.now = actualNow; }
  } finally { await db.close(); }
});

test('a fast application clock does not reject manual check-in in the database window', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    await register(db, 'p1', event.id, event.version, 'fast-manual-seat');
    const now = Date.now();
    await db.query("UPDATE events SET status='CONFIRMED',payload=payload || $2::jsonb WHERE id=$1", [event.id,
      JSON.stringify({ startAt: new Date(now + 10 * 60_000).toISOString(),
        endAt: new Date(now + 70 * 60_000).toISOString() })]);
    const actualNow = Date.now;
    const fastNow = () => actualNow() + 2 * 365 * 24 * 60 * 60_000;
    const clockDb = databaseWithApplicationClock(db, actualNow, fastNow);
    Date.now = fastNow;
    try {
      const request = await requestManualCheckIn(clockDb, 'host', event.id, event.version,
        'p1', 'fast-manual-request');
      assert.equal(request.status, 'PENDING');
    } finally { Date.now = actualNow; }
  } finally { await db.close(); }
});

test('a slow application clock cannot accept a manual check-in after the database deadline', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    await register(db, 'p1', event.id, event.version, 'slow-manual-seat');
    const now = Date.now();
    await db.query("UPDATE events SET status='COMPLETED',payload=payload || $2::jsonb WHERE id=$1", [event.id,
      JSON.stringify({ startAt: new Date(now - 10 * 24 * 60 * 60_000).toISOString(),
        endAt: new Date(now - 9 * 24 * 60 * 60_000).toISOString() })]);
    await db.query("INSERT INTO manual_checkins(id,event_id,user_id,requested_by,status) VALUES('slow-manual-request',$1,'p1','host','PENDING')",
      [event.id]);
    const actualNow = Date.now;
    const slowNow = () => actualNow() - 2 * 365 * 24 * 60 * 60_000;
    const clockDb = databaseWithApplicationClock(db, actualNow, slowNow);
    Date.now = slowNow;
    try {
      await assert.rejects(() => respondManualCheckIn(clockDb, 'p1', 'slow-manual-request', event.version,
        true, 'slow-manual-accept'), { code: 'INVALID_STATE' });
    } finally { Date.now = actualNow; }
    assert.equal((await db.query("SELECT status FROM manual_checkins WHERE id='slow-manual-request'")).rows[0]?.status, 'PENDING');
    assert.equal((await db.query('SELECT id FROM checkins WHERE event_id=$1 AND user_id=$2', [event.id, 'p1'])).rows.length, 0);
  } finally { await db.close(); }
});

test('manual check-in request rolls back if its database window closes before insertion', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    await register(db, 'p1', event.id, event.version, 'manual-request-boundary-seat');
    const deadline = Date.now() + 1500;
    const end = deadline - 48 * 60 * 60_000;
    await db.query("UPDATE events SET status='COMPLETED',payload=payload || $2::jsonb WHERE id=$1", [event.id,
      JSON.stringify({ startAt: new Date(end - 60 * 60_000).toISOString(), endAt: new Date(end).toISOString() })]);
    let reachedInsert = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({ query: async (sql, params = []) => {
        if (sql.startsWith('INSERT INTO manual_checkins(')) {
          reachedInsert = true;
          await new Promise(resolve => setTimeout(resolve, Math.max(0, deadline - Date.now() + 50)));
        }
        return tx.query(sql, params);
      } }))
    };
    await assert.rejects(() => requestManualCheckIn(racingDb, 'host', event.id, event.version,
      'p1', 'late-manual-request'), { code: 'INVALID_STATE' });
    assert.equal(reachedInsert, true);
    assert.equal((await db.query('SELECT id FROM manual_checkins WHERE event_id=$1 AND user_id=$2', [event.id, 'p1'])).rows.length, 0);
  } finally { await db.close(); }
});

test('manual check-in response rolls back if its database deadline passes before update', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    await register(db, 'p1', event.id, event.version, 'manual-response-boundary-seat');
    const deadline = Date.now() + 1500;
    const end = deadline - 7 * 24 * 60 * 60_000;
    await db.query("UPDATE events SET status='COMPLETED',payload=payload || $2::jsonb WHERE id=$1", [event.id,
      JSON.stringify({ startAt: new Date(end - 60 * 60_000).toISOString(), endAt: new Date(end).toISOString() })]);
    await db.query("INSERT INTO manual_checkins(id,event_id,user_id,requested_by,status) VALUES('manual-boundary-response',$1,'p1','host','PENDING')",
      [event.id]);
    let reachedUpdate = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({ query: async (sql, params = []) => {
        if (sql.startsWith('UPDATE manual_checkins SET status=$2,responded_at=$3')) {
          reachedUpdate = true;
          await new Promise(resolve => setTimeout(resolve, Math.max(0, deadline - Date.now() + 50)));
        }
        return tx.query(sql, params);
      } }))
    };
    await assert.rejects(() => respondManualCheckIn(racingDb, 'p1', 'manual-boundary-response',
      event.version, true, 'late-manual-response'), { code: 'INVALID_STATE' });
    assert.equal(reachedUpdate, true);
    assert.equal((await db.query("SELECT status FROM manual_checkins WHERE id='manual-boundary-response'")).rows[0]?.status, 'PENDING');
    assert.equal((await db.query('SELECT id FROM checkins WHERE event_id=$1 AND user_id=$2', [event.id, 'p1'])).rows.length, 0);
  } finally { await db.close(); }
});

test('a slow application clock cannot move an event start into the database past', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const actualNow = Date.now;
    const slowNow = () => actualNow() - 2 * 365 * 24 * 60 * 60_000;
    const pastStart = actualNow() - 10 * 60_000;
    const patch = {
      startAt: new Date(pastStart).toISOString(), endAt: new Date(pastStart + 2 * 60 * 60_000).toISOString(),
      registrationDeadline: new Date(pastStart - 30 * 60_000).toISOString(),
      confirmationDeadline: new Date(pastStart - 60 * 60_000).toISOString(), venueStatus: 'HOST_CONFIRMED'
    };
    const clockDb = databaseWithApplicationClock(db, actualNow, slowNow);
    Date.now = slowNow;
    try {
      await assert.rejects(() => previewEventChange(clockDb, 'host', event.id, event.version, patch), { code: 'INVALID_EVENT' });
      await assert.rejects(() => changeApprovedInvite(clockDb, 'host', event.id, event.version, patch, 'slow-clock-start'),
        { code: 'INVALID_EVENT' });
    } finally { Date.now = actualNow; }
    const { rows } = await db.query<{ version: number; payload: { startAt: string } }>(
      'SELECT version,payload FROM events WHERE id=$1', [event.id]);
    assert.equal(rows[0]?.version, event.version);
    assert.equal(rows[0]?.payload.startAt, event.payload.startAt);
  } finally { await db.close(); }
});

test('material edit rolls back if its new confirmation deadline passes before the final write', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const now = Date.now();
    const confirmationDeadline = new Date(now + 1500).toISOString();
    const patch = {
      startAt: new Date(now + 2 * 60 * 60_000).toISOString(),
      endAt: new Date(now + 4 * 60 * 60_000).toISOString(),
      registrationDeadline: new Date(now + 60 * 60_000).toISOString(),
      confirmationDeadline, venueStatus: 'HOST_CONFIRMED'
    };
    let reachedFinalWrite = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async (sql, params = []) => {
          if (sql.startsWith('UPDATE events SET payload=$2,version=version+1')) {
            reachedFinalWrite = true;
            const waitMs = Math.max(0, Date.parse(confirmationDeadline) - Date.now() + 50);
            await new Promise(resolve => setTimeout(resolve, waitMs));
          }
          return tx.query(sql, params);
        }
      }))
    };
    await assert.rejects(() => changeApprovedInvite(racingDb, 'host', event.id, event.version, patch, 'late-confirmation'),
      { code: 'INVALID_STATE' });
    assert.equal(reachedFinalWrite, true);
    const { rows } = await db.query<{ version: number; payload: { startAt: string } }>(
      'SELECT version,payload FROM events WHERE id=$1', [event.id]);
    assert.equal(rows[0]?.version, event.version);
    assert.equal(rows[0]?.payload.startAt, event.payload.startAt);
    assert.equal((await db.query('SELECT version FROM event_versions WHERE event_id=$1 AND version=$2',
      [event.id, event.version + 1])).rows.length, 0);
  } finally { await db.close(); }
});

test('changing registration deadline keeps the invitation expiry aligned with the current activity', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const deadlines = ['2027-01-02T11:45:00.000Z', '2027-01-02T11:15:00.000Z'];
    let version = event.version;
    for (const [index, deadline] of deadlines.entries()) {
      const changed = await changeApprovedInvite(db, 'host', event.id, version,
        { registrationDeadline: deadline }, `invite-deadline-change-${index}`);
      version = changed.version;
      assert.equal(changed.inviteToken, event.inviteToken);
      const { rows } = await db.query<{ invite_expires_at: Date }>(
        'SELECT invite_expires_at FROM events WHERE id=$1', [event.id]);
      assert.equal(new Date(rows[0]!.invite_expires_at).toISOString(), deadline);
    }
  } finally { await db.close(); }
});

test('ordinary cancellation checks the database clock when the request time is stale', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const before = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM audit WHERE event_id=$1', [event.id]);
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
      [event.id, new Date(Date.now() - 60_000).toISOString()]);
    await assert.rejects(() => cancelEvent(db, 'host', event.id, event.version, 'stale-cancel',
      Date.now() - 120_000), { code: 'INVALID_STATE' });
    const { rows } = await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [event.id]);
    assert.equal(rows[0]?.status, 'RECRUITING');
    const after = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM audit WHERE event_id=$1', [event.id]);
    assert.equal(after.rows[0]?.n, before.rows[0]?.n);
  } finally { await db.close(); }
});

test('host edit cannot commit when the event starts between validation and update', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async (sql, params = []) => {
          if (!crossed && sql.startsWith('UPDATE events SET payload=$2,version=version+1')) {
            crossed = true;
            await tx.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
              [event.id, new Date(Date.now() - 60_000).toISOString()]);
          }
          return tx.query(sql, params);
        }
      }))
    };
    await assert.rejects(() => changeApprovedInvite(racingDb, 'host', event.id, event.version,
      { title: '写入时已开始' }, 'crossed-start'), { code: 'INVALID_STATE' });
    assert.equal(crossed, true);
    const { rows } = await db.query<{ version: number; payload: { title: string } }>(
      'SELECT version,payload FROM events WHERE id=$1', [event.id]);
    assert.equal(rows[0]?.version, event.version);
    assert.equal(rows[0]?.payload.title, event.payload.title);
    const { rows: versions } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM event_versions WHERE event_id=$1', [event.id]);
    assert.equal(versions[0]?.n, 1);
    const { rows: announcements } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM activity_content WHERE event_id=$1 AND author_id='system'", [event.id]);
    assert.equal(announcements[0]?.n, 0);
    const { rows: changedAudits } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action='EDIT_EVENT'", [event.id]);
    assert.equal(changedAudits[0]?.n, 0);
  } finally { await db.close(); }
});

test('host formation cannot commit after the confirmation deadline crosses during processing', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, event.id, event.version, `deadline-${actor}`);
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async (sql, params = []) => {
          if (!crossed && sql.startsWith("UPDATE events SET status='CONFIRMED'")) {
            crossed = true;
            await tx.query("UPDATE events SET payload=jsonb_set(payload,'{confirmationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
              [event.id, new Date(Date.now() - 1000).toISOString()]);
          }
          return tx.query(sql, params);
        }
      }))
    };
    await assert.rejects(() => confirmEvent(racingDb, 'host', event.id, event.version, 'crossed-confirmation-deadline'),
      { code: 'INVALID_STATE' });
    assert.equal(crossed, true);
    const { rows: events } = await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [event.id]);
    assert.equal(events[0]?.status, 'RECRUITING');
    const { rows: audits } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action='CONFIRM_EVENT'", [event.id]);
    assert.equal(audits[0]?.n, 0);
  } finally { await db.close(); }
});

test('participant cannot reconfirm with a stale request time after the current deadline', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const registration = await register(db, 'p1', event.id, event.version, 'deadline-join');
    const changed = await changeApprovedInvite(db, 'host', event.id, event.version,
      { venueName: '新公共场馆', venueStatus: 'HOST_CONFIRMED' }, 'deadline-change');
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{confirmationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
      [event.id, new Date(Date.now() - 1000).toISOString()]);
    await assert.rejects(() => reconfirm(db, 'p1', registration.id, changed.version, 'stale-reconfirm',
      Date.now() - 60_000), { code: 'INVALID_STATE' });
    const { rows } = await db.query<{ status: string; accepted_version: number }>(
      'SELECT status,accepted_version FROM registrations WHERE id=$1', [registration.id]);
    assert.equal(rows[0]?.status, 'RECONFIRM_REQUIRED');
    assert.equal(rows[0]?.accepted_version, event.version);
  } finally { await db.close(); }
});

test('material change preserves old version and requires personal reconfirmation', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'p1');
    const preview = await previewEventChange(db, 'host', e.id, e.version,
      { venueName: '另一家公共球馆', venueStatus: 'HOST_CONFIRMED' });
    assert.equal(preview.material, true);
    assert.equal(preview.affectedCount, 2);
    assert.deepEqual(preview.changes, [{ field: 'venueName', before: '公共羽毛球馆', after: '另一家公共球馆' }]);
    await assert.rejects(() => previewEventChange(db, 'p1', e.id, e.version, { venueName: '他人场馆' }), { code: 'FORBIDDEN' });
    const changed = await changeApprovedInvite(db, 'host', e.id, e.version,
      { venueName: '另一家公共球馆', venueStatus: 'HOST_CONFIRMED' }, 'change');
    assert.equal(changed.version, e.version + 1);
    assert.equal(changed.recruiting, false);
    const old = await db.query<{ payload: { venueName: string } }>('SELECT payload FROM event_versions WHERE event_id=$1 AND version=$2', [e.id, e.version]);
    assert.equal(old.rows[0]?.payload.venueName, '公共羽毛球馆');
    const state = await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1', [p1.id]);
    assert.equal(state.rows[0]?.status, 'RECONFIRM_REQUIRED');
    const pending = await getPendingReconfirmation(db, 'p1', e.id);
    assert.equal(pending?.deadline, changed.payload.confirmationDeadline);
    assert.deepEqual(pending?.changes, [{ field: 'venueName', before: '公共羽毛球馆', after: '另一家公共球馆' }]);
    await assert.rejects(() => getPendingReconfirmation(db, 'outsider', e.id), { code: 'FORBIDDEN' });
    await assert.rejects(() => reconfirm(db, 'other', p1.id, changed.version, 'wrong'), { code: 'FORBIDDEN' });
    await assert.rejects(() => reconfirm(db, 'p1', p1.id, changed.version, 'too-late', Date.parse(changed.payload.confirmationDeadline!) + 1), { code: 'INVALID_STATE' });
    const yes = await reconfirm(db, 'p1', p1.id, changed.version, 'yes');
    assert.equal(yes.status, 'CONFIRMED');
    assert.equal(yes.acceptedVersion, changed.version);
    assert.equal(await getPendingReconfirmation(db, 'p1', e.id), null);
  } finally { await db.close(); }
});

test('changing a stated activity level requires participants to accept the new version', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db, { skillLevel: '中等水平' });
    const member = await register(db, 'p1', event.id, event.version, 'level-member');
    const preview = await previewEventChange(db, 'host', event.id, event.version, { skillLevel: '进阶水平' });
    assert.equal(preview.material, true);
    assert.deepEqual(preview.changes, [{ field: 'skillLevel', before: '中等水平', after: '进阶水平' }]);
    const changed = await changeApprovedInvite(db, 'host', event.id, event.version, { skillLevel: '进阶水平' }, 'level-change');
    assert.equal((await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1', [member.id])).rows[0]?.status,
      'RECONFIRM_REQUIRED');
    assert.equal(changed.payload.skillLevel, '进阶水平');
  } finally { await db.close(); }
});

test('cancelled events reject reconfirmation and attendance cannot be erased by late withdrawal', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'p1');
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text)) WHERE id=$1",
      [e.id, new Date(Date.now() - 1000).toISOString()]);
    await assert.rejects(() => cancelRegistration(db, 'p1', p1.id, e.version, 'late'), { code: 'INVALID_STATE' });
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text)) WHERE id=$1",
      [e.id, e.payload.startAt]);
    const changed = await changeApprovedInvite(db, 'host', e.id, e.version,
      { venueName: '新公共场馆', venueStatus: 'HOST_CONFIRMED' }, 'change');
    await cancelEvent(db, 'host', e.id, changed.version, 'cancel');
    await assert.rejects(() => reconfirm(db, 'p1', p1.id, changed.version, 'after-cancel'), { code: 'INVALID_STATE' });
  } finally { await db.close(); }
});

test('minor title edit preserves confirmed consent and deadline jobs for the new version', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'p1');
    await register(db, 'p2', e.id, e.version, 'p2');
    await register(db, 'p3', e.id, e.version, 'p3');
    assert.equal((await previewEventChange(db, 'host', e.id, e.version, { title: '周六羽毛球（1号场）' })).material, false);
    const edited = await changeApprovedInvite(db, 'host', e.id, e.version, { title: '周六羽毛球（1号场）' }, 'title-edit');
    assert.equal(edited.version, e.version + 1);
    assert.equal(edited.recruiting, true);
    const { rows: members } = await db.query<{ accepted_version: number }>('SELECT accepted_version FROM registrations WHERE id=$1', [p1.id]);
    assert.equal(members[0]?.accepted_version, edited.version);
    const { rows: deadlines } = await db.query<{ kind: string }>("SELECT kind FROM jobs WHERE event_id=$1 AND payload->>'version'=$2 AND kind IN ('FORMATION_DEADLINE','REGISTRATION_DEADLINE')", [e.id, String(edited.version)]);
    assert.equal(deadlines.length, 2);
    const { rows: announcements } = await db.query<{ body: string }>("SELECT body FROM activity_content WHERE event_id=$1 AND author_id='system' AND status='APPROVED'", [e.id]);
    assert.match(announcements[0]?.body ?? '', /审核前.*已审核信息/);
    assert.equal((announcements[0]?.body ?? '').includes('周六羽毛球（1号场）'), false);
    assert.equal((await confirmEvent(db, 'host', e.id, edited.version, 'confirm-after-edit')).status, 'CONFIRMED');
  } finally { await db.close(); }
});

test('switching from free to AA is a material change requiring new consent', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db, { feeMode: 'FREE', feeCapFen: 0 });
    const p1 = await register(db, 'p1', e.id, e.version, 'p1');
    const changed = await changeApprovedInvite(db, 'host', e.id, e.version, { feeMode: 'AA', feeCapFen: 0 }, 'fee-change');
    const { rows } = await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1', [p1.id]);
    assert.equal(changed.recruiting, false);
    assert.equal(rows[0]?.status, 'RECONFIRM_REQUIRED');
  } finally { await db.close(); }
});

test('a participating host must reconfirm their own seat after a material change', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db, { maxParticipants: 6 });
    const people = [];
    for (const actor of ['p1', 'p2', 'p3', 'p4']) people.push(await register(db, actor, e.id, e.version, `join-${actor}`));
    const changed = await changeApprovedInvite(db, 'host', e.id, e.version,
      { venueName: '新公共球馆', venueStatus: 'HOST_CONFIRMED' }, 'host-change');
    for (let i = 0; i < people.length; i++) await reconfirm(db, `p${i + 1}`, people[i]!.id, changed.version, `reconfirm-${i}`);
    await assert.rejects(() => confirmEvent(db, 'host', e.id, changed.version, 'host-before-reconfirm'), { code: 'HOST_NOT_RECONFIRMED' });
    const { rows: host } = await db.query<{ id: string }>('SELECT id FROM registrations WHERE event_id=$1 AND user_id=$2', [e.id, 'host']);
    await reconfirm(db, 'host', host[0]!.id, changed.version, 'host-reconfirm');
    assert.equal((await confirmEvent(db, 'host', e.id, changed.version, 'host-after-reconfirm')).status, 'CONFIRMED');
  } finally { await db.close(); }
});

test('formation uses confirmed people and cancellation stops new signups', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    await register(db, 'p1', e.id, e.version, 'p1');
    await assert.rejects(() => confirmEvent(db, 'host', e.id, e.version, 'confirm-too-soon'), { code: 'NOT_ENOUGH_PEOPLE' });
    await register(db, 'p2', e.id, e.version, 'p2');
    await register(db, 'p3', e.id, e.version, 'p3');
    const confirmed = await confirmEvent(db, 'host', e.id, e.version, 'confirm');
    assert.equal(confirmed.status, 'CONFIRMED');
    const cancelled = await cancelEvent(db, 'host', e.id, e.version, 'cancel');
    assert.equal(cancelled.status, 'CANCELLED');
    await assert.rejects(() => register(db, 'p4', e.id, e.version, 'late'), { code: 'REGISTRATION_CLOSED' });
  } finally { await db.close(); }
});

test('confirmed activity enters in-progress at its scheduled start without requiring a scan', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, e.id, e.version, `start-${actor}`);
    await confirmEvent(db, 'host', e.id, e.version, 'start-confirm');
    const { rows: startJobs } = await db.query<{ id: string; due_at: Date; payload: { version: number } }>(
      "SELECT id,due_at,payload FROM jobs WHERE event_id=$1 AND kind='EVENT_START'", [e.id]);
    assert.equal(startJobs.length, 1);
    assert.equal(new Date(startJobs[0]!.due_at).toISOString(), e.payload.startAt);
    assert.equal(startJobs[0]!.payload.version, e.version);
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
      [e.id, new Date(Date.now() - 60_000).toISOString()]);
    await db.query('UPDATE jobs SET due_at=now()-interval \'1 second\' WHERE id=$1', [startJobs[0]!.id]);
    await runDueJobs(db);
    const { rows: events } = await db.query<{ status: string; recruiting: boolean }>(
      'SELECT status,recruiting FROM events WHERE id=$1', [e.id]);
    assert.deepEqual(events, [{ status: 'IN_PROGRESS', recruiting: false }]);
    assert.equal((await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action='EVENT_STARTED'", [e.id])).rows[0]?.n, 1);
    await runDueJobs(db);
    assert.equal((await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action='EVENT_STARTED'", [e.id])).rows[0]?.n, 1);
  } finally { await db.close(); }
});

test('an ahead worker clock cannot consume a start job before database time reaches the start', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, e.id, e.version, `ahead-${actor}`);
    await confirmEvent(db, 'host', e.id, e.version, 'ahead-confirm');
    await runDueJobs(db, Date.parse(e.payload.startAt!) + 1000);
    const { rows: jobs } = await db.query<{ status: string; attempts: number }>(
      "SELECT status,attempts FROM jobs WHERE event_id=$1 AND kind='EVENT_START'", [e.id]);
    assert.deepEqual(jobs, [{ status: 'PENDING', attempts: 0 }]);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [e.id])).rows[0]?.status, 'CONFIRMED');
  } finally { await db.close(); }
});

test('a behind worker clock still starts an activity once the database start time has passed', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, e.id, e.version, `behind-${actor}`);
    await confirmEvent(db, 'host', e.id, e.version, 'behind-confirm');
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
      [e.id, new Date(Date.now() - 60_000).toISOString()]);
    await db.query("UPDATE jobs SET due_at=now()-interval '1 minute' WHERE event_id=$1 AND kind='EVENT_START'", [e.id]);
    await runDueJobs(db, Date.now() - 24 * 60 * 60_000);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [e.id])).rows[0]?.status,
      'IN_PROGRESS');
  } finally { await db.close(); }
});

test('a crashed start job is reclaimed after its database lease expires despite a behind worker clock', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, e.id, e.version, `lease-${actor}`);
    await confirmEvent(db, 'host', e.id, e.version, 'lease-confirm');
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
      [e.id, new Date(Date.now() - 60_000).toISOString()]);
    await db.query(`UPDATE jobs SET due_at=now()-interval '1 minute',status='PROCESSING',
      locked_at=now()-interval '6 minutes',claim_token='abandoned-worker' WHERE event_id=$1 AND kind='EVENT_START'`, [e.id]);
    await runDueJobs(db, Date.now() - 24 * 60 * 60_000);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [e.id])).rows[0]?.status,
      'IN_PROGRESS');
    assert.equal((await db.query<{ status: string }>(
      "SELECT status FROM jobs WHERE event_id=$1 AND kind='EVENT_START'", [e.id])).rows[0]?.status, 'DONE');
  } finally { await db.close(); }
});

test('an ahead scan clock cannot start an activity before database time', async () => {
  const db = await createDatabase();
  try {
    const now = Date.now();
    const start = now + 2 * 60 * 60_000;
    const e = await published(db, { startAt: new Date(start).toISOString(),
      endAt: new Date(start + 60 * 60_000).toISOString(),
      registrationDeadline: new Date(start - 30 * 60_000).toISOString(),
      confirmationDeadline: new Date(start - 60 * 60_000).toISOString() });
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, e.id, e.version, `scan-ahead-${actor}`);
    await confirmEvent(db, 'host', e.id, e.version, 'scan-ahead-confirm');
    const at = start + 1000;
    await checkIn(db, 'host', e.id, e.version, createCheckInToken(e.id, 'test-secret', at),
      'test-secret', 'scan-ahead-checkin', at);
    assert.deepEqual((await db.query<{ status: string; recruiting: boolean }>(
      'SELECT status,recruiting FROM events WHERE id=$1', [e.id])).rows,
    [{ status: 'CONFIRMED', recruiting: true }]);
    assert.equal((await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action='EVENT_STARTED'", [e.id])).rows[0]?.n, 0);
  } finally { await db.close(); }
});

test('edited and cancelled activities do not start from stale scheduled jobs', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, e.id, e.version, `stale-start-${actor}`);
    await confirmEvent(db, 'host', e.id, e.version, 'stale-start-confirm');
    const edited = await changeApprovedInvite(db, 'host', e.id, e.version, { title: '新标题' }, 'stale-start-edit');
    const { rows: jobs } = await db.query<{ id: string; payload: { version: number } }>(
      "SELECT id,payload FROM jobs WHERE event_id=$1 AND kind='EVENT_START' ORDER BY created_at,id", [e.id]);
    assert.deepEqual(jobs.map(job => job.payload.version).sort(), [e.version, edited.version]);
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
      [e.id, new Date(Date.now() - 60_000).toISOString()]);
    await db.query("UPDATE jobs SET due_at=now()-interval '1 second' WHERE event_id=$1 AND kind='EVENT_START'", [e.id]);
    await runDueJobs(db);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [e.id])).rows[0]?.status, 'IN_PROGRESS');
    assert.equal((await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action='EVENT_STARTED'", [e.id])).rows[0]?.n, 1);

    const cancelled = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, cancelled.id, cancelled.version, `cancel-start-${actor}`);
    await confirmEvent(db, 'host', cancelled.id, cancelled.version, 'cancel-start-confirm');
    await cancelEvent(db, 'host', cancelled.id, cancelled.version, 'cancel-start');
    await db.query("UPDATE jobs SET due_at=now()-interval '1 second' WHERE event_id=$1 AND kind='EVENT_START'", [cancelled.id]);
    await runDueJobs(db);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [cancelled.id])).rows[0]?.status, 'CANCELLED');
  } finally { await db.close(); }
});

test('check-in is short-lived evidence; completion and repeat create independent draft', async () => {
  const db = await createDatabase();
  try {
    const now = Date.now();
    const start = now + 2 * 60 * 60_000;
    const e = await published(db, {
      startAt: new Date(start).toISOString(), endAt: new Date(start + 60 * 60_000).toISOString(),
      registrationDeadline: new Date(start - 30 * 60_000).toISOString(),
      confirmationDeadline: new Date(start - 60 * 60_000).toISOString(), skillLevel: '中等水平'
    });
    await register(db, 'p1', e.id, e.version, 'p1');
    await register(db, 'p2', e.id, e.version, 'p2');
    await register(db, 'p3', e.id, e.version, 'p3');
    await confirmEvent(db, 'host', e.id, e.version, 'confirm');
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
      [e.id, new Date(Date.now() - 60_000).toISOString()]);
    const at = start + 5 * 60_000;
    const token = createCheckInToken(e.id, 'test-secret', at);
    await assert.rejects(() => checkIn(db, 'stranger', e.id, e.version, token, 'test-secret', 'stranger', at), { code: 'NOT_REGISTERED' });
    const checked = await checkIn(db, 'host', e.id, e.version, token, 'test-secret', 'host-checkin', at);
    assert.equal(checked.evidence, 'SCAN');
    assert.deepEqual((await db.query<{ status: string; recruiting: boolean }>(
      'SELECT status,recruiting FROM events WHERE id=$1', [e.id])).rows,
    [{ status: 'IN_PROGRESS', recruiting: false }]);
    assert.equal((await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action='EVENT_STARTED'", [e.id])).rows[0]?.n, 1);
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text),true) WHERE id=$1",
      [e.id, new Date(Date.now() - 60_000).toISOString()]);
    await db.query("UPDATE jobs SET due_at=now()-interval '1 second' WHERE event_id=$1 AND kind='EVENT_START'", [e.id]);
    await runDueJobs(db);
    assert.equal((await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action='EVENT_STARTED'", [e.id])).rows[0]?.n, 1);
    const bucketStart = Math.floor(at / 60_000) * 60_000 + 1000;
    const expiredToken = createCheckInToken(e.id, 'test-secret', bucketStart);
    await assert.rejects(() => checkIn(db, 'p1', e.id, e.version, expiredToken, 'test-secret', 'expired-checkin', bucketStart + 60_000), { code: 'INVALID_CHECKIN_TOKEN' });
    await moveEventPastEnd(db, e.id);
    const outcome = await completeEvent(db, 'host', e.id, e.version, { held: true, actualCount: 4, issues: [] }, 'complete');
    assert.equal(outcome.held, true);
    const next = await repeatEvent(db, 'host', e.id, 'repeat');
    assert.equal(next.status, 'DRAFT');
    assert.equal(next.payload.startAt, undefined);
    assert.equal(next.payload.venueName, undefined);
    assert.equal(next.payload.feeCapFen, undefined);
    assert.equal(next.payload.templateDurationMinutes, 60);
    assert.equal(next.payload.skillLevel, '中等水平');
    const regCount = await db.query<{ n: string }>('SELECT count(*)::text AS n FROM registrations WHERE event_id=$1', [next.id]);
    assert.equal(regCount.rows[0]?.n, '0');
    const nextStart = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    const saved = await updateDraft(db, 'host', next.id, next.version, { ...input,
      startAt: nextStart.toISOString(), endAt: new Date(nextStart.getTime() + 60 * 60_000).toISOString(),
      registrationDeadline: new Date(nextStart.getTime() - 30 * 60_000).toISOString(),
      confirmationDeadline: new Date(nextStart.getTime() - 90 * 60_000).toISOString() }, 'repeat-new-facts');
    const republished = await publishApprovedInvite(db, 'host', next.id, saved.version, 'repeat-new-publish');
    assert.equal(republished.payload.templateDurationMinutes, undefined);
  } finally { await db.close(); }
});

test('a host can record an activity not held without claiming any attendance', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    await register(db, 'p1', e.id, e.version, 'not-held-p1');
    await register(db, 'p2', e.id, e.version, 'not-held-p2');
    await register(db, 'p3', e.id, e.version, 'not-held-p3');
    await confirmEvent(db, 'host', e.id, e.version, 'not-held-confirm');
    await moveEventPastEnd(db, e.id);
    await assert.rejects(() => completeEvent(db, 'host', e.id, e.version,
      { held: false, actualCount: 1, issues: [] }, 'invalid-not-held'), { code: 'BAD_REQUEST' });
    assert.deepEqual(await completeEvent(db, 'host', e.id, e.version,
      { held: false, actualCount: 0, issues: [] }, 'valid-not-held'),
    { eventId: e.id, held: false, actualCount: 0 });
    const evidence = await getOutcomeEvidence(db, 'host', e.id);
    assert.equal(evidence.level, 'NOT_HELD');
  } finally { await db.close(); }
});

test('completion preserves host issues and venue problems without exposing details to participants', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, event.id, event.version, `issue-${actor}`);
    await confirmEvent(db, 'host', event.id, event.version, 'issue-confirm');
    await moveEventPastEnd(db, event.id);
    await assert.rejects(() => completeEvent(db, 'host', event.id, event.version,
      { held: true, actualCount: 4, issues: [''] }, 'issue-empty'), { code: 'BAD_REQUEST' });
    await assert.rejects(() => completeEvent(db, 'host', event.id, event.version,
      { held: true, actualCount: 4, issues: ['x'.repeat(501)] }, 'issue-long'), { code: 'BAD_REQUEST' });
    const result = await completeEvent(db, 'host', event.id, event.version,
      { held: true, actualCount: 4, issues: ['异常：签到网络中断', '场地问题：入口临时关闭'] }, 'issue-complete');
    assert.equal(result.held, true);
    assert.deepEqual((await db.query<{ issues: string[] }>('SELECT issues FROM outcomes WHERE event_id=$1', [event.id])).rows[0]?.issues,
      ['异常：签到网络中断', '场地问题：入口临时关闭']);
    assert.deepEqual((await getOutcomeEvidence(db, 'host', event.id)).issues,
      ['异常：签到网络中断', '场地问题：入口临时关闭']);
    assert.deepEqual((await getOutcomeEvidence(db, 'p1', event.id)).issues, []);
  } finally { await db.close(); }
});

test('completion cannot commit if the activity end moves past the database clock before the final write', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, event.id, event.version, `complete-race-${actor}`);
    await confirmEvent(db, 'host', event.id, event.version, 'complete-race-confirm');
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{endAt}',to_jsonb($2::text),true) WHERE id=$1",
      [event.id, new Date(Date.now() - 60_000).toISOString()]);
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async (sql, params = []) => {
          if (!crossed && sql.includes('INSERT INTO outcomes')) {
            crossed = true;
            await tx.query("UPDATE events SET payload=jsonb_set(payload,'{endAt}',to_jsonb($2::text),true) WHERE id=$1",
              [event.id, new Date(Date.now() + 60_000).toISOString()]);
          }
          return tx.query(sql, params);
        }
      }))
    };
    await assert.rejects(() => completeEvent(racingDb, 'host', event.id, event.version,
      { held: true, actualCount: 4, issues: [] }, 'complete-race'), { code: 'INVALID_STATE' });
    assert.equal(crossed, true);
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM outcomes WHERE event_id=$1', [event.id])).rows[0]?.n, 0);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [event.id])).rows[0]?.status, 'CONFIRMED');
  } finally { await db.close(); }
});

test('offline attendance correction needs the participant and keeps separate evidence', async () => {
  const db = await createDatabase();
  try {
    const start = Date.now() + 2 * 60 * 60_000;
    const e = await published(db, { startAt: new Date(start).toISOString(), endAt: new Date(start + 60 * 60_000).toISOString(),
      registrationDeadline: new Date(start - 30 * 60_000).toISOString(), confirmationDeadline: new Date(start - 90 * 60_000).toISOString() });
    await register(db, 'p1', e.id, e.version, 'manual-p1');
    await register(db, 'p2', e.id, e.version, 'manual-p2');
    await register(db, 'p3', e.id, e.version, 'manual-p3');
    await confirmEvent(db, 'host', e.id, e.version, 'manual-confirm');
    const at = start + 5 * 60_000;
    await assert.rejects(() => requestManualCheckIn(db, 'p2', e.id, e.version, 'p1', 'forged', at), { code: 'FORBIDDEN' });
    await assert.rejects(() => requestManualCheckIn(db, 'host', e.id, e.version, 'outsider', 'outsider', at), { code: 'NOT_REGISTERED' });
    const pending = await requestManualCheckIn(db, 'host', e.id, e.version, 'p1', 'manual-one', at);
    assert.equal(pending.status, 'PENDING');
    assert.equal((await listManualCheckIns(db, 'p1', e.id)).length, 1);
    assert.equal((await listManualCheckIns(db, 'p2', e.id)).length, 0);
    await assert.rejects(() => respondManualCheckIn(db, 'p2', pending.id, e.version, true, 'fake', at), { code: 'FORBIDDEN' });
    const accepted = await respondManualCheckIn(db, 'p1', pending.id, e.version, true, 'accept', at);
    assert.equal(accepted.status, 'CONFIRMED');
    assert.equal((await respondManualCheckIn(db, 'p1', pending.id, e.version, true, 'accept', at)).status, 'CONFIRMED');
    const { rows } = await db.query<{ evidence: string }>('SELECT evidence FROM checkins WHERE event_id=$1 AND user_id=$2', [e.id, 'p1']);
    assert.equal(rows[0]?.evidence, 'MANUAL_CONFIRMED');
    await assert.rejects(() => requestManualCheckIn(db, 'host', e.id, e.version, 'p1', 'second', at), { code: 'INVALID_STATE' });
    const refused = await requestManualCheckIn(db, 'host', e.id, e.version, 'p2', 'manual-two', at);
    assert.equal((await respondManualCheckIn(db, 'p2', refused.id, e.version, false, 'refuse', at)).status, 'REJECTED');
    assert.equal((await db.query('SELECT 1 FROM checkins WHERE event_id=$1 AND user_id=$2', [e.id, 'p2'])).rows.length, 0);
  } finally { await db.close(); }
});

test('AA expense split stays in integer fen and does not claim payment', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    await register(db, 'p1', e.id, e.version, 'p1');
    await register(db, 'p2', e.id, e.version, 'p2');
    const ledger = await recordExpense(db, 'host', e.id, e.version, 10001, 'expense');
    assert.equal(ledger.shares.reduce((sum, share) => sum + share.amountFen, 0), 10001);
    assert.equal(ledger.shares.length, 3);
    assert.equal(ledger.status, 'RECORD_ONLY');
    await markExpenseShare(db, 'p1', ledger.id, 'p1', e.version, 'PARTICIPANT_HANDLED', true, 'handled');
    const before = await listExpenses(db, 'p1', e.id);
    assert.equal(before[0]?.shares.length, 1);
    assert.equal(before[0]?.shares[0]?.participantHandled, true);
    assert.equal(before[0]?.shares[0]?.hostReceived, false);
    await assert.rejects(() => markExpenseShare(db, 'p2', ledger.id, 'p1', e.version, 'HOST_RECEIVED', true, 'fake-received'), { code: 'FORBIDDEN' });
    await markExpenseShare(db, 'host', ledger.id, 'p1', e.version, 'HOST_RECEIVED', true, 'received');
    const hostView = await listExpenses(db, 'host', e.id);
    assert.equal(hostView[0]?.shares.length, 3);
    assert.equal(hostView[0]?.shares.find(s => s.userId === 'p1')?.hostReceived, true);
  } finally { await db.close(); }
});

test('confirmed member sees an empty expense list before a ledger exists while outsiders are denied', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    await register(db, 'p1', event.id, event.version, 'empty-ledger-p1');
    assert.deepEqual(await listExpenses(db, 'host', event.id), []);
    assert.deepEqual(await listExpenses(db, 'p1', event.id), []);
    await assert.rejects(() => listExpenses(db, 'outsider', event.id), { code: 'FORBIDDEN' });
  } finally { await db.close(); }
});

test('cancelled and removed members cannot read a former expense share', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const leaving = await register(db, 'p1', event.id, event.version, 'former-expense-p1');
    const removed = await register(db, 'p2', event.id, event.version, 'former-expense-p2');
    const ledger = await recordExpense(db, 'host', event.id, event.version, 9000, 'former-expense-ledger');
    assert.equal((await listExpenses(db, 'p1', event.id))[0]?.id, ledger.id);
    await cancelRegistration(db, 'p1', leaving.id, event.version, 'former-expense-leave');
    await removeRegistration(db, 'host', removed.id, event.version, '活动安全原因移除', 'former-expense-remove');
    await assert.rejects(() => listExpenses(db, 'p1', event.id), { code: 'FORBIDDEN' });
    await assert.rejects(() => listExpenses(db, 'p2', event.id), { code: 'FORBIDDEN' });
    await assert.rejects(() => markExpenseShare(db, 'p1', ledger.id, 'p1', event.version,
      'PARTICIPANT_HANDLED', true, 'former-expense-mark-p1'), { code: 'FORBIDDEN' });
    await assert.rejects(() => markExpenseShare(db, 'p2', ledger.id, 'p2', event.version,
      'PARTICIPANT_HANDLED', true, 'former-expense-mark-p2'), { code: 'FORBIDDEN' });
    assert.equal((await listExpenses(db, 'host', event.id))[0]?.id, ledger.id);
  } finally { await db.close(); }
});

test('revising an AA ledger keeps old acknowledgments only as history', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    await register(db, 'p1', e.id, e.version, 'revision-p1');
    await register(db, 'p2', e.id, e.version, 'revision-p2');
    const original = await recordExpense(db, 'host', e.id, e.version, 9000, 'original');
    for (const amount of [-1, 1.5, Number.NaN, '100' as unknown as number])
      await assert.rejects(() => recordExpense(db, 'host', e.id, e.version, amount, `invalid-${String(amount)}`),
        { code: 'BAD_REQUEST' });
    await markExpenseShare(db, 'p1', original.id, 'p1', e.version, 'PARTICIPANT_HANDLED', true, 'old-handled');
    await markExpenseShare(db, 'host', original.id, 'p1', e.version, 'HOST_RECEIVED', true, 'old-received');
    await assert.rejects(() => recordExpense(db, 'host', e.id, e.version, 12000, 'revision-without-version'),
      { code: 'LEDGER_VERSION_CONFLICT' });
    const revised = await recordExpense(db, 'host', e.id, e.version, 12000, 'revision', 1);
    assert.equal(revised.revision, 2);
    const ledgers = await listExpenses(db, 'p1', e.id);
    assert.equal(ledgers.length, 2);
    assert.equal(ledgers[0]?.revision, 2);
    assert.equal(ledgers[0]?.current, true);
    assert.equal(ledgers[0]?.shares[0]?.participantHandled, false);
    assert.equal(ledgers[0]?.shares[0]?.hostReceived, false);
    assert.equal(ledgers[1]?.revision, 1);
    assert.equal(ledgers[1]?.current, false);
    assert.equal(ledgers[1]?.shares[0]?.participantHandled, true);
    assert.equal(ledgers[1]?.shares[0]?.hostReceived, true);
    await assert.rejects(() => markExpenseShare(db, 'p1', original.id, 'p1', e.version,
      'PARTICIPANT_HANDLED', true, 'old-after-revision'), { code: 'LEDGER_SUPERSEDED' });
    await assert.rejects(() => recordExpense(db, 'host', e.id, e.version, 13000, 'stale-revision', 1),
      { code: 'LEDGER_VERSION_CONFLICT' });
  } finally { await db.close(); }
});

test('formation deadline job expires an unconfirmed event and replay stays idempotent', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    await register(db, 'p1', e.id, e.version, 'p1');
    await db.query("UPDATE jobs SET due_at=now()-interval '1 second' WHERE event_id=$1 AND kind='FORMATION_DEADLINE'", [e.id]);
    await runDueJobs(db);
    await runDueJobs(db);
    const state = await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [e.id]);
    assert.equal(state.rows[0]?.status, 'EXPIRED');
    const notifications = await db.query<{ n: string }>("SELECT count(*)::text AS n FROM notifications WHERE event_id=$1 AND kind='EVENT_EXPIRED'", [e.id]);
    assert.equal(notifications.rows[0]?.n, '2');
  } finally { await db.close(); }
});

test('confirmed event shortfall at registration deadline is cancelled with a durable notice', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'p1');
    await register(db, 'p2', e.id, e.version, 'p2');
    await register(db, 'p3', e.id, e.version, 'p3');
    await confirmEvent(db, 'host', e.id, e.version, 'confirm');
    await cancelRegistration(db, 'p1', p1.id, e.version, 'leave');
    await db.query("UPDATE jobs SET due_at=now()-interval '1 second' WHERE event_id=$1 AND kind='REGISTRATION_DEADLINE'", [e.id]);
    await runDueJobs(db);
    const state = await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [e.id]);
    assert.equal(state.rows[0]?.status, 'CANCELLED');
    const notices = await db.query<{ n: string }>("SELECT count(*)::text AS n FROM notifications WHERE event_id=$1 AND kind='EVENT_CANCELLED'", [e.id]);
    assert.equal(notices.rows[0]?.n, '3');
  } finally { await db.close(); }
});

test('late shortfall worker does not normally cancel an activity after it has started', async () => {
  const db = await createDatabase();
  try {
    const e = await published(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'late-shortfall-p1');
    await register(db, 'p2', e.id, e.version, 'late-shortfall-p2');
    await register(db, 'p3', e.id, e.version, 'late-shortfall-p3');
    await confirmEvent(db, 'host', e.id, e.version, 'late-shortfall-confirm');
    await cancelRegistration(db, 'p1', p1.id, e.version, 'late-shortfall-leave');
    const afterStart = Date.parse(e.payload.startAt!) + 60_000;
    await runDueJobs(db, afterStart);
    await runDueJobs(db, afterStart);
    const { rows: states } = await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [e.id]);
    assert.equal(states[0]?.status, 'CONFIRMED');
    const { rows: notices } = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM notifications WHERE event_id=$1 AND kind='EVENT_CANCELLED'", [e.id]);
    assert.equal(notices[0]?.count, 0);
    const { rows: audits } = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM audit WHERE event_id=$1 AND action='SHORTFALL_AFTER_START'", [e.id]);
    assert.equal(audits[0]?.count, 1);
  } finally { await db.close(); }
});

test('shortfall status write checks current database time when a queued worker clock is stale', async () => {
  const db = await createDatabase();
  try {
    const now = Date.now();
    const start = now + 2 * 60 * 60_000;
    const e = await published(db, { startAt: new Date(start).toISOString(), endAt: new Date(start + 2 * 60 * 60_000).toISOString(),
      registrationDeadline: new Date(start - 30 * 60_000).toISOString(),
      confirmationDeadline: new Date(start - 90 * 60_000).toISOString() });
    const p1 = await register(db, 'p1', e.id, e.version, 'stale-clock-p1');
    await register(db, 'p2', e.id, e.version, 'stale-clock-p2');
    await register(db, 'p3', e.id, e.version, 'stale-clock-p3');
    await confirmEvent(db, 'host', e.id, e.version, 'stale-clock-confirm');
    await cancelRegistration(db, 'p1', p1.id, e.version, 'stale-clock-leave');
    await db.query(`UPDATE events SET payload=payload || $2::jsonb WHERE id=$1`, [e.id, JSON.stringify({
      startAt: new Date(now - 60 * 60_000).toISOString(), endAt: new Date(now + 60 * 60_000).toISOString(),
      registrationDeadline: new Date(now - 90 * 60_000).toISOString(),
      confirmationDeadline: new Date(now - 150 * 60_000).toISOString()
    })]);
    await db.query("UPDATE jobs SET due_at=$2 WHERE event_id=$1 AND kind='REGISTRATION_DEADLINE'",
      [e.id, new Date(now - 3 * 60 * 60_000).toISOString()]);
    await runDueJobs(db, now - 2 * 60 * 60_000);
    const { rows } = await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [e.id]);
    assert.equal(rows[0]?.status, 'CONFIRMED');
  } finally { await db.close(); }
});

test('independent participant dispute prevents a completed event from being treated as corroborated', async () => {
  const db = await createDatabase();
  try {
    const now = Date.now(); const start = now + 2 * 60 * 60_000;
    const e = await published(db, { startAt: new Date(start).toISOString(), endAt: new Date(start + 60 * 60_000).toISOString(),
      registrationDeadline: new Date(start - 30 * 60_000).toISOString(), confirmationDeadline: new Date(start - 90 * 60_000).toISOString() });
    await register(db, 'p1', e.id, e.version, 'p1');
    await register(db, 'p2', e.id, e.version, 'p2');
    await register(db, 'p3', e.id, e.version, 'p3');
    await confirmEvent(db, 'host', e.id, e.version, 'confirm');
    await moveEventPastEnd(db, e.id);
    await completeEvent(db, 'host', e.id, e.version, { held: true, actualCount: 4, issues: [] }, 'complete');
    assert.equal((await getOutcomeEvidence(db, 'p1', e.id)).level, 'HOST_ONLY');
    await assert.rejects(() => recordOutcomeFeedback(db, 'outsider', e.id, e.version, { held: false, wouldRepeat: false, reason: '现场没有活动' }, 'fake'), { code: 'FORBIDDEN' });
    await recordOutcomeFeedback(db, 'p1', e.id, e.version, { held: false, wouldRepeat: false, reason: '现场没有活动' }, 'feedback');
    const outcome = await getOutcomeEvidence(db, 'p2', e.id);
    assert.equal(outcome.level, 'DISPUTED');
    assert.equal(outcome.disputed, true);
    const { rows: reports } = await db.query<{ n: string }>("SELECT count(*)::text AS n FROM reports WHERE event_id=$1 AND kind='ATTENDANCE'", [e.id]);
    assert.equal(reports[0]?.n, '1');
  } finally { await db.close(); }
});

test('repeat candidates include only participants who separately opted in', async () => {
  const db = await createDatabase();
  try {
    const now = Date.now(); const start = now + 2 * 60 * 60_000;
    const e = await published(db, { startAt: new Date(start).toISOString(), endAt: new Date(start + 60 * 60_000).toISOString(),
      registrationDeadline: new Date(start - 30 * 60_000).toISOString(), confirmationDeadline: new Date(start - 90 * 60_000).toISOString() });
    await register(db, 'p1', e.id, e.version, 'repeat-p1');
    await register(db, 'p2', e.id, e.version, 'repeat-p2');
    await register(db, 'p3', e.id, e.version, 'repeat-p3');
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','repeat-p1-openid')");
    await setConsent(db, 'p1', 'SIMILAR_ACTIVITY_INVITES', true, 'repeat-optin');
    await setConsent(db, 'p2', 'SIMILAR_ACTIVITY_INVITES', false, 'repeat-optout');
    await confirmEvent(db, 'host', e.id, e.version, 'repeat-confirm');
    await moveEventPastEnd(db, e.id);
    await completeEvent(db, 'host', e.id, e.version, { held: true, actualCount: 4, issues: [] }, 'repeat-complete');
    await assert.rejects(() => listRepeatCandidates(db, 'p1', e.id), { code: 'FORBIDDEN' });
    assert.deepEqual(await listRepeatCandidates(db, 'host', e.id), ['p1']);
    await db.query("UPDATE notification_consents SET notice_version=NULL WHERE user_id='p1' AND purpose='SIMILAR_ACTIVITY_INVITES'");
    assert.deepEqual(await listRepeatCandidates(db, 'host', e.id), []);
    await setConsent(db, 'p1', 'SIMILAR_ACTIVITY_INVITES', true, 'repeat-reconfirm');
    assert.deepEqual(await listRepeatCandidates(db, 'host', e.id), ['p1']);
    await db.query("UPDATE users SET status='DISABLED' WHERE id='p1'");
    assert.deepEqual(await listRepeatCandidates(db, 'host', e.id), [],
      'disabled account must not remain visible from a previous opt-in');
    await db.query("UPDATE users SET status='ACTIVE' WHERE id='p1'");
    assert.deepEqual(await listRepeatCandidates(db, 'host', e.id), ['p1']);
    await db.query("INSERT INTO privacy_requests(id,user_id,kind) VALUES('repeat-delete-p1','p1','DELETE')");
    assert.deepEqual(await listRepeatCandidates(db, 'host', e.id), [],
      'an active account with old invite consent is hidden after requesting deletion');
    await setConsent(db, 'p1', 'SIMILAR_ACTIVITY_INVITES', false, 'repeat-withdraw');
    assert.deepEqual(await listRepeatCandidates(db, 'host', e.id), []);
  } finally { await db.close(); }
});
