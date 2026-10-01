import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

test('clearing a city search keeps the controlled input focused while entering a full pinyin name', () => {
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/city/city.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getSystemInfoSync() { return { statusBarHeight: 24 }; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };

  page.clearSearch();
  assert.equal(page.data.searchFocused, true);
  page.search({ detail: { value: 'b' } });
  assert.equal(page.data.searchFocused, true, 'typing must not flip the bound focus property off');
  page.search({ detail: { value: 'beijing' } });
  assert.equal(page.data.searchFocused, true);
  assert.deepEqual(Array.from(page.data.visibleCities, (city: { name: string }) => city.name), ['北京']);

  const markup = readFileSync(new URL('../miniprogram/pages/city/city.wxml', import.meta.url), 'utf8');
  assert.match(markup, /class="search-input"[^>]*focus="{{searchFocused}}"/);
});
