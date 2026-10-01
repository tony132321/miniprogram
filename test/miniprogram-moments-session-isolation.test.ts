import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

type EventRow = { id: string; title: string; status: string; isHost: boolean; myRegistrationStatus: string | null;
  reviewStatus?: string; recruiting?: boolean };

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

test('moments labels pending host and draft cards by review state and keeps details reachable', async () => {
  const pending: EventRow = { id: 'awaiting-review', title: '本人待审羽毛球',
    status: 'RECRUITING', reviewStatus: 'PENDING', recruiting: false,
    isHost: true, myRegistrationStatus: null };
  const draft: EventRow = { id: 'private-draft', title: '本人草稿',
    status: 'DRAFT', isHost: true, myRegistrationStatus: null };
  const { page, navigations } = loadMoments([{ items: [pending, draft] }]);
  await page.onShow();
  assert.deepEqual(Array.from(page.data.visibleEvents, (item: EventRow) => item.id),
    ['awaiting-review', 'private-draft']);
  assert.equal(page.data.visibleEvents[0].statusLabel, '待审核');
  assert.equal(page.data.visibleEvents[1].statusLabel, '草稿');
  page.openActivity({ currentTarget: { dataset: { id: 'awaiting-review' } } });
  page.openActivity({ currentTarget: { dataset: { id: 'private-draft' } } });
  assert.deepEqual(navigations, ['/pages/event/event?id=awaiting-review',
    '/pages/event/event?id=private-draft']);
});
