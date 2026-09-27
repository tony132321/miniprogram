import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase, type Database } from '../src/db.ts';
import { createDraft, getEvent, publishEvent, rotateInvite, updateDraft, type EventInput } from '../src/events.ts';
import { cancelRegistration } from '../src/registrations.ts';
import { publishApprovedInvite, register } from './helpers.ts';

const valid = {
  title: '周六羽毛球', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共羽毛球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'AA', feeCapFen: 5000,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO',
  hostParticipates: true
};

test('publishing a host-confirmed venue records a source-labeled statement before formation', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', valid, 'venue-publish-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'venue-publish');
    await publishEvent(db, 'host', draft.id, draft.version, 'venue-publish');
    const { rows } = await db.query<{ phase: string; venue_name: string; recorded_by: string }>(
      'SELECT phase,venue_name,recorded_by FROM venue_evidence WHERE event_id=$1', [event.id]);
    assert.deepEqual(rows, [{ phase: 'PUBLISH', venue_name: '公共羽毛球馆', recorded_by: 'host' }]);
    const viewed = await getEvent(db, 'host', event.id);
    assert.equal(viewed.venueEvidence?.sourceType, 'HOST_STATEMENT');
    assert.equal(viewed.venueEvidence?.phase, 'PUBLISH');
  } finally { await db.close(); }
});

test('draft persists and only host can see private draft', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host-1', { title: '未完成' }, 'draft-1');
    assert.equal((await getEvent(db, 'host-1', draft.id)).status, 'DRAFT');
    await assert.rejects(() => getEvent(db, 'other', draft.id), { code: 'FORBIDDEN' });
  } finally { await db.close(); }
});

test('draft saves valid partial fields but rejects supplied invalid values without changing a saved draft', async () => {
  const db = await createDatabase();
  try {
    const partial = await createDraft(db, 'host-1', { title: '待补全', startAt: valid.startAt }, 'partial-create');
    assert.equal(partial.status, 'DRAFT');
    for (const [index, patch] of [
      { feeMode: 'AA', feeCapFen: -1 },
      { startAt: '2027-02-30T12:00:00.000Z' },
      { startAt: valid.endAt, endAt: valid.startAt },
      { minParticipants: 6, maxParticipants: 4 },
      { title: 123 }, { skillLevel: '水平'.repeat(21) }, { skillLevel: '   ' }
    ].entries()) {
      await assert.rejects(() => createDraft(db, 'host-1', patch as unknown as EventInput, `invalid-create-${index}`),
        { code: 'INVALID_EVENT' });
      await assert.rejects(() => updateDraft(db, 'host-1', partial.id, partial.version, patch as unknown as EventInput,
        `invalid-update-${index}`), { code: 'INVALID_EVENT' });
    }
    const unchanged = await getEvent(db, 'host-1', partial.id);
    assert.equal(unchanged.version, partial.version);
    assert.deepEqual(unchanged.payload, partial.payload);
    const completed = await updateDraft(db, 'host-1', partial.id, partial.version,
      { endAt: valid.endAt, city: '深圳' }, 'partial-complete');
    assert.equal(completed.version, partial.version + 1);
    assert.equal(completed.payload.endAt, valid.endAt);
  } finally { await db.close(); }
});

test('a person who leaves an invite-only event loses access to member details', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host-1', valid, 'exit-draft');
    const event = await publishApprovedInvite(db, 'host-1', draft.id, draft.version, 'exit-publish');
    const registration = await register(db, 'p1', event.id, event.version, 'exit-join');
    assert.equal((await getEvent(db, 'p1', event.id)).id, event.id);
    await cancelRegistration(db, 'p1', registration.id, event.version, 'exit');
    await assert.rejects(() => getEvent(db, 'p1', event.id), { code: 'FORBIDDEN' });
  } finally { await db.close(); }
});

