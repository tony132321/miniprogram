import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

const snapshot = 'a'.repeat(32);
const offeredEvent = { id: 'event-offered', status: 'RECRUITING', title: '周五桌游',
  isHost: false, myRegistrationStatus: 'OFFERED' };
const currentOffer = { id: 'notice-target', event_id: 'event-offered', kind: 'WAITLIST_OFFER',
  event_version: 7, detail: { offerId: 'offer-target', expiresAt: '2099-12-31T00:00:00.000Z' },
  actionable: true, declinable: true, status: 'UNREAD' };

function mount(source: 'index' | 'me', storage: Map<string, unknown>,
  get: (path: string) => Promise<unknown>, post?: (path: string, data: unknown) => Promise<unknown>) {
  let page: Record<string, any> | undefined;
  const switched: string[] = [];
  const selectors: string[] = [];
  const scrolls: unknown[] = [];
  const globalData: Record<string, unknown> = { ready: Promise.resolve() };
  runInNewContext(readFileSync(new URL(`../miniprogram/pages/${source}/${source}.js`, import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get, post } };
      if (path === '../../config.js') return { developmentUser: 'member' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); },
      removeStorageSync(key: string) { storage.delete(key); },
      switchTab({ url }: { url: string }) { switched.push(url); },
      getSystemInfoSync() { return { statusBarHeight: 24 }; },
      nextTick(fn: () => void) { fn(); },
      pageScrollTo(options: unknown) { scrolls.push(options); },
      createSelectorQuery() { return {
        select(selector: string) { selectors.push(selector); return { boundingClientRect() {} }; },
        selectViewport() { return { scrollOffset() {} }; },
        exec(callback: (positions: unknown[]) => void) { callback([{ top: 130 }, { scrollTop: 900 }]); }
      }; }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, switched, selectors, scrolls, globalData };
}

function profileGet(first: Record<string, unknown>[], second: Record<string, unknown>[] = [],
  eventVersion = 7, events = [offeredEvent]) {
  const reads: string[] = [];
  const get = async (path: string) => {
    reads.push(path);
    if (path === '/me/events') return { items: events };
    if (path === '/me/notifications?offset=0') return { items: first, total: first.length + second.length,
      nextOffset: second.length ? first.length : null, snapshot };
    if (path === `/me/notifications?offset=${first.length}&snapshot=${snapshot}`)
      return { items: second, total: first.length + second.length, nextOffset: null, snapshot };
    if (path === '/events/event-offered') return { id: 'event-offered', version: eventVersion,
      status: 'RECRUITING', recruiting: true, reviewStatus: 'APPROVED' };
    if (path === '/me/consents') return { eventReminder: false };
    if (path === '/me/similar-invites') return { granted: false };
    return { items: [] };
  };
  return { get, reads };
}

test('offered home card passes the exact event and current actor to profile without accepting it', async () => {
  const storage = new Map<string, unknown>([['devUser', 'member']]);
  const posts: string[] = [];
  const { get } = profileGet([], [], 7);
  const home = mount('index', storage, get, async path => { posts.push(path); return {}; });
  await home.page.onShow();
  const card = home.page.data.pending[0];
  home.page.openCardAction({ currentTarget: { dataset: { id: card.id, action: card.primaryAction } } });
  assert.deepEqual(home.switched, ['/pages/me/me']);
  assert.equal(JSON.stringify(storage.get('irlProfileOfferIntent')),
    JSON.stringify({ eventId: 'event-offered', owner: 'dev:member' }));
  assert.deepEqual(posts, []);
});

test('profile reads later notification pages and focuses only the matching live offer controls', async () => {
  const storage = new Map<string, unknown>([['devUser', 'member'],
    ['irlProfileOfferIntent', { eventId: 'event-offered', owner: 'dev:member' }]]);
  const otherOffer = { ...currentOffer, id: 'notice-other', event_id: 'another-event',
    detail: { offerId: 'offer-other', expiresAt: '2099-12-31T00:00:00.000Z' } };
  const { get, reads } = profileGet([otherOffer], [currentOffer]);
  const posts: string[] = [];
  const profile = mount('me', storage, get, async path => { posts.push(path); return {}; });
  await profile.page.onShow();
  assert.equal(profile.page.data.focusedOfferId, 'notice-target');
  assert.equal(profile.page.data.notifications.length, 2);
  assert.equal(profile.selectors.at(-1), '#notice-notice-target');
  assert.ok(reads.includes(`/me/notifications?offset=1&snapshot=${snapshot}`));
  assert.ok(reads.includes('/events/event-offered'));
  assert.equal(storage.has('irlProfileOfferIntent'), false);
  assert.deepEqual(posts, []);
  const markup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  assert.match(markup, /id="notice-{{item\.id}}"/);
});

