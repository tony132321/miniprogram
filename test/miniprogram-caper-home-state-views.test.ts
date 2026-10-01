import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

type ListedEvent = { id: string; status: string; title: string; startAt?: string; endAt?: string;
  city?: string; venueName?: string;
  isHost: boolean; isCohost?: boolean; myRegistrationStatus: string | null;
  reviewStatus?: string; recruiting?: boolean; version?: number };
type Detail = { id: string; hostId: string; status: string; reviewStatus: string;
  recruiting: boolean; version: number;
  payload: { title: string; startAt: string; endAt: string; city: string; venueName: string;
    minParticipants: number; maxParticipants: number; feeMode: string };
  stats: { confirmed: number; reserved: number; requested: number; waitlisted: number } };

function detail(id: string, hostId = 'organizer', overrides: Partial<Detail> = {}): Detail {
  return {
    id, hostId, status: 'RECRUITING', reviewStatus: 'APPROVED', recruiting: true, version: 2,
    payload: { title: '真实活动', startAt: '2027-03-22T11:00:00.000Z',
      endAt: '2027-03-22T13:00:00.000Z', city: '上海', venueName: '蓝天体育中心',
      minParticipants: 4, maxParticipants: 8, feeMode: 'FREE' },
    stats: { confirmed: 2, reserved: 1, requested: 1, waitlisted: 0 }, ...overrides
  };
}

function makeHome(lists: Record<string, ListedEvent[]>,
  details: Record<string, Detail | Promise<Detail>>, safetyStatus = 'OPEN') {
  let page: Record<string, any> | undefined;
  const storage = new Map<string, unknown>([['devUser', 'organizer']]);
  const requests: string[] = [];
  const navigations: string[] = [];
  const switches: string[] = [];
  const scrolls: number[] = [];
  const modals: Array<Record<string, any>> = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/index/index.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (route: string) => {
        requests.push(route);
        if (route === '/me/events') return { items: lists[String(storage.get('devUser'))] || [] };
        if (route === '/system/safety') return { status: safetyStatus };
        if (route === '/me/notifications?offset=0')
          return { items: [], total: 0, unreadTotal: 0, nextOffset: null, snapshot: 'test-snapshot' };
        const result = details[route.slice('/events/'.length)];
        if (!route.startsWith('/events/') || !result) throw new Error('unexpected API route');
        return result;
      } } };
      if (path === '../../config.js') return { developmentUser: 'organizer' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); },
      removeStorageSync(key: string) { storage.delete(key); },
      navigateTo({ url }: { url: string }) { navigations.push(url); },
      showModal(options: Record<string, any>) { modals.push(options); },
      pageScrollTo({ scrollTop }: { scrollTop: number }) { scrolls.push(scrollTop); },
      switchTab({ url }: { url: string }) { switches.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, storage, requests, navigations, switches, scrolls, modals };
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
  assert.deepEqual(requests, ['/me/notifications?offset=0', '/me/events']);
  await page.selectTab({ currentTarget: { dataset: { key: 'pending' } } });
  assert.equal(page.data.stateView, true);
  assert.deepEqual(scrolls, [0]);
  assert.deepEqual(requests, ['/me/notifications?offset=0', '/me/events',
    '/events/p1', '/events/p2', '/events/p3', '/events/p4']);
  assert.equal(page.data.visibleItems[0].dateRangeLabel, '3 月 22 日 19:00 – 21:00');
  assert.equal(page.data.visibleItems[0].venueLabel, '上海 · 蓝天体育中心');
  assert.equal(page.data.visibleItems[0].capacityLabel, '已确认 2 / 上限 8 人');
  assert.equal(page.data.visibleItems[3].venueLabel, '上海 · 蓝天体育中心');
  assert.equal(page.data.visibleItems[3].capacityLabel, '已确认 2 / 上限 8 人');
});

