import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

function createCityPage(backStackAvailable = true) {
  let page: Record<string, any> | undefined;
  const scrolled: unknown[] = [];
  const toasts: string[] = [];
  const routes: string[] = [];
  const savedCities: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/city/city.js', import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync() { return '上海'; },
      setStorageSync(_key: string, city: string) { savedCities.push(city); },
      getSystemInfoSync() { return { statusBarHeight: 24 }; },
      pageScrollTo(options: unknown) { scrolled.push(options); },
      showToast(options: { title: string }) { toasts.push(options.title); },
      navigateBack(options?: { fail?: () => void }) {
        routes.push('back');
        if (!backStackAvailable) options?.fail?.();
      },
      switchTab({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  return { page, scrolled, toasts, routes, savedCities };
}

test('city rail jumps only to visible letter groups, and search narrows it', () => {
  const { page, scrolled } = createCityPage();
  assert.deepEqual(Array.from(page.data.letters), ['A', 'B', 'C', 'D', 'G', 'H', 'N', 'S', 'W']);
  page.jumpToLetter({ currentTarget: { dataset: { letter: 'S' } } });
  assert.equal(JSON.stringify(scrolled), JSON.stringify([{ selector: '#city-group-S', duration: 250 }]));
  page.search({ detail: { value: 'cheng' } });
  assert.deepEqual(Array.from(page.data.letters), ['C']);
  page.jumpToLetter({ currentTarget: { dataset: { letter: 'S' } } });
  assert.equal(scrolled.length, 1);
  page.clearSearch();
  assert.deepEqual(Array.from(page.data.letters), ['A', 'B', 'C', 'D', 'G', 'H', 'N', 'S', 'W']);
});

test('city list matches reference city coverage and unsupported location action stays truthful', () => {
  const { page, scrolled, toasts } = createCityPage();
  const names = page.data.visibleCities.map((item: { name: string }) => item.name);
  for (const name of ['包头', '蚌埠', '常州', '大庆', '桂林', '哈尔滨', '海口', '南昌', '南宁', '石家庄', '温州', '乌鲁木齐']) {
    assert.ok(names.includes(name), name);
  }
  page.locationHint();
  assert.match(toasts[0] || '', /手动选择/);
  page.searchMoreCities();
  assert.equal(page.data.searchFocused, true);
  assert.equal(JSON.stringify(scrolled), JSON.stringify([{ scrollTop: 0, duration: 250 }]));
});

test('city returns home when opened as the root route, including after a city selection', () => {
  const direct = createCityPage(false);
  direct.page.back();
  assert.deepEqual(direct.routes, ['back', '/pages/index/index']);
  direct.page.selectCity({ currentTarget: { dataset: { city: '北京' } } });
  assert.deepEqual(direct.savedCities, ['北京']);
  assert.deepEqual(direct.routes, ['back', '/pages/index/index', 'back', '/pages/index/index']);

  const nested = createCityPage(true);
  nested.page.selectCity({ currentTarget: { dataset: { city: '北京' } } });
  assert.deepEqual(nested.savedCities, ['北京']);
  assert.deepEqual(nested.routes, ['back']);
});
