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
  let safetyStatus = 'OPEN';
  let event = { id: 'event-1', hostId: 'host', version: 4, status: 'RECRUITING',
    reviewStatus: 'APPROVED', recruiting: true, riskPaused: false, inviteToken, inviteRemainingMs: 60_000,
    payload: { title: '周六一起打羽毛球', startAt: '2027-03-22T06:00:00.000Z',
      endAt: '2027-03-22T08:00:00.000Z', registrationDeadline: '2027-03-22T05:30:00.000Z',
      city: '上海', venueName: '公共羽毛球馆', minParticipants: 4 },
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
    setTimeout, clearTimeout,
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
          if (url === '/system/safety') return { status: safetyStatus };
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
    setSafetyStatus(next: string) { safetyStatus = next; },
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
  await page.copyInvite();
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
  await page.copyInvite();
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
  await page.copyInvite();
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
  await page.copyInvite();
  const copy = copied[0];
  assert.ok(copy);
  assert.ok(copy.includes(inviteToken));
  assert.match(copy, /首页输入邀请码/);
});

test('published share shortcut opens the checked invitation choices without sending a native share', async () => {
  const { page, posts } = loadShare();
  await page.onLoad({ id: 'event-1', share: '1' });
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.canShare, true);
  assert.equal(page.data.shareSheetOpen, true);
  assert.equal(posts.length, 0, 'opening choices must not create a share intent');
  assert.equal(page.onShareAppMessage().path, '/pages/index/index', 'native sharing still requires a user tap');
  page.closeShareSheet();
  assert.equal(page.data.shareSheetOpen, false);
  await page.refresh();
  assert.equal(page.data.shareSheetOpen, false, 'closing choices is not undone by refresh');
});

test('published share shortcut keeps choices closed when server share eligibility fails', async () => {
  const { page, posts } = loadShare({ riskPaused: true });
  await page.onLoad({ id: 'event-1', share: '1' });
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.shareSheetOpen, false);
  assert.equal(page.data.display.inviteToken, '');
  assert.equal(posts.length, 0);
});

test('approved publication copy intent performs the safe invitation copy on entering the share card', async () => {
  const { page, copied } = loadShare();
  await page.onLoad({ id: 'event-1', copy: '1' });
  assert.equal(page.data.canShare, true);
  assert.equal(copied.length, 1);
  const copy = copied[0];
  assert.ok(copy);
  assert.ok(copy.includes(inviteToken));
  assert.equal(page.data.message, '真实邀请码与使用说明已复制。');
});

test('copying an invitation uses a newly rotated token from the server', async () => {
  const { page, copied, setEvent } = loadShare();
  await page.onLoad({ id: 'event-1' });
  setEvent({ version: 5, inviteToken: rotatedInviteToken });
  await page.copyInvite();
  assert.equal(copied.length, 1);
  const copy = copied[0];
  assert.ok(copy);
  assert.ok(copy.includes(rotatedInviteToken));
  assert.ok(!copy.includes(inviteToken));
  assert.equal(page.data.display.inviteToken, rotatedInviteToken);
});

test('copying an invitation stops after a safety closure despite a cached approved card', async () => {
  const { page, copied, setSafetyStatus } = loadShare();
  await page.onLoad({ id: 'event-1' });
  setSafetyStatus('CLOSED');
  await page.copyInvite();
  assert.equal(copied.length, 0);
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.display.inviteToken, '');
});

test('an expired registration deadline blocks a recruiting invite on entry and on final copy recheck', async () => {
  const expiredDeadline = new Date(Date.now() - 1000).toISOString();
  const initial = loadShare({ payload: { title: '周六一起打羽毛球',
    startAt: '2027-03-22T06:00:00.000Z', endAt: '2027-03-22T08:00:00.000Z',
    registrationDeadline: expiredDeadline, city: '上海', venueName: '公共羽毛球馆', minParticipants: 4 } });
  await initial.page.onLoad({ id: 'event-1', copy: '1' });
  assert.equal(initial.page.data.event.recruiting, true, 'the scheduled closure may be late');
  assert.equal(initial.page.data.canShare, false);
  assert.match(initial.page.data.shareReason, /报名.*截止/);
  assert.equal(initial.page.data.display.inviteToken, '');
  assert.equal(initial.copied.length, 0);
  assert.equal(initial.qrPayloads.length, 0);

  const current = loadShare();
  await current.page.onLoad({ id: 'event-1' });
  current.setEvent({ payload: { ...current.page.data.event.payload, registrationDeadline: expiredDeadline } });
  await current.page.copyInvite();
  assert.equal(current.page.data.event.recruiting, true);
  assert.equal(current.page.data.canShare, false);
  assert.equal(current.page.data.display.inviteToken, '');
  assert.equal(current.copied.length, 0);
});

