import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

const source = readFileSync(new URL('../miniprogram/subpackages/profile/profile-edit/profile-edit.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/subpackages/profile/profile-edit/profile-edit.wxml', import.meta.url), 'utf8');

function loadEdit(options: {
  developmentUser?: string;
  storage?: Record<string, string>;
  getEvents?: () => Promise<unknown>;
} = {}) {
  let page: Record<string, any> | undefined;
  const storage = new Map(Object.entries(options.storage || {}));
  const navigations: string[] = [];
  const requests: string[] = [];
  runInNewContext(source, {
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    require(path: string) {
      if (path === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      if (path === '../../../utils/city.js') return cityModule;
      if (path === '../../../config.js') return { developmentUser: options.developmentUser || '' };
      if (path === '../../../utils/api.js') return { api: { get: (url: string) => {
        requests.push(url);
        assert.equal(url, '/me/events');
        return options.getEvents ? options.getEvents() : Promise.resolve({ items: [] });
      } } };
      throw new Error(`unexpected require ${path}`);
    },
    wx: {
      getStorageSync(key: string) { return storage.get(key) || ''; },
      navigateTo({ url }: { url: string }) { navigations.push(url); },
      switchTab({ url }: { url: string }) { navigations.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  return { page, storage, navigations, requests };
}

test('nickname entry lists only activities where alias grant is possible and opens that event section', async () => {
  const { page, navigations, requests } = loadEdit({
    storage: { sessionToken: 'token-a', userId: 'member-a' },
    getEvents: async () => ({ items: [
      { id: 'host', title: '我主办的活动', isHost: true, myRegistrationStatus: null },
      { id: 'joined', title: '我参加的活动', isHost: false, myRegistrationStatus: 'CONFIRMED' },
      { id: 'waitlist', title: '候补活动', isHost: false, myRegistrationStatus: 'WAITLISTED' },
      { id: 'offered', title: '待确认补位', isHost: false, myRegistrationStatus: 'OFFERED' },
      { id: 'reconfirm', title: '待重新确认', isHost: false, myRegistrationStatus: 'RECONFIRM_REQUIRED' },
      { id: 'requested', title: '待审批', isHost: false, myRegistrationStatus: 'REQUESTED' },
      { id: 'removed', title: '已移除', isHost: false, myRegistrationStatus: 'REMOVED' }
    ] })
  });
  assert.match(markup, /<button[^>]*bindtap="openAliasPicker"/);
  assert.match(markup, /全局昵称[^\n]*未开放|全局昵称[^\n]*暂未开放/);
  await page.openAliasPicker();
  assert.deepEqual(requests, ['/me/events']);
  assert.equal(page.data.aliasLoadState, 'READY');
  assert.equal(page.data.aliasCandidates.map((item: { id: string }) => item.id).join(','),
    'host,joined,waitlist,offered,reconfirm');
  page.goAliasActivity({ currentTarget: { dataset: { id: 'requested' } } });
  assert.deepEqual(navigations, []);
  page.goAliasActivity({ currentTarget: { dataset: { id: 'joined' } } });
  assert.deepEqual(navigations, ['/pages/event/event?id=joined&section=registrationSection&entry=alias']);
});

test('nickname entry distinguishes signed-out, empty and failed activity lists', async () => {
  const signedOut = loadEdit({ storage: { devUser: 'stale-user' } });
  await signedOut.page.openAliasPicker();
  assert.equal(signedOut.page.data.aliasLoadState, 'UNAUTHENTICATED');
  assert.deepEqual(signedOut.requests, []);

  const empty = loadEdit({ developmentUser: 'host', getEvents: async () => ({ items: [
    { id: 'requested', title: '待审批', isHost: false, myRegistrationStatus: 'REQUESTED' }
  ] }) });
  await empty.page.openAliasPicker();
  assert.equal(empty.page.data.aliasLoadState, 'EMPTY');

  const failed = loadEdit({ developmentUser: 'host', getEvents: async () => { throw new Error('网络中断'); } });
  await failed.page.openAliasPicker();
  assert.equal(failed.page.data.aliasLoadState, 'ERROR');
  assert.match(failed.page.data.aliasError, /网络中断/);
  assert.match(markup, /aliasLoadState === 'UNAUTHENTICATED'/);
  assert.match(markup, /aliasLoadState === 'EMPTY'/);
  assert.match(markup, /aliasLoadState === 'ERROR'/);
});

test('an old account response cannot restore or open its activity after account switch', async () => {
  let resolveOld!: (value: unknown) => void;
  const oldResponse = new Promise<unknown>(resolve => { resolveOld = resolve; });
  const { page, storage, navigations } = loadEdit({
    storage: { sessionToken: 'token-a', userId: 'member-a' },
    getEvents: () => oldResponse
  });
  const pending = page.openAliasPicker();
  await Promise.resolve();
  storage.set('sessionToken', 'token-b');
  storage.set('userId', 'member-b');
  page.onShow();
  resolveOld({ items: [{ id: 'a-event', title: '旧账号活动', isHost: true, myRegistrationStatus: null }] });
  await pending;
  assert.equal(page.data.aliasCandidates.length, 0);
  page.goAliasActivity({ currentTarget: { dataset: { id: 'a-event' } } });
  assert.deepEqual(navigations, []);
});
