import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('signed-out profile leaves login and public navigation visible but gates private actions', () => {
  const markup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  const login = markup.indexOf('bindtap="login"');
  const privateGate = markup.indexOf('<block wx:if="{{hasSession || developmentMode}}">');
  const reminder = markup.indexOf('id="reminderConsentSwitch"');
  const exportData = markup.indexOf('id="exportDataButton"');
  const report = markup.indexOf('bindtap="report"');
  const about = markup.indexOf('id="aboutButton"');
  const lastPrivateGateEnd = markup.lastIndexOf('</block>', about);

  assert.ok(login >= 0 && login < privateGate, 'WeChat login must remain visible before the private gate');
  assert.ok(privateGate < reminder && reminder < exportData && exportData < report,
    'consents, privacy export and reports must stay inside the private gate');
  assert.ok(report < lastPrivateGateEnd && lastPrivateGateEnd < about,
    'private gate must close after reports while public About stays visible');
  assert.match(markup, /bindtap="goDiscover"/);
});

test('a successful published-event edit returns to the fresh create screen with visible success feedback', async () => {
  let page: Record<string, any> | undefined;
  const navigations: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post(url: string) {
        assert.equal(url, '/events/e1/changes');
        return { id: 'e1', version: 3 };
      } } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { navigateTo(options: Record<string, any>) { navigations.push(options.url); },
      getStorageSync() { return ''; } }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  const candidate = page.buildInput();
  page.setData({ stage: 'REVIEW', editingEvent: { id: 'e1', version: 2 },
    changePreview: { candidate, patch: { title: '新标题' }, expectedVersion: 2 } });

  await page.confirmPublish();

  assert.deepEqual(navigations, ['/pages/event/event?id=e1']);
  assert.equal(page.data.stage, 'IDEA');
  assert.equal(page.data.editingEvent, null);
  assert.equal(page.data.changePreview, null);
  assert.match(page.data.message, /新版本已生效/);
});

test('signed-out message filters never request a protected approval queue', async () => {
  let page: Record<string, any> | undefined;
  const requests: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/messages/messages.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async get(url: string) { requests.push(url); throw new Error('401'); } } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ loadState: 'UNAUTHENTICATED', approvalLoadState: 'IDLE' });
  await page.setFilter({ currentTarget: { dataset: { filter: 'INTERACTION' } } });
  assert.deepEqual(requests, []);
  assert.equal(page.data.approvalLoadState, 'IDLE');
  assert.equal(page.data.loadState, 'UNAUTHENTICATED');
});
