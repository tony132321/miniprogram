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
    wx: { navigateTo(options: { url: string }) { routes.push(options.url); } }
  });
  assert.ok(page);
  page.data.id = 'event-1';
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
      setClipboardData({ data, success }: { data: string; success: () => void }) { copied.push(data); success(); },
      showToast() {},
      navigateTo({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.data.id = 'event-1';
  page.data.loadState = 'READY';
  page.data.event = { id: 'event-1', payload: { title: '周末羽毛球',
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
