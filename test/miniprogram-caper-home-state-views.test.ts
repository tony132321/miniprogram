import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

type ListedEvent = { id: string; status: string; title: string; startAt?: string;
  isHost: boolean; isCohost?: boolean; myRegistrationStatus: string | null };
type Detail = { id: string; hostId: string; status: string; reviewStatus: string;
  payload: { title: string; startAt: string; endAt: string; city: string; venueName: string;
    minParticipants: number; maxParticipants: number; feeMode: string };
  stats: { confirmed: number; reserved: number; requested: number; waitlisted: number } };

function detail(id: string, hostId = 'dev:organizer', overrides: Partial<Detail> = {}): Detail {
  return {
    id, hostId, status: 'RECRUITING', reviewStatus: 'APPROVED',
    payload: { title: '真实活动', startAt: '2027-03-22T11:00:00.000Z',
      endAt: '2027-03-22T13:00:00.000Z', city: '上海', venueName: '蓝天体育中心',
      minParticipants: 4, maxParticipants: 8, feeMode: 'FREE' },
    stats: { confirmed: 2, reserved: 1, requested: 1, waitlisted: 0 }, ...overrides
  };
}

function makeHome(lists: Record<string, ListedEvent[]>,
  details: Record<string, Detail | Promise<Detail>>) {
  let page: Record<string, any> | undefined;
  const storage = new Map<string, unknown>([['devUser', 'organizer']]);
  const requests: string[] = [];
  const navigations: string[] = [];
  const switches: string[] = [];
  const scrolls: number[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/index/index.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (route: string) => {
        requests.push(route);
        if (route === '/me/events') return { items: lists[String(storage.get('devUser'))] || [] };
        const result = details[route.slice('/events/'.length)];
        if (!route.startsWith('/events/') || !result) throw new Error('unexpected API route');
        return result;
      } } };
      if (path === '../../config.js') return { developmentUser: 'organizer' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); },
      removeStorageSync(key: string) { storage.delete(key); },
      navigateTo({ url }: { url: string }) { navigations.push(url); },
      pageScrollTo({ scrollTop }: { scrollTop: number }) { scrolls.push(scrollTop); },
      switchTab({ url }: { url: string }) { switches.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, storage, requests, navigations, switches, scrolls };
}

test('state tabs place verified card facts first without fetching every event on default home', async () => {
  const listed: ListedEvent[] = ['p1', 'p2', 'p3', 'p4'].map(id => ({
    id, status: 'RECRUITING', title: `${id} 羽毛球`, isHost: false,
    myRegistrationStatus: 'REQUESTED'
  }));
  const { page, requests, scrolls } = makeHome({ organizer: listed }, {
    p1: detail('p1'), p2: detail('p2'), p3: detail('p3'), p4: detail('p4')
  });
  await page.onShow();
  assert.deepEqual(requests, ['/me/events']);
  await page.selectTab({ currentTarget: { dataset: { key: 'pending' } } });
  assert.equal(page.data.stateView, true);
  assert.deepEqual(scrolls, [0]);
  assert.deepEqual(requests, ['/me/events', '/events/p1', '/events/p2', '/events/p3']);
  assert.equal(page.data.visibleItems[0].dateRangeLabel, '3 月 22 日 19:00 – 21:00');
  assert.equal(page.data.visibleItems[0].venueLabel, '上海 · 蓝天体育中心');
  assert.equal(page.data.visibleItems[0].capacityLabel, '已确认 2 / 上限 8 人');
  assert.equal(page.data.visibleItems[3].venueLabel, '地点请到活动详情查看');
});

test('organized cards show only authorized real counts and route to the host workspace', async () => {
  const hosted: ListedEvent = { id: 'hosted', status: 'RECRUITING', title: '周日羽毛球',
    isHost: true, myRegistrationStatus: null };
  const { page, navigations } = makeHome({ organizer: [hosted] }, { hosted: detail('hosted') });
  await page.onShow();
  await page.selectTab({ currentTarget: { dataset: { key: 'organized' } } });
  assert.equal(page.data.visibleItems[0].hostCounts.confirmed, 2);
  assert.equal(page.data.visibleItems[0].hostCounts.reserved, 1);
  assert.equal(page.data.visibleItems[0].hostCounts.requested, 1);
  assert.equal(page.data.visibleItems[0].hostCounts.gap, 2);
  page.openCardAction({ currentTarget: { dataset: { id: 'hosted', action: 'hostSection' } } });
  assert.deepEqual(navigations, ['/pages/event/event?id=hosted&section=hostSection']);
});