test('server-expired invite is hidden on entry even while the device believes registration is open', async () => {
  const { page, copied, qrPayloads } = loadShare({ inviteRemainingMs: 0 });
  await page.onLoad({ id: 'event-1', copy: '1' });
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.display.inviteToken, '');
  assert.equal(page.data.event.inviteToken, undefined);
  assert.equal(copied.length, 0);
  assert.equal(qrPayloads.length, 0);
});

test('old event response without server invite validity cannot reveal or copy the token', async () => {
  const { page, copied } = loadShare({ inviteRemainingMs: undefined });
  await page.onLoad({ id: 'event-1', copy: '1' });
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.display.inviteToken, '');
  assert.equal(copied.length, 0);
});

test('copy refresh rejects a token whose server validity expired after card display', async () => {
  const { page, copied, setEvent } = loadShare();
  await page.onLoad({ id: 'event-1' });
  setEvent({ inviteRemainingMs: 0 });
  await page.copyInvite();
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.display.inviteToken, '');
  assert.equal(copied.length, 0);
});

test('a prepared share is withdrawn when the server validity interval elapses before native sharing', async () => {
  const { page } = loadShare({ inviteRemainingMs: 50 });
  await page.onLoad({ id: 'event-1' });
  await page.prepareShare();
  assert.match(page.onShareAppMessage().path, /token=/);
  await new Promise(resolve => setTimeout(resolve, 75));
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.display.inviteToken, '');
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');
  page.onUnload();
});

test('an open invitation card hides its token when the registration deadline arrives', async () => {
  const soon = new Date(Date.now() + 300).toISOString();
  const { page, copied } = loadShare({ payload: { title: '周六一起打羽毛球',
    startAt: '2027-03-22T06:00:00.000Z', endAt: '2027-03-22T08:00:00.000Z',
    registrationDeadline: soon, city: '上海', venueName: '公共羽毛球馆', minParticipants: 4 } });
  await page.onLoad({ id: 'event-1' });
  assert.equal(page.data.canShare, true);
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal(page.data.event.recruiting, true);
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.display.inviteToken, '');
  assert.equal(copied.length, 0);
  page.onUnload();
});

test('an account switch during final invitation recheck cannot copy the old host token', async () => {
  const { page, copied, setActor, holdEventGet } = loadShare();
  await page.onLoad({ id: 'event-1' });
  const releaseGet = holdEventGet();
  const copying = page.copyInvite();
  setActor('different-account');
  releaseGet();
  await copying;
  assert.equal(copied.length, 0);
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.display, null);
});

test('a newer invitation refresh supersedes an older pending copy request', async () => {
  const { page, copied, holdEventGet } = loadShare();
  await page.onLoad({ id: 'event-1' });
  const releaseGet = holdEventGet();
  const copying = page.copyInvite();
  const refreshed = page.refresh();
  releaseGet();
  await Promise.all([copying, refreshed]);
  assert.equal(copied.length, 0);
  assert.equal(page.data.canShare, true);
});

