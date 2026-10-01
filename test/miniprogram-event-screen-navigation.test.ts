import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);

function eventPage(apiPost?: (path: string, body: Record<string, unknown>) => Promise<unknown>) {
  let page: Record<string, any> | undefined;
  const scrolls: Record<string, unknown>[] = [];
  const routes: string[] = [];
  const storage = new Map<string, unknown>();
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { post: apiPost } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); },
      getSystemInfoSync() { return { statusBarHeight: 20 }; },
      pageScrollTo(options: Record<string, unknown>) { scrolls.push(options); },
      navigateBack({ success }: { success?: () => void }) { routes.push('back'); success?.(); },
      navigateTo({ url }: { url: string }) { routes.push(url); },
      switchTab({ url }: { url: string }) { routes.push(url); }
    },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>, callback?: () => void) {
    Object.assign(this.data, patch);
    callback?.();
  };
  page.setData({
    event: { id: 'e1', status: 'CONFIRMED', version: 3 },
    isHost: true,
    canManageCheckins: true,
    loadState: 'READY'
  });
  return { page, scrolls, routes, storage };
}

test('activity subsections open as focused screens and back returns to event details', () => {
  const { page, scrolls, routes } = eventPage();
  page.jumpToSection({ currentTarget: { dataset: { section: 'hostSection' } } });
  assert.equal(page.data.activeSection, 'hostSection');
  assert.equal(page.data.sectionTitle, '主办方工作台');
  assert.equal(scrolls.at(-1)?.scrollTop, 0);
  assert.equal(scrolls.at(-1)?.duration, 0);

  page.goBack();
  assert.equal(page.data.activeSection, 'detailsSection');
  assert.equal(page.data.sectionTitle, '活动详情');
  assert.deepEqual(routes, [], 'back from a section must keep the live event open');

  page.goBack();
  assert.deepEqual(routes, ['back']);
});

test('only an authorized organizer can enter the QR display mode', () => {
  const { page } = eventPage();
  page.setData({ isHost: false, canManageCheckins: false });
  page.selectCheckInMode({ currentTarget: { dataset: { mode: 'host' } } });
  assert.equal(page.data.checkInMode, 'participant');

  page.setData({ canManageCheckins: true });
  page.selectCheckInMode({ currentTarget: { dataset: { mode: 'host' } } });
  assert.equal(page.data.checkInMode, 'host');
  page.selectCheckInMode({ currentTarget: { dataset: { mode: 'participant' } } });
  assert.equal(page.data.checkInMode, 'participant');
});

test('pending review cancellation link focuses the live exit control only for its member and activity', async () => {
  const { page, scrolls } = eventPage();
  const markup = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  assert.match(markup, /id="leaveButton"[^>]*bindtap="leave"/);
  const live = { event: { id: 'e1', status: 'RECRUITING' }, loadState: 'READY',
    currentUser: 'host', isHost: false, myRegistration: { id: 'r1', event_id: 'e1', status: 'REQUESTED' } };
  page.refresh = async function () { this.setData(live); return true; };
  await page.onLoad({ id: 'e1', section: 'registrationSection', entry: 'pendingExit' });
  assert.equal(page.data.activeSection, 'registrationSection');
  assert.equal(scrolls.at(-1)?.selector, '#leaveButton');

  page.refresh = async function () { this.setData({ ...live, event: { id: 'e1', status: 'REVIEW_PENDING' } }); return true; };
  scrolls.length = 0;
  await page.onLoad({ id: 'e1', section: 'registrationSection', entry: 'pendingExit' });
  assert.equal(scrolls.at(-1)?.selector, '#leaveButton', 'a pending review can still exit its request');

  for (const changed of [
    { event: { id: 'another', status: 'RECRUITING' } },
    { currentUser: 'someone-else' },
    { myRegistration: { id: 'r1', event_id: 'another', status: 'REQUESTED' } },
    { myRegistration: { id: 'r1', status: 'CONFIRMED' } },
    { event: { id: 'e1', status: 'IN_PROGRESS' } }
  ]) {
    page.refresh = async function () { this.setData({ ...live, ...changed }); return true; };
    scrolls.length = 0;
    await page.onLoad({ id: 'e1', section: 'registrationSection', entry: 'pendingExit' });
    assert.notEqual(scrolls.at(-1)?.selector, '#leaveButton', 'stale or ineligible state must not focus exit');
  }
});

