import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';

const require = createRequire(import.meta.url);
const { createApi } = require('../miniprogram/utils/api.js');
const { sha256 } = require('../miniprogram/utils/sha256.js');

test('mini-program fingerprint hashing matches SHA-256 for plain and Unicode text', () => {
  for (const value of ['', 'abc', '举报：现场有人受伤', '球拍🏸与换行\n继续说明', 'abc'.repeat(100), '🏸'.repeat(100)])
    assert.equal(sha256(value), createHash('sha256').update(value).digest('hex'));
});

test('event success state appears only after the server confirms the published event or registration', async () => {
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync() { return ''; }, showModal(options: Record<string, any>) { options.success({ confirm: true }); } },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: { id: 'e1', status: 'RECRUITING', version: 2,
      payload: { title: '羽毛球', startAt: '2026-10-01T10:00:00Z', feeMode: 'FREE' } }, isHost: true });
    return true;
  };
  await page.onLoad({ id: 'e1', success: 'published' });
  assert.equal(page.data.successState, 'PUBLISHED');
  page.setData({ successState: '' });
  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: { id: 'e1', status: 'RECRUITING', version: 2,
      payload: { title: '羽毛球', startAt: '2026-10-01T10:00:00Z', feeMode: 'FREE' } }, isHost: false });
    return true;
  };
  await page.onLoad({ id: 'e1', success: 'published' });
  assert.equal(page.data.successState, '');
  page.setData({ canJoin: true, myRegistration: null, successState: '' });
  page.action = async function () { this.setData({ myRegistration: { status: 'CONFIRMED' } }); return { id: 'r1' }; };
  await page.join();
  assert.equal(page.data.successState, 'JOINED');
  page.setData({ myRegistration: { status: 'CANCELLED' } });
  page.reconcileSuccessState();
  assert.equal(page.data.successState, '');
  page.setData({ successState: 'PUBLISHED', isHost: true, event: { id: 'e1', status: 'CANCELLED' } });
  page.reconcileSuccessState();
  assert.equal(page.data.successState, '');
});

test('mini-program API sends the current login token and preserves server errors', async () => {
  let captured: Record<string, any> | undefined;
  const api = createApi({
    request(options: Record<string, any>) { captured = options; options.success({ statusCode: 409, data: { code: 'VERSION_CONFLICT', message: '活动已更新' } }); },
    getStorageSync(key: string) { return key === 'sessionToken' ? 'session-token' : ''; }
  }, { apiBase: 'https://example.test', developmentUser: '' });
  await assert.rejects(() => api.post('/events/one/confirm', { expectedVersion: 2 }), { code: 'VERSION_CONFLICT' });
  assert.equal(captured?.url, 'https://example.test/events/one/confirm');
  assert.equal(captured?.header.Authorization, 'Bearer session-token');
  assert.ok(captured?.header['Idempotency-Key']);
});

test('mini-program suggestion request forwards its 30-second network timeout', async () => {
  let timeout: number | undefined;
  const api = createApi({
    request(options: Record<string, any>) {
      timeout = options.timeout;
      options.success({ statusCode: 200, data: { fields: {}, fieldSources: {}, unknown: [] } });
    },
    getStorageSync() { return 'host'; },
    setStorageSync() {}
  }, { apiBase: 'https://example.test', developmentUser: 'host' });
  await api.post('/events/drafts:suggest-local', { text: '下周六打球' }, undefined, { timeoutMs: 30_000 });
  assert.equal(timeout, 30_000);
});

test('a late suggestion response and in-progress retry retain one durable key until the page acknowledges it', async () => {
  const storage = new Map<string, unknown>();
  const requests: Array<Record<string, any>> = [];
  const platform = {
    request(options: Record<string, any>) { requests.push(options); },
    getStorageSync(key: string) { return storage.get(key) ?? ''; },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); }
  };
  const config = { apiBase: 'https://example.test', developmentUser: 'host' };
  const payload = { text: '下周六在深圳打球' };
  const path = '/events/drafts:suggest-local';
  const first = createApi(platform, config);
  const pending = first.post(path, payload, undefined, { keepKeyUntilAck: true });
  const firstKey = requests[0]?.header['Idempotency-Key'];
  const restarted = createApi(platform, config);
  const overlapping = restarted.post(path, payload, undefined, { keepKeyUntilAck: true });
  assert.equal(requests[1]?.header['Idempotency-Key'], firstKey);
  requests[1]?.success({ statusCode: 409, data: { code: 'AI_REQUEST_UNCERTAIN', message: '处理中' } });
  await assert.rejects(overlapping, { code: 'AI_REQUEST_UNCERTAIN' });
  requests[0]?.success({ statusCode: 200, data: { fields: { city: '深圳' } } });
  await pending;
  const replay = restarted.post(path, payload, undefined, { keepKeyUntilAck: true });
  assert.equal(requests[2]?.header['Idempotency-Key'], firstKey);
  requests[2]?.success({ statusCode: 200, data: { fields: { city: '深圳' } } });
  await replay;
  restarted.acknowledgeMutation('POST', path, payload);
  const next = restarted.post(path, payload, undefined, { keepKeyUntilAck: true });
  assert.notEqual(requests[3]?.header['Idempotency-Key'], firstKey);
  requests[3]?.success({ statusCode: 200, data: { fields: { city: '深圳' } } });
  await next;
});

test('mini-program logout clears local credentials only after server revocation succeeds', async () => {
  const storage = new Map<string, unknown>([['sessionToken', 'member-token'], ['userId', 'member-id']]);
  let requestedAuthorization = '';
  const api = createApi({
    request(options: Record<string, any>) {
      requestedAuthorization = options.header.Authorization;
      options.success({ statusCode: 200, data: { ok: true } });
    },
    getStorageSync(key: string) { return storage.get(key); },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); },
    removeStorageSync(key: string) { storage.delete(key); }
  }, { apiBase: 'https://example.test', developmentUser: '' });
  await api.logout();
  assert.equal(requestedAuthorization, 'Bearer member-token');
  assert.equal(storage.has('sessionToken'), false);
  assert.equal(storage.has('userId'), false);
  assert.equal(storage.get('sessionSignedOut'), true);
});

test('a deliberate logout suppresses automatic login on the next mini-program launch', async () => {
  let app: Record<string, any> | undefined;
  let logins = 0;
  runInNewContext(readFileSync(new URL('../miniprogram/app.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === './config.js') return { developmentUser: '' };
      if (path === './utils/api.js') return { api: { login: async () => { logins++; } } };
      throw new Error(`unexpected require ${path}`);
    },
    App(definition: Record<string, any>) { app = definition; },
    wx: { getStorageSync(key: string) { return key === 'sessionSignedOut' ? true : ''; }, showToast() {} }
  });
  assert.ok(app);
  app.onLaunch();
  await app.globalData.ready;
  assert.equal(logins, 0);
});

test('explicit WeChat login clears the deliberate logout marker', async () => {
  const storage = new Map<string, unknown>([['sessionSignedOut', true]]);
  const api = createApi({
    login(options: Record<string, any>) { options.success({ code: 'fresh-code' }); },
    request(options: Record<string, any>) {
      assert.equal(options.url, 'https://example.test/auth/wechat');
      options.success({ statusCode: 200, data: { token: 'new-session', userId: 'same-member' } });
    },
    getStorageSync(key: string) { return storage.get(key); },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); },
    removeStorageSync(key: string) { storage.delete(key); }
  }, { apiBase: 'https://example.test', developmentUser: '' });
  await api.login();
  assert.equal(storage.get('sessionToken'), 'new-session');
  assert.equal(storage.get('userId'), 'same-member');
  assert.equal(storage.has('sessionSignedOut'), false);
});

test('mini-program logout keeps credentials when network cannot confirm revocation', async () => {
  const storage = new Map<string, unknown>([['sessionToken', 'member-token'], ['userId', 'member-id']]);
  const api = createApi({
    request(options: Record<string, any>) { options.fail({ errMsg: 'offline' }); },
    getStorageSync(key: string) { return storage.get(key); },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); },
    removeStorageSync(key: string) { storage.delete(key); }
  }, { apiBase: 'https://example.test', developmentUser: '' });
  await assert.rejects(() => api.logout(), { code: 'NETWORK_ERROR' });
  assert.equal(storage.get('sessionToken'), 'member-token');
  assert.equal(storage.get('userId'), 'member-id');
});

test('a login response arriving after logout cannot restore credentials', async () => {
  const storage = new Map<string, unknown>([['sessionToken', 'old-session'], ['userId', 'member-id']]);
  let respondToLogin: ((response: Record<string, unknown>) => void) | undefined;
  const api = createApi({
    login(options: Record<string, any>) { options.success({ code: 'late-login-code' }); },
    request(options: Record<string, any>) {
      if (options.url.endsWith('/auth/wechat')) respondToLogin = options.success;
      else if (options.url.endsWith('/auth/logout')) options.success({ statusCode: 200, data: { ok: true } });
      else throw new Error('unexpected request');
    },
    getStorageSync(key: string) { return storage.get(key); },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); },
    removeStorageSync(key: string) { storage.delete(key); }
  }, { apiBase: 'https://example.test', developmentUser: '' });
  const pendingLogin = api.login();
  assert.ok(respondToLogin);
  await api.logout();
  respondToLogin({ statusCode: 200, data: { token: 'late-new-session', userId: 'member-id' } });
  await assert.rejects(() => pendingLogin, { code: 'LOGIN_CANCELLED' });
  assert.equal(storage.has('sessionToken'), false);
  assert.equal(storage.get('sessionSignedOut'), true);
});

test('profile logout clears private content before entering the activity list', async () => {
  let page: Record<string, any> | undefined;
  const navigations: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { logout: async () => ({ ok: true }) } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { switchTab({ url }: { url: string }) { navigations.push(url); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ hasSession: true, notifications: [{ id: 'private-notice' }], privacy: [{ id: 'private-request' }],
    reports: [{ id: 'private-report' }] });
  await page.logout();
  assert.equal(page.data.hasSession, false);
  assert.equal(page.data.notifications.length, 0);
  assert.equal(page.data.privacy.length, 0);
  assert.equal(page.data.reports.length, 0);
  assert.deepEqual(navigations, ['/pages/index/index']);
});

test('profile logout failure keeps private data visible and offers retry', async () => {
  let page: Record<string, any> | undefined;
  const navigations: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { logout: async () => { throw new Error('网络中断'); } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { switchTab({ url }: { url: string }) { navigations.push(url); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ hasSession: true, notifications: [{ id: 'private-notice' }] });
  await page.logout();
  assert.equal(page.data.hasSession, true);
  assert.equal(page.data.notifications.length, 1);
  assert.match(page.data.message, /网络中断/);
  assert.deepEqual(navigations, []);
});

test('profile export finishing after logout cannot copy former member data', async () => {
  let page: Record<string, any> | undefined;
  let resolveSnapshot!: (value: unknown) => void;
  let signalSnapshotRequested!: () => void;
  const snapshotRequested = new Promise<void>(resolve => { signalSnapshotRequested = resolve; });
  const snapshot = new Promise(resolve => { resolveSnapshot = resolve; });
  const clipboard: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {
        post: async () => ({ path: '/privacy/exports/ticket' }),
        get: async () => { signalSnapshotRequested(); return snapshot; },
        logout: async () => ({ ok: true })
      } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { setClipboardData({ data }: { data: string }) { clipboard.push(data); }, switchTab() {} }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ hasSession: true });
  const exporting = page.exportData();
  await snapshotRequested;
  await page.logout();
  resolveSnapshot({ privateReport: 'old member information' });
  await exporting;
  assert.deepEqual(clipboard, []);
  assert.equal(page.data.hasSession, false);
});

