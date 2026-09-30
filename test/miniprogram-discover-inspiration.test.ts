import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';
import test from 'node:test';

test('an unsupported discovery inspiration never jumps straight into a badminton form', () => {
  let page: Record<string, any> | undefined;
  let modal: Record<string, any> | undefined;
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: '' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      showModal(options: Record<string, any>) { modal = options; },
      switchTab(options: { url: string }) { routes.push(options.url); }
    }
  });
  assert.ok(page);
  page.openInspiration({ currentTarget: { dataset: { title: '咖啡聊天' } } });
  assert.deepEqual(routes, []);
  assert.match(modal?.content, /咖啡聊天.*仅供灵感.*只能发起羽毛球/);
  modal?.success({ confirm: false });
  assert.deepEqual(routes, []);
  modal?.success({ confirm: true });
  assert.deepEqual(routes, ['/pages/create/create']);

  const markup = readFileSync(new URL('../miniprogram/pages/discover/discover.wxml', import.meta.url), 'utf8');
  assert.match(markup, /class="featured-card" data-title="{{item.title}}" bindtap="openInspiration"/);
  assert.match(markup, /class="create-card" bindtap="goCreate"/);
});

test('discovery rotates local inspiration without presenting the cards as public events', () => {
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: '' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {}
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };

  assert.deepEqual(Array.from(page.data.recommendationCards, (card: { title: string }) => card.title),
    ['冲浪体验课', '周末一起看展', '咖啡馆里聊一聊']);
  page.rotateRecommendations();
  assert.deepEqual(Array.from(page.data.recommendationCards, (card: { title: string }) => card.title),
    ['春日露营', '城市漫步', '周五桌游局']);
  page.rotateRecommendations();
  assert.deepEqual(Array.from(page.data.recommendationCards, (card: { title: string }) => card.title),
    ['冲浪体验课', '周末一起看展', '咖啡馆里聊一聊']);

  const markup = readFileSync(new URL('../miniprogram/pages/discover/discover.wxml', import.meta.url), 'utf8');
  assert.match(markup, /bindtap="rotateRecommendations"[^>]*>换一批/);
  assert.match(markup, /wx:for="{{recommendationCards}}"[^>]*bindtap="openInspiration"/);
  assert.match(markup, /发起灵感/);
});
