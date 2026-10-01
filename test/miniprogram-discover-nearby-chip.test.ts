import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

test('the Nearby chip reaches the existing closed nearby section and city selector', () => {
  let page: Record<string, any> | undefined;
  const scrolls: Array<Record<string, unknown>> = [];
  const routes: string[] = [];
  const selectors: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: '' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      createSelectorQuery() {
        return {
          select(selector: string) { selectors.push(selector); return { boundingClientRect() {} }; },
          selectViewport() { return { scrollOffset() {} }; },
          exec(callback: (result: unknown[]) => void) {
            callback([{ top: 1050 }, { bottom: 132 }, { scrollTop: 0 }]);
          }
        };
      },
      pageScrollTo(options: Record<string, unknown>) { scrolls.push(options); },
      navigateTo({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };

  page.selectCategory({ currentTarget: { dataset: { name: '附近分类' } } });
  assert.deepEqual(selectors, ['#nearbySection', '.category-scroll']);
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0]?.scrollTop, 908,
    'target heading sits below the sticky category bar instead of behind it');
  assert.equal(scrolls[0]?.selector, undefined);
  assert.equal(scrolls[0]?.duration, 300);
  assert.equal(page.data.discoveryEnabled, false);
  assert.deepEqual(Array.from(page.data.publicItems), []);
  page.openCity();
  assert.deepEqual(routes, ['/pages/city/city']);

  const markup = readFileSync(new URL('../miniprogram/pages/discover/discover.wxml', import.meta.url), 'utf8');
  assert.match(markup, /id="nearbySection"[^>]*>[^<]*<view><text class="section-mark">⌖<\/text><text>附近正在发生<\/text>/);
  assert.match(markup, /item === '附近' \? '查看附近活动状态与城市选择'/);
  assert.match(markup, /附近活动待开放/);
});
