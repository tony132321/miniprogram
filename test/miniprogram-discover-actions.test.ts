import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('discovery all-activity and unavailable favorite actions reach honest destinations', () => {
  let page: Record<string, any> | undefined;
  const routes: string[] = [];
  const toasts: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      navigateTo(options: { url: string }) { routes.push(options.url); },
      showToast(options: { title: string }) { toasts.push(options.title); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };

  page.goPersonalAll();
  assert.deepEqual(routes, ['/subpackages/profile/moments/moments?filter=all']);

  page.showUnavailable({ currentTarget: { dataset: { name: '收藏灵感' } } });
  assert.match(page.data.availabilityMessage, /收藏灵感.*暂未开放/);
  assert.deepEqual(toasts, ['收藏灵感暂未开放']);
  assert.deepEqual(routes, ['/subpackages/profile/moments/moments?filter=all']);
});

test('a closed public-search entry leads to the real invitation field and keeps invite navigation usable', () => {
  let page: Record<string, any> | undefined;
  const scrolls: Array<Record<string, unknown>> = [];
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync() { return ''; },
      pageScrollTo(options: Record<string, unknown>) { scrolls.push(options); },
      navigateTo({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };

  page.showUnavailable({ currentTarget: { dataset: { name: '搜索公开活动' } } });
  assert.match(page.data.availabilityMessage, /搜索公开活动暂未开放/);
  page.jumpToInvite();
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0]?.selector, '#inviteEntry');
  assert.equal(scrolls[0]?.duration, 300);
  page.tokenChanged({ detail: { value: ' ABC 123 ' } });
  page.openInvite();
  assert.deepEqual(routes, ['/pages/event/event?token=ABC%20123']);
});

test('discovery scans only a plain invitation token and ignores a result after account switch', () => {
  let page: Record<string, any> | undefined;
  let scan: Record<string, any> | undefined;
  const storage = new Map<string, string>([['devUser', 'visitor-one']]);
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) || ''; },
      scanCode(options: Record<string, any>) { scan = options; },
      navigateTo({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  const markup = readFileSync(new URL('../miniprogram/pages/discover/discover.wxml', import.meta.url), 'utf8');
  assert.match(markup, /class="invite-scan"[^>]+bindtap="scanInviteQr"/);

  page.scanInviteQr();
  assert.equal(scan?.onlyFromCamera, true);
  assert.deepEqual(Array.from(scan?.scanType || []), ['qrCode']);
  scan?.success({ result: 'https://example.invalid/abc', scanType: 'QR_CODE' });
  assert.equal(routes.length, 0);
  assert.match(page.data.message, /邀请码二维码/);

  page.scanInviteQr();
  storage.set('devUser', 'visitor-two');
  scan?.success({ result: 'a'.repeat(32), scanType: 'QR_CODE' });
  assert.equal(routes.length, 0);

  page.scanInviteQr();
  scan?.success({ result: 'A'.repeat(32), scanType: 'QR_CODE' });
  assert.deepEqual(routes, ['/pages/event/event?token=' + 'A'.repeat(32)]);
});

test('an invitation entered by one account cannot remain visible or open after account switch', async () => {
  let page: Record<string, any> | undefined;
  const storage = new Map<string, string>([['devUser', 'one']]);
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async () => ({ items: [] }) } };
      if (path === '../../config.js') return { developmentUser: 'one' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) || ''; },
      navigateTo({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.tokenChanged({ detail: { value: 'A'.repeat(32) } });
  storage.set('devUser', 'two');
  page.tokenChanged({ detail: { value: 'A'.repeat(32) } }); // late input event from the previous account
  page.openInvite();
  assert.deepEqual(routes, [], 'direct-open guard blocks the stale token before onShow');
  await page.onShow();
  assert.equal(page.data.tokenInput, '');
  assert.equal(page.data.message, '');
  page.openInvite();
  assert.deepEqual(routes, []);
});