test('attending cards show reviewed city, venue and time range from the first list response', async () => {
  const listed: ListedEvent = { id: 'joined', status: 'CONFIRMED', title: '周末羽毛球',
    isHost: false, myRegistrationStatus: 'CONFIRMED', city: '深圳', venueName: '南山体育馆',
    startAt: '2099-03-22T11:00:00.000Z', endAt: '2099-03-22T13:00:00.000Z' };
  const { page, requests } = makeHome({ organizer: [listed] }, {});
  await page.onShow();
  assert.equal(page.data.visibleItems[0].dateRangeLabel, '3 月 22 日 19:00 – 21:00');
  assert.equal(page.data.visibleItems[0].venueLabel, '深圳 · 南山体育馆');
  assert.deepEqual(requests, ['/me/notifications?offset=0', '/me/events']);
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

test('organizer cards expose the relevant announcement and check-in actions without a duplicate shortcut', async () => {
  const recruiting: ListedEvent = { id: 'recruiting', status: 'RECRUITING', title: '周六羽毛球',
    isHost: true, myRegistrationStatus: null };
  const confirmed: ListedEvent = { id: 'confirmed', status: 'CONFIRMED', title: '周日羽毛球',
    isHost: true, myRegistrationStatus: null };
  const draft: ListedEvent = { id: 'draft', status: 'DRAFT', title: '未发布羽毛球',
    isHost: true, myRegistrationStatus: null };
  const { page, navigations, storage } = makeHome({ organizer: [recruiting, confirmed, draft] }, {
    recruiting: detail('recruiting'), confirmed: detail('confirmed', 'organizer', { status: 'CONFIRMED' }),
    draft: detail('draft', 'organizer', { status: 'DRAFT' })
  });
  await page.onShow();
  await page.selectTab({ currentTarget: { dataset: { key: 'organized' } } });
  const byId = (id: string) => page.data.items.find((item: any) => item.id === id);
  assert.equal(byId('recruiting').secondaryLabel, '发公告');
  assert.equal(byId('confirmed').secondaryLabel, '签到核销码');
  assert.equal(byId('confirmed').shortcutAction, '', 'check-in belongs in the reference button row');
  assert.equal(byId('draft').secondaryLabel, '查看活动');

  page.openCardAction({ currentTarget: { dataset: { id: 'recruiting', action: byId('recruiting').secondaryAction } } });
  page.openCardAction({ currentTarget: { dataset: { id: 'confirmed', action: byId('confirmed').secondaryAction } } });
  assert.deepEqual(navigations, [
    '/pages/event/event?id=recruiting&section=hostSection&entry=hostAnnouncement',
    '/pages/event/event?id=confirmed&section=checkinSection&entry=hostCheckin'
  ]);
  page.openCardAction({ currentTarget: { dataset: { id: 'draft', action: 'hostAnnouncement' } } });
  page.openCardAction({ currentTarget: { dataset: { id: 'recruiting', action: 'checkinSection' } } });
  assert.equal(navigations.length, 2, 'other statuses cannot forge the host shortcuts');
  storage.set('devUser', 'other-actor');
  page.openCardAction({ currentTarget: { dataset: { id: 'recruiting', action: 'hostAnnouncement' } } });
  assert.equal(navigations.length, 2, 'a stale account cannot reuse announcement navigation');
});

test('pending review recruitment never advertises announcement or share before or after fresh detail', async () => {
  const markup = readFileSync(new URL('../miniprogram/pages/index/index.wxml', import.meta.url), 'utf8');
  assert.match(markup, /wx:if="{{item\.shareReady}}" class="card-share"/,
    'the visible share control must use the checked host recruitment state');
  const pending: ListedEvent = { id: 'pending-review', status: 'RECRUITING', title: '审核中的羽毛球',
    isHost: true, myRegistrationStatus: null, reviewStatus: 'PENDING', recruiting: false, version: 2 };
  const approved: ListedEvent = { id: 'changed-after-list', status: 'RECRUITING', title: '已批准的羽毛球',
    isHost: true, myRegistrationStatus: null, reviewStatus: 'APPROVED', recruiting: true, version: 2 };
  const unknown: ListedEvent = { id: 'older-summary', status: 'RECRUITING', title: '旧版列表活动',
    isHost: true, myRegistrationStatus: null };
  const { page, navigations } = makeHome({ organizer: [pending, approved, unknown] }, {
    'pending-review': detail('pending-review', 'organizer', { reviewStatus: 'PENDING', recruiting: false }),
    'changed-after-list': detail('changed-after-list', 'organizer',
      { reviewStatus: 'PENDING', recruiting: false, version: 3 }),
    'older-summary': detail('older-summary', 'organizer', { reviewStatus: 'PENDING', recruiting: false })
  });
  await page.onShow();
  let awaiting = page.data.organized.find((item: any) => item.id === pending.id);
  assert.equal(awaiting.cardLabel, '待审核');
  assert.equal(awaiting.secondaryLabel, '查看活动');
  assert.equal(awaiting.shareReady, false);
  const unverified = page.data.organized.find((item: any) => item.id === unknown.id);
  assert.equal(unverified.cardLabel, '资格待核对');
  assert.equal(unverified.secondaryLabel, '查看活动');
  assert.equal(unverified.shareReady, false);
  page.openCardAction({ currentTarget: { dataset: { id: pending.id, action: 'hostAnnouncement' } } });
  page.openHostShare({ currentTarget: { dataset: { id: pending.id } } });
  assert.deepEqual(navigations, []);

  await page.selectTab({ currentTarget: { dataset: { key: 'organized' } } });
  awaiting = page.data.visibleItems.find((item: any) => item.id === pending.id);
  const changed = page.data.visibleItems.find((item: any) => item.id === approved.id);
  assert.equal(awaiting.cardLabel, '待审核');
  assert.equal(awaiting.shareReady, false);
  assert.equal(changed.cardLabel, '待审核', 'fresh current review state overrides an earlier approved list');
  assert.equal(changed.secondaryLabel, '查看活动');
  assert.equal(changed.shareReady, false);
  const checked = page.data.visibleItems.find((item: any) => item.id === unknown.id);
  assert.equal(checked.cardLabel, '待审核');
  assert.equal(checked.shareReady, false);
  page.openCardAction({ currentTarget: { dataset: { id: approved.id, action: 'hostAnnouncement' } } });
  page.openHostShare({ currentTarget: { dataset: { id: approved.id } } });
  assert.deepEqual(navigations, []);
});

test('an older event detail cannot override a newer host review summary', async () => {
  const hosted: ListedEvent = { id: 'newer-summary', status: 'RECRUITING', title: '周末羽毛球',
    isHost: true, myRegistrationStatus: null, reviewStatus: 'APPROVED', recruiting: true, version: 4 };
  const { page } = makeHome({ organizer: [hosted] }, {
    'newer-summary': detail('newer-summary', 'organizer',
      { reviewStatus: 'PENDING', recruiting: false, version: 3 })
  });
  await page.onShow();
  await page.selectTab({ currentTarget: { dataset: { key: 'organized' } } });
  const card = page.data.visibleItems[0];
  assert.equal(card.version, 4);
  assert.equal(card.cardLabel, '招募中');
  assert.equal(card.secondaryLabel, '发公告');
  assert.equal(card.shareReady, true);
  assert.equal(card.detailLoaded, undefined);
});

test('organizer cover badge shows activity status even when the host also registered', async () => {
  const hosted: ListedEvent = { id: 'hosted', status: 'RECRUITING', title: '周日羽毛球',
    isHost: true, myRegistrationStatus: 'CONFIRMED' };
  const attending: ListedEvent = { id: 'attending', status: 'RECRUITING', title: '周六羽毛球',
    isHost: false, myRegistrationStatus: 'CONFIRMED' };
  const { page } = makeHome({ organizer: [hosted, attending] }, { hosted: detail('hosted') });
  await page.onShow();
  await page.selectTab({ currentTarget: { dataset: { key: 'organized' } } });
  assert.equal(page.data.visibleItems[0].cardLabel, '招募中');
  assert.equal(page.data.visibleItems[0].statusLabel, '招募中');
  assert.equal(page.data.attending[0].cardLabel, '已报名');
});

test('multiple recruiting host cards let the organizer choose the exact invite destination', async () => {
  const first: ListedEvent = { id: 'first-host', status: 'RECRUITING', title: '周六羽毛球',
    isHost: true, myRegistrationStatus: null };
  const second: ListedEvent = { id: 'second-host', status: 'RECRUITING', title: '周日羽毛球',
    isHost: true, myRegistrationStatus: null };
  const { page, navigations, storage } = makeHome({ organizer: [first, second] }, {
    'first-host': detail('first-host'), 'second-host': detail('second-host')
  });
  await page.onShow();
  await page.selectTab({ currentTarget: { dataset: { key: 'organized' } } });
  page.openHostShare({ currentTarget: { dataset: { id: 'second-host' } } });
  assert.deepEqual(navigations, ['/subpackages/activity/share/share?id=second-host']);
  page.openHostShare({ currentTarget: { dataset: { id: 'missing' } } });
  storage.set('devUser', 'different-actor');
  page.openHostShare({ currentTarget: { dataset: { id: 'first-host' } } });
  assert.equal(navigations.length, 1);
  const wxml = readFileSync(new URL('../miniprogram/pages/index/index.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /bindtap="openHostShare"/);
});

test('a detail whose raw host ID differs from the current actor cannot enrich a hosted card', async () => {
  const hosted: ListedEvent = { id: 'hosted', status: 'RECRUITING', title: '周日羽毛球',
    isHost: true, myRegistrationStatus: null };
  const { page } = makeHome({ organizer: [hosted] }, { hosted: detail('hosted', 'different-owner') });
  await page.onShow();
  await page.selectTab({ currentTarget: { dataset: { key: 'organized' } } });
  assert.equal(page.data.visibleItems[0].hostCounts, null);
  assert.equal(page.data.visibleItems[0].detailLoaded, undefined);
});

test('signed-in organizer detail compares the raw host ID while session identity guards stale data', async () => {
  const hosted: ListedEvent = { id: 'hosted', status: 'RECRUITING', title: '周日羽毛球',
    isHost: true, myRegistrationStatus: null };
  const { page, storage } = makeHome({ organizer: [hosted] }, { hosted: detail('hosted') });
  storage.set('sessionToken', 'session-one');
  storage.set('userId', 'organizer');
  await page.onShow();
  await page.selectTab({ currentTarget: { dataset: { key: 'organized' } } });
  assert.equal(page.data.visibleItems[0].hostCounts.confirmed, 2);
  assert.equal(page.data.visibleItems[0].detailLoaded, true);
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

test('history card carries the activity state and refreshed real date into the cover', async () => {
  const ended: ListedEvent = { id: 'history-cover', status: 'COMPLETED', title: '周末羽毛球',
    startAt: '2027-03-20T10:00:00.000Z', isHost: false, myRegistrationStatus: 'CONFIRMED' };
  const { page } = makeHome({ organizer: [ended] }, {
    'history-cover': detail('history-cover', 'another-host', { status: 'COMPLETED' })
  });
  await page.onShow();
  assert.equal(page.data.history[0].cardLabel, '已结束',
    'a completed event must not be shown as merely registered');
  assert.equal(page.data.history[0].historyPosterDateLabel, '3 月 20 日 · 往期活动');

  await page.selectTab({ currentTarget: { dataset: { key: 'history' } } });
  assert.equal(page.data.visibleItems[0].historyPosterDateLabel, '3 月 22 日 · 往期活动',
    'the cover date must follow the reviewed event detail');
});

test('cancelled and expired history cards never present a completed-game celebration', async () => {
  const listed: ListedEvent[] = [
    { id: 'cancelled', status: 'CANCELLED', title: '取消的羽毛球局',
      startAt: '2026-10-03T10:00:00.000Z', isHost: false, myRegistrationStatus: 'CONFIRMED' },
    { id: 'expired', status: 'EXPIRED', title: '过期的羽毛球局',
      startAt: '2026-09-30T10:00:00.000Z', isHost: true, myRegistrationStatus: null },
    { id: 'completed', status: 'COMPLETED', title: '完成的羽毛球局',
      isHost: true, myRegistrationStatus: null }
  ];
  const { page, navigations } = makeHome({ organizer: listed }, {
    cancelled: detail('cancelled', 'another-host', { status: 'CANCELLED',
      payload: { ...detail('cancelled').payload, startAt: '2026-10-04T11:00:00.000Z' } }),
    expired: detail('expired', 'organizer', { status: 'EXPIRED',
      payload: { ...detail('expired').payload, startAt: '2026-09-29T11:00:00.000Z' } })
  });
  await page.onShow();
  const [cancelled, expired, completed] = page.data.history;
  assert.equal(cancelled.historyStickerLabel, '往期记录 · 活动已取消');
  assert.equal(expired.historyStickerLabel, '往期记录 · 活动已过期');
  assert.equal(cancelled.historyPosterDateLabel, '10 月 3 日 · 已取消',
    'a planned future date must not imply the cancelled event was held');
  assert.equal(expired.historyPosterDateLabel, '9 月 30 日 · 已过期');
  for (const card of [cancelled, expired]) {
    assert.equal(card.historyTone, 'neutral');
    assert.equal(card.historyStateIcon, 'i');
    assert.equal(card.primaryAction, 'detailsSection');
    page.openCardAction({ currentTarget: { dataset: { id: card.id, action: card.primaryAction } } });
  }
  assert.equal(completed.historyStickerLabel, 'MEMORIES ✦ GREAT GAME');
  assert.equal(completed.historyTone, 'celebration');
  assert.equal(completed.historyStateIcon, '✓');
  assert.deepEqual(navigations, [
    '/pages/event/event?id=cancelled&section=detailsSection',
    '/pages/event/event?id=expired&section=detailsSection'
  ]);
  await page.selectTab({ currentTarget: { dataset: { key: 'history' } } });
  const current = (id: string) => page.data.visibleItems.find((item: ListedEvent) => item.id === id);
  assert.equal(current('cancelled').historyPosterDateLabel, '10 月 4 日 · 已取消');
  assert.equal(current('expired').historyPosterDateLabel, '9 月 29 日 · 已过期');
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

test('an offered seat identifies its event for fresh profile offer controls without claiming acceptance', async () => {
  const offered: ListedEvent = { id: 'offer', status: 'RECRUITING', title: '周五桌游',
    isHost: false, myRegistrationStatus: 'OFFERED' };
  const { page, switches, storage } = makeHome({ organizer: [offered] }, { offer: detail('offer') });
  await page.onShow();
  const item = page.data.pending[0];
  assert.equal(item.primaryAction, 'offerNotifications');
  page.openCardAction({ currentTarget: { dataset: { id: item.id, action: item.primaryAction } } });
  assert.deepEqual(switches, ['/pages/me/me']);
  assert.equal(JSON.stringify(storage.get('irlProfileOfferIntent')),
    JSON.stringify({ eventId: 'offer', owner: 'dev:organizer' }));
});

test('completed member history primary action reaches feedback while other historical identities stay on details', async () => {
  const listed: ListedEvent[] = [
    { id: 'confirmed-member', status: 'COMPLETED', title: '已参加的羽毛球',
      isHost: false, myRegistrationStatus: 'CONFIRMED' },
    { id: 'interested-member', status: 'COMPLETED', title: '仅关注的羽毛球',
      isHost: false, myRegistrationStatus: 'INTERESTED' }
  ];
  const { page, navigations, storage } = makeHome({ organizer: listed }, {});
  await page.onShow();
  const confirmed = page.data.history.find((item: ListedEvent) => item.id === 'confirmed-member');
  const interested = page.data.history.find((item: ListedEvent) => item.id === 'interested-member');
  assert.equal(confirmed.primaryLabel, '查看结项与反馈');
  assert.equal(confirmed.primaryAction, 'checkinSection');
  assert.equal(interested.primaryLabel, '查看活动记录');
  assert.equal(interested.primaryAction, 'detailsSection');

  page.openCardAction({ currentTarget: { dataset: { id: confirmed.id, action: confirmed.primaryAction } } });
  page.openCardAction({ currentTarget: { dataset: { id: interested.id, action: 'checkinSection' } } });
  page.openCardAction({ currentTarget: { dataset: { id: interested.id, action: interested.primaryAction } } });
  assert.deepEqual(navigations, [
    '/pages/event/event?id=confirmed-member&section=checkinSection&entry=memberFeedback',
    '/pages/event/event?id=interested-member&section=detailsSection'
  ]);

  const currentConfirmed = page.data.items.find((item: ListedEvent) => item.id === confirmed.id);
  currentConfirmed.shortcutAction = '';
  page.openCardAction({ currentTarget: { dataset: { id: confirmed.id, action: confirmed.primaryAction } } });
  assert.equal(navigations.at(-1),
    '/pages/event/event?id=confirmed-member&section=checkinSection&entry=memberFeedback',
    'the primary action must carry its feedback focus even without a separate shortcut');

  storage.set('devUser', 'another-account');
  page.openCardAction({ currentTarget: { dataset: { id: confirmed.id, action: confirmed.primaryAction } } });
  assert.equal(navigations.length, 3, 'an old account cannot replay its history card action');
});

test('state cards deep-link current activity exit, check-in, feedback and repeat controls without writing business state', async () => {
  const listed: ListedEvent[] = [
    { id: 'pending-exit', status: 'RECRUITING', title: '待审批的局', isHost: false, myRegistrationStatus: 'REQUESTED' },
    { id: 'started-pending', status: 'IN_PROGRESS', title: '已开始的局', isHost: false, myRegistrationStatus: 'REQUESTED' },
    { id: 'host-checkin', status: 'CONFIRMED', title: '主办签到的局', isHost: true, myRegistrationStatus: null },
    { id: 'member-feedback', status: 'COMPLETED', title: '成员已参加的局', isHost: false, myRegistrationStatus: 'CONFIRMED' },
    { id: 'interest-only', status: 'COMPLETED', title: '仅表达兴趣的局', isHost: false, myRegistrationStatus: 'INTERESTED' },
    { id: 'host-repeat', status: 'COMPLETED', title: '主办完成的局', isHost: true, myRegistrationStatus: null }
  ];
  const { page, navigations, storage, requests } = makeHome({ organizer: listed }, {});
  await page.onShow();
  const byId = (id: string) => page.data.items.find((item: any) => item.id === id);
  assert.equal(byId('pending-exit').secondaryAction, 'pendingExit');
  assert.equal(byId('pending-exit').secondaryLabel, '取消报名申请');
  assert.equal(byId('pending-exit').shortcutAction, '');
  assert.equal(byId('started-pending').shortcutAction, '');
  assert.equal(byId('host-checkin').secondaryAction, 'checkinSection');
  assert.equal(byId('host-checkin').shortcutAction, '');
  assert.equal(byId('member-feedback').shortcutAction, 'checkinSection');
  assert.equal(byId('interest-only').shortcutAction, '');
  assert.equal(byId('host-repeat').primaryLabel, '再来一局');
  assert.equal(byId('host-repeat').primaryAction, 'hostRepeat');
  assert.equal(byId('host-repeat').shortcutAction, 'detailsSection');
  for (const [id, action] of [
    ['pending-exit', 'pendingExit'], ['host-checkin', 'checkinSection'],
    ['member-feedback', 'checkinSection'], ['host-repeat', 'detailsSection']
  ]) page.openCardAction({ currentTarget: { dataset: { id, action } } });
  assert.deepEqual(navigations, [
    '/pages/event/event?id=pending-exit&section=registrationSection&entry=pendingExit',
    '/pages/event/event?id=host-checkin&section=checkinSection&entry=hostCheckin',
    '/pages/event/event?id=member-feedback&section=checkinSection&entry=memberFeedback',
    '/pages/event/event?id=host-repeat&section=detailsSection'
  ]);
  page.openCardAction({ currentTarget: { dataset: { id: 'interest-only', action: 'checkinSection' } } });
  page.openCardAction({ currentTarget: { dataset: { id: 'started-pending', action: 'checkinSection' } } });
  assert.equal(navigations.length, 4, 'missing shortcuts cannot be forged');
  storage.set('devUser', 'another-account');
  page.openCardAction({ currentTarget: { dataset: { id: 'host-repeat', action: 'detailsSection' } } });
  assert.equal(navigations.length, 4, 'stale identity cannot reuse a prior account shortcut');
  assert.deepEqual(requests, ['/me/notifications?offset=0', '/me/events']);
});

test('completed host history card checks current event and safety before opening the repeat control', async () => {
  const hosted: ListedEvent = { id: 'completed-host', status: 'COMPLETED', title: '已结束的羽毛球',
    isHost: true, myRegistrationStatus: null, version: 4 };
  const { page, requests, navigations } = makeHome({ organizer: [hosted] }, {
    'completed-host': detail('completed-host', 'organizer', { status: 'COMPLETED', version: 4 })
  });
  await page.onShow();
  const card = page.data.history[0];
  assert.equal(card.primaryLabel, '再来一局');
  assert.equal(card.primaryAction, 'hostRepeat');
  assert.equal(card.shortcutLabel, '查看活动详情');
  assert.equal(card.shortcutAction, 'detailsSection');
  await page.openCardAction({ currentTarget: { dataset: { id: hosted.id, action: card.primaryAction } } });
  assert.ok(requests.includes('/events/completed-host'));
  assert.ok(requests.includes('/system/safety'));
  assert.deepEqual(navigations, ['/pages/event/event?id=completed-host&section=hostSection&entry=hostRepeat']);
  assert.ok(requests.every(route => !route.includes('/repeat')), 'the card tap must not create a draft');
});

test('history repeat card fails closed when safety, event state, host, or version changes', async () => {
  const hosted: ListedEvent = { id: 'history-repeat', status: 'COMPLETED', title: '已结束的羽毛球',
    isHost: true, myRegistrationStatus: null, version: 4 };
  for (const scenario of [
    { event: detail('history-repeat', 'organizer', { status: 'COMPLETED', version: 4 }), safety: 'CLOSED' },
    { event: detail('history-repeat', 'organizer', { status: 'IN_PROGRESS', version: 5 }), safety: 'OPEN' },
    { event: detail('history-repeat', 'another-host', { status: 'COMPLETED', version: 4 }), safety: 'OPEN' },
    { event: detail('history-repeat', 'organizer', { status: 'COMPLETED', version: 3 }), safety: 'OPEN' }
  ]) {
    const { page, navigations } = makeHome({ organizer: [hosted] }, { 'history-repeat': scenario.event }, scenario.safety);
    await page.onShow();
    await page.openCardAction({ currentTarget: { dataset: { id: hosted.id, action: 'hostRepeat' } } });
    assert.deepEqual(navigations, [], `ineligible ${JSON.stringify(scenario)} must not open repeat`);
  }
});

test('old history repeat tap cannot navigate after account A to B to A reloads', async () => {
  const hosted: ListedEvent = { id: 'repeat-after-switch', status: 'COMPLETED', title: '已结束的羽毛球',
    isHost: true, myRegistrationStatus: null, version: 4 };
  let releaseDetail!: (value: Detail) => void;
  const delayedDetail = new Promise<Detail>(resolve => { releaseDetail = resolve; });
  const { page, storage, navigations } = makeHome({ organizer: [hosted], 'another-account': [] },
    { 'repeat-after-switch': delayedDetail });
  await page.onShow();
  const oldTap = page.openCardAction({ currentTarget: { dataset: { id: hosted.id, action: 'hostRepeat' } } });
  storage.set('devUser', 'another-account');
  await page.onShow();
  storage.set('devUser', 'organizer');
  await page.onShow();
  releaseDetail(detail(hosted.id, 'organizer', { status: 'COMPLETED', version: 4 }));
  await oldTap;
  assert.deepEqual(navigations, [], 'a previous page generation must not open a new route');
});

test('cover click opens only a current account event from the loaded list', async () => {
  const first: ListedEvent = { id: 'first', status: 'RECRUITING', title: '第一场',
    isHost: true, myRegistrationStatus: null };
  const second: ListedEvent = { id: 'second', status: 'CONFIRMED', title: '第二场',
    isHost: false, myRegistrationStatus: 'CONFIRMED' };
  const { page, navigations, storage } = makeHome({ organizer: [first], second: [second] }, {});
  await page.onShow();
  page.openEvent({ currentTarget: { dataset: { id: 'first' } } });
  page.openEvent({ currentTarget: { dataset: { id: 'not-loaded' } } });
  assert.deepEqual(navigations, ['/pages/event/event?id=first']);
  storage.set('devUser', 'second');
  page.openEvent({ currentTarget: { dataset: { id: 'first' } } });
  assert.equal(navigations.length, 1, 'stale cover cannot navigate after identity changes');
  await page.onShow();
  page.openEvent({ currentTarget: { dataset: { id: 'first' } } });
  page.openEvent({ currentTarget: { dataset: { id: 'second' } } });
  assert.deepEqual(navigations, ['/pages/event/event?id=first', '/pages/event/event?id=second']);
});

test('non-badminton home inspiration requires an honest confirmation before opening create', async () => {
  const { page, switches, modals, navigations } = makeHome({ organizer: [] }, {});
  page.openCategory({ currentTarget: { dataset: { label: '美食' } } });
  assert.equal(switches.length, 0);
  assert.equal(modals.length, 1);
  assert.match(modals[0]!.content, /当前只能发起羽毛球活动/);
  modals[0]!.success({ confirm: false });
  assert.equal(switches.length, 0);
  page.openInspiration({ currentTarget: { dataset: { title: '周末聚餐' } } });
  assert.equal(modals.length, 2);
  modals[1]!.success({ confirm: true });
  assert.deepEqual(switches, ['/pages/create/create']);
  page.openCategory({ currentTarget: { dataset: { label: '运动' } } });
  assert.deepEqual(switches, ['/pages/create/create', '/pages/create/create']);
  page.openCategory({ currentTarget: { dataset: { label: '更多' } } });
  assert.deepEqual(switches, ['/pages/create/create', '/pages/create/create', '/pages/discover/discover']);
  assert.deepEqual(navigations, []);
});

test('home footer has real about, privacy and support destinations', () => {
  const { page, navigations } = makeHome({}, {});
  page.goAbout();
  page.goPrivacy();
  page.goSupport();
  assert.deepEqual(navigations, ['/pages/about/about', '/subpackages/profile/legal/legal',
    '/subpackages/profile/support/support']);
  const wxml = readFileSync(new URL('../miniprogram/pages/index/index.wxml', import.meta.url), 'utf8');
  for (const handler of ['goAbout', 'goPrivacy', 'goSupport'])
    assert.match(wxml, new RegExp(`bindtap="${handler}"`));
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

test('the long feed uses only current-account activity cards and clears them on identity switch', async () => {
  const old: ListedEvent = { id: 'old-personal', status: 'RECRUITING', title: '旧身份羽毛球',
    startAt: '2099-03-22T11:00:00.000Z', isHost: true, myRegistrationStatus: null };
  const fresh: ListedEvent = { id: 'fresh-personal', status: 'CONFIRMED', title: '新身份羽毛球',
    startAt: '2099-03-23T11:00:00.000Z', isHost: false, myRegistrationStatus: 'CONFIRMED' };
  const { page, storage } = makeHome({ organizer: [old], second: [fresh] }, {});
  await page.onShow();
  assert.deepEqual(page.data.homePreviewItems.map((item: ListedEvent) => item.id), ['old-personal']);
  storage.set('devUser', 'second');
  await page.onShow();
  assert.deepEqual(page.data.homePreviewItems.map((item: ListedEvent) => item.id), ['fresh-personal']);
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
