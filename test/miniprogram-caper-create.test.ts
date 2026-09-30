import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function loadPage(now: number, apiOverrides: Record<string, any> = {}) {
  let page: Record<string, any> | undefined;
  const routes: string[] = [];
  const storage = new Map<string, unknown>();
  const scrolls: Array<Record<string, unknown>> = [];
  const toasts: Array<Record<string, unknown>> = [];
  const actionSheets: Array<{ itemList: string[]; success: (result: { tapIndex: number }) => void }> = [];
  class Clock extends Date {
    static now() { return now; }
  }
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: apiOverrides };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    Date: Clock,
    setTimeout,
    clearTimeout,
    wx: {
      getWindowInfo() { return { statusBarHeight: 0 }; },
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); },
      removeStorageSync(key: string) { storage.delete(key); },
      switchTab({ url }: { url: string }) { routes.push(url); },
      navigateTo({ url }: { url: string }) { routes.push(url); },
      pageScrollTo(options: Record<string, unknown>) { scrolls.push(options); },
      showActionSheet(options: { itemList: string[]; success: (result: { tapIndex: number }) => void }) { actionSheets.push(options); },
      showToast(options: Record<string, unknown>) { toasts.push(options); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>, done?: () => void) { Object.assign(this.data, patch); done?.(); };
  return { page, routes, storage, scrolls, toasts, actionSheets };
}

test('review more menu lets the host edit the draft or open the saved drafts list', () => {
  const { page, actionSheets, routes, storage } = loadPage(Date.now());
  page.setData({ stage: 'REVIEW', publishPreview: { id: 'draft-1' } });

  page.openHeaderAction();
  assert.deepEqual(Array.from(actionSheets[0]?.itemList || []), ['返回编辑', '我的草稿']);
  actionSheets[0]?.success({ tapIndex: 0 });
  assert.equal(page.data.stage, 'FORM');
  assert.equal(page.data.publishPreview, null);

  page.setData({ stage: 'REVIEW', publishPreview: { id: 'draft-1' } });
  page.openHeaderAction();
  actionSheets[1]?.success({ tapIndex: 1 });
  assert.deepEqual(routes, ['/pages/index/index']);
  assert.equal(storage.get('irlHomeTabIntent'), 'drafts');
});

test('reference form shortcuts fill supported city and participant range, while unsupported category stays closed', () => {
  const { page, toasts } = loadPage(Date.now());
  page.chooseQuickCity({ currentTarget: { dataset: { city: '上海' } } });
  page.chooseParticipantRange({ currentTarget: { dataset: { range: '5-10' } } });
  assert.equal(page.data.form.city, '上海');
  assert.equal(page.data.form.minParticipants, '5');
  assert.equal(page.data.form.maxParticipants, '10');
  assert.equal(page.buildInput().maxParticipants, 10);
  page.showUnavailable({ currentTarget: { dataset: { name: '咖啡聊天' } } });
  assert.match(page.data.message, /咖啡聊天.*暂未开放/);
  assert.equal(toasts[0]?.icon, 'none', 'a button deep in the long form must provide immediate visible feedback');
  assert.equal(page.buildInput().type, 'badminton');
});

test('reference coffee inspiration reports the R1 boundary without changing the badminton draft', () => {
  const { page, toasts } = loadPage(Date.now());
  page.selectInspiration({ currentTarget: { dataset: { index: 1 } } });
  assert.equal(page.data.aiText, '');
  assert.match(page.data.message, /创业者咖啡.*暂未开放/);
  assert.equal(toasts[0]?.icon, 'none');
  assert.equal(page.buildInput().type, 'badminton');
});

test('fee tiles change the real publish payload between free and AA', () => {
  const { page } = loadPage(Date.now());
  page.chooseFeeMode({ currentTarget: { dataset: { mode: 'FREE' } } });
  assert.equal(page.buildInput().feeMode, 'FREE');
  assert.equal(page.buildInput().feeCapFen, 0);
  page.chooseFeeMode({ currentTarget: { dataset: { mode: 'AA' } } });
  assert.equal(page.buildInput().feeMode, 'AA');
  assert.equal(page.buildInput().feeCapFen, 5000);
});

