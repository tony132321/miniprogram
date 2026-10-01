import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('an old editor cannot open its cohost workbench after the login session changes', () => {
  let page: Record<string, any> | undefined;
  let sessionToken = 'first-session';
  const routes: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getWindowInfo() { return { statusBarHeight: 24 }; },
      getStorageSync(key: string) { return key === 'sessionToken' ? sessionToken : key === 'userId' ? 'host' : ''; },
      navigateTo({ url }: { url: string }) { routes.push(url); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>, done?: () => void) {
    Object.assign(this.data, patch);
    done?.();
  };
  page._shownIdentity = 'session:host:first-session';
  page.setData({ stage: 'FORM', editingEvent: { id: 'private-old', version: 2 } });

  sessionToken = 'second-session';
  page.openCohostSetup();
  assert.deepEqual(routes, [], 'the previous event ID must not be sent to a new-session route');
  assert.equal(page.data.editingEvent, null);
  assert.equal(page.data.stage, 'IDEA');
  assert.match(page.data.message, /账号已切换/);

  page._shownIdentity = 'session:host:second-session';
  page.setData({ stage: 'FORM', editingEvent: { id: 'current-event', version: 3 } });
  page.openCohostSetup();
  assert.deepEqual(routes, ['/pages/event/event?id=current-event&section=hostSection']);
});
