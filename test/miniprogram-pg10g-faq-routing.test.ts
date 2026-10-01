import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/subpackages/profile/support/support.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/subpackages/profile/support/support.wxml', import.meta.url), 'utf8');

test('PG10-G FAQ follows the four reference questions with honest R1 answers and a real host route', () => {
  let page: Record<string, any> | undefined;
  const navigations: string[] = [];
  runInNewContext(source, {
    Page(definition: Record<string, any>) { page = definition; },
    require(path: string) {
      if (path === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      assert.equal(path, '../../../config.js');
      return { developmentUser: '' };
    },
    wx: {
      switchTab({ url }: { url: string }) { navigations.push(url); },
      navigateTo({ url }: { url: string }) { navigations.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  assert.deepEqual(Array.from(page.data.questions, (item: { title: string }) => item.title), [
    '组局被爽约如何处理？',
    '报名费 AA 分摊有争议？',
    '活动无法成局怎么退改？',
    '如何申请成为认证主理人/局长？'
  ]);
  assert.match(page.data.questions[1].answer, /不处理真实付款/);
  assert.match(page.data.questions[2].answer, /不处理退款/);
  assert.match(page.data.questions[3].answer, /尚未开放/);
  assert.match(markup, /support-faq-answer[^>]*>[\s\S]*?bindtap="goCreate"[^>]*>发起受控活动/);
  page.toggleFaq({ currentTarget: { dataset: { index: 3 } } });
  assert.equal(page.data.openIndex, 3);
  page.goCreate();
  assert.deepEqual(navigations, ['/pages/create/create']);
});