test('profile re-entry without a session removes private data before any fetch', async () => {
  let page: Record<string, any> | undefined;
  let requests = 0;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async () => { requests++; return { items: [] }; } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync() { return ''; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ notifications: [{ id: 'former-private-notice' }], reports: [{ id: 'former-private-report' }] });
  await page.onShow();
  assert.equal(page.data.notifications.length, 0);
  assert.equal(page.data.reports.length, 0);
  assert.match(page.data.message, /请先微信登录/);
  assert.equal(requests, 0);
});

test('event safety entry carries its event into the signed-in report form only for the same account', async () => {
  const globalData: Record<string, any> = { ready: Promise.resolve() };
  const tabs: string[] = [];
  const storage = new Map<string, string>([['sessionToken', 'token-a'], ['userId', 'member-a']]);
  const wx = {
    getStorageSync(key: string) { return storage.get(key) || ''; },
    switchTab({ url }: { url: string }) { tabs.push(url); }
  };
  let submittedReport: Record<string, any> | undefined;
  let eventPage: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { eventPage = definition; }, getApp() { return { globalData }; }, wx
  });
  assert.ok(eventPage);
  eventPage.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  eventPage.setData({ id: 'event-123' });
  eventPage.goToReport();
  assert.deepEqual(tabs, ['/pages/me/me']);
  let profile: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { post: async (_path: string, body: Record<string, any>) => { submittedReport = body; } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { profile = definition; }, getApp() { return { globalData }; }, wx
  });
  assert.ok(profile);
  profile.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  profile.refresh = async () => true;
  await profile.onShow();
  assert.equal(profile.data.reportEventId, 'event-123');
  assert.equal(globalData.reportContext, undefined);
  profile.setData({ reportDescription: '现场存在安全风险' });
  await profile.report();
  assert.equal(submittedReport?.eventId, 'event-123');
  assert.equal(submittedReport?.kind, 'SAFETY');
  profile.setData({ reportEventId: '' });
  await profile.onShow();
  assert.equal(profile.data.reportEventId, '');

  eventPage.goToReport();
  storage.set('userId', 'member-b');
  await profile.onShow();
  assert.equal(profile.data.reportEventId, '');
  assert.equal(globalData.reportContext, undefined);
});

test('member can copy current activity facts for a trusted contact without exposing invite credentials', () => {
  let copied = '';
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { setClipboardData({ data, success }: { data: string; success(): void }) { copied = data; success(); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'event-123', loadState: 'READY', hostAlias: '本场主办方', event: { inviteToken: 'private-invite-token',
    payload: { title: '周末球局', startAt: '2026-10-03T12:00:00Z', endAt: '2026-10-03T14:00:00Z',
      city: '上海', venueName: '公共球馆' } } });
  page.copySafetyDetails();
  assert.match(copied, /周末球局/);
  assert.match(copied, /公共球馆/);
  assert.match(copied, /本场主办方/);
  assert.match(copied, /2026-10-03T12:00:00Z/);
  assert.doesNotMatch(copied, /private-invite-token/);
  assert.match(page.data.message, /已复制/);
});

test('profile load failure offers a retry that restores live private data', async () => {
  let page: Record<string, any> | undefined;
  let online = false;
  let requests = 0;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (route: string) => {
        requests++;
        if (!online) throw Object.assign(new Error('网络中断'), { code: 'NETWORK_ERROR' });
        if (route.startsWith('/me/notifications')) return { items: [], total: 0, nextOffset: null };
        if (route === '/me/consents') return { eventReminder: false };
        if (route === '/me/similar-invites') return { granted: false };
        return { items: [] };
      } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return key === 'sessionToken' ? 'active-session' : ''; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.onShow();
  assert.equal(page.data.loadState, 'ERROR');
  assert.match(page.data.message, /网络中断/);
  assert.equal(typeof page.retryRefresh, 'function');
  assert.match(readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8'), /id="profileRetryButton"[^>]*bindtap="retryRefresh"/);
  online = true;
  await page.retryRefresh();
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.message, '');
  assert.equal(requests, 18);
});

test('profile shows honest external reminder states on initial and later notification pages', async () => {
  let page: Record<string, any> | undefined;
  const notices = [
    { id: 'off', external_status: 'UNAVAILABLE' },
    { id: 'accepted', external_status: 'PROVIDER_ACCEPTED' },
    { id: 'no-consent', external_status: 'CONSENT_WITHDRAWN' },
    { id: 'uncertain', external_status: 'UNKNOWN_REQUIRES_RECONCILIATION' },
    { id: 'stale', external_status: 'STALE_VERSION' },
    { id: 'pending', external_status: 'NOT_REQUESTED' },
    { id: 'unconfigured', external_status: 'PURPOSE_NOT_CONFIGURED' },
    { id: 'unknown', external_status: 'UNRECOGNIZED_PROVIDER_STATE' }
  ];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (route: string) => {
        if (route === '/me/notifications?offset=0') return { items: notices.slice(0, 4), total: notices.length,
          nextOffset: 4, snapshot: 'a'.repeat(32) };
        if (route.startsWith('/me/notifications?offset=4&snapshot=')) return { items: notices.slice(4),
          total: notices.length, nextOffset: null, snapshot: 'a'.repeat(32) };
        if (route === '/me/consents') return { eventReminder: false };
        if (route === '/me/similar-invites') return { granted: false };
        return { items: [] };
      } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.refresh();
  assert.deepEqual(Array.from(page.data.notifications, (item: any) => item.externalStatusLabel), [
    '外部提醒不可用，请查看站内通知', '提供方已受理，未确认送达',
    '未开通外部提醒', '外部提醒结果待核对，请查看站内通知'
  ]);
  await page.loadMoreNotifications();
  assert.deepEqual(Array.from(page.data.notifications.slice(4), (item: any) => item.externalStatusLabel), [
    '旧版本提醒已取消', '外部提醒待处理', '未开通外部提醒，请查看站内通知', '外部提醒状态待核对'
  ]);
  assert.match(readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8'),
    /{{item\.externalStatusLabel}}/);
});

test('production-style mini-program config ignores a stale development identity', async () => {
  let captured: Record<string, any> | undefined;
  const api = createApi({
    request(options: Record<string, any>) { captured = options; options.success({ statusCode: 200, data: {} }); },
    getStorageSync(key: string) { return key === 'devUser' ? 'old-local-user' : ''; }
  }, { apiBase: 'https://api.example.test', developmentUser: '' });
  await api.get('/me/events');
  assert.equal(captured?.header['X-Dev-User'], undefined);
  assert.equal(captured?.header.Authorization, undefined);
});

test('production-style profile page cannot switch to a development identity', () => {
  let page: Record<string, any> | undefined;
  const writes: string[] = [];
  const source = readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { removeStorageSync(key: string) { writes.push(`remove:${key}`); },
      setStorageSync(key: string) { writes.push(`set:${key}`); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ devUser: 'old-local-user' });
  page.setDevUser();
  assert.equal(page.data.developmentMode, false);
  assert.deepEqual(writes, []);
});

test('profile refreshes changed consent text after a stale-version denial', async () => {
  let page: Record<string, any> | undefined;
  let noticeReads = 0;
  const writes: Array<Record<string, unknown>> = [];
  const api = {
    async get(path: string) {
      if (path === '/me/consents') {
        noticeReads++;
        return { eventReminder: false, eventReminderNotice: { text: `说明 ${noticeReads}`, version: `v${noticeReads}` } };
      }
      if (path === '/me/similar-invites') return { granted: false, notice: { text: '类似活动说明', version: 'similar-v1' } };
      if (path === '/me/notifications?offset=0') return { items: [], total: 0, nextOffset: null, snapshot: 'empty' };
      return { items: [] };
    },
    async post(_path: string, body: Record<string, unknown>) {
      writes.push(body);
      throw Object.assign(new Error('授权说明已变化'), { code: 'CONSENT_NOTICE_CHANGED' });
    }
  };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.refresh();
  await page.toggleReminder({ detail: { value: true } });
  assert.equal(JSON.stringify(writes), JSON.stringify([{ eventReminder: true, noticeVersion: 'v1' }]));
  assert.equal(noticeReads, 2);
  assert.equal(page.data.eventReminderNotice, '说明 2');
  assert.equal(page.data.eventReminder, false);
  assert.match(page.data.message, /重新阅读/);
});

test('profile clears reconfirmation prompts after a successful fresh consent', async () => {
  let page: Record<string, any> | undefined;
  const api = { async post() { return { granted: true }; } };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ eventReminderNeedsReconfirmation: true, similarInvitesNeedsReconfirmation: true,
    eventReminderNoticeVersion: 'current-1', similarInvitesNoticeVersion: 'current-2' });
  await page.toggleReminder({ detail: { value: true } });
  await page.toggleSimilarInvites({ detail: { value: true } });
  assert.equal(page.data.eventReminderNeedsReconfirmation, false);
  assert.equal(page.data.similarInvitesNeedsReconfirmation, false);
});

test('profile page can load older notifications while retaining the full unread queue', async () => {
  let page: Record<string, any> | undefined;
  const requests: string[] = [];
  const api = { async get(path: string) {
    requests.push(path);
    if (path === '/me/notifications?offset=0') return { items: [{ id: 'new', kind: 'EVENT_CANCELLED' }],
      total: 2, nextOffset: 1, snapshot: 'a'.repeat(32) };
    if (path === `/me/notifications?offset=1&snapshot=${'a'.repeat(32)}`) return {
      items: [{ id: 'old', kind: 'EVENT_CHANGED' }], total: 2, nextOffset: null, snapshot: 'a'.repeat(32) };
    if (path === '/me/consents') return { eventReminder: false };
    if (path === '/me/similar-invites') return { granted: false };
    return { items: [] };
  } };
  const source = readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.refresh();
  assert.equal(page.data.notifications.length, 1);
  assert.equal(page.data.notificationsTotal, 2);
  await page.loadMoreNotifications();
  assert.deepEqual(page.data.notifications.map((item: { id: string }) => item.id), ['new', 'old']);
  assert.equal(page.data.nextNotificationOffset, null);
  assert.deepEqual(requests.filter(path => path.startsWith('/me/notifications?')),
    ['/me/notifications?offset=0', `/me/notifications?offset=1&snapshot=${'a'.repeat(32)}`]);
});

test('profile page restarts notification paging after a notice changes', async () => {
  let page: Record<string, any> | undefined;
  let firstReads = 0;
  const api = { async get(path: string) {
    if (path === '/me/notifications?offset=0') {
      firstReads += 1;
      return { items: [{ id: firstReads === 1 ? 'old' : 'new' }], total: 2,
        nextOffset: 1, snapshot: firstReads === 1 ? 'a'.repeat(32) : 'b'.repeat(32) };
    }
    if (path.startsWith('/me/notifications?offset=1'))
      throw Object.assign(new Error('通知列表已变化'), { code: 'QUEUE_CHANGED' });
    if (path === '/me/consents') return { eventReminder: false };
    if (path === '/me/similar-invites') return { granted: false };
    return { items: [] };
  } };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.refresh();
  await page.loadMoreNotifications();
  assert.equal(firstReads, 2);
  assert.equal(page.data.notifications.length, 1);
  assert.equal(page.data.notifications[0].id, 'new');
  assert.match(page.data.message, /已从最新通知重新加载/);
});

test('profile page does not claim notification reload succeeded after a follow-up load failure', async () => {
  let page: Record<string, any> | undefined;
  let firstReads = 0;
  const api = { async get(path: string) {
    if (path === '/me/notifications?offset=0') {
      firstReads += 1;
      if (firstReads > 1) throw new Error('加载失败，请重试');
      return { items: [{ id: 'old' }], total: 2, nextOffset: 1, snapshot: 'a'.repeat(32) };
    }
    if (path.startsWith('/me/notifications?offset=1'))
      throw Object.assign(new Error('通知列表已变化'), { code: 'QUEUE_CHANGED' });
    if (path === '/me/consents') return { eventReminder: false };
    if (path === '/me/similar-invites') return { granted: false };
    return { items: [] };
  } };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.refresh();
  await page.loadMoreNotifications();
  assert.match(page.data.message, /加载失败/);
  assert.doesNotMatch(page.data.message, /已从最新通知重新加载/);
});

