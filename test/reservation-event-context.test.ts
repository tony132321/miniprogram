import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { claimReservation, reserveSeats } from '../src/registrations.ts';
import { publishApprovedInvite } from './helpers.ts';

const input = {
  title: '周末羽毛球', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共羽毛球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'AA', feeCapFen: 5000,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO',
  hostParticipates: true
};

test('a reservation token from another event cannot be claimed through the current event page', async () => {
  const db = await createDatabase();
  try {
    const firstDraft = await createDraft(db, 'host', input, 'reservation-context-draft-a');
    const secondDraft = await createDraft(db, 'host', { ...input, title: '周日下午羽毛球' }, 'reservation-context-draft-b');
    const first = await publishApprovedInvite(db, 'host', firstDraft.id, firstDraft.version, 'reservation-context-publish-a');
    const second = await publishApprovedInvite(db, 'host', secondDraft.id, secondDraft.version, 'reservation-context-publish-b');
    assert.equal(first.version, second.version);
    const [reservation] = await reserveSeats(db, 'host', second.id, second.version, 1, 'reservation-context-reserve-b');
    assert.ok(reservation);

    await assert.rejects(
      () => claimReservation(db, 'friend', reservation.token, first.version, 'reservation-context-wrong-page', first.id),
      { code: 'RESERVATION_EVENT_MISMATCH' }
    );
    const unclaimed = await db.query<{ claimed_by: string | null }>('SELECT claimed_by FROM reservations WHERE token=$1', [reservation.token]);
    assert.equal(unclaimed.rows[0]?.claimed_by, null);

    const claimed = await claimReservation(db, 'friend', reservation.token, second.version, 'reservation-context-right-page', second.id);
    assert.equal(claimed.eventId, second.id);
    assert.equal(claimed.status, 'CONFIRMED');
    await assert.rejects(
      () => claimReservation(db, 'friend', reservation.token, first.version, 'reservation-context-right-page', first.id),
      { code: 'RESERVATION_EVENT_MISMATCH' }
    );
  } finally { await db.close(); }
});
