import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
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
    { id: 'current', status: 'RECRUITING', title: '周末羽毛球', startAt: '2027-03-22T11:00:00.000Z' }
  ] });
  await second;
  requests[0]!({ items: [{ id: 'old', status: 'RECRUITING', title: '旧账号活动' }] });
  await first;
  assert.deepEqual(page.data.personalEvents.map((item: { id: string }) => item.id), ['current']);
  assert.equal(page.data.personalEvents[0].dateLabel, '3 月 22 日 19:00');
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
