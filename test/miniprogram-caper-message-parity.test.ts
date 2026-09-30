import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../miniprogram/pages/messages/messages.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');

function mount(api: object, wx: object) {
  let page: Record<string, any> | undefined;
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(path);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return page;
}

test('notification center presents a distinct category and event title rather than repeating the same title', async () => {
  const page = mount({
    async get(path: string) {
      if (path.startsWith('/me/approval-requests')) return { items: [], total: 0, nextOffset: null };
      return { items: [{ id: 'reminder-1', kind: 'EVENT_REMINDER', event_id: 'event-1',
        status: 'IN_APP', created_at: '2026-09-30T09:30:00Z' }], total: 1, unreadTotal: 1, nextOffset: null };
    }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; } });
  await page.onShow();
  await page.openNotificationCenter();
  assert.equal(page.data.items[0].categoryLabel, '活动提醒');
  assert.equal(page.data.items[0].title, '活动即将开始');
  assert.equal(page.data.items[0].icon, '◷');
  assert.match(markup, /class="center-card-kind">{{notice.categoryLabel}}/);
  assert.match(markup, /class="center-card-title">{{notice.title}}/);
});

test('cancelled activity is not shown with a positive green status icon', async () => {
  const page = mount({
    async get() { return { items: [{ id: 'cancelled', kind: 'EVENT_CANCELLED',
      event_id: 'event-1', status: 'IN_APP' }], total: 1, unreadTotal: 1 }; }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; } });
  await page.onShow();
  assert.equal(page.data.items[0].tone, 'pink');
  assert.equal(page.data.items[0].icon, '!');
});

test('notification center reloads live approvals when returning and restores the tab bar on exit', async () => {
  const reads: string[] = [];
  const bar: string[] = [];
  const page = mount({
    async get(path: string) {
      reads.push(path);
      if (path.startsWith('/me/approval-requests')) return { items: [], total: 0, nextOffset: null };
      return { items: [], total: 0, unreadTotal: 0, nextOffset: null };
    }
  }, {
    getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'host'; },
    hideTabBar() { bar.push('hide'); },
    showTabBar() { bar.push('show'); }
  });
  const customTab = { data: { hidden: false }, setData(patch: Record<string, boolean>) { Object.assign(this.data, patch); } };
  page.getTabBar = () => customTab;
  await page.onShow();
  await page.openNotificationCenter();
  assert.equal(customTab.data.hidden, true);
  await page.onShow();
  assert.equal(reads.filter(path => path.startsWith('/me/approval-requests')).length, 2);
  page.backToInbox();
  assert.equal(customTab.data.hidden, false);
  assert.equal(bar.at(-1), 'show');
  await page.openNotificationCenter();
  page.onHide();
  assert.equal(customTab.data.hidden, false);
  assert.equal(bar.at(-1), 'show');
});

test('recent conversations opens an honest private-chat preview with real exit paths', async () => {
  const reads: string[] = [];
  const destinations: string[] = [];
  const page = mount({ async get(path: string) {
    reads.push(path);
    return { items: [], total: 0, unreadTotal: 0, nextOffset: null };
  } }, {
    getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; },
    switchTab({ url }: { url: string }) { destinations.push(url); },
    navigateTo({ url }: { url: string }) { destinations.push(url); },
    hideTabBar() {}, showTabBar() {}
  });
  const bar = { data: { hidden: false }, setData(patch: Record<string, boolean>) { Object.assign(this.data, patch); } };
  page.getTabBar = () => bar;
  await page.onShow();
  page.openPrivateChatPreview();
  assert.equal(page.data.viewMode, 'CHAT_UNAVAILABLE');
  assert.equal(bar.data.hidden, true);
  assert.deepEqual(reads, ['/me/notifications?offset=0'], 'preview does not fabricate or fetch conversation data');
  page.goMyActivities();
  assert.deepEqual(destinations, ['/subpackages/profile/moments/moments?filter=all']);
  page.backToInbox();
  assert.equal(page.data.viewMode, 'INBOX');
  assert.equal(bar.data.hidden, false);
  assert.match(markup, /class="conversation-jump" bindtap="openPrivateChatPreview"/);
  assert.match(markup, /viewMode === 'CHAT_UNAVAILABLE'/);
  assert.match(markup, /私聊尚未开放/);
  assert.doesNotMatch(markup, /Alex|已读 ·|发送消息/);
});

