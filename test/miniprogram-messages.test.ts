import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../miniprogram/pages/messages/messages.js', import.meta.url), 'utf8');
function mount(api: object, wx: object) {
  let page: Record<string, any> | undefined;
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return page;
}

test('messages reads only the current member notification route and clears old account data', async () => {
  let actor = 'a';
  const paths: string[] = [];
  const page = mount({
    async get(path: string) {
      paths.push(path);
      return { items: [{ id: actor, kind: 'EVENT_REMINDER', status: 'PENDING', event_id: 'event-1' }],
        total: 1, nextOffset: null };
    }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : actor; } });
  await page.onShow();
  assert.equal(page.data.items[0].id, 'a');
  actor = 'b';
  await page.onShow();
  assert.equal(page.data.items[0].id, 'b');
  assert.deepEqual(paths, ['/me/notifications?offset=0', '/me/notifications?offset=0']);
  const wxml = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /私聊功能尚未开放/);
});

test('message detail marks a notice opened only after event navigation succeeds', async () => {
  const order: string[] = [];
  let failNavigation = true;
  const page = mount({
    async post(path: string) { order.push(path); }
  }, {
    navigateTo(options: Record<string, any>) {
      order.push(options.url);
      if (failNavigation) options.fail({ errMsg: 'cannot open' });
      else options.success();
    }
  });
  page.data.items = [{ id: 'notice', kind: 'EVENT_REMINDER', event_id: 'event-1' }];
  const event = { currentTarget: { dataset: { id: 'notice', eventId: 'event-1', kind: 'EVENT_REMINDER' } } };
  await page.openNotice(event);
  assert.deepEqual(order, ['/pages/event/event?id=event-1']);
  failNavigation = false;
  await page.openNotice(event);
  assert.deepEqual(order, ['/pages/event/event?id=event-1', '/pages/event/event?id=event-1',
    '/me/notifications/notice/open']);
});

test('late notification response from another account cannot replace current messages', async () => {
  let actor = 'a';
  let releaseOld!: (value: object) => void;
  const oldResponse = new Promise<object>(resolve => { releaseOld = resolve; });
  let reads = 0;
  const page = mount({
    get() {
      reads++;
      return reads === 1 ? oldResponse : Promise.resolve({ items: [{ id: 'b' }], total: 1 });
    }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : actor; } });
  const previous = page.onShow();
  await Promise.resolve();
  actor = 'b';
  await page.onShow();
  releaseOld({ items: [{ id: 'a' }], total: 1 });
  await previous;
  assert.equal(page.data.items[0].id, 'b');
});

test('a refresh response cannot render old-account notices when storage changes before onShow', async () => {
  let actor = 'first';
  let resolveOld!: (value: object) => void;
  let signalStarted!: () => void;
  const oldResponse = new Promise<object>(resolve => { resolveOld = resolve; });
  const started = new Promise<void>(resolve => { signalStarted = resolve; });
  const page = mount({
    get() { signalStarted(); return oldResponse; }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : actor; } });
  const pending = page.onShow();
  await started;
  actor = 'second';
  resolveOld({ items: [{ id: 'first-notice', kind: 'EVENT_REMINDER', event_id: 'first-event' }],
    total: 1, unreadTotal: 1, nextOffset: null });
  await pending;
  assert.deepEqual(Array.from(page.data.items), []);
  assert.notEqual(page.data.loadState, 'READY');
});

test('an old-account material-change card cannot open or mark a notice after identity changes', async () => {
  let actor = 'first';
  const actions: string[] = [];
  const page = mount({
    async get() { return { items: [{ id: 'notice-' + actor, kind: 'MATERIAL_CHANGE',
      event_id: 'event-' + actor, status: 'IN_APP' }], total: 1, nextOffset: null }; },
    async post(path: string) { actions.push(path); }
  }, {
    getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : actor; },
    navigateTo(options: { url: string; success: () => void }) { actions.push(options.url); options.success(); }
  });
  await page.onShow();
  const oldCard = { currentTarget: { dataset: {
    id: 'notice-first', eventId: 'event-first', kind: 'MATERIAL_CHANGE'
  } } };
  actor = 'second';
  await page.openNotice(oldCard);
  assert.deepEqual(actions, []);
  await page.onShow();
  await page.openNotice(oldCard);
  assert.deepEqual(actions, []);
  await page.openNotice({ currentTarget: { dataset: {
    id: 'notice-second', eventId: 'event-second', kind: 'MATERIAL_CHANGE'
  } } });
  assert.deepEqual(actions, ['/pages/event/event?id=event-second&section=registrationSection',
    '/me/notifications/notice-second/open']);
});

