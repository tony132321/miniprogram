import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import type { Database } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { publishApprovedInvite } from './helpers.ts';
import { cancelRegistration, removeRegistration, acceptOffer, declineOffer, expireOffers, reserveSeats, claimReservation, approveRegistration, expireReservations, expressInterest, register as registerWithInvite } from '../src/registrations.ts';
import { register } from './helpers.ts';
import { cancelEvent } from '../src/lifecycle.ts';

const input = {
  title: '公开场馆羽毛球', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共羽毛球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 4, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'AA', feeCapFen: 5000,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO',
  hostParticipates: true
};

async function event(db: Awaited<ReturnType<typeof createDatabase>>) {
  const draft = await createDraft(db, 'host', input, 'draft');
  return publishApprovedInvite(db, 'host', draft.id, draft.version, 'publish');
}

test('an expired invite cannot register or express interest when application time lags database time', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    await db.query('UPDATE events SET invite_expires_at=$2 WHERE id=$1',
      [e.id, new Date(Date.now() - 60_000).toISOString()]);
    const actualNow = Date.now;
    const databaseClock = new Date(actualNow());
    const clockDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
          sql === 'SELECT clock_timestamp() AS current_time'
          ? Promise.resolve({ rows: [{ current_time: databaseClock } as unknown as T] })
          : tx.query(sql, params)
      }))
    };
    Date.now = () => actualNow() - 24 * 60 * 60_000;
    try {
      await assert.rejects(() => registerWithInvite(clockDb, 'stale-register', e.id, e.version,
        'expired-invite-register', e.inviteToken ?? null), { code: 'FORBIDDEN' });
      await assert.rejects(() => expressInterest(clockDb, 'stale-interest', e.id, e.version,
        'expired-invite-interest', e.inviteToken ?? null), { code: 'FORBIDDEN' });
    } finally { Date.now = actualNow; }
    const { rows } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND user_id IN ('stale-register','stale-interest')", [e.id]);
    assert.equal(rows[0]?.n, 0);
  } finally { await db.close(); }
});

test('a fast application clock does not close registration or interest before the database deadline', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const actualNow = Date.now;
    const fastNow = () => actualNow() + 2 * 365 * 24 * 60 * 60_000;
    const clockDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
          Date.now = actualNow;
          try { return await tx.query<T>(sql, params); }
          finally { Date.now = fastNow; }
        }
      }))
    };
    Date.now = fastNow;
    try {
      const joined = await registerWithInvite(clockDb, 'fast-clock-member', e.id, e.version,
        'fast-clock-register', e.inviteToken ?? null);
      assert.equal(joined.status, 'CONFIRMED');
      const interested = await expressInterest(clockDb, 'fast-clock-interested', e.id, e.version,
        'fast-clock-interest', e.inviteToken ?? null);
      assert.equal(interested.status, 'INTERESTED');
    } finally { Date.now = actualNow; }
  } finally { await db.close(); }
});

test('a fast application clock does not deny an eligible exit or host removal', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const leaving = await registerWithInvite(db, 'fast-exit', e.id, e.version, 'fast-exit-join', e.inviteToken ?? null);
    const removed = await registerWithInvite(db, 'fast-remove', e.id, e.version, 'fast-remove-join', e.inviteToken ?? null);
    const actualNow = Date.now;
    const fastNow = () => actualNow() + 2 * 365 * 24 * 60 * 60_000;
    const clockDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
          Date.now = actualNow;
          try { return await tx.query<T>(sql, params); }
          finally { Date.now = fastNow; }
        }
      }))
    };
    Date.now = fastNow;
    try {
      assert.equal((await cancelRegistration(clockDb, 'fast-exit', leaving.id, e.version, 'fast-exit-leave')).status, 'CANCELLED');
      assert.equal((await removeRegistration(clockDb, 'host', removed.id, e.version,
        '报名条件需要人工复核', 'fast-remove-action')).status, 'REMOVED');
    } finally { Date.now = actualNow; }
  } finally { await db.close(); }
});