test('pending request exit rechecks a newly approved seat before its first cancellation tap', async () => {
  const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
  const { page, routes } = eventPage(async (path, body) => { posts.push({ path, body }); return { status: 'CANCELLED' }; });
  let status = 'REQUESTED';
  let refreshes = 0;
  page.refresh = async function () {
    refreshes++;
    this.setData({ event: { id: 'e1', status: 'RECRUITING', version: 3 }, loadState: 'READY',
      currentUser: 'host', isHost: false, registrationLabel: status === 'REQUESTED' ? '待主办方审核' : '已确认报名',
      myRegistration: { id: 'r1', event_id: 'e1', status } });
    return true;
  };
  await page.onLoad({ id: 'e1', section: 'registrationSection', entry: 'pendingExit' });
  status = 'CONFIRMED';
  await page.leave();
  assert.equal(refreshes, 2, 'the exit tap must read the member status again');
  assert.equal(posts.length, 0, 'the old request action cannot cancel a newly confirmed seat');
  assert.equal(page.data.registrationLabel, '已确认报名');
  assert.match(page.data.message, /状态已变化|状态已变更/);
  assert.deepEqual(routes, []);

  await page.leave();
  assert.equal(posts.length, 0, 'a queued second tap must not cancel before the new state is reviewed');
  await page.onLoad({ id: 'e1', section: 'registrationSection' });
  await page.leave();
  assert.equal(posts.length, 1, 'reopening the current activity provides a new explicit exit path');
  assert.equal(posts[0]?.path, '/registrations/r1/cancel');
  assert.equal(posts[0]?.body.expectedStatus, undefined);
});

test('pending request exit sends a conditional cancellation after a fresh unchanged read', async () => {
  const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
  let status = 'REQUESTED';
  const { page, routes } = eventPage(async (path, body) => {
    posts.push({ path, body });
    status = 'CANCELLED';
    return { status };
  });
  page.refresh = async function () {
    this.setData({ event: { id: 'e1', status: 'RECRUITING', version: 3 }, loadState: 'READY',
      currentUser: 'host', isHost: false,
      myRegistration: { id: 'r1', event_id: 'e1', status } });
    return true;
  };
  await page.onLoad({ id: 'e1', section: 'registrationSection', entry: 'pendingExit' });
  await page.leave();
  assert.equal(posts.length, 1);
  assert.equal(posts[0]?.path, '/registrations/r1/cancel');
  assert.equal(posts[0]?.body.expectedStatus, 'REQUESTED');
  assert.deepEqual(routes, ['/pages/index/index']);

  status = 'CONFIRMED';
  posts.length = 0;
  routes.length = 0;
  await page.onLoad({ id: 'e1', section: 'registrationSection', entry: 'pendingExit' });
  await page.leave();
  assert.equal(posts.length, 0, 'an application approved before the destination loads still needs a new decision');
  assert.deepEqual(routes, []);
});

test('an approval between the final read and conditional POST leaves the new seat untouched in the UI', async () => {
  let status = 'REQUESTED';
  const { page, routes } = eventPage(async (_path, body) => {
    assert.equal(body.expectedStatus, 'REQUESTED');
    status = 'CONFIRMED';
    throw Object.assign(new Error('报名状态已变化'), { code: 'REGISTRATION_CHANGED' });
  });
  page.refresh = async function () {
    this.setData({ event: { id: 'e1', status: 'RECRUITING', version: 3 }, loadState: 'READY',
      currentUser: 'host', isHost: false, registrationLabel: status === 'REQUESTED' ? '待主办方审核' : '已确认报名',
      myRegistration: { id: 'r1', event_id: 'e1', status } });
    return true;
  };
  await page.onLoad({ id: 'e1', section: 'registrationSection', entry: 'pendingExit' });
  await page.leave();
  assert.equal(page.data.myRegistration.status, 'CONFIRMED');
  assert.equal(page.data.registrationLabel, '已确认报名');
  assert.match(page.data.message, /状态已变化/);
  assert.deepEqual(routes, []);
});

