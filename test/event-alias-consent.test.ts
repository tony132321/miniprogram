import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { setConsent } from '../src/notifications.ts';
import { exportPersonalData } from '../src/privacy.ts';
import { createApp } from '../src/server.ts';
import { publishApprovedInvite, register } from './helpers.ts';

const input = { title: '昵称授权场景', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z',
  timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 6,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };

test('legacy event nickname is hidden until its owner accepts the current event display notice', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const get = async (actor: string, eventId: string) => (await fetch(`${base}/events/${eventId}/aliases`,
    { headers: { 'X-Dev-User': actor } })).json() as Promise<Record<string, any>>;
  const post = async (eventId: string, body: object, key: string) => fetch(`${base}/events/${eventId}/aliases`, {
    method: 'POST', headers: { 'X-Dev-User': 'p1', 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body)
  });
  try {
    const draft = await createDraft(db, 'host', input, 'legacy-alias-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'legacy-alias-publish');
    await register(db, 'p1', event.id, event.version, 'legacy-alias-p1');
    await register(db, 'p2', event.id, event.version, 'legacy-alias-p2');
    await db.query('INSERT INTO event_aliases(event_id,user_id,display_name) VALUES($1,$2,$3)',
      [event.id, 'p1', '旧昵称']);

    assert.deepEqual((await get('p2', event.id)).items, []);
    const owner = await get('p1', event.id);
    assert.equal(owner.reconfirmationRequired, true);
    assert.equal(owner.notice.purpose, 'EVENT_MEMBER_DISPLAY');
    assert.ok(typeof owner.notice.version === 'string' && owner.notice.version.length > 0);
    assert.equal((await post(event.id, { displayName: '新昵称', granted: true }, 'alias-missing-notice')).status, 409);
    assert.equal((await post(event.id, { displayName: '新昵称', granted: true, noticeVersion: 'stale' }, 'alias-stale-notice')).status, 409);
    assert.deepEqual((await get('p2', event.id)).items, []);

    assert.equal((await post(event.id, { displayName: '新昵称', granted: true, noticeVersion: owner.notice.version }, 'alias-current-notice')).status, 200);
    assert.equal((await get('p2', event.id)).items[0]?.displayName, '新昵称');
    const { rows } = await db.query<{ purpose: string; scope: string; notice_version: string; granted: boolean; changed_at: Date }>(
      'SELECT purpose,scope,notice_version,granted,changed_at FROM event_alias_consent_history WHERE user_id=$1', ['p1']);
    assert.deepEqual(rows.map(row => [row.purpose, row.scope, row.notice_version, row.granted]),
      [['EVENT_MEMBER_DISPLAY', `EVENT:${event.id}:MEMBERS`, owner.notice.version, true]]);
    assert.ok(!Number.isNaN(new Date(rows[0]!.changed_at).getTime()));
    assert.equal((await exportPersonalData(db, 'p1')).eventAliasConsentHistory.length, 1);
    assert.equal((await exportPersonalData(db, 'p2')).eventAliasConsentHistory.length, 0);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('nickname withdrawal hides it immediately without withdrawing an unrelated reminder consent', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const request = async (actor: string, eventId: string, method = 'GET', body?: object, key?: string) => {
    const response = await fetch(`${base}/events/${eventId}/aliases`, { method,
      headers: { 'X-Dev-User': actor, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    const draft = await createDraft(db, 'host', input, 'withdraw-alias-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'withdraw-alias-publish');
    await register(db, 'p1', event.id, event.version, 'withdraw-alias-p1');
    await register(db, 'p2', event.id, event.version, 'withdraw-alias-p2');
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','alias-consent-p1')");
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'separate-reminder-grant');
    const notice = (await request('p1', event.id)).body.notice;
    assert.ok(notice?.version);
    assert.equal((await request('p1', event.id, 'POST', { displayName: '活动昵称', granted: true, noticeVersion: notice.version }, 'alias-grant')).status, 200);
    assert.equal((await request('p2', event.id)).body.items.length, 1);
    assert.equal((await request('p1', event.id, 'POST', { displayName: null, granted: false }, 'alias-withdraw')).status, 200);
    assert.deepEqual((await request('p2', event.id)).body.items, []);
    const { rows: decisions } = await db.query<{ granted: boolean }>(
      'SELECT granted FROM event_alias_consent_history WHERE user_id=$1 ORDER BY changed_at,id', ['p1']);
    assert.deepEqual(decisions.map(row => row.granted), [true, false]);
    const { rows: reminder } = await db.query<{ granted: boolean }>(
      "SELECT granted FROM notification_consents WHERE user_id='p1' AND purpose='EVENT_REMINDER'");
    assert.equal(reminder[0]?.granted, true);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