test('exit and host removal crossing the start boundary roll back without changing the member', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    for (const action of ['CANCELLED', 'REMOVED'] as const) {
      const actor = action === 'CANCELLED' ? 'boundary-exit' : 'boundary-remove';
      const registration = await registerWithInvite(db, actor, e.id, e.version, `join-${actor}`, e.inviteToken ?? null);
      let crossed = false;
      const racingDb: Database = {
        ...db,
        transaction: fn => db.transaction(tx => fn({
          query: async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
            if (!crossed && sql.includes(`UPDATE registrations SET status='${action}'`)) {
              crossed = true;
              await tx.query("UPDATE events SET payload=jsonb_set(payload,'{startAt}',to_jsonb($2::text)) WHERE id=$1",
                [e.id, new Date(Date.now() - 1000).toISOString()]);
            }
            return tx.query<T>(sql, params);
          }
        }))
      };
      const attempt = action === 'CANCELLED'
        ? () => cancelRegistration(racingDb, actor, registration.id, e.version, `late-${actor}`)
        : () => removeRegistration(racingDb, 'host', registration.id, e.version,
          '需要核对该参与者的报名资格', `late-${actor}`);
      await assert.rejects(attempt, { code: 'INVALID_STATE' });
      assert.equal(crossed, true);
      assert.equal((await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1', [registration.id])).rows[0]?.status,
        'CONFIRMED');
    }
    assert.equal((await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM registration_removals WHERE event_id=$1', [e.id])).rows[0]?.count, 0);
  } finally { await db.close(); }
});

test('invite expiry at registration write leaves no seat or interest', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    for (const [actor, interest] of [['invite-race-register', false], ['invite-race-interest', true]] as const) {
      let crossed = false;
      const racingDb: Database = {
        ...db,
        transaction: fn => db.transaction(tx => fn({
          query: async (sql, params = []) => {
            if (!crossed && sql.startsWith('INSERT INTO registrations(id,event_id,user_id,status')) {
              crossed = true;
              await tx.query("UPDATE events SET invite_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [e.id]);
            }
            return tx.query(sql, params);
          }
        }))
      };
      const write = () => interest
        ? expressInterest(racingDb, actor, e.id, e.version, actor, e.inviteToken ?? null)
        : registerWithInvite(racingDb, actor, e.id, e.version, actor, e.inviteToken ?? null);
      await assert.rejects(write, { code: 'REGISTRATION_CLOSED' });
      assert.equal(crossed, true);
      assert.equal((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND user_id=$2',
        [e.id, actor])).rows[0]?.n, 0);
      await db.query('UPDATE events SET invite_expires_at=$2 WHERE id=$1',
        [e.id, new Date(Date.now() + 24 * 60 * 60_000).toISOString()]);
    }
  } finally { await db.close(); }
});

test('first registration crossing the deadline before insert leaves no record or side effects', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async (sql, params = []) => {
          if (!crossed && sql.startsWith('INSERT INTO registrations(id,event_id,user_id,status,accepted_version)')) {
            crossed = true;
            await tx.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
              [e.id, new Date(Date.now() - 1000).toISOString()]);
          }
          return tx.query(sql, params);
        }
      }))
    };
    await assert.rejects(() => register(racingDb, 'late-first', e.id, e.version, 'late-first'),
      { code: 'REGISTRATION_CLOSED' });
    assert.equal(crossed, true);
    const { rows: registrations } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND user_id='late-first'", [e.id]);
    assert.equal(registrations[0]?.n, 0);
    const { rows: audits } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND actor_id='late-first'", [e.id]);
    assert.equal(audits[0]?.n, 0);
    const { rows: notifications } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM notifications WHERE event_id=$1 AND user_id='late-first'", [e.id]);
    assert.equal(notifications[0]?.n, 0);
  } finally { await db.close(); }
});

test('rejoining registration crossing the deadline before update stays cancelled', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const first = await register(db, 'late-rejoin', e.id, e.version, 'late-rejoin-first');
    await cancelRegistration(db, 'late-rejoin', first.id, e.version, 'late-rejoin-cancel');
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async (sql, params = []) => {
          if (!crossed && sql.startsWith('UPDATE registrations SET status=$2,accepted_version=$3')) {
            crossed = true;
            await tx.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
              [e.id, new Date(Date.now() - 1000).toISOString()]);
          }
          return tx.query(sql, params);
        }
      }))
    };
    await assert.rejects(() => register(racingDb, 'late-rejoin', e.id, e.version, 'late-rejoin-second'),
      { code: 'REGISTRATION_CLOSED' });
    assert.equal(crossed, true);
    const { rows } = await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1', [first.id]);
    assert.equal(rows[0]?.status, 'CANCELLED');
  } finally { await db.close(); }
});

