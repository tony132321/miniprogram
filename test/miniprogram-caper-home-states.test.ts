import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const activities = [
  { id: 'requested', status: 'RECRUITING', title: '周五羽毛球', isHost: false, myRegistrationStatus: 'REQUESTED' },
  { id: 'offer', status: 'RECRUITING', title: '周六羽毛球', isHost: false, myRegistrationStatus: 'OFFERED' },
  { id: 'reconfirm', status: 'RECRUITING', title: '周日羽毛球', isHost: false, myRegistrationStatus: 'RECONFIRM_REQUIRED' },
  { id: 'draft', status: 'DRAFT', title: '我的草稿', isHost: true, myRegistrationStatus: null },
  { id: 'hosted', status: 'RECRUITING', title: '我组织的羽毛球', isHost: true, myRegistrationStatus: null },
  { id: 'finished', status: 'COMPLETED', title: '已结束的羽毛球', isHost: true, myRegistrationStatus: null }
];

function loadHome() {
  let page: Record<string, any> | undefined;
  const storage = new Map<string, unknown>([['devUser', 'host']]);
  const navigations: string[] = [];
  const switches: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/index/index.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async () => ({ items: activities }) } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) ?? ''; },
      setStorageSync(key: string, value: unknown) { storage.set(key, value); },
      removeStorageSync(key: string) { storage.delete(key); },
      navigateTo({ url }: { url: string }) { navigations.push(url); },
      switchTab({ url }: { url: string }) { switches.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, storage, navigations, switches };
}

test('pending, organized and history cards use only true list states and safe actions', async () => {
  const { page, storage, navigations, switches } = loadHome();
  await page.onShow();
  assert.equal(page.data.pending.map((item: any) => item.id).join(','), 'requested,offer,reconfirm');
  assert.equal(page.data.organized.map((item: any) => item.id).join(','), 'draft,hosted');
  assert.equal(page.data.history.map((item: any) => item.id).join(','), 'finished');
  assert.match(page.data.pending[1].cardNote, /尚未|截止/);
  assert.match(page.data.pending[2].cardNote, /核对新版本/);
  assert.equal(page.data.organized[0].primaryAction, 'editDraft');
  assert.equal(page.data.history[0].secondaryAction, '');

  page.openCardAction({ currentTarget: { dataset: { id: 'reconfirm', action: 'registrationSection' } } });
  assert.equal(navigations.pop(), '/pages/event/event?id=reconfirm&section=registrationSection');
  page.openCardAction({ currentTarget: { dataset: { id: 'hosted', action: 'hostSection' } } });
  assert.equal(navigations.pop(), '/pages/event/event?id=hosted&section=hostSection');
  page.openCardAction({ currentTarget: { dataset: { id: 'requested', action: 'hostSection' } } });
  assert.equal(navigations.length, 0, 'a pending member cannot forge a host shortcut');
  page.openCardAction({ currentTarget: { dataset: { id: 'draft', action: 'editDraft' } } });
  assert.equal(storage.get('editDraftId'), 'draft');
  assert.equal(storage.get('editTargetOwner'), 'dev:host');
  assert.equal(switches.pop(), '/pages/create/create');
});

test('home itinerary shortcut opens the registered real itinerary page', () => {
  const { page, navigations } = loadHome();
  page.goItinerary();
  assert.deepEqual(navigations, ['/subpackages/activity/itinerary/itinerary']);
  const wxml = readFileSync(new URL('../miniprogram/pages/index/index.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /bindtap="goItinerary"/);
  assert.match(wxml, /相册未开放/);
  assert.doesNotMatch(wxml, /bindtap="(?:openChat|pay|openAlbum)"/);
});
