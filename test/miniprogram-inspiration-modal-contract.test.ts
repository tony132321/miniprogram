import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

type PageName = 'index' | 'discover';
type ModalOptions = {
  title: string;
  content: string;
  confirmText: string;
  cancelText: string;
  success(result: { confirm: boolean; cancel: boolean; errMsg: string }): void;
  fail?(result: { errMsg: string }): void;
};
type Entry = {
  name: string;
  pageName: PageName;
  className: string;
  dataset: { label: string } | { title: string };
  notice: string;
};

const entries: Entry[] = [
  {
    name: 'home food category', pageName: 'index', className: 'category-card', dataset: { label: '美食' },
    notice: '美食目前仅供灵感参考。当前只能发起羽毛球活动，是否前往发起？'
  },
  {
    name: 'home inspiration card', pageName: 'index', className: 'inspiration-card', dataset: { title: '周末聚餐' },
    notice: '周末聚餐目前仅供灵感参考。当前只能发起羽毛球活动，是否前往发起？'
  },
  {
    name: 'discovery featured inspiration', pageName: 'discover', className: 'featured-card',
    dataset: { title: '咖啡聊天会' },
    notice: '咖啡聊天会目前仅供灵感参考。当前只能发起羽毛球活动，是否前往发起？'
  }
];

function loadEntry(entry: Entry, modalAvailable = true) {
  let definition: Record<string, any> | undefined;
  let modal: ModalOptions | undefined;
  const routes: string[] = [];
  const wx: Record<string, any> = {
    getStorageSync() { return ''; },
    switchTab({ url }: { url: string }) { routes.push(url); }
  };
  if (modalAvailable) wx.showModal = (options: ModalOptions) => { modal = options; };
  runInNewContext(readFileSync(new URL(
    `../miniprogram/pages/${entry.pageName}/${entry.pageName}.js`, import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: '' };
      if (path === '../../utils/city.js') return cityModule;
      throw new Error(`unexpected require ${path}`);
    },
    Page(page: Record<string, any>) { definition = page; }, wx
  });
  assert.ok(definition);
  const page = definition;
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  const markup = readFileSync(new URL(
    `../miniprogram/pages/${entry.pageName}/${entry.pageName}.wxml`, import.meta.url), 'utf8');
  const button = Array.from(markup.matchAll(/<button\b[^>]*>/g), match => match[0]).find(tag =>
    tag.match(/\bclass="([^"]+)"/)?.[1]?.split(/\s+/).includes(entry.className));
  assert.ok(button, `${entry.name} must use its existing rendered button`);
  const handler = button.match(/\bbindtap="([^"]+)"/)?.[1];
  assert.ok(handler && typeof page[handler] === 'function', 'the actual template binding must resolve');
  if ('label' in entry.dataset) {
    const label = entry.dataset.label;
    assert.match(button, /data-label="\{\{item\.label\}\}"/);
    assert.ok(page.data.categoryIdeas.some((item: { label: string }) => item.label === label));
  } else if (entry.pageName === 'discover') {
    const title = entry.dataset.title;
    assert.match(button, /data-title="\{\{item\.title\}\}"/);
    assert.ok(page.data.inspirationCards.some((item: { title: string }) => item.title === title));
  } else {
    assert.ok(button.includes(`data-title="${entry.dataset.title}"`));
  }
  return {
    page, routes, markup,
    tap() { page[handler]({ currentTarget: { dataset: entry.dataset } }); },
    modal() { assert.ok(modal, 'tapping the existing inspiration button must request a modal'); return modal; }
  };
}

for (const entry of entries) {
  test(`${entry.name} sends native modal labels within WeChat's four-character limit`, () => {
    const screen = loadEntry(entry);
    screen.tap();
    const modal = screen.modal();
    assert.equal(modal.title, '活动灵感');
    assert.equal(modal.content, entry.notice);
    assert.ok(modal.confirmText.length > 0 && modal.confirmText.length <= 4,
      `confirmText ${JSON.stringify(modal.confirmText)} exceeds the native four-character contract`);
    assert.ok(modal.cancelText.length > 0 && modal.cancelText.length <= 4,
      `cancelText ${JSON.stringify(modal.cancelText)} exceeds the native four-character contract`);
    assert.deepEqual(screen.routes, [], 'an unavailable inspiration must not navigate before confirmation');
  });

  test(`${entry.name} keeps browsing after cancellation`, () => {
    const screen = loadEntry(entry);
    screen.tap();
    screen.modal().success({ confirm: false, cancel: true, errMsg: 'showModal:ok' });
    assert.deepEqual(screen.routes, []);
  });

  test(`${entry.name} opens the existing create tab only after confirmation`, () => {
    const screen = loadEntry(entry);
    screen.tap();
    assert.deepEqual(screen.routes, []);
    screen.modal().success({ confirm: true, cancel: false, errMsg: 'showModal:ok' });
    assert.deepEqual(screen.routes, ['/pages/create/create']);
  });

  test(`${entry.name} retains the exact capability notice if the native modal fails`, () => {
    const screen = loadEntry(entry);
    screen.tap();
    const modal = screen.modal();
    assert.equal(typeof modal.fail, 'function', 'API failure must reach the page instead of silently disappearing');
    modal.fail!({ errMsg: 'showModal:fail internal error' });
    assert.equal(screen.page.data.availabilityMessage, entry.notice);
    assert.deepEqual(screen.routes, [], 'failure is not user confirmation');
    assert.match(screen.markup,
      /<view\b[^>]*wx:if="\{\{availabilityMessage\}\}"[^>]*>\{\{availabilityMessage\}\}<\/view>/,
      'the failure state must feed the existing conditional, visible notice');
  });

  test(`${entry.name} uses the same visible capability notice when the modal API is unavailable`, () => {
    const screen = loadEntry(entry, false);
    screen.tap();
    assert.equal(screen.page.data.availabilityMessage, entry.notice);
    assert.deepEqual(screen.routes, []);
  });
}
