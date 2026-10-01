import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const firstToken = 'A'.repeat(32);
const nextToken = 'B'.repeat(32);
const futureDeadline = '2027-03-22T05:30:00.000Z';

function loadPoster() {
  let page: Record<string, any> | undefined;
  let actor = 'host';
  let session = 'session-1';
  let safetyStatus = 'OPEN';
  let canvasReady = true;
  let event = { id: 'event-1', hostId: 'host', version: 4, status: 'RECRUITING',
    reviewStatus: 'APPROVED', recruiting: true, riskPaused: false, inviteToken: firstToken,
    inviteRemainingMs: 60_000,
    payload: { title: '周六羽毛球局', startAt: '2027-03-22T06:00:00.000Z',
      endAt: '2027-03-22T08:00:00.000Z', registrationDeadline: futureDeadline,
      city: '上海', minParticipants: 4 }, stats: { confirmed: 3 } };
  const qrPayloads: string[] = [];
  const canvasIds: string[] = [];
  const exportIds: string[] = [];
  const previews: Array<{ current: string; urls: string[] }> = [];
  const getPaths: string[] = [];
  let drawCallback: (() => void) | undefined;
  let exportSuccess: ((value: { tempFilePath: string }) => void) | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/activity/share/share.js', import.meta.url), 'utf8'), {
    setTimeout, clearTimeout,
    require(path: string) {
      if (path === '../../../vendor/qrcode.js') return () => ({
        addData(value: string) { qrPayloads.push(value); }, make() {},
        getModuleCount() { return 21; }, isDark(row: number, col: number) { return row === col; }
      });
      if (path === '../../../utils/api.js') return { api: { async get(url: string) {
        getPaths.push(url);
        if (url === '/events/event-1') return { ...event, payload: { ...event.payload } };
        if (url === '/system/safety') return { status: safetyStatus };
        throw new Error(`unexpected GET ${url}`);
      } } };
      if (path === '../../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return key === 'sessionToken' ? session : key === 'userId' ? actor : ''; },
      getSystemInfoSync() { return { statusBarHeight: 24, windowWidth: 390 }; },
      getWindowInfo() { return { windowWidth: 390 }; },
      getMenuButtonBoundingClientRect() { return { left: 294 }; },
      nextTick(callback: () => void) { callback(); },
      createSelectorQuery() {
        let report: ((value: Record<string, number> | null) => void) | undefined;
        return { in() { return this; }, select() { return this; },
          boundingClientRect(callback: (value: Record<string, number> | null) => void) {
            report = callback; return this;
          },
          exec() { report?.(canvasReady ? { width: 360, height: 600 } : null); }
        };
      },
      createCanvasContext(id: string) {
        canvasIds.push(id);
        return { setFillStyle() {}, fillRect() {}, setFontSize() {}, fillText() {},
          draw(_reserve: boolean, callback?: () => void) {
            if (callback) drawCallback = callback;
          } };
      },
      canvasToTempFilePath(options: { canvasId: string; success: (value: { tempFilePath: string }) => void }) {
        exportIds.push(options.canvasId);
        exportSuccess = options.success;
      },
      previewImage(options: { current: string; urls: string[] }) { previews.push(options); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, qrPayloads, canvasIds, exportIds, previews, getPaths,
    setEvent(patch: Record<string, any>) { event = { ...event, ...patch }; },
    setActor(next: string) { actor = next; }, setSession(next: string) { session = next; },
    setSafety(next: string) { safetyStatus = next; },
    setCanvasReady(next: boolean) { canvasReady = next; },
    finishDraw() { assert.ok(drawCallback, 'poster must wait for draw callback'); drawCallback(); },
    finishExport() { assert.ok(exportSuccess, 'poster export must follow draw callback');
      exportSuccess({ tempFilePath: 'wxfile://tmp/caper-poster.png' }); }
  };
}

async function nextTurn() { await new Promise(resolve => setImmediate(resolve)); }

test('poster action refreshes host eligibility, then exports the current QR and previews only the local image', async () => {
  const h = loadPoster();
  await h.page.onLoad({ id: 'event-1' });
  h.setEvent({ version: 5, inviteToken: nextToken });
  const pending = h.page.generatePoster();
  await nextTurn();
  assert.deepEqual(h.exportIds, [], 'export must wait for CanvasContext.draw callback');
  assert.equal(h.qrPayloads.at(-1), nextToken, 'poster must use the newly read invite token');
  assert.ok(h.canvasIds.includes('invitePoster'));
  h.finishDraw();
  assert.deepEqual(h.exportIds, ['invitePoster']);
  h.finishExport();
  await pending;
  assert.deepEqual(h.previews.map(preview => ({ current: preview.current, urls: Array.from(preview.urls) })),
    [{ current: 'wxfile://tmp/caper-poster.png', urls: ['wxfile://tmp/caper-poster.png'] }]);
  assert.ok(h.getPaths.filter(path => path === '/events/event-1').length >= 3,
    'eligibility must be checked when tapped and before opening the exported image');
  assert.ok(!JSON.stringify(h.previews).includes(nextToken));
});

test('poster declines to export when the host loses eligibility after the invitation card loaded', async () => {
  for (const change of [
    (h: ReturnType<typeof loadPoster>) => h.setSafety('CLOSED'),
    (h: ReturnType<typeof loadPoster>) => h.setEvent({ reviewStatus: 'PENDING' }),
    (h: ReturnType<typeof loadPoster>) => h.setEvent({ hostId: 'other-host' }),
    (h: ReturnType<typeof loadPoster>) => h.setEvent({ payload: { ...h.page.data.event.payload,
      registrationDeadline: new Date(Date.now() - 1000).toISOString() } })
  ]) {
    const h = loadPoster();
    await h.page.onLoad({ id: 'event-1' });
    change(h);
    await h.page.generatePoster();
    assert.deepEqual(h.exportIds, []);
    assert.deepEqual(h.previews, []);
  }
});

test('poster drops old draw/export callbacks after account or event changes', async () => {
  const h = loadPoster();
  await h.page.onLoad({ id: 'event-1' });
  const pending = h.page.generatePoster();
  await nextTurn();
  h.setSession('session-2');
  h.finishDraw();
  await pending;
  assert.deepEqual(h.exportIds, []);
  assert.deepEqual(h.previews, []);

  h.setSession('session-1');
  await h.page.refresh();
  const afterExport = h.page.generatePoster();
  await nextTurn();
  h.finishDraw();
  h.page.setData({ id: 'event-2' });
  h.finishExport();
  await afterExport;
  assert.deepEqual(h.previews, []);
});

test('poster rechecks the server version before opening the exported image', async () => {
  const h = loadPoster();
  await h.page.onLoad({ id: 'event-1' });
  const pending = h.page.generatePoster();
  await nextTurn();
  h.finishDraw();
  h.setEvent({ version: 5, inviteToken: nextToken });
  h.finishExport();
  await pending;
  assert.deepEqual(h.previews, []);
});

test('published poster shortcut routes through the share page and the share page performs the live recheck', async () => {
  let eventPage: Record<string, any> | undefined;
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(path);
    },
    Page(definition: Record<string, any>) { eventPage = definition; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; },
      navigateTo({ url }: { url: string }) { routes.push(url); } }
  });
  assert.ok(eventPage);
  eventPage.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  Object.assign(eventPage.data, { id: 'event-1', isHost: true, currentUser: 'host', safetyStatus: 'OPEN',
    event: { id: 'event-1', hostId: 'host', version: 4, status: 'RECRUITING',
      reviewStatus: 'APPROVED', recruiting: true, riskPaused: false, inviteToken: firstToken,
      inviteRemainingMs: 60_000,
      payload: { title: '周六羽毛球局', registrationDeadline: futureDeadline } } });
  eventPage._inviteValidUntil = Date.now() + 60_000;
  eventPage.openShareCard({ currentTarget: { dataset: { poster: true } } });
  assert.deepEqual(routes, ['/subpackages/activity/share/share?id=event-1&poster=1']);
  assert.match(readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8'),
    /id="publishedPosterButton"[^>]+bindtap="openShareCard"/);
  assert.match(readFileSync(new URL('../miniprogram/subpackages/activity/share/share.wxml', import.meta.url), 'utf8'),
    /bindtap="generatePoster"/);
});

test('poster shortcut waits for the share canvas to mount before drawing', async () => {
  const h = loadPoster();
  const loading = h.page.onLoad({ id: 'event-1', poster: '1' });
  await nextTurn();
  assert.ok(!h.canvasIds.includes('invitePoster'), 'onLoad runs before the canvas is ready');
  const ready = h.page.onReady();
  await nextTurn();
  assert.ok(h.canvasIds.includes('invitePoster'));
  h.finishDraw();
  h.finishExport();
  await Promise.all([loading, ready]);
  assert.equal(h.previews.length, 1);
});

test('poster action waits for a mounted canvas after the page has entered READY', async () => {
  const h = loadPoster();
  await h.page.onLoad({ id: 'event-1' });
  h.setCanvasReady(false);
  const pending = h.page.generatePoster();
  await nextTurn();
  assert.ok(!h.canvasIds.includes('invitePoster'));
  h.setCanvasReady(true);
  await new Promise(resolve => setTimeout(resolve, 130));
  assert.ok(h.canvasIds.includes('invitePoster'));
  h.finishDraw();
  h.finishExport();
  await pending;
  assert.equal(h.previews.length, 1);
});
