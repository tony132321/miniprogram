import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const meMarkup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');

function loadMe() {
  let page: Record<string, any> | undefined;
  const navigations: string[] = [];
  const dialogs: Array<{ title: string; content: string; success: (result: { confirm: boolean }) => void }> = [];
  let scans = 0;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      navigateTo({ url }: { url: string }) { navigations.push(url); },
      showModal(options: { title: string; content: string; success: (result: { confirm: boolean }) => void }) {
        dialogs.push(options);
      },
      scanCode() { scans += 1; }
    },
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    }
  });
  assert.ok(page);
  return { page, navigations, dialogs, get scans() { return scans; } };
}

test('profile scan control explains event-scoped check-in and opens real itinerary only on confirmation', () => {
  assert.match(meMarkup, /<button[^>]*bindtap="openScanEntry"[^>]*aria-label="现场签到与核验入口"/);
  assert.doesNotMatch(meMarkup, /扫码未开放/);
  const context = loadMe();
  context.page.openScanEntry();
  assert.equal(context.dialogs.length, 1);
  const firstDialog = context.dialogs[0];
  assert.ok(firstDialog);
  assert.match(firstDialog.content, /已确认报名|主办/);
  assert.match(firstDialog.content, /签到与反馈/);
  assert.deepEqual(context.navigations, []);
  assert.equal(context.scans, 0);
  firstDialog.success({ confirm: false });
  assert.deepEqual(context.navigations, []);
  context.page.openScanEntry();
  const secondDialog = context.dialogs[1];
  assert.ok(secondDialog);
  secondDialog.success({ confirm: true });
  assert.deepEqual(context.navigations, ['/subpackages/activity/itinerary/itinerary']);
});

test('interest controls open the actual explanatory section without offering an unavailable edit', () => {
  assert.match(meMarkup, /<button[^>]*bindtap="goInterestInfo"[^>]*>了解兴趣标签 ›<\/button>/);
  assert.match(meMarkup, /<button[^>]*bindtap="goInterestInfo"[^>]*>查看说明<\/button>/);
  assert.doesNotMatch(meMarkup, /编辑兴趣|＋ 添加/);

  const { page, navigations } = loadMe();
  page.goInterestInfo();
  assert.deepEqual(navigations, ['/subpackages/profile/profile-edit/profile-edit?focus=interests']);

  const editMarkup = readFileSync(new URL('../miniprogram/subpackages/profile/profile-edit/profile-edit.wxml', import.meta.url), 'utf8');
  assert.match(editMarkup, /id="interestInfoSection"[\s\S]*?标签还不能选择或保存/);
  let editPage: Record<string, any> | undefined;
  const scrolls: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/profile/profile-edit/profile-edit.js', import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { editPage = definition; },
    wx: { pageScrollTo({ selector }: { selector: string }) { scrolls.push(selector); } },
    require(path: string) {
      if (path === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      throw new Error(`unexpected require ${path}`);
    }
  });
  assert.ok(editPage);
  editPage.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  editPage.onLoad({ focus: 'interests' });
  editPage.onReady();
  assert.deepEqual(scrolls, ['#interestInfoSection']);
});
