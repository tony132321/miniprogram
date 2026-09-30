import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../miniprogram/pages/messages/messages.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');

function mount(items: Record<string, unknown>[]) {
  let page: Record<string, any> | undefined;
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get() { return { items, total: items.length, nextOffset: null }; } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(path);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  return page;
}

test('notification cards distinguish actual reminder, location/rule update and formation kinds without invented content', async () => {
  const page = mount(['EVENT_REMINDER', 'MATERIAL_CHANGE', 'EVENT_CONFIRMED',
    'EVENT_OUTCOME_DUE', 'WAITLIST_OFFER', 'EVENT_CANCELLED'].map((kind, index) => ({
    id: `notice-${index}`, kind, event_id: `event-${index}`, status: 'IN_APP', detail: {}
  })));
  await page.onShow();
  const cards = page.data.items;
  assert.equal(cards[0].cardVariant, 'reminder');
  assert.equal(cards[0].actionSection, 'checkinSection');
  assert.equal(cards[1].cardVariant, 'update');
  assert.equal(cards[1].tone, 'lime');
  assert.equal(cards[1].actionSection, 'detailsSection');
  assert.equal(cards[2].cardVariant, 'milestone');
  assert.equal(cards[2].tone, 'green');
  assert.equal(cards[3].tone, 'violet');
  assert.equal(cards[3].actionSection, 'hostSection');
  assert.equal(cards[3].actionLabel, '记录活动结项');
  assert.equal(cards[4].tone, 'pink');
  assert.equal(cards[5].tone, 'pink');
  assert.ok(cards.every((card: Record<string, string>) => !/Alex|Momo|Luna|¥|付款|群聊|导航前往/.test(
    `${card.title} ${card.summary} ${card.actionLabel}`)));
});

test('reference card rhythm has kind-specific visual zones and keeps each action on a real handler', () => {
  assert.match(markup, /class="center-card[^\"]*center-{{notice.cardVariant}}/);
  assert.match(markup, /class="center-reminder-thumb"/);
  assert.match(markup, /class="center-card-title">{{notice.title}}/);
  assert.match(markup, /class="center-card-kind">{{notice.categoryLabel}}/);
  assert.match(markup, /class="center-reminder-actions"[\s\S]*?bindtap="openNotice"[\s\S]*?bindtap="openNotice"/);
  assert.match(markup, /class="center-inline-link"[\s\S]*?bindtap="openNotice"/);
  assert.match(markup, /class="center-status-link"[\s\S]*?bindtap="openNotice"/);
  assert.match(markup, /class="center-approval-actions"[\s\S]*?bindtap="viewApproval"[\s\S]*?bindtap="approveRequest"/);
  assert.doesNotMatch(markup, /(?:Alex|Momo|Luna|¥45|导航前往|去结算)/);
});

test('update, formation and outcome actions open the matching event section before marking the notice read', async () => {
  const actions: string[] = [];
  let page: Record<string, any> | undefined;
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post(route: string) { actions.push(route); } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(path);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { navigateTo(options: { url: string; success: () => void }) {
      actions.push(options.url);
      options.success();
    } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  for (const [kind, section] of [['MATERIAL_CHANGE', 'detailsSection'],
    ['EVENT_CONFIRMED', 'detailsSection'], ['EVENT_OUTCOME_DUE', 'hostSection'],
    ['EVENT_OUTCOME_REVIEW', 'checkinSection']]) await page.openNotice({
    currentTarget: { dataset: { id: kind, eventId: 'event-1', kind, section } }
  });
  assert.deepEqual(actions, [
    '/pages/event/event?id=event-1&section=detailsSection', '/me/notifications/MATERIAL_CHANGE/open',
    '/pages/event/event?id=event-1&section=detailsSection', '/me/notifications/EVENT_CONFIRMED/open',
    '/pages/event/event?id=event-1&section=hostSection', '/me/notifications/EVENT_OUTCOME_DUE/open',
    '/pages/event/event?id=event-1&section=checkinSection', '/me/notifications/EVENT_OUTCOME_REVIEW/open'
  ]);
});
