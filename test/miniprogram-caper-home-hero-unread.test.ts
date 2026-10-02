import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

type Storage = Map<string, unknown>;
type Api = { get(route: string): Promise<any>; post?(route: string, body: unknown): Promise<any> };

function loadPage(path: string, storage: Storage, api: Api, switches: string[] = [],
  options: { ready?: Promise<void>; developmentUser?: string } = {}) {
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    require(module: string) {
      if (module === '../../utils/api.js') return { api };
      if (module === '../../config.js') return { developmentUser: options.developmentUser ?? 'alice' };
      if (module === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${module}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: options.ready ?? Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); },
      removeStorageSync(key: string) { storage.delete(key); },
      switchTab({ url }: { url: string }) { switches.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>, done?: () => void) {
    Object.assign(this.data, patch);
    done?.();
  };
  return page;
}

const emptyEvents = { items: [] };
const emptyNotices = { items: [], total: 0, unreadTotal: 0, nextOffset: null, snapshot: 'test-snapshot' };

test('typed home idea reaches the existing create text field once without generating or publishing', async () => {
  const storage: Storage = new Map([['devUser', 'alice']]);
  const switches: string[] = [];
  const posts: string[] = [];
  const api: Api = {
    async get(route) {
      if (route === '/me/events') return emptyEvents;
      if (route === '/me/notifications?offset=0') return emptyNotices;
      if (route === '/system/safety') return { status: 'OPEN' };
      throw new Error(`unexpected GET ${route}`);
    },
    async post(route) { posts.push(route); return {}; }
  };
  const home = loadPage('../miniprogram/pages/index/index.js', storage, api, switches);
  home.heroIdeaInput({ detail: { value: '  周六约 6 人打羽毛球  ' } });
  await home.submitHeroIdea();
  assert.deepEqual(switches, ['/pages/create/create']);
  assert.equal((storage.get('irlHomeIdeaIntent') as { owner: string }).owner, 'dev:alice');
  assert.equal((storage.get('irlHomeIdeaIntent') as { text: string }).text, '周六约 6 人打羽毛球');

  const create = loadPage('../miniprogram/pages/create/create.js', storage, api);
  await create.onShow();
  assert.equal(create.data.aiText, '周六约 6 人打羽毛球');
  assert.equal(create.data.stage, 'IDEA');
  assert.equal(storage.has('irlHomeIdeaIntent'), false);
  assert.deepEqual(posts, []);
  create.setData({ aiText: '我自己修改了内容' });
  await create.onShow();
  assert.equal(create.data.aiText, '我自己修改了内容', 'the intent cannot replay on a later visit');

  const markup = readFileSync(new URL('../miniprogram/pages/index/index.wxml', import.meta.url), 'utf8');
  assert.match(markup, /<input[^>]*bindinput="heroIdeaInput"/);
  assert.match(markup, /<button[^>]*bindtap="submitHeroIdea"/);
});

test('pending login binds the home idea to the authenticated member before navigation', async () => {
  const storage: Storage = new Map();
  const switches: string[] = [];
  let finishReady!: () => void;
  const ready = new Promise<void>(resolve => { finishReady = resolve; });
  const api: Api = { async get(route) {
    if (route === '/system/safety') return { status: 'OPEN' };
    throw new Error(`unexpected GET ${route}`);
  } };
  const home = loadPage('../miniprogram/pages/index/index.js', storage, api, switches,
    { ready, developmentUser: '' });
  home.heroIdeaInput({ detail: { value: '登录期间输入的想法' } });
  const submitting = home.submitHeroIdea();
  assert.equal(storage.has('irlHomeIdeaIntent'), false, 'anonymous owner must not be saved before login settles');
  assert.deepEqual(switches, [], 'create must open only after the owner is known');
  storage.set('sessionToken', 'token-new');
  storage.set('userId', 'new-member');
  finishReady();
  await submitting;
  assert.equal((storage.get('irlHomeIdeaIntent') as { owner: string }).owner,
    'session:new-member:token-new');
  assert.deepEqual(switches, ['/pages/create/create']);
  const create = loadPage('../miniprogram/pages/create/create.js', storage, api);
  await create.onShow();
  assert.equal(create.data.aiText, '登录期间输入的想法');
});

