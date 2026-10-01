import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const eventSource = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');

function mount(startingActor = 'host', actorAfterTick = startingActor) {
  let page: Record<string, any> | undefined;
  let actor = startingActor;
  const scrolls: Array<Record<string, any>> = [];
  const posts: string[] = [];
  runInNewContext(eventSource, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post(route: string) { posts.push(route); } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? actor : ''; },
      getSystemInfoSync() { return { statusBarHeight: 24 }; },
      nextTick(callback: () => void) { actor = actorAfterTick; callback(); },
      pageScrollTo(options: Record<string, any>) { scrolls.push(options); }
    },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>, callback?: () => void) {
    Object.assign(this.data, patch);
    callback?.();
  };
  page.checkInPageHidden = true;
  return { page, scrolls, posts };
}

function eventFor(endOffsetMs: number, id = 'event-1') {
  const now = Date.now();
  return { id, hostId: 'host', version: 3, status: 'IN_PROGRESS',
    payload: { startAt: new Date(now - 2 * 60 * 60_000).toISOString(),
      endAt: new Date(now + endOffsetMs).toISOString() } };
}

test('outcome reminder opens the existing completion form for the current eligible host without submitting', async () => {
  const { page, scrolls, posts } = mount();
  const currentEvent = eventFor(-60 * 60_000);
  page.refresh = async function () {
    this.setData({ id: currentEvent.id, event: currentEvent, loadState: 'READY', isHost: true,
      currentUser: 'host', safetyStatus: 'OPEN' });
    return true;
  };
  await page.onLoad({ id: 'event-1', section: 'hostSection', entry: 'hostCompletion' });
  assert.equal(page.data.activeSection, 'hostSection');
  assert.equal(scrolls.at(-1)?.selector, '#hostCompletionForm');
  assert.equal(page.data.canCompleteEvent, true);
  assert.deepEqual(posts, []);
});

test('outcome reminder falls back to the host workspace when completion is not yet due', async () => {
  const { page, scrolls, posts } = mount();
  const currentEvent = eventFor(60 * 60_000);
  page.refresh = async function () {
    this.setData({ id: currentEvent.id, event: currentEvent, loadState: 'READY', isHost: true,
      currentUser: 'host', canCompleteEvent: true, safetyStatus: 'OPEN' });
    return true;
  };
  await page.onLoad({ id: 'event-1', section: 'hostSection', entry: 'hostCompletion' });
  assert.equal(page.data.activeSection, 'hostSection');
  assert.equal(scrolls.at(-1)?.scrollTop, 0);
  assert.equal(scrolls.at(-1)?.selector, undefined);
  assert.equal(page.data.canCompleteEvent, false);
  assert.deepEqual(posts, []);
});

test('outcome reminder does not focus another event or a former host session', async () => {
  const wrongEvent = mount();
  const anotherEvent = eventFor(-60 * 60_000, 'event-2');
  wrongEvent.page.refresh = async function () {
    this.setData({ id: anotherEvent.id, event: anotherEvent, loadState: 'READY', isHost: true,
      currentUser: 'host', safetyStatus: 'OPEN' });
    return true;
  };
  await wrongEvent.page.onLoad({ id: 'event-1', section: 'hostSection', entry: 'hostCompletion' });
  assert.equal(wrongEvent.scrolls.at(-1)?.selector, undefined);

  const changedSession = mount('host', 'other-user');
  const currentEvent = eventFor(-60 * 60_000);
  changedSession.page.refresh = async function () {
    this.setData({ id: currentEvent.id, event: currentEvent, loadState: 'READY', isHost: true,
      currentUser: 'host', safetyStatus: 'OPEN' });
    return true;
  };
  await changedSession.page.onLoad({ id: 'event-1', section: 'hostSection', entry: 'hostCompletion' });
  assert.equal(changedSession.scrolls.length, 0);
  assert.deepEqual(changedSession.posts, []);
});