test('first pending interest crossing the deadline before insert is rejected', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({ query: async (sql, params = []) => {
        if (!crossed && sql.startsWith('INSERT INTO registrations(id,event_id,user_id,status)')) {
          crossed = true;
          await tx.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
            [e.id, new Date(Date.now() - 1000).toISOString()]);
        }
        return tx.query(sql, params);
      } }))
    };
    await assert.rejects(() => expressInterest(racingDb, 'late-interest', e.id, e.version, 'late-interest', e.inviteToken ?? null),
      { code: 'REGISTRATION_CLOSED' });
    assert.equal(crossed, true);
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND user_id='late-interest'",
      [e.id])).rows[0]?.n, 0);
  } finally { await db.close(); }
});

test('renewed pending interest crossing the deadline before update remains cancelled', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const first = await expressInterest(db, 'late-interest-return', e.id, e.version, 'interest-first', e.inviteToken ?? null);
    await cancelRegistration(db, 'late-interest-return', first.id, e.version, 'interest-cancel');
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({ query: async (sql, params = []) => {
        if (!crossed && sql.startsWith("UPDATE registrations SET status='INTERESTED'")) {
          crossed = true;
          await tx.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
            [e.id, new Date(Date.now() - 1000).toISOString()]);
        }
        return tx.query(sql, params);
      } }))
    };
    await assert.rejects(() => expressInterest(racingDb, 'late-interest-return', e.id, e.version, 'interest-return', e.inviteToken ?? null),
      { code: 'REGISTRATION_CLOSED' });
    assert.equal(crossed, true);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1',
      [first.id])).rows[0]?.status, 'CANCELLED');
  } finally { await db.close(); }
});

test('100 concurrent contenders cannot oversubscribe the final seat', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    await register(db, 'p1', e.id, e.version, 'p1');
    await register(db, 'p2', e.id, e.version, 'p2');
    const outcomes = await Promise.all(Array.from({ length: 100 }, (_, i) => register(db, `r${i}`, e.id, e.version, `r${i}`)));
    assert.equal(outcomes.filter(x => x.status === 'CONFIRMED').length, 1);
    assert.equal(outcomes.filter(x => x.status === 'WAITLISTED').length, 99);
    const rows = await db.query<{ n: string }>("SELECT count(*)::text AS n FROM registrations WHERE event_id=$1 AND status='CONFIRMED'", [e.id]);
    assert.equal(rows.rows[0]?.n, '4');
  } finally { await db.close(); }
});

test('duplicate request and cancelled seat produce one FIFO offer that needs acceptance', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'p1');
    await register(db, 'p2', e.id, e.version, 'p2');
    await register(db, 'p3', e.id, e.version, 'p3');
    const w1 = await register(db, 'w1', e.id, e.version, 'w1');
    const w2 = await register(db, 'w2', e.id, e.version, 'w2');
    assert.deepEqual(await register(db, 'w1', e.id, e.version, 'w1'), w1);
    const cancelled = await cancelRegistration(db, 'p1', p1.id, e.version, 'cancel-p1');
    assert.equal(cancelled.status, 'CANCELLED');
    const offers = await db.query<{ registration_id: string; id: string }>("SELECT id,registration_id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id]);
    assert.equal(offers.rows.length, 1);
    assert.equal(offers.rows[0]?.registration_id, w1.id);
    const accepted = await acceptOffer(db, 'w1', offers.rows[0]!.id, e.version, 'accept-w1');
    assert.equal(accepted.status, 'CONFIRMED');
    const stillWaiting = await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1', [w2.id]);
    assert.equal(stillWaiting.rows[0]?.status, 'WAITLISTED');
  } finally { await db.close(); }
});

