import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { createApi } = require('../miniprogram/utils/api.js');
const source = readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8');

function mount(delayedWechatCode = false) {
  const storage = new Map<string, unknown>([['devUser', 'first-dev']]);
  const loginCallbacks: Array<Record<string, any>> = [];
  const exchanges: Array<Record<string, any>> = [];
  const platform = {
    getStorageSync(key: string) { return storage.get(key) || ''; },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); },
    removeStorageSync(key: string) { storage.delete(key); },
    login(options: Record<string, any>) {
      if (delayedWechatCode) loginCallbacks.push(options);
      else options.success({ code: 'first-dev-login-code' });
    },
    request(options: Record<string, any>) {
      assert.equal(options.url, 'https://api.example.test/auth/wechat');
      exchanges.push(options);
    }
  };
  const api = createApi(platform, { apiBase: 'https://api.example.test', developmentUser: 'first-dev' });
  let page: Record<string, any> | undefined;
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: 'first-dev' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: platform
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  page.refresh = async function () {
    this._refreshGeneration = (this._refreshGeneration || 0) + 1;
    this.setData({ loadState: 'READY' });
    return true;
  };
  page.setData({ devUser: 'first-dev' });
  return { page, storage, exchanges, loginCallbacks };
}

test('switching local account while WeChat exchange is pending cannot restore the old session', async () => {
  const { page, storage, exchanges } = mount();
  const pending = page.login();
  assert.equal(exchanges.length, 1);

  page.setData({ devUser: 'second-dev' });
  page.setDevUser();
  exchanges[0]!.success({ statusCode: 200, data: { token: 'first-session', userId: 'first-member' } });
  await pending;

  assert.equal(storage.get('devUser'), 'second-dev');
  assert.equal(storage.has('sessionToken'), false);
  assert.equal(storage.has('userId'), false);
  assert.equal(page.data.hasSession, false);
  assert.match(page.data.message, /本地测试身份已切换/);
});

test('switching local account before wx.login returns prevents the stale code exchange', async () => {
  const { page, storage, exchanges, loginCallbacks } = mount(true);
  const pending = page.login();
  assert.equal(loginCallbacks.length, 1);
  page.setData({ devUser: 'second-dev' });
  page.setDevUser();
  loginCallbacks[0]!.success({ code: 'late-first-dev-code' });
  if (exchanges[0])
    exchanges[0].success({ statusCode: 200, data: { token: 'late-session', userId: 'first-member' } });
  await pending;

  assert.equal(exchanges.length, 0);
  assert.equal(storage.get('devUser'), 'second-dev');
  assert.equal(storage.has('sessionToken'), false);
  assert.equal(page.data.hasSession, false);
});

test('a fresh explicit login after a cancelled local account switch still works', async () => {
  const { page, storage, exchanges } = mount();
  const oldLogin = page.login();
  page.setData({ devUser: 'second-dev' });
  page.setDevUser();
  exchanges[0]!.success({ statusCode: 200, data: { token: 'stale-session', userId: 'first-member' } });
  await oldLogin;

  const freshLogin = page.login();
  assert.equal(exchanges.length, 2);
  exchanges[1]!.success({ statusCode: 200, data: { token: 'fresh-session', userId: 'second-member' } });
  await freshLogin;

  assert.equal(storage.get('sessionToken'), 'fresh-session');
  assert.equal(storage.get('userId'), 'second-member');
  assert.equal(storage.has('devUser'), false);
  assert.equal(page.data.hasSession, true);
});
