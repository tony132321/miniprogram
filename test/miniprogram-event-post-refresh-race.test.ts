import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const eventA = { id: 'event-a', hostId: 'host', version: 3, status: 'RECRUITING',
  reviewStatus: 'APPROVED', recruiting: true, riskPaused: false,
  inviteToken: 'A'.repeat(32), inviteRemainingMs: 60_000,
  payload: { title: '活动 A', visibility: 'INVITE', feeMode: 'FREE',
    registrationDeadline: '2027-03-22T05:30:00.000Z', startAt: '2027-03-22T11:00:00Z',
    endAt: '2027-03-22T13:00:00Z' } };
const eventB = { ...eventA, id: 'event-b', inviteToken: 'B'.repeat(32),
  payload: { ...eventA.payload, title: '活动 B' } };

function mount(options: {
  get?: (path: string) => Promise<unknown>;
  post?: (path: string) => Promise<unknown>;
} = {}) {
  let page: Record<string, any> | undefined;
  let token = 'token-a';
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(module: string) {
      if (module === '../../utils/api.js') return { api: {
        get: options.get || (async () => ({ items: [] })),
        post: options.post || (async () => ({}))
      } };
      if (module === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (module === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${module}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'sessionToken' ? token : key === 'userId' ? 'host' : ''; },
      navigateTo({ url }: { url: string }) { routes.push(url); }
    },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  page.setData({ id: eventA.id, event: eventA, isHost: true, loadState: 'READY',
    safetyStatus: 'OPEN', currentUser: 'session:host:token-a', message: '活动 A',
    preparingShare: false });
  page._inviteValidUntil = Date.now() + 60_000;
  return { page, routes, switchSession() { token = 'token-b'; }, showEventB() {
    page!.setData({ id: eventB.id, event: eventB, isHost: true, loadState: 'READY',
      currentUser: `session:host:${token}`, message: '活动 B', preparingShare: false });
    page!._inviteValidUntil = Date.now() + 60_000;
  } };
}

function heldRefresh() {
  const entered = deferred<void>();
  const release = deferred<unknown>();
  return { entered, release, get: async (path: string) => {
    if (path === '/me/registrations?eventId=event-a') {
      entered.resolve();
      return release.promise;
    }
    if (path === '/events/event-a') return eventA;
    if (path === '/system/safety') return { status: 'OPEN' };
    return { items: [] };
  } };
}

test('a reservation result cannot put A seat tokens on B after the real refresh loses its owner', async () => {
  const refresh = heldRefresh();
  const { page, switchSession, showEventB } = mount({ get: refresh.get,
    post: async () => ({ tokens: ['seat-from-a'] }) });
  const reserving = page.reserve();
  await refresh.entered.promise;
  switchSession();
  showEventB();
  page.setData({ reservationTokens: ['seat-from-b'] });
  refresh.release.resolve({ items: [] });

  await reserving;
  assert.deepEqual(page.data.reservationTokens, ['seat-from-b']);
  assert.equal(page.data.message, '活动 B');
});

test('a repeat result cannot navigate to A draft after its real refresh loses the activity', async () => {
  const refresh = heldRefresh();
  const { page, routes, switchSession, showEventB } = mount({ get: refresh.get,
    post: async () => ({ id: 'draft-from-a' }) });
  page.setData({ event: { ...eventA, status: 'COMPLETED' } });
  const repeating = page.repeat();
  await refresh.entered.promise;
  switchSession();
  showEventB();
  refresh.release.resolve({ items: [] });

  await repeating;
  assert.deepEqual(routes, []);
  assert.equal(page.data.message, '活动 B');
});

test('rejected A share intent cannot clear B activity intent or overwrite its message', async () => {
  const first = deferred<unknown>();
  const second = deferred<unknown>();
  const { page, showEventB } = mount({ post: path => path.includes('/event-a/') ? first.promise : second.promise });
  const preparingA = page.prepareShare();
  showEventB();
  const preparingB = page.prepareShare();
  assert.equal(page.data.preparingShare, true);

  first.reject(new Error('活动 A 的服务错误'));
  await preparingA;
  assert.equal(page.data.preparingShare, true);
  assert.equal(page.data.message, '活动 B');

  second.resolve({});
  await preparingB;
  assert.equal(page.data.preparingShare, false);
  assert.match(page.data.message, /分享卡已准备好/);
  assert.ok(page.data.shareSourceToken);
});

test('rejected A share intent cannot write feedback into a new session for the same activity', async () => {
  const first = deferred<unknown>();
  const { page, switchSession } = mount({ post: () => first.promise });
  const preparing = page.prepareShare();
  switchSession();
  page.setData({ currentUser: 'session:host:token-b', preparingShare: true, message: '新账号正在加载' });

  first.reject(new Error('旧账号服务错误'));
  await preparing;
  assert.equal(page.data.preparingShare, true);
  assert.equal(page.data.message, '新账号正在加载');
});
