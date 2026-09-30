import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function mount(post: (path: string, payload?: unknown) => Promise<unknown>, getOverride?: (path: string, session: string) => Promise<unknown>) {
  let page: Record<string, any> | undefined;
  const storage = new Map([['sessionToken', 'session-a'], ['userId', 'member']]);
  const get = async (path: string) => {
    const session = storage.get('sessionToken') || '';
    if (getOverride) return getOverride(path, session);
    if (path === '/me/consents') return { eventReminder: false,
      eventReminderNotice: { text: '提醒说明', version: 'reminder-v1' } };
    if (path === '/me/similar-invites') return { granted: session === 'session-a',
      notice: { text: '类似活动说明', version: 'similar-v1' } };
    if (path === '/me/notifications?offset=0') return { items: [], total: 0, unreadTotal: 0,
      nextOffset: null, snapshot: 'a'.repeat(32) };
    return { items: [] };
  };
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get, post } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve(), profileFocus: undefined } }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) || ''; },
      removeStorageSync(key: string) { storage.delete(key); },
      getSystemInfoSync() { return { statusBarHeight: 24 }; }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  return { page, storage };
}

test('old session reminder success cannot change the new session consent', async () => {
  const pending = deferred<unknown>();
  const { page, storage } = mount(path => {
    assert.equal(path, '/me/consents');
    return pending.promise;
  });
  await page.refresh();
  const oldWrite = page.toggleReminder({ detail: { value: true } });
  storage.set('sessionToken', 'session-b');
  await page.refresh();
  assert.equal(page.data.eventReminder, false);
  pending.resolve({ eventReminder: true });
  await oldWrite;
  assert.equal(page.data.eventReminder, false);
  assert.equal(page.data.message, '');
});

test('old session similar-invite failure cannot roll back the new session consent', async () => {
  const pending = deferred<unknown>();
  const { page, storage } = mount(path => {
    assert.equal(path, '/me/similar-invites');
    return pending.promise;
  });
  await page.refresh();
  const oldWrite = page.toggleSimilarInvites({ detail: { value: false } });
  storage.set('sessionToken', 'session-b');
  await page.refresh();
  assert.equal(page.data.similarInvites, false);
  pending.reject(new Error('旧会话授权失败'));
  await oldWrite;
  assert.equal(page.data.similarInvites, false);
  assert.equal(page.data.message, '');
});

test('rapid reminder taps cannot leave the server with an older choice', async () => {
  const first = deferred<unknown>();
  let serverGranted = false;
  let writes = 0;
  const { page } = mount(path => {
    assert.equal(path, '/me/consents');
    writes += 1;
    if (writes === 1) return first.promise.then(value => {
      serverGranted = true;
      return value;
    });
    serverGranted = false;
    return Promise.resolve({ eventReminder: false });
  });
  await page.refresh();
  const firstChoice = page.toggleReminder({ detail: { value: true } });
  const secondChoice = page.toggleReminder({ detail: { value: false } });
  const writesWhilePending = writes;
  const pendingDuringWrite = page.data.reminderConsentPending;
  first.resolve({ eventReminder: true });
  await Promise.all([firstChoice, secondChoice]);
  assert.equal(writesWhilePending, 1, 'the second request must not race the first on the server');
  assert.equal(pendingDuringWrite, true);
  assert.equal(page.data.reminderConsentPending, false);
  await page.toggleReminder({ detail: { value: false } });
  assert.equal(writes, 2);
  assert.equal(serverGranted, false);
  assert.equal(page.data.eventReminder, false);
  assert.match(page.data.message, /已关闭活动提醒/);
});

test('similar-invite consent is gated while its first write is in flight', async () => {
  const first = deferred<unknown>();
  let writes = 0;
  const { page } = mount(path => {
    assert.equal(path, '/me/similar-invites');
    writes += 1;
    return first.promise;
  });
  await page.refresh();
  const firstChoice = page.toggleSimilarInvites({ detail: { value: false } });
  const secondChoice = page.toggleSimilarInvites({ detail: { value: true } });
  const writesWhilePending = writes;
  const pendingDuringWrite = page.data.similarInvitesConsentPending;
  first.resolve({ granted: false });
  await Promise.all([firstChoice, secondChoice]);
  assert.equal(writesWhilePending, 1);
  assert.equal(pendingDuringWrite, true);
  assert.equal(page.data.similarInvitesConsentPending, false);
  assert.equal(page.data.similarInvites, false);
});

