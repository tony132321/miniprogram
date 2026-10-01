import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

const listed = { id: 'event-1', status: 'RECRUITING', title: '周六晚场羽毛球',
  startAt: '2099-03-22T11:00:00.000Z', isHost: true, myRegistrationStatus: null,
  reviewStatus: 'APPROVED', recruiting: true, version: 2 };
const detail = { id: 'event-1', hostId: 'host', status: 'RECRUITING',
  reviewStatus: 'APPROVED', recruiting: true, version: 2,
  payload: { title: '周六晚场羽毛球', startAt: '2099-03-22T11:00:00.000Z',
    endAt: '2099-03-22T13:00:00.000Z', city: '上海', venueName: '公共球馆',
    minParticipants: 4, maxParticipants: 8, feeMode: 'FREE' },
  stats: { confirmed: 3, reserved: 0, requested: 0, waitlisted: 0 } };

function loadHome(options: { item?: Record<string, any>; event?: Record<string, any> | null;
  detailGate?: Promise<Record<string, any>>; detailFails?: boolean } = {}) {
  let page: Record<string, any> | undefined;
  let actor = 'host';
  const requests: string[] = [];
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/index/index.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get(url: string) {
        requests.push(url);
        if (url === '/me/events') return { items: actor === 'host' ? [options.item || listed] : [] };
        if (url === '/me/notifications?offset=0') return { unreadTotal: 0 };
        if (url === '/events/event-1') {
          if (options.detailFails) throw new Error('detail unavailable');
          return options.detailGate || options.event || detail;
        }
        throw new Error(`unexpected GET ${url}`);
      } } };
      if (path === '../../config.js') return { developmentUser: '' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? actor : ''; },
      navigateTo({ url }: { url: string }) { routes.push(url); },
      removeStorageSync() {}
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, requests, routes, setActor(next: string) { actor = next; } };
}

test('home feature shows the authorized confirmed count and stays one detail tap target', async () => {
  const { page, requests, routes } = loadHome();
  await page.onShow();
  assert.ok(requests.includes('/events/event-1'), 'count must come from the same authorized detail');
  assert.equal(page.data.featuredItem.capacityLabel, '已确认 3 / 上限 8 人');
  const markup = readFileSync(new URL('../miniprogram/pages/index/index.wxml', import.meta.url), 'utf8');
  const feature = markup.match(/<button wx:if="{{featuredItem}}" class="feature-card"[\s\S]*?<button wx:else class="feature-card"/);
  assert.ok(feature);
  assert.match(feature[0], /wx:if="{{featuredItem\.capacityLabel}}"[\s\S]*?{{featuredItem\.capacityLabel}}/);
  page.openEvent({ currentTarget: { dataset: { id: page.data.featuredItem.id } } });
  assert.deepEqual(routes, ['/pages/event/event?id=event-1']);
});

test('home feature keeps count hidden for pending review, invalid facts, and failed detail reads', async () => {
  const pending = loadHome({ item: { ...listed, reviewStatus: 'PENDING' } });
  await pending.page.onShow();
  assert.equal(pending.page.data.featuredItem.capacityLabel, '');
  assert.ok(!pending.requests.includes('/events/event-1'));

  const member = loadHome({ item: { ...listed, isHost: false, myRegistrationStatus: 'CONFIRMED' } });
  await member.page.onShow();
  assert.equal(member.page.data.featuredItem.capacityLabel, '');
  assert.ok(!member.requests.includes('/events/event-1'), 'member home keeps its existing list-only request boundary');

  const noVersion = loadHome({ item: { ...listed, version: undefined } });
  await noVersion.page.onShow();
  assert.equal(noVersion.page.data.featuredItem.capacityLabel, '');
  assert.ok(!noVersion.requests.includes('/events/event-1'));

  const invalid = loadHome({ event: { ...detail, stats: { ...detail.stats, confirmed: '3' } } });
  await invalid.page.onShow();
  assert.equal(invalid.page.data.featuredItem.capacityLabel, '');

  const wrongHost = loadHome({ event: { ...detail, hostId: 'someone-else' } });
  await wrongHost.page.onShow();
  assert.equal(wrongHost.page.data.featuredItem.capacityLabel, '');

  const olderVersion = loadHome({ event: { ...detail, version: 1 } });
  await olderVersion.page.onShow();
  assert.equal(olderVersion.page.data.featuredItem.capacityLabel, '');

  const denied = loadHome({ detailFails: true });
  await denied.page.onShow();
  assert.equal(denied.page.data.loadState, 'READY');
  assert.equal(denied.page.data.featuredItem.id, 'event-1');
  assert.equal(denied.page.data.featuredItem.capacityLabel, '');
});

test('late feature detail cannot restore a previous account count', async () => {
  let releaseDetail: ((value: Record<string, any>) => void) | undefined;
  const detailGate = new Promise<Record<string, any>>(resolve => { releaseDetail = resolve; });
  const { page, requests, setActor } = loadHome({ detailGate });
  const first = page.onShow();
  for (let i = 0; i < 10 && !requests.includes('/events/event-1'); i++) await Promise.resolve();
  assert.ok(requests.includes('/events/event-1'));
  setActor('other-member');
  await page.onShow();
  releaseDetail?.(detail);
  await first;
  assert.equal(page.data.featuredItem, null);
});
