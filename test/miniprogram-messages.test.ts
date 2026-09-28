import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../miniprogram/pages/messages/messages.js', import.meta.url), 'utf8');
function mount(api: object, wx: object) {
  let page: Record<string, any> | undefined;
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return page;
}

test('messages reads only the current member notification route and clears old account data', async () => {
  let actor = 'a';
  const paths: string[] = [];
  const page = mount({
    async get(path: string) {
      paths.push(path);
      return { items: [{ id: actor, kind: 'EVENT_REMINDER', status: 'PENDING', event_id: 'event-1' }],
        total: 1, nextOffset: null };
    }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : actor; } });
  await page.onShow();
  assert.equal(page.data.items[0].id, 'a');
  actor = 'b';
  await page.onShow();
  assert.equal(page.data.items[0].id, 'b');
  assert.deepEqual(paths, ['/me/notifications?offset=0', '/me/notifications?offset=0']);
  const wxml = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /私聊功能尚未开放/);
});

test('message detail marks a notice opened only after event navigation succeeds', async () => {
  const order: string[] = [];
  let failNavigation = true;
  const page = mount({
    async post(path: string) { order.push(path); }
  }, {
    navigateTo(options: Record<string, any>) {
      order.push(options.url);
      if (failNavigation) options.fail({ errMsg: 'cannot open' });
      else options.success();
    }
  });
  const event = { currentTarget: { dataset: { id: 'notice', eventId: 'event-1', kind: 'EVENT_REMINDER' } } };
  await page.openNotice(event);
  assert.deepEqual(order, ['/pages/event/event?id=event-1']);
  failNavigation = false;
  await page.openNotice(event);
  assert.deepEqual(order, ['/pages/event/event?id=event-1', '/pages/event/event?id=event-1',
    '/me/notifications/notice/open']);
});

test('late notification response from another account cannot replace current messages', async () => {
  let actor = 'a';
  let releaseOld!: (value: object) => void;
  const oldResponse = new Promise<object>(resolve => { releaseOld = resolve; });
  let reads = 0;
  const page = mount({
    get() {
      reads++;
      return reads === 1 ? oldResponse : Promise.resolve({ items: [{ id: 'b' }], total: 1 });
    }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : actor; } });
  const previous = page.onShow();
  await Promise.resolve();
  actor = 'b';
  await page.onShow();
  releaseOld({ items: [{ id: 'a' }], total: 1 });
  await previous;
  assert.equal(page.data.items[0].id, 'b');
});

test('message filters update visible items and action rows use native buttons', async () => {
  const page = mount({
    async get() { return { items: [{ id: 'activity', event_id: 'event-1' }, { id: 'account', event_id: null }],
      total: 2, nextOffset: null }; }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; } });
  await page.onShow();
  assert.deepEqual(Array.from(page.data.items, (item: Record<string, unknown>) => item.visible), [true, true]);
  page.setFilter({ currentTarget: { dataset: { filter: 'ACTIVITY' } } });
  assert.deepEqual(Array.from(page.data.items, (item: Record<string, unknown>) => item.visible), [true, false]);
  page.setFilter({ currentTarget: { dataset: { filter: 'SYSTEM' } } });
  assert.deepEqual(Array.from(page.data.items, (item: Record<string, unknown>) => item.visible), [false, true]);
  const messages = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  const profile = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  assert.match(messages, /<button[^>]*bindtap="setFilter"/);
  assert.match(messages, /<button[^>]*bindtap="openNotice"/);
  assert.match(profile, /<button id="aboutButton"[^>]*bindtap="goAbout"/);
});
