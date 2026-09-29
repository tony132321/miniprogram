import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

function loadPage(name: string, options: { get?: (path: string) => Promise<unknown>; actor?: () => string;
  developmentUser?: string } = {}) {
  let page: Record<string, any> | undefined;
  const routes: string[] = [];
  const globalData: Record<string, any> = { ready: Promise.resolve() };
  const wx = {
    getStorageSync(key: string) {
      return key === 'sessionToken' ? (options.actor?.() || '') : key === 'userId' ? (options.actor?.() || '') : '';
    },
    navigateTo({ url }: { url: string }) { routes.push(url); },
    switchTab({ url }: { url: string }) { routes.push(url); }
  };
  runInNewContext(readFileSync(new URL(`../miniprogram/subpackages/profile/${name}/${name}.js`, import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; },
    wx,
    getApp() { return { globalData }; },
    require(path: string) {
      if (path === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      if (path === '../../../utils/api.js') return { api: { get: options.get } };
      if (path === '../../../config.js') return { developmentUser: options.developmentUser || '' };
      throw new Error(`unexpected require ${path}`);
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  return { page, routes, globalData };
}

test('badge category selection filters only planned concepts and keeps award state unavailable', () => {
  const { page, routes } = loadPage('badges');
  assert.equal(page.data.awardState, 'UNAVAILABLE');
  assert.ok(page.data.visibleBadges.length >= 6);
  page.selectCategory({ currentTarget: { dataset: { category: 'sports' } } });
  assert.equal(page.data.activeCategory, 'sports');
  assert.ok(page.data.visibleBadges.every((badge: any) => badge.category === 'sports'));
  page.openBadge({ currentTarget: { dataset: { id: page.data.visibleBadges[0].id } } });
  assert.match(page.data.badgeMessage, /尚未开放/);
  page.goActivities();
  assert.deepEqual(routes, ['/pages/index/index']);
});

test('moments shows only real activities and category switches preserve real detail links', async () => {
  const calls: string[] = [];
  const { page, routes } = loadPage('moments', { actor: () => 'member', get: async path => {
    calls.push(path);
    return { items: [
      { id: 'one', title: '真实参与的羽毛球', status: 'COMPLETED', isHost: false,
        myRegistrationStatus: 'CONFIRMED', startAt: '2027-03-22T11:00:00.000Z' },
      { id: 'two', title: '真实发起的桌游', status: 'CONFIRMED', isHost: true,
        myRegistrationStatus: null }
    ] };
  } });
  await page.onShow();
  assert.deepEqual(calls, ['/me/events']);
  assert.equal(page.data.events.length, 2);
  assert.equal(page.data.events[0].title, '真实参与的羽毛球');
  assert.equal(page.data.events[0].dateLabel, '3 月 22 日 19:00');
  page.selectFilter({ currentTarget: { dataset: { filter: 'hosted' } } });
  assert.deepEqual(Array.from(page.data.visibleEvents, (event: any) => event.id), ['two']);
  page.openActivity({ currentTarget: { dataset: { id: 'two' } } });
  assert.deepEqual(routes, ['/pages/event/event?id=two']);
});

test('moments clears another account data and drops an in-flight response', async () => {
  let actor = 'first';
  let release!: (response: unknown) => void;
  const pending = new Promise(resolve => { release = resolve; });
  const { page } = loadPage('moments', { actor: () => actor, get: async () => pending });
  const firstShow = page.onShow();
  await Promise.resolve();
  actor = '';
  await page.onShow();
  release({ items: [{ id: 'old', title: '旧账号活动', isHost: true }] });
  await firstShow;
  assert.equal(page.data.loadState, 'UNAUTHENTICATED');
  assert.deepEqual(Array.from(page.data.events), []);
});

test('guidelines opens the real report form for the active development identity', () => {
  const { page, routes, globalData } = loadPage('guidelines', { developmentUser: 'host' });
  page.goReport();
  assert.equal(globalData.reportContext.actor, 'host');
  assert.equal(globalData.reportContext.eventId, '');
  assert.deepEqual(routes, ['/pages/me/me']);
});
