import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { acceptOffer, cancelRegistration, declineOffer } from '../src/registrations.ts';
import { listMemberNotifications } from '../src/notifications.ts';
import { publishApprovedInvite, register } from './helpers.ts';

const input = { title: '补位通知当前状态', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z',
  feeMode: 'FREE', feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE',
  approvalMode: 'AUTO', hostParticipates: true };

test('offer notice action flags follow current acceptance and decline guards', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'offer-flags-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'offer-flags-publish');
    const first = await register(db, 'p1', event.id, event.version, 'offer-flags-p1');
    for (const actor of ['p2', 'p3', 'w1']) await register(db, actor, event.id, event.version, `offer-flags-${actor}`);
    await cancelRegistration(db, 'p1', first.id, event.version, 'offer-flags-release');

    const { rows: offers } = await db.query<{ id: string; registration_id: string }>(
      "SELECT id,registration_id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [event.id]);
    assert.equal(offers.length, 1);
    const notice = async () => {
      const items = (await listMemberNotifications(db, 'w1')).items;
      const offer = items.find(item => item.kind === 'WAITLIST_OFFER');
      assert.ok(offer);
      return offer;
    };
    const flags = async () => {
      const offer = await notice();
      return [offer.actionable, offer.declinable];
    };
    assert.deepEqual(await flags(), [true, true]);

    await db.query('UPDATE events SET recruiting=false WHERE id=$1', [event.id]);
    assert.deepEqual(await flags(), [false, true]);
    await db.query('UPDATE events SET recruiting=true WHERE id=$1', [event.id]);

    await db.query("UPDATE events SET status='CANCELLED' WHERE id=$1", [event.id]);
    assert.deepEqual(await flags(), [false, true]);
    await db.query("UPDATE events SET status='RECRUITING' WHERE id=$1", [event.id]);

    await db.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
      [event.id, new Date(Date.now() - 1000).toISOString()]);
    assert.deepEqual(await flags(), [false, true]);
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb($2::text),true) WHERE id=$1",
      [event.id, input.registrationDeadline]);

    await db.query("UPDATE registrations SET status='CANCELLED' WHERE id=$1", [offers[0]!.registration_id]);
    assert.deepEqual(await flags(), [false, false]);
    await db.query("UPDATE registrations SET status='OFFERED' WHERE id=$1", [offers[0]!.registration_id]);

    await db.query('UPDATE events SET version=version+1 WHERE id=$1', [event.id]);
    assert.deepEqual(await flags(), [false, false]);

    await db.query('UPDATE events SET version=$2,recruiting=false WHERE id=$1', [event.id, event.version]);
    await assert.rejects(() => acceptOffer(db, 'w1', offers[0]!.id, event.version, 'offer-flags-late-accept'),
      { code: 'OFFER_UNAVAILABLE' });
    assert.equal((await declineOffer(db, 'w1', offers[0]!.id, event.version, 'offer-flags-decline')).status,
      'DECLINED');
  } finally { await db.close(); }
});
