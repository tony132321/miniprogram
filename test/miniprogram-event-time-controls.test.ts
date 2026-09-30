import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
const start = Date.parse('2026-10-01T12:00:00.000Z');
const end = Date.parse('2026-10-01T14:00:00.000Z');

function eventPage(actor: 'host' | 'member' | 'helper', clock: { now: number }) {
  let page: Record<string, any> | undefined;
  const posts: string[] = [];
  const timers: Array<{ callback: () => void; cleared: boolean }> = [];
  let scans = 0;
  const event = { id: 'event-1', hostId: 'host', version: 2, status: 'CONFIRMED', recruiting: false,
    cohostCapabilities: actor === 'helper' ? ['CHECKIN_MANAGE'] : [],
    payload: { title: '受控羽毛球活动', startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), feeMode: 'FREE' } };
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {
        async get(pathname: string) {
          if (pathname === '/events/event-1') return event;
          if (pathname === '/me/registrations') return { items: actor === 'member'
            ? [{ id: 'registration-1', event_id: 'event-1', status: 'CONFIRMED' }] : [] };
          if (pathname === '/system/safety') return { status: 'OPEN' };
          if (pathname === '/events/event-1/aliases') return { items: [], reconfirmationRequired: false,
            notice: { version: 'v1', text: '活动内昵称说明' } };
          if (pathname === '/events/event-1/share-metrics') return { shareIntents: 0, attributedOpens: 0, unknownSourceOpens: 0 };
          return { items: [] };
        },
        async post(pathname: string) { posts.push(pathname); return { token: 'signed-token', expiresInSeconds: 30 }; }
      } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: actor };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? actor : ''; },
      scanCode() { scans++; }, createCanvasContext() { return {}; }
    },
    Date: class extends Date { static now() { return clock.now; } },
    setTimeout(callback: () => void) { timers.push({ callback, cleared: false }); return timers.length; },
    clearTimeout(id: number) { if (timers[id - 1]) timers[id - 1]!.cleared = true; }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>, callback?: () => void) {
    Object.assign(this.data, patch);
    callback?.();
  };
  page.setData({ id: 'event-1' });
  return { page, posts, get scans() { return scans; }, fireNextTimer() {
    const timer = timers.find(item => !item.cleared);
    assert.ok(timer, 'expected a pending time-boundary update');
    timer.cleared = true;
    timer.callback();
  } };
}

function visibleButton(id: string, data: Record<string, unknown>) {
  const tag = (markup.match(/<button\b(?:"[^"]*"|[^>])*>/gs) || []).find(value => value.includes(`id="${id}"`));
  assert.ok(tag, `missing ${id}`);
  const condition = tag.match(/wx:if="{{([^}]+)}}"/s)?.[1];
  assert.ok(condition, `${id} must have a visibility gate`);
  return Boolean(Function('data', `with (data) { return (${condition}); }`)(data));
}

test('confirmed member can sign in only from 30 minutes before start through 30 minutes after end', async () => {
  const clock = { now: start - 30 * 60_000 - 1 };
  const { page } = eventPage('member', clock);
  for (const [at, allowed] of [
    [start - 30 * 60_000 - 1, false], [start - 30 * 60_000, true],
    [end + 30 * 60_000, true], [end + 30 * 60_000 + 1, false]
  ] as const) {
    clock.now = at;
    assert.equal(await page.refresh(), true);
    assert.equal(page.data.canCheckIn, allowed, `member gate at ${at}`);
  }
});

test('host and delegated cohost QR buttons use the same window; only host may complete after end', async () => {
  for (const actor of ['host', 'helper'] as const) {
    const clock = { now: start - 30 * 60_000 - 1 };
    const { page } = eventPage(actor, clock);
    for (const [at, qr, complete] of [
      [start - 30 * 60_000 - 1, false, false], [start - 30 * 60_000, true, false],
      [end, true, actor === 'host'], [end + 30 * 60_000, true, actor === 'host'],
      [end + 30 * 60_000 + 1, false, actor === 'host']
    ] as const) {
      clock.now = at;
      assert.equal(await page.refresh(), true);
      assert.equal(page.data.canGenerateCheckInToken, qr, `${actor} QR gate at ${at}`);
      assert.equal(page.data.canCompleteEvent, complete, `${actor} completion gate at ${at}`);
      assert.equal(visibleButton(actor === 'host' ? 'hostTokenButton' : 'cohostTokenButton', page.data), qr);
      assert.equal(visibleButton('checkinScreenTokenButton', page.data), qr);
      if (actor === 'host') assert.equal(visibleButton('completeEventButton', page.data), complete);
    }
  }
});

test('expired page state cannot launch scanner, request QR, or submit completion', async () => {
  const clock = { now: start - 30 * 60_000 };
  const member = eventPage('member', clock);
  assert.equal(await member.page.refresh(), true);
  clock.now = end + 30 * 60_000 + 1;
  member.page.scanCheckIn();
  member.page.checkIn();
  assert.equal(member.scans, 0);
  assert.deepEqual(member.posts, []);

  clock.now = start - 30 * 60_000;
  const host = eventPage('host', clock);
  assert.equal(await host.page.refresh(), true);
  clock.now = start - 30 * 60_000 - 1;
  await host.page.showCheckInToken();
  host.page.setData({ completionHeld: false });
  host.page.complete();
  assert.deepEqual(host.posts, []);
});

test('an open event page updates its controls when a time boundary passes and hides an expired QR', async () => {
  const clock = { now: start - 30 * 60_000 - 1 };
  const host = eventPage('host', clock);
  assert.equal(await host.page.refresh(), true);
  assert.equal(host.page.data.canGenerateCheckInToken, false);
  clock.now = start - 30 * 60_000;
  host.fireNextTimer();
  assert.equal(host.page.data.canGenerateCheckInToken, true);
  clock.now = end + 30 * 60_000 + 1;
  host.page.setData({ displayedCheckInToken: 'expired-qr', checkInExpiresIn: 10 });
  host.fireNextTimer();
  assert.equal(host.page.data.canGenerateCheckInToken, false);
  assert.equal(host.page.data.displayedCheckInToken, '');
  assert.equal(host.page.data.canCompleteEvent, true);
});