test('an offer expiring after validation cannot be accepted at the token update', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const first = await register(db, 'p1', e.id, e.version, 'expiry-race-p1');
    for (const actor of ['p2', 'p3', 'w1']) await register(db, actor, e.id, e.version, `expiry-race-${actor}`);
    await cancelRegistration(db, 'p1', first.id, e.version, 'expiry-race-release');
    const { rows: offers } = await db.query<{ id: string; registration_id: string }>(
      "SELECT id,registration_id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id]);
    const offer = offers[0]!;
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async (sql, params = []) => {
          if (!crossed && sql.startsWith("UPDATE offers SET status='ACCEPTED'")) {
            crossed = true;
            await tx.query("UPDATE offers SET expires_at=now()-interval '1 second' WHERE id=$1", [offer.id]);
          }
          return tx.query(sql, params);
        }
      }))
    };
    await assert.rejects(() => acceptOffer(racingDb, 'w1', offer.id, e.version, 'expiry-race-accept'),
      { code: 'OFFER_UNAVAILABLE' });
    assert.equal(crossed, true);
    const { rows: after } = await db.query<{ status: string; registration_status: string }>(
      'SELECT o.status,r.status AS registration_status FROM offers o JOIN registrations r ON r.id=o.registration_id WHERE o.id=$1', [offer.id]);
    assert.deepEqual(after[0], { status: 'ACTIVE', registration_status: 'OFFERED' });
  } finally { await db.close(); }
});

test('declining a valid offer advances FIFO once and never puts the decliner back on the waitlist', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'decline-p1');
    await register(db, 'p2', e.id, e.version, 'decline-p2');
    await register(db, 'p3', e.id, e.version, 'decline-p3');
    const w1 = await register(db, 'w1', e.id, e.version, 'decline-w1');
    const w2 = await register(db, 'w2', e.id, e.version, 'decline-w2');
    await cancelRegistration(db, 'p1', p1.id, e.version, 'decline-release-seat');
    const { rows: firstOffers } = await db.query<{ id: string; registration_id: string }>(
      "SELECT id,registration_id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id]);
    assert.equal(firstOffers[0]?.registration_id, w1.id);
    const offerId = firstOffers[0]!.id;
    await assert.rejects(() => declineOffer(db, 'w2', offerId, e.version, 'decline-forged'), { code: 'FORBIDDEN' });
    const declined = await declineOffer(db, 'w1', offerId, e.version, 'decline-owner');
    assert.deepEqual(declined, { id: offerId, status: 'DECLINED' });
    assert.deepEqual(await declineOffer(db, 'w1', offerId, e.version, 'decline-owner'), declined);
    assert.deepEqual(await declineOffer(db, 'w1', offerId, e.version, 'decline-again'), declined);
    const { rows: offers } = await db.query<{ id: string; registration_id: string; status: string }>(
      'SELECT id,registration_id,status FROM offers WHERE event_id=$1 ORDER BY created_at,id', [e.id]);
    assert.equal(offers.filter(row => row.status === 'ACTIVE').length, 1);
    assert.equal(offers.find(row => row.status === 'ACTIVE')?.registration_id, w2.id);
    assert.equal(offers.find(row => row.id === offerId)?.status, 'DECLINED');
    const { rows: registration } = await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1', [w1.id]);
    assert.equal(registration[0]?.status, 'CANCELLED');
  } finally { await db.close(); }
});

test('equal waitlist timestamps keep database enqueue order instead of sorting random registration ids', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'tie-p1');
    await register(db, 'p2', e.id, e.version, 'tie-p2');
    await register(db, 'p3', e.id, e.version, 'tie-p3');
    const w1 = await register(db, 'w1', e.id, e.version, 'tie-w1');
    const w2 = await register(db, 'w2', e.id, e.version, 'tie-w2');
    await db.query("UPDATE registrations SET id='z-w1',created_at='2026-01-01T00:00:00Z' WHERE id=$1", [w1.id]);
    await db.query("UPDATE registrations SET id='a-w2',created_at='2026-01-01T00:00:00Z' WHERE id=$1", [w2.id]);
    const { rows: history } = await db.query<{ registration_id: string }>(
      "SELECT registration_id FROM registration_status_history WHERE registration_id IN ('z-w1','a-w2') ORDER BY registration_id");
    assert.deepEqual(history.map(row => row.registration_id), ['a-w2', 'z-w1']);
    await cancelRegistration(db, 'p1', p1.id, e.version, 'tie-release');
    const { rows } = await db.query<{ registration_id: string }>("SELECT registration_id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id]);
    assert.equal(rows[0]?.registration_id, 'z-w1');
  } finally { await db.close(); }
});

