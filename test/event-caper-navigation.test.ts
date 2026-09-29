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
