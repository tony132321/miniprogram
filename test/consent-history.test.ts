import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createDatabase } from '../src/db.ts';
import { setConsent } from '../src/notifications.ts';
import { createApp } from '../src/server.ts';
import { exportPersonalData } from '../src/privacy.ts';

test('separate notification purposes keep immutable grant and withdrawal evidence with no duplicate replay', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('member','consent-history-member')");
    await setConsent(db, 'member', 'EVENT_REMINDER', true, 'reminder-grant');
    await setConsent(db, 'member', 'EVENT_REMINDER', true, 'reminder-grant');
    await setConsent(db, 'member', 'SIMILAR_ACTIVITY_INVITES', true, 'similar-grant');
    await setConsent(db, 'member', 'EVENT_REMINDER', false, 'reminder-withdraw');
    const { rows } = await db.query<{ purpose: string; scope: string; notice_version: string;
      notice_text: string; granted: boolean; changed_at: Date }>(`SELECT purpose,scope,notice_version,notice_text,granted,changed_at
      FROM notification_consent_history WHERE user_id='member' ORDER BY changed_at,id`);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(row => [row.purpose, row.granted]).sort(), [
      ['EVENT_REMINDER', true], ['SIMILAR_ACTIVITY_INVITES', true], ['EVENT_REMINDER', false]
    ].sort());
    assert.ok(rows.every(row => row.scope.length > 0 && row.notice_text.length > 0));
    assert.ok(rows.every(row => /^[a-f0-9]{64}$/.test(row.notice_version)));
    assert.ok(rows.every(row => !Number.isNaN(new Date(row.changed_at).getTime())));
    const { rows: current } = await db.query<{ purpose: string; granted: boolean }>(
      "SELECT purpose,granted FROM notification_consents WHERE user_id='member' ORDER BY purpose");
    assert.deepEqual(current.map(row => [row.purpose, row.granted]), [
      ['EVENT_REMINDER', false], ['SIMILAR_ACTIVITY_INVITES', true]
    ]);
    const own = await exportPersonalData(db, 'member');
    const other = await exportPersonalData(db, 'other');
    assert.equal(own.notificationConsentHistory.length, 3);
    assert.equal(other.notificationConsentHistory.length, 0);
  } finally { await db.close(); }
});

test('consent status exposes the same notice version that is recorded for the decision', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('member','consent-notice-member')");
    const response = await fetch(base + '/me/consents', { headers: { 'X-Dev-User': 'member' } });
    const current = await response.json() as { eventReminderNotice?: { scope: string; text: string; version: string } };
    assert.equal(response.status, 200);
    assert.equal(current.eventReminderNotice?.scope, 'ACTIVITY_EXTERNAL_REMINDERS');
    assert.ok(current.eventReminderNotice?.text.includes('站内通知'));
    await setConsent(db, 'member', 'EVENT_REMINDER', true, 'notice-bound-grant');
    const { rows } = await db.query<{ notice_version: string; notice_text: string }>(
      "SELECT notice_version,notice_text FROM notification_consent_history WHERE user_id='member'");
    assert.equal(rows[0]?.notice_version, current.eventReminderNotice?.version);
    assert.equal(rows[0]?.notice_text, current.eventReminderNotice?.text);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('HTTP consent rejects missing or stale disclosure version without changing current state', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const get = async (path: string) => (await fetch(base + path, { headers: { 'X-Dev-User': 'member' } })).json() as Promise<Record<string, any>>;
  const post = async (path: string, body: object, key: string) => fetch(base + path, { method: 'POST',
    headers: { 'X-Dev-User': 'member', 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('member','consent-http-member')");
    const first = await get('/me/consents');
    assert.equal((await post('/me/consents', { eventReminder: true }, 'missing-version')).status, 409);
    assert.equal((await post('/me/consents', { eventReminder: true, noticeVersion: 'stale' }, 'stale-version')).status, 409);
    assert.equal((await get('/me/consents')).eventReminder, false);
    assert.equal((await post('/me/consents', { eventReminder: true, noticeVersion: first.eventReminderNotice.version }, 'valid-version')).status, 200);
    const similar = await get('/me/similar-invites');
    assert.equal((await post('/me/similar-invites', { granted: true, noticeVersion: similar.notice.version }, 'valid-similar')).status, 200);
    const { rows } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM notification_consent_history WHERE user_id='member'");
    assert.equal(rows[0]?.n, 2);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('legacy grant is shown as requiring reconfirmation until a current-version grant is recorded', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const get = async (path: string) => (await fetch(base + path, { headers: { 'X-Dev-User': 'member' } })).json() as Promise<Record<string, any>>;
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('member','consent-legacy-member')");
    await db.query("INSERT INTO notification_consents(user_id,purpose,granted) VALUES('member','EVENT_REMINDER',true),('member','SIMILAR_ACTIVITY_INVITES',true)");
    const reminder = await get('/me/consents');
    const similar = await get('/me/similar-invites');
    assert.equal(reminder.eventReminder, false);
    assert.equal(reminder.reconfirmationRequired, true);
    assert.equal(similar.granted, false);
    assert.equal(similar.reconfirmationRequired, true);
    await setConsent(db, 'member', 'EVENT_REMINDER', true, 'reconfirm-reminder');
    assert.equal((await get('/me/consents')).eventReminder, true);
    assert.equal((await get('/me/similar-invites')).granted, false);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('development identity creates a synthetic account only for a valid consent grant', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const headers = { 'X-Dev-User': 'new-simulator-member', 'Content-Type': 'application/json',
    'Idempotency-Key': 'synthetic-consent' };
  try {
    const status = await (await fetch(base + '/me/consents', { headers })).json() as { eventReminderNotice: { version: string } };
    const post = (version: string) => fetch(base + '/me/consents', { method: 'POST', headers,
      body: JSON.stringify({ eventReminder: true, noticeVersion: version }) });
    assert.equal((await post('stale')).status, 409);
    assert.equal((await db.query("SELECT id FROM users WHERE id='new-simulator-member'")).rows.length, 0);
    assert.equal((await post(status.eventReminderNotice.version)).status, 200);
    const { rows } = await db.query<{ wechat_openid: string }>(
      "SELECT wechat_openid FROM users WHERE id='new-simulator-member'");
    assert.equal(rows[0]?.wechat_openid, 'dev:new-simulator-member');
    assert.equal((await db.query("SELECT granted FROM notification_consents WHERE user_id='new-simulator-member'"))
      .rows[0]?.granted, true);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