test('home host check-in link selects verifier only for a live organizer', async () => {
  const { page, scrolls } = eventPage();
  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: { id: 'e1', status: 'IN_PROGRESS' },
      isHost: true, canManageCheckins: true });
    return true;
  };
  await page.onLoad({ id: 'e1', section: 'checkinSection', entry: 'hostCheckin' });
  assert.equal(page.data.activeSection, 'checkinSection');
  assert.equal(page.data.checkInMode, 'host');
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0]?.scrollTop, 0);
  assert.equal(scrolls[0]?.duration, 0);

  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: { id: 'e1', status: 'IN_PROGRESS' },
      isHost: false, canManageCheckins: true });
    return true;
  };
  scrolls.length = 0;
  await page.onLoad({ id: 'e1', section: 'checkinSection', entry: 'hostCheckin' });
  assert.equal(page.data.checkInMode, 'participant', 'delegated check-in access does not become organizer mode via Home');
  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: { id: 'e1', status: 'COMPLETED' },
      isHost: true, canManageCheckins: true });
    return true;
  };
  await page.onLoad({ id: 'e1', section: 'checkinSection', entry: 'hostCheckin' });
  assert.equal(page.data.checkInMode, 'participant', 'a completed event cannot reopen the live organizer shortcut');
});

test('home organizer announcement link locates the real composer only for the current recruiting host', async () => {
  const { page, scrolls } = eventPage();
  const markup = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  assert.match(markup, /id="hostAnnouncementForm"[^>]*wx:if="{{event\.status === 'RECRUITING'/);
  assert.match(markup, /id="hostAnnouncementAnchor"[\s\S]*?id="hostAnnouncementForm"/,
    'the announcement deep link needs a scroll target above the sticky titlebar');
  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: { id: 'e1', status: 'RECRUITING',
      reviewStatus: 'APPROVED', recruiting: true },
      isHost: true, canManageAnnouncements: true });
    return true;
  };
  await page.onLoad({ id: 'e1', section: 'hostSection', entry: 'hostAnnouncement' });
  assert.equal(page.data.activeSection, 'hostSection');
  assert.equal(scrolls[0]?.selector, '#hostAnnouncementAnchor');

  for (const state of [
    { id: 'e1', status: 'RECRUITING', reviewStatus: 'APPROVED', recruiting: true, isHost: false, canManageAnnouncements: true },
    { id: 'e1', status: 'RECRUITING', reviewStatus: 'APPROVED', recruiting: true, isHost: true, canManageAnnouncements: false },
    { id: 'e1', status: 'RECRUITING', reviewStatus: 'PENDING', recruiting: false, isHost: true, canManageAnnouncements: true },
    { id: 'e1', status: 'COMPLETED', reviewStatus: 'APPROVED', recruiting: false, isHost: true, canManageAnnouncements: true },
    { id: 'e2', status: 'RECRUITING', reviewStatus: 'APPROVED', recruiting: true, isHost: true, canManageAnnouncements: true }
  ]) {
    page.refresh = async function () {
      this.setData({ loadState: 'READY', event: { id: state.id, status: state.status,
        reviewStatus: state.reviewStatus, recruiting: state.recruiting },
        isHost: state.isHost, canManageAnnouncements: state.canManageAnnouncements });
      return true;
    };
    scrolls.length = 0;
    await page.onLoad({ id: 'e1', section: 'hostSection', entry: 'hostAnnouncement' });
    assert.equal(scrolls[0]?.selector, undefined, `ineligible ${JSON.stringify(state)} stays on host overview`);
  }
});

test('history host repeat link locates the existing button only for a current completed safe event', async () => {
  const posts: string[] = [];
  const { page, scrolls } = eventPage(async path => { posts.push(path); return {}; });
  const markup = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  assert.match(markup, /id="hostRepeatAnchor"[\s\S]*?id="repeatDraftButton"[^>]*wx:if="{{safetyStatus === 'OPEN' && event\.status === 'COMPLETED'}}"/);
  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: { id: 'e1', status: 'COMPLETED' },
      isHost: true, safetyStatus: 'OPEN' });
    return true;
  };
  await page.onLoad({ id: 'e1', section: 'hostSection', entry: 'hostRepeat' });
  assert.equal(page.data.activeSection, 'hostSection');
  assert.equal(scrolls[0]?.selector, '#hostRepeatAnchor');
  assert.deepEqual(posts, [], 'a deep link only reveals the repeat button');

  for (const state of [
    { id: 'e1', status: 'IN_PROGRESS', host: true, safety: 'OPEN' },
    { id: 'e1', status: 'COMPLETED', host: false, safety: 'OPEN' },
    { id: 'e1', status: 'COMPLETED', host: true, safety: 'CLOSED' },
    { id: 'e1', status: 'COMPLETED', host: true, safety: 'UNKNOWN' },
    { id: 'e2', status: 'COMPLETED', host: true, safety: 'OPEN' }
  ]) {
    page.refresh = async function () {
      this.setData({ loadState: 'READY', event: { id: state.id, status: state.status },
        isHost: state.host, safetyStatus: state.safety });
      return true;
    };
    scrolls.length = 0;
    await page.onLoad({ id: 'e1', section: 'hostSection', entry: 'hostRepeat' });
    assert.equal(scrolls[0]?.selector, undefined, `ineligible ${JSON.stringify(state)} stays on the overview`);
    assert.deepEqual(posts, []);
  }
});

