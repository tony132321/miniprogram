import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../miniprogram/subpackages/profile/legal/legal.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/subpackages/profile/legal/legal.wxml', import.meta.url), 'utf8');

test('PG10-E permissions tab reaches a truthful in-page explanation without publishing a formal agreement', () => {
  let page: Record<string, any> | undefined;
  const scrollCalls: Array<Record<string, unknown>> = [];
  runInNewContext(script, {
    Page(definition: Record<string, any>) { page = definition; },
    require(path: string) {
      assert.equal(path, '../navigation.js');
      return { backToProfile() {}, statusBarHeight() { return 24; } };
    },
    wx: {
      pageScrollTo(options: Record<string, unknown>) { scrollCalls.push({ ...options }); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };

  assert.match(markup, /<scroll-view[^>]*class="legal-tabs"[^>]*scroll-x="true"/);
  assert.match(markup, /<button[^>]*bindtap="goPermissions"[^>]*>权限使用说明<\/button>/);
  assert.match(markup, /id="legalPermissionsSection"/);
  assert.match(markup, /主动点击[^<]*扫码/);
  assert.match(markup, /报名确认[^<]*加日历/);
  assert.match(markup, /手动选择[^<]*浏览城市/);
  assert.match(markup, /class="legal-tab unavailable" disabled="{{true}}">第三方清单未发布<\/button>/);
  assert.match(markup, /class="legal-pdf" disabled="{{true}}">PDF 协议未发布<\/button>/);
  assert.doesNotMatch(markup, /合规文档 V4\.2|已通过安全认证|已知悉并确认/);

  page.goPermissions();
  assert.deepEqual(scrollCalls, [{ selector: '#legalPermissionsSection', duration: 180 }]);
});

test('permissions jump leaves the target heading visible below the sticky header', () => {
  let page: Record<string, any> | undefined;
  const scrollCalls: Array<Record<string, unknown>> = [];
  const query = {
    select(selector: string) {
      assert.equal(selector, '#legalPermissionsSection');
      return { boundingClientRect() { return query; } };
    },
    selectViewport() { return { scrollOffset() { return query; } }; },
    exec(callback: (values: unknown[]) => void) {
      callback([{ top: 500 }, { scrollTop: 100 }]);
    }
  };
  runInNewContext(script, {
    Page(definition: Record<string, any>) { page = definition; },
    require(path: string) {
      assert.equal(path, '../navigation.js');
      return { backToProfile() {}, statusBarHeight() { return 24; } };
    },
    wx: {
      createSelectorQuery() { return query; },
      getSystemInfoSync() { return { windowWidth: 375 }; },
      pageScrollTo(options: Record<string, unknown>) { scrollCalls.push({ ...options }); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  page.goPermissions();
  assert.deepEqual(scrollCalls, [{ scrollTop: 522, duration: 180 }]);
});
