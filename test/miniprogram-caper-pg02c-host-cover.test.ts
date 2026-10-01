import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

function listed(id: string, status: string, reviewStatus = 'APPROVED') {
  return { id, title: `${id} 羽毛球`, status, reviewStatus, recruiting: status === 'RECRUITING',
    isHost: true, myRegistrationStatus: null, version: 2,
    startAt: '2099-03-22T11:00:00.000Z', endAt: '2099-03-22T13:00:00.000Z' };
}
function detail(id: string, status: string, reviewStatus = 'APPROVED', confirmed = 2) {
  return { id, hostId: 'host', status, reviewStatus, recruiting: status === 'RECRUITING', version: 2,
    payload: { title: `${id} 羽毛球`, startAt: '2099-03-22T11:00:00.000Z',
      endAt: '2099-03-22T13:00:00.000Z', city: '上海', venueName: '公共球馆',
      registrationDeadline: '2099-03-22T10:00:00.000Z',
      minParticipants: 4, maxParticipants: 8, feeMode: 'FREE' },
    stats: { confirmed, reserved: 1, requested: 1, waitlisted: 0 } };
}
function loadOrganized(items: Array<Record<string, any>>, details: Record<string, Record<string, any>>) {
  let page: Record<string, any> | undefined;
  const routes: string[] = [];
  const storage = new Map<string, unknown>([['devUser', 'host'], ['irlHomeTabIntent', 'organized']]);
  runInNewContext(readFileSync(new URL('../miniprogram/pages/index/index.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get(url: string) {
        if (url === '/me/events') return { items };
        if (url === '/me/notifications?offset=0') return { unreadTotal: 0 };
        if (url.startsWith('/events/')) return details[url.slice('/events/'.length)];
        throw new Error(`unexpected GET ${url}`);
      } } };
      if (path === '../../config.js') return { developmentUser: '' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      removeStorageSync(key: string) { storage.delete(key); },
      navigateTo({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, routes };
}

test('PG02-C organizer cover shows the verified recruitment gap, and ready card manages the same event', async () => {
  const { page, routes } = loadOrganized([listed('recruiting', 'RECRUITING'), listed('ready', 'CONFIRMED')], {
    recruiting: detail('recruiting', 'RECRUITING'), ready: detail('ready', 'CONFIRMED', 'APPROVED', 8)
  });
  await page.onShow();
  const recruiting = page.data.visibleItems.find((item: any) => item.id === 'recruiting');
  const ready = page.data.visibleItems.find((item: any) => item.id === 'ready');
  assert.equal(recruiting.hostCounts.gap, 2);
  assert.equal(recruiting.coverStatusLabel, '招募中 · 还差2人成局');
  assert.equal(ready.primaryLabel, '管理活动');
  assert.equal(ready.primaryAction, 'hostSection');
  const markup = readFileSync(new URL('../miniprogram/pages/index/index.wxml', import.meta.url), 'utf8');
  assert.match(markup, /class="cover-status \{\{item\.coverStatusLabel \? 'cover-status-progress' : ''}}">\{\{item\.coverStatusLabel \|\| item\.cardLabel}}/);
  page.openCardAction({ currentTarget: { dataset: { id: 'ready', action: ready.primaryAction } } });
  assert.deepEqual(routes, ['/pages/event/event?id=ready&section=hostSection']);
});

test('PG02-C never claims a recruitment gap while review, deadline, or verified count is unavailable', async () => {
  const { page } = loadOrganized([listed('pending', 'RECRUITING', 'PENDING'),
    listed('unknown', 'RECRUITING'), listed('expired', 'RECRUITING')], {
    pending: detail('pending', 'RECRUITING', 'PENDING'),
    unknown: { ...detail('unknown', 'RECRUITING'), stats: undefined },
    expired: { ...detail('expired', 'RECRUITING'), payload: {
      ...detail('expired', 'RECRUITING').payload, registrationDeadline: '2000-01-01T00:00:00.000Z' } }
  });
  await page.onShow();
  const pending = page.data.visibleItems.find((item: any) => item.id === 'pending');
  const unknown = page.data.visibleItems.find((item: any) => item.id === 'unknown');
  const expired = page.data.visibleItems.find((item: any) => item.id === 'expired');
  assert.equal(pending.cardLabel, '待审核');
  assert.ok(!pending.coverStatusLabel?.includes('还差'));
  assert.ok(!unknown.coverStatusLabel?.includes('还差'));
  assert.ok(!expired.coverStatusLabel?.includes('还差'));
});
