import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('discovery all-activity and unavailable favorite actions reach honest destinations', () => {
  let page: Record<string, any> | undefined;
  const routes: string[] = [];
  const toasts: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/discover/discover.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      navigateTo(options: { url: string }) { routes.push(options.url); },
      showToast(options: { title: string }) { toasts.push(options.title); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };

  page.goPersonalAll();
  assert.deepEqual(routes, ['/subpackages/profile/moments/moments?filter=all']);

  page.showUnavailable({ currentTarget: { dataset: { name: '收藏灵感' } } });
  assert.match(page.data.availabilityMessage, /收藏灵感.*暂未开放/);
  assert.deepEqual(toasts, ['收藏灵感暂未开放']);
  assert.deepEqual(routes, ['/subpackages/profile/moments/moments?filter=all']);
});
