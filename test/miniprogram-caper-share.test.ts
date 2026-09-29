import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function loadShare(overrides: Record<string, any> = {}) {
  let page: Record<string, any> | undefined;
  let event = { id: 'event-1', hostId: 'host', version: 4, status: 'RECRUITING',
    reviewStatus: 'APPROVED', recruiting: true, riskPaused: false, inviteToken: 'real-private-token',
    payload: { title: '周六一起打羽毛球', startAt: '2027-03-22T06:00:00.000Z',
      endAt: '2027-03-22T08:00:00.000Z', city: '上海', venueName: '公共羽毛球馆', minParticipants: 4 },
    stats: { confirmed: 3 }, ...overrides };
  const posts: Array<{ path: string; body: Record<string, any> }> = [];
  const copied: string[] = [];
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/activity/share/share.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../../utils/api.js') return { api: {
        async get(url: string) {
          if (url === '/events/event-1') return event;
          if (url === '/system/safety') return { status: 'OPEN' };
          throw new Error(`unexpected GET ${url}`);
        },
        async post(path: string, body: Record<string, any>) {
          posts.push({ path, body });
          return { sourceToken: body.sourceToken };
        }
      } };
      if (path === '../../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return key === 'sessionToken' ? 'session' : key === 'userId' ? 'host' : ''; },
      getSystemInfoSync() { return { statusBarHeight: 24, windowWidth: 390 }; },
      getWindowInfo() { return { windowWidth: 390 }; },
      getMenuButtonBoundingClientRect() { return { left: 294 }; },
      setClipboardData({ data, success }: { data: string; success: () => void }) { copied.push(data); success(); },
      navigateBack() { routes.push('back'); },
      switchTab({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, posts, copied, routes, setEvent(next: Record<string, any>) { event = { ...event, ...next }; } };
}

test('approved host invitation card uses live facts and a recorded source before native sharing', async () => {
  const { page, posts, copied } = loadShare();
  await page.onLoad({ id: 'event-1' });
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.canShare, true);
  assert.equal(page.data.headerPaddingRight, '104px');
  assert.equal(page.data.display.title, '周六一起打羽毛球');
  assert.equal(page.data.display.date, '3 月 22 日（周一）14:00');
  assert.equal(page.data.display.location, '上海 · 公共羽毛球馆');
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
    `/pages/event/event?token=real-private-token&source=${firstPost.body.sourceToken}`);
  page.copyInvite();
  const copy = copied[0];
  assert.ok(copy);
  assert.match(copy, /real-private-token/);
  assert.match(copy, /首页输入邀请码/);
});

test('share page rejects non-host and stale invitation versions without showing a share action', async () => {
  const { page, posts, copied, setEvent } = loadShare();
  await page.onLoad({ id: 'event-1' });
  await page.prepareShare();
  assert.equal(posts.length, 1);
  setEvent({ version: 5, inviteToken: 'rotated-token' });
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

test('share route has real copy and WeChat actions without an invented QR or guaranteed seat', () => {
  const config = JSON.parse(readFileSync(new URL('../miniprogram/app.json', import.meta.url), 'utf8'));
  assert.ok(config.subPackages.find((pack: any) => pack.root === 'subpackages/activity')?.pages.includes('share/share'));
  const markup = readFileSync(new URL('../miniprogram/subpackages/activity/share/share.wxml', import.meta.url), 'utf8');
  assert.match(markup, /bindtap="prepareShare"/);
  assert.match(markup, /open-type="share"/);
  assert.match(markup, /bindtap="copyInvite"/);
  assert.doesNotMatch(markup, /优先席位|自动成局|静态二维码|#周六羽毛球-IRL/);
});
