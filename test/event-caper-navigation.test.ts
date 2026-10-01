import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('a direct-linked event back button returns to a real app route when there is no prior page', () => {
  const navigations: string[] = [];
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      navigateBack(options: { fail: () => void }) { options.fail(); },
      switchTab(options: { url: string }) { navigations.push(options.url); }
    }
  });
  assert.ok(page);
  page.goBack();
  assert.deepEqual(navigations, ['/pages/index/index']);
});

test('rejected activity content shortcut opens the real profile review form', () => {
  let page: Record<string, any> | undefined;
  const actions: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(path);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      setStorageSync(key: string, value: string) { actions.push(key + '=' + value); },
      switchTab({ url }: { url: string }) { actions.push(url); }
    }
  });
  assert.ok(page);
  page.goToContentAppeal();
  assert.deepEqual(actions, ['irlProfileFocusIntent=contentSection', '/pages/me/me']);
});

test('event more button offers a safety action before navigating to the report form', () => {
  let page: Record<string, any> | undefined;
  let actionSheet: Record<string, any> | undefined;
  const routes: string[] = [];
  const globalData: Record<string, any> = {};
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData }; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; },
      showActionSheet(options: Record<string, any>) { actionSheet = options; },
      switchTab(options: { url: string }) { routes.push(options.url); }
    }
  });
  assert.ok(page);
  page.data.id = 'event-1';
  page.openEventActions();
  assert.deepEqual(routes, []);
  assert.equal(actionSheet?.itemList[0], '举报与求助');
  actionSheet?.success({ tapIndex: 0 });
  assert.deepEqual(routes, ['/pages/me/me']);
  assert.equal(globalData.reportContext.eventId, 'event-1');
  assert.match(readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8'),
    /event-nav-safety" bindtap="openEventActions"/);
});

test('host workbench opens the registered share card for the current event', () => {
  let page: Record<string, any> | undefined;
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; },
      navigateTo(options: { url: string }) { routes.push(options.url); }
    }
  });
  assert.ok(page);
  page.data.id = 'event-1';
  page.data.currentUser = 'host';
  page.data.event = { id: 'event-1', hostId: 'host' };
  page.data.isHost = false;
  page.openShareCard();
  assert.deepEqual(routes, []);
  page.data.isHost = true;
  page.openShareCard();
  assert.deepEqual(routes, ['/subpackages/activity/share/share?id=event-1']);
  assert.match(readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8'),
    /bindtap="openShareCard"/);
});

test('AA ledger presentation keeps each integer-cent share exact in yuan', () => {
  let format: ((fen: number) => string) | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8') +
    '\nglobalThis.__format = yuanFromFen;', {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page() {},
    get __format() { return format; },
    set __format(value) { format = value; }
  });
  assert.ok(format);
  assert.equal(format(0), '¥0.00');
  assert.equal(format(9999), '¥99.99');
  assert.equal(format(10001), '¥100.01');
  assert.equal(format(-1), '金额待核对');
});

test('event header shows the current China-local time range without repeating a same-day date', () => {
  let display: ((event: Record<string, any>) => Record<string, any>) | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8') +
    '\nglobalThis.__display = eventDisplay;', {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page() {},
    get __display() { return display; },
    set __display(value) { display = value; }
  });
  assert.ok(display);
  const sameDay = display({ payload: { title: '周末羽毛球',
    startAt: '2026-10-04T10:00:00Z', endAt: '2026-10-04T12:00:00Z' } });
  assert.equal(sameDay.date, '10月4日（周日）18:00');
  assert.equal(sameDay.end, '20:00');
  assert.equal(sameDay.isBadminton, true);
  const nextDay = display({ payload: { title: '城市漫步',
    startAt: '2026-10-04T15:00:00Z', endAt: '2026-10-04T18:00:00Z' } });
  assert.equal(nextDay.end, '10月5日（周一）02:00');
  assert.equal(nextDay.isBadminton, false);
});

