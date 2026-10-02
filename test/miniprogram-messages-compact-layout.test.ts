import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/pages/messages/messages.js', import.meta.url), 'utf8');
function mount(anonymous = false, withoutSheet = false) {
  let page: Record<string, any> | undefined;
  const storage: Record<string, string> = anonymous ? {} : { userId: 'member', sessionToken: 'session-1' };
  const reads: string[] = [], routes: string[] = [], scrolls: object[] = [];
  const sheets: Array<Record<string, any>> = [];
  const items = [
    { id: 'r', kind: 'EVENT_REMINDER', event_id: 'event-1', event_version: 3, status: 'IN_APP', created_at: '2026-10-02T00:00:00Z', external_status: 'NOT_REQUESTED' },
    { id: 'c', kind: 'EVENT_CONFIRMED', event_id: 'event-2', event_version: 2, status: 'OPENED', created_at: '2026-10-01T00:00:00Z', external_status: 'NOT_REQUESTED' },
    { id: 'u', kind: 'MATERIAL_CHANGE', event_id: 'event-3', event_version: 4, status: 'IN_APP', created_at: '2026-10-02T01:00:00Z', external_status: 'NOT_REQUESTED' },
    { id: 's', kind: 'APPEAL_CREATED', status: 'IN_APP', created_at: '2026-10-01T01:00:00Z', external_status: 'NOT_REQUESTED' }
  ];
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../config.js') return { developmentUser: '' };
      if (path === '../../utils/api.js') return { api: { async get(path: string) {
        reads.push(path);
        if (path === '/me/notifications?offset=0') return { items, total: 140, unreadTotal: 100, nextOffset: 4, snapshot: 'notice-snapshot' };
        if (path === '/me/approval-requests?offset=0') return { items: [{ registrationId: 'reg-1', eventId: 'event-1', eventTitle: '活动', isHost: true, canApprove: true, expectedVersion: 3, createdAt: '2026-10-02T00:00:00Z' }], total: 1, nextOffset: null, snapshot: 'approval-snapshot' };
        throw new Error(`unexpected GET ${path}`);
      } } };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return storage[key] || ''; },
      setStorageSync(key: string, value: string) { storage[key] = value; },
      removeStorageSync(key: string) { delete storage[key]; },
      switchTab({ url }: { url: string }) { routes.push(url); },
      pageScrollTo(value: object) { scrolls.push(value); },
      showTabBar() {}, hideTabBar() {},
      ...(withoutSheet ? {} : { showActionSheet(options: Record<string, any>) { sheets.push(options); } })
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>, done?: () => void) { Object.assign(this.data, patch); done?.(); };
  const open = () => {
    assert.equal(typeof page!.openCenterOptions, 'function', 'the new menu must be available in CENTER');
    page!.openCenterOptions();
    return sheets.at(-1);
  };
  return { page, storage, reads, routes, scrolls, sheets, open };
}

test('compact and card layouts retain the same collection, filters, approval state and paging without API reload', async () => {
  const h = mount(); await h.page.onShow(); await h.page.openNotificationCenter();
  assert.equal(h.page.data.centerLayout, 'CARDS');
  h.page.setFilter({ currentTarget: { dataset: { filter: 'ACTIVITY' } } });
  h.page.data.approvingId = 'reg-1';
  const retained = { items: h.page.data.items, centerItems: h.page.data.centerItems, approvals: h.page.data.approvals,
    filter: h.page.data.filter, snapshot: h.page.data.snapshot, approvalSnapshot: h.page.data.approvalSnapshot,
    nextOffset: h.page.data.nextOffset, approvingId: h.page.data.approvingId };
  const readCount = h.reads.length;
  h.open()!.success({ tapIndex: 0 }); assert.equal(h.page.data.centerLayout, 'COMPACT');
  h.open()!.success({ tapIndex: 0 }); assert.equal(h.page.data.centerLayout, 'CARDS');
  for (const [key, value] of Object.entries(retained)) assert.equal(h.page.data[key], value, key);
  assert.equal(h.reads.length, readCount);
  assert.deepEqual(JSON.parse(JSON.stringify(h.scrolls.at(-1))), { scrollTop: 0, duration: 0 });
});

