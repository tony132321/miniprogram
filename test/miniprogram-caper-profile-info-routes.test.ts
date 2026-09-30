import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function loadPage(path: string, options: { developmentUser?: string } = {}) {
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
      getStorageSync() { return ''; },
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