test('offer focus stops after five notification pages and reports that the full list needs manual review', async () => {
  const storage = new Map<string, unknown>([['devUser', 'member'],
    ['irlProfileOfferIntent', { eventId: 'event-offered', owner: 'dev:member' }]]);
  const offsets: number[] = [];
  const { get: otherGet } = profileGet([]);
  const get = async (path: string) => {
    if (path.startsWith('/me/notifications?')) {
      const offset = Number(new URL('https://local.invalid' + path).searchParams.get('offset'));
      offsets.push(offset);
      return { items: Array.from({ length: 100 }, (_, index) => ({
        id: `other-${offset + index}`, event_id: 'another-event', kind: 'EVENT_REMINDER',
        event_version: 7, detail: {}, actionable: false, declinable: false, status: 'UNREAD'
      })), total: 600, nextOffset: offset + 100 < 600 ? offset + 100 : null, snapshot };
    }
    return otherGet(path);
  };
  const profile = mount('me', storage, get);
  await profile.page.onShow();
  assert.deepEqual(offsets, [0, 100, 200, 300, 400]);
  assert.equal(profile.page.data.focusedOfferId, '');
  assert.match(profile.page.data.offerFocusMessage, /通知较多.*全部通知/);
  assert.equal(profile.selectors.at(-1), '#noticeSection');
});

test('a changed notification snapshot restarts once and focuses the newly current offer', async () => {
  const storage = new Map<string, unknown>([['devUser', 'member'],
    ['irlProfileOfferIntent', { eventId: 'event-offered', owner: 'dev:member' }]]);
  let firstReads = 0;
  const noticeReads: string[] = [];
  const { get: otherGet } = profileGet([]);
  const get = async (path: string) => {
    if (path === '/me/notifications?offset=0') {
      noticeReads.push(path);
      firstReads += 1;
      return firstReads === 1
        ? { items: [{ id: 'other', event_id: 'another-event', kind: 'EVENT_REMINDER',
          event_version: 7, detail: {}, actionable: false, declinable: false, status: 'UNREAD' }],
          total: 2, nextOffset: 1, snapshot }
        : { items: [currentOffer], total: 1, nextOffset: null, snapshot: 'b'.repeat(32) };
    }
    if (path === `/me/notifications?offset=1&snapshot=${snapshot}`) {
      noticeReads.push(path);
      throw Object.assign(new Error('通知列表已变化'), { code: 'QUEUE_CHANGED' });
    }
    return otherGet(path);
  };
  const profile = mount('me', storage, get);
  await profile.page.onShow();
  assert.deepEqual(noticeReads, ['/me/notifications?offset=0',
    `/me/notifications?offset=1&snapshot=${snapshot}`, '/me/notifications?offset=0']);
  assert.equal(profile.page.data.focusedOfferId, 'notice-target');
});

test('a changed event version or expired offer cannot become a focused acceptance action', async () => {
  for (const [notice, version] of [
    [currentOffer, 8],
    [{ ...currentOffer, detail: { ...currentOffer.detail, expiresAt: '2020-01-01T00:00:00.000Z' } }, 7]
  ] as const) {
    const storage = new Map<string, unknown>([['devUser', 'member'],
      ['irlProfileOfferIntent', { eventId: 'event-offered', owner: 'dev:member' }]]);
    const { get } = profileGet([notice], [], version);
    const profile = mount('me', storage, get);
    await profile.page.onShow();
    assert.equal(profile.page.data.focusedOfferId, 'notice-target');
    assert.equal(profile.page.data.notifications[0].actionable, false);
    assert.equal(profile.page.data.notifications[0].declinable, false);
    assert.match(profile.page.data.offerFocusMessage, /失效|变化/);
  }
});

test('an offer intent from a different actor is discarded before reading event details', async () => {
  const storage = new Map<string, unknown>([['devUser', 'member'],
    ['irlProfileOfferIntent', { eventId: 'event-offered', owner: 'dev:former' }]]);
  const { get, reads } = profileGet([currentOffer]);
  const profile = mount('me', storage, get);
  await profile.page.onShow();
  assert.equal(profile.page.data.focusedOfferId, '');
  assert.equal(reads.includes('/events/event-offered'), false);
  assert.equal(storage.has('irlProfileOfferIntent'), false);
});