test('compact activity badge counts only loaded actual activity unread records instead of server total', async () => {
  const h = mount(); await h.page.onShow();
  assert.equal(h.page.data.unreadTotal, 100);
  assert.equal(h.page.data.loadedActivityUnreadCount, 2);
  h.page.setFilter({ currentTarget: { dataset: { filter: 'SYSTEM' } } });
  assert.equal(h.page.data.loadedActivityUnreadCount, 2, 'the loaded activity scope is independent of current filter');
});

test('both layouts keep the original guarded notification-settings destination', async () => {
  const h = mount(); await h.page.onShow(); await h.page.openNotificationCenter();
  h.open()!.success({ tapIndex: 0 }); h.open()!.success({ tapIndex: 1 });
  assert.equal(h.storage.irlProfileFocusIntent, 'notificationSettingsSection');
  assert.deepEqual(h.routes, ['/pages/me/me']);
});

test('account or session rotation makes a pending center menu unable to switch layout or send settings intent', async () => {
  for (const key of ['userId', 'sessionToken']) for (const tapIndex of [0, 1]) {
    const h = mount(); await h.page.onShow(); await h.page.openNotificationCenter();
    const menu = h.open()!; h.storage[key] = 'new-value'; menu.success({ tapIndex });
    assert.equal(h.page.data.centerLayout, 'CARDS'); assert.deepEqual(h.routes, []);
    assert.equal(h.storage.irlProfileFocusIntent, undefined);
  }
});

test('hide, refresh, a mode round trip and a newer menu invalidate old center menu callbacks', async () => {
  for (const change of ['hide', 'refresh', 'inbox-roundtrip', 'chat-roundtrip', 'new-menu']) {
    const h = mount(); await h.page.onShow(); await h.page.openNotificationCenter(); const menu = h.open()!;
    if (change === 'hide') h.page.onHide();
    if (change === 'refresh') await h.page.refresh();
    if (change === 'inbox-roundtrip') { h.page.backToInbox(); await h.page.openNotificationCenter(); }
    if (change === 'chat-roundtrip') { h.page.openPrivateChatPreview(); await h.page.openNotificationCenter(); }
    if (change === 'new-menu') h.open();
    menu.success({ tapIndex: 0 }); assert.equal(h.page.data.centerLayout, 'CARDS', change);
    menu.success({ tapIndex: 1 }); assert.deepEqual(h.routes, [], change);
  }
});

test('center entry and identity reset return to default cards and clear the loaded activity count', async () => {
  const h = mount(); await h.page.onShow(); await h.page.openNotificationCenter();
  h.open()!.success({ tapIndex: 0 }); h.page.backToInbox(); await h.page.openNotificationCenter();
  assert.equal(h.page.data.centerLayout, 'CARDS');
  h.open()!.success({ tapIndex: 0 }); h.storage.sessionToken = 'rotated'; h.page.clearPrivateAfterIdentityChange();
  assert.equal(h.page.data.centerLayout, 'CARDS'); assert.equal(h.page.data.loadedActivityUnreadCount, 0);
  assert.equal(h.page.data.items.length, 0);
});

test('invalid selections, noncenter mode, unsupported platform and anonymous identity stay closed safely', async () => {
  const h = mount(); await h.page.onShow(); assert.equal(h.sheets.length, 0); h.open(); assert.equal(h.sheets.length, 0);
  await h.page.openNotificationCenter();
  for (const tapIndex of [-1, 2, '0', undefined]) h.open()!.success({ tapIndex });
  assert.equal(h.page.data.centerLayout, 'CARDS'); assert.deepEqual(h.routes, []);
  const unsupported = mount(false, true); await unsupported.page.onShow(); await unsupported.page.openNotificationCenter();
  assert.doesNotThrow(() => unsupported.open()); assert.equal(unsupported.page.data.centerLayout, 'CARDS');
  const anonymous = mount(true); await anonymous.page.onShow(); await anonymous.page.openNotificationCenter();
  anonymous.open()!.success({ tapIndex: 0 }); assert.equal(anonymous.page.data.centerLayout, 'COMPACT');
  assert.equal(anonymous.page.data.loadState, 'UNAUTHENTICATED'); assert.equal(anonymous.page.data.items.length, 0);
  assert.deepEqual(anonymous.reads, []);
});