test('entering notification center clears the inbox-only search so All shows every loaded notice', async () => {
  const page = mount({ async get(path: string) {
    if (path.startsWith('/me/approval-requests')) return { items: [], total: 0, nextOffset: null };
    return { items: [
      { id: 'reminder', kind: 'EVENT_REMINDER', event_id: 'event-1', status: 'IN_APP' },
      { id: 'report', kind: 'REPORT_RESOLVED_UNSCOPED', event_id: null, status: 'IN_APP' }
    ], total: 2, unreadTotal: 2, nextOffset: null };
  } }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; } });
  await page.onShow();
  page.toggleSearch();
  page.searchInput({ detail: { value: 'reminder' } });
  assert.equal(page.data.filteredCount, 1);

  await page.openNotificationCenter();
  assert.equal(page.data.searchOpen, false);
  assert.equal(page.data.searchQuery, '');
  assert.equal(page.data.filteredCount, 2);
  assert.deepEqual(Array.from(page.data.items, (item: { id: string; visible: boolean }) =>
    [item.id, item.visible]), [['reminder', true], ['report', true]]);
});

test('notification center category buttons display only matching loaded notices', async () => {
  const page = mount({ async get(path: string) {
    if (path.startsWith('/me/approval-requests')) return { items: [], total: 0, nextOffset: null };
    return { items: [
      { id: 'reminder', kind: 'EVENT_REMINDER', event_id: 'event-1', status: 'IN_APP' },
      { id: 'approved', kind: 'REGISTRATION_APPROVED', event_id: 'event-1', status: 'IN_APP' },
      { id: 'system', kind: 'ACCOUNT_NOTICE', event_id: null, status: 'IN_APP' }
    ], total: 3, unreadTotal: 3, nextOffset: null };
  } }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; } });
  await page.onShow();
  await page.openNotificationCenter();
  const shownIds = () => Array.from(page.data.centerItems, (item: { id: string }) => item.id);
  assert.deepEqual(shownIds(), ['reminder', 'approved', 'system']);
  page.setFilter({ currentTarget: { dataset: { filter: 'ACTIVITY' } } });
  assert.deepEqual(shownIds(), ['reminder']);
  page.setFilter({ currentTarget: { dataset: { filter: 'INTERACTION' } } });
  assert.deepEqual(shownIds(), ['approved']);
  page.setFilter({ currentTarget: { dataset: { filter: 'SYSTEM' } } });
  assert.deepEqual(shownIds(), ['system']);
  assert.match(markup, /class="center-notices"><block wx:for="{{centerItems}}"/);
});

test('notification settings action opens the real profile consent controls', () => {
  const actions: string[] = [];
  const page = mount({}, {
    setStorageSync(key: string, value: string) { actions.push(key + '=' + value); },
    switchTab(options: { url: string }) { actions.push(options.url); }
  });
  page.goNotificationSettings();
  assert.deepEqual(actions, ['irlProfileFocusIntent=notificationSettingsSection', '/pages/me/me']);
});