test('publication validates dates and required venue evidence', async () => {
  const db = await createDatabase();
  try {
    await assert.rejects(() => createDraft(db, 'host-1', { ...valid, endAt: valid.startAt }, 'bad-1'), { code: 'INVALID_EVENT' });
    const noVenue = await createDraft(db, 'host-1', { ...valid, venueStatus: 'UNCONFIRMED' }, 'bad-2');
    await assert.rejects(() => publishEvent(db, 'host-1', noVenue.id, noVenue.version, 'pub-2'), { code: 'INVALID_EVENT' });
    await assert.rejects(() => createDraft(db, 'host-1', { ...valid, startAt: '2027-01-02T12:00:00' }, 'bad-3'),
      { code: 'INVALID_EVENT' });
    await assert.rejects(() => createDraft(db, 'host-1', { ...valid, startAt: '2027-02-30T12:00:00.000Z' }, 'bad-4'),
      { code: 'INVALID_EVENT' });
    const now = Date.now();
    const past = await createDraft(db, 'host-1', { ...valid, startAt: new Date(now - 60 * 60_000).toISOString(), endAt: new Date(now + 60 * 60_000).toISOString(),
      registrationDeadline: new Date(now - 2 * 60 * 60_000).toISOString(), confirmationDeadline: new Date(now - 3 * 60 * 60_000).toISOString() }, 'bad-5');
    await assert.rejects(() => publishEvent(db, 'host-1', past.id, past.version, 'pub-5'), { code: 'INVALID_EVENT' });
  } finally { await db.close(); }
});

test('publishing uses database time when the application clock is behind the confirmation deadline', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host-1', valid, 'publish-db-clock-draft');
    const lateDatabaseClock = new Date(Date.parse(valid.confirmationDeadline) + 1000);
    const clockDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
          sql === 'SELECT clock_timestamp() AS current_time'
            ? Promise.resolve({ rows: [{ current_time: lateDatabaseClock } as unknown as T] })
            : tx.query(sql, params)
      }))
    };
    await assert.rejects(() => publishEvent(clockDb, 'host-1', draft.id, draft.version, 'publish-db-clock'),
      { code: 'INVALID_EVENT' });
    assert.equal((await getEvent(db, 'host-1', draft.id)).status, 'DRAFT');
  } finally { await db.close(); }
});

test('publishing cannot write a recruiting event if its confirmation deadline passes before the final update', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host-1', valid, 'publish-write-clock-draft');
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async (sql, params = []) => {
          if (!crossed && sql.startsWith("UPDATE events SET status='RECRUITING'")) {
            crossed = true;
            await tx.query("UPDATE events SET payload=jsonb_set(payload,'{confirmationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
              [draft.id, new Date(Date.now() - 1000).toISOString()]);
          }
          return tx.query(sql, params);
        }
      }))
    };
    await assert.rejects(() => publishEvent(racingDb, 'host-1', draft.id, draft.version, 'publish-write-clock'),
      { code: 'INVALID_EVENT' });
    assert.equal(crossed, true);
    assert.equal((await getEvent(db, 'host-1', draft.id)).status, 'DRAFT');
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM registrations WHERE event_id=$1',
      [draft.id])).rows[0]?.n, 0);
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM jobs WHERE event_id=$1',
      [draft.id])).rows[0]?.n, 0);
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action IN ('PUBLISH','SUBMIT_PUBLIC_REVIEW','REGISTER_CONFIRMED')",
      [draft.id])).rows[0]?.n, 0);
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM idempotency WHERE actor_id=$1 AND route=$2',
      ['host-1', `publish:${draft.id}`])).rows[0]?.n, 0);
  } finally { await db.close(); }
});

test('publication rejects wrongly typed draft fields with a business error', async () => {
  const db = await createDatabase();
  try {
    for (const [index, patch] of [
      { title: 123 }, { city: [] }, { venueName: { text: '球馆' } },
      { startAt: 123 }, { endAt: {} }, { registrationDeadline: false },
      { confirmationDeadline: [] }, { cancellationRule: 123 }, { skillLevel: 123 }
    ].entries()) {
      const draft = await createDraft(db, 'host-1', valid, `wrong-type-${index}`);
      await db.query('UPDATE events SET payload=payload || $2::jsonb WHERE id=$1', [draft.id, JSON.stringify(patch)]);
      await assert.rejects(() => publishEvent(db, 'host-1', draft.id, draft.version, `wrong-publish-${index}`),
        { code: 'INVALID_EVENT' });
    }
  } finally { await db.close(); }
});

