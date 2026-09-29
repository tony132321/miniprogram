import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

function loadProfilePage(name: 'legal' | 'cache', wx: Record<string, unknown>) {
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL(`../miniprogram/subpackages/profile/${name}/${name}.js`, import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; }, wx,
    require(module: string) {
      assert.equal(module, '../navigation.js');
      return { backToProfile() {}, statusBarHeight() { return 24; } };
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  return page;
}

test('legal page keeps real privacy and guidelines routes while formal documents remain unavailable', () => {
  const markup = readFileSync(new URL('../miniprogram/subpackages/profile/legal/legal.wxml', import.meta.url), 'utf8');
  const routes: string[] = [];
  const page = loadProfilePage('legal', {
    switchTab({ url }: { url: string }) { routes.push(url); },
    navigateTo({ url }: { url: string }) { routes.push(url); }
  });
  page.goPrivacy();
  page.goGuidelines();
  assert.deepEqual(routes, ['/pages/me/me', '/subpackages/profile/guidelines/guidelines']);
  assert.match(markup, /正式协议待核定/);
  assert.match(markup, /PDF 协议未发布/);
  assert.match(markup, /第三方清单未发布/);
  assert.doesNotMatch(markup, /已知悉并确认|privacy@project-irl\.com|V4\.2|2024年3月1日/);
});

test('cache page reports only native storage totals and does not clear session data', () => {
  let cleared = false;
  const page = loadProfilePage('cache', {
    getStorageInfoSync() { return { currentSize: 512, limitSize: 10240 }; },
    clearStorageSync() { cleared = true; }
  });
  page.refreshStorage();
  assert.equal(page.data.storageSize, '0.50 MB');
  assert.equal(page.data.storageLimit, '10.00 MB');
  assert.equal(page.data.usagePercent, 5);
  assert.equal(page.data.storageState, 'READY');
  assert.equal(cleared, false);

  const markup = readFileSync(new URL('../miniprogram/subpackages/profile/cache/cache.wxml', import.meta.url), 'utf8');
  assert.match(markup, /重新读取设备存储/);
  assert.match(markup, /不代表可清理/);
  assert.doesNotMatch(markup, /清理选中的|全选|海报缓存 8\.6|离线聊天/);
});

test('cache page rejects incomplete device statistics instead of showing a false available total', () => {
  const page = loadProfilePage('cache', { getStorageInfoSync() { return { currentSize: NaN, limitSize: 10240 }; } });
  page.refreshStorage();
  assert.equal(page.data.storageState, 'UNAVAILABLE');
  assert.equal(page.data.storageSize, '');
  assert.equal(page.data.storageLimit, '');
  assert.equal(page.data.usagePercent, 0);
});
