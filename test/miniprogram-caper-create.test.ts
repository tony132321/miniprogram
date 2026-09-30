import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

function loadPage(now: number, apiOverrides: Record<string, any> = {}) {
  let page: Record<string, any> | undefined;
  const routes: string[] = [];
  const storage = new Map<string, unknown>();
  const scrolls: Array<Record<string, unknown>> = [];
  const toasts: Array<Record<string, unknown>> = [];
  const actionSheets: Array<{ itemList: string[]; success: (result: { tapIndex: number }) => void }> = [];
  const modals: Array<{ content: string; success: (result: { confirm: boolean }) => void }> = [];
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
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
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
      showModal(options: { content: string; success: (result: { confirm: boolean }) => void }) { modals.push(options); },
      showToast(options: Record<string, unknown>) { toasts.push(options); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>, done?: () => void) { Object.assign(this.data, patch); done?.(); };
  return { page, routes, storage, scrolls, toasts, actionSheets, modals };
}

test('fresh-event intent preserves unsaved editor on cancel and resets to IDEA on confirmation', async () => {
  const { page, storage, modals } = loadPage(Date.now());
  page._shownIdentity = 'dev:host';
  page.loadSafety = async () => {};
  page.setData({ stage: 'FORM', form: { ...page.data.form, title: '尚未保存的周末局' } });
  storage.set('irlCreateFreshIntent', { owner: 'dev:host' });
  const cancelled = page.onShow();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(modals[0]?.content || '', /未保存修改/);
  modals[0]?.success({ confirm: false });
  await cancelled;
  assert.equal(page.data.form.title, '尚未保存的周末局');
  assert.equal(page.data.stage, 'FORM');
  assert.equal(storage.has('irlCreateFreshIntent'), false);

  storage.set('irlCreateFreshIntent', { owner: 'dev:host' });
  storage.set('editDraftId', 'saved-draft-1');
  storage.set('editTargetOwner', 'dev:host');
  const confirmed = page.onShow();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(modals[1]?.content || '', /已保存草稿仍保留/);
  modals[1]?.success({ confirm: true });
  await confirmed;
  assert.equal(page.data.stage, 'IDEA');
  assert.equal(page.data.form.title, '');
  assert.equal(storage.has('editDraftId'), false, 'queued draft edit must not overwrite the fresh IDEA');
  assert.equal(storage.has('editTargetOwner'), false);
});

test('cancelling a fresh-event intent keeps the loaded draft association before opening a queued target', async () => {
  const { page, storage, modals } = loadPage(Date.now());
  page._shownIdentity = 'dev:host';
  page.loadSafety = async () => {};
  page.setData({ stage: 'FORM', editorLoadState: 'READY',
    draft: { id: 'current-draft', version: 3 },
    form: { ...page.data.form, title: '当前未保存修改' } });
  storage.set('editDraftId', 'other-draft');
  storage.set('editTargetOwner', 'dev:host');
  storage.set('irlCreateFreshIntent', { owner: 'dev:host' });

  const showing = page.onShow();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(modals.length, 1);
  modals[0]?.success({ confirm: false });
  await showing;

  assert.equal(page.data.draft?.id, 'current-draft', 'saving must still update the loaded draft');
  assert.equal(page.data.editorLoadState, 'READY', 'the retained editor must remain usable');
  assert.equal(page.data.form.title, '当前未保存修改');
  assert.equal(storage.has('editDraftId'), false, 'queued target must not overwrite the retained editor');
});

test('fresh-event intent survives a queued edit target owned by another session', async () => {
  const { page, storage, modals } = loadPage(Date.now());
  page._shownIdentity = 'dev:host';
  page.loadSafety = async () => {};
  page.setData({ stage: 'FORM', form: { ...page.data.form, title: '旧编辑' } });
  storage.set('editDraftId', 'old-account-draft');
  storage.set('editTargetOwner', 'dev:another-user');
  storage.set('irlCreateFreshIntent', { owner: 'dev:host' });

  const showing = page.onShow();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(modals.length, 1, 'the current user should still be asked before replacing the editor');
  modals[0]?.success({ confirm: true });
  await showing;
  assert.equal(page.data.stage, 'IDEA');
  assert.equal(page.data.form.title, '');
  assert.equal(storage.has('editDraftId'), false);
});

test('fresh-event intent from a different session is consumed without changing the current editor', async () => {
  const { page, storage, modals } = loadPage(Date.now());
  page._shownIdentity = 'dev:new-user';
  page.loadSafety = async () => {};
  storage.set('devUser', 'new-user');
  storage.set('irlCreateFreshIntent', { owner: 'dev:host' });
  page.setData({ stage: 'FORM', form: { ...page.data.form, title: '新账号正在编辑' } });
  await page.onShow();
  assert.equal(page.data.form.title, '新账号正在编辑');
  assert.equal(page.data.stage, 'FORM');
  assert.equal(storage.has('irlCreateFreshIntent'), false);
  assert.equal(modals.length, 0);
});

test('fresh-event intent opens IDEA directly when there is no edit to lose', async () => {
  const { page, storage, modals } = loadPage(Date.now());
  page._shownIdentity = 'dev:host';
  page.loadSafety = async () => {};
  storage.set('irlCreateFreshIntent', { owner: 'dev:host' });
  await page.onShow();
  assert.equal(page.data.stage, 'IDEA');
  assert.equal(storage.has('irlCreateFreshIntent'), false);
  assert.equal(modals.length, 0);
});

test('fresh-event intent asks before discarding schedule edits hidden behind the IDEA screen', async () => {
  const { page, storage, modals } = loadPage(Date.now());
  page._shownIdentity = 'dev:host';
  page.loadSafety = async () => {};
  page.setData({ stage: 'IDEA', startDate: '2026-10-05' });
  storage.set('irlCreateFreshIntent', { owner: 'dev:host' });
  const showing = page.onShow();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(modals[0]?.content || '', /未保存修改/);
  modals[0]?.success({ confirm: false });
  await showing;
  assert.equal(page.data.startDate, '2026-10-05');
});

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

test('changing a quick date keeps a same-day event valid without overwriting a later manual end date', () => {
  const { page } = loadPage(Date.parse('2026-09-29T16:01:00Z'));
  page.chooseQuickDate({ currentTarget: { dataset: { choice: 'saturday' } } });
  page.chooseQuickDate({ currentTarget: { dataset: { choice: 'sunday' } } });
  assert.equal(page.data.startDate, '2026-10-04');
  assert.equal(page.data.endDate, '2026-10-04', 'the old Saturday must not remain as the end date');
  assert.ok(Date.parse(page.buildInput().endAt) > Date.parse(page.buildInput().startAt));

  page.setEndDate({ detail: { value: '2026-10-06' } });
  page.chooseQuickDate({ currentTarget: { dataset: { choice: 'saturday' } } });
  assert.equal(page.data.startDate, '2026-10-03');
  assert.equal(page.data.endDate, '2026-10-06', 'a still-valid manual multi-day end should remain');
});

test('published event editor back action opens the real activity record', () => {
  const { page, routes } = loadPage(Date.now());
  page.setData({ stage: 'FORM', editingEvent: { id: 'event-1' } });
  page.backFromCreate();
  assert.deepEqual(routes, ['/subpackages/profile/moments/moments?filter=all']);
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
      if (path === '../../utils/city.js') return cityModule;
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