test('a cancelled waitlisted member rejoins at the back of the queue', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'rejoin-p1');
    await register(db, 'p2', e.id, e.version, 'rejoin-p2');
    await register(db, 'p3', e.id, e.version, 'rejoin-p3');
    const w1 = await register(db, 'w1', e.id, e.version, 'rejoin-w1');
    await register(db, 'w2', e.id, e.version, 'rejoin-w2');
    await cancelRegistration(db, 'w1', w1.id, e.version, 'rejoin-cancel');
    await register(db, 'w1', e.id, e.version, 'rejoin-again');
    await cancelRegistration(db, 'p1', p1.id, e.version, 'rejoin-release');
    const { rows } = await db.query<{ user_id: string }>(
      "SELECT r.user_id FROM offers o JOIN registrations r ON r.id=o.registration_id WHERE o.event_id=$1 AND o.status='ACTIVE'", [e.id]);
    assert.deepEqual(rows.map(row => row.user_id), ['w2']);
  } finally { await db.close(); }
});

test('a seat released 4 minutes 59 seconds before cutoff creates host work and no new offer', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'window-p1');
    const p2 = await register(db, 'p2', e.id, e.version, 'window-p2');
    await register(db, 'p3', e.id, e.version, 'window-p3');
    await register(db, 'w1', e.id, e.version, 'window-w1');
    const deadline = new Date(Date.now() + 4 * 60_000 + 59_000).toISOString();
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',$2::jsonb) WHERE id=$1", [e.id, JSON.stringify(deadline)]);
    await cancelRegistration(db, 'p1', p1.id, e.version, 'window-release');
    await cancelRegistration(db, 'p2', p2.id, e.version, 'window-release-again');
    const { rows: offers } = await db.query<{ id: string }>("SELECT id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id]);
    assert.equal(offers.length, 0);
    const { rows: hostWork } = await db.query<{ kind: string }>(
      "SELECT kind FROM notifications WHERE event_id=$1 AND user_id='host' AND kind='WAITLIST_WINDOW_CLOSED'", [e.id]);
    assert.equal(hostWork.length, 1);
  } finally { await db.close(); }
});

test('a new offer expires no later than the registration cutoff', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'cap-p1');
    await register(db, 'p2', e.id, e.version, 'cap-p2');
    await register(db, 'p3', e.id, e.version, 'cap-p3');
    await register(db, 'w1', e.id, e.version, 'cap-w1');
    const deadline = new Date(Date.now() + 6 * 60_000).toISOString();
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',$2::jsonb) WHERE id=$1", [e.id, JSON.stringify(deadline)]);
    await cancelRegistration(db, 'p1', p1.id, e.version, 'cap-release');
    const { rows } = await db.query<{ expires_at: Date }>("SELECT expires_at FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id]);
    assert.equal(rows.length, 1);
    assert.ok(new Date(rows[0]!.expires_at).getTime() <= Date.parse(deadline));
  } finally { await db.close(); }
});

test('expired offer promotes next candidate exactly once', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'p1');
    await register(db, 'p2', e.id, e.version, 'p2');
    await register(db, 'p3', e.id, e.version, 'p3');
    await register(db, 'w1', e.id, e.version, 'w1');
    const w2 = await register(db, 'w2', e.id, e.version, 'w2');
    await cancelRegistration(db, 'p1', p1.id, e.version, 'cancel');
    await db.query("UPDATE offers SET expires_at=now()-interval '1 second' WHERE event_id=$1", [e.id]);
    await expireOffers(db);
    await expireOffers(db);
    const active = await db.query<{ registration_id: string }>("SELECT registration_id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id]);
    assert.equal(active.rows.length, 1);
    assert.equal(active.rows[0]?.registration_id, w2.id);
  } finally { await db.close(); }
});

test('bulk reservation crossing the confirmation deadline rolls back its first token and job', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    let inserts = 0;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({ query: async (sql, params = []) => {
        if (sql.startsWith('INSERT INTO reservations(id,event_id,token,expires_at)')) {
          inserts++;
          if (inserts === 2) await tx.query(
            "UPDATE events SET payload=jsonb_set(payload,'{confirmationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
            [e.id, new Date(Date.now() - 1000).toISOString()]);
        }
        return tx.query(sql, params);
      } }))
    };
    await assert.rejects(() => reserveSeats(racingDb, 'host', e.id, e.version, 2, 'cross-reserve-deadline'),
      { code: 'INVALID_RESERVATION' });
    assert.equal(inserts, 2);
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM reservations WHERE event_id=$1',
      [e.id])).rows[0]?.n, 0);
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM jobs WHERE event_id=$1 AND kind='EXPIRE_RESERVATION'",
      [e.id])).rows[0]?.n, 0);
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action='RESERVE_SEATS'",
      [e.id])).rows[0]?.n, 0);
  } finally { await db.close(); }
});

