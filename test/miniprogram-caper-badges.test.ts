import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('a planned badge opens an honest detail sheet and its activity action reaches real records', () => {
  let page: Record<string, any> | undefined;
  const navigations: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/profile/badges/badges.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getWindowInfo() { return { windowWidth: 390 }; },
      getMenuButtonBoundingClientRect() { return { left: 294 }; },
      navigateTo({ url }: { url: string }) { navigations.push(url); },
      switchTab({ url }: { url: string }) { navigations.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.onLoad();
  assert.equal(page.data.headerPaddingRight, '104px');

  page.selectCategory({ currentTarget: { dataset: { category: 'sports' } } });
  assert.deepEqual(Array.from(page.data.visibleBadges, (badge: any) => badge.id), ['badminton', 'walk']);
  page.openBadge({ currentTarget: { dataset: { id: 'badminton' } } });
  assert.equal(page.data.selectedBadge.title, '羽球常胜');
  page.closeBadge();
  assert.equal(page.data.selectedBadge, null);
  page.openBadge({ currentTarget: { dataset: { id: 'unknown' } } });
  assert.equal(page.data.selectedBadge, null);

  page.goActivities();
  assert.equal(navigations.at(-1), '/subpackages/profile/moments/moments?filter=all');
  page.toggleMore();
  assert.equal(page.data.moreOpen, true);
  page.goProfile();
  assert.equal(navigations.at(-1), '/pages/me/me');

  const markup = readFileSync(new URL('../miniprogram/subpackages/profile/badges/badges.wxml', import.meta.url), 'utf8');
  assert.match(markup, /wx:if="{{selectedBadge}}"[^>]*class="badge-detail-sheet"/);
  assert.match(markup, /尚未授予/);
  assert.match(markup, /bindtap="closeBadge"/);
  assert.match(markup, /class="badge-header-more"[^>]*bindtap="toggleMore"/);
  assert.match(markup, /class="badge-header-avatar"[^>]*bindtap="goProfile"/);
});
