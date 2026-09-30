import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

const routes = [
  { path: '../miniprogram/pages/city/city.js', field: 'currentCity' },
  { path: '../miniprogram/pages/index/index.js', field: 'city' },
  { path: '../miniprogram/pages/discover/discover.js', field: 'city' },
  { path: '../miniprogram/subpackages/profile/profile-edit/profile-edit.js', field: 'city' }
];

async function shownCity(path: string, field: string, savedCity: unknown) {
  let page: Record<string, any> | undefined;
  const storage = new Map<string, unknown>([['irlSelectedCity', savedCity]]);
  runInNewContext(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    require(module: string) {
      if (module === '../../utils/api.js') return { api: { get: async () => ({ items: [] }) } };
      if (module === '../../config.js') return { developmentUser: 'test-member' };
      if (module === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      if (module === '../../utils/city.js' || module === '../../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${module}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); },
      getSystemInfoSync() { return { statusBarHeight: 24 }; }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  await page.onShow();
  return { city: page.data[field], stored: storage.get('irlSelectedCity') };
}

for (const route of routes) {
  test(`${route.path} replaces an unsupported saved city with the shared default`, async () => {
    const result = await shownCity(route.path, route.field, '旧版测试城市');
    assert.equal(result.city, '上海', route.path);
    assert.equal(result.stored, '上海', `${route.path} must not leave the stale city in storage`);
  });
}

test('city-facing pages preserve an older selectable city', async () => {
  for (const route of routes) {
    const result = await shownCity(route.path, route.field, '厦门');
    assert.equal(result.city, '厦门', route.path);
    assert.equal(result.stored, '厦门', route.path);
  }
});