test('a different signed-in member cannot receive a home idea submitted before account switch', async () => {
  const storage: Storage = new Map<string, unknown>([['sessionToken', 'token-alice'], ['userId', 'alice']]);
  const switches: string[] = [];
  let finishReady!: () => void;
  const ready = new Promise<void>(resolve => { finishReady = resolve; });
  const api: Api = { async get() { throw new Error('unexpected GET'); } };
  const home = loadPage('../miniprogram/pages/index/index.js', storage, api, switches, { ready });
  home.heroIdeaInput({ detail: { value: 'Alice 的想法' } });
  const submitting = home.submitHeroIdea();
  storage.set('sessionToken', 'token-bob');
  storage.set('userId', 'bob');
  finishReady();
  await submitting;
  assert.equal(storage.has('irlHomeIdeaIntent'), false);
  assert.deepEqual(switches, []);
  assert.equal(home.data.heroIdeaText, '');
  assert.match(String(home.data.availabilityMessage), /账号已切换/);
});

test('a new login session for the same member cannot inherit a pending home idea', async () => {
  const storage: Storage = new Map<string, unknown>([['sessionToken', 'token-first'], ['userId', 'alice']]);
  const switches: string[] = [];
  let finishReady!: () => void;
  const ready = new Promise<void>(resolve => { finishReady = resolve; });
  const api: Api = { async get() { throw new Error('unexpected GET'); } };
  const home = loadPage('../miniprogram/pages/index/index.js', storage, api, switches, { ready });
  home.heroIdeaInput({ detail: { value: '旧会话的构思' } });
  const submitting = home.submitHeroIdea();
  storage.set('sessionToken', 'token-second');
  finishReady();
  await submitting;
  assert.equal(storage.has('irlHomeIdeaIntent'), false);
  assert.deepEqual(switches, []);
  assert.match(String(home.data.availabilityMessage), /账号已切换/);
});

test('create discards a home idea from the same member previous session', async () => {
  const storage: Storage = new Map<string, unknown>([['sessionToken', 'token-second'], ['userId', 'alice'],
    ['irlHomeIdeaIntent', { owner: 'user:alice', text: '旧会话的构思' }]]);
  const api: Api = { async get(route) {
    if (route === '/system/safety') return { status: 'OPEN' };
    throw new Error(`unexpected GET ${route}`);
  } };
  const create = loadPage('../miniprogram/pages/create/create.js', storage, api);
  await create.onShow();
  assert.equal(create.data.aiText, '');
  assert.equal(storage.has('irlHomeIdeaIntent'), false);
});

test('overlapping create onShow calls retain the intent until the current generation can apply it', async () => {
  const storage: Storage = new Map<string, unknown>([['devUser', 'alice'],
    ['irlHomeIdeaIntent', { owner: 'dev:alice', text: '等待中的构思' }]]);
  let finishReady!: () => void;
  const ready = new Promise<void>(resolve => { finishReady = resolve; });
  const api: Api = { async get(route) {
    if (route === '/system/safety') return { status: 'OPEN' };
    throw new Error(`unexpected GET ${route}`);
  } };
  const create = loadPage('../miniprogram/pages/create/create.js', storage, api, [], { ready });
  const first = create.onShow();
  assert.equal(storage.has('irlHomeIdeaIntent'), true, 'waiting for app readiness must not consume the intent');
  const latest = create.onShow();
  finishReady();
  await Promise.all([first, latest]);
  assert.equal(create.data.aiText, '等待中的构思');
  assert.equal(storage.has('irlHomeIdeaIntent'), false);
});

test('failed draft loading retains a home idea for a successful retry conflict notice', async () => {
  const storage: Storage = new Map<string, unknown>([['devUser', 'alice'], ['editDraftId', 'draft-1'],
    ['irlHomeIdeaIntent', { owner: 'dev:alice', text: '不能丢掉的新构思' }]]);
  let failLoad = true;
  const api: Api = { async get(route) {
    if (route === '/events/draft-1') {
      if (failLoad) throw new Error('网络不可用');
      return { id: 'draft-1', status: 'DRAFT', version: 1,
        payload: { title: '旧草稿', city: '上海', feeMode: 'FREE' } };
    }
    if (route === '/system/safety') return { status: 'OPEN' };
    throw new Error(`unexpected GET ${route}`);
  } };
  const create = loadPage('../miniprogram/pages/create/create.js', storage, api);
  await create.onShow();
  assert.equal(create.data.editorLoadState, 'ERROR');
  assert.equal(storage.has('irlHomeIdeaIntent'), true);
  failLoad = false;
  await create.onShow();
  assert.equal(create.data.editorLoadState, 'READY');
  assert.equal(create.data.form.title, '旧草稿');
  assert.match(String(create.data.message), /未覆盖/);
  assert.equal(storage.has('irlHomeIdeaIntent'), false);
});