test('material-change navigation finishing after an account switch does not mark the old notice read', async () => {
  let actor = 'first';
  let finishNavigation!: () => void;
  const actions: string[] = [];
  const page = mount({
    async get() { return { items: [{ id: 'old', kind: 'MATERIAL_CHANGE', event_id: 'event-first' }],
      total: 1, nextOffset: null }; },
    async post(path: string) { actions.push(path); }
  }, {
    getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : actor; },
    navigateTo(options: { url: string; success: () => void }) {
      actions.push(options.url);
      finishNavigation = options.success;
    }
  });
  await page.onShow();
  const pending = page.openNotice({ currentTarget: { dataset: {
    id: 'old', eventId: 'event-first', kind: 'MATERIAL_CHANGE'
  } } });
  actor = 'second';
  finishNavigation();
  await pending;
  assert.deepEqual(actions, ['/pages/event/event?id=event-first&section=registrationSection']);
});

test('ordinary event and profile notices reject old-account cards and mismatched current-card data', async () => {
  let actor = 'first';
  const actions: string[] = [];
  const page = mount({
    async get() { return { items: [
      { id: 'shared', kind: 'EVENT_REMINDER', event_id: 'event-' + actor },
      { id: 'profile-' + actor, kind: 'REPORT_RESOLVED_UNSCOPED', event_id: null }
    ], total: 2, nextOffset: null }; },
    async post(path: string) { actions.push(path); }
  }, {
    getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : actor; },
    navigateTo(options: { url: string; success: () => void }) { actions.push(options.url); options.success(); },
    switchTab(options: { url: string; success: () => void }) { actions.push(options.url); options.success(); },
    setStorageSync() {}
  });
  await page.onShow();
  actor = 'second';
  await page.onShow();
  for (const dataset of [
    { id: 'shared', kind: 'EVENT_REMINDER', eventId: 'event-first' },
    { id: 'profile-first', kind: 'REPORT_RESOLVED_UNSCOPED', eventId: '' },
    { id: 'shared', kind: 'EVENT_CONFIRMED', eventId: 'event-second' }
  ]) await page.openNotice({ currentTarget: { dataset } });
  assert.deepEqual(actions, [], 'stale id, kind and event ID cannot navigate or mark a notice opened');
  await page.openNotice({ currentTarget: { dataset: {
    id: 'shared', kind: 'EVENT_REMINDER', eventId: 'event-second'
  } } });
  await page.openNotice({ currentTarget: { dataset: {
    id: 'profile-second', kind: 'REPORT_RESOLVED_UNSCOPED', eventId: ''
  } } });
  assert.deepEqual(actions, ['/pages/event/event?id=event-second', '/me/notifications/shared/open',
    '/pages/me/me', '/me/notifications/profile-second/open']);
});

test('message filters update visible items and action rows use native buttons', async () => {
  const page = mount({
    async get() { return { items: [{ id: 'activity', event_id: 'event-1' }, { id: 'account', event_id: null }],
      total: 2, nextOffset: null }; }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; } });
  await page.onShow();
  assert.deepEqual(Array.from(page.data.items, (item: Record<string, unknown>) => item.visible), [true, true]);
  page.setFilter({ currentTarget: { dataset: { filter: 'ACTIVITY' } } });
  assert.deepEqual(Array.from(page.data.items, (item: Record<string, unknown>) => item.visible), [true, false]);
  page.setFilter({ currentTarget: { dataset: { filter: 'SYSTEM' } } });
  assert.deepEqual(Array.from(page.data.items, (item: Record<string, unknown>) => item.visible), [false, true]);
  const messages = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  const profile = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  assert.match(messages, /<button[^>]*bindtap="setFilter"/);
  assert.match(messages, /<button[^>]*bindtap="openNotice"/);
  assert.match(profile, /<button id="aboutButton"[^>]*bindtap="goAbout"/);
});