for (const lifecycle of ['onHide', 'onUnload'] as const) {
  test(`${lifecycle} cancels a pending invite recheck before it can write the clipboard`, async () => {
    const { page, copied, holdEventGet } = loadShare();
    await page.onLoad({ id: 'event-1' });
    await page.onShow();
    const releaseGet = holdEventGet();
    const copying = page.copyInvite();
    page[lifecycle]();
    releaseGet();
    await copying;
    assert.deepEqual(copied, []);
    assert.equal(page.data.sourceToken, '');
    assert.equal(page.onShareAppMessage().path, '/pages/index/index');
    if (lifecycle === 'onHide') {
      await page.onShow();
      assert.equal(page.data.loadState, 'READY', 'returning to the card fetches current eligibility');
      assert.equal(page.data.canShare, true);
    }
  });

  test(`${lifecycle} cancels a pending share intent before it can reopen native sharing`, async () => {
    const { page, holdPosts } = loadShare();
    await page.onLoad({ id: 'event-1' });
    await page.onShow();
    const releasePost = holdPosts();
    const preparing = page.prepareShare();
    page[lifecycle]();
    releasePost();
    await preparing;
    assert.equal(page.data.sourceToken, '');
    assert.equal(page.data.preparingShare, false);
    assert.notEqual(page.data.message, '分享邀请已准备好，请点击微信好友或群聊。');
    assert.equal(page.onShareAppMessage().path, '/pages/index/index');
  });
}

test('a prepared invitation stops exposing its share path when the card is hidden', async () => {
  const { page } = loadShare();
  await page.onLoad({ id: 'event-1' });
  await page.prepareShare();
  assert.match(page.onShareAppMessage().path, /token=/);
  page.onHide();
  assert.equal(page.data.canShare, false);
  assert.equal(page.data.sourceToken, '');
  assert.equal(page.data.display.inviteToken, '');
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');
});

test('the first show after a hidden card refreshes eligibility before sharing again', async () => {
  const { page, setEvent } = loadShare();
  await page.onLoad({ id: 'event-1' });
  page.onHide();
  setEvent({ version: 5, inviteToken: rotatedInviteToken });
  await page.onShow();
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.canShare, true);
  assert.equal(page.data.display.inviteToken, rotatedInviteToken);
});

test('a pending share intent cannot revive after the card is hidden and shown again', async () => {
  const { page, holdPosts } = loadShare();
  await page.onLoad({ id: 'event-1' });
  await page.onShow();
  const releasePost = holdPosts();
  const preparing = page.prepareShare();
  page.onHide();
  await page.onShow();
  releasePost();
  await preparing;
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.canShare, true);
  assert.equal(page.data.sourceToken, '');
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');
});

test('a pending poster eligibility refresh cannot render a private QR after the card is hidden', async () => {
  const { page, qrPayloads, holdEventGet } = loadShare();
  await page.onLoad({ id: 'event-1' });
  const drawnBefore = qrPayloads.length;
  const releaseGet = holdEventGet();
  const generating = page.generatePoster();
  page.onHide();
  releaseGet();
  await generating;
  assert.equal(qrPayloads.length, drawnBefore);
  assert.equal(page.data.posterPreparing, false);
  assert.equal(page.data.display.inviteToken, '');
});

test('pending host can inspect share eligibility without displaying or copying an invite token', async () => {
  const { page, copied, qrPayloads } = loadShare({ reviewStatus: 'PENDING', recruiting: false });
  await page.onLoad({ id: 'event-1', copy: '1' });
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.canShare, false);
  assert.match(page.data.shareReason, /尚未通过审核/);
  assert.equal(page.data.display.inviteToken, '');
  await page.copyInvite();
  assert.equal(copied.length, 0);
  assert.equal(qrPayloads.length, 0);
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
  await page.copyInvite();
  assert.equal(posts.length, 1);
  assert.equal(copied.length, 0);
});

test('share preview artwork follows the event type when its title is generic or misleading', async () => {
  const badminton = loadShare({ payload: { title: '周末活动', type: 'badminton',
    startAt: '2027-03-22T06:00:00.000Z', endAt: '2027-03-22T08:00:00.000Z', registrationDeadline: '2027-03-22T05:30:00.000Z',
    city: '上海', venueName: '公共羽毛球馆', minParticipants: 4 } });
  await badminton.page.onLoad({ id: 'event-1' });
  assert.equal(badminton.page.data.display.cover, '/assets/stitch/caper_home_badminton.jpg');

  const coffee = loadShare({ payload: { title: '羽毛球赛后咖啡', type: 'coffee',
    startAt: '2027-03-22T06:00:00.000Z', endAt: '2027-03-22T08:00:00.000Z', registrationDeadline: '2027-03-22T05:30:00.000Z',
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