test('switching local test identity clears the previous member’s notices before reload', () => {
  let page: Record<string, any> | undefined;
  const pending = new Promise(() => {});
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: () => pending } };
      if (path === '../../config.js') return { developmentUser: 'old-member' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { removeStorageSync() {}, setStorageSync() {} }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ devUser: 'new-member', notifications: [{ id: 'old-private-notice' }],
    notificationsTotal: 1, nextNotificationOffset: 1, notificationSnapshot: 'a'.repeat(32),
    reports: [{ id: 'old-private-report' }] });
  page.setDevUser();
  assert.equal(page.data.notifications.length, 0);
  assert.equal(page.data.reports.length, 0);
  assert.equal(page.data.notificationsTotal, 0);
  assert.equal(page.data.nextNotificationOffset, null);
});

test('opening an account-wide notice does not navigate to a missing activity', async () => {
  let page: Record<string, any> | undefined;
  const navigations: string[] = [];
  const api = {
    async post() { return { status: 'OPENED' }; },
    async get(path: string) {
      if (path === '/me/notifications?offset=0') return { items: [], total: 0, nextOffset: null, snapshot: 'a'.repeat(32) };
      if (path === '/me/consents') return { eventReminder: false };
      if (path === '/me/similar-invites') return { granted: false };
      return { items: [] };
    }
  };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { navigateTo({ url }: { url: string }) { navigations.push(url); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.openNotice({ currentTarget: { dataset: { id: 'public-pause', kind: 'PUBLIC_RECRUITMENT_CLOSED' } } });
  assert.deepEqual(navigations, []);
  assert.match(page.data.message, /通知已打开/);
});

test('failed detail navigation leaves a cancellation unread until the detail opens on retry', async () => {
  let page: Record<string, any> | undefined;
  let navigation: Record<string, any> | undefined;
  const openedRoutes: string[] = [];
  let status = 'QUEUED';
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { post: async (route: string) => {
        openedRoutes.push(route);
        status = 'OPENED';
        return { status };
      } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { navigateTo(options: Record<string, any>) { navigation = options; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  const notice = { currentTarget: { dataset: { id: 'cancel-notice', event: 'cancelled/event', kind: 'EVENT_CANCELLED' } } };

  const failedOpen = page.openNotice(notice);
  assert.equal(status, 'QUEUED');
  assert.deepEqual(openedRoutes, []);
  assert.equal(navigation?.url, '/pages/event/event?id=cancelled%2Fevent');
  navigation.fail({ errMsg: 'navigateTo:fail page stack overflow' });
  await failedOpen;
  assert.equal(status, 'QUEUED');
  assert.deepEqual(openedRoutes, []);
  assert.match(page.data.message, /page stack overflow/);

  const successfulOpen = page.openNotice(notice);
  assert.equal(status, 'QUEUED');
  navigation.success({});
  await successfulOpen;
  assert.equal(status, 'OPENED');
  assert.deepEqual(openedRoutes, ['/me/notifications/cancel-notice/open']);
});

test('activity list clears the previous identity and ignores a late old response', async () => {
  let page: Record<string, any> | undefined;
  let currentUser = 'old-member';
  let resolveOld!: (value: unknown) => void;
  const oldResponse = new Promise(resolve => { resolveOld = resolve; });
  const api = { get: () => currentUser === 'old-member'
    ? oldResponse : Promise.resolve({ items: [{ id: 'new-event' }] }) };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/index/index.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: 'old-member' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? currentUser : ''; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ items: [{ id: 'old-event' }] });
  const oldLoad = page.onShow();
  await Promise.resolve();
  currentUser = 'new-member';
  const newLoad = page.onShow();
  assert.equal(page.data.items.length, 0);
  await newLoad;
  resolveOld({ items: [{ id: 'old-event' }] });
  await oldLoad;
  assert.equal(page.data.items.length, 1);
  assert.equal(page.data.items[0].id, 'new-event');
});

test('profile re-entry clears another identity’s private data before loading and ignores its late response', async () => {
  let page: Record<string, any> | undefined;
  let currentUser = 'old-member';
  let resolveOld!: (value: unknown) => void;
  let resolveNew!: (value: unknown) => void;
  let oldStarted!: () => void;
  let newStarted!: () => void;
  const oldResponse = new Promise(resolve => { resolveOld = resolve; });
  const newResponse = new Promise(resolve => { resolveNew = resolve; });
  const oldRequestStarted = new Promise<void>(resolve => { oldStarted = resolve; });
  const newRequestStarted = new Promise<void>(resolve => { newStarted = resolve; });
  const api = { get: () => {
    if (currentUser === 'old-member') { oldStarted(); return oldResponse; }
    newStarted(); return newResponse;
  } };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: 'old-member' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? currentUser : ''; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ notifications: [{ id: 'old-private' }], reports: [{ id: 'old-report' }] });
  const oldLoad = page.onShow();
  await oldRequestStarted;
  currentUser = 'new-member';
  const newLoad = page.onShow();
  await newRequestStarted;
  assert.equal(page.data.notifications.length, 0);
  assert.equal(page.data.reports.length, 0);
  resolveNew({ items: [{ id: 'new-private' }], total: 1, nextOffset: null, snapshot: 'a'.repeat(32), eventReminder: false, granted: false });
  await newLoad;
  resolveOld({ items: [{ id: 'old-private' }], total: 1, nextOffset: null, snapshot: 'b'.repeat(32) });
  await oldLoad;
  assert.equal(page.data.notifications[0].id, 'new-private');
  assert.equal(page.data.reports[0].id, 'new-private');
});

test('creation page clears another identity’s draft and ignores its late edit load', async () => {
  let page: Record<string, any> | undefined;
  let currentUser = 'old-host';
  let resolveOld!: (value: unknown) => void;
  const oldResponse = new Promise(resolve => { resolveOld = resolve; });
  const storage = new Map([['editDraftId', 'old-draft']]);
  const api = { get: (path: string) => path === '/system/safety' ? Promise.resolve({ status: 'OPEN' }) : oldResponse };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: 'old-host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? currentUser : storage.get(key) || ''; },
      removeStorageSync(key: string) { storage.delete(key); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  const oldLoad = page.onShow();
  await Promise.resolve();
  currentUser = 'new-host';
  page.setData({ draft: { id: 'old-draft' }, form: { title: '旧账号私密草稿' }, aiText: '旧账号输入' });
  await page.onShow();
  assert.equal(page.data.draft, null);
  assert.equal(page.data.form.title, '');
  assert.equal(page.data.aiText, '');
  resolveOld({ id: 'old-draft', status: 'DRAFT', payload: { title: '旧账号私密草稿' } });
  await oldLoad;
  assert.equal(page.data.draft, null);
  assert.equal(page.data.form.title, '');
});

test('relative-date draft suggestion shows the full city-local date and weekday before saving', async () => {
  let page: Record<string, any> | undefined;
  const requests: Array<Record<string, unknown>> = [];
  const suggestion = { fields: { city: '深圳', timeZone: 'Asia/Shanghai', startAt: '2026-09-26T12:00:00.000Z',
    endAt: '2026-09-26T14:00:00.000Z', templateDurationMinutes: 120 },
    fieldSources: { city: 'USER_EXPLICIT', timeZone: 'TEMPLATE_DEFAULT', startAt: 'USER_EXPLICIT',
      endAt: 'USER_EXPLICIT', templateDurationMinutes: 'USER_EXPLICIT' }, unknown: [], draft: { id: 'model-draft', version: 1 } };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post(_path: string, body: Record<string, unknown>) {
        requests.push(body); return suggestion; } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return ''; } },
    setTimeout() { return 1; }, clearTimeout() {}
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ aiText: '本周六晚上八点在深圳打羽毛球' });
  await page.suggest();
  assert.ok(page.data.suggestionNotes.includes('开始时间：2026-09-26 周六 20:00（来自原话）'));
  assert.ok(page.data.suggestionNotes.includes('结束时间：2026-09-26 周六 22:00（来自原话）'));
  assert.equal(page.data.startDate, '2026-09-26');
  assert.equal(page.data.startTime, '20:00');
  assert.equal(page.data.endDate, '2026-09-26');
  assert.equal(page.data.endTime, '22:00');
  assert.equal(page.data.templateDurationMinutes, 120);
  page.setStartTime({ detail: { value: '21:00' } });
  assert.equal(page.data.endTime, '23:00');
  assert.equal(page.data.draft.id, 'model-draft');
  await page.suggest();
  assert.equal(requests[0]?.eventId, undefined);
  assert.equal(requests[1]?.eventId, 'model-draft');
});

test('explicit duration survives a missing city until the host chooses a date', async () => {
  let page: Record<string, any> | undefined;
  const suggestion = { fields: { type: 'badminton', templateDurationMinutes: 180 },
    fieldSources: { type: 'USER_EXPLICIT', templateDurationMinutes: 'USER_EXPLICIT' },
    unknown: ['具体日期时间', '城市'] };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post() { return suggestion; } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return ''; } }, setTimeout() { return 1; }, clearTimeout() {}
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ aiText: '周六晚上八点打三小时羽毛球' });
  await page.suggest();
  assert.equal(page.data.startDate, '');
  assert.equal(page.data.endDate, '');
  assert.equal(page.data.templateDurationMinutes, 180);
  assert.ok(page.data.suggestionNotes.includes('活动时长：180 分钟（来自原话）'));
  page.setStartDate({ detail: { value: '2026-09-26' } });
  assert.equal(page.data.endDate, '2026-09-26');
  assert.equal(page.data.endTime, '23:00');
  assert.equal(page.buildInput().templateDurationMinutes, 180);
});

test('a generated draft is labeled as unverified and still asks the host to confirm fields', async () => {
  let page: Record<string, any> | undefined;
  let requestBody: Record<string, unknown> | undefined;
  const suggestion = { aiStatus: 'GENERATED', aiContentLabel: 'AI_GENERATED_UNVERIFIED',
    fields: { title: '周末球局', venueName: '公共球馆' },
    fieldSources: { title: 'NEEDS_CONFIRMATION', venueName: 'NEEDS_CONFIRMATION' }, unknown: [] };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post(_path: string, body: Record<string, unknown>) {
        requestBody = body; return suggestion; } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return ''; } }, setTimeout() { return 1; }, clearTimeout() {}
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ editingEvent: { id: 'published-event' } });
  await page.suggest();
  assert.equal(requestBody?.eventId, 'published-event');
  assert.match(page.data.message, /AI.*未经核验.*逐项确认/);
  assert.ok(page.data.suggestionNotes.includes('场地：公共球馆（待确认）'));
  assert.equal(page.data['form.title'], '周末球局');
  assert.equal(page.data['form.venueName'], '公共球馆');
  assert.equal(page.data.venueConfirmed, false);
});

test('slow suggestion offers manual editing and ignores its late answer after the host edits', async () => {
  let page: Record<string, any> | undefined;
  let finish!: (value: unknown) => void;
  const response = new Promise(resolve => { finish = resolve; });
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextTimer = 1;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { post: () => response } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return ''; } },
    setTimeout(fn: () => void, ms: number) { const id = nextTimer++; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id: number) { timers.delete(id); }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ aiText: '本周六晚上八点在深圳打羽毛球' });
  const pending = page.suggest();
  assert.equal(page.data.suggestionLoading, true);
  for (const timer of timers.values()) if (timer.ms === 15_000) timer.fn();
  assert.equal(page.data.suggestionSlow, true);
  page.input({ currentTarget: { dataset: { field: 'city' } }, detail: { value: '广州' } });
  assert.equal(page.data.suggestionLoading, false);
  assert.equal(timers.size, 0);
  finish({ fields: { city: '深圳' }, fieldSources: { city: 'USER_EXPLICIT' }, unknown: [] });
  await pending;
  assert.equal(page.data['form.city'], '广州');
  assert.equal(page.data.aiText, '本周六晚上八点在深圳打羽毛球');
  assert.equal(page.data.suggestionNotes.length, 0);
  const wxml = readFileSync(new URL('../miniprogram/pages/create/create.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /suggestionSlow[^\n]*继续手动填写/);
});

