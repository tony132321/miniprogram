import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('event page refuses an invitation card while the current version awaits review', async () => {
  let page: Record<string, any> | undefined;
  let submittedIntents = 0;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { async post() { submittedIntents++; } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return ''; } }, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: 'invite-1', isHost: true, currentUser: 'host', loadState: 'READY', shareSourceToken: 'stale-source', event: {
    id: 'invite-1', hostId: 'host', version: 2, status: 'RECRUITING', inviteToken: 'private-token',
    inviteRemainingMs: 60_000, recruiting: true,
    reviewStatus: 'PENDING', payload: { title: '待审活动', registrationDeadline: '2027-03-22T05:30:00.000Z' }
  } });
  page._inviteValidUntil = Date.now() + 60_000;
  page.setData({ safetyStatus: 'OPEN' });
  await page.prepareShare();
  assert.equal(submittedIntents, 0);
  assert.match(page.data.message, /不能生成分享卡/);
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');

  page.setData({ event: { ...page.data.event, reviewStatus: 'APPROVED' }, shareSourceToken: '' });
  await page.prepareShare();
  assert.equal(submittedIntents, 1);
  assert.match(page.onShareAppMessage().path, /token=private-token/);
});
