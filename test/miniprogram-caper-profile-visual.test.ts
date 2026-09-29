import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

type Activity = { id: string; title: string; status: string; startAt?: string;
  isHost: boolean; myRegistrationStatus: string | null };

function loadProfile(activities: Activity[], reportContext?: { actor: string; eventId: string }) {
  let page: Record<string, any> | undefined;
  const navigations: string[] = [];
  const globalData: Record<string, any> = { ready: Promise.resolve(), reportContext };
  const emptyList = { items: [] };
  const responses: Record<string, any> = {
    '/me/notifications?offset=0': { items: [], total: 0 }, '/privacy/requests': emptyList,
    '/me/blocks': emptyList, '/me/removals': emptyList, '/me/reports': emptyList,
    '/me/appeals': emptyList, '/me/content': emptyList,
    '/me/consents': { eventReminder: false }, '/me/similar-invites': { granted: false },
    '/me/events': { items: activities }
  };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (url: string) => {
        assert.ok(url in responses, `unexpected request ${url}`);
        return responses[url];
      } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData }; },
    wx: {
      getStorageSync(key: string) { return key === 'sessionToken' ? 'session' : key === 'userId' ? 'host' : ''; },
      getWindowInfo() { return { windowWidth: 390 }; },
      getMenuButtonBoundingClientRect() { return { left: 294 }; },
      getSystemInfoSync() { return { statusBarHeight: 24 }; },
      navigateTo({ url }: { url: string }) { navigations.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, navigations, globalData };
}

test('profile activity grid uses real event rows with category photos and opens their details', async () => {
  const { page, navigations } = loadProfile([
    { id: 'badminton', title: '周六羽毛球', status: 'RECRUITING', startAt: '2027-03-22T11:00:00.000Z', isHost: true, myRegistrationStatus: null },
    { id: 'coffee', title: '创业者咖啡', status: 'CONFIRMED', isHost: false, myRegistrationStatus: 'CONFIRMED' },
    { id: 'walk', title: '城市漫步', status: 'COMPLETED', isHost: false, myRegistrationStatus: 'CONFIRMED' },
    { id: 'boardgame', title: '周末桌游', status: 'CANCELLED', isHost: true, myRegistrationStatus: null }
  ]);
  await page.onShow();
  assert.equal(page.data.activityPreview.map((item: any) => item.cover).join(','), [
    '/assets/stitch/caper_home_badminton.jpg', '/assets/stitch/caper_discover_coffee.jpg',
    '/assets/stitch/caper_discover_citywalk.jpg', '/assets/stitch/caper_discover_boardgame.jpg'
  ].join(','));
  assert.equal(page.data.activityPreview[0].title, '周六羽毛球');
  assert.equal(page.data.activityPreview[0].statusLabel, '招募中');
  assert.equal(page.data.activityPreview[0].dateLabel, '3 月 22 日 19:00');
  page.openActivity({ currentTarget: { dataset: { id: 'badminton' } } });
  assert.deepEqual(navigations, ['/pages/event/event?id=badminton']);

  const markup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  assert.match(markup, /class="activity-cover"[\s\S]*?<image[^>]+src="{{item\.cover}}"/);
});

test('advanced profile controls fold by default and report context unfolds its form', async () => {
  const { page, globalData } = loadProfile([], { actor: 'host', eventId: 'safety-1' });
  assert.equal(page.data.advancedOpen, false);
  assert.equal(page.data.headerPaddingRight, '104px');
  await page.onShow();
  assert.equal(page.data.reportEventId, 'safety-1');
  assert.equal(page.data.advancedOpen, true);
  assert.equal(globalData.reportContext, undefined);
  page.toggleAdvanced();
  assert.equal(page.data.advancedOpen, false);
  page.toggleAdvanced();
  assert.equal(page.data.advancedOpen, true);
  page.clearPrivateData();
  assert.equal(page.data.advancedOpen, false);
  assert.equal(page.data.reportEventId, '');

  const markup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  assert.match(markup, /bindtap="toggleAdvanced"/);
  assert.match(markup, /wx:if="{{advancedOpen}}"[\s\S]*?id="reportSection"/);
  for (const action of ['revokeBlock', 'openNotice', 'appealRemoval', 'appealContent', 'exportData', 'privacyRequest', 'report'])
    assert.match(markup, new RegExp(`bindtap="${action}"`));
});