test('home idea intent is discarded for another identity or an in-progress editor', async () => {
  const storage: Storage = new Map<string, unknown>([['devUser', 'bob'], ['irlHomeIdeaIntent',
    { owner: 'dev:alice', text: 'Alice 的活动想法' }]]);
  const api: Api = { async get(route) {
    if (route === '/system/safety') return { status: 'OPEN' };
    throw new Error(`unexpected GET ${route}`);
  } };
  const otherAccount = loadPage('../miniprogram/pages/create/create.js', storage, api);
  await otherAccount.onShow();
  assert.equal(otherAccount.data.aiText, '');
  assert.equal(storage.has('irlHomeIdeaIntent'), false);

  storage.set('irlHomeIdeaIntent', { owner: 'dev:bob', text: '新输入不能覆盖旧草稿' });
  const editing = loadPage('../miniprogram/pages/create/create.js', storage, api);
  editing._shownIdentity = 'dev:bob';
  editing.setData({ stage: 'FORM', aiText: '正在编辑的文字', draft: { id: 'draft-1' } });
  await editing.onShow();
  assert.equal(editing.data.aiText, '正在编辑的文字');
  assert.equal(storage.has('irlHomeIdeaIntent'), false);
  assert.match(editing.data.message, /未覆盖/);
});

test('an open draft or published-event editor explains why the home idea was not applied', async () => {
  for (const [key, id, status] of ([
    ['editDraftId', 'draft-1', 'DRAFT'],
    ['editEventId', 'event-1', 'RECRUITING']
  ] as const)) {
    const storage: Storage = new Map<string, unknown>([['devUser', 'alice'], [key, id],
      ['irlHomeIdeaIntent', { owner: 'dev:alice', text: '周六的新想法' }]]);
    const api: Api = { async get(route) {
      if (route === `/events/${id}`) return { id, status, version: 1,
        payload: { title: '已在编辑的活动', city: '上海', feeMode: 'FREE' } };
      if (route === '/system/safety') return { status: 'OPEN' };
      throw new Error(`unexpected GET ${route}`);
    } };
    const create = loadPage('../miniprogram/pages/create/create.js', storage, api);
    await create.onShow();
    assert.equal(create.data.stage, 'FORM');
    assert.equal(create.data.form.title, '已在编辑的活动');
    assert.equal(create.data.aiText, '');
    assert.equal(storage.has('irlHomeIdeaIntent'), false);
    assert.match(String(create.data.message), /未覆盖/, `${key} must explain the discarded text`);
  }
});

test('home bell displays only current-identity server unread count and clears stale or failed results', async () => {
  const storage: Storage = new Map([['devUser', 'alice']]);
  let resolveOld: (value: unknown) => void = () => {};
  let failCurrent = false;
  const api: Api = { async get(route) {
    if (route === '/me/events') return emptyEvents;
    if (route === '/me/notifications?offset=0') {
      if (storage.get('devUser') === 'alice') return new Promise(resolve => { resolveOld = resolve; });
      if (failCurrent) throw new Error('network unavailable');
      return { ...emptyNotices, total: 20, unreadTotal: 2 };
    }
    throw new Error(`unexpected GET ${route}`);
  } };
  const home = loadPage('../miniprogram/pages/index/index.js', storage, api);
  await home.onShow();
  home.heroIdeaInput({ detail: { value: 'Alice 私人的组局想法' } });
  storage.set('devUser', 'bob');
  await home.onShow();
  assert.equal(home.data.unreadTotal, 2);
  assert.equal(home.data.heroIdeaText, '', 'switching accounts clears the visible private idea');
  resolveOld({ ...emptyNotices, unreadTotal: 9 });
  await Promise.resolve();
  assert.equal(home.data.unreadTotal, 2, 'old identity cannot restore its red dot');

  failCurrent = true;
  await home.onShow();
  assert.equal(home.data.unreadTotal, 0, 'request failure clears the indicator');

  const markup = readFileSync(new URL('../miniprogram/pages/index/index.wxml', import.meta.url), 'utf8');
  assert.match(markup, /wx:if="{{unreadTotal > 0}}"[^>]*class="header-unread-dot"/);
});
