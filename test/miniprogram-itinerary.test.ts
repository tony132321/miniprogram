import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const pagePath = new URL('../miniprogram/subpackages/activity/itinerary/itinerary.js', import.meta.url);
const markupPath = new URL('../miniprogram/subpackages/activity/itinerary/itinerary.wxml', import.meta.url);

function createPage(get: (route: string) => Promise<unknown>, identity = { userId: 'one' }) {
  let page: Record<string, any> | undefined;
  const navigations: string[] = [];
  runInNewContext(readFileSync(pagePath, 'utf8'), {
    require(path: string) {
      if (path === '../../../utils/api.js') return { api: { get } };
      if (path === '../../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return key === 'sessionToken' ? 'session' : key === 'userId' ? identity.userId : ''; },
      getSystemInfoSync() { return { statusBarHeight: 24 }; },
      navigateTo(options: { url: string }) { navigations.push(options.url); },
      navigateBack() {}, switchTab() {}
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  return { page, navigations, identity };
}

test('itinerary shows only real upcoming confirmed or hosted activities in time order', async () => {
  const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  const { page, navigations } = createPage(async route => {
    assert.equal(route, '/me/events');
    return { items: [
      { id: 'pending', status: 'RECRUITING', myRegistrationStatus: 'REQUESTED', startAt: future(1) },
      { id: 'cancelled', status: 'CANCELLED', myRegistrationStatus: 'CONFIRMED', startAt: future(1) },
      { id: 'later', title: '周末羽毛球', status: 'CONFIRMED', myRegistrationStatus: 'CONFIRMED', startAt: future(7) },
      { id: 'host', title: '主办活动', status: 'RECRUITING', isHost: true, startAt: future(3) },
      { id: 'past', status: 'COMPLETED', myRegistrationStatus: 'CONFIRMED', startAt: future(-1) },
      { id: 'lateRecruiting', status: 'RECRUITING', isHost: true, startAt: future(-1) }
    ] };
  });
  await page.onShow();
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.featured.id, 'host');
  assert.deepEqual(Array.from(page.data.later, (item: { id: string }) => item.id), ['later']);
  page.openEvent({ currentTarget: { dataset: { id: 'host' } } });
  assert.deepEqual(navigations, ['/pages/event/event?id=host&section=detailsSection']);
  const markup = readFileSync(markupPath, 'utf8');
  assert.doesNotMatch(markup, /IRL-PASS|已自动同步|已锁定队友/);
});

test('itinerary discards a late response from another identity', async () => {
  let resolveOld!: (value: unknown) => void;
  const oldResponse = new Promise(resolve => { resolveOld = resolve; });
  const { page, identity } = createPage(async () => identity.userId === 'one'
    ? oldResponse : { items: [{ id: 'new', title: '新账号活动', status: 'CONFIRMED', isHost: true,
      startAt: new Date(Date.now() + 86_400_000).toISOString() }] });
  const first = page.onShow();
  await Promise.resolve();
  identity.userId = 'two';
  await page.onShow();
  resolveOld({ items: [{ id: 'old', title: '旧账号活动', status: 'CONFIRMED', isHost: true,
    startAt: new Date(Date.now() + 86_400_000).toISOString() }] });
  await first;
  assert.equal(page.data.featured.id, 'new');
});

test('itinerary uses the reference badminton cover and opens real registration detail', async () => {
  const { page, navigations } = createPage(async () => ({ items: [{ id: 'rally', title: '周六羽毛球',
    status: 'CONFIRMED', myRegistrationStatus: 'CONFIRMED',
    startAt: new Date(Date.now() + 3 * 86_400_000).toISOString() }] }));
  await page.onShow();
  assert.equal(page.data.featured.cover, '/assets/stitch/itinerary_badminton.jpg');
  page.openRegistration({ currentTarget: { dataset: { id: 'rally' } } });
  assert.deepEqual(navigations, ['/pages/event/event?id=rally&section=registrationSection']);
});