test('CAPER inbox groups real notifications without showing their event UUID in a card', async () => {
  const eventId = '123e4567-e89b-12d3-a456-426614174000';
  const page = mount({ async get() { return { items: [
    { id: 'activity', kind: 'EVENT_REMINDER', event_id: eventId, status: 'QUEUED',
      external_status: 'DISPATCHING', created_at: '2026-09-30T09:30:00Z' },
    { id: 'interaction', kind: 'REGISTRATION_APPROVED', event_id: eventId, status: 'OPENED' },
    { id: 'system', kind: 'ACCOUNT_NOTICE', event_id: null, status: 'OPENED' }
  ], total: 3, nextOffset: null }; } }, {
    getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; }
  });
  await page.onShow();
  const groups = Array.from(page.data.noticeGroups, (group: Record<string, any>) => [
    group.key, Array.from(group.items, (item: Record<string, string>) => item.id)
  ]);
  assert.deepEqual(groups, [['INTERACTION', ['interaction']], ['ACTIVITY', ['activity']], ['SYSTEM', ['system']]]);
  assert.ok(page.data.items.every((item: Record<string, string>) => !String(item.summary || '').includes(eventId)));
  assert.equal(page.data.items[0].externalHint, '外部提醒请求处理中');
  const markup = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  assert.match(markup, /wx:for="{{noticeGroups}}"/);
  assert.match(markup, /class="notice-description">{{notice.summary}}/);
  assert.doesNotMatch(markup, /class="notice-description">[^<]*event_id/);
  page.setFilter({ currentTarget: { dataset: { filter: 'SYSTEM' } } });
  assert.equal(page.data.filteredCount, 1);
  assert.deepEqual(Array.from(page.data.noticeGroups[2].items, (item: Record<string, string>) => item.id), ['system']);
});

test('message header reserves the live WeChat menu capsule width', () => {
  const page = mount({}, {
    getSystemInfoSync() { return { statusBarHeight: 47, windowWidth: 375 }; },
    getMenuButtonBoundingClientRect() { return { left: 265 }; }
  });
  page.onLoad();
  assert.equal(page.data.statusBarHeight, 47);
  assert.equal(page.data.capsuleInset, 118);
  const markup = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  assert.match(markup, /class="messages-brand" style="top: {{statusBarHeight}}px; padding-right: {{capsuleInset}}px"/);
});

test('a filter with no matching notices exposes its own empty state without hiding later pages', async () => {
  const page = mount({
    async get() {
      return { items: [{ id: 'account', event_id: null }], total: 2,
        nextOffset: 1, snapshot: 'a'.repeat(32) };
    }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; } });
  await page.onShow();
  page.setFilter({ currentTarget: { dataset: { filter: 'ACTIVITY' } } });
  assert.equal(page.data.filteredCount, 0);
  assert.equal(page.data.nextOffset, 1);
  const wxml = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /filteredCount === 0/);
  assert.match(wxml, /暂无活动相关通知/);
  assert.match(wxml, /nextOffset !== null/);
});

test('loading more updates filtered count and stops fetching at the final page', async () => {
  const paths: string[] = [];
  const page = mount({
    async get(path: string) {
      paths.push(path);
      if (paths.length === 1) return { items: [{ id: 'account', event_id: null }], total: 2,
        nextOffset: 1, snapshot: 'a'.repeat(32) };
      return { items: [{ id: 'activity', event_id: 'event-1' }], total: 2,
        nextOffset: null, snapshot: 'a'.repeat(32) };
    }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; } });
  await page.onShow();
  page.setFilter({ currentTarget: { dataset: { filter: 'ACTIVITY' } } });
  assert.equal(page.data.filteredCount, 0);
  await page.loadMore();
  assert.equal(page.data.filteredCount, 1);
  assert.equal(page.data.nextOffset, null);
  await page.loadMore();
  assert.deepEqual(paths, ['/me/notifications?offset=0',
    `/me/notifications?offset=1&snapshot=${'a'.repeat(32)}`]);
});

