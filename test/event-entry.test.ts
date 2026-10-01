import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createEventEntryPage } = require('../miniprogram/utils/event-entry.js');

function fixture(pages = 2) {
  const redirects: any[] = [];
  const back: any[] = [];
  const tabs: any[] = [];
  const wx = {
    redirectTo(options: any) { redirects.push(options); },
    navigateBack(options: any) { back.push(options); },
    switchTab(options: any) { tabs.push(options); }
  };
  const page = createEventEntryPage(wx, () => Array(pages).fill({}));
  page.data = { ...page.data };
  page.setData = (patch: any) => Object.assign(page.data, patch);
  return { page, redirects, back, tabs };
}

test('canonical event entry forwards invitation and deep-link values without losing Unicode or reserved characters', () => {
  const f = fixture();
  const values = { token: 'a+b&c/=?%🏸', id: 'event id', source: '朋友 分享&入口', section: 'registrationSection', entry: 'pendingExit', success: 'published', empty: '' };
  f.page.onLoad(values);
  assert.equal(f.redirects.length, 1);
  const target = new URL(f.redirects[0].url, 'https://test.invalid');
  assert.equal(target.pathname, '/subpackages/activity/event/event');
  assert.deepEqual(Object.fromEntries(target.searchParams), values);
  assert.equal(f.back.length + f.tabs.length, 0);
  assert.equal(f.page.data.message, '');
  assert.doesNotMatch(JSON.stringify(f.page.data), /a\+b|朋友|event id/);
});

test('event entry preserves existing WeChat query escapes without encoding them a second time', () => {
  const f = fixture();
  const raw = { source: '朋友分享 & 入口 🏸', token: 'a+b/=%', id: 'event id' };
  const encoded = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, encodeURIComponent(value)]));
  f.page.onLoad(encoded);
  const target = new URL(f.redirects[0].url, 'https://test.invalid');
  assert.deepEqual(Object.fromEntries(target.searchParams), raw);
  for (const [key, value] of Object.entries(encoded)) assert.ok(f.redirects[0].url.includes(`${key}=${value}`));
});

test('failed subpackage navigation reveals no token and can be retried with the same query', () => {
  const f = fixture();
  f.page.onLoad({ token: 'private-invitation', section: 'checkinSection' });
  const original = f.redirects[0].url;
  f.redirects[0].fail({ errMsg: 'download failed private-invitation' });
  assert.equal(f.page.data.loading, false);
  assert.match(f.page.data.message, /重试/);
  assert.doesNotMatch(f.page.data.message, /private-invitation|download/);
  f.page.retry();
  assert.equal(f.redirects.length, 2);
  assert.equal(f.redirects[1].url, original);
  assert.equal(f.page.data.loading, true);
});

test('entry ignores repeated taps while loading and a previous failure callback after retry', () => {
  const f = fixture();
  f.page.onLoad({ id: 'one' });
  f.page.retry();
  assert.equal(f.redirects.length, 1);
  f.redirects[0].fail({});
  f.page.retry();
  f.redirects[0].fail({});
  assert.equal(f.page.data.loading, true);
  assert.equal(f.page.data.message, '');
});

test('unloaded entry drops private query and ignores late failures or retry', () => {
  const f = fixture();
  f.page.onLoad({ token: 'private-invitation' });
  f.page.onUnload();
  f.redirects[0].fail({});
  f.page.retry();
  assert.equal(f.redirects.length, 1);
  assert.equal(f.page._target, '');
  assert.equal(f.page.data.message, '');
});

test('entry returns one level on an existing stack and uses home for a direct launch', () => {
  const stacked = fixture(); stacked.page.onLoad({ id: 'one' }); stacked.page.goBack();
  assert.equal(stacked.back.length, 1); assert.equal(stacked.tabs.length, 0);
  stacked.back[0].fail({});
  assert.equal(stacked.tabs[0].url, '/pages/index/index');
  const direct = fixture(1); direct.page.onLoad({ id: 'one' }); direct.page.goBack();
  assert.equal(direct.back.length, 0); assert.equal(direct.tabs[0].url, '/pages/index/index');
});

test('navigation exception remains retryable without exposing its private error', () => {
  const f = fixture();
  const broken = createEventEntryPage({ redirectTo() { throw new Error('token-private'); }, switchTab() {} }, () => []);
  broken.data = { ...broken.data }; broken.setData = (patch: any) => Object.assign(broken.data, patch);
  broken.onLoad({ token: 'token-private' });
  assert.equal(broken.data.loading, false);
  assert.match(broken.data.message, /重试/);
  assert.doesNotMatch(broken.data.message, /token-private/);
  assert.equal(f.redirects.length, 0);
});