test('home feedback link locates the form or existing record only for confirmed members of completed events', async () => {
  const { page, scrolls } = eventPage();
  const markup = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  assert.match(markup, /id="feedbackForm"[^>]*wx:if="{{outcome && !isHost && myRegistration.status === 'CONFIRMED' && !outcome.myFeedbackSubmitted}}"/);
  assert.match(markup, /id="memberFeedbackCard"[^>]*wx:if="{{outcome && !isHost && myRegistration.status === 'CONFIRMED'}}"/,
    'an already submitted member needs a stable card anchor, without reopening the form');
  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: { id: 'e1', status: 'COMPLETED' },
      isHost: false, myRegistration: { status: 'CONFIRMED' },
      outcome: { myFeedbackSubmitted: false }, outcomeLoadState: 'READY', currentUser: 'host' });
    return true;
  };
  await page.onLoad({ id: 'e1', section: 'checkinSection', entry: 'memberFeedback' });
  assert.equal(page.data.activeSection, 'checkinSection');
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0]?.selector, '#feedbackForm');
  assert.equal(scrolls[0]?.duration, 0);

  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: { id: 'e1', status: 'COMPLETED' },
      isHost: false, myRegistration: { status: 'CONFIRMED' },
      outcome: { myFeedbackSubmitted: true }, outcomeLoadState: 'READY', currentUser: 'host' });
    return true;
  };
  scrolls.length = 0;
  await page.onLoad({ id: 'e1', section: 'checkinSection', entry: 'memberFeedback' });
  assert.equal(page.data.activeSection, 'checkinSection');
  assert.equal(scrolls[0]?.selector, '#memberFeedbackCard');

  for (const state of [
    { status: 'IN_PROGRESS', host: false, registration: 'CONFIRMED', submitted: false },
    { status: 'COMPLETED', host: false, registration: 'REQUESTED', submitted: false },
    { status: 'COMPLETED', host: true, registration: 'CONFIRMED', submitted: false },
    { status: 'COMPLETED', host: false, registration: 'CONFIRMED', submitted: false, evidence: 'ERROR' },
    { status: 'COMPLETED', host: false, registration: 'CONFIRMED', submitted: false, actor: '' }
  ] as Array<{ status: string; host: boolean; registration: string; submitted: boolean;
    evidence?: string; actor?: string }>) {
    page.refresh = async function () {
      this.setData({ loadState: 'READY', event: { id: 'e1', status: state.status },
        isHost: state.host, myRegistration: { status: state.registration },
        outcome: { myFeedbackSubmitted: state.submitted }, outcomeLoadState: state.evidence || 'READY',
        currentUser: state.actor === undefined ? 'host' : state.actor });
      return true;
    };
    scrolls.length = 0;
    await page.onLoad({ id: 'e1', section: 'checkinSection', entry: 'memberFeedback' });
    assert.equal(scrolls.length, 1);
    assert.equal(scrolls[0]?.scrollTop, 0, `ineligible ${JSON.stringify(state)} stays on section overview`);
  }

  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: { id: 'different-event', status: 'COMPLETED' },
      isHost: false, myRegistration: { status: 'CONFIRMED' },
      outcome: { myFeedbackSubmitted: false }, outcomeLoadState: 'READY', currentUser: 'host' });
    return true;
  };
  scrolls.length = 0;
  await page.onLoad({ id: 'e1', section: 'checkinSection', entry: 'memberFeedback' });
  assert.equal(scrolls[0]?.scrollTop, 0, 'a mismatched activity stays on the section overview');
});