test('loading more keeps a pending state and ignores a second tap until the request settles', async () => {
  let releaseMore!: (value: object) => void;
  let reads = 0;
  const page = mount({
    get() {
      reads++;
      if (reads === 1) return Promise.resolve({ items: [{ id: 'account', event_id: null }],
        total: 2, nextOffset: 1, snapshot: 'b'.repeat(32) });
      return new Promise(resolve => { releaseMore = resolve; });
    }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; } });
  await page.onShow();
  const pending = page.loadMore();
  assert.equal(page.data.loadingMore, true);
  assert.equal(page.data.nextOffset, 1);
  await page.loadMore();
  assert.equal(reads, 2);
  releaseMore({ items: [{ id: 'activity', event_id: 'event-1' }], total: 2,
    nextOffset: null, snapshot: 'b'.repeat(32) });
  await pending;
  assert.equal(page.data.loadingMore, false);
  assert.equal(page.data.nextOffset, null);
});

test('load-more cannot append an old-account page before the new account onShow', async () => {
  let actor = 'first';
  let releaseMore!: (value: object) => void;
  const page = mount({
    get(path: string) {
      if (path === '/me/notifications?offset=0') return Promise.resolve({ items: [
        { id: 'first-page', kind: 'EVENT_REMINDER', event_id: 'event-first' }
      ], total: 2, unreadTotal: 2, nextOffset: 1, snapshot: 'a'.repeat(32) });
      return new Promise(resolve => { releaseMore = resolve; });
    }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : actor; } });
  await page.onShow();
  const pending = page.loadMore();
  actor = 'second';
  releaseMore({ items: [{ id: 'second-page-of-first-account', kind: 'EVENT_REMINDER',
    event_id: 'event-first' }], total: 2, unreadTotal: 2, nextOffset: null,
  snapshot: 'a'.repeat(32) });
  await pending;
  assert.deepEqual(Array.from(page.data.items, (item: { id: string }) => item.id), ['first-page']);
  assert.equal(page.data.nextOffset, 1);
});

test('all-read updates the whole inbox through one server action and exposes the Stitch button', async () => {
  const calls: string[] = [];
  let unreadTotal = 3;
  const page = mount({
    async get(path: string) {
      calls.push(path);
      return { items: [{ id: 'notice', kind: 'EVENT_REMINDER', status: unreadTotal ? 'QUEUED' : 'OPENED',
        event_id: 'event-1' }], total: 3, unreadTotal, nextOffset: 1, snapshot: 'a'.repeat(32) };
    },
    async post(path: string) { calls.push(path); unreadTotal = 0; return { opened: 3 }; }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; } });
  await page.onShow();
  assert.equal(page.data.unreadTotal, 3);
  await page.markAllRead();
  assert.equal(page.data.unreadTotal, 0);
  assert.deepEqual(calls, ['/me/notifications?offset=0', '/me/notifications/open-all', '/me/notifications?offset=0']);
  const wxml = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /id="markAllReadButton"[^\n]*bindtap="markAllRead"/);
  assert.match(wxml, /data-section="checkinSection"[^>]*bindtap="openNotice"/);
});

test('all-read rejects a card after switching from session to development identity with the same actor', async () => {
  let sessionToken = 'token';
  const calls: string[] = [];
  const page = mount({
    async get(path: string) { calls.push(path); return { items: [{ id: 'notice', kind: 'EVENT_REMINDER',
      event_id: 'event-1' }], total: 1, unreadTotal: 1, nextOffset: null }; },
    async post(path: string) { calls.push(path); }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? sessionToken : 'member'; } });
  page.data.developmentMode = true;
  await page.onShow();
  sessionToken = '';
  await page.markAllRead();
  assert.deepEqual(calls, ['/me/notifications?offset=0']);
});