test('review rows return to the corresponding editable section', () => {
  const { page, scrolls } = loadPage(Date.now());
  page.setData({ stage: 'REVIEW', publishPreview: { id: 'draft-1' } });
  page.editReviewSection({ currentTarget: { dataset: { section: 'schedule' } } });
  assert.equal(page.data.stage, 'FORM');
  assert.equal(page.data.publishPreview, null);
  assert.equal(scrolls[0]?.selector, '#form-schedule');
  assert.equal(scrolls[0]?.duration, 0);
});

test('quick schedule uses Shanghai day and clears stale venue confirmation', () => {
  // 2026-09-29 16:01 UTC is already Wednesday in Shanghai.
  const { page } = loadPage(Date.parse('2026-09-29T16:01:00Z'));
  page.setData({ venueConfirmed: true });
  page.chooseQuickDate({ currentTarget: { dataset: { choice: 'saturday' } } });
  assert.equal(page.data.startDate, '2026-10-03');
  assert.equal(page.data.endDate, '2026-10-03');
  assert.equal(page.data.venueConfirmed, false);
  page.setData({ venueConfirmed: true });
  page.chooseQuickTime({ currentTarget: { dataset: { choice: 'evening' } } });
  assert.equal(page.data.startTime, '18:00');
  assert.equal(page.data.endTime, '21:00');
  assert.equal(page.data.venueConfirmed, false);
});

test('published event editor back action returns to a valid tab', () => {
  const { page, routes } = loadPage(Date.now());
  page.setData({ stage: 'FORM', editingEvent: { id: 'event-1' } });
  page.backFromCreate();
  assert.deepEqual(routes, ['/pages/index/index']);
});

test('cohost shortcut reaches the published activity workbench', () => {
  const { page, routes } = loadPage(Date.now());
  page.setData({ stage: 'FORM', editingEvent: { id: 'event-host', version: 2 } });
  page.openCohostSetup();
  assert.deepEqual(routes, ['/pages/event/event?id=event-host&section=hostSection']);
});

test('a late activity suggestion from an old account cannot fill the next account editor', async () => {
  let releaseSuggestion!: (value: unknown) => void;
  const response = new Promise(resolve => { releaseSuggestion = resolve; });
  const { page, storage } = loadPage(Date.now(), {
    post: async (route: string) => {
      assert.equal(route, '/events/drafts:suggest-local');
      return response;
    }
  });
  page.setData({ aiText: '周末羽毛球' });
  const inFlight = page.suggest();
  storage.set('devUser', 'another-member');
  releaseSuggestion({ fields: { title: '旧账号的活动草稿' }, fieldSources: { title: 'USER_EXPLICIT' },
    draft: { id: 'old-draft' }, unknown: [] });
  await inFlight;

  assert.equal(page.data.stage, 'IDEA');
  assert.equal(page.data.form.title, '');
  assert.equal(page.data.draft, null);
  assert.equal(page.data.aiText, '');
});

test('a delayed draft save from an old account cannot install that draft in the next account editor', async () => {
  let releaseSave!: (value: unknown) => void;
  const response = new Promise(resolve => { releaseSave = resolve; });
  const { page, storage } = loadPage(Date.now(), { post: async (route: string) => {
    assert.equal(route, '/events');
    return response;
  } });
  page.setData({ stage: 'FORM', safetyStatus: 'OPEN', form: { ...page.data.form, title: '原账号周末羽毛球' } });
  const inFlight = page.saveDraft();
  storage.set('devUser', 'another-member');
  releaseSave({ id: 'old-draft', version: 1, payload: { title: '原账号周末羽毛球' } });
  assert.equal(await inFlight, null);
  assert.equal(page.data.draft, null);
  assert.equal(page.data.form.title, '');
  assert.equal(page.data.stage, 'IDEA');
});

