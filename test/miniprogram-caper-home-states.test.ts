import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

type HomeItem = { id: string; status: string; title: string; isHost: boolean;
  myRegistrationStatus: string | null; startAt?: string; reviewStatus?: string;
  recruiting?: boolean; version?: number };
const activities: HomeItem[] = [
  { id: 'requested', status: 'RECRUITING', title: '周五羽毛球', isHost: false, myRegistrationStatus: 'REQUESTED' },
  { id: 'offer', status: 'RECRUITING', title: '周六羽毛球', isHost: false, myRegistrationStatus: 'OFFERED' },
  { id: 'reconfirm', status: 'RECRUITING', title: '周日羽毛球', isHost: false, myRegistrationStatus: 'RECONFIRM_REQUIRED' },
  { id: 'draft', status: 'DRAFT', title: '我的草稿', isHost: true, myRegistrationStatus: null },
  { id: 'hosted', status: 'RECRUITING', title: '我组织的羽毛球', isHost: true, myRegistrationStatus: null },
  { id: 'finished', status: 'COMPLETED', title: '已结束的羽毛球', isHost: true, myRegistrationStatus: null }
];

function loadHome(items = activities, capsule?: { left: number; windowWidth: number }) {
  let page: Record<string, any> | undefined;
  const storage = new Map<string, unknown>([['devUser', 'host']]);
  const navigations: string[] = [];
  const switches: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/index/index.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async () => ({ items }) } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getWindowInfo: capsule ? () => ({ windowWidth: capsule.windowWidth }) : undefined,
      getMenuButtonBoundingClientRect: capsule ? () => ({ left: capsule.left }) : undefined,
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

test('featured card uses the real list title, start time and state, with a detail route', async () => {
  const { page, navigations } = loadHome([{
    id: 'real-event', status: 'RECRUITING', title: '周六晚场羽毛球',
    startAt: '2027-03-22T11:00:00.000Z', isHost: true, myRegistrationStatus: null,
    reviewStatus: 'APPROVED', recruiting: true, version: 2
  }]);
  await page.onShow();
  assert.equal(page.data.featuredItem.title, '周六晚场羽毛球');
  assert.equal(page.data.featuredItem.dateLabel, '3 月 22 日 19:00');
  assert.equal(page.data.featuredItem.statusLabel, '招募中');
  page.openEvent({ currentTarget: { dataset: { id: page.data.featuredItem.id } } });
  assert.deepEqual(navigations, ['/pages/event/event?id=real-event']);

  const wxml = readFileSync(new URL('../miniprogram/pages/index/index.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /class="feature-detail"[\s\S]*?{{featuredItem\.title}}[\s\S]*?{{featuredItem\.statusLabel}}[\s\S]*?{{featuredItem\.dateLabel}}/);
  assert.doesNotMatch(wxml, /16人已报名|蓝天体育中心/);
});

test('a generic R1 activity title keeps real facts while using the badminton poster fallback', async () => {
  const { page } = loadHome([{
    id: 'synthetic-check', status: 'CONFIRMED', title: '周末合成验收',
    startAt: '2027-03-22T11:00:00.000Z', isHost: true, myRegistrationStatus: null
  }]);
  await page.onShow();
  assert.equal(page.data.featuredItem.title, '周末合成验收');
  assert.equal(page.data.featuredItem.statusLabel, '已成局');
  assert.equal(page.data.featuredItem.cover, '/assets/stitch/caper_home_badminton.jpg');
  assert.equal(page.data.featuredItem.posterWord, 'BADMINTON TOGETHER');
});

test('empty home keeps a clear create action and reserves room for the WeChat menu capsule', async () => {
  const { page, switches } = loadHome([], { left: 294, windowWidth: 390 });
  await page.onShow();
  assert.equal(page.data.featuredItem, null);
  assert.equal(page.data.headerPaddingRight, '104px');
  page.goCreate();
  assert.deepEqual(switches, ['/pages/create/create']);

  const wxml = readFileSync(new URL('../miniprogram/pages/index/index.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /wx:else[^>]*bindtap="goCreate"[\s\S]*?发起你的第一场真实活动/);
});

test('home invite token from a previous account cannot be opened after an identity switch', async () => {
  const { page, storage, navigations } = loadHome();
  await page.onShow();
  page.tokenChanged({ detail: { value: 'old-account-invite' } });
  assert.equal(page.data.tokenInput, 'old-account-invite');

  storage.set('devUser', 'another-member');
  page.openInvite();
  assert.deepEqual(navigations, []);
  assert.equal(page.data.tokenInput, '');

  page.tokenChanged({ detail: { value: 'new-account-invite' } });
  await page.onShow();
  assert.equal(page.data.tokenInput, '', 'account transition clears any token entered while the old page was still visible');
});