test('all-read completion cannot refresh or overwrite state after identity changes during its request', async () => {
  let sessionToken = 'token';
  let finishPost!: () => void;
  const calls: string[] = [];
  const page = mount({
    async get(path: string) { calls.push(path); return { items: [{ id: 'notice', kind: 'EVENT_REMINDER',
      event_id: 'event-1' }], total: 1, unreadTotal: 1, nextOffset: null }; },
    post(path: string) { calls.push(path); return new Promise<void>(resolve => { finishPost = resolve; }); }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? sessionToken : 'member'; } });
  page.data.developmentMode = true;
  await page.onShow();
  const pending = page.markAllRead();
  sessionToken = '';
  finishPost();
  await pending;
  assert.deepEqual(calls, ['/me/notifications?offset=0', '/me/notifications/open-all']);
  assert.equal(page.data.message, '');
});

test('an old all-read completion cannot clear a new identity operation with the same actor name', async () => {
  let sessionToken = 'token';
  const finishPosts: Array<() => void> = [];
  const page = mount({
    async get() { return { items: [{ id: 'notice', kind: 'EVENT_REMINDER', event_id: 'event-1' }],
      total: 1, unreadTotal: 1, nextOffset: null }; },
    post() { return new Promise<void>(resolve => { finishPosts.push(resolve); }); }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? sessionToken : 'member'; } });
  page.data.developmentMode = true;
  await page.onShow();
  const first = page.markAllRead();
  sessionToken = '';
  await page.onShow();
  const second = page.markAllRead();
  assert.equal(page.data.markingAllRead, true);
  const finishFirst = finishPosts[0];
  assert.ok(finishFirst);
  finishFirst();
  await first;
  assert.equal(page.data.markingAllRead, true, 'the earlier identity must not clear the current spinner');
  const finishSecond = finishPosts[1];
  assert.ok(finishSecond);
  finishSecond();
  await second;
  assert.equal(page.data.markingAllRead, false);
});

test('interaction filter reads authorized pending approvals and one tap approves the exact request', async () => {
  const calls: string[] = [];
  let pending = true;
  const page = mount({
    async get(path: string) {
      calls.push(path);
      if (path.startsWith('/me/notifications')) return { items: [], total: 0, unreadTotal: 0, nextOffset: null };
      if (path === '/me/approval-requests?offset=0') return { items: pending ? [{
        registrationId: 'request-1', eventId: 'event-1', eventTitle: '周五桌游局', expectedVersion: 2,
        canApprove: true
      }] : [], total: pending ? 1 : 0, nextOffset: null };
      throw new Error('unexpected GET ' + path);
    },
    async post(path: string, body: object) {
      calls.push(path + ':' + JSON.stringify(body));
      pending = false;
      return { status: 'CONFIRMED' };
    }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'host'; } });
  await page.onShow();
  assert.equal(calls.includes('/me/approval-requests?offset=0'), false);
  await page.setFilter({ currentTarget: { dataset: { filter: 'INTERACTION' } } });
  assert.equal(page.data.approvals[0].registrationId, 'request-1');
  await page.approveRequest({ currentTarget: { dataset: { id: 'request-1', version: 2 } } });
  assert.equal(page.data.approvals.length, 0);
  assert.ok(calls.includes('/registrations/request-1/approve:{"expectedVersion":2}'));
  const wxml = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /data-filter="INTERACTION"[^>]*bindtap="setFilter"/);
  assert.match(wxml, /data-id="{{item.registrationId}}"[^>]*bindtap="approveRequest"/);
});

test('full approval card offers detail but cannot submit approval', async () => {
  const posts: string[] = [];
  const page = mount({
    async get(path: string) {
      if (path.startsWith('/me/notifications')) return { items: [], total: 0, nextOffset: null };
      return { items: [{ registrationId: 'full-request', eventId: 'full-event', expectedVersion: 2,
        canApprove: false }], total: 1, nextOffset: null };
    },
    async post(path: string) { posts.push(path); }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'host'; } });
  await page.onShow();
  await page.setFilter({ currentTarget: { dataset: { filter: 'INTERACTION' } } });
  await page.approveRequest({ currentTarget: { dataset: { id: 'full-request', version: 2 } } });
  assert.deepEqual(posts, []);
  const wxml = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /item\.canApprove/);
  assert.match(wxml, /名额已满，暂不可通过/);
  assert.match(wxml, /bindtap="viewApproval"/);
});

