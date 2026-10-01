import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/subpackages/profile/badges/badges.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/subpackages/profile/badges/badges.wxml', import.meta.url), 'utf8');

function loadBadges() {
  let page: Record<string, any> | undefined;
  const navigations: string[] = [];
  runInNewContext(source, {
    Page(definition: Record<string, any>) { page = definition; },
    require(path: string) {
      assert.equal(path, '../navigation.js');
      return { backToProfile() {}, statusBarHeight() { return 24; } };
    },
    wx: {
      navigateTo({ url }: { url: string }) { navigations.push(url); },
      switchTab({ url }: { url: string }) { navigations.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  return { page, navigations };
}

test('PG10-B primary CTA shares an honest badge concept preview while records remain reachable', () => {
  const { page, navigations } = loadBadges();
  assert.match(markup, /<button[^>]+open-type="share"[^>]*>\s*<image[^>]*\/>\s*<text>分享勋章墙概念预览<\/text>/);
  assert.match(markup, /bindtap="goActivities"[^>]*>查看我的真实活动记录/);
  assert.match(markup, /单枚勋章分享尚未开放/);
  assert.doesNotMatch(markup, /分享勋章墙到朋友圈|已解锁\s*14|已获\s*\d+\s*枚/);
  assert.deepEqual({ ...page.onShareAppMessage() }, {
    title: '耍起 CAPER · 勋章墙概念预览（勋章尚未开放）',
    path: '/subpackages/profile/badges/badges'
  });
  page.goActivities();
  assert.deepEqual(navigations, ['/subpackages/profile/moments/moments?filter=all']);
});
