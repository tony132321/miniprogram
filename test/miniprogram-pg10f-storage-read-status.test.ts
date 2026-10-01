import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../miniprogram/subpackages/profile/cache/cache.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/subpackages/profile/cache/cache.wxml', import.meta.url), 'utf8');

test('PG10-F refresh shows a real local read time and never clears protected storage', () => {
  let page: Record<string, any> | undefined;
  let clock = new Date(2026, 9, 1, 14, 3, 4).getTime();
  let failRead = false;
  let writes = 0;
  function DeviceDate() { return new Date(clock); }
  runInNewContext(script, {
    Page(definition: Record<string, any>) { page = definition; },
    Date: DeviceDate,
    require(path: string) {
      assert.equal(path, '../navigation.js');
      return { backToProfile() {}, statusBarHeight() { return 24; } };
    },
    wx: {
      getStorageInfoSync() {
        if (failRead) throw new Error('native storage unavailable');
        return { currentSize: 512, limitSize: 10240 };
      },
      clearStorageSync() { writes++; },
      removeStorageSync() { writes++; },
      setStorageSync() { writes++; }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  assert.match(markup, /bindtap="refreshStorage"/);
  assert.match(markup, /本机最近读取时间：{{lastReadAt}}/);

  page.refreshStorage();
  assert.equal(page.data.storageState, 'READY');
  assert.equal(page.data.lastReadAt, '2026-10-01 14:03:04');
  clock += 61_000;
  page.refreshStorage();
  assert.equal(page.data.lastReadAt, '2026-10-01 14:04:05');
  failRead = true;
  page.refreshStorage();
  assert.equal(page.data.storageState, 'UNAVAILABLE');
  assert.equal(page.data.lastReadAt, '');
  assert.equal(writes, 0);
});
