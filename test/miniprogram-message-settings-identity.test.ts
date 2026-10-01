import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('a previous session cannot send the notification-settings button intent into the new account', async () => {
  let page: Record<string, any> | undefined;
  let sessionToken = 'first-session';
  const focusWrites: string[] = [];
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/messages/messages.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get() {
        return { items: [{ id: 'notice-1', kind: 'EVENT_REMINDER', event_id: 'event-1' }],
          total: 1, unreadTotal: 1, nextOffset: null };
      } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return key === 'sessionToken' ? sessionToken : key === 'userId' ? 'member' : ''; },
      setStorageSync(key: string, value: string) { focusWrites.push(`${key}=${value}`); },
      switchTab({ url }: { url: string }) { routes.push(url); },
      showTabBar() {}, hideTabBar() {}
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };

  await page.onShow();
  assert.equal(page.data.items.length, 1);
  sessionToken = 'second-session';
  page.goNotificationSettings();
  assert.deepEqual(focusWrites, []);
  assert.deepEqual(routes, []);
  assert.equal(page.data.items.length, 0, 'old private notifications are cleared on the stale tap');

  await page.onShow();
  page.goNotificationSettings();
  assert.deepEqual(focusWrites, ['irlProfileFocusIntent=notificationSettingsSection']);
  assert.deepEqual(routes, ['/pages/me/me']);
});
