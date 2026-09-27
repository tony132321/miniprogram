import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { publishApprovedInvite } from './helpers.ts';
import { setConsent, markNotificationOpened } from '../src/notifications.ts';
import { runDueJobs } from '../src/jobs.ts';
import { createApp } from '../src/server.ts';
import { register } from './helpers.ts';

const input = { title: '通知跟进测试', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z',
  timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE',
  feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };

test('operator follows up unavailable and uncertain external notifications without claiming delivery', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const get = async () => fetch(base + '/ops/notifications/followups', { headers: { 'X-Dev-User': 'ops' } });
  try {
    const draft = await createDraft(db, 'host', input, 'draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'publish');
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'consent1');
    await setConsent(db, 'p2', 'EVENT_REMINDER', true, 'consent2');
    await register(db, 'p1', event.id, event.version, 'join1');
    await register(db, 'p2', event.id, event.version, 'join2');
    const { rows } = await db.query<{ id: string; user_id: string }>("SELECT id,user_id FROM notifications WHERE event_id=$1 AND kind='REGISTRATION_STATUS'", [event.id]);
    const p1 = rows.find(row => row.user_id === 'p1')!.id;
    const p2 = rows.find(row => row.user_id === 'p2')!.id;
    await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,external_status)
      VALUES('gate-only-notice',$1,'host','PUBLIC_RECRUITMENT_CLOSED',$2,'UNAVAILABLE')`, [event.id, event.version]);
    await db.query("UPDATE notifications SET external_status='DISPATCHING' WHERE id=$1", [p2]);
    await runDueJobs(db);
    let response = await get();
    assert.equal(response.status, 200);
    let items = (await response.json() as { items: Array<{ notificationId: string; externalStatus: string; detail?: unknown }> }).items;
    assert.deepEqual(new Set(items.map(item => item.notificationId)), new Set([p1, p2]));
    assert.equal(items.find(item => item.notificationId === p1)?.externalStatus, 'UNAVAILABLE');
    assert.equal(items.find(item => item.notificationId === p2)?.externalStatus, 'UNKNOWN_REQUIRES_RECONCILIATION');
    assert.equal(items.every(item => item.detail === undefined), true);
    const invalid = await fetch(base + `/ops/notifications/${p2}/followup`, { method: 'POST', headers: {
      'X-Dev-User': 'ops', 'Content-Type': 'application/json', 'Idempotency-Key': 'invalid-note' }, body: JSON.stringify({ note: '短' }) });
    assert.equal(invalid.status, 400);
    const shortEmoji = await fetch(base + `/ops/notifications/${p2}/followup`, { method: 'POST', headers: {
      'X-Dev-User': 'ops', 'Content-Type': 'application/json', 'Idempotency-Key': 'invalid-emoji' }, body: JSON.stringify({ note: '🙂🙂🙂🙂' }) });
    assert.equal(shortEmoji.status, 400);

    await markNotificationOpened(db, 'p1', p1, 'open1');
    await markNotificationOpened(db, 'p2', p2, 'open2');
    items = (await (await get()).json() as { items: typeof items }).items;
    assert.deepEqual(items.map(item => item.notificationId), [p2]);

    const followup = () => fetch(base + `/ops/notifications/${p2}/followup`, { method: 'POST', headers: {
      'X-Dev-User': 'ops', 'Content-Type': 'application/json', 'Idempotency-Key': 'followup-1' }, body: JSON.stringify({ note: '已人工核对服务商状态，并联系主办方确认' }) });
    const first = await followup();
    assert.equal(first.status, 200);
    assert.deepEqual(await (await followup()).json(), await first.json());
    assert.deepEqual((await (await get()).json() as { items: unknown[] }).items, []);
    const { rows: records } = await db.query<{ external_status: string; followups: string; audits: string }>(`SELECT n.external_status,
      (SELECT count(*)::text FROM notification_followups WHERE notification_id=n.id) AS followups,
      (SELECT count(*)::text FROM audit WHERE action='NOTIFICATION_FOLLOWUP' AND event_id=n.event_id) AS audits
      FROM notifications n WHERE n.id=$1`, [p2]);
    assert.equal(records[0]?.external_status, 'UNKNOWN_REQUIRES_RECONCILIATION');
    assert.equal(records[0]?.followups, '1');
    assert.equal(records[0]?.audits, '1');
    const historyResponse = await fetch(base + '/ops/notifications/followups/history', { headers: { 'X-Dev-User': 'ops' } });
    assert.equal(historyResponse.status, 200);
    const history = (await historyResponse.json() as { items: Array<{ notificationId: string; note: string; recordedBy: string;
      externalStatus: string; detail?: unknown }> }).items;
    assert.equal(history[0]?.notificationId, p2);
    assert.equal(history[0]?.note, '已人工核对服务商状态，并联系主办方确认');
    assert.equal(history[0]?.recordedBy, 'ops');
    assert.equal(history[0]?.externalStatus, 'UNKNOWN_REQUIRES_RECONCILIATION');
    assert.equal(history[0]?.detail, undefined);
    const duplicate = await fetch(base + `/ops/notifications/${p2}/followup`, { method: 'POST', headers: {
      'X-Dev-User': 'ops', 'Content-Type': 'application/json', 'Idempotency-Key': 'different-key' }, body: JSON.stringify({ note: '另一个操作员试图重复记录' }) });
    assert.equal(duplicate.status, 409);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('operator can page every pending follow-up and must restart after queue changes', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const get = (query = '') => fetch(`${base}/ops/notifications/followups${query}`, { headers: { 'X-Dev-User': 'ops' } });
  try {
    const draft = await createDraft(db, 'host', input, 'page-draft');
    await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,external_status)
      SELECT 'page-n-'||n,$1,'user-'||n,'TEST_FOLLOWUP',1,'UNAVAILABLE' FROM generate_series(1,105) n`, [draft.id]);
    await db.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload)
      SELECT 'page-job-'||n,'SEND_EXTERNAL',$1,now(),jsonb_build_object('notificationId','page-n-'||n)
      FROM generate_series(1,105) n`, [draft.id]);
    const first = await (await get('?offset=0')).json() as { items: Array<{ notificationId: string }>; total: number; nextOffset: number | null; snapshot: string };
    assert.equal(first.total, 105);
    assert.equal(first.items.length, 100);
    assert.equal(first.nextOffset, 100);
    const second = await (await get(`?offset=100&snapshot=${first.snapshot}`)).json() as typeof first;
    assert.equal(second.items.length, 5);
    assert.equal(second.nextOffset, null);
    assert.equal(new Set([...first.items, ...second.items].map(item => item.notificationId)).size, 105);
    assert.equal((await get('?offset=100')).status, 400);
    assert.equal((await get('?offset=-1')).status, 400);
    await db.query("UPDATE notifications SET read_at=now() WHERE id='page-n-1'");
    const stale = await get(`?offset=100&snapshot=${first.snapshot}`);
    assert.equal(stale.status, 409);
    assert.equal((await stale.json() as { code: string }).code, 'QUEUE_CHANGED');
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