test('a draft suggestion that never responds stops after 30 seconds and keeps the host input', async () => {
  let page: Record<string, any> | undefined;
  let finish!: (value: unknown) => void;
  const response = new Promise(resolve => { finish = resolve; });
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextTimer = 1;
  let requestTimeout: number | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { post(_path: string, _body: unknown, _key: unknown, options: { timeoutMs?: number }) {
        requestTimeout = options?.timeoutMs;
        return response;
      } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return ''; } },
    setTimeout(fn: () => void, ms: number) { const id = nextTimer++; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id: number) { timers.delete(id); }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ aiText: '下周六晚上八点在深圳打羽毛球', form: { ...page.data.form, title: '已手动填写的标题' } });
  const pending = page.suggest();
  assert.equal(timers.size >= 1, true);
  for (const timer of [...timers.values()].filter(timer => timer.ms === 15_000)) timer.fn();
  assert.equal(page.data.suggestionSlow, true);
  for (const timer of [...timers.values()].filter(timer => timer.ms === 30_000)) timer.fn();
  await pending;
  assert.equal(requestTimeout, 30_000);
  assert.equal(page.data.suggestionLoading, false);
  assert.match(page.data.message, /超时.*手动/);
  assert.equal(page.data.aiText, '下周六晚上八点在深圳打羽毛球');
  assert.equal(page.data.form.title, '已手动填写的标题');
  finish({ fields: { city: '上海' }, fieldSources: { city: 'USER_EXPLICIT' }, unknown: [] });
  await Promise.resolve();
  assert.equal(page.data.form.city, '');
});

test('a suggestion retried after a local timeout reuses its request key until the answer is consumed', async () => {
  let page: Record<string, any> | undefined;
  const storage = new Map<string, unknown>();
  const requests: Array<Record<string, any>> = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextTimer = 1;
  const suggestion = { aiStatus: 'UNAVAILABLE', fields: { city: '深圳' },
    fieldSources: { city: 'USER_EXPLICIT' }, unknown: [] };
  const platform = {
    request(options: Record<string, any>) {
      requests.push(options);
      if (requests.length > 1) options.success({ statusCode: 200, data: suggestion });
    },
    getStorageSync(key: string) { return storage.get(key) ?? ''; },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); }
  };
  const api = createApi(platform, { apiBase: 'https://example.test', developmentUser: 'host' });
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: platform,
    setTimeout(fn: () => void, ms: number) { const id = nextTimer++; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id: number) { timers.delete(id); }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ aiText: '下周六在深圳打球' });
  const pending = page.suggest();
  for (const timer of [...timers.values()].filter(item => item.ms === 30_000)) timer.fn();
  await pending;
  requests[0]?.success({ statusCode: 200, data: suggestion });
  await Promise.resolve();
  await page.suggest();
  const firstKey = requests[0]?.header['Idempotency-Key'];
  assert.equal(typeof firstKey, 'string');
  assert.equal(requests[1]?.header['Idempotency-Key'], firstKey, 'the same user intent must replay the first recorded request');
  await page.suggest();
  assert.notEqual(requests[2]?.header['Idempotency-Key'], firstKey, 'a consumed answer permits an explicitly new suggestion');
});

test('activity list loads after startup login establishes the real identity', async () => {
  let page: Record<string, any> | undefined;
  let token = '';
  let finishLogin!: () => void;
  const ready = new Promise<void>(resolve => { finishLogin = resolve; });
  runInNewContext(readFileSync(new URL('../miniprogram/pages/index/index.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async () => ({ items: [{ id: 'member-event' }] }) } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready } }; },
    wx: { getStorageSync(key: string) { return key === 'sessionToken' ? token : key === 'userId' && token ? 'member' : ''; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  const loading = page.onShow();
  token = 'signed-in-token'; finishLogin();
  await loading;
  assert.equal(page.data.items[0]?.id, 'member-event');
});

test('activity list distinguishes load failure from empty results and retries into real sections', async () => {
  let page: Record<string, any> | undefined;
  let reads = 0;
  const items = [
    { id: 'host', status: 'RECRUITING', title: '我组织', isHost: true },
    { id: 'pending', status: 'RECRUITING', title: '待确认', isHost: false, myRegistrationStatus: 'OFFERED' },
    { id: 'joined', status: 'CONFIRMED', title: '即将参加', isHost: false, myRegistrationStatus: 'CONFIRMED' },
    { id: 'past', status: 'COMPLETED', title: '历史', isHost: false, myRegistrationStatus: 'CONFIRMED' }
  ];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/index/index.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get() {
        reads++;
        if (reads === 1) throw new Error('网络不可用');
        return { items };
      } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync() { return ''; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.onShow();
  assert.equal(page.data.loadState, 'ERROR');
  assert.equal(page.data.items.length, 0);
  await page.retry();
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.organized.map((item: { id: string }) => item.id).join(','), 'host');
  assert.equal(page.data.pending.map((item: { id: string }) => item.id).join(','), 'pending');
  assert.equal(page.data.pending[0].registrationLabel, '待接受补位');
  assert.equal(page.data.attending.map((item: { id: string }) => item.id).join(','), 'joined');
  assert.equal(page.data.history.map((item: { id: string }) => item.id).join(','), 'past');
  const wxml = readFileSync(new URL('../miniprogram/pages/index/index.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /loadState === 'ERROR'.*重试/s);
  assert.match(wxml, /loadState === 'READY' && items.length === 0/);
});

test('activity list retry renews an expired real login before loading', async () => {
  let page: Record<string, any> | undefined;
  let token = '';
  let logins = 0;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/index/index.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {
        async get() {
          if (!token) throw Object.assign(new Error('登录已失效'), { code: 'UNAUTHENTICATED' });
          return { items: [] };
        },
        async login() { logins++; token = 'renewed'; }
      } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return key === 'sessionToken' ? token : key === 'userId' && token ? 'member' : ''; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.onShow();
  assert.equal(page.data.loadState, 'ERROR');
  await page.retry();
  assert.equal(logins, 1);
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.items.length, 0);
});

test('creation page keeps the requested edit after startup login completes', async () => {
  let page: Record<string, any> | undefined;
  let token = '';
  let finishLogin!: () => void;
  const ready = new Promise<void>(resolve => { finishLogin = resolve; });
  const storage = new Map([['editDraftId', 'member-draft']]);
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (url: string) => url === '/system/safety'
        ? { status: 'OPEN' } : { id: 'member-draft', status: 'DRAFT', payload: { title: '我的草稿' } } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready } }; },
    wx: { getStorageSync(key: string) {
      if (key === 'sessionToken') return token;
      if (key === 'userId') return token ? 'member' : '';
      return storage.get(key) || '';
    }, removeStorageSync(key: string) { storage.delete(key); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  const loading = page.onShow();
  token = 'signed-in-token'; finishLogin();
  await loading;
  assert.equal(page.data.draft?.id, 'member-draft');
  assert.equal(page.data.form.title, '我的草稿');
});

test('draft edit remains retryable after a failed read and clears handoff only after success', async () => {
  let page: Record<string, any> | undefined;
  let reads = 0;
  const storage = new Map([['editDraftId', 'draft-1']]);
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get(url: string) {
        if (url === '/system/safety') return { status: 'OPEN' };
        reads++;
        if (reads === 1) throw new Error('网络不可用');
        return { id: 'draft-1', status: 'DRAFT', version: 2, payload: { title: '服务端草稿', city: '深圳' } };
      } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return storage.get(key) || ''; }, removeStorageSync(key: string) { storage.delete(key); },
      switchTab() {} }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.onShow();
  assert.equal(page.data.editorLoadState, 'ERROR');
  assert.equal(storage.get('editDraftId'), 'draft-1');
  await page.retryEditorLoad();
  assert.equal(page.data.editorLoadState, 'READY');
  assert.equal(page.data.draft.version, 2);
  assert.equal(page.data.form.title, '服务端草稿');
  assert.equal(storage.has('editDraftId'), false);
});

test('event editor round-trips Shanghai wall time through UTC regardless of device zone', async () => {
  let page: Record<string, any> | undefined;
  const storage = new Map([['editDraftId', 'shanghai-draft']]);
  const startAt = '2027-01-02T12:00:00.000Z';
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get(url: string) {
        if (url === '/system/safety') return { status: 'OPEN' };
        if (url === '/events/shanghai-draft') return { id: 'shanghai-draft', status: 'DRAFT', version: 2,
          payload: { title: '上海晚场', city: '上海', skillLevel: '中等水平', startAt, endAt: '2027-01-02T14:00:00.000Z' } };
        throw new Error(`unexpected request ${url}`);
      } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return storage.get(key) || ''; }, removeStorageSync(key: string) { storage.delete(key); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.onShow();
  assert.equal(page.data.editorLoadState, 'READY');
  assert.equal(page.data.startDate, '2027-01-02');
  assert.equal(page.data.startTime, '20:00');
  assert.equal(page.buildInput().startAt, startAt);
  assert.equal(page.buildInput().skillLevel, '中等水平');
});

test('repeat draft carries its prior duration to a newly chosen date without overriding manual end time', async () => {
  let page: Record<string, any> | undefined;
  const storage = new Map([['editDraftId', 'repeat-draft']]);
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get(url: string) {
        if (url === '/system/safety') return { status: 'OPEN' };
        if (url === '/events/repeat-draft') return { id: 'repeat-draft', status: 'DRAFT', version: 1,
          payload: { title: '下一场羽毛球', templateDurationMinutes: 150 } };
        throw new Error(`unexpected request ${url}`);
      } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return storage.get(key) || ''; }, removeStorageSync(key: string) { storage.delete(key); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.onShow();
  assert.equal(page.data.templateDurationMinutes, 150);
  assert.equal(page.data.startDate, '');
  assert.equal(page.data.endDate, '');
  assert.equal(page.data.form.venueName, '');
  assert.equal(page.data.form.feeCapYuan, '');
  page.setStartDate({ detail: { value: '2027-01-02' } });
  assert.equal(page.data.endDate, '2027-01-02');
  assert.equal(page.data.endTime, '22:30');
  page.setStartTime({ detail: { value: '23:00' } });
  assert.equal(page.data.endDate, '2027-01-03');
  assert.equal(page.data.endTime, '01:30');
  page.setEndTime({ detail: { value: '02:00' } });
  page.setStartTime({ detail: { value: '21:00' } });
  assert.equal(page.data.endDate, '2027-01-03');
  assert.equal(page.data.endTime, '02:00');
});

test('a saved spoken-duration draft keeps its stated fee on reload', async () => {
  let page: Record<string, any> | undefined;
  const storage = new Map([['editDraftId', 'spoken-draft']]);
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get(url: string) {
        if (url === '/events/spoken-draft') return { id: 'spoken-draft', status: 'DRAFT', version: 1,
          payload: { title: '球局', templateDurationMinutes: 180, feeMode: 'AA', feeCapFen: 5000 } };
        throw new Error(`unexpected request ${url}`);
      } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return storage.get(key) || ''; }, removeStorageSync(key: string) { storage.delete(key); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.onShow();
  assert.equal(page.data.templateDurationMinutes, 180);
  assert.equal(page.data.form.feeCapYuan, '50');
  page.setStartDate({ detail: { value: '2027-01-02' } });
  assert.equal(page.data.endTime, '23:00');
});

test('host seat is undecided until the creator explicitly chooses yes or no', async () => {
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return ''; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  assert.equal(page.data.hostParticipates, null);
  assert.equal(page.buildInput().hostParticipates, undefined);
  await page.publish();
  assert.match(page.data.message, /明确选择主办方本人是否参加/);
  page.setHostParticipates({ detail: { value: 'no' } });
  assert.equal(page.buildInput().hostParticipates, false);
  page.setHostParticipates({ detail: { value: 'yes' } });
  assert.equal(page.buildInput().hostParticipates, true);
  const wxml = readFileSync(new URL('../miniprogram/pages/create/create.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /radio-group[^>]*bindchange="setHostParticipates"/);
  assert.match(wxml, /id="hostParticipatesYes"/);
  assert.match(wxml, /id="hostParticipatesNo"/);
});

test('editing a confirmed venue clears the old statement and resends explicit confirmation in the change preview', async () => {
  let page: Record<string, any> | undefined;
  const requests: Array<{ path: string; body: Record<string, any> }> = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post(requestPath: string, body: Record<string, any>) {
        requests.push({ path: requestPath, body });
        return { material: true, affectedCount: 1, changes: [{ field: 'venueName', before: '旧场馆', after: '新场馆' }] };
      } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return ''; } }
  });
  assert.ok(page);
  const currentPage = page;
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ editorLoadState: 'READY', hostParticipates: true, venueConfirmed: true,
    editingEvent: { id: 'e1', version: 2, payload: { venueName: '旧场馆', venueStatus: 'HOST_CONFIRMED' } },
    form: { ...page.data.form, venueName: '旧场馆' } });
  page.input({ currentTarget: { dataset: { field: 'venueName' } }, detail: { value: '新场馆' } });
  assert.equal(page.data.venueConfirmed, false);
  page.buildInput = () => ({ venueName: '新场馆', venueStatus: currentPage.data.venueConfirmed ? 'HOST_CONFIRMED' : 'UNCONFIRMED' });
  await page.publish();
  assert.equal(requests.length, 0);
  assert.match(page.data.message, /重新确认场地/);
  page.setVenueConfirmed({ detail: { value: true } });
  await page.publish();
  assert.equal(requests[0]?.path, '/events/e1/changes:preview');
  assert.equal(requests[0]?.body.patch.venueStatus, 'HOST_CONFIRMED');
});

