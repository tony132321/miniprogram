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

test('notification settings action opens the real profile consent controls', () => {
  const actions: string[] = [];
  const page = mount({}, {
    setStorageSync(key: string, value: string) { actions.push(key + '=' + value); },
    switchTab(options: { url: string }) { actions.push(options.url); }
  });
  page.goNotificationSettings();
  assert.deepEqual(actions, ['irlProfileFocusIntent=notificationSettingsSection', '/pages/me/me']);
});

test('offer notice opens the profile action queue after marking the notice read', async () => {
  const actions: string[] = [];
  const page = mount({
    async post(path: string) { actions.push(path); }
  }, {
    setStorageSync(key: string, value: string) { actions.push(key + '=' + value); },
    switchTab(options: { url: string }) { actions.push(options.url); }
  });
  await page.openNotice({ currentTarget: { dataset: {
    id: 'offer-notice', eventId: 'event-1', kind: 'WAITLIST_OFFER'
  } } });
  assert.deepEqual(actions, [
    '/me/notifications/offer-notice/open',
    'irlProfileFocusIntent=noticeSection',
    '/pages/me/me'
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
      switchTab(options: { url: string }) { actions.push(options.url); }
    });
    await page.openNotice({ currentTarget: { dataset: { id: 'notice-' + kind, eventId: 'event-1', kind } } });
    assert.deepEqual(actions, [
      `/me/notifications/notice-${kind}/open`,
      `irlProfileFocusIntent=${focus}`,
      '/pages/me/me'
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
