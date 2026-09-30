import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

type EventRow = { id: string; title: string; status: string; isHost: boolean; myRegistrationStatus: string | null };

function loadMoments(responses: Array<Promise<{ items: EventRow[] }> | { items: EventRow[] }>) {
  let page: Record<string, any> | undefined;
  let sessionToken = 'first-session';
  const navigations: string[] = [];
  let markFirstRequestStarted: (() => void) | undefined;
  const firstRequestStarted = new Promise<void>(resolve => { markFirstRequestStarted = resolve; });
  let requestCount = 0;
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/profile/moments/moments.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../../utils/api.js') return { api: { get(url: string) {
        assert.equal(url, '/me/events');
        if (++requestCount === 1) markFirstRequestStarted?.();
        const response = responses.shift();
        assert.ok(response, 'every request has a fixture');
        return response;
      } } };
      if (path === '../../../config.js') return { developmentUser: '' };
      if (path === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return key === 'sessionToken' ? sessionToken : key === 'userId' ? 'same-member' : ''; },
      navigateTo({ url }: { url: string }) { navigations.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, navigations, firstRequestStarted, rotateSession(token: string) { sessionToken = token; } };
}

const oldEvent: EventRow = { id: 'old-event', title: '旧会话活动', status: 'COMPLETED', isHost: true, myRegistrationStatus: null };
const newEvent: EventRow = { id: 'new-event', title: '新会话活动', status: 'CONFIRMED', isHost: false, myRegistrationStatus: 'CONFIRMED' };

test('delayed activity records from a previous session cannot replace records after the same member signs in again', async () => {
  let releaseOld: ((value: { items: EventRow[] }) => void) | undefined;
  const oldResponse = new Promise<{ items: EventRow[] }>(resolve => { releaseOld = resolve; });
  const { page, rotateSession, firstRequestStarted } = loadMoments([oldResponse, { items: [newEvent] }]);
  const loadingOld = page.onShow();
  await firstRequestStarted;
  assert.ok(releaseOld);
  rotateSession('second-session');
  releaseOld({ items: [oldEvent] });
  await loadingOld;
  assert.equal(page.data.events.length, 0, 'the old request must not paint a card into the new session');

  await page.onShow();
  assert.equal(page.data.loadState, 'READY');
  assert.deepEqual(page.data.visibleEvents.map((item: EventRow) => item.id), ['new-event']);
});

test('an activity card loaded by an earlier session cannot navigate after token rotation', async () => {
  const { page, navigations, rotateSession } = loadMoments([{ items: [oldEvent] }]);
  await page.onShow();
  assert.deepEqual(page.data.visibleEvents.map((item: EventRow) => item.id), ['old-event']);
  rotateSession('second-session');
  page.openActivity({ currentTarget: { dataset: { id: 'old-event' } } });
  assert.deepEqual(navigations, []);
});
