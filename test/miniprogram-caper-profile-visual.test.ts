import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

type Activity = { id: string; title: string; status: string; startAt?: string;
  venueName?: string; isHost: boolean; myRegistrationStatus: string | null };

function loadProfile(activities: Activity[], reportContext?: { actor: string; eventId: string }, profileFocusIntent = '') {
  let page: Record<string, any> | undefined;
  const navigations: string[] = [];
  const storageWrites: Array<[string, string]> = [];
  const storageRemovals: string[] = [];
  const scrolls: Array<{ scrollTop?: number; selector?: string }> = [];
  const selectorQueries: string[] = [];
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
      getStorageSync(key: string) { return key === 'sessionToken' ? 'session' : key === 'userId' ? 'host' :
        key === 'irlProfileFocusIntent' ? profileFocusIntent : ''; },
      setStorageSync(key: string, value: string) { storageWrites.push([key, value]); },
      removeStorageSync(key: string) { storageRemovals.push(key); },
      nextTick(fn: () => void) { fn(); },
      pageScrollTo(options: { scrollTop?: number; selector?: string }) { scrolls.push(options); },
      createSelectorQuery() {
        return {
          select(selector: string) { selectorQueries.push(selector); return { boundingClientRect() {} }; },
          selectViewport() { return { scrollOffset() {} }; },
          exec(callback: (positions: Array<{ top?: number; scrollTop?: number }>) => void) {
            callback([{ top: 0 }, { scrollTop: 900 }]);
          }
        };
      },
      getWindowInfo() { return { windowWidth: 390 }; },
      getMenuButtonBoundingClientRect() { return { left: 294 }; },
      getSystemInfoSync() { return { statusBarHeight: 24 }; },
      navigateTo({ url }: { url: string }) { navigations.push(url); },
      switchTab({ url }: { url: string }) { navigations.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, navigations, storageWrites, storageRemovals, scrolls, selectorQueries, globalData };
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

test('profile activity filters and invitation entry use only the current member events', async () => {
  const { page, navigations, storageWrites } = loadProfile([
    { id: 'host-open', title: '周六羽毛球', status: 'RECRUITING', isHost: true, myRegistrationStatus: null },
    { id: 'joined', title: '周末组局', status: 'CONFIRMED', isHost: false, myRegistrationStatus: 'CONFIRMED' },
    { id: 'pending', title: '待审批活动', status: 'RECRUITING', isHost: false, myRegistrationStatus: 'REQUESTED' },
    { id: 'host-draft', title: '草稿活动', status: 'DRAFT', isHost: true, myRegistrationStatus: null }
  ]);
  await page.onShow();
  assert.equal(page.data.activityPreview.map((item: Activity) => item.id).join(','), 'host-open,joined,pending,host-draft');

  page.selectActivityFilter({ currentTarget: { dataset: { filter: 'attended' } } });
  assert.equal(page.data.activityPreview.map((item: Activity) => item.id).join(','), 'joined');
  page.selectActivityFilter({ currentTarget: { dataset: { filter: 'hosted' } } });
  assert.equal(page.data.activityPreview.map((item: Activity) => item.id).join(','), 'host-open,host-draft');
  page.selectActivityFilter({ currentTarget: { dataset: { filter: 'saved' } } });
  assert.equal(page.data.activityFilter, 'hosted');

  page.inviteFriends();
  assert.equal(navigations.at(-1), '/subpackages/activity/share/share?id=host-open');
  page.goHostedActivities();
  assert.equal(navigations.at(-1), '/subpackages/profile/moments/moments?filter=hosted');
  page.goHostCenter();
  assert.deepEqual(storageWrites.at(-1), ['irlHomeTabIntent', 'organized']);
  assert.equal(navigations.at(-1), '/pages/index/index');
  page.goAllActivities();
  assert.equal(navigations.at(-1), '/subpackages/profile/moments/moments');
  page.clearPrivateData();
  assert.equal(page.data.activityPreview.length, 0);
  assert.equal(page.data.hostedPreview, null);
  assert.equal(page.data.activityFilter, 'all');

  const markup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  assert.match(markup, /data-filter="attended"[^>]*bindtap="selectActivityFilter"/);
  assert.match(markup, /data-filter="hosted"[^>]*bindtap="selectActivityFilter"/);
  assert.match(markup, /bindtap="inviteFriends"/);
});

test('a completed hosted event remains in view all and opens its own detail', async () => {
  const { page, navigations } = loadProfile([
    { id: 'ended-host', title: '已结束羽毛球', status: 'COMPLETED', isHost: true, myRegistrationStatus: null },
    { id: 'joined', title: '报名活动', status: 'CONFIRMED', isHost: false, myRegistrationStatus: 'CONFIRMED' }
  ]);
  await page.onShow();
  assert.equal(page.data.hostedPreview.id, 'ended-host');
  page.openActivity({ currentTarget: { dataset: { id: page.data.hostedPreview.id } } });
  assert.equal(navigations.at(-1), '/pages/event/event?id=ended-host');
  page.goHostedActivities();
  assert.equal(navigations.at(-1), '/subpackages/profile/moments/moments?filter=hosted');

  let moments: Record<string, any> | undefined;
  const momentNavigations: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/profile/moments/moments.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../../utils/api.js') return { api: { get: async () => ({ items: [
        { id: 'ended-host', title: '已结束羽毛球', venueName: '静安体育中心', status: 'COMPLETED', isHost: true },
        { id: 'joined', title: '报名活动', status: 'CONFIRMED', isHost: false, myRegistrationStatus: 'CONFIRMED' }
      ] }) } };
      if (path === '../../../config.js') return { developmentUser: 'host' };
      if (path === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { moments = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'host' : ''; },
      navigateTo({ url }: { url: string }) { momentNavigations.push(url); } }
  });
  assert.ok(moments);
  moments.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  moments.onLoad({ filter: 'hosted' });
  await moments.onShow();
  assert.equal(moments.data.visibleEvents.map((item: Activity) => item.id).join(','), 'ended-host');
  assert.equal(moments.data.visibleEvents[0].cover, '/assets/stitch/caper_home_badminton.jpg');
  assert.equal(moments.data.visibleEvents[0].venueName, '静安体育中心');
  const momentsMarkup = readFileSync(new URL('../miniprogram/subpackages/profile/moments/moments.wxml', import.meta.url), 'utf8');
  assert.match(momentsMarkup, /class="photo-large"[\s\S]*?<image[^>]+src="{{item\.cover}}"/);
  assert.match(momentsMarkup, /示意配图[\s\S]*?活动相册未开放/);
  assert.match(momentsMarkup, /class="moment-meta"[^>]*>[^<]*{{item\.dateLabel}}[^<]*{{item\.venueName/);
  moments.openActivity({ currentTarget: { dataset: { id: 'ended-host' } } });
  assert.deepEqual(momentNavigations, ['/pages/event/event?id=ended-host']);
});

