import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';
import test from 'node:test';

test('discovery shows only current-account activities and routes their real IDs', async () => {
  let page: Record<string, any> | undefined;
  const storage = new Map<string, unknown>([['devUser', 'one']]);
  const requests: Array<(value: unknown) => void> = [];
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get(pathname: string) {
        assert.equal(pathname, '/me/events');
        return new Promise(resolve => requests.push(resolve));
      } } };
      if (path === '../../config.js') return { developmentUser: 'one' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      navigateTo(options: { url: string }) { routes.push(options.url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };

  const first = page.onShow();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1);
  storage.set('devUser', 'two');
  const second = page.onShow();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 2);
  requests[1]!({ items: [
    { id: 'draft', status: 'DRAFT', title: '私有草稿' },
    { id: 'current', status: 'RECRUITING', title: '周末羽毛球', startAt: '2027-03-22T11:00:00.000Z',
      endAt: '2027-03-22T13:00:00.000Z', city: '深圳', venueName: '合成测试球馆' }
  ] });
  await second;
  requests[0]!({ items: [{ id: 'old', status: 'RECRUITING', title: '旧账号活动' }] });
  await first;
  assert.deepEqual(page.data.personalEvents.map((item: { id: string }) => item.id), ['current']);
  assert.equal(page.data.personalEvents[0].dateLabel, '3 月 22 日 19:00');
  assert.equal(page.data.personalEvents[0].endTimeLabel, '—21:00');
  assert.equal(page.data.personalEvents[0].locationLabel, '深圳 · 合成测试球馆');
  page.openPersonalEvent({ currentTarget: { dataset: { id: 'old' } } });
  assert.deepEqual(routes, []);
  page.openPersonalEvent({ currentTarget: { dataset: { id: 'current' } } });
  assert.deepEqual(routes, ['/pages/event/event?id=current']);
  storage.set('devUser', 'three');
  page.openPersonalEvent({ currentTarget: { dataset: { id: 'current' } } });
  assert.deepEqual(routes, ['/pages/event/event?id=current'], 'old-account card cannot navigate after identity changes');

  const markup = readFileSync(new URL('../miniprogram/pages/discover/discover.wxml', import.meta.url), 'utf8');
  assert.match(markup, /wx:for="{{personalEvents}}"[^>]+bindtap="openPersonalEvent"/);
  assert.match(markup, /公开好友找局尚未开放/);
});

test('discovery labels a host activity awaiting review without advertising recruitment', async () => {
  let page: Record<string, any> | undefined;
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async () => ({ items: [
        { id: 'awaiting-review', title: '本人待审羽毛球', status: 'RECRUITING',
          reviewStatus: 'PENDING', recruiting: false, isHost: true,
          startAt: '2099-03-22T11:00:00.000Z' },
        { id: 'private-draft', title: '未发布的草稿', status: 'DRAFT', isHost: true }
      ] }) } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; },
      navigateTo(options: { url: string }) { routes.push(options.url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await page.onShow();
  assert.deepEqual(Array.from(page.data.personalEvents, (item: { id: string }) => item.id), ['awaiting-review']);
  assert.equal(page.data.personalEvents[0].statusLabel, '待审核');
  page.openPersonalEvent({ currentTarget: { dataset: { id: 'awaiting-review' } } });
  assert.deepEqual(routes, ['/pages/event/event?id=awaiting-review']);
});

test('invitation preview shows only a current token response and opens that invitation', async () => {
  let page: Record<string, any> | undefined;
  const storage = new Map<string, unknown>([['devUser', 'one']]);
  const replies: Array<(value: unknown) => void> = [];
  const requested: string[] = [];
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get(pathname: string) {
        requested.push(pathname);
        return new Promise(resolve => replies.push(resolve));
      } } };
      if (path === '../../config.js') return { developmentUser: 'one' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      navigateTo(options: { url: string }) { routes.push(options.url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  const oldToken = 'A'.repeat(32);
  const currentToken = 'B'.repeat(32);
  page.tokenChanged({ detail: { value: oldToken } });
  const old = page.previewInvite();
  page.tokenChanged({ detail: { value: currentToken } });
  const current = page.previewInvite();
  replies[1]!({ id: 'invited', title: '周末羽毛球', status: 'RECRUITING',
    startAt: '2027-03-22T11:00:00.000Z', endAt: '2027-03-22T13:00:00.000Z',
    city: '深圳', venueName: '合成测试球馆' });
  await current;
  replies[0]!({ id: 'old', title: '旧邀请', venueName: '旧地点' });
  await old;
  assert.deepEqual(requested, ['/i/' + oldToken, '/i/' + currentToken]);
  assert.equal(page.data.invitePreview.id, 'invited');
  assert.equal(page.data.invitePreview.dateLabel, '3 月 22 日 19:00');
  assert.equal(page.data.invitePreview.locationLabel, '深圳 · 合成测试球馆');
  page.openPreviewedInvite();
  assert.deepEqual(routes, ['/pages/event/event?token=' + currentToken]);
  storage.set('devUser', 'two');
  page.openPreviewedInvite();
  assert.deepEqual(routes, ['/pages/event/event?token=' + currentToken], 'old-account preview cannot navigate');
});

test('invitation preview reflects safety hold and paused recruitment instead of advertising open signup', async () => {
  let page: Record<string, any> | undefined;
  const replies: Array<(value: unknown) => void> = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: () => new Promise(resolve => replies.push(resolve)) } };
      if (path === '../../config.js') return { developmentUser: 'one' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'one' : ''; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.tokenChanged({ detail: { value: 'A'.repeat(32) } });
  const held = page.previewInvite();
  replies[0]!({ id: 'held', title: '暂停活动', status: 'RECRUITING', recruiting: true, riskPaused: true });
  await held;
  assert.equal(page.data.invitePreview.statusLabel, '安全暂停');
  page.tokenChanged({ detail: { value: 'B'.repeat(32) } });
  const paused = page.previewInvite();
  replies[1]!({ id: 'paused', title: '暂停招募', status: 'RECRUITING', recruiting: false, riskPaused: false });
  await paused;
  assert.equal(page.data.invitePreview.statusLabel, '暂停招募');
  page.tokenChanged({ detail: { value: 'C'.repeat(32) } });
  const confirmedHeld = page.previewInvite();
  replies[2]!({ id: 'confirmed-held', title: '已成局但安全暂停', status: 'CONFIRMED', recruiting: false, riskPaused: true });
  await confirmedHeld;
  assert.equal(page.data.invitePreview.statusLabel, '安全暂停');
});
