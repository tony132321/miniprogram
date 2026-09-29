import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import type { Database } from '../src/db.ts';
import { createDraft, publishEvent, updateDraft } from '../src/events.ts';
import { publishApprovedInvite, register } from './helpers.ts';
import { reviewEvent } from '../src/event-review.ts';
import { changeEvent } from '../src/lifecycle.ts';
import { grantCohost } from '../src/cohosts.ts';
import { createApp } from '../src/server.ts';

function schedule(daysFromNow: number) {
  const start = Date.now() + daysFromNow * 86_400_000;
  return { startAt: new Date(start).toISOString(), endAt: new Date(start + 2 * 60 * 60_000).toISOString(),
    confirmationDeadline: new Date(start - 90 * 60_000).toISOString(),
    registrationDeadline: new Date(start - 30 * 60_000).toISOString() };
}

const input = { title: '我的活动', type: 'badminton', ...schedule(30), timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共羽毛球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 6,
  feeMode: 'AA', feeCapFen: 4200, cancellationRule: '开始前可退出', visibility: 'INVITE',
  approvalMode: 'AUTO', hostParticipates: true };

test('my events puts an offer first, then reviewed upcoming events by time rather than UUID', async () => {
  const db = await createDatabase();
  const databaseTime = Date.now();
  const clockDb: Database = { ...db,
    query: <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      sql === 'SELECT clock_timestamp() AS current_time'
        ? Promise.resolve({ rows: [{ current_time: new Date(databaseTime) } as unknown as T] })
        : db.query<T>(sql, params) };
  const server = createApp(clockDb, { environment: 'test', devAuth: true, checkInSecret: 'summary-test' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const read = async (actor: string) => {
    const response = await fetch(base + '/me/events', { headers: { 'X-Dev-User': actor } });
    assert.equal(response.status, 200);
    return (await response.json() as { items: Array<Record<string, any>> }).items;
  };
  try {
    const drafts = await Promise.all([1, 2, 3].map(n => createDraft(db, 'host', input, `sort-draft-${n}`)));
    const byId = [...drafts].sort((left, right) => left.id.localeCompare(right.id));
    const dateById = new Map(byId.map((draft, index) => [draft.id, 33 - index]));
    const published = [];
    for (const draft of drafts) {
      const day = dateById.get(draft.id)!;
      const updated = await updateDraft(db, 'host', draft.id, draft.version,
        { ...schedule(day), title: `第 ${day} 天球局`, venueName: `第 ${day} 天球馆`, feeCapFen: day * 100 },
        `sort-update-${day}`);
      published.push(await publishApprovedInvite(db, 'host', updated.id, updated.version, `sort-publish-${day}`));
    }
    const byDay = [...published].sort((left, right) => Date.parse(left.payload.startAt!) - Date.parse(right.payload.startAt!));
    const hosted = await read('host');
    assert.deepEqual(hosted.map(item => item.id), byDay.map(event => event.id));
    assert.deepEqual(hosted.map(item => [item.title, item.startAt, item.venueName, item.feeMode, item.feeCapFen]),
      byDay.map(event => [event.payload.title, event.payload.startAt, event.payload.venueName,
        event.payload.feeMode, event.payload.feeCapFen]));
    const realNow = Date.now;
    Date.now = () => realNow() + 365 * 86_400_000;
    try {
      assert.deepEqual((await read('host')).map(item => item.id), byDay.map(event => event.id));
    } finally { Date.now = realNow; }

    for (const event of published) await register(db, 'member', event.id, event.version, `sort-join-${event.id}`);
    const offerEvent = byDay[2]!;
    await db.query("UPDATE registrations SET status='OFFERED' WHERE event_id=$1 AND user_id='member'", [offerEvent.id]);
    const member = await read('member');
    assert.deepEqual(member.map(item => item.id), [offerEvent.id, byDay[0]!.id, byDay[1]!.id]);
    assert.equal(member[0]?.myRegistrationStatus, 'OFFERED');
    assert.deepEqual(await read('stranger'), []);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('my event logistics follow host, member and cohost review visibility without crossing accounts', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'summary-review-test' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const read = async (actor: string) => {
    const response = await fetch(base + '/me/events', { headers: { 'X-Dev-User': actor } });
    assert.equal(response.status, 200);
    return (await response.json() as { items: Array<Record<string, any>> }).items;
  };
  try {
    const draft = await createDraft(db, 'host', { ...input, title: '待审秘密标题', venueName: '待审秘密球馆' }, 'review-draft');
    const pending = await publishEvent(db, 'host', draft.id, draft.version, 'review-publish');
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status,accepted_version)
      VALUES($1,$2,'member','CONFIRMED',$3)`, ['review-member-registration', pending.id, pending.version]);
    await grantCohost(db, 'host', pending.id, pending.version, 'helper', ['MANAGE_ANNOUNCEMENTS'],
      new Date(Date.parse(pending.payload.endAt!) + 86_400_000).toISOString(), 'review-cohost');

    const hostPending = (await read('host'))[0]!;
    assert.deepEqual([hostPending.title, hostPending.venueName, hostPending.feeMode, hostPending.feeCapFen],
      ['待审秘密标题', '待审秘密球馆', 'AA', 4200]);
    for (const actor of ['member', 'helper']) {
      const items = await read(actor);
      assert.equal(items.length, 1);
      assert.equal(items[0]!.title, '活动审核中');
      assert.equal(items[0]!.startAt, undefined);
      assert.equal(items[0]!.venueName, undefined);
      assert.equal(items[0]!.feeMode, undefined);
      assert.equal(items[0]!.feeCapFen, undefined);
      assert.doesNotMatch(JSON.stringify(items), /待审秘密|4200/);
    }
    assert.deepEqual(await read('stranger'), []);

    const approved = await reviewEvent(db, 'ops', pending.id, pending.version, 'APPROVED',
      '核对活动标题、场地与费用', 'review-approve');
    for (const actor of ['member', 'helper']) {
      const item = (await read(actor))[0]!;
      assert.deepEqual([item.title, item.startAt, item.venueName, item.feeMode, item.feeCapFen],
        ['待审秘密标题', pending.payload.startAt, '待审秘密球馆', 'AA', 4200]);
    }

    const changed = await changeEvent(db, 'host', approved.id, approved.version,
      { title: '改后未审秘密标题', venueName: '改后未审秘密球馆', venueStatus: 'HOST_CONFIRMED',
        feeMode: 'FREE', feeCapFen: 0 }, 'review-change');
    assert.equal(changed.reviewStatus, 'PENDING');
    const hostChanged = (await read('host'))[0]!;
    assert.deepEqual([hostChanged.title, hostChanged.venueName, hostChanged.feeMode, hostChanged.feeCapFen],
      ['改后未审秘密标题', '改后未审秘密球馆', 'FREE', 0]);
    for (const actor of ['member', 'helper']) {
      const items = await read(actor);
      assert.equal(items[0]!.title, '活动审核中');
      assert.equal(items[0]!.startAt, undefined);
      assert.equal(items[0]!.venueName, undefined);
      assert.equal(items[0]!.feeMode, undefined);
      assert.equal(items[0]!.feeCapFen, undefined);
      assert.doesNotMatch(JSON.stringify(items), /秘密|4200/);
    }
    assert.deepEqual(await read('stranger'), []);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});