test('history AA action appears only from reviewed detail and opens the real expense section', async () => {
  const ended: ListedEvent = { id: 'ended', status: 'COMPLETED', title: '已结束的徒步',
    isHost: false, myRegistrationStatus: 'CONFIRMED' };
  const { page, navigations } = makeHome({ organizer: [ended] }, {
    ended: detail('ended', 'dev:someone-else', { status: 'COMPLETED',
      payload: { ...detail('ended').payload, feeMode: 'AA' } })
  });
  await page.onShow();
  await page.selectTab({ currentTarget: { dataset: { key: 'history' } } });
  assert.equal(page.data.visibleItems[0].secondaryAction, 'expenseSection');
  assert.equal(page.data.visibleItems[0].secondaryLabel, '查看 AA 记录');
  page.openCardAction({ currentTarget: { dataset: { id: 'ended', action: 'expenseSection' } } });
  assert.deepEqual(navigations, ['/pages/event/event?id=ended&section=expenseSection']);
});

test('a delayed detail from the previous identity cannot replace the new actor cards', async () => {
  let releaseOld!: (value: Detail) => void;
  const oldDetail = new Promise<Detail>(resolve => { releaseOld = resolve; });
  const old: ListedEvent = { id: 'old', status: 'RECRUITING', title: '旧账号活动',
    isHost: false, myRegistrationStatus: 'REQUESTED' };
  const fresh: ListedEvent = { id: 'fresh', status: 'RECRUITING', title: '新账号活动',
    isHost: false, myRegistrationStatus: 'REQUESTED' };
  const { page, storage } = makeHome({ organizer: [old], second: [fresh] },
    { old: oldDetail, fresh: detail('fresh') });
  await page.onShow();
  const staleSelection = page.selectTab({ currentTarget: { dataset: { key: 'pending' } } });
  storage.set('devUser', 'second');
  await page.onShow();
  releaseOld(detail('old'));
  await staleSelection;
  assert.equal(page.data.visibleItems.length, 1);
  assert.equal(page.data.visibleItems[0].id, 'fresh');
  assert.equal(page.data.visibleItems[0].venueLabel, '上海 · 蓝天体育中心');
});

test('an offered seat opens the existing profile decision controls instead of claiming acceptance', async () => {
  const offered: ListedEvent = { id: 'offer', status: 'RECRUITING', title: '周五桌游',
    isHost: false, myRegistrationStatus: 'OFFERED' };
  const { page, switches } = makeHome({ organizer: [offered] }, { offer: detail('offer') });
  await page.onShow();
  const item = page.data.pending[0];
  assert.equal(item.primaryAction, 'offerNotifications');
  page.openCardAction({ currentTarget: { dataset: { id: item.id, action: item.primaryAction } } });
  assert.deepEqual(switches, ['/pages/me/me']);
});

test('the featured cover selects an available upcoming event and falls back when all events ended', async () => {
  const old: ListedEvent = { id: 'a-old', status: 'COMPLETED', title: '旧活动',
    isHost: true, myRegistrationStatus: null, startAt: '2025-03-22T11:00:00.000Z' };
  const cancelled: ListedEvent = { id: 'b-cancelled', status: 'CANCELLED', title: '已取消',
    isHost: true, myRegistrationStatus: null, startAt: '2099-03-22T11:00:00.000Z' };
  const later: ListedEvent = { id: 'z-later', status: 'RECRUITING', title: '稍晚的局',
    isHost: true, myRegistrationStatus: null, startAt: '2099-03-24T11:00:00.000Z' };
  const sooner: ListedEvent = { id: 'y-sooner', status: 'CONFIRMED', title: '更近的局',
    isHost: true, myRegistrationStatus: null, startAt: '2099-03-22T11:00:00.000Z' };
  const withUpcoming = makeHome({ organizer: [old, cancelled, later, sooner] }, {});
  await withUpcoming.page.onShow();
  assert.equal(withUpcoming.page.data.featuredItem.id, 'y-sooner');
  const onlyPast = makeHome({ organizer: [old, cancelled] }, {});
  await onlyPast.page.onShow();
  assert.equal(onlyPast.page.data.featuredItem, null);
});

test('history does not promise an AA ledger to a member without expense access', async () => {
  const interested: ListedEvent = { id: 'interest', status: 'COMPLETED', title: '往期徒步',
    isHost: false, myRegistrationStatus: 'INTERESTED' };
  const { page } = makeHome({ organizer: [interested] }, {
    interest: detail('interest', 'dev:someone-else', { status: 'COMPLETED',
      payload: { ...detail('interest').payload, feeMode: 'AA' } })
  });
  await page.onShow();
  await page.selectTab({ currentTarget: { dataset: { key: 'history' } } });
  assert.equal(page.data.visibleItems[0].secondaryAction, '');
});
