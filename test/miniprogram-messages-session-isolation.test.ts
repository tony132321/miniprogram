import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/pages/messages/messages.js', import.meta.url), 'utf8');

function mount(api: Record<string, any>, navigation: Record<string, any> = {}) {
  let page: Record<string, any> | undefined;
  let sessionToken = 'first-session';
  const navigations: string[] = [];
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return key === 'sessionToken' ? sessionToken : key === 'userId' ? 'same-member' : ''; },
      navigateTo({ url, success }: { url: string; success?: () => void }) { navigations.push(url); success?.(); },
      switchTab({ url, success }: { url: string; success?: () => void }) { navigations.push(url); success?.(); },
      showTabBar() {}, hideTabBar() {}, setStorageSync() {}, removeStorageSync() {},
      ...navigation
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, navigations, rotateSession(token: string) { sessionToken = token; } };
}

const oldNotice = { id: 'old-notice', kind: 'EVENT_REMINDER', event_id: 'old-event', status: 'IN_APP' };
const newNotice = { id: 'new-notice', kind: 'EVENT_REMINDER', event_id: 'new-event', status: 'IN_APP' };

test('a delayed notification response cannot paint data after the same member starts a new session', async () => {
  let releaseOld: ((value: object) => void) | undefined;
  const oldResponse = new Promise<object>(resolve => { releaseOld = resolve; });
  let requests = 0;
  let markRequestStarted: (() => void) | undefined;
  const requestStarted = new Promise<void>(resolve => { markRequestStarted = resolve; });
  const { page, rotateSession } = mount({
    get(path: string) {
      assert.equal(path, '/me/notifications?offset=0');
      if (++requests === 1) { markRequestStarted?.(); return oldResponse; }
      return { items: [newNotice], total: 1, unreadTotal: 1 };
    }
  });
  const loadingOld = page.onShow();
  await requestStarted;
  assert.equal(requests, 1);
  rotateSession('second-session');
  releaseOld?.({ items: [oldNotice], total: 1, unreadTotal: 1 });
  await loadingOld;
  assert.deepEqual(Array.from(page.data.items), [], 'the first session response cannot appear under the new token');

  await page.onShow();
  assert.equal(page.data.loadState, 'READY');
  assert.deepEqual(Array.from(page.data.items, (item: { id: string }) => item.id), ['new-notice']);
});

test('a notice card from an earlier token cannot navigate or mark itself read', async () => {
  const posts: string[] = [];
  const { page, navigations, rotateSession } = mount({
    async get() { return { items: [oldNotice], total: 1, unreadTotal: 1 }; },
    async post(path: string) { posts.push(path); }
  });
  await page.onShow();
  rotateSession('second-session');
  await page.openNotice({ currentTarget: { dataset: {
    id: oldNotice.id, eventId: oldNotice.event_id, kind: oldNotice.kind
  } } });
  assert.deepEqual(navigations, []);
  assert.deepEqual(posts, []);
  assert.deepEqual(Array.from(page.data.items), [], 'the stale card is cleared on interaction');
});

test('the private-chat activity shortcut does not navigate after the session changes', async () => {
  const { page, navigations, rotateSession } = mount({
    async get() { return { items: [], total: 0, unreadTotal: 0 }; }
  });
  await page.onShow();
  page.openPrivateChatPreview();
  assert.equal(page.data.viewMode, 'CHAT_UNAVAILABLE');
  rotateSession('second-session');

  page.goMyActivities();

  assert.deepEqual(navigations, []);
  assert.equal(page.data.viewMode, 'INBOX');
  assert.equal(page.data.message, '账号已切换，请返回后重新加载消息。');
});

test('an approval card from an earlier token cannot navigate or approve', async () => {
  const posts: string[] = [];
  const { page, navigations, rotateSession } = mount({
    async get(path: string) {
      return path.startsWith('/me/approval-requests')
        ? { items: [{ registrationId: 'old-registration', eventId: 'old-event', canApprove: true, version: 1 }], total: 1 }
        : { items: [], total: 0, unreadTotal: 0 };
    },
    async post(path: string) { posts.push(path); }
  });
  await page.onShow();
  await page.openNotificationCenter();
  assert.equal(page.data.approvals.length, 1);
  rotateSession('second-session');
  page.viewApproval({ currentTarget: { dataset: { eventId: 'old-event', isHost: true } } });
  await page.approveRequest({ currentTarget: { dataset: { id: 'old-registration', version: 1 } } });
  assert.deepEqual(navigations, []);
  assert.deepEqual(posts, []);
  assert.deepEqual(Array.from(page.data.approvals), [], 'the stale approval is cleared on interaction');
});

test('a navigation failure from the previous token cannot show an error in the new session', async () => {
  let failNavigation: ((error: Error) => void) | undefined;
  const posts: string[] = [];
  const { page, rotateSession } = mount({
    async get() { return { items: [oldNotice], total: 1, unreadTotal: 1 }; },
    async post(path: string) { posts.push(path); }
  }, {
    navigateTo({ fail }: { fail: (error: Error) => void }) { failNavigation = fail; }
  });
  await page.onShow();
  const opening = page.openNotice({ currentTarget: { dataset: {
    id: oldNotice.id, eventId: oldNotice.event_id, kind: oldNotice.kind
  } } });
  assert.ok(failNavigation);
  rotateSession('second-session');
  failNavigation(new Error('old route failed'));
  await opening;
  assert.equal(page.data.message, '', 'an old navigation error must not become new-session feedback');
  assert.deepEqual(posts, []);
});