test('unknown reminder result stays locked until explicit retry of the same payload', async () => {
  const first = deferred<unknown>();
  const writes: Array<{ path: string; payload: unknown }> = [];
  let serverGranted = false;
  const { page } = mount((path, payload) => {
    writes.push({ path, payload });
    if (writes.length === 1) return first.promise;
    serverGranted = true;
    return Promise.resolve({ eventReminder: true });
  });
  await page.refresh();
  const firstChoice = page.toggleReminder({ detail: { value: true } });
  first.reject(Object.assign(new Error('网络中断，提交结果尚未确认'), { code: 'NETWORK_ERROR' }));
  await firstChoice;
  assert.equal(page.data.eventReminder, false);
  assert.equal(page.data.reminderConsentUncertain, true);
  assert.equal(page.data.reminderConsentPending, false);
  await page.toggleReminder({ detail: { value: false } });
  assert.equal(writes.length, 1);
  assert.equal(serverGranted, false);
  await page.retryReminderConsent();
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1], writes[0], 'the retry must preserve the idempotency fingerprint');
  assert.equal(serverGranted, true);
  assert.equal(page.data.eventReminder, true);
  assert.equal(page.data.reminderConsentUncertain, false);
});

test('an uncertain similar-invite response cannot unlock the switch after a refresh', async () => {
  const first = deferred<unknown>();
  let writes = 0;
  const { page } = mount(path => {
    assert.equal(path, '/me/similar-invites');
    writes += 1;
    return first.promise;
  });
  await page.refresh();
  const write = page.toggleSimilarInvites({ detail: { value: false } });
  first.reject(Object.assign(new Error('重定向，提交结果未知'), { code: 'HTTP_ERROR', status: 302 }));
  await write;
  await page.refresh();
  assert.equal(page.data.similarInvitesConsentUncertain, true);
  assert.equal(page.data.similarInvitesConsentPending, false);
  await page.toggleSimilarInvites({ detail: { value: true } });
  assert.equal(writes, 1);
});

test('a same-session profile refresh does not strand an in-flight consent', async () => {
  const pending = deferred<unknown>();
  const { page } = mount(path => {
    assert.equal(path, '/me/consents');
    return pending.promise;
  });
  await page.onShow();
  const write = page.toggleReminder({ detail: { value: true } });
  await page.onShow();
  assert.equal(page.data.reminderConsentPending, true);
  pending.resolve({ eventReminder: true });
  await write;
  assert.equal(page.data.reminderConsentPending, false);
  assert.equal(page.data.eventReminder, true);
});

test('old session report success cannot refresh or clear a new report draft', async () => {
  const pending = deferred<unknown>();
  const { page, storage } = mount(path => {
    assert.equal(path, '/reports');
    return pending.promise;
  });
  await page.refresh();
  page.reportInput({ detail: { value: 'A 的举报' } });
  const oldWrite = page.report();
  storage.set('sessionToken', 'session-b');
  await page.refresh();
  page.reportInput({ detail: { value: 'B 尚未提交的举报' } });
  pending.resolve({ id: 'report-a' });
  await oldWrite;
  assert.equal(page.data.reportDescription, 'B 尚未提交的举报');
  assert.equal(page.data.message, '');
});

test('old session privacy request failure cannot overwrite the new session message', async () => {
  const pending = deferred<unknown>();
  const { page, storage } = mount(path => {
    assert.equal(path, '/privacy/requests');
    return pending.promise;
  });
  await page.refresh();
  const oldWrite = page.privacyRequest({ currentTarget: { dataset: { kind: 'EXPORT' } } });
  storage.set('sessionToken', 'session-b');
  await page.refresh();
  page.setData({ message: '新会话正在编辑' });
  pending.reject(new Error('旧会话请求失败'));
  await oldWrite;
  assert.equal(page.data.message, '新会话正在编辑');
});