test('PG01 location and share controls use the current event and its real capability boundary', () => {
  let page: Record<string, any> | undefined;
  const copied: string[] = [];
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; },
      setClipboardData({ data, success }: { data: string; success: () => void }) { copied.push(data); success(); },
      showToast() {},
      navigateTo({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.data.id = 'event-1';
  page.data.loadState = 'READY';
  page.data.currentUser = 'host';
  page.data.event = { id: 'event-1', hostId: 'host', payload: { title: '周末羽毛球',
    city: '上海', venueName: '公共球馆', startAt: '2026-10-04T10:00:00Z',
    endAt: '2026-10-04T12:00:00Z' } };
  page.copyVenue();
  assert.equal(copied[0], '上海 · 公共球馆');
  page.data.isHost = true;
  page.shareCurrentEvent();
  assert.deepEqual(routes, ['/subpackages/activity/share/share?id=event-1']);
  page.data.isHost = false;
  page.data.hostAlias = '活动主办方';
  page.shareCurrentEvent();
  assert.match(copied[1]!, /活动：周末羽毛球/);
  assert.equal(routes.length, 1);
});

test('PG05-S confirmed member copies the latest venue from the success card', async () => {
  const markup = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  const successCard = markup.match(/<view wx:if="{{successState === 'JOINED'}}"[\s\S]*?<view class="joined-success-card joined-roster-card"/);
  assert.ok(successCard);
  assert.match(successCard[0], /class="joined-ticket-row joined-ticket-venue"[\s\S]*?bindtap="copyJoinedVenue"/);

  let page: Record<string, any> | undefined;
  const copied: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? 'member-1' : ''; },
      setClipboardData({ data, success }: { data: string; success: () => void }) { copied.push(data); success(); },
      showToast() {}
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'event-1', loadState: 'READY', currentUser: 'member-1', successState: 'JOINED',
    myRegistration: { status: 'CONFIRMED' }, event: { id: 'event-1', payload: { city: '上海', venueName: '旧场馆' } } });
  page.refresh = async function () {
    this.setData({ event: { id: 'event-1', payload: { city: '上海', venueName: '新场馆' } } });
    return true;
  };
  await page.copyJoinedVenue();
  assert.deepEqual(copied, ['上海 · 新场馆']);
});

test('PG05-S venue action rejects a stale identity, revoked seat and missing venue', async () => {
  let actor = 'member-1';
  let page: Record<string, any> | undefined;
  const copied: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? actor : ''; },
      setClipboardData({ data, success }: { data: string; success: () => void }) { copied.push(data); success(); },
      showToast() {}
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'event-1', loadState: 'READY', currentUser: 'member-1', successState: 'JOINED',
    myRegistration: { status: 'CONFIRMED' }, event: { id: 'event-1', payload: { city: '上海', venueName: '旧场馆' } } });
  page.refresh = async function () {
    this.setData({ myRegistration: { status: 'WAITLISTED' }, successState: '' });
    return true;
  };
  actor = 'member-2';
  await page.copyJoinedVenue();
  assert.deepEqual(copied, []);

  actor = 'member-1';
  await page.copyJoinedVenue();
  assert.deepEqual(copied, []);

  page.setData({ successState: 'JOINED', myRegistration: { status: 'CONFIRMED' },
    event: { id: 'event-1', payload: { city: '上海', venueName: '旧场馆' } } });
  page.refresh = async function () {
    this.setData({ event: { id: 'event-1', payload: { city: '上海', venueName: '' } } });
    return true;
  };
  await page.copyJoinedVenue();
  assert.deepEqual(copied, []);
  assert.equal(page.data.message, '当前活动尚未确认公共集合地点。');
});

test('venue clipboard completion does not show an old-account success toast', () => {
  let actor = 'member-1';
  let clipboardSuccess: (() => void) | undefined;
  let page: Record<string, any> | undefined;
  const toasts: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? actor : ''; },
      setClipboardData({ success }: { success: () => void }) { clipboardSuccess = success; },
      showToast({ title }: { title: string }) { toasts.push(title); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'event-1', loadState: 'READY', currentUser: 'member-1',
    event: { id: 'event-1', payload: { city: '上海', venueName: '公共球馆' } } });
  page.copyVenue();
  assert.ok(clipboardSuccess);
  actor = 'member-2';
  clipboardSuccess();
  assert.deepEqual(toasts, []);

  actor = '';
  page.setData({ currentUser: '' });
  page.copyVenue();
  assert.ok(clipboardSuccess);
  actor = 'member-3';
  clipboardSuccess();
  assert.deepEqual(toasts, [], 'anonymous copy completion must not toast after another account appears');
});