test('approval detail and reminder receipt navigate to the matching event section', async () => {
  const navigations: string[] = [];
  const page = mount({ async post() { return { status: 'OPENED' }; } }, {
    navigateTo(options: Record<string, any>) { navigations.push(options.url); options.success?.(); }
  });
  page.data.items = [{ id: 'reminder', kind: 'EVENT_REMINDER', event_id: 'event/1' }];
  page.viewApproval({ currentTarget: { dataset: { eventId: 'event/1', isHost: true } } });
  page.viewApproval({ currentTarget: { dataset: { eventId: 'event/2', isHost: false } } });
  await page.openNotice({ currentTarget: { dataset: {
    id: 'reminder', eventId: 'event/1', kind: 'EVENT_REMINDER', section: 'checkinSection'
  } } });
  assert.deepEqual(navigations, ['/pages/event/event?id=event%2F1&section=hostSection',
    '/pages/event/event?id=event%2F2&section=cohostApprovalSection',
    '/pages/event/event?id=event%2F1&section=checkinSection']);
});

test('an unscoped safety notice opens its real profile record before it is marked read', async () => {
  const actions: string[] = [];
  const page = mount({ async post(path: string) { actions.push(path); } }, {
    switchTab(options: { url: string; success?: () => void }) { actions.push(options.url); options.success?.(); }
  });
  page.data.items = [{ id: 'report-notice', kind: 'REPORT_RESOLVED_UNSCOPED', event_id: null }];
  await page.openNotice({ currentTarget: { dataset: {
    id: 'report-notice', eventId: '', kind: 'REPORT_RESOLVED_UNSCOPED'
  } } });
  assert.deepEqual(actions, ['/pages/me/me', '/me/notifications/report-notice/open']);
});

test('approval pagination restarts after another reviewer changes the queue', async () => {
  const paths: string[] = [];
  let firstPageReads = 0;
  const page = mount({
    async get(path: string) {
      paths.push(path);
      if (path.startsWith('/me/notifications')) return { items: [], total: 0, nextOffset: null };
      if (path === '/me/approval-requests?offset=0') {
        firstPageReads++;
        return { items: [{ registrationId: firstPageReads === 1 ? 'old' : 'current' }],
          total: firstPageReads === 1 ? 2 : 1, nextOffset: firstPageReads === 1 ? 1 : null,
          snapshot: (firstPageReads === 1 ? 'a' : 'b').repeat(32) };
      }
      throw Object.assign(new Error('审核列表已变化'), { code: 'QUEUE_CHANGED' });
    }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'host'; } });
  await page.onShow();
  await page.setFilter({ currentTarget: { dataset: { filter: 'INTERACTION' } } });
  await page.loadMoreApprovals();
  assert.equal(page.data.approvals[0].registrationId, 'current');
  assert.equal(page.data.approvalNextOffset, null);
  assert.equal(page.data.loadingMoreApprovals, false);
  assert.ok(paths.includes(`/me/approval-requests?offset=1&snapshot=${'a'.repeat(32)}`));
});

test('late approval list response cannot replace a newer request', async () => {
  const resolvePages: Array<(value: object) => void> = [];
  const page = mount({
    get(path: string) {
      assert.equal(path, '/me/approval-requests?offset=0');
      return new Promise(resolve => { resolvePages.push(resolve); });
    }
  }, {});
  const first = page.loadApprovals();
  const second = page.loadApprovals();
  assert.equal(resolvePages.length, 2);
  resolvePages[1]!({ items: [{ registrationId: 'current' }], total: 1, nextOffset: null });
  await second;
  resolvePages[0]!({ items: [{ registrationId: 'stale' }], total: 1, nextOffset: null });
  await first;
  assert.equal(page.data.approvalLoadState, 'READY');
  assert.equal(page.data.approvals[0]?.registrationId, 'current');
});