test('a new login session for the same user cannot reuse an old offer focus intent', async () => {
  const storage = new Map<string, unknown>([['sessionToken', 'session-first'], ['userId', 'same-user']]);
  const { get } = profileGet([currentOffer]);
  const home = mount('index', storage, get);
  await home.page.onShow();
  home.page.openCardAction({ currentTarget: { dataset: { id: 'event-offered', action: 'offerNotifications' } } });
  storage.set('sessionToken', 'session-second');
  const reads: string[] = [];
  const profile = mount('me', storage, async path => { reads.push(path); return get(path); });
  await profile.page.onShow();
  assert.equal(profile.page.data.focusedOfferId, '');
  assert.equal(reads.includes('/events/event-offered'), false);
  assert.equal(storage.has('irlProfileOfferIntent'), false);
});

test('the explicit offer card takes priority over leftover report focus state', async () => {
  const storage = new Map<string, unknown>([['devUser', 'member'],
    ['irlProfileOfferIntent', { eventId: 'event-offered', owner: 'dev:member' }]]);
  const { get } = profileGet([currentOffer]);
  const profile = mount('me', storage, get);
  profile.globalData.reportContext = { actor: 'member', eventId: 'older-report-event' };
  await profile.page.onShow();
  assert.equal(profile.page.data.focusedOfferId, 'notice-target');
  assert.equal(profile.selectors.at(-1), '#notice-notice-target');
});

test('an event read finishing after private data is cleared cannot refocus old offer controls', async () => {
  const storage = new Map<string, unknown>([['devUser', 'member'],
    ['irlProfileOfferIntent', { eventId: 'event-offered', owner: 'dev:member' }]]);
  let releaseEvent!: (event: unknown) => void;
  let markEventStarted!: () => void;
  const eventStarted = new Promise<void>(resolve => { markEventStarted = resolve; });
  const { get: otherGet } = profileGet([currentOffer]);
  const get = (path: string) => path === '/events/event-offered'
    ? new Promise(resolve => { releaseEvent = resolve; markEventStarted(); }) : otherGet(path);
  const profile = mount('me', storage, get);
  const showing = profile.page.onShow();
  await eventStarted;
  profile.page.clearPrivateData();
  releaseEvent({ id: 'event-offered', version: 7 });
  await showing;
  assert.equal(profile.page.data.focusedOfferId, '');
  assert.equal(profile.page.data.offerFocusMessage, '');
  assert.deepEqual(profile.selectors, []);
});

test('a decline-only offer remains focused and uses the freshly read offer version', async () => {
  const storage = new Map<string, unknown>([['devUser', 'member'],
    ['irlProfileOfferIntent', { eventId: 'event-offered', owner: 'dev:member' }]]);
  const declineOnly = { ...currentOffer, actionable: false, declinable: true };
  const { get } = profileGet([declineOnly]);
  const posts: Array<{ path: string; data: unknown }> = [];
  const profile = mount('me', storage, get, async (path, data) => { posts.push({ path, data }); return {}; });
  await profile.page.onShow();
  assert.equal(profile.page.data.focusedOfferId, 'notice-target');
  assert.equal(profile.page.data.notifications[0].actionable, false);
  assert.equal(profile.page.data.notifications[0].declinable, true);
  await profile.page.declineOffer({ currentTarget: { dataset: { id: 'offer-target', version: 7 } } });
  assert.equal(JSON.stringify(posts), JSON.stringify([
    { path: '/offers/offer-target/decline', data: { expectedVersion: 7 } }
  ]));
});

test('an offer expiry rejection refreshes the notice before showing another decision', async () => {
  const storage = new Map<string, unknown>([['devUser', 'member'],
    ['irlProfileOfferIntent', { eventId: 'event-offered', owner: 'dev:member' }]]);
  let noticeReads = 0;
  const { get: ordinaryGet } = profileGet([currentOffer]);
  const get = async (path: string) => {
    if (path === '/me/notifications?offset=0') {
      noticeReads += 1;
      return { items: [{ ...currentOffer, actionable: noticeReads === 1, declinable: noticeReads === 1 }],
        total: 1, nextOffset: null, snapshot };
    }
    return ordinaryGet(path);
  };
  const profile = mount('me', storage, get, async () => {
    throw Object.assign(new Error('补位邀请已失效'), { code: 'OFFER_UNAVAILABLE' });
  });
  await profile.page.onShow();
  await profile.page.acceptOffer({ currentTarget: { dataset: { id: 'offer-target', version: 7 } } });
  assert.equal(noticeReads, 2);
  assert.equal(profile.page.data.notifications[0].actionable, false);
  assert.match(profile.page.data.message, /补位邀请已失效/);
});

