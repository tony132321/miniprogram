import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const profileStem = fileURLToPath(new URL('../miniprogram/subpackages/profile/profile-edit/profile-edit', import.meta.url));

test('profile edit header avoids the native capsule and opens real R1 destinations', () => {
  const markup = readFileSync(`${profileStem}.wxml`, 'utf8');
  assert.match(markup, /padding-right: {{headerPaddingRight}}/);
  assert.match(markup, /bindtap="toggleMore"/);
  assert.match(markup, /bindtap="goPrivacySafety"/);
  assert.match(markup, /bindtap="goLegal"/);
  assert.match(markup, /bindtap="goProfile"/);

  const routes: string[] = [];
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(`${profileStem}.js`, 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync() { return ''; },
      getSystemInfoSync() { return { statusBarHeight: 24 }; },
      getWindowInfo() { return { windowWidth: 390 }; },
      getMenuButtonBoundingClientRect() { return { left: 294 }; },
      navigateTo({ url }: { url: string }) { routes.push(url); },
      switchTab({ url }: { url: string }) { routes.push(url); }
    },
    require(module: string) {
      assert.equal(module, '../navigation.js');
      return { backToProfile() {}, statusBarHeight() { return 24; } };
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  page.onLoad({});
  assert.equal(page.data.headerPaddingRight, '104px');
  page.toggleMore();
  assert.equal(page.data.moreOpen, true);
  page.goLegal();
  assert.equal(page.data.moreOpen, false);
  page.goPrivacySafety();
  page.goProfile();
  assert.deepEqual(routes, [
    '/subpackages/profile/legal/legal',
    '/subpackages/profile/privacy-safety/privacy-safety',
    '/pages/me/me'
  ]);
});

test('unavailable profile controls and badge slots make their R1 limits visible', () => {
  const edit = readFileSync(`${profileStem}.wxml`, 'utf8');
  const badges = readFileSync(new URL('../miniprogram/subpackages/profile/badges/badges.wxml', import.meta.url), 'utf8');
  assert.match(edit, /头像上传待开放/);
  assert.match(edit, /性别选择待开放/);
  assert.match(edit, /未认证/);
  assert.doesNotMatch(edit, /已认证常玩水平/);
  assert.match(badges, /佩戴未开放/);
  assert.doesNotMatch(badges, /<view class="slot-icon">＋<\/view><text>待佩戴<\/text>/);
});
