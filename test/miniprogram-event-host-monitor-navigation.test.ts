import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/subpackages/activity/event/event.js', import.meta.url), 'utf8');
const eventFixture = () => ({ id: 'monitor-event', hostId: 'host', version: 7, status: 'RECRUITING',
  reviewStatus: 'APPROVED', recruiting: true, riskPaused: false,
  payload: { title: '真实羽毛球活动', type: 'badminton', visibility: 'INVITE', feeMode: 'FREE', city: '上海',
    venueName: '真实场馆', venueStatus: 'HOST_CONFIRMED', startAt: '2027-03-22T11:00:00Z',
    endAt: '2027-03-22T13:00:00Z', registrationDeadline: '2027-03-22T10:00:00Z', minParticipants: 4, maxParticipants: 8 },
  stats: { confirmed: 6, reserved: 1, requested: 2, waitlisted: 3, reconfirmRequired: 0 } });

function mount() {
  const state = { actor: 'host', token: '', event: eventFixture(), error: false };
  let page: Record<string, any> | undefined;
  let sheet: Record<string, any> | undefined;
  const posts: string[] = [], routes: string[] = [], clips: string[] = [], scrolls: any[] = [];
  const app = { globalData: { ready: Promise.resolve(), reportContext: undefined as unknown } };
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../../utils/api.js') return { api: {
        async get(path: string) {
          if (path.startsWith('/me/registrations?')) return { items: [] };
          if (path === '/events/monitor-event') {
            if (state.error) throw new Error('当前活动不可读取');
            return JSON.parse(JSON.stringify(state.event));
          }
          if (path === '/system/safety') return { status: 'OPEN' };
          if (path.endsWith('/aliases')) return { items: [], notice: { version: 'alias-v1', text: '本场自愿昵称' } };
          if (path.endsWith('/registrations')) return { items: [{ id: 'confirmed-one', event_id: 'monitor-event',
            user_id: 'member', status: 'CONFIRMED' }] };
          if (path.endsWith('/share-metrics')) return { shareIntents: 1, attributedOpens: 0, unknownSourceOpens: 0 };
          return { items: [] };
        },
        async post(path: string) { posts.push(path); return {}; }
      } };
      if (path === '../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(value: Record<string, any>) { page = value; },
    getApp() { return app; },
    wx: {
      getStorageSync(key: string) { return key === 'sessionToken' ? state.token :
        key === 'userId' || key === 'devUser' ? state.actor : ''; },
      getSystemInfoSync() { return { statusBarHeight: 20, windowWidth: 390 }; },
      nextTick(callback: () => void) { callback(); },
      showActionSheet(value: Record<string, any>) { sheet = value; },
      pageScrollTo(value: any) { scrolls.push(value); },
      switchTab({ url }: { url: string }) { routes.push(url); },
      navigateTo({ url }: { url: string }) { routes.push(url); },
      navigateBack() { routes.push('back'); },
      setClipboardData({ data, success }: { data: string; success?: () => void }) { clips.push(data); success?.(); }
    },
    setTimeout() { return { unref() {} }; }, clearTimeout() {}
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>, callback?: () => void) { Object.assign(this.data, patch); callback?.(); };
  page.setData({ id: 'monitor-event' });
  return { page, state, posts, routes, clips, scrolls, app,
    sheet() { assert.ok(sheet); return sheet; },
    async ready() { assert.equal(await page!.refresh(), true); } };
}
const jump = (page: any) => page.jumpToSection({ currentTarget: { dataset: { section: 'hostMonitorSection' } } });

// Break: permitted navigation is missing, back loses the workbench, or statistics are inferred incorrectly.
test('Wave71 host monitor permitted menu preserves the current event and returns to its workbench', async () => {
  const m = mount(); await m.ready(); const before = m.page.data.event;
  m.page.openEventActions();
  assert.equal(m.sheet().itemList.length, 3);
  m.sheet().success({ tapIndex: 2 });
  assert.equal(m.page.data.activeSection, 'hostMonitorSection');
  assert.equal(m.page.data.event, before);
  assert.equal(m.page.data.id, 'monitor-event');
  assert.equal(m.page.data.hostMonitorMetrics.occupancyPercent, 75);
  assert.equal(m.page.data.hostMonitorMetrics.missing, 0);
  assert.equal(m.page.data.hostMonitorMetrics.reserved, 1);
  assert.equal(m.page.data.hostMonitorMetrics.waitlisted, 3);
  m.page.goBack();
  assert.equal(m.page.data.activeSection, 'hostSection');
  assert.equal(m.page.data.event, before);
  assert.equal(m.routes.length, 0); assert.equal(m.posts.length, 0);
});

