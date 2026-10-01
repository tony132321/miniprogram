import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function loadPublishedCopyShortcut() {
  let page: Record<string, any> | undefined;
  const routes: string[] = [];
  const posts: string[] = [];
  let actor = 'host';
  let session = '';
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post(url: string) { posts.push(url); } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) {
        return key === 'sessionToken' ? session : key === 'userId' || key === 'devUser' ? actor : '';
      },
      navigateTo(options: { url: string }) { routes.push(options.url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.data.id = 'event-1';
  page.data.isHost = true;
  page.data.currentUser = 'host';
  page.data.safetyStatus = 'OPEN';
  page.data.event = { id: 'event-1', hostId: 'host', version: 4, status: 'RECRUITING', reviewStatus: 'APPROVED',
    recruiting: true, riskPaused: false, inviteToken: 'A'.repeat(32),
    payload: { title: '周六羽毛球局', registrationDeadline: '2027-03-22T05:30:00.000Z' } };
  return { page, routes, posts, setActor(next: string) { actor = next; },
    setSession(next: string) { session = next; } };
}

test('approved publication copy shortcut opens the same invite card with one-tap copy intent', () => {
  const { page, routes } = loadPublishedCopyShortcut();
  page.openShareCard({ currentTarget: { dataset: { copy: true } } });
  assert.deepEqual(routes, ['/subpackages/activity/share/share?id=event-1&copy=1']);
});

test('published copy shortcut checks the deadline even when recruiting has not been closed', () => {
  const { page, routes } = loadPublishedCopyShortcut();
  page.data.event.payload.registrationDeadline = new Date(Date.now() - 1000).toISOString();
  page.openShareCard({ currentTarget: { dataset: { copy: true } } });
  assert.deepEqual(routes, ['/subpackages/activity/share/share?id=event-1']);
  assert.equal(page.data.canCopyPublishedInvite, false);
});

test('activity native share does not send a token after deadline or safety closure', () => {
  const { page } = loadPublishedCopyShortcut();
  page.data.shareSourceToken = 'source-1';
  assert.equal(page.onShareAppMessage().path,
    `/pages/event/event?token=${'A'.repeat(32)}&source=source-1`);

  page.data.event.payload.registrationDeadline = new Date(Date.now() - 1000).toISOString();
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');

  page.data.event.payload.registrationDeadline = '2027-03-22T05:30:00.000Z';
  page.data.safetyStatus = 'CLOSED';
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');
});

test('activity native share drops the old host token immediately after account or event switches', () => {
  const { page, setActor, setSession } = loadPublishedCopyShortcut();
  page.data.shareSourceToken = 'source-1';
  assert.match(page.onShareAppMessage().path, /token=A{32}/);

  setActor('another-member');
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');
  setActor('host');
  setSession('new-session');
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');
  setSession('');
  page.data.id = 'different-event';
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');
});

test('stale host state cannot open an old share card or prepare another share intent', async () => {
  const { page, routes, posts, setActor } = loadPublishedCopyShortcut();
  setActor('another-member');
  page.openShareCard({ currentTarget: { dataset: { copy: true } } });
  await page.prepareShare();
  assert.deepEqual(routes, []);
  assert.deepEqual(posts, []);
  assert.equal(page.data.shareSourceToken, '');
});

test('cached host state cannot share an event whose current host ID belongs to someone else', async () => {
  const { page, routes, posts } = loadPublishedCopyShortcut();
  page.data.shareSourceToken = 'source-1';
  page.data.event.hostId = 'another-host';
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');
  page.openShareCard({ currentTarget: { dataset: { copy: true } } });
  await page.prepareShare();
  assert.deepEqual(routes, []);
  assert.deepEqual(posts, []);
});