test('reopening a saved draft preserves an explicit choice that the host does not take a seat', async () => {
  let page: Record<string, any> | undefined;
  const storage = new Map([['editDraftId', 'no-seat-draft']]);
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get(url: string) {
        if (url === '/system/safety') return { status: 'OPEN' };
        if (url === '/events/no-seat-draft') return { id: 'no-seat-draft', status: 'DRAFT', version: 1,
          payload: { title: '六人场', hostParticipates: false } };
        throw new Error(`unexpected request ${url}`);
      } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return storage.get(key) || ''; }, removeStorageSync(key: string) { storage.delete(key); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.onShow();
  assert.equal(page.data.editorLoadState, 'READY');
  assert.equal(page.data.hostParticipates, false);
  assert.equal(page.buildInput().hostParticipates, false);
});

test('editor accepts a new account handoff when the target is bound to that account', async () => {
  let page: Record<string, any> | undefined;
  const storage = new Map([['editDraftId', 'new-draft'], ['editTargetOwner', 'dev:new-host']]);
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get(url: string) {
        return url === '/system/safety' ? { status: 'OPEN' }
          : { id: 'new-draft', status: 'DRAFT', version: 1, payload: { title: '新账号草稿' } };
      } } };
      if (path === '../../config.js') return { developmentUser: 'old-host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'new-host' : storage.get(key) || ''; },
      removeStorageSync(key: string) { storage.delete(key); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page._shownIdentity = 'dev:old-host';
  await page.onShow();
  assert.equal(page.data.draft.id, 'new-draft');
  assert.equal(page.data.editorLoadState, 'READY');
  assert.equal(storage.has('editTargetOwner'), false);
});

test('draft version conflict offers explicit reload without silently overwriting local edits', async () => {
  let page: Record<string, any> | undefined;
  let reads = 0;
  const storage = new Map<string, string>();
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {
        async post() { throw Object.assign(new Error('活动规则已更新'), { code: 'VERSION_CONFLICT' }); },
        async get(url: string) {
          if (url === '/system/safety') return { status: 'OPEN' };
          reads++;
          return { id: 'draft-1', status: 'DRAFT', version: 3, payload: { title: '服务端新版', city: '深圳' } };
        }
      } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return storage.get(key) || ''; }, setStorageSync(key: string, value: string) { storage.set(key, value); },
      removeStorageSync(key: string) { storage.delete(key); }, switchTab() {} }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ draft: { id: 'draft-1', version: 1 }, form: { ...page.data.form, title: '本地未保存修改' }, safetyStatus: 'OPEN' });
  page.buildInput = () => ({ title: '本地未保存修改' });
  await page.saveDraft();
  assert.equal(page.data.form.title, '本地未保存修改');
  assert.equal(page.data.conflict.id, 'draft-1');
  assert.equal(reads, 0);
  await page.reloadConflict();
  assert.equal(reads, 1);
  assert.equal(page.data.form.title, '服务端新版');
  assert.equal(page.data.draft.version, 3);
  assert.equal(page.data.conflict, null);
  const wxml = readFileSync(new URL('../miniprogram/pages/create/create.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /bindtap="retryEditorLoad"/);
  assert.match(wxml, /bindtap="reloadConflict"/);
});

test('creation page shows the server stop and refuses a new draft before a write', async () => {
  let page: Record<string, any> | undefined;
  const writes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {
        get: async (url: string) => url === '/system/safety' ? { status: 'CLOSED' } : {},
        post: async (url: string) => { writes.push(url); return {}; }
      } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; }, removeStorageSync() {} }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.onShow();
  assert.equal(page.data.safetyStatus, 'CLOSED');
  assert.match(page.data.safetyMessage, /暂停新增/);
  await page.saveDraft();
  assert.deepEqual(writes, []);
  assert.match(page.data.message, /暂停新增/);
  const wxml = readFileSync(new URL('../miniprogram/pages/create/create.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /id="saveDraftButton"[^>]*disabled="[^"]*safetyStatus !== 'OPEN'[^"]*"/);
  assert.match(wxml, /id="saveDraftButton"[^>]*editorLoadState === 'ERROR'/);
});

test('activity page hides new seat actions but keeps the exit path during a global stop', async () => {
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (url: string) => {
        if (url === '/system/safety') return { status: 'CLOSED' };
        if (url === '/events/e1') return { id: 'e1', hostId: 'host', status: 'RECRUITING', recruiting: true,
          version: 2, payload: { startAt: '2027-01-02T12:00:00Z', endAt: '2027-01-02T14:00:00Z' } };
        if (url === '/me/registrations') return { items: [{ id: 'r1', event_id: 'e1', status: 'CONFIRMED' }] };
        return { items: [] };
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return 'host'; } }, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1' });
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.safetyStatus, 'CLOSED');
  const wxml = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /safetyStatus === 'OPEN'[^\n]*bindtap="join"/);
  assert.match(wxml, /bindtap="leave"/);
});

test('invitation landing preserves a minimal summary and token across real login', async () => {
  let page: Record<string, any> | undefined;
  let modal: Record<string, any> | undefined;
  let session = '';
  let logins = 0;
  const summary = { id: 'e1', status: 'RECRUITING', version: 2, recruiting: true,
    title: '周六羽毛球', payload: { title: '周六羽毛球', startAt: '2027-01-02T12:00:00Z',
      endAt: '2027-01-02T14:00:00Z', city: '深圳', venueName: '公共场馆', feeMode: 'AA',
      feeCapFen: 5000, cancellationRule: '开始前可退出', approvalMode: 'AUTO', skillLevel: '中等水平' } };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {
        async get(url: string) {
          if (url === '/i/invite-1') return summary;
          if (url === '/events/e1') throw Object.assign(new Error('仅成员可看详情'), { code: 'FORBIDDEN' });
          if (url === '/system/safety') return { status: 'OPEN' };
          if (url === '/me/registrations') {
            if (!session) throw Object.assign(new Error('请先登录'), { code: 'UNAUTHENTICATED' });
            return { items: [] };
          }
          return { items: [] };
        },
        async login() { logins++; session = 'session'; }
      } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'sessionToken' ? session : key === 'userId' && session ? 'visitor' : ''; },
      showModal(options: Record<string, any>) { modal = options; } },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ token: 'invite-1' });
  assert.equal(await page.refresh(), false);
  assert.equal(page.data.loadState, 'LOGIN_REQUIRED');
  assert.equal(page.data.inviteSummary.title, '周六羽毛球');
  assert.equal(page.data.token, 'invite-1');
  await page.retryLogin();
  assert.equal(logins, 1);
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.event.recruiting, true);
  assert.equal(page.data.event.payload.title, '周六羽毛球');
  assert.equal(page.data.token, 'invite-1');
  assert.equal(page.data.canJoin, true);
  assert.equal(page.data.canUseCollaboration, false);
  assert.equal(page.data.canCheckIn, false);
  const joinPayloads: Array<Record<string, unknown>> = [];
  page.action = (_path: string, payload: Record<string, unknown>) => { joinPayloads.push(payload); };
  const cancelled = page.join();
  assert.match(modal?.content, /活动版本：2/);
  assert.match(modal?.content, /50 元\/人/);
  assert.match(modal?.content, /开始前可退出/);
  assert.match(modal?.content, /中等水平/);
  modal?.success({ confirm: false });
  await cancelled;
  assert.equal(joinPayloads.length, 0);
  const outdated = page.join();
  page.data.event = { ...page.data.event, version: 3 };
  modal?.success({ confirm: true });
  await outdated;
  assert.equal(joinPayloads.length, 0);
  assert.match(page.data.message, /重新确认/);
  const confirmed = page.join();
  modal?.success({ confirm: true });
  await confirmed;
  assert.equal(joinPayloads[0]?.inviteToken, 'invite-1');
  assert.equal(joinPayloads[0]?.acceptedRules, true);
  const wxml = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /loadState === 'LOGIN_REQUIRED'.*retryLogin/s);
  assert.match(wxml, /bindtap="goToMyActivities"/);
  assert.match(wxml, /canJoin/);
  assert.match(wxml, /canUseCollaboration/);
});

test('failed read requests describe a load failure rather than an uncertain submission', async () => {
  let failWithNetworkError = true;
  const api = createApi({
    request(options: Record<string, any>) {
      if (failWithNetworkError) options.fail({ errMsg: 'request:fail timeout' });
      else options.success({ statusCode: 503, data: {} });
    },
    getStorageSync() { return ''; }
  }, { apiBase: 'https://example.test', developmentUser: 'person-one' });
  await assert.rejects(() => api.get('/me/registrations'), error => {
    assert.equal((error as { code?: string }).code, 'NETWORK_ERROR');
    assert.match((error as Error).message, /加载失败/);
    assert.doesNotMatch((error as Error).message, /提交结果/);
    return true;
  });
  failWithNetworkError = false;
  await assert.rejects(() => api.get('/me/registrations'), error => {
    assert.equal((error as { status?: number }).status, 503);
    assert.match((error as Error).message, /加载失败/);
    assert.doesNotMatch((error as Error).message, /提交结果/);
    return true;
  });
});

test('event page does not render an unknown registration as not registered', async () => {
  let page: Record<string, any> | undefined;
  const api = {
    async get(path: string) {
      if (path === '/events/e1') return { id: 'e1', hostId: 'host', status: 'RECRUITING', version: 1, payload: {} };
      if (path === '/me/registrations') throw new Error('报名状态加载失败，请重试');
      throw new Error(`unexpected request ${path}`);
    }
  };
  const source = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'person-one' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync() { return 'person-one'; } },
    setTimeout,
    clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1' });
  assert.equal(await page.refresh(), false);
  assert.equal(page.data.event, null);
  assert.match(page.data.message, /报名状态加载失败/);
});

