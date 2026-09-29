import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('the create tab bar is absent on idea and review but returns for form and other tabs', async () => {
  let component: Record<string, any> | undefined;
  let page: Record<string, any> | undefined;
  let currentRoute = 'pages/create/create';
  const shared = {
    wx: {
      getWindowInfo() { return { statusBarHeight: 0 }; },
      getStorageSync() { return ''; },
      pageScrollTo() {}
    },
    getCurrentPages() { return [{ route: currentRoute, get data() { return page?.data; } }]; }
  };
  runInNewContext(readFileSync(new URL('../miniprogram/custom-tab-bar/index.js', import.meta.url), 'utf8'), {
    ...shared,
    Component(definition: Record<string, any>) { component = definition; }
  });
  assert.ok(component);
  const bar: Record<string, any> = { data: { ...component.data }, ...component.methods };
  bar.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  bar.syncSelected();
  assert.equal(bar.data.hidden, true, 'idea entry hides the global five-tab bar');

  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    ...shared,
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(path);
    },
    Page(definition: Record<string, any>) { page = definition; }
  });
  assert.ok(page);
  page.getTabBar = () => bar;
  page.setData = function (patch: Record<string, any>, done?: () => void) { Object.assign(this.data, patch); done?.(); };

  page.openForm();
  assert.equal(page.data.stage, 'FORM');
  assert.equal(bar.data.hidden, false, 'full form keeps five-tab navigation');
  page.backToIdea();
  assert.equal(bar.data.hidden, true);

  page.openForm();
  page.setData({ hostParticipates: true });
  page.saveDraft = async () => ({ id: 'draft-1', version: 1, payload: { startAt: '', endAt: '', registrationDeadline: '', confirmationDeadline: '', feeMode: 'FREE' } });
  await page.publish();
  assert.equal(page.data.stage, 'REVIEW');
  assert.equal(bar.data.hidden, true, 'review CTA must sit above the device safe area');

  currentRoute = 'pages/index/index';
  bar.syncSelected();
  assert.equal(bar.data.hidden, false, 'another tab never inherits create-only hidden state');
});
