import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { register } from './helpers.ts';
import { listEventAliases, setEventAlias } from '../src/event-aliases.ts';

const input = { title: '活动内昵称', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z',
  timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 6,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };

test('activity nickname is opt-in, visible only to members and revocable', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'alias-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'alias-publish');
    await register(db, 'p1', event.id, event.version, 'alias-p1');
    await register(db, 'p2', event.id, event.version, 'alias-p2');
    assert.deepEqual(await listEventAliases(db, 'p2', event.id), []);
    await assert.rejects(() => setEventAlias(db, 'p1', event.id, '小明', false, 'alias-no-consent'), { code: 'BAD_REQUEST' });
    await setEventAlias(db, 'p1', event.id, '小明', true, 'alias-set');
    assert.equal((await listEventAliases(db, 'p2', event.id))[0]?.displayName, '小明');
    await assert.rejects(() => listEventAliases(db, 'outsider', event.id), { code: 'FORBIDDEN' });
    await setEventAlias(db, 'p1', event.id, null, false, 'alias-revoke');
    assert.deepEqual(await listEventAliases(db, 'p2', event.id), []);
  } finally { await db.close(); }
});
