import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const markup = readFileSync(new URL('../miniprogram/pages/create/create.wxml', import.meta.url), 'utf8');

function loadCreate() {
  let page: Record<string, any> | undefined;
  const routes: string[] = [];
  const posts: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; },
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post(route: string) { posts.push(route); return {}; } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    wx: {
      getWindowInfo() { return { statusBarHeight: 24 }; },
      switchTab({ url }: { url: string }) { routes.push(url); },
      pageScrollTo() {}
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>, done?: () => void) {
    Object.assign(this.data, patch);
    done?.();
  };
  return { page, routes, posts };
}

test('the create header has a real profile route alongside the draft box', () => {
  assert.match(markup, /class="header-profile"[^>]*bindtap="goProfile"/);
  assert.match(markup, /class="header-side"[^>]*bindtap="openHeaderAction"/);
  const { page, routes } = loadCreate();
  page.goProfile();
  assert.deepEqual(routes, ['/pages/me/me']);
});

test('the IDEA footer offers a visible manual path without discarding home-prefilled words', () => {
  assert.match(markup, /class="sticky-actions"[\s\S]*?bindtap="suggest"[\s\S]*?bindtap="openForm"[^>]*>不用建议，直接手动填写/);
  const { page, posts } = loadCreate();
  page.setData({ aiText: '周六晚上约朋友打羽毛球' });
  page.openForm();
  assert.equal(page.data.stage, 'FORM');
  assert.equal(page.data.aiText, '周六晚上约朋友打羽毛球');
  assert.deepEqual(posts, []);
});

test('FORM visual cover choices use available photos while unavailable styles stay explanatory', () => {
  assert.match(markup, /class="cover-tile selected"[\s\S]*?caper_home_badminton\.jpg/);
  assert.match(markup, /data-name="轻松治愈封面"[^>]*bindtap="showUnavailable"[\s\S]*?caper_discover_coffee\.jpg/);
  assert.match(markup, /data-name="城市探索封面"[^>]*bindtap="showUnavailable"[\s\S]*?caper_discover_citywalk\.jpg/);
  assert.match(markup, /当前固定展示羽毛球封面/);
  assert.match(markup, /本地规则建议仅供参考，所有细节由你最终确认/);
});
