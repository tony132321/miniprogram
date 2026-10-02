import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { createApi } = require('../miniprogram/utils/api.js');
const source = readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function mount(post: (path: string, payload?: unknown) => Promise<unknown>,
  getOverride?: (path: string, session: string) => Promise<unknown>,
  sharedStorage?: Map<string, any>, logoutOverride?: () => Promise<unknown>) {
  let page: Record<string, any> | undefined;
  const storage = sharedStorage || new Map<string, any>([['sessionToken', 'session-a'], ['userId', 'member']]);
  const consentState = new Map<string, boolean>();
  const similarState = new Map<string, boolean>();
  const get = async (path: string) => {
    const session = storage.get('sessionToken') || '';
    if (getOverride) return getOverride(path, session);
    if (path === '/me/consents') return { eventReminder: consentState.get(session) || false,
      eventReminderNotice: { text: '提醒说明', version: 'reminder-v1' } };
    if (path === '/me/similar-invites') return { granted: similarState.has(session)
      ? similarState.get(session) : session === 'session-a',
      notice: { text: '类似活动说明', version: 'similar-v1' } };
    if (path === '/me/notifications?offset=0') return { items: [], total: 0, unreadTotal: 0,
      nextOffset: null, snapshot: 'a'.repeat(32) };
    return { items: [] };
  };
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get, logout: logoutOverride,
        post: async (endpoint: string, payload: any) => {
          const session = storage.get('sessionToken') || '';
          const result = await post(endpoint, payload);
          if (endpoint === '/me/consents') consentState.set(session, Boolean(payload.eventReminder));
          if (endpoint === '/me/similar-invites') similarState.set(session, Boolean(payload.granted));
          return result;
        } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve(), profileFocus: undefined } }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) || ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); },
      removeStorageSync(key: string) { storage.delete(key); },
      switchTab() {},
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

test('restart preserves an unknown grant until the original key is replayed before revoke and regrant', async () => {
  const storage = new Map<string, any>([['sessionToken', 'session-a'], ['userId', 'member']]);
  const byKey = new Map<string, { eventReminder: boolean }>();
  const keys: string[] = [];
  let serverGranted = false;
  let loseFirstGrantResponse = true;
  const platform = {
    getStorageSync(key: string) { return storage.get(key) || ''; },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); },
    removeStorageSync(key: string) { storage.delete(key); },
    request(options: Record<string, any>) {
      const path = new URL(options.url).pathname;
      if (options.method === 'GET') {
        const data = path === '/me/consents'
          ? { eventReminder: serverGranted, eventReminderNotice: { text: '提醒说明', version: 'reminder-v1' } }
          : path === '/me/similar-invites'
            ? { granted: false, notice: { text: '类似活动说明', version: 'similar-v1' } }
            : path === '/me/notifications'
              ? { items: [], total: 0, unreadTotal: 0, nextOffset: null, snapshot: 'a'.repeat(32) }
              : { items: [] };
        options.success({ statusCode: 200, data });
        return;
      }
      assert.equal(path, '/me/consents');
      const key = options.header['Idempotency-Key'];
      keys.push(key);
      let result = byKey.get(key);
      if (!result) {
        serverGranted = options.data.eventReminder;
        result = { eventReminder: serverGranted };
        byKey.set(key, result);
      }
      if (loseFirstGrantResponse) {
        loseFirstGrantResponse = false;
        options.fail({ errMsg: 'response lost after commit' });
      } else options.success({ statusCode: 200, data: result });
    }
  };
  const config = { apiBase: 'https://api.example.test', developmentUser: '' };
  const firstApi = createApi(platform, config);
  const firstPage = mount(firstApi.post, path => firstApi.get(path), storage).page;
  await firstPage.refresh();
  await firstPage.toggleReminder({ detail: { value: true } });
  assert.equal(serverGranted, true);
  assert.equal(firstPage.data.reminderConsentUncertain, true);

  storage.set('sessionToken', 'session-b');
  const restartedApi = createApi(platform, config);
  const restartedPage = mount(restartedApi.post, path => restartedApi.get(path), storage).page;
  await restartedPage.refresh();
  assert.equal(restartedPage.data.reminderConsentUncertain, true);
  await restartedPage.toggleReminder({ detail: { value: false } });
  assert.equal(keys.length, 1, 'a new choice is blocked until the lost response is resolved');
  await restartedPage.retryReminderConsent();
  assert.equal(keys[1], keys[0], 'recovery replays the original durable idempotency key');
  await restartedPage.toggleReminder({ detail: { value: false } });
  assert.equal(serverGranted, false);
  await restartedPage.toggleReminder({ detail: { value: true } });
  assert.notEqual(keys[3], keys[0], 'the later grant is a fresh operation');
  assert.equal(serverGranted, true);
  assert.equal(restartedPage.data.eventReminder, true);
  assert.match(restartedPage.data.message, /已同意活动提醒/);
});

