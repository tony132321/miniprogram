import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const inviteToken = 'A'.repeat(32);
const rotatedInviteToken = 'B'.repeat(32);

function loadShare(overrides: Record<string, any> = {}) {
  let page: Record<string, any> | undefined;
  let actor = 'host';
  let sessionToken = 'session';
  let devUser = '';
  let event = { id: 'event-1', hostId: 'host', version: 4, status: 'RECRUITING',
    reviewStatus: 'APPROVED', recruiting: true, riskPaused: false, inviteToken,
    payload: { title: '周六一起打羽毛球', startAt: '2027-03-22T06:00:00.000Z',
      endAt: '2027-03-22T08:00:00.000Z', city: '上海', venueName: '公共羽毛球馆', minParticipants: 4 },
    stats: { confirmed: 3 }, ...overrides };
  const posts: Array<{ path: string; body: Record<string, any> }> = [];
  const copied: string[] = [];
  const routes: string[] = [];
  const qrPayloads: string[] = [];
  const qrCanvasIds: string[] = [];
  const qrFills: Array<[number, number, number, number]> = [];
  let postGate: Promise<void> | null = null;
  let releasePost: (() => void) | null = null;
  let getGate: Promise<void> | null = null;
  let releaseGet: (() => void) | null = null;
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/activity/share/share.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../../vendor/qrcode.js') return () => ({
        addData(value: string) { qrPayloads.push(value); },
        make() {},
        getModuleCount() { return 21; },
        isDark(row: number, col: number) { return row === col; }
      });
      if (path === '../../../utils/api.js') return { api: {
        async get(url: string) {
          if (url === '/events/event-1') {
            if (getGate) await getGate;
            return event;
          }
          if (url === '/system/safety') return { status: 'OPEN' };
          throw new Error(`unexpected GET ${url}`);
        },
        async post(path: string, body: Record<string, any>) {
          posts.push({ path, body });
          if (postGate) await postGate;
          return { sourceToken: body.sourceToken };
        }
      } };
      if (path === '../../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) {
        return key === 'sessionToken' ? sessionToken : key === 'userId' ? actor : key === 'devUser' ? devUser : '';
      },
      getSystemInfoSync() { return { statusBarHeight: 24, windowWidth: 390 }; },
      getWindowInfo() { return { windowWidth: 390 }; },
      getMenuButtonBoundingClientRect() { return { left: 294 }; },
      nextTick(callback: () => void) { callback(); },
      createCanvasContext(id: string) {
        qrCanvasIds.push(id);
        return {
          setFillStyle() {},
          fillRect(x: number, y: number, width: number, height: number) { qrFills.push([x, y, width, height]); },
          draw() {}
        };
      },
      setClipboardData({ data, success }: { data: string; success: () => void }) { copied.push(data); success(); },
      navigateBack() { routes.push('back'); },
      switchTab({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, posts, copied, routes, qrPayloads, qrCanvasIds, qrFills,
    setActor(next: string) { actor = next; },
    setSession(next: string) { sessionToken = next; },
    setDevUser(next: string) { devUser = next; },
    holdPosts() {
      postGate = new Promise<void>(resolve => { releasePost = resolve; });
      return () => { releasePost?.(); postGate = null; releasePost = null; };
    },
    holdEventGet() {
      getGate = new Promise<void>(resolve => { releaseGet = resolve; });
      return () => { releaseGet?.(); getGate = null; releaseGet = null; };
    },
    setEvent(next: Record<string, any>) { event = { ...event, ...next }; } };
}

test('share card hides the old private invitation immediately when the active account changes', async () => {
  const { page, setActor, copied } = loadShare();
  await page.onLoad({ id: 'event-1' });
  assert.equal(page.data.display.inviteToken, inviteToken);
  setActor('different-account');
  page.openShareSheet();
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.display, null);
  assert.equal(page.data.shareSheetOpen, false);
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');
  page.copyInvite();
  assert.equal(copied.length, 0);
});

test('a renewed session for the same host cannot reuse the old invite card or prepared share', async () => {
  const { page, posts, copied, setSession } = loadShare();
  await page.onLoad({ id: 'event-1' });
  await page.prepareShare();
  assert.equal(posts.length, 1);
  setSession('renewed-session');
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');
  page.openShareSheet();
  page.copyInvite();
  assert.equal(page.data.display, null);
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.shareSheetOpen, false);
  assert.equal(copied.length, 0);
});

test('switching from a signed-in host to a developer host with the same ID clears the invitation', async () => {
  const { page, copied, setSession, setDevUser } = loadShare();
  await page.onLoad({ id: 'event-1' });
  setSession('');
  setDevUser('host');
  page.openShareSheet();
  page.copyInvite();
  assert.equal(page.data.display, null);
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.shareSheetOpen, false);
  assert.equal(copied.length, 0);
});

test('a session change while refreshing removes the old invite from the visible card', async () => {
  const { page, setSession, holdEventGet } = loadShare();
  await page.onLoad({ id: 'event-1' });
  const releaseGet = holdEventGet();
  const pending = page.refresh();
  setSession('renewed-session');
  releaseGet();
  await pending;
  assert.equal(page.data.display, null);
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.loadState, 'ERROR');
});