test('event completion sends the host’s actual held choice and zero people when not held', async () => {
  let page: Record<string, any> | undefined;
  const source = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {}, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1' });
  const sent: Record<string, any>[] = [];
  page.action = (_path: string, payload: Record<string, any>) => sent.push(payload);
  page.complete();
  assert.equal(sent.length, 0);
  assert.match(page.data.message, /选择/);
  page.setCompletionHeld({ detail: { value: 'not_held' } });
  page.complete();
  assert.equal(sent[0]?.held, false);
  assert.equal(sent[0]?.actualCount, 0);
  assert.equal(Array.isArray(sent[0]?.issues), true);
  assert.equal(sent[0]?.issues.length, 0);
  page.setCompletionHeld({ detail: { value: 'held' } });
  page.complete();
  assert.equal(sent.length, 1);
  assert.match(page.data.message, /人数/);
  page.setData({ actualCount: '5' });
  page.completionAnomalyInput({ detail: { value: '签到网络中断' } });
  page.completionVenueIssueInput({ detail: { value: '入口临时关闭' } });
  page.complete();
  assert.equal(sent[1]?.held, true);
  assert.equal(sent[1]?.actualCount, 5);
  assert.equal(sent[1]?.issues.join('|'), '异常：签到网络中断|场地问题：入口临时关闭');
  const wxml = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /id="completionAnomalyInput"[^>]*bindinput="completionAnomalyInput"/);
  assert.match(wxml, /id="completionVenueIssueInput"[^>]*bindinput="completionVenueIssueInput"/);
});

test('independent feedback requires both answers before recording willingness to repeat', async () => {
  let page: Record<string, any> | undefined;
  const sent: Record<string, any>[] = [];
  const source = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post(_path: string, payload: Record<string, any>) { sent.push(payload); } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'p1' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {}, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1', event: { version: 2 } });
  page.refresh = async () => true;
  await page.submitFeedback();
  assert.equal(sent.length, 0);
  assert.match(page.data.message, /实际举办/);
  page.setFeedbackHeld({ detail: { value: 'yes' } });
  await page.submitFeedback();
  assert.equal(sent.length, 0);
  assert.match(page.data.message, /再参加/);
  page.setFeedbackWouldRepeat({ detail: { value: 'no' } });
  await page.submitFeedback();
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.held, true);
  assert.equal(sent[0]?.wouldRepeat, false);
});

test('AA page refuses an empty or malformed amount instead of recording zero', () => {
  let page: Record<string, any> | undefined;
  const source = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {}, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  const sent: Record<string, any>[] = [];
  page.action = (path: string, payload: unknown) => { sent.push({ path, payload }); };
  for (const value of ['', ' ', 'abc', '-1', '1.001']) {
    page.setData({ totalYuan: value, message: '' });
    page.expense();
    assert.equal(sent.length, 0, `invalid amount ${JSON.stringify(value)} must not be submitted`);
    assert.match(page.data.message, /费用|金额/);
  }
  page.setData({ totalYuan: '100.01', message: '', expenses: [], expenseLoadState: 'EMPTY' });
  page.expense();
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.payload.totalFen, 10001);
  assert.equal(sent[0]?.payload.expectedLedgerRevision, 0);
});

test('share card only uses a source after its intent has been committed', async () => {
  let page: Record<string, any> | undefined;
  let finishIntent: ((value: unknown) => void) | undefined;
  const requests: Record<string, any>[] = [];
  const source = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { post(path: string, body: unknown) {
        requests.push({ path, body });
        return new Promise(resolve => { finishIntent = resolve; });
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {}, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1', isHost: true, event: { id: 'e1', version: 2, inviteToken: 'invite-1', recruiting: true, reviewStatus: 'APPROVED',
    payload: { title: '羽毛球' } } });
  const pending = page.prepareShare();
  assert.equal(requests.length, 1);
  assert.equal(page.data.shareSourceToken, '');
  assert.doesNotMatch(page.onShareAppMessage().path, /source=/);
  finishIntent?.({});
  await pending;
  assert.match(page.onShareAppMessage().path, /source=/);
  assert.equal(page.onShareAppMessage().title, '羽毛球');
  page.setData({ event: { ...page.data.event, aiSuggestionGenerated: true } });
  assert.equal(page.onShareAppMessage().title, '【曾生成 AI 建议】羽毛球');
  assert.equal(requests.length, 1);
  page.setData({ event: { ...page.data.event, riskPaused: true } });
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');
});

test('returning to the event page refreshes its version and drops a stale share source', async () => {
  let page: Record<string, any> | undefined;
  let detailReads = 0;
  const source = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get(path: string) {
        if (path === '/events/e1') {
          detailReads++;
          return { id: 'e1', hostId: 'host', status: 'RECRUITING', version: 3, inviteToken: 'invite-2',
            recruiting: true, payload: {} };
        }
        if (path === '/me/registrations') return { items: [] };
        if (path === '/events/e1/share-metrics') return { shareIntents: 1, attributedOpens: 0 };
        return { items: [] };
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync() { return 'host'; } }, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1', event: { id: 'e1', version: 2, inviteToken: 'invite-1' }, shareSourceToken: 'a'.repeat(32) });
  await page.onShow();
  assert.equal(detailReads, 0);
  await page.onShow();
  assert.equal(detailReads, 1);
  assert.equal(page.data.event.version, 3);
  assert.equal(page.data.shareSourceToken, '');
});

test('event page follows current cohost grant while preserving own participation after revocation', async () => {
  let page: Record<string, any> | undefined;
  let granted = true;
  const source = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get(path: string) {
        if (path === '/events/e1') return { id: 'e1', hostId: 'host', status: 'CONFIRMED', version: 2,
          cohostCapabilities: granted ? ['CHECKIN_MANAGE'] : [], payload: { startAt: '2027-01-02T12:00:00.000Z',
            endAt: '2027-01-02T14:00:00.000Z' } };
        if (path === '/me/registrations') return { items: [{ id: 'own-seat', event_id: 'e1', status: 'CONFIRMED' }] };
        return { items: [] };
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'helper' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'helper' : ''; } },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1' });
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.canManageCheckins, true);
  assert.equal(page.data.canApproveRegistration, false);
  assert.equal(page.data.canCheckIn, true);
  granted = false;
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.canManageCheckins, false);
  assert.equal(page.data.canCheckIn, true);
});

test('event page carries the current nickname display notice into a grant and prompts legacy reconfirmation', async () => {
  let page: Record<string, any> | undefined;
  const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {
        async get(route: string) {
          if (route === '/events/e1') return { id: 'e1', hostId: 'host', status: 'RECRUITING', version: 2,
            recruiting: true, payload: {} };
          if (route === '/events/e1/aliases') return { items: [], reconfirmationRequired: true,
            notice: { purpose: 'EVENT_MEMBER_DISPLAY', text: '仅在本活动内展示的昵称（可选）', version: 'current-notice' } };
          return { items: [] };
        },
        async post(path: string, body: Record<string, unknown>) { posts.push({ path, body }); return {}; }
      } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return ''; } }, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.data.id = 'e1';
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.aliasReconfirmationRequired, true);
  assert.equal(page.data.aliasNoticeText, '仅在本活动内展示的昵称（可选）');
  page.data.aliasInput = '新昵称';
  await page.saveAlias();
  assert.equal(posts[0]?.path, '/events/e1/aliases');
  assert.equal(posts[0]?.body.noticeVersion, 'current-notice');
});

test('a check-in token arriving after the event page hides is not displayed or refreshed', async () => {
  let page: Record<string, any> | undefined;
  let finishToken!: (value: unknown) => void;
  const tokenResponse = new Promise(resolve => { finishToken = resolve; });
  let qrDraws = 0;
  let refreshTimers = 0;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { post: () => tokenResponse } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() { qrDraws++; } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; }, createCanvasContext() { return {}; } },
    setTimeout() { refreshTimers++; return 1; }, clearTimeout() {}
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>, callback?: () => void) {
    Object.assign(this.data, patch);
    callback?.();
  };
  page.setData({ id: 'e1', event: { id: 'e1', version: 2, status: 'CONFIRMED' }, isHost: true });
  const pending = page.showCheckInToken();
  page.onHide();
  finishToken({ token: 'signed-token', expiresInSeconds: 30 });
  await pending;
  assert.equal(page.data.displayedCheckInToken, '');
  assert.equal(qrDraws, 0);
  assert.equal(refreshTimers, 0);
});

test('an expired check-in token is hidden while its replacement is still loading', async () => {
  let page: Record<string, any> | undefined;
  let finishToken!: (value: unknown) => void;
  const replacement = new Promise(resolve => { finishToken = resolve; });
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { post: () => replacement } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; }, createCanvasContext() { return {}; } },
    setTimeout() { return 1; }, clearTimeout() {}
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>, callback?: () => void) {
    Object.assign(this.data, patch);
    callback?.();
  };
  page.setData({ id: 'e1', event: { id: 'e1', version: 2, status: 'CONFIRMED' }, isHost: true,
    displayedCheckInToken: 'expired-token', checkInExpiresIn: 0 });
  const pending = page.showCheckInToken();
  const visibleDuringReplacement = page.data.displayedCheckInToken;
  finishToken({ token: 'fresh-token', expiresInSeconds: 30 });
  await pending;
  assert.equal(visibleDuringReplacement, '');
  assert.equal(page.data.displayedCheckInToken, 'fresh-token');
});

test('a check-in token received after its remaining lifetime is never shown', async () => {
  let page: Record<string, any> | undefined;
  let finishToken!: (value: unknown) => void;
  const tokenResponse = new Promise(resolve => { finishToken = resolve; });
  let now = 1_000;
  let qrDraws = 0;
  const timers: number[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { post: () => tokenResponse } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() { qrDraws++; } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; }, createCanvasContext() { return {}; } },
    Date: class extends Date { static now() { return now; } },
    setTimeout(_callback: () => void, delay: number) { timers.push(delay); return 1; }, clearTimeout() {}
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>, callback?: () => void) {
    Object.assign(this.data, patch);
    callback?.();
  };
  page.setData({ id: 'e1', event: { id: 'e1', version: 2, status: 'CONFIRMED' }, isHost: true });
  const pending = page.showCheckInToken();
  now += 2_500;
  finishToken({ token: 'already-expired', expiresInSeconds: 2 });
  await pending;
  assert.equal(page.data.displayedCheckInToken, '');
  assert.equal(qrDraws, 0);
  assert.ok(timers.length > 0, 'expired response should schedule a fresh request');
});

test('host page grants selected capabilities for this event and can revoke the returned grant', async () => {
  let page: Record<string, any> | undefined;
  const posts: Array<{ path: string; body: Record<string, any> }> = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post(path: string, body: Record<string, any>) {
        posts.push({ path, body }); return { id: 'grant-1', status: path.includes('revoke') ? 'REVOKED' : 'ACTIVE' };
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { showModal(options: Record<string, any>) { options.success({ confirm: true }); } },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.refresh = async () => true;
  page.setData({ id: 'e1', event: { version: 3, payload: { endAt: '2027-01-02T14:00:00.000Z' } },
    isHost: true, cohostUserId: 'member-1', selectedCohostCapabilities: ['CHECKIN_MANAGE'] });
  await page.grantCohost();
  assert.equal(posts[0]?.path, '/events/e1/cohosts');
  assert.equal(posts[0]?.body.expectedVersion, 3);
  assert.equal(posts[0]?.body.userId, 'member-1');
  assert.equal(posts[0]?.body.expiresAt, '2027-01-04T14:00:00.000Z');
  assert.equal(posts[0]?.body.capabilities[0], 'CHECKIN_MANAGE');
  await page.revokeCohost({ currentTarget: { dataset: { id: 'grant-1' } } });
  assert.equal(posts[1]?.path, '/cohost-grants/grant-1:revoke');
});

test('a slow older event refresh cannot overwrite a newer response', async () => {
  let page: Record<string, any> | undefined;
  let finishOld: ((value: unknown) => void) | undefined;
  let detailReads = 0;
  const source = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get(path: string) {
        if (path === '/events/e1') {
          detailReads++;
          if (detailReads === 1) return new Promise(resolve => { finishOld = resolve; });
          return Promise.resolve({ id: 'e1', hostId: 'host', status: 'RECRUITING', version: 3,
            inviteToken: 'invite-3', recruiting: true, payload: {} });
        }
        if (path === '/me/registrations') return Promise.resolve({ items: [] });
        if (path === '/events/e1/share-metrics') return Promise.resolve({ shareIntents: 0, attributedOpens: 0 });
        return Promise.resolve({ items: [] });
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return 'host'; } }, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1' });
  const oldRefresh = page.refresh();
  await page.refresh();
  assert.equal(page.data.event.version, 3);
  finishOld?.({ id: 'e1', hostId: 'host', status: 'RECRUITING', version: 2,
    inviteToken: 'invite-2', recruiting: true, payload: {} });
  await oldRefresh;
  assert.equal(page.data.event.version, 3);
  assert.equal(page.data.event.inviteToken, 'invite-3');
});