test('offer notice opens the profile action queue before marking the notice read', async () => {
  const actions: string[] = [];
  const page = mount({
    async post(path: string) { actions.push(path); }
  }, {
    setStorageSync(key: string, value: string) { actions.push(key + '=' + value); },
    switchTab(options: { url: string; success?: () => void }) { actions.push(options.url); options.success?.(); }
  });
  page.data.items = [{ id: 'offer-notice', kind: 'WAITLIST_OFFER', event_id: 'event-1' }];
  await page.openNotice({ currentTarget: { dataset: {
    id: 'offer-notice', eventId: 'event-1', kind: 'WAITLIST_OFFER'
  } } });
  assert.deepEqual(actions, [
    'irlProfileFocusIntent=noticeSection',
    '/pages/me/me',
    '/me/notifications/offer-notice/open'
  ]);
});

test('a profile record notice stays unread when its destination fails to open', async () => {
  const actions: string[] = [];
  let canOpenProfile = false;
  const page = mount({ async post(path: string) { actions.push(path); } }, {
    setStorageSync(key: string, value: string) { actions.push(key + '=' + value); },
    removeStorageSync(key: string) { actions.push('remove:' + key); },
    switchTab(options: { url: string; success?: () => void; fail?: (error: Error) => void }) {
      actions.push(options.url);
      if (canOpenProfile) options.success?.();
      else options.fail?.(new Error('profile unavailable'));
    }
  });
  page.data.items = [{ id: 'report-notice', kind: 'REPORT_RESOLVED_UNSCOPED', event_id: null }];
  const notice = { currentTarget: { dataset: {
    id: 'report-notice', eventId: '', kind: 'REPORT_RESOLVED_UNSCOPED'
  } } };

  await page.openNotice(notice);
  assert.deepEqual(actions, [
    'irlProfileFocusIntent=reportSection', '/pages/me/me', 'remove:irlProfileFocusIntent'
  ]);
  assert.match(page.data.message, /profile unavailable/);

  canOpenProfile = true;
  await page.openNotice(notice);
  assert.deepEqual(actions.slice(3), [
    'irlProfileFocusIntent=reportSection', '/pages/me/me', '/me/notifications/report-notice/open'
  ]);
});

test('safety and appeal notice actions open the matching profile record section', async () => {
  for (const [kind, focus] of [
    ['REPORT_RESOLVED_UNSCOPED', 'reportSection'],
    ['APPEAL_RESOLVED', 'appealSection'],
    ['CONTENT_REJECTED', 'contentSection'],
    ['REGISTRATION_REMOVED', 'appealSection']
  ]) {
    const actions: string[] = [];
    const page = mount({ async post(path: string) { actions.push(path); } }, {
      setStorageSync(key: string, value: string) { actions.push(key + '=' + value); },
      switchTab(options: { url: string; success?: () => void }) { actions.push(options.url); options.success?.(); }
    });
    page.data.items = [{ id: 'notice-' + kind, kind, event_id: 'event-1' }];
    await page.openNotice({ currentTarget: { dataset: { id: 'notice-' + kind, eventId: 'event-1', kind } } });
    assert.deepEqual(actions, [
      `irlProfileFocusIntent=${focus}`,
      '/pages/me/me',
      `/me/notifications/notice-${kind}/open`
    ]);
  }
});

test('approval management intent opens the live interaction queue', async () => {
  let intent = 'approvals';
  const reads: string[] = [];
  const removed: string[] = [];
  const page = mount({ async get(path: string) {
    reads.push(path);
    return path.startsWith('/me/approval-requests')
      ? { items: [], total: 0, nextOffset: null }
      : { items: [], total: 0, unreadTotal: 0, nextOffset: null };
  } }, {
    getStorageSync(key: string) {
      return key === 'sessionToken' ? 'token' : key === 'userId' ? 'host'
        : key === 'irlMessagesFocusIntent' ? intent : '';
    },
    removeStorageSync(key: string) { removed.push(key); intent = ''; }
  });
  await page.onShow();
  assert.equal(page.data.filter, 'INTERACTION');
  assert.ok(reads.some(path => path.startsWith('/me/approval-requests')));
  assert.deepEqual(removed, ['irlMessagesFocusIntent']);
});
