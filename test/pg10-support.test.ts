import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const prefix = '../miniprogram/subpackages/profile/support/support';

test('support keeps a working safety route and FAQ without claiming unavailable service', () => {
  const markup = readFileSync(new URL(`${prefix}.wxml`, import.meta.url), 'utf8');
  const routes: string[] = [];
  const globalData: Record<string, unknown> = {};
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL(`${prefix}.js`, import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; },
      switchTab({ url }: { url: string }) { routes.push(url); }
    },
    getApp() { return { globalData }; },
    require(module: string) {
      if (module === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      if (module === '../../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${module}`);
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  page.toggleFaq({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(page.data.openIndex, 0);
  page.toggleFaq({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(page.data.openIndex, -1);
  page.goReport();
  assert.deepEqual(routes, ['/pages/me/me']);
  assert.equal((globalData.reportContext as { actor: string }).actor, 'host');
  assert.equal((globalData.reportContext as { eventId: string }).eventId, '');

  assert.match(markup, /AI (?:提问|客服)[^<]*未开放/);
  assert.match(markup, /人工客服[^<]*未开放/);
  assert.match(markup, /<textarea[^>]*disabled/);
  assert.match(markup, /<input[^>]*disabled/);
  assert.match(markup, /<button[^>]*disabled[^>]*>[^<]*反馈提交暂未开放/);
  assert.doesNotMatch(markup, /bindtap="(?:submitFeedback|uploadFeedback|contactSupport)"/);
  assert.doesNotMatch(markup, /3 秒响应|IRL_Support_Team|反馈提交成功/);
});
