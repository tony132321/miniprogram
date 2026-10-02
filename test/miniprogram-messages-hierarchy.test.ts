import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/pages/messages/messages.js', import.meta.url), 'utf8');

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

test('the closed conversation entry precedes live inbox notices only in the All view and keeps its preview route', () => {
  const markup = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  const conversation = markup.match(/<view wx:if="\{\{([^"}]+)\}\}" class="card conversation-card">/);
  assert.ok(conversation, 'the unavailable conversation card needs an explicit visibility gate');
  const cardStart = conversation.index ?? -1;
  const noticeGroupsStart = markup.indexOf('class="notice-groups"');
  const inboxActionsStart = markup.indexOf('class="inbox-actions"');
  assert.ok(inboxActionsStart < cardStart && cardStart < noticeGroupsStart,
    'recent conversations belongs after inbox controls and before live notice groups');

  const expression = conversation[1];
  assert.ok(expression);
  const visible = (filter: string, loadState: string) =>
    runInNewContext(expression, { filter, loadState });
  assert.equal(visible('ALL', 'READY'), true);
  assert.equal(visible('ACTIVITY', 'READY'), false);
  assert.equal(visible('INTERACTION', 'READY'), false);
  assert.equal(visible('SYSTEM', 'READY'), false);
  assert.equal(visible('ALL', 'LOADING'), false);

  const cardMarkup = markup.slice(cardStart, noticeGroupsStart);
  assert.match(cardMarkup, /最近会话<text>尚未开放<\/text>/);
  assert.match(cardMarkup, /class="conversation-jump" bindtap="openPrivateChatPreview"/);
  assert.match(markup, /viewMode === 'CHAT_UNAVAILABLE'/);
});

test('unread priority uses only current loaded notices and opens their real destination', async () => {
  let actor = 'first';
  const actions: string[] = [];
  const page = mount({
    async get() {
      const items = actor === 'first' ? [
        { id: 'opened', kind: 'EVENT_CONFIRMED', event_id: 'event-1', status: 'OPENED' },
        { id: 'reminder', kind: 'EVENT_REMINDER', event_id: 'event-1', status: 'IN_APP' },
        { id: 'system', kind: 'ACCOUNT_NOTICE', event_id: null, status: 'IN_APP' },
        { id: 'change', kind: 'MATERIAL_CHANGE', event_id: 'event-2', status: 'IN_APP' }
      ] : [{ id: 'new', kind: 'EVENT_CONFIRMED', event_id: 'event-new', status: 'IN_APP' }];
      return { items, total: items.length, unreadTotal: items.filter(item => item.status !== 'OPENED').length,
        nextOffset: null };
    },
    async post(path: string) { actions.push(path); }
  }, {
    getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : actor; },
    navigateTo({ url, success }: { url: string; success: () => void }) { actions.push(url); success(); }
  });

  await page.onShow();
  assert.deepEqual(Array.from(page.data.priorityItems, (item: { id: string }) => item.id),
    ['reminder', 'system']);
  assert.equal(page.data.priorityCount, 3);
  await page.openNotice({ currentTarget: { dataset: {
    id: 'reminder', eventId: 'event-1', kind: 'EVENT_REMINDER'
  } } });
  assert.deepEqual(actions, ['/pages/event/event?id=event-1&section=checkinSection',
    '/me/notifications/reminder/open']);

  actor = 'second';
  page.setFilter({ currentTarget: { dataset: { filter: 'ACTIVITY' } } });
  assert.equal(page.data.priorityItems.length, 0);
  await page.onShow();
  assert.deepEqual(Array.from(page.data.priorityItems, (item: { id: string }) => item.id), ['new']);

  const markup = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  assert.match(markup, /wx:for="{{priorityItems}}"[\s\S]*?bindtap="openNotice"/);
});
