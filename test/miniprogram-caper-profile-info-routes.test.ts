import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function loadPage(path: string, options: { developmentUser?: string;
  storage?: Record<string, string> } = {}) {
  let page: Record<string, any> | undefined;
  const navigations: string[] = [];
  const storageWrites: Array<[string, string]> = [];
  const globalData: Record<string, any> = {};
  runInNewContext(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    require(module: string) {
      if (module === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      if (module === '../../../config.js') return { developmentUser: options.developmentUser || '' };
      throw new Error(`unexpected require ${module}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData }; },
    wx: {
      getStorageSync(key: string) { return options.storage?.[key] || ''; },
      setStorageSync(key: string, value: string) { storageWrites.push([key, value]); },
      getSystemInfoSync() { return { statusBarHeight: 24 }; },
      getWindowInfo() { return { windowWidth: 390 }; },
      getMenuButtonBoundingClientRect() { return { left: 294 }; },
      navigateTo({ url }: { url: string }) { navigations.push(url); },
      switchTab({ url }: { url: string }) { navigations.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, navigations, storageWrites, globalData };
}

test('release notes activity action opens the member activity list', () => {
  const { page, navigations } = loadPage('../miniprogram/subpackages/profile/release-notes/release-notes.js');
  page.goActivities();
  assert.deepEqual(navigations, ['/subpackages/profile/moments/moments?filter=all']);
});

test('community charter help action keeps the report section destination through sign-in', () => {
  const { page, navigations, storageWrites, globalData } = loadPage(
    '../miniprogram/subpackages/profile/guidelines/guidelines.js');
  page.goReport();
  assert.deepEqual(storageWrites, [['irlProfileFocusIntent', 'reportSection']]);
  assert.equal(globalData.reportContext, undefined);
  assert.deepEqual(navigations, ['/pages/me/me']);
});

test('PG10 information pages share only their public destination and current title', () => {
  const pages = [
    ['release-notes', 'Project IRL · 当前功能与版本说明'],
    ['guidelines', 'Project IRL · 社区引导与线下社交守则'],
    ['open-source', 'Project IRL · 开源许可与致谢']
  ] as const;
  for (const [name, title] of pages) {
    const { page } = loadPage(`../miniprogram/subpackages/profile/${name}/${name}.js`, {
      storage: { sessionToken: 'private-session', userId: 'private-user', inviteToken: 'private-invite' }
    });
    const share = page.onShareAppMessage();
    assert.equal(share.title, title, name);
    assert.equal(share.path, `/subpackages/profile/${name}/${name}`, name);
  }
});

test('about screen page actions fit left of the native capsule and open real destinations', () => {
  const { page, navigations } = loadPage('../miniprogram/pages/about/about.js');
  page.onLoad();
  assert.equal(page.data.headerPaddingRight, '104px');
  page.toggleMore();
  assert.equal(page.data.moreOpen, true);
  page.goReleaseNotes();
  assert.equal(page.data.moreOpen, false);
  page.goProfile();
  assert.deepEqual(navigations, ['/subpackages/profile/release-notes/release-notes', '/pages/me/me']);
  const markup = readFileSync(new URL('../miniprogram/pages/about/about.wxml', import.meta.url), 'utf8');
  assert.match(markup, /class="about-header"[^>]*padding-right: {{headerPaddingRight}}/);
  assert.match(markup, /bindtap="toggleMore"/);
  assert.match(markup, /class="about-header-avatar"[^>]*bindtap="goProfile"/);
});

test('support and Project IRL information headers expose real about and profile routes clear of the capsule', () => {
  for (const [script, markupPath] of [
    ['../miniprogram/subpackages/profile/support/support.js', '../miniprogram/subpackages/profile/support/support.wxml'],
    ['../miniprogram/subpackages/profile/release-notes/release-notes.js', '../miniprogram/subpackages/profile/release-notes/release-notes.wxml'],
    ['../miniprogram/subpackages/profile/guidelines/guidelines.js', '../miniprogram/subpackages/profile/guidelines/guidelines.wxml'],
    ['../miniprogram/subpackages/profile/open-source/open-source.js', '../miniprogram/subpackages/profile/open-source/open-source.wxml']
  ] as const) {
    const { page, navigations } = loadPage(script);
    page.onLoad();
    assert.equal(page.data.headerPaddingRight, '104px', script);
    page.toggleMore();
    assert.equal(page.data.moreOpen, true, script);
    page.goAbout();
    assert.equal(page.data.moreOpen, false, script);
    page.goProfile();
    assert.deepEqual(navigations, ['/pages/about/about', '/pages/me/me'], script);
    const markup = readFileSync(new URL(markupPath, import.meta.url), 'utf8');
    assert.match(markup, /class="pg10-header [^"]+"[^>]*padding-right: {{headerPaddingRight}}/, script);
    assert.match(markup, /bindtap="toggleMore"/, script);
    assert.match(markup, /bindtap="goProfile"/, script);
  }
});

test('legal and local storage headers expose working profile destinations clear of the native capsule', () => {
  const legal = loadPage('../miniprogram/subpackages/profile/legal/legal.js');
  legal.page.onLoad();
  assert.equal(legal.page.data.headerPaddingRight, '104px');
  legal.page.toggleMore();
  assert.equal(legal.page.data.moreOpen, true);
  legal.page.goGuidelines();
  assert.equal(legal.page.data.moreOpen, false);
  legal.page.goCache();
  legal.page.goProfile();
  assert.deepEqual(legal.navigations, [
    '/subpackages/profile/guidelines/guidelines',
    '/subpackages/profile/cache/cache',
    '/pages/me/me'
  ]);

  const storage = loadPage('../miniprogram/subpackages/profile/cache/cache.js');
  storage.page.onLoad();
  assert.equal(storage.page.data.headerPaddingRight, '104px');
  storage.page.toggleMore();
  assert.equal(storage.page.data.moreOpen, true);
  storage.page.goLegal();
  assert.equal(storage.page.data.moreOpen, false);
  storage.page.goPrivacy();
  storage.page.goProfile();
  assert.equal(storage.globalData.profileFocus, 'privacySection');
  assert.deepEqual(storage.navigations, [
    '/subpackages/profile/legal/legal',
    '/pages/me/me',
    '/pages/me/me'
  ]);

  for (const page of ['legal/legal', 'cache/cache']) {
    const markup = readFileSync(new URL(`../miniprogram/subpackages/profile/${page}.wxml`, import.meta.url), 'utf8');
    assert.match(markup, /class="pg10-header [^"]+"[^>]*padding-right: {{headerPaddingRight}}/, page);
    assert.match(markup, /bindtap="toggleMore"/, page);
    assert.match(markup, /bindtap="goProfile"/, page);
  }
});