test('profile invitation entry lets the member choose between multiple real recruiting events', async () => {
  const { page, navigations, storageWrites } = loadProfile([
    { id: 'recruit-a', title: '第一场', status: 'RECRUITING', isHost: true, myRegistrationStatus: null },
    { id: 'recruit-b', title: '第二场', status: 'RECRUITING', isHost: true, myRegistrationStatus: null }
  ]);
  await page.onShow();
  page.inviteFriends();
  assert.equal(page.data.inviteCandidateCount, 2);
  assert.deepEqual(storageWrites.at(-1), ['irlHomeTabIntent', 'organized']);
  assert.equal(navigations.at(-1), '/pages/index/index');
  assert.equal(navigations.some(url => url.includes('/subpackages/activity/share/share?id=')), false);

  const empty = loadProfile([]);
  await empty.page.onShow();
  empty.page.inviteFriends();
  assert.equal(empty.navigations.at(-1), '/pages/create/create');
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

test('profile edit account deletion entry reveals the real privacy request form', async () => {
  let editPage: Record<string, any> | undefined;
  const { page: profilePage, globalData } = loadProfile([]);
  const navigations: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/profile/profile-edit/profile-edit.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { editPage = definition; },
    getApp() { return { globalData }; },
    wx: { switchTab({ url }: { url: string }) { navigations.push(url); } }
  });
  assert.ok(editPage);
  editPage.goPrivacyRequests();
  assert.deepEqual(navigations, ['/pages/me/me']);
  assert.equal(globalData.profileFocus, 'privacySection');
  await profilePage.onShow();
  assert.equal(profilePage.data.advancedOpen, true);
  assert.equal(globalData.profileFocus, undefined);

  const editMarkup = readFileSync(new URL('../miniprogram/subpackages/profile/profile-edit/profile-edit.wxml', import.meta.url), 'utf8');
  assert.match(editMarkup, /bindtap="goPrivacyRequests"/);
});

