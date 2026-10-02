import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';
import test from 'node:test';

test('profile invitation entry lands on discovery input once and rejects an old account intent', async () => {
  const storage = new Map<string, unknown>([['devUser', 'one']]);
  const tabs: string[] = [];
  const scrolls: string[] = [];
  let me: Record<string, any> | undefined;
  let discover: Record<string, any> | undefined;
  const wx = {
    getStorageSync(key: string) { return storage.get(key) ?? ''; },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); },
    removeStorageSync(key: string) { storage.delete(key); },
    switchTab({ url }: { url: string }) { tabs.push(url); },
    pageScrollTo({ selector }: { selector: string }) { scrolls.push(selector); },
    nextTick(callback: () => void) { callback(); }
  };
  const requireSource = (path: string) => {
    if (path === '../../utils/api.js') return { api: { get: async () => ({ items: [] }) } };
    if (path === '../../config.js') return { developmentUser: 'one' };
    if (path === '../../utils/city.js') return cityModule;
    throw new Error(`unexpected require ${path}`);
  };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { me = definition; }, wx, require: requireSource
  });
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { discover = definition; }, wx, require: requireSource,
    getApp() { return { globalData: { ready: Promise.resolve() } }; }
  });
  assert.ok(me);
  assert.ok(discover);
  discover.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  const profileMarkup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  assert.match(profileMarkup, /输入邀请码 ›<\/button>/);
  me.goInviteEntry();
  assert.deepEqual(tabs, ['/pages/discover/discover']);
  await discover.onShow();
  assert.deepEqual(scrolls, ['#inviteEntry']);
  assert.equal(storage.has('irlDiscoverFocusInvite'), false, 'focus intent is one time');
  await discover.onShow();
  assert.deepEqual(scrolls, ['#inviteEntry']);

  storage.set('irlDiscoverFocusInvite', 'dev:one');
  storage.set('devUser', 'two');
  await discover.onShow();
  assert.deepEqual(scrolls, ['#inviteEntry'], 'an old account cannot reuse its focus intent');
  assert.equal(storage.has('irlDiscoverFocusInvite'), false);

  storage.set('sessionToken', 'token-first');
  storage.set('userId', 'member');
  me.goInviteEntry();
  storage.set('sessionToken', 'token-second');
  await discover.onShow();
  assert.deepEqual(scrolls, ['#inviteEntry'], 'a new session for the same member cannot reuse its old focus intent');
  assert.equal(storage.has('irlDiscoverFocusInvite'), false);
});