test('a version conflict hides a rejected offer even if the refreshed notice still flags it active', async () => {
  const storage = new Map<string, unknown>([['devUser', 'member'],
    ['irlProfileOfferIntent', { eventId: 'event-offered', owner: 'dev:member' }]]);
  const { get } = profileGet([currentOffer]);
  const profile = mount('me', storage, get, async () => {
    throw Object.assign(new Error('活动规则已更新，请刷新'), { code: 'VERSION_CONFLICT' });
  });
  await profile.page.onShow();
  await profile.page.acceptOffer({ currentTarget: { dataset: { id: 'offer-target', version: 7 } } });
  assert.equal(profile.page.data.notifications[0].actionable, false);
  assert.equal(profile.page.data.notifications[0].declinable, false);
  assert.match(profile.page.data.message, /活动规则已更新/);
});

test('a delayed offer acceptance cannot clear the next account offer focus or show its success banner', async () => {
  const storage = new Map<string, unknown>([['devUser', 'member-a'],
    ['irlProfileOfferIntent', { eventId: 'event-offered', owner: 'dev:member-a' }]]);
  const nextEvent = { ...offeredEvent, id: 'event-next' };
  const nextOffer = { ...currentOffer, id: 'notice-next', event_id: 'event-next',
    detail: { ...currentOffer.detail, offerId: 'offer-next' } };
  const get = async (path: string) => {
    const nextAccount = storage.get('devUser') === 'member-b';
    if (path === '/me/events') return { items: nextAccount ? [nextEvent] : [offeredEvent] };
    if (path === '/me/notifications?offset=0') return { items: nextAccount ? [nextOffer] : [currentOffer],
      total: 1, nextOffset: null, snapshot };
    if (path === '/events/event-offered' || path === '/events/event-next')
      return { id: path.slice('/events/'.length), version: 7 };
    if (path === '/me/consents') return { eventReminder: false };
    if (path === '/me/similar-invites') return { granted: false };
    return { items: [] };
  };
  let releaseAcceptance!: () => void;
  const profile = mount('me', storage, get, () => new Promise(resolve => {
    releaseAcceptance = () => resolve({});
  }));
  await profile.page.onShow();
  assert.equal(profile.page.data.focusedOfferId, 'notice-target');
  const accepting = profile.page.acceptOffer({ currentTarget: { dataset: { id: 'offer-target', version: 7 } } });
  storage.set('devUser', 'member-b');
  storage.set('irlProfileOfferIntent', { eventId: 'event-next', owner: 'dev:member-b' });
  await profile.page.onShow();
  assert.equal(profile.page.data.focusedOfferId, 'notice-next');
  releaseAcceptance();
  await accepting;
  assert.equal(profile.page.data.focusedOfferId, 'notice-next');
  assert.equal(profile.page.data.offerFocusMessage, '请核对补位截止时间，再选择确认或放弃。');
  assert.equal(profile.page.data.message, '');
});

test('a delayed offer rejection cannot show the previous account error on the next account', async () => {
  const storage = new Map<string, unknown>([['devUser', 'member-a'],
    ['irlProfileOfferIntent', { eventId: 'event-offered', owner: 'dev:member-a' }]]);
  const { get: originalGet } = profileGet([currentOffer]);
  const get = async (path: string) => storage.get('devUser') === 'member-b' && path === '/me/events'
    ? { items: [] } : storage.get('devUser') === 'member-b' && path === '/me/notifications?offset=0'
      ? { items: [], total: 0, nextOffset: null, snapshot } : originalGet(path);
  let rejectDecline!: () => void;
  const profile = mount('me', storage, get, () => new Promise((_resolve, reject) => {
    rejectDecline = () => reject(Object.assign(new Error('旧账号的补位已失效'), { code: 'OFFER_UNAVAILABLE' }));
  }));
  await profile.page.onShow();
  const declining = profile.page.declineOffer({ currentTarget: { dataset: { id: 'offer-target', version: 7 } } });
  storage.set('devUser', 'member-b');
  await profile.page.onShow();
  assert.equal(profile.page.data.message, '');
  rejectDecline();
  await declining;
  assert.equal(profile.page.data.message, '');
  assert.deepEqual(JSON.stringify(profile.page.data.notifications), '[]');
});