test('old approval continuation cannot append after the list restarts', async () => {
  let firstPageReads = 0;
  let finishOldPage!: (value: object) => void;
  const page = mount({
    get(path: string) {
      if (path === '/me/approval-requests?offset=0') {
        firstPageReads++;
        return Promise.resolve({ items: [{ registrationId: firstPageReads === 1 ? 'old-first' : 'current' }],
          total: firstPageReads === 1 ? 2 : 1, nextOffset: firstPageReads === 1 ? 1 : null,
          snapshot: (firstPageReads === 1 ? 'a' : 'b').repeat(32) });
      }
      return new Promise(resolve => { finishOldPage = resolve; });
    }
  }, {});
  await page.loadApprovals();
  const oldContinuation = page.loadMoreApprovals();
  await page.loadApprovals();
  finishOldPage({ items: [{ registrationId: 'stale-second' }], total: 2, nextOffset: null });
  await oldContinuation;
  assert.deepEqual(Array.from(page.data.approvals, (item: Record<string, unknown>) => item.registrationId), ['current']);
  assert.equal(page.data.loadingMoreApprovals, false);
});

test('CAPER inbox search filters only loaded real notices and settings opens profile controls', async () => {
  const navigations: string[] = [];
  const page = mount({ async get() { return { items: [
    { id: 'n1', kind: 'EVENT_REMINDER', status: 'QUEUED', event_id: 'badminton-1' },
    { id: 'n2', kind: 'REPORT_RESOLVED', status: 'OPENED', event_id: null }
  ], total: 2, nextOffset: null }; } }, {
    getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'member'; },
    switchTab(options: { url: string }) { navigations.push(options.url); }
  });
  await page.onShow();
  page.toggleSearch();
  assert.equal(page.data.searchOpen, true);
  page.searchInput({ detail: { value: 'badminton-1' } });
  assert.equal(page.data.filteredCount, 1);
  assert.deepEqual(Array.from(page.data.items, (item: Record<string, unknown>) => item.visible), [true, false]);
  page.toggleSearch();
  assert.equal(page.data.filteredCount, 2);
  page.goNotificationSettings();
  assert.deepEqual(navigations, ['/pages/me/me']);
  const wxml = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /bindtap="toggleSearch"/);
  assert.match(wxml, /bindinput="searchInput"/);
  assert.match(wxml, /bindtap="goNotificationSettings"/);
  assert.match(wxml, /私聊功能尚未开放/);
  assert.match(wxml, /AI 助手.*尚未开放/);
});

test('notification center opens the current organizer approval queue and returns to the inbox', async () => {
  const reads: string[] = [];
  const page = mount({
    async get(path: string) {
      reads.push(path);
      if (path === '/me/notifications?offset=0') return { items: [{
        id: 'reminder-1', event_id: 'event-1', kind: 'EVENT_REMINDER', status: 'IN_APP',
        external_status: 'UNAVAILABLE', detail: {}, created_at: '2026-09-30T09:30:00Z'
      }], total: 1, unreadTotal: 1, nextOffset: null, snapshot: 'a'.repeat(32) };
      if (path === '/me/approval-requests?offset=0') return { items: [{
        registrationId: 'registration-1', eventId: 'event-1', eventTitle: '周五桌游局',
        expectedVersion: 2, isHost: true, canApprove: true, createdAt: '2026-09-30T09:30:00Z'
      }], total: 1, nextOffset: null, snapshot: 'b'.repeat(32) };
      throw new Error(`unexpected GET ${path}`);
    }
  }, { getStorageSync(key: string) { return key === 'sessionToken' ? 'token' : 'host'; } });
  await page.onShow();
  assert.equal(page.data.viewMode, 'INBOX');
  await page.openNotificationCenter();
  assert.equal(page.data.viewMode, 'CENTER');
  assert.equal(page.data.approvalTotal, 1);
  assert.match(page.data.approvals[0].timeLabel, /^\d{1,2}月\d{1,2}日 \d{2}:\d{2}$/);
  assert.deepEqual(reads, ['/me/notifications?offset=0', '/me/approval-requests?offset=0']);
  page.setFilter({ currentTarget: { dataset: { filter: 'ACTIVITY' } } });
  assert.equal(page.data.filteredCount, 1);
  page.backToInbox();
  assert.equal(page.data.viewMode, 'INBOX');
  assert.equal(page.data.filter, 'ALL');
});