test('profile alias link locates the form only when the same activity can edit its alias', async () => {
  const { page, scrolls } = eventPage();
  const markup = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
  assert.ok(markup.includes('id="aliasForm" wx:if="{{canSetAlias}}"'),
    'the alias form needs a stable scroll target only when editing is available');
  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: { id: 'e1', status: 'CONFIRMED' },
      canSetAlias: true, aliasLoadState: 'READY' });
    return true;
  };
  await page.onLoad({ id: 'e1', section: 'registrationSection', entry: 'alias' });
  assert.equal(page.data.activeSection, 'registrationSection');
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0]?.selector, '#aliasForm');

  for (const state of [
    { eventId: 'e1', canSetAlias: false, aliasLoadState: 'READY' },
    { eventId: 'e1', canSetAlias: true, aliasLoadState: 'ERROR' },
    { eventId: 'e2', canSetAlias: true, aliasLoadState: 'READY' }
  ]) {
    page.refresh = async function () {
      this.setData({ loadState: 'READY', event: { id: state.eventId, status: 'CONFIRMED' },
        canSetAlias: state.canSetAlias, aliasLoadState: state.aliasLoadState });
      return true;
    };
    scrolls.length = 0;
    await page.onLoad({ id: 'e1', section: 'registrationSection', entry: 'alias' });
    assert.equal(scrolls.length, 1);
    assert.equal(scrolls[0]?.scrollTop, 0, `ineligible ${JSON.stringify(state)} stays in registration overview`);
  }
});

test('completed member can start another event without repeating or publishing the old one', () => {
  const { page, routes, storage } = eventPage();
  page.setData({ id: 'e1', event: { id: 'e1', status: 'COMPLETED' }, outcome: { myFeedbackSubmitted: true },
    outcomeLoadState: 'READY',
    isHost: false, myRegistration: { status: 'CONFIRMED' }, currentUser: 'host' });
  page.startAnotherEvent();
  assert.deepEqual(routes, ['/pages/create/create']);
  assert.equal((storage.get('irlCreateFreshIntent') as { owner: string })?.owner, 'dev:host');

  routes.length = 0;
  page.setData({ event: { id: 'e1', status: 'IN_PROGRESS' } });
  page.startAnotherEvent();
  assert.deepEqual(routes, [], 'live events cannot expose the completed-feedback shortcut');
  page.setData({ event: { id: 'e1', status: 'COMPLETED' }, myRegistration: { status: 'REQUESTED' } });
  page.startAnotherEvent();
  assert.deepEqual(routes, [], 'unconfirmed members cannot use the completed-feedback shortcut');
  page.setData({ id: 'e2', myRegistration: { status: 'CONFIRMED' } });
  page.startAnotherEvent();
  assert.deepEqual(routes, [], 'a stale activity card cannot open a new event from another activity route');
});

test('feedback accepts one in-flight tap and allows a retry after an uncertain response', async () => {
  let settleFirst: ((error?: Error) => void) | undefined;
  const sent: Array<{ path: string; body: Record<string, unknown> }> = [];
  const { page } = eventPage((path, body) => {
    sent.push({ path, body });
    if (sent.length === 1) return new Promise((_resolve, reject) => {
      settleFirst = error => reject(error);
    });
    return Promise.resolve({});
  });
  page.setData({ id: 'e1', event: { id: 'e1', status: 'COMPLETED', version: 3 },
    isHost: false, currentUser: 'host', outcome: { myFeedbackSubmitted: false },
    outcomeLoadState: 'READY', myRegistration: { status: 'CONFIRMED' },
    feedbackHeld: true, feedbackWouldRepeat: true, feedbackReason: '场地安排有偏差' });
  page.refresh = async () => true;

  const first = page.submitFeedback();
  await page.submitFeedback();
  assert.equal(sent.length, 1, 'the second tap must not submit while the first request is pending');
  settleFirst?.(Object.assign(new Error('提交结果尚未确认'), { code: 'NETWORK_ERROR' }));
  await first;
  assert.equal(page.data.feedbackUncertain, true);
  page.setData({ feedbackReason: '后来修改的说明' });
  await page.submitFeedback();
  assert.equal(sent.length, 2, 'retry must be available after an uncertain response');
  assert.deepEqual(sent[1]?.body, sent[0]?.body, 'same feedback payload lets the API reuse its pending idempotency key');
  assert.equal(page.data.feedbackUncertain, false);
});

