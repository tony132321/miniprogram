import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function loadPage(now: number) {
  let page: Record<string, any> | undefined;
  const routes: string[] = [];
  const storage = new Map<string, unknown>();
  class Clock extends Date {
    static now() { return now; }
  }
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    Date: Clock,
    wx: {
      getWindowInfo() { return { statusBarHeight: 0 }; },
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); },
      removeStorageSync(key: string) { storage.delete(key); },
      switchTab({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, routes, storage };
}

test('quick schedule uses Shanghai day and clears stale venue confirmation', () => {
  // 2026-09-29 16:01 UTC is already Wednesday in Shanghai.
  const { page } = loadPage(Date.parse('2026-09-29T16:01:00Z'));
  page.setData({ venueConfirmed: true });
  page.chooseQuickDate({ currentTarget: { dataset: { choice: 'saturday' } } });
  assert.equal(page.data.startDate, '2026-10-03');
  assert.equal(page.data.endDate, '2026-10-03');
  assert.equal(page.data.venueConfirmed, false);
  page.setData({ venueConfirmed: true });
  page.chooseQuickTime({ currentTarget: { dataset: { choice: 'evening' } } });
  assert.equal(page.data.startTime, '18:00');
  assert.equal(page.data.endTime, '21:00');
  assert.equal(page.data.venueConfirmed, false);
});

test('published event editor back action returns to a valid tab', () => {
  const { page, routes } = loadPage(Date.now());
  page.setData({ stage: 'FORM', editingEvent: { id: 'event-1' } });
  page.backFromCreate();
  assert.deepEqual(routes, ['/pages/index/index']);
});

test('drafts shortcut opens the organized list once and exposes a saved draft', async () => {
  const { page: create, routes, storage } = loadPage(Date.now());
  create.openDrafts();
  assert.deepEqual(routes, ['/pages/index/index']);

  let home: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/index/index.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async () => ({ items: [
        { id: 'draft-1', title: '周六羽毛球', status: 'DRAFT', isHost: true }
      ] }) } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { home = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      removeStorageSync(key: string) { storage.delete(key); }
    }
  });
  assert.ok(home);
  home.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await home.onShow();
  assert.equal(home.data.activeTab, 'organized');
  assert.equal(home.data.visibleItems[0]?.id, 'draft-1');
  assert.equal(storage.has('irlHomeTabIntent'), false);
  home.setData({ activeTab: 'attending' });
  await home.onShow();
  assert.equal(home.data.activeTab, 'attending', 'the shortcut must not override a later manual tab choice');
});