test('a delayed published-event change preview cannot show another account its activity details', async () => {
  let releasePreview!: (value: unknown) => void;
  const response = new Promise(resolve => { releasePreview = resolve; });
  const { page, storage } = loadPage(Date.now(), { post: async (route: string) => {
    assert.equal(route, '/events/event-1/changes:preview');
    return response;
  } });
  page.setData({ hostParticipates: true, venueConfirmed: true });
  page.setData({ editingEvent: { id: 'event-1', version: 2, payload: page.buildInput() }, stage: 'FORM' });
  const inFlight = page.publish();
  storage.set('devUser', 'another-member');
  releasePreview({ changes: [], affectedCount: 0, material: false });
  await inFlight;
  assert.equal(page.data.changePreview, null);
  assert.equal(page.data.editingEvent, null);
  assert.equal(page.data.stage, 'IDEA');
});

test('a delayed publish response cannot navigate the next account to the old account event', async () => {
  let releasePublish!: (value: unknown) => void;
  const response = new Promise(resolve => { releasePublish = resolve; });
  const { page, storage, routes } = loadPage(Date.now(), { post: async (route: string) => {
    assert.equal(route, '/events/old-draft/publish');
    return response;
  } });
  page.setData({ safetyStatus: 'OPEN', stage: 'REVIEW', publishPreview: {
    id: 'old-draft', version: 1, payload: page.buildInput()
  } });
  const inFlight = page.confirmPublish();
  storage.set('devUser', 'another-member');
  releasePublish({ id: 'old-event' });
  await inFlight;
  assert.deepEqual(routes, []);
  assert.equal(page.data.publishPreview, null);
  assert.equal(page.data.stage, 'IDEA');
});

test('drafts shortcut opens only owned drafts and returns to edit the selected one', async () => {
  const { page: create, routes, storage } = loadPage(Date.now());
  create.openDrafts();
  assert.deepEqual(routes, ['/pages/index/index']);

  let home: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/index/index.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (route: string) => {
        if (route === '/me/events') return { items: [
          { id: 'draft-1', title: '周六羽毛球', status: 'DRAFT', isHost: true },
          { id: 'published-1', title: '周日羽毛球', status: 'RECRUITING', isHost: true },
          { id: 'foreign-draft', title: '其他人的草稿', status: 'DRAFT', isHost: false }
        ] };
        if (route === '/events/draft-1') return { id: 'draft-1', hostId: 'host', status: 'DRAFT',
          reviewStatus: 'DRAFT', payload: { title: '周六羽毛球', city: '上海', venueName: '体育馆',
            startAt: '2027-03-22T11:00:00.000Z', endAt: '2027-03-22T13:00:00.000Z',
            minParticipants: 4, maxParticipants: 8, feeMode: 'FREE' },
          stats: { confirmed: 0, reserved: 0, requested: 0, waitlisted: 0 } };
        throw new Error('detail unavailable');
      } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { home = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); },
      removeStorageSync(key: string) { storage.delete(key); },
      switchTab({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(home);
  home.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  await home.onShow();
  assert.equal(home.data.activeTab, 'organized');
  assert.equal(home.data.draftsOnly, true);
  assert.deepEqual(Array.from(home.data.visibleItems, (item: { id: string }) => item.id), ['draft-1']);
  assert.equal(home.data.visibleItems[0].detailLoaded, true);
  assert.equal(storage.has('irlHomeTabIntent'), false);
  home.openCardAction({ currentTarget: { dataset: { id: 'draft-1', action: 'editDraft' } } });
  assert.equal(storage.get('editDraftId'), 'draft-1');
  assert.equal(storage.get('editTargetOwner'), 'dev:host');
  assert.deepEqual(routes, ['/pages/index/index', '/pages/create/create']);
  await home.showAllOrganized();
  assert.equal(home.data.draftsOnly, false);
  assert.deepEqual(Array.from(home.data.visibleItems, (item: { id: string }) => item.id),
    ['draft-1', 'published-1']);
  await home.selectTab({ currentTarget: { dataset: { key: 'attending' } } });
  await home.onShow();
  assert.equal(home.data.activeTab, 'attending', 'the shortcut must not override a later manual tab choice');
});