test('host reservation occupies capacity but is not a confirmed person before claim', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const reservations = await reserveSeats(db, 'host', e.id, e.version, 1, 'reserve');
    await register(db, 'p1', e.id, e.version, 'p1');
    await register(db, 'p2', e.id, e.version, 'p2');
    const waiting = await register(db, 'p3', e.id, e.version, 'p3');
    assert.equal(waiting.status, 'WAITLISTED');
    const before = await db.query<{ n: string }>("SELECT count(*)::text AS n FROM registrations WHERE event_id=$1 AND status='CONFIRMED'", [e.id]);
    assert.equal(before.rows[0]?.n, '3');
    const claimed = await claimReservation(db, 'friend', reservations[0]!.token, e.version, 'claim', e.id);
    assert.equal(claimed.status, 'CONFIRMED');
    await assert.rejects(() => claimReservation(db, 'other', reservations[0]!.token, e.version, 'claim-other', e.id), { code: 'RESERVATION_UNAVAILABLE' });
  } finally { await db.close(); }
});

test('manual approval allocates only when space exists and only by host', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', { ...input, approvalMode: 'MANUAL' }, 'manual');
    const e = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'publish-manual');
    const applicant = await register(db, 'applicant', e.id, e.version, 'request');
    assert.equal(applicant.status, 'REQUESTED');
    await assert.rejects(() => approveRegistration(db, 'stranger', applicant.id, e.version, 'approve-x'), { code: 'FORBIDDEN' });
    const approved = await approveRegistration(db, 'host', applicant.id, e.version, 'approve');
    assert.equal(approved.status, 'CONFIRMED');
  } finally { await db.close(); }
});

test('a reservation expiring after validation cannot be claimed at the token update', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const [reservation] = await reserveSeats(db, 'host', e.id, e.version, 1, 'reservation-race-create');
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async (sql, params = []) => {
          if (!crossed && sql.startsWith('UPDATE reservations SET claimed_by=$2')) {
            crossed = true;
            await tx.query("UPDATE reservations SET expires_at=now()-interval '1 second' WHERE id=$1", [reservation!.id]);
          }
          return tx.query(sql, params);
        }
      }))
    };
    await assert.rejects(() => claimReservation(racingDb, 'friend', reservation!.token, e.version, 'reservation-race-claim', e.id),
      { code: 'RESERVATION_UNAVAILABLE' });
    assert.equal(crossed, true);
    const { rows: held } = await db.query<{ claimed_by: string | null }>('SELECT claimed_by FROM reservations WHERE id=$1', [reservation!.id]);
    assert.equal(held[0]?.claimed_by, null);
    const { rows: members } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND user_id='friend'", [e.id]);
    assert.equal(members[0]?.n, 0);
  } finally { await db.close(); }
});

test('manual approval cannot add a seat after the registration deadline', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', { ...input, approvalMode: 'MANUAL' }, 'late-approval-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'late-approval-publish');
    const request = await register(db, 'applicant', event.id, event.version, 'late-approval-request');
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
      [event.id, new Date(Date.now() - 1000).toISOString()]);
    await assert.rejects(() => approveRegistration(db, 'host', request.id, event.version, 'late-approval'),
      { code: 'REGISTRATION_CLOSED' });
    const { rows } = await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1', [request.id]);
    assert.equal(rows[0]?.status, 'REQUESTED');
    const { rows: audits } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action='APPROVE_REGISTRATION'", [event.id]);
    assert.equal(audits[0]?.n, 0);
  } finally { await db.close(); }
});