test('explicit logout removes unresolved consent recovery for the signed-out member', async () => {
  const storage = new Map<string, any>([['sessionToken', 'session-a'], ['userId', 'member']]);
  const { page } = mount(async () => {
    throw Object.assign(new Error('response lost'), { code: 'NETWORK_ERROR' });
  }, undefined, storage, async () => {
    storage.delete('sessionToken');
    storage.delete('userId');
  });
  await page.refresh();
  await page.toggleReminder({ detail: { value: true } });
  assert.equal(page.data.reminderConsentUncertain, true);
  assert.ok(storage.get('irlProfileConsentRecoveryV1')['session:member:reminder']);
  await page.logout();
  assert.equal(storage.get('irlProfileConsentRecoveryV1')['session:member:reminder'], undefined);
  storage.set('sessionToken', 'session-b');
  storage.set('userId', 'member');
  await page.refresh();
  assert.equal(page.data.reminderConsentUncertain, false);
});

test('an old token response cannot discard the same member recovery after token rotation', async () => {
  const first = deferred<unknown>();
  let serverGranted = false;
  let writes = 0;
  const { page, storage } = mount(async () => {
    writes += 1;
    if (writes === 1) {
      await first.promise;
      serverGranted = true;
    }
    return { eventReminder: true };
  }, async path => {
    if (path === '/me/consents') return { eventReminder: serverGranted,
      eventReminderNotice: { text: '提醒说明', version: 'reminder-v1' } };
    if (path === '/me/similar-invites') return { granted: false,
      notice: { text: '类似活动说明', version: 'similar-v1' } };
    if (path === '/me/notifications?offset=0') return { items: [], total: 0,
      nextOffset: null, snapshot: 'a'.repeat(32) };
    return { items: [] };
  });
  await page.refresh();
  const oldWrite = page.toggleReminder({ detail: { value: true } });
  storage.set('sessionToken', 'session-b');
  await page.refresh();
  assert.equal(page.data.reminderConsentUncertain, true);
  first.resolve({ eventReminder: true });
  await oldWrite;
  assert.equal(page.data.reminderConsentUncertain, true);
  assert.ok(storage.get('irlProfileConsentRecoveryV1')['session:member:reminder']);
  await page.retryReminderConsent();
  assert.equal(writes, 2);
  assert.equal(page.data.eventReminder, true);
  assert.equal(storage.get('irlProfileConsentRecoveryV1')['session:member:reminder'], undefined);
});

test('a definitive POST followed by a conflicting consent GET keeps the server value visible', async () => {
  let serverGranted = false;
  let grants = 0;
  const { page } = mount(async (path, payload: any) => {
    assert.equal(path, '/me/consents');
    if (payload.eventReminder) {
      grants += 1;
      serverGranted = grants > 1;
    } else serverGranted = false;
    return { eventReminder: payload.eventReminder };
  }, async path => {
    if (path === '/me/consents') return { eventReminder: serverGranted,
      eventReminderNotice: { text: '提醒说明', version: 'reminder-v1' } };
    if (path === '/me/similar-invites') return { granted: false,
      notice: { text: '类似活动说明', version: 'similar-v1' } };
    if (path === '/me/notifications?offset=0') return { items: [], total: 0,
      nextOffset: null, snapshot: 'a'.repeat(32) };
    return { items: [] };
  });
  await page.refresh();
  await page.toggleReminder({ detail: { value: true } });
  assert.equal(page.data.eventReminder, false);
  assert.match(page.data.message, /不一致|未能确认/);
  await page.toggleReminder({ detail: { value: true } });
  assert.equal(page.data.eventReminder, true);
  assert.equal(serverGranted, true);
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
  storage.set('userId', 'member-b');
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
