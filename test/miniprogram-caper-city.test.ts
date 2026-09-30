import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

function cityPage(savedCity = '上海') {
  let page: Record<string, any> | undefined;
  const storage = new Map<string, unknown>([['irlSelectedCity', savedCity]]);
  const navigation: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/city/city.js', import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) || ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); },
      navigateBack() { navigation.push('back'); },
      getSystemInfoSync() { return { statusBarHeight: 24 }; }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  page.onShow();
  return { page, storage, navigation };
}

test('CAPER city search accepts Chinese names and pinyin, and selection returns to the caller', () => {
  const { page, storage, navigation } = cityPage();
  page.search({ detail: { value: 'bei' } });
  assert.ok(page.data.visibleCities.some((city: { name: string }) => city.name === '北京'));
  assert.ok(page.data.visibleCities.every((city: { name: string }) => city.name !== '上海'));
  page.clearSearch();
  assert.equal(page.data.query, '');
  page.search({ detail: { value: '成' } });
  assert.ok(page.data.visibleCities.some((city: { name: string }) => city.name === '成都'));
  page.selectCity({ currentTarget: { dataset: { city: '成都' } } });
  assert.equal(storage.get('irlSelectedCity'), '成都');
  assert.deepEqual(navigation, ['back']);
});

test('CAPER city selection rejects unknown values and does not claim GPS evidence', () => {
  const { page, storage, navigation } = cityPage();
  page.selectCity({ currentTarget: { dataset: { city: '不存在的城市' } } });
  assert.equal(storage.get('irlSelectedCity'), '上海');
  assert.deepEqual(navigation, []);
  const markup = readFileSync(new URL('../miniprogram/pages/city/city.wxml', import.meta.url), 'utf8');
  assert.doesNotMatch(markup, /GPS已就绪|已根据您的实时位置/);
});

test('city page ignores an unsupported saved city while preserving an existing searchable city', () => {
  const unsupported = cityPage('旧版测试城市');
  assert.equal(unsupported.page.data.currentCity, '上海');
  const supported = cityPage('厦门');
  assert.equal(supported.page.data.currentCity, '厦门');
});