test('event page clears prior host controls before loading under another identity', async () => {
  let page: Record<string, any> | undefined;
  let currentUser = 'old-host';
  let finishDetail!: (value: unknown) => void;
  const detail = new Promise(resolve => { finishDetail = resolve; });
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: () => detail } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'old-host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? currentUser : ''; } },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1', currentUser: 'old-host', isHost: true,
    event: { id: 'e1', hostId: 'old-host' }, registrations: [{ id: 'private-seat' }],
    shareSourceToken: 'old-source', questionText: '旧账号私密问题', actualCount: '6' });
  await page.onShow();
  currentUser = 'new-member';
  const loading = page.onShow();
  assert.equal(page.data.event, null);
  assert.equal(page.data.isHost, false);
  assert.equal(page.data.registrations.length, 0);
  assert.equal(page.data.shareSourceToken, '');
  assert.equal(page.data.questionText, '');
  assert.equal(page.data.actualCount, '');
  finishDetail({ id: 'e1', hostId: 'old-host', status: 'RECRUITING', payload: {} });
  await loading;
});

test('event and profile block controls call the existing member routes', async () => {
  let eventPage: Record<string, any> | undefined;
  let profilePage: Record<string, any> | undefined;
  const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
  const api = { async post(path: string, body: Record<string, unknown>) { posts.push({ path, body }); return {}; } };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { eventPage = definition; }, wx: {}, setTimeout, clearTimeout
  });
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { profilePage = definition; }, wx: {}
  });
  assert.ok(eventPage); assert.ok(profilePage);
  for (const page of [eventPage, profilePage]) {
    page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
    page.refresh = async () => true;
  }
  eventPage.data.id = 'event-1';
  await eventPage.blockMember({ currentTarget: { dataset: { member: 'a'.repeat(16) } } });
  await profilePage.revokeBlock({ currentTarget: { dataset: { id: 'block-1' } } });
  assert.equal(posts[0]?.path, '/events/event-1/blocks');
  assert.equal(posts[0]?.body.memberId, 'a'.repeat(16));
  assert.equal(posts[1]?.path, '/me/blocks/block-1/revoke');
  assert.match(profilePage.data.message, /已撤销屏蔽/);
});

test('profile export obtains an owner-bound short-lived ticket before copying data', async () => {
  let page: Record<string, any> | undefined;
  const requests: string[] = [];
  let copied = '';
  const api = {
    async post(path: string) { requests.push(`POST ${path}`); return { path: '/privacy/exports/ticket-1' }; },
    async get(path: string) { requests.push(`GET ${path}`); return { account: { id: 'member' } }; }
  };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { setClipboardData({ data, success }: { data: string; success: () => void }) { copied = data; success(); } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.exportData();
  assert.deepEqual(requests, ['POST /privacy/exports', 'GET /privacy/exports/ticket-1']);
  assert.equal(JSON.parse(copied).account.id, 'member');
});

test('a deletion request receipt remains visible after the profile refresh and never claims deletion happened', async () => {
  let page: Record<string, any> | undefined;
  const notice = '已收到注销或删除申请；尚未停用账号、删除资料或去标识。';
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { post: async () => ({ id: 'request-1', status: 'OPEN', notice }) } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; }, wx: {}
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.refresh = async function () { this.setData({ message: '' }); return true; };
  await page.privacyRequest({ currentTarget: { dataset: { kind: 'DELETE' } } });
  assert.equal(page.data.message, notice);
  const wxml = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /item\.notice/);
});

test('event expense area distinguishes network failure, empty ledger, and forbidden access', async () => {
  let page: Record<string, any> | undefined;
  let mode: 'offline' | 'empty' | 'forbidden' = 'offline';
  let posts = 0;
  const ledgerPath = '/events/e1/expenses';
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { post: async () => { posts++; return {}; }, get: async (route: string) => {
        if (route === '/events/e1') return { id: 'e1', hostId: 'host', version: 2, status: 'CONFIRMED',
          payload: { startAt: '2027-01-02T12:00:00Z', endAt: '2027-01-02T14:00:00Z', feeMode: 'AA' } };
        if (route === '/system/safety') return { status: 'OPEN' };
        if (route === '/me/registrations') return { items: [{ event_id: 'e1', status: 'CONFIRMED' }] };
        if (route === ledgerPath) {
          if (mode === 'offline') throw Object.assign(new Error('网络中断'), { code: 'NETWORK_ERROR' });
          if (mode === 'forbidden') throw Object.assign(new Error('无权查看费用记录'), { code: 'FORBIDDEN' });
        }
        return { items: [] };
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'p1' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'p1' : ''; } }, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1', expenses: [{ id: 'stale-ledger' }] });
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.expenseLoadState, 'ERROR');
  assert.equal(page.data.expenses.length, 0);
  assert.match(page.data.expenseError, /网络中断/);
  page.setData({ totalYuan: '100' });
  page.expense();
  assert.equal(posts, 0);
  assert.match(page.data.message, /费用记录.*加载/);
  mode = 'empty';
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.expenseLoadState, 'EMPTY');
  mode = 'forbidden';
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.expenseLoadState, 'FORBIDDEN');
  const wxml = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /expenseLoadState === 'ERROR'[^\n]*bindtap="refresh"/);
  assert.match(wxml, /expenseLoadState === 'EMPTY'/);
  assert.match(wxml, /expenseLoadState === 'FORBIDDEN'/);
  assert.match(wxml, /id="recordExpenseButton"[^>]*disabled="{{expenseLoadState !== 'READY' && expenseLoadState !== 'EMPTY'}}"/);
  assert.match(wxml, /费用记录暂不可用/);
});

test('event attendance area does not hide failed reads as no check-ins', async () => {
  let page: Record<string, any> | undefined;
  let mode: 'offline' | 'manual-offline' | 'empty' | 'forbidden' = 'offline';
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (route: string) => {
        if (route === '/events/e1') return { id: 'e1', hostId: 'host', version: 2, status: 'CONFIRMED',
          payload: { startAt: '2027-01-02T12:00:00Z', endAt: '2027-01-02T14:00:00Z', feeMode: 'FREE' } };
        if (route === '/system/safety') return { status: 'OPEN' };
        if (route === '/me/registrations') return { items: [{ event_id: 'e1', status: 'CONFIRMED' }] };
        if (route === '/events/e1/manual-checkins' && mode === 'manual-offline')
          throw Object.assign(new Error('人工补记网络中断'), { code: 'NETWORK_ERROR' });
        if (route === '/events/e1/checkins') {
          if (mode === 'offline') throw Object.assign(new Error('签到记录网络中断'), { code: 'NETWORK_ERROR' });
          if (mode === 'forbidden') throw Object.assign(new Error('无权查看签到记录'), { code: 'FORBIDDEN' });
        }
        return { items: [] };
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; } }, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1', checkIns: [{ id: 'old-scan' }], manualCheckIns: [{ id: 'old-manual' }] });
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.attendanceLoadState, 'ERROR');
  assert.match(page.data.attendanceError, /网络中断/);
  assert.equal(page.data.checkIns.length, 0);
  assert.equal(page.data.manualCheckIns.length, 0);
  mode = 'empty';
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.attendanceLoadState, 'EMPTY');
  mode = 'manual-offline';
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.attendanceLoadState, 'ERROR');
  assert.match(page.data.attendanceError, /人工补记网络中断/);
  mode = 'forbidden';
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.attendanceLoadState, 'FORBIDDEN');
  const wxml = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /attendanceLoadState === 'ERROR'[^\n]*bindtap="refresh"/);
  assert.match(wxml, /attendanceLoadState === 'EMPTY'/);
  assert.match(wxml, /attendanceLoadState === 'FORBIDDEN'/);
});

test('event discussion area distinguishes failed reads from a genuinely empty discussion', async () => {
  let page: Record<string, any> | undefined;
  let mode: 'offline' | 'empty' | 'ready' | 'forbidden' = 'offline';
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (route: string) => {
        if (route === '/events/e1') return { id: 'e1', hostId: 'host', version: 2, status: 'CONFIRMED',
          payload: { startAt: '2027-01-02T12:00:00Z', endAt: '2027-01-02T14:00:00Z', feeMode: 'FREE' } };
        if (route === '/system/safety') return { status: 'OPEN' };
        if (route === '/me/registrations') return { items: [{ event_id: 'e1', status: 'CONFIRMED' }] };
        if (route === '/events/e1/content') {
          if (mode === 'offline') throw Object.assign(new Error('公告问答网络中断'), { code: 'NETWORK_ERROR' });
          if (mode === 'forbidden') throw Object.assign(new Error('无权查看公告问答'), { code: 'FORBIDDEN' });
          return { items: mode === 'ready' ? [{ id: 'q1', kind: 'QUESTION', body: '几点开始？' }] : [] };
        }
        return { items: [] };
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; } }, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1', content: [{ id: 'stale-question' }] });
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.contentLoadState, 'ERROR');
  assert.match(page.data.contentError, /网络中断/);
  assert.equal(page.data.content.length, 0);
  mode = 'empty';
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.contentLoadState, 'EMPTY');
  mode = 'ready';
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.contentLoadState, 'READY');
  assert.equal(page.data.content[0].id, 'q1');
  mode = 'forbidden';
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.contentLoadState, 'FORBIDDEN');
  assert.equal(page.data.content.length, 0);
  const wxml = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /contentLoadState === 'ERROR'[^\n]*bindtap="refresh"/);
  assert.match(wxml, /contentLoadState === 'EMPTY'/);
  assert.match(wxml, /contentLoadState === 'FORBIDDEN'/);
});

test('completed event keeps outcome read failure visible so feedback can be retried', async () => {
  let page: Record<string, any> | undefined;
  let mode: 'offline' | 'ready' | 'forbidden' = 'offline';
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (route: string) => {
        if (route === '/events/e1') return { id: 'e1', hostId: 'host', version: 2, status: 'COMPLETED',
          payload: { startAt: '2026-01-02T12:00:00Z', endAt: '2026-01-02T14:00:00Z', feeMode: 'FREE' } };
        if (route === '/system/safety') return { status: 'OPEN' };
        if (route === '/me/registrations') return { items: [{ event_id: 'e1', status: 'CONFIRMED' }] };
        if (route === '/events/e1/outcome') {
          if (mode === 'offline') throw Object.assign(new Error('结项证据网络中断'), { code: 'NETWORK_ERROR' });
          if (mode === 'forbidden') throw Object.assign(new Error('无权查看结项证据'), { code: 'FORBIDDEN' });
          return { eventId: 'e1', held: true, actualCount: 2, level: 'HOST_ONLY',
            independentFeedback: 0, myFeedbackSubmitted: false };
        }
        return { items: [] };
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'p1' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'p1' : ''; } }, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1', outcome: { eventId: 'old', level: 'MEMBER_CORROBORATED' } });
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.outcomeLoadState, 'ERROR');
  assert.match(page.data.outcomeError, /网络中断/);
  assert.equal(page.data.outcome, null);
  mode = 'ready';
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.outcomeLoadState, 'READY');
  assert.equal(page.data.outcome.level, 'HOST_ONLY');
  mode = 'forbidden';
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.outcomeLoadState, 'FORBIDDEN');
  assert.equal(page.data.outcome, null);
  const wxml = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /outcomeLoadState === 'ERROR'[^\n]*bindtap="refresh"/);
  assert.match(wxml, /outcomeLoadState === 'FORBIDDEN'/);
});