// Break: boolean isHost alone or collaboration privileges open a private monitor.
test('Wave71 host monitor rejects nonhosts and incomplete current host contexts', async () => {
  for (const patch of [
    { isHost: false, canApproveRegistration: true, canManageAnnouncements: true, canManageCheckins: true },
    { loadState: 'LOADING' }, { loadState: 'ERROR' }, { currentUser: '' },
    { currentUser: 'other' }, { id: 'another-event' }
  ]) {
    const m = mount(); await m.ready(); m.page.setData(patch);
    m.page.openEventActions(); assert.equal(m.sheet().itemList.length, 2);
    jump(m.page); m.page.scrollToSection('hostMonitorSection');
    assert.equal(m.page.data.activeSection, 'detailsSection');
    assert.equal(m.posts.length, 0);
  }
  const m = mount(); await m.ready(); m.page.data.event.hostId = 'other';
  m.page.openEventActions(); assert.equal(m.sheet().itemList.length, 2);
  jump(m.page); assert.equal(m.page.data.activeSection, 'detailsSection');
});

// Break: direct section URL does not apply the same host/event/identity gates as the menu.
test('Wave71 host monitor direct links validate the loaded event and actor', async () => {
  const host = mount(); await host.page.onLoad({ id: 'monitor-event', section: 'hostMonitorSection' });
  assert.equal(host.page.data.activeSection, 'hostMonitorSection');
  for (const actor of ['member', 'cohost', 'visitor']) {
    const m = mount(); m.state.actor = actor;
    await m.page.onLoad({ id: 'monitor-event', section: 'hostMonitorSection' });
    assert.equal(m.page.data.activeSection, 'detailsSection');
  }
  const wrong = mount(); wrong.state.event.id = 'another-event';
  await wrong.page.onLoad({ id: 'monitor-event', section: 'hostMonitorSection' });
  assert.notEqual(wrong.page.data.activeSection, 'hostMonitorSection');
});

// Break: an old native menu callback can route a newer actor/event/version/refresh to the private screen.
test('Wave71 host monitor discards stale callbacks for every existing context guard and revoked host role', async () => {
  const changes = [
    (m: ReturnType<typeof mount>) => { m.state.actor = 'member'; },
    (m: ReturnType<typeof mount>) => { m.state.token = 'new-session'; },
    (m: ReturnType<typeof mount>) => { m.page.data.id = 'another-event'; },
    (m: ReturnType<typeof mount>) => { m.page.data.event = { ...m.page.data.event }; },
    (m: ReturnType<typeof mount>) => { m.page.data.event.version++; },
    (m: ReturnType<typeof mount>) => { m.page.data.currentUser = 'other'; },
    (m: ReturnType<typeof mount>) => { m.page.data.loadState = 'LOADING'; },
    (m: ReturnType<typeof mount>) => { m.page.refreshId++; },
    (m: ReturnType<typeof mount>) => { m.page.data.isHost = false; },
    (m: ReturnType<typeof mount>) => { m.page.data.event.hostId = 'other'; }
  ];
  for (const change of changes) {
    const m = mount(); await m.ready(); m.page.openEventActions();
    assert.equal(m.sheet().itemList.length, 3); change(m); m.sheet().success({ tapIndex: 2 });
    assert.equal(m.page.data.activeSection, 'detailsSection'); assert.equal(m.posts.length, 0);
  }
});

// Break: refreshing a lost host role or changing account retains a private section/statistics.
test('Wave71 host monitor clears private projection after refresh or account role changes', async () => {
  const lost = mount(); await lost.ready(); jump(lost.page);
  assert.equal(lost.page.data.activeSection, 'hostMonitorSection'); lost.state.event.hostId = 'other';
  assert.equal(await lost.page.refresh(), true);
  assert.equal(lost.page.data.activeSection, 'detailsSection'); assert.equal(lost.page.data.hostMonitorMetrics, null);
  const account = mount(); await account.ready(); jump(account.page); account.page.hasShown = true;
  account.state.actor = 'member'; await account.page.onShow();
  assert.equal(account.page.data.activeSection, 'detailsSection'); assert.equal(account.page.data.hostMonitorMetrics, null);
  const failed = mount(); await failed.ready(); jump(failed.page); failed.state.error = true;
  assert.equal(await failed.page.refresh(), false); assert.equal(failed.page.data.hostMonitorMetrics, null);
  assert.equal(failed.page.data.loadState, 'ERROR');
  const unknown = mount(); (unknown.state.event as any).stats = null; await unknown.ready(); jump(unknown.page);
  assert.equal(unknown.page.data.hostMonitorMetrics, null, 'unknown count must not become zero/full-ready');
});

// Break: adding one menu item changes old report/copy semantics or ordinary back navigation.
test('Wave71 host monitor keeps old safety menu actions and normal workbench back behavior', async () => {
  const report = mount(); await report.ready(); report.page.openEventActions(); report.sheet().success({ tapIndex: 0 });
  assert.equal(report.routes.at(-1), '/pages/me/me');
  const copy = mount(); await copy.ready(); copy.page.openEventActions(); copy.sheet().success({ tapIndex: 1 });
  assert.equal(copy.clips.length, 1); assert.ok(copy.clips[0]?.includes('真实羽毛球活动'));
  assert.equal(copy.routes.length, 0);
  copy.page.scrollToSection('hostSection'); copy.page.goBack(); assert.equal(copy.page.data.activeSection, 'detailsSection');
  assert.equal(copy.posts.length, 0);
});