test('manual approval cannot commit when the deadline passes immediately before its update', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', { ...input, approvalMode: 'MANUAL' }, 'cross-approval-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'cross-approval-publish');
    const request = await register(db, 'applicant', event.id, event.version, 'cross-approval-request');
    let crossed = false;
    const racingDb: Database = {
      ...db,
      transaction: fn => db.transaction(tx => fn({
        query: async (sql, params = []) => {
          if (!crossed && sql.startsWith("UPDATE registrations SET status='CONFIRMED',accepted_version=$2")) {
            crossed = true;
            await tx.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
              [event.id, new Date(Date.now() - 1000).toISOString()]);
          }
          return tx.query(sql, params);
        }
      }))
    };
    await assert.rejects(() => approveRegistration(racingDb, 'host', request.id, event.version, 'cross-approval'),
      { code: 'REGISTRATION_CLOSED' });
    assert.equal(crossed, true);
    const { rows } = await db.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1', [request.id]);
    assert.equal(rows[0]?.status, 'REQUESTED');
  } finally { await db.close(); }
});

test('expired reservations release seats and offer the first waitlisted person', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    await reserveSeats(db, 'host', e.id, e.version, 1, 'reserve');
    await register(db, 'p1', e.id, e.version, 'p1');
    await register(db, 'p2', e.id, e.version, 'p2');
    const waiting = await register(db, 'waiting', e.id, e.version, 'wait');
    await db.query("UPDATE reservations SET expires_at=now()-interval '1 second' WHERE event_id=$1", [e.id]);
    await expireReservations(db);
    await expireReservations(db);
    const offers = await db.query<{ registration_id: string }>("SELECT registration_id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id]);
    assert.equal(offers.rows.length, 1);
    assert.equal(offers.rows[0]?.registration_id, waiting.id);
  } finally { await db.close(); }
});

test('an offer cannot be accepted after its event is cancelled', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'p1');
    await register(db, 'p2', e.id, e.version, 'p2');
    await register(db, 'p3', e.id, e.version, 'p3');
    await register(db, 'w1', e.id, e.version, 'w1');
    await cancelRegistration(db, 'p1', p1.id, e.version, 'leave');
    const { rows: offers } = await db.query<{ id: string }>("SELECT id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id]);
    await cancelEvent(db, 'host', e.id, e.version, 'cancel');
    await assert.rejects(() => acceptOffer(db, 'w1', offers[0]!.id, e.version, 'accept-after-cancel'), { code: 'OFFER_UNAVAILABLE' });
  } finally { await db.close(); }
});

test('interested participant holds no seat and can later confirm personally', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    await assert.rejects(() => expressInterest(db, 'p1', e.id, e.version, 'interest-denied', 'old-token'), { code: 'FORBIDDEN' });
    const interested = await expressInterest(db, 'p1', e.id, e.version, 'interest', e.inviteToken ?? null);
    assert.equal(interested.status, 'INTERESTED');
    const { rows: count } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND status='CONFIRMED'", [e.id]);
    assert.equal(count[0]?.n, 1);
    const joined = await register(db, 'p1', e.id, e.version, 'join');
    assert.equal(joined.id, interested.id);
    assert.equal(joined.status, 'CONFIRMED');
  } finally { await db.close(); }
});

test('host removal records a private reason and promotes the next candidate', async () => {
  const db = await createDatabase();
  try {
    const e = await event(db);
    const p1 = await register(db, 'p1', e.id, e.version, 'remove-p1');
    await register(db, 'p2', e.id, e.version, 'remove-p2');
    await register(db, 'p3', e.id, e.version, 'remove-p3');
    const waiting = await register(db, 'waiting', e.id, e.version, 'remove-waiting');
    await assert.rejects(() => removeRegistration(db, 'p2', p1.id, e.version, '报名规则不符，请联系主办方复核', 'fake'), { code: 'FORBIDDEN' });
    const removal = await removeRegistration(db, 'host', p1.id, e.version, '报名规则不符，请联系主办方复核', 'remove');
    assert.equal(removal.status, 'REMOVED');
    assert.ok(removal.removalId);
    assert.equal((await removeRegistration(db, 'host', p1.id, e.version, '报名规则不符，请联系主办方复核', 'remove')).removalId, removal.removalId);
    await assert.rejects(() => register(db, 'p1', e.id, e.version, 'removed-rejoin'), { code: 'REMOVED' });
    const { rows: offer } = await db.query<{ registration_id: string }>("SELECT registration_id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [e.id]);
    assert.equal(offer[0]?.registration_id, waiting.id);
    const { rows: reason } = await db.query<{ reason: string }>('SELECT reason FROM registration_removals WHERE id=$1', [removal.removalId]);
    assert.equal(reason[0]?.reason, '报名规则不符，请联系主办方复核');
  } finally { await db.close(); }
});