test('account switch during share-intent request removes the previous invitation', async () => {
  const { page, setActor, holdPosts } = loadShare();
  await page.onLoad({ id: 'event-1' });
  const releasePost = holdPosts();
  const pending = page.prepareShare();
  assert.equal(page.data.preparingShare, true);
  setActor('different-account');
  releasePost();
  await pending;
  assert.equal(page.data.display, null);
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.sourceToken, '');
});

test('approved invitation card draws a QR containing only the current private invite token', async () => {
  const { page, qrPayloads, qrCanvasIds, qrFills, setEvent } = loadShare();
  await page.onLoad({ id: 'event-1' });
  assert.deepEqual(qrPayloads, [inviteToken]);
  assert.deepEqual(qrCanvasIds, ['inviteQr']);
  assert.deepEqual(qrFills[0], [0, 0, 200, 200], 'QR needs a white quiet zone');

  setEvent({ version: 5, inviteToken: rotatedInviteToken });
  await page.refresh();
  assert.deepEqual(qrPayloads, [inviteToken, rotatedInviteToken]);
  setEvent({ hostId: 'someone-else', inviteToken: undefined });
  await page.refresh();
  assert.equal(page.data.canShare, false);
  assert.equal(qrPayloads.length, 2, 'forbidden invitations cannot render a QR');
});

test('approved host invitation card uses live facts and a recorded source before native sharing', async () => {
  const { page, posts, copied } = loadShare();
  await page.onLoad({ id: 'event-1' });
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.canShare, true);
  assert.equal(page.data.headerPaddingRight, '104px');
  assert.equal(page.data.display.title, '周六一起打羽毛球');
  assert.equal(page.data.display.date, '3 月 22 日（周一）14:00');
  assert.equal(page.data.display.location, '上海 · 具体地点请在活动详情核对');
  assert.equal(page.data.display.confirmed, 3);

  assert.equal(page.onShareAppMessage().path, '/pages/index/index', 'unprepared share must not leak the invitation');
  await page.prepareShare();
  assert.equal(posts.length, 1);
  const firstPost = posts[0];
  assert.ok(firstPost);
  assert.equal(firstPost.path, '/events/event-1/share-intents');
  assert.equal(firstPost.body.expectedVersion, 4);
  assert.match(firstPost.body.sourceToken, /^[a-f0-9]{32}$/);
  assert.equal(page.onShareAppMessage().path,
    `/pages/event/event?token=${inviteToken}&source=${firstPost.body.sourceToken}`);
  page.copyInvite();
  const copy = copied[0];
  assert.ok(copy);
  assert.ok(copy.includes(inviteToken));
  assert.match(copy, /首页输入邀请码/);
});

test('share page rejects non-host and stale invitation versions without showing a share action', async () => {
  const { page, posts, copied, setEvent } = loadShare();
  await page.onLoad({ id: 'event-1' });
  await page.prepareShare();
  assert.equal(posts.length, 1);
  setEvent({ version: 5, inviteToken: rotatedInviteToken });
  await page.refresh();
  assert.equal(page.data.sourceToken, '');
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');

  setEvent({ hostId: 'someone-else', inviteToken: undefined });
  await page.refresh();
  assert.equal(page.data.canShare, false);
  await page.prepareShare();
  page.copyInvite();
  assert.equal(posts.length, 1);
  assert.equal(copied.length, 0);
});

test('share preview artwork follows the event type when its title is generic or misleading', async () => {
  const badminton = loadShare({ payload: { title: '周末活动', type: 'badminton',
    startAt: '2027-03-22T06:00:00.000Z', endAt: '2027-03-22T08:00:00.000Z',
    city: '上海', venueName: '公共羽毛球馆', minParticipants: 4 } });
  await badminton.page.onLoad({ id: 'event-1' });
  assert.equal(badminton.page.data.display.cover, '/assets/stitch/caper_home_badminton.jpg');

  const coffee = loadShare({ payload: { title: '羽毛球赛后咖啡', type: 'coffee',
    startAt: '2027-03-22T06:00:00.000Z', endAt: '2027-03-22T08:00:00.000Z',
    city: '上海', venueName: '咖啡馆', minParticipants: 4 } });
  await coffee.page.onLoad({ id: 'event-1' });
  assert.equal(coffee.page.data.display.cover, '/assets/stitch/caper_discover_coffee.jpg');
});

test('share route has a token QR and real copy and WeChat actions without a guaranteed seat', () => {
  const config = JSON.parse(readFileSync(new URL('../miniprogram/app.json', import.meta.url), 'utf8'));
  assert.ok(config.subPackages.find((pack: any) => pack.root === 'subpackages/activity')?.pages.includes('share/share'));
  const markup = readFileSync(new URL('../miniprogram/subpackages/activity/share/share.wxml', import.meta.url), 'utf8');
  assert.match(markup, /bindtap="prepareShare"/);
  assert.match(markup, /open-type="share"/);
  assert.match(markup, /bindtap="copyInvite"/);
  assert.match(markup, /canvas-id="inviteQr"/);
  assert.doesNotMatch(markup, /优先席位|自动成局|静态二维码|#周六羽毛球-IRL/);
});