test('support report shortcut preserves the profile report destination through sign-in', () => {
  let supportPage: Record<string, any> | undefined;
  const storageWrites: Array<[string, string]> = [];
  const navigations: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/profile/support/support.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      if (path === '../../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { supportPage = definition; },
    getApp() { return { globalData: {} }; },
    wx: {
      getStorageSync() { return ''; },
      setStorageSync(key: string, value: string) { storageWrites.push([key, value]); },
      switchTab({ url }: { url: string }) { navigations.push(url); }
    }
  });
  assert.ok(supportPage);
  supportPage.goReport();
  assert.deepEqual(storageWrites, [['irlProfileFocusIntent', 'reportSection']]);
  assert.deepEqual(navigations, ['/pages/me/me']);
});

test('moments header keeps profile actions clear of the native capsule and routes through R1 pages', () => {
  let moments: Record<string, any> | undefined;
  const navigations: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/profile/moments/moments.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../../utils/api.js') return { api: {} };
      if (path === '../../../config.js') return { developmentUser: '' };
      if (path === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { moments = definition; },
    wx: {
      getWindowInfo() { return { windowWidth: 390 }; },
      getMenuButtonBoundingClientRect() { return { left: 294 }; },
      navigateTo({ url }: { url: string }) { navigations.push(url); },
      switchTab({ url }: { url: string }) { navigations.push(url); }
    }
  });
  assert.ok(moments);
  moments.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  moments.onLoad({});
  assert.equal(moments.data.headerPaddingRight, '104px');
  moments.toggleMore();
  assert.equal(moments.data.moreOpen, true);
  moments.goPrivacy();
  assert.equal(moments.data.moreOpen, false);
  moments.goProfile();
  assert.deepEqual(navigations, ['/subpackages/profile/privacy-safety/privacy-safety', '/pages/me/me']);
  const markup = readFileSync(new URL('../miniprogram/subpackages/profile/moments/moments.wxml', import.meta.url), 'utf8');
  assert.match(markup, /class="pg10-header moments-header"[^>]*padding-right: {{headerPaddingRight}}/);
  assert.match(markup, /class="moments-header-more"[^>]*bindtap="toggleMore"/);
  assert.match(markup, /class="moments-header-avatar"[^>]*bindtap="goProfile"/);
  assert.match(markup, /wx:if="{{moreOpen}}"[^>]*class="moments-more-menu"/);
});

test('a home waitlist notification deep link opens the current member notice controls', async () => {
  const { page, storageRemovals, scrolls } = loadProfile([], undefined, 'noticeSection');
  await page.onShow();
  assert.equal(page.data.advancedOpen, true);
  assert.deepEqual(storageRemovals, ['irlProfileFocusIntent']);
  assert.equal(scrolls.at(-1)?.scrollTop, 800, 'notification heading must clear the sticky profile header');
  const markup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  assert.match(markup, /id="noticeSection"/);
});

test('stored notice intent may reveal only the matching real record sections', async () => {
  for (const section of ['reportSection', 'appealSection', 'contentSection']) {
    const { page, selectorQueries, storageRemovals } = loadProfile([], undefined, section);
    await page.onShow();
    assert.equal(page.data.advancedOpen, true);
    assert.equal(selectorQueries.at(-1), '#' + section);
    assert.deepEqual(storageRemovals, ['irlProfileFocusIntent']);
  }
  const unrelated = loadProfile([], undefined, 'missingSection');
  await unrelated.page.onShow();
  assert.equal(unrelated.page.data.advancedOpen, false);
  assert.equal(unrelated.selectorQueries.length, 0);
});