test('invite rotation uses database time and rejects a closed registration window', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host-1', valid, 'rotate-db-clock-draft');
    const event = await publishApprovedInvite(db, 'host-1', draft.id, draft.version, 'rotate-db-clock-publish');
    const lateDatabaseClock = new Date(Date.parse(valid.registrationDeadline) + 1000);
    const clockDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
          sql === 'SELECT clock_timestamp() AS current_time'
            ? Promise.resolve({ rows: [{ current_time: lateDatabaseClock } as unknown as T] })
            : tx.query(sql, params)
      }))
    };
    await assert.rejects(() => rotateInvite(clockDb, 'host-1', event.id, event.version, 'rotate-db-clock'),
      { code: 'INVALID_STATE' });
    assert.equal((await getEvent(db, 'host-1', event.id)).inviteToken, event.inviteToken);
  } finally { await db.close(); }
});

test('invite rotation cannot commit if registration closes before token replacement', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host-1', valid, 'rotate-write-clock-draft');
    const event = await publishApprovedInvite(db, 'host-1', draft.id, draft.version, 'rotate-write-clock-publish');
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async (sql, params = []) => {
          if (!crossed && sql.startsWith('UPDATE events SET invite_token=$2')) {
            crossed = true;
            await tx.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
              [event.id, new Date(Date.now() - 1000).toISOString()]);
          }
          return tx.query(sql, params);
        }
      }))
    };
    await assert.rejects(() => rotateInvite(racingDb, 'host-1', event.id, event.version, 'rotate-write-clock'),
      { code: 'INVALID_STATE' });
    assert.equal(crossed, true);
    assert.equal((await getEvent(db, 'host-1', event.id)).inviteToken, event.inviteToken);
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action='ROTATE_INVITE'",
      [event.id])).rows[0]?.n, 0);
  } finally { await db.close(); }
});

test('publish replay returns the first result and stale version conflicts', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host-1', valid, 'draft-1');
    const first = await publishEvent(db, 'host-1', draft.id, draft.version, 'publish-1');
    const replay = await publishEvent(db, 'host-1', draft.id, draft.version, 'publish-1');
    assert.deepEqual(replay, first);
    assert.equal(first.status, 'RECRUITING');
    await assert.rejects(() => publishEvent(db, 'host-1', draft.id, draft.version, 'publish-2'), { code: 'VERSION_CONFLICT' });
  } finally { await db.close(); }
});

test('host can complete an incomplete draft before publication', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host-1', { title: '待补充' }, 'incomplete');
    await assert.rejects(() => updateDraft(db, 'other', draft.id, draft.version, valid, 'other-edit'), { code: 'FORBIDDEN' });
    const updated = await updateDraft(db, 'host-1', draft.id, draft.version, valid, 'complete-draft');
    assert.equal(updated.version, draft.version + 1);
    const published = await publishEvent(db, 'host-1', draft.id, updated.version, 'publish-complete');
    assert.equal(published.payload.venueName, valid.venueName);
  } finally { await db.close(); }
});

test('publication requires an explicit host seat choice and counts no as zero host seats', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host-1', { ...valid, hostParticipates: undefined }, 'host-seat-draft');
    await assert.rejects(() => publishEvent(db, 'host-1', draft.id, draft.version, 'host-seat-premature'),
      { code: 'INVALID_EVENT' });
    const optedOut = await updateDraft(db, 'host-1', draft.id, draft.version, { hostParticipates: false }, 'host-seat-no');
    await publishEvent(db, 'host-1', draft.id, optedOut.version, 'host-seat-publish');
    const { rows } = await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM registrations WHERE event_id=$1 AND user_id=$2', [draft.id, 'host-1']);
    assert.equal(rows[0]?.count, 0);
  } finally { await db.close(); }
});