test('switching sessions for the same member clears old private rows before the next load finishes', async () => {
  const waitForNewReports = deferred<unknown>();
  const { page, storage } = mount(async () => ({ ok: true }), async (path, session) => {
    if (path === '/me/reports') return session === 'session-b' ? waitForNewReports.promise
      : { items: [{ id: 'session-a-private-report' }] };
    if (path === '/me/consents') return { eventReminder: false };
    if (path === '/me/similar-invites') return { granted: false };
    if (path === '/me/notifications?offset=0') return { items: [], total: 0, unreadTotal: 0,
      nextOffset: null, snapshot: 'a'.repeat(32) };
    return { items: [] };
  });
  await page.onShow();
  assert.equal(page.data.reports[0].id, 'session-a-private-report');
  storage.set('sessionToken', 'session-b');
  const newLoad = page.onShow();
  await Promise.resolve();
  assert.deepEqual(Array.from(page.data.reports), []);
  waitForNewReports.resolve({ items: [] });
  await newLoad;
});

test('direct refresh clears private rows before a new token GET finishes', async () => {
  const waitForNewReports = deferred<unknown>();
  const { page, storage } = mount(async () => ({ ok: true }), async (path, session) => {
    if (path === '/me/reports') return session === 'session-b' ? waitForNewReports.promise
      : { items: [{ id: 'session-a-private-report' }] };
    if (path === '/me/consents') return { eventReminder: false };
    if (path === '/me/similar-invites') return { granted: false };
    if (path === '/me/notifications?offset=0') return { items: [], total: 0, unreadTotal: 0,
      nextOffset: null, snapshot: 'a'.repeat(32) };
    return { items: [] };
  });
  await page.refresh();
  assert.equal(page.data.reports[0].id, 'session-a-private-report');
  storage.set('sessionToken', 'session-b');
  const newLoad = page.refresh();
  await Promise.resolve();
  const interimReports = Array.from(page.data.reports);
  waitForNewReports.resolve({ items: [] });
  await newLoad;
  assert.deepEqual(interimReports, []);
});

test('old in-flight reminder cleanup cannot clear the new session pending consent', async () => {
  const first = deferred<unknown>();
  const second = deferred<unknown>();
  let writes = 0;
  const { page, storage } = mount(path => {
    assert.equal(path, '/me/consents');
    return ++writes === 1 ? first.promise : second.promise;
  });
  await page.refresh();
  const oldWrite = page.toggleReminder({ detail: { value: true } });
  const pendingBeforeSwitch = page.data.reminderConsentPending;
  storage.set('sessionToken', 'session-b');
  await page.refresh();
  const pendingAfterSwitch = page.data.reminderConsentPending;
  const newWrite = page.toggleReminder({ detail: { value: true } });
  const pendingForNewSession = page.data.reminderConsentPending;
  first.resolve({ eventReminder: true });
  await oldWrite;
  const pendingAfterOldResponse = page.data.reminderConsentPending;
  second.resolve({ eventReminder: true });
  await newWrite;
  assert.equal(pendingBeforeSwitch, true);
  assert.equal(pendingAfterSwitch, false);
  assert.equal(pendingForNewSession, true);
  assert.equal(pendingAfterOldResponse, true);
  assert.equal(page.data.reminderConsentPending, false);
  assert.equal(page.data.eventReminder, true);
});

test('both consent switches expose locked and retry states in WXML', () => {
  assert.match(markup, /id="reminderConsentSwitch"[^>]*disabled="\{\{[^}]*reminderConsentPending[^}]*reminderConsentUncertain/);
  assert.match(markup, /id="similarInvitesConsentSwitch"[^>]*disabled="\{\{[^}]*similarInvitesConsentPending[^}]*similarInvitesConsentUncertain/);
  assert.match(markup, /bindtap="retryReminderConsent"/);
  assert.match(markup, /bindtap="retrySimilarInvitesConsent"/);
});