test('PG05-S venue action uses the real event refresh before copying or dismissing a revoked seat', async () => {
  let registrationStatus = 'CONFIRMED';
  let venueName = '新场馆';
  let page: Record<string, any> | undefined;
  const copied: string[] = [];
  const liveEvent = () => ({ id: 'event-1', hostId: 'host-1', status: 'RECRUITING',
    reviewStatus: 'APPROVED', recruiting: true, riskPaused: false, version: 2,
    payload: { title: '周末羽毛球', visibility: 'INVITE', city: '上海', venueName,
      startAt: '2026-10-05T10:00:00Z', endAt: '2026-10-05T12:00:00Z', feeMode: 'FREE',
      maxParticipants: 8, minParticipants: 2 },
    stats: { confirmed: 2, reserved: 0, requested: 0, waitlisted: 0, reconfirmRequired: 0 } });
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (url: string) => {
        if (url === '/me/registrations?eventId=event-1')
          return { items: [{ event_id: 'event-1', status: registrationStatus }] };
        if (url === '/events/event-1') return liveEvent();
        if (url === '/system/safety') return { status: 'OPEN' };
        if (url === '/events/event-1/aliases') return { items: [], notice: { version: 'v1', text: '昵称仅用于本场' } };
        if (url.startsWith('/events/event-1/')) return { items: [] };
        throw new Error(`unexpected GET ${url}`);
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? 'member-1' : ''; },
      setClipboardData({ data, success }: { data: string; success: () => void }) { copied.push(data); success(); },
      showToast() {}
    },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'event-1', loadState: 'READY', currentUser: 'member-1', successState: 'JOINED',
    myRegistration: { status: 'CONFIRMED' }, event: { ...liveEvent(), payload: { ...liveEvent().payload, venueName: '旧场馆' } } });

  await page.copyJoinedVenue();
  assert.deepEqual(copied, ['上海 · 新场馆']);
  assert.equal(page.data.successState, 'JOINED');

  registrationStatus = 'WAITLISTED';
  venueName = '改期后的场馆';
  await page.copyJoinedVenue();
  assert.deepEqual(copied, ['上海 · 新场馆']);
  assert.equal(page.data.successState, '');
  assert.equal(page.data.myRegistration.status, 'WAITLISTED');
});

test('PG05-S ignores an old A copy response after A to B to A account reloads', async () => {
  let actor = 'member-A';
  let registrationsRead = 0;
  let resolveOldRegistration: ((value: Record<string, unknown>) => void) | undefined;
  let signalOldStarted: (() => void) | undefined;
  const oldStarted = new Promise<void>(resolve => { signalOldStarted = resolve; });
  const oldRegistration = new Promise<Record<string, unknown>>(resolve => { resolveOldRegistration = resolve; });
  const copied: string[] = [];
  let page: Record<string, any> | undefined;
  const liveEvent = () => ({ id: 'event-1', hostId: 'host-1', status: 'RECRUITING',
    reviewStatus: 'APPROVED', recruiting: true, riskPaused: false, version: 2,
    payload: { title: '周末羽毛球', visibility: 'INVITE', city: '上海', venueName: '本次场馆',
      startAt: '2026-10-05T10:00:00Z', endAt: '2026-10-05T12:00:00Z', feeMode: 'FREE',
      maxParticipants: 8, minParticipants: 2 },
    stats: { confirmed: 2, reserved: 0, requested: 0, waitlisted: 0, reconfirmRequired: 0 } });
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (url: string) => {
        if (url === '/me/registrations?eventId=event-1') {
          registrationsRead += 1;
          if (registrationsRead === 1) { signalOldStarted?.(); return oldRegistration; }
          return actor === 'member-B' ? { items: [] } :
            { items: [{ event_id: 'event-1', status: 'CONFIRMED' }] };
        }
        if (url === '/events/event-1') {
          if (actor === 'member-B') throw Object.assign(new Error('无权查看'), { code: 'FORBIDDEN' });
          return liveEvent();
        }
        if (url === '/system/safety') return { status: 'OPEN' };
        if (url === '/events/event-1/aliases') return { items: [], notice: { version: 'v1', text: '本场昵称提示' } };
        if (url.startsWith('/events/event-1/')) return { items: [] };
        throw new Error(`unexpected GET ${url}`);
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? actor : ''; },
      setClipboardData({ data, success }: { data: string; success: () => void }) { copied.push(data); success(); },
      showToast() {}
    },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'event-1', loadState: 'READY', currentUser: 'member-A', successState: 'JOINED',
    myRegistration: { status: 'CONFIRMED' }, event: liveEvent() });

  const oldCopy = page.copyJoinedVenue();
  await oldStarted;
  actor = 'member-B';
  await page.refresh();
  actor = 'member-A';
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.successState, 'JOINED');
  resolveOldRegistration?.({ items: [{ event_id: 'event-1', status: 'CONFIRMED' }] });
  await oldCopy;
  assert.deepEqual(copied, [], 'the first A click cannot act on an obsolete response');
  assert.equal(page.data.currentUser, 'member-A');
});
