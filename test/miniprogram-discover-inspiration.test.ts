import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('an unsupported discovery inspiration never jumps straight into a badminton form', () => {
  let page: Record<string, any> | undefined;
  let modal: Record<string, any> | undefined;
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
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