test('profile offer decline sends the event version and refreshes the offer state', async () => {
  let page: Record<string, any> | undefined;
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post(route: string, body: Record<string, unknown>) {
        calls.push({ path: route, body }); return { status: 'DECLINED' };
      } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; }, wx: {}
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  let refreshed = 0;
  page.refresh = async () => { refreshed++; return true; };
  await page.declineOffer({ currentTarget: { dataset: { id: 'offer-1', version: 2 } } });
  assert.equal(calls[0]?.path, '/offers/offer-1/decline');
  assert.equal(calls[0]?.body.expectedVersion, 2);
  assert.equal(refreshed, 1);
  assert.match(page.data.message, /拒绝/);
});

test('a manual retry after uncertain network failure reuses the original mutation key', async () => {
  const requests: Record<string, any>[] = [];
  const api = createApi({
    request(options: Record<string, any>) {
      requests.push(options);
      if (requests.length === 1) options.fail({ errMsg: 'request:fail timeout' });
      else options.success({ statusCode: 201, data: { id: requests.length } });
    },
    getStorageSync(key: string) { return key === 'sessionToken' ? 'person-one' : ''; }
  }, { apiBase: 'https://example.test', developmentUser: '' });
  await assert.rejects(() => api.post('/reports', { kind: 'SAFETY', description: '线下安全事件' }), { code: 'NETWORK_ERROR' });
  await api.post('/reports', { kind: 'SAFETY', description: '线下安全事件' });
  assert.equal(requests[1]?.header['Idempotency-Key'], requests[0]?.header['Idempotency-Key']);
  await api.post('/reports', { kind: 'SAFETY', description: '线下安全事件' });
  assert.notEqual(requests[2]?.header['Idempotency-Key'], requests[0]?.header['Idempotency-Key']);
});

test('a changed mutation or login identity never inherits another uncertain request key', async () => {
  const requests: Record<string, any>[] = [];
  let token = 'person-one';
  const api = createApi({
    request(options: Record<string, any>) { requests.push(options); options.fail({ errMsg: 'request:fail timeout' }); },
    getStorageSync(key: string) { return key === 'sessionToken' ? token : ''; }
  }, { apiBase: 'https://example.test', developmentUser: '' });
  await assert.rejects(() => api.post('/reports', { description: '第一件事' }), { code: 'NETWORK_ERROR' });
  await assert.rejects(() => api.post('/reports', { description: '第二件事' }), { code: 'NETWORK_ERROR' });
  token = 'person-two';
  await assert.rejects(() => api.post('/reports', { description: '第一件事' }), { code: 'NETWORK_ERROR' });
  assert.notEqual(requests[1]?.header['Idempotency-Key'], requests[0]?.header['Idempotency-Key']);
  assert.notEqual(requests[2]?.header['Idempotency-Key'], requests[0]?.header['Idempotency-Key']);
});

test('relogin of the same user keeps an uncertain mutation key across client restart', async () => {
  const storage = new Map<string, unknown>([['userId', 'stable-user'], ['sessionToken', 'old-token']]);
  const requests: Record<string, any>[] = [];
  const platform = {
    request(options: Record<string, any>) { requests.push(options); options.fail({ errMsg: 'request:fail timeout' }); },
    getStorageSync(key: string) { return storage.get(key) ?? ''; },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); }
  };
  const config = { apiBase: 'https://example.test', developmentUser: '' };
  await assert.rejects(() => createApi(platform, config).post('/reports', { description: '同一事件' }), { code: 'NETWORK_ERROR' });
  storage.set('sessionToken', 'new-token');
  await assert.rejects(() => createApi(platform, config).post('/reports', { description: '同一事件' }), { code: 'NETWORK_ERROR' });
  assert.equal(requests[1]?.header['Idempotency-Key'], requests[0]?.header['Idempotency-Key']);
});

test('a failed durable key write prevents a mutation from being sent', async () => {
  let requestCount = 0;
  const api = createApi({
    request() { requestCount++; },
    getStorageSync() { return ''; },
    setStorageSync() { throw new Error('storage full'); }
  }, { apiBase: 'https://example.test', developmentUser: 'person-one' });
  await assert.rejects(() => api.post('/reports', { description: '线下风险' }), { code: 'LOCAL_STORAGE_UNAVAILABLE' });
  assert.equal(requestCount, 0);
});

test('a failed local cleanup does not hide a definitive server success', async () => {
  let writes = 0;
  let requestCount = 0;
  const api = createApi({
    request(options: Record<string, any>) { requestCount++; options.success({ statusCode: 201, data: { id: 'created' } }); },
    getStorageSync() { return ''; },
    setStorageSync() { if (++writes === 2) throw new Error('storage write failed'); }
  }, { apiBase: 'https://example.test', developmentUser: 'person-one' });
  assert.equal((await api.post('/reports', { description: '线下风险' })).id, 'created');
  assert.equal(requestCount, 1);
});

test('corrupt saved mutation keys are ignored on restart', async () => {
  const storage = new Map<string, unknown>();
  const requests: Record<string, any>[] = [];
  const platform = {
    request(options: Record<string, any>) { requests.push(options); options.fail({ errMsg: 'timeout' }); },
    getStorageSync(key: string) { return storage.get(key) ?? ''; },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); }
  };
  const config = { apiBase: 'https://example.test', developmentUser: 'person-one' };
  await assert.rejects(() => createApi(platform, config).post('/reports', { description: '风险' }), { code: 'NETWORK_ERROR' });
  const saved = storage.get('irlUncertainMutationKeysV1') as [string, string][];
  storage.set('irlUncertainMutationKeysV1', [[saved[0]![0], 'bad key\n']]);
  await assert.rejects(() => createApi(platform, config).post('/reports', { description: '风险' }), { code: 'NETWORK_ERROR' });
  assert.notEqual(requests[1]?.header['Idempotency-Key'], 'bad key\n');
});

test('equivalent request bodies with different property order share an uncertain key', async () => {
  const requests: Record<string, any>[] = [];
  const api = createApi({
    request(options: Record<string, any>) { requests.push(options); options.fail({ errMsg: 'request:fail timeout' }); },
    getStorageSync(key: string) { return key === 'sessionToken' ? 'person-one' : ''; }
  }, { apiBase: 'https://example.test', developmentUser: '' });
  await assert.rejects(() => api.post('/reports', { kind: 'SAFETY', description: '同一事件' }), { code: 'NETWORK_ERROR' });
  await assert.rejects(() => api.post('/reports', { description: '同一事件', kind: 'SAFETY' }), { code: 'NETWORK_ERROR' });
  assert.equal(requests[1]?.header['Idempotency-Key'], requests[0]?.header['Idempotency-Key']);
});

test('a server error remains uncertain but a definite business rejection releases the key', async () => {
  const requests: Record<string, any>[] = [];
  const api = createApi({
    request(options: Record<string, any>) {
      requests.push(options);
      const statusCode = requests.length === 1 ? 500 : requests.length === 2 ? 409 : 201;
      options.success({ statusCode, data: statusCode === 201 ? { id: 'created' } : { code: 'TEST_ERROR', message: '失败' } });
    },
    getStorageSync(key: string) { return key === 'sessionToken' ? 'person-one' : ''; }
  }, { apiBase: 'https://example.test', developmentUser: '' });
  await assert.rejects(() => api.post('/reports', { description: '同一事件' }), error => {
    assert.equal((error as { status?: number }).status, 500);
    assert.match((error as Error).message, /尚未确认/);
    return true;
  });
  await assert.rejects(() => api.post('/reports', { description: '同一事件' }), { status: 409 });
  assert.equal(requests[1]?.header['Idempotency-Key'], requests[0]?.header['Idempotency-Key']);
  await api.post('/reports', { description: '同一事件' });
  assert.notEqual(requests[2]?.header['Idempotency-Key'], requests[1]?.header['Idempotency-Key']);
});

test('an HTTP request timeout keeps the same durable mutation key for retry', async () => {
  const storage = new Map<string, unknown>();
  const requests: Record<string, any>[] = [];
  const platform = {
    request(options: Record<string, any>) {
      requests.push(options);
      options.success({ statusCode: requests.length === 1 ? 408 : 201, data: {} });
    },
    getStorageSync(key: string) { return storage.get(key) ?? ''; },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); }
  };
  const config = { apiBase: 'https://example.test', developmentUser: 'person-one' };
  await assert.rejects(() => createApi(platform, config).post('/reports', { description: '同一事件' }), error => {
    assert.equal((error as { status?: number }).status, 408);
    assert.match((error as Error).message, /尚未确认/);
    return true;
  });
  await createApi(platform, config).post('/reports', { description: '同一事件' });
  assert.equal(requests[1]?.header['Idempotency-Key'], requests[0]?.header['Idempotency-Key']);
});

test('a redirect response does not release an uncertain mutation key', async () => {
  const requests: Record<string, any>[] = [];
  const api = createApi({
    request(options: Record<string, any>) {
      requests.push(options);
      options.success({ statusCode: requests.length === 1 ? 302 : 201, data: {} });
    },
    getStorageSync(key: string) { return key === 'sessionToken' ? 'person-one' : ''; }
  }, { apiBase: 'https://example.test', developmentUser: '' });
  await assert.rejects(() => api.post('/reports', { description: '同一事件' }), { status: 302 });
  await api.post('/reports', { description: '同一事件' });
  assert.equal(requests[1]?.header['Idempotency-Key'], requests[0]?.header['Idempotency-Key']);
});

test('lost HTTP responses replay committed report and draft after client restart without storing their text', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'development', devAuth: true, checkInSecret: 'test-secret' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing HTTP address');
    let dropFirstResponse = true;
    const storage = new Map<string, unknown>();
    const platform = {
      request(options: Record<string, any>) {
        void fetch(options.url, { method: options.method, headers: options.header, body: JSON.stringify(options.data) })
          .then(async response => {
            const data = await response.json();
            if (dropFirstResponse) { dropFirstResponse = false; options.fail({ errMsg: 'request:fail timeout' }); }
            else options.success({ statusCode: response.status, data });
          }).catch(options.fail);
      },
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); }
    };
    const makeApi = () => createApi(platform, { apiBase: `http://127.0.0.1:${address.port}`, developmentUser: 'reporter' });
    let api = makeApi();
    await assert.rejects(() => api.post('/reports', { kind: 'SAFETY', description: '已写入但响应丢失的安全事件' }),
      { code: 'NETWORK_ERROR' });
    assert.equal(JSON.stringify([...storage.values()]).includes('已写入但响应丢失的安全事件'), false);
    assert.equal((storage.get('irlUncertainMutationKeysV1') as unknown[]).length, 1);
    api = makeApi();
    const replayed = await api.post('/reports', { kind: 'SAFETY', description: '已写入但响应丢失的安全事件' });
    assert.ok(replayed.id);
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM reports WHERE reporter_id='reporter'")).rows[0]?.n, 1);
    assert.equal((storage.get('irlUncertainMutationKeysV1') as unknown[]).length, 0);
    dropFirstResponse = true;
    await assert.rejects(() => api.post('/events', { title: '已写入但响应丢失的草稿' }), { code: 'NETWORK_ERROR' });
    assert.equal(JSON.stringify([...storage.values()]).includes('已写入但响应丢失的草稿'), false);
    api = makeApi();
    const draft = await api.post('/events', { title: '已写入但响应丢失的草稿' });
    assert.ok(draft.id);
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM events WHERE host_id='reporter'")).rows[0]?.n, 1);
    assert.equal((storage.get('irlUncertainMutationKeysV1') as unknown[]).length, 0);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});