test('notification settings intent focuses the real consent switches without unfolding records', async () => {
  const { page, selectorQueries } = loadProfile([], undefined, 'notificationSettingsSection');
  await page.onShow();
  assert.equal(page.data.advancedOpen, false);
  assert.equal(selectorQueries.at(-1), '#notificationSettingsSection');
  const markup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  assert.match(markup, /id="notificationSettingsSection"[\s\S]*?id="reminderConsentSwitch"/);
  assert.match(markup, /id="notificationSettingsSection"[\s\S]*?id="similarInvitesConsentSwitch"/);
});

test('profile registration management shortcut targets the approval queue', () => {
  const { page, navigations, storageWrites } = loadProfile([]);
  page.goApprovalManagement();
  assert.deepEqual(storageWrites.at(-1), ['irlMessagesFocusIntent', 'approvals']);
  assert.equal(navigations.at(-1), '/pages/messages/messages');
  const markup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  assert.match(markup, /bindtap="goApprovalManagement"[^>]*>[\s\S]*?报名管理/);
});

test('legal page account privacy link opens the actual profile request form', async () => {
  let legalPage: Record<string, any> | undefined;
  const { page: profilePage, globalData } = loadProfile([]);
  const navigations: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/profile/legal/legal.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { legalPage = definition; },
    getApp() { return { globalData }; },
    wx: { switchTab({ url }: { url: string }) { navigations.push(url); } }
  });
  assert.ok(legalPage);
  legalPage.goPrivacy();
  assert.equal(globalData.profileFocus, 'privacySection');
  assert.deepEqual(navigations, ['/pages/me/me']);
  await profilePage.onShow();
  assert.equal(profilePage.data.advancedOpen, true);
  assert.equal(globalData.profileFocus, undefined);
});

test('explicit account privacy navigation takes precedence over a leftover notice intent', async () => {
  const { page, globalData, selectorQueries, storageRemovals } = loadProfile([], undefined, 'noticeSection');
  globalData.profileFocus = 'privacySection';
  await page.onShow();
  assert.equal(selectorQueries.at(-1), '#privacySection');
  assert.deepEqual(storageRemovals, ['irlProfileFocusIntent']);
  assert.equal(globalData.profileFocus, undefined);
});

test('signed-out privacy deep link survives login only within the current profile visit', async () => {
  function signedOutPage(shouldFail: boolean) {
    let page: Record<string, any> | undefined;
    const globalData: Record<string, any> = { ready: Promise.resolve(), profileFocus: 'privacySection' };
    runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
      require(path: string) {
        if (path === '../../utils/api.js') return { api: { async login() {
          if (shouldFail) throw new Error('登录失败');
          return { userId: 'new-user' };
        } } };
        if (path === '../../config.js') return { developmentUser: '' };
        throw new Error(`unexpected require ${path}`);
      },
      Page(definition: Record<string, any>) { page = definition; },
      getApp() { return { globalData }; },
      wx: { getStorageSync() { return ''; }, removeStorageSync() {},
        getSystemInfoSync() { return { statusBarHeight: 24 }; }, nextTick(fn: () => void) { fn(); },
        pageScrollTo() {} }
    });
    assert.ok(page);
    page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
    page.refresh = async () => true;
    return { page, globalData };
  }

  const success = signedOutPage(false);
  await success.page.onShow();
  assert.equal(success.page.data.loadState, 'UNAUTHENTICATED');
  assert.equal(success.globalData.profileFocus, undefined);
  assert.equal(success.page._pendingFocus, 'privacySection');
  await success.page.login();
  assert.equal(success.page.data.advancedOpen, true);
  assert.equal(success.page._pendingFocus, '');

  const failure = signedOutPage(true);
  await failure.page.onShow();
  await failure.page.login();
  assert.equal(failure.page._pendingFocus, '');
  const leave = signedOutPage(false);
  await leave.page.onShow();
  leave.page.onHide();
  assert.equal(leave.page._pendingFocus, '');
});
