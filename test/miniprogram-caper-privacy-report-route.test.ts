import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/subpackages/profile/privacy-safety/privacy-safety.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/subpackages/profile/privacy-safety/privacy-safety.wxml', import.meta.url), 'utf8');

function mount(storage: Record<string, string>) {
  let page: Record<string, any> | undefined;
  const destinations: string[] = [];
  const focusWrites: Array<[string, string]> = [];
  const globalData: Record<string, any> = {};
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../../utils/api.js') return { api: {} };
      if (path === '../../../config.js') return { developmentUser: '' };
      if (path === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData }; },
    wx: {
      getStorageSync(key: string) { return storage[key] || ''; },
      setStorageSync(key: string, value: string) { focusWrites.push([key, value]); },
      switchTab({ url }: { url: string }) { destinations.push(url); },
      navigateTo({ url }: { url: string }) { destinations.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  return { page, destinations, focusWrites, globalData };
}

test('privacy safety report CTA opens the current session report form directly', () => {
  const { page, destinations, focusWrites, globalData } = mount({ sessionToken: 'token-a', userId: 'member-a' });
  globalData.profileFocus = 'privacySection';
  page.goReport();
  assert.deepEqual(focusWrites, [['irlProfileFocusIntent', 'reportSection']]);
  assert.deepEqual(destinations, ['/pages/me/me']);
  assert.equal(globalData.reportContext.actor, 'member-a');
  assert.equal(globalData.reportContext.owner, 'session:member-a:token-a');
  assert.equal(globalData.reportContext.eventId, '');
  assert.equal(globalData.profileFocus, undefined, 'a previous privacy focus must not override the report target');
  assert.match(markup, /class="pg10-card help-card" bindtap="goReport"/);
});

test('privacy safety report CTA preserves sign-in gate without creating a guest report context', () => {
  const { page, destinations, focusWrites, globalData } = mount({});
  page.goReport();
  assert.deepEqual(focusWrites, [['irlProfileFocusIntent', 'reportSection']]);
  assert.deepEqual(destinations, ['/pages/me/me']);
  assert.equal(globalData.reportContext, undefined);
});