test('old feedback response cannot refresh or announce success in a different session or activity', async () => {
  for (const changed of ['session', 'activity']) {
    let settle: (() => void) | undefined;
    let refreshed = 0;
    const { page, storage } = eventPage(() => new Promise(resolve => { settle = () => resolve({}); }));
    page.setData({ id: 'e1', event: { id: 'e1', status: 'COMPLETED', version: 3 },
      isHost: false, currentUser: 'host', outcome: { myFeedbackSubmitted: false },
      outcomeLoadState: 'READY', myRegistration: { status: 'CONFIRMED' },
      feedbackHeld: true, feedbackWouldRepeat: false });
    page.refresh = async () => { refreshed++; return true; };
    const submitting = page.submitFeedback();
    if (changed === 'session') {
      storage.set('devUser', 'another-user');
      page.setData({ currentUser: 'another-user' });
    } else {
      page.setData({ id: 'e2', event: { id: 'e2', status: 'COMPLETED', version: 1 } });
    }
    settle?.();
    await submitting;
    assert.equal(refreshed, 0, `${changed} change must not trigger an old feedback refresh`);
    assert.equal(page.data.message, '', `${changed} change must not show an old feedback success message`);
  }
});

test('confirmed registration success opens live details or the existing itinerary route', () => {
  const { page, routes } = eventPage();
  page.setData({ successState: 'JOINED', activeSection: 'detailsSection',
    myRegistration: { status: 'CONFIRMED' } });
  page.jumpToSection({ currentTarget: { dataset: { section: 'checkinSection' } } });
  assert.equal(page.data.successState, '', 'leaving success card must reveal the destination');
  assert.equal(page.data.activeSection, 'checkinSection');
  page.setData({ successState: 'JOINED' });
  page.viewSuccessDetails();
  assert.equal(page.data.successState, '');
  assert.equal(page.data.activeSection, 'detailsSection');
  page.goToItinerary();
  assert.deepEqual(routes, ['/subpackages/activity/itinerary/itinerary']);
});

test('the unsure choice records interest without presenting a confirmed seat', async () => {
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  let posted = false;
  const { page } = eventPage(async (path, body) => {
    writes.push({ path, body });
    posted = true;
    return { id: 'r-interest', status: 'INTERESTED' };
  });
  const liveEvent = { id: 'e1', version: 3, status: 'RECRUITING', recruiting: true,
    payload: { title: '周末羽毛球', startAt: '2027-01-02T12:00:00Z', endAt: '2027-01-02T14:00:00Z',
      city: '深圳', venueName: '测试球馆', maxParticipants: 6, feeMode: 'FREE', approvalMode: 'AUTO' },
    stats: { confirmed: 1 } };
  page.setData({ event: liveEvent, id: 'e1', token: 'invite-token', currentUser: 'host', canJoin: true,
    canExpressInterest: true, isHost: false, successState: '' });
  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: liveEvent, canJoin: !posted,
      canExpressInterest: !posted, myRegistration: posted ? { id: 'r-interest', status: 'INTERESTED' } : null });
    return true;
  };
  page.openJoinConfirmation();
  page.selectJoinChoice({ currentTarget: { dataset: { choice: 'INTERESTED' } } });
  assert.equal(page.data.joinChoice, 'INTERESTED');
  await page.confirmJoin();
  assert.equal(page.data.myRegistration.status, 'INTERESTED');
  assert.equal(page.data.successState, '');
  assert.equal(page.data.joinConfirmation, null);
  assert.equal(writes.length, 1);
  const write = writes[0]!;
  assert.equal(write.path, '/events/e1/interests');
  assert.equal(write.body.inviteToken, 'invite-token');
  assert.equal(write.body.expectedVersion, 3);
});

test('a rejected publication no longer shows the submitted success screen', () => {
  const { page } = eventPage();
  page.setData({ successState: 'PUBLISHED', isHost: true,
    event: { id: 'e1', status: 'RECRUITING', reviewStatus: 'REJECTED' } });
  page.reconcileSuccessState();
  assert.equal(page.data.successState, '');
});
