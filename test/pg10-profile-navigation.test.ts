import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function loadPage(path: string, services: Record<string, unknown> = {}) {
  let page: Record<string, any> | undefined;
  const routes: string[] = [];
  const wx = {
    navigateTo({ url }: { url: string }) { routes.push(url); },
    switchTab({ url }: { url: string }) { routes.push(url); },
    getStorageSync(key: string) { return services[key] ?? ''; }
  };
  runInNewContext(readFileSync(new URL(`../miniprogram/${path}`, import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; }, wx,
    require(module: string) {
      if (module.endsWith('/utils/api.js')) return { api: services.api ?? {} };
      if (module.endsWith('/config.js')) return { developmentUser: '' };
      throw new Error(`unexpected require ${module}`);
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  return { page, routes };
}

test('profile design destinations navigate to registered PG10 subpackage paths', () => {
  const { page, routes } = loadPage('pages/me/me.js');
  for (const action of ['goEditProfile', 'goBadges', 'goMoments', 'goPrivacySafety', 'goLegal',
    'goCache', 'goSupport']) page[action]();
  assert.deepEqual(routes, [
    '/subpackages/profile/profile-edit/profile-edit', '/subpackages/profile/badges/badges',
    '/subpackages/profile/moments/moments', '/subpackages/profile/privacy-safety/privacy-safety',
    '/subpackages/profile/legal/legal', '/subpackages/profile/cache/cache',
    '/subpackages/profile/support/support'
  ]);
});

test('about design destinations navigate to release notes, guidelines and open source', () => {
  const { page, routes } = loadPage('pages/about/about.js');
  page.goReleaseNotes(); page.goGuidelines(); page.goOpenSource();
  assert.deepEqual(routes, [
    '/subpackages/profile/release-notes/release-notes',
    '/subpackages/profile/guidelines/guidelines',
    '/subpackages/profile/open-source/open-source'
  ]);
});

test('privacy page clears another account blocks and never fetches when signed out', async () => {
  const requests: string[] = [];
  const session = { token: '' };
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/profile/privacy-safety/privacy-safety.js', import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'sessionToken' ? session.token : ''; },
      navigateBack() {}, switchTab() {} },
    require(module: string) {
      if (module === '../../../utils/api.js') return { api: { async get(path: string) {
        requests.push(path); return { items: [{ id: 'block-1', eventTitle: '旧账号活动' }] };
      } } };
      if (module === '../../../config.js') return { developmentUser: '' };
      if (module === '../navigation.js') return { backToProfile() {} };
      throw new Error(`unexpected require ${module}`);
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  session.token = 'session-1';
  await page.onShow();
  assert.deepEqual(requests, ['/me/blocks']);
  assert.equal(page.data.blocks[0].eventTitle, '旧账号活动');
  session.token = '';
  await page.onShow();
  assert.deepEqual(requests, ['/me/blocks']);
  assert.deepEqual(Array.from(page.data.blocks), []);
  assert.equal(page.data.loadState, 'UNAUTHENTICATED');
});

test('privacy page shows only service-backed block details and ignores duplicate or stale revoke taps', async () => {
  const markup = readFileSync(new URL('../miniprogram/subpackages/profile/privacy-safety/privacy-safety.wxml', import.meta.url), 'utf8');
  assert.match(markup, /关于黑名单机制/);
  assert.match(markup, /来自：{{item.eventTitle \|\| '活动'}}/);
  assert.match(markup, /disabled="{{revokingId !== ''}}"/);
  assert.doesNotMatch(markup, /item\.(?:userName|avatar|reason|createdAt)/);

  let actor = 'old';
  let releasePost!: () => void;
  const postGate = new Promise<void>(resolve => { releasePost = resolve; });
  const posts: string[] = [];
  let newRemoved = false;
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/profile/privacy-safety/privacy-safety.js', import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'sessionToken' ? actor : ''; } },
    require(module: string) {
      if (module === '../../../utils/api.js') return { api: {
        async get() { return { items: actor === 'new' && newRemoved ? [] :
          [{ id: actor === 'old' ? 'old-block' : 'new-block', eventTitle: actor + '活动' }] }; },
        async post(path: string) { posts.push(path); await postGate; if (path.includes('/new-block/')) newRemoved = true; }
      } };
      if (module === '../../../config.js') return { developmentUser: '' };
      if (module === '../navigation.js') return { backToProfile() {} };
      throw new Error(`unexpected require ${module}`);
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  await page.onShow();
  const event = { currentTarget: { dataset: { id: 'old-block' } } };
  const pending = page.revokeBlock(event);
  await page.revokeBlock(event);
  assert.deepEqual(posts, ['/me/blocks/old-block/revoke']);
  assert.equal(page.data.revokingId, 'old-block');
  actor = 'new';
  await page.onShow();
  releasePost();
  await pending;
  assert.equal(page.data.blocks[0].id, 'new-block');
  assert.equal(page.data.message, '');
  await page.revokeBlock({ currentTarget: { dataset: { id: 'new-block' } } });
  assert.deepEqual(posts, ['/me/blocks/old-block/revoke', '/me/blocks/new-block/revoke']);
  assert.deepEqual(Array.from(page.data.blocks), []);
  assert.equal(page.data.message, '已解除屏蔽。');
});

test('each PG10 subpage wires every visible interaction and has a return action', () => {
  const names = ['profile-edit', 'badges', 'moments', 'privacy-safety', 'legal', 'cache',
    'support', 'release-notes', 'guidelines', 'open-source'];
  for (const name of names) {
    const stem = `../miniprogram/subpackages/profile/${name}/${name}`;
    const markup = readFileSync(new URL(`${stem}.wxml`, import.meta.url), 'utf8');
    let page: Record<string, any> | undefined;
    runInNewContext(readFileSync(new URL(`${stem}.js`, import.meta.url), 'utf8'), {
      Page(definition: Record<string, any>) { page = definition; },
      wx: { getStorageSync() { return ''; } },
      require(module: string) {
        if (module === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
        if (module === '../../../utils/api.js') return { api: {} };
        if (module === '../../../config.js') return { developmentUser: '' };
        throw new Error(`unexpected require ${module}`);
      }
    });
    assert.ok(page, `${name}: Page must register`);
    assert.match(markup, /bindtap="back"/, `${name}: return control required`);
    for (const match of markup.matchAll(/bind(?:tap|input|change)="([A-Za-z]\w*)"/g)) {
      const handler = match[1]!;
      assert.equal(typeof page[handler], 'function', `${name}: ${handler} must be callable`);
    }
  }
});

test('local storage page reports device size and proportional usage from the native API', () => {
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/profile/cache/cache.js', import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageInfoSync() { return { currentSize: 512, limitSize: 10240 }; } },
    require(module: string) {
      assert.equal(module, '../navigation.js');
      return { backToProfile() {}, statusBarHeight() { return 24; } };
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  page.refreshStorage();
  assert.equal(page.data.storageSize, '0.50 MB');
  assert.equal(page.data.usagePercent, 5);
});

test('profile summary counts only real service events and shows no invented social figures', async () => {
  const events = [
    { id: 'host-1', title: '主办羽毛球', isHost: true, status: 'RECRUITING', myRegistrationStatus: 'CONFIRMED' },
    { id: 'member-1', title: '参加羽毛球', isHost: false, status: 'CONFIRMED', myRegistrationStatus: 'CONFIRMED' },
    { id: 'waiting-1', title: '候补羽毛球', isHost: false, status: 'RECRUITING', myRegistrationStatus: 'WAITLISTED' }
  ];
  const { page } = loadPage('pages/me/me.js', { api: { async get(path: string) {
    if (path === '/me/events') return { items: events };
    if (path === '/me/notifications?offset=0') return { items: [], total: 0 };
    if (path === '/me/consents') return { eventReminder: false };
    if (path === '/me/similar-invites') return { granted: false };
    return { items: [] };
  } } });
  await page.refresh();
  assert.equal(page.data.activityStats.total, 3);
  assert.equal(page.data.activityStats.hosted, 1);
  assert.equal(page.data.activityStats.confirmed, 2);
  assert.equal(page.data.activityPreview.length, 3);
  assert.equal(page.data.activityPreview[0].title, '主办羽毛球');
  assert.equal(page.data.activityPreview[0].statusLabel, '招募中');
});
