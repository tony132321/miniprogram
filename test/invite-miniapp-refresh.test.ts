import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('known member activity opens by id when its invitation summary is withheld for review', async () => {
  let page: Record<string, any> | undefined;
  const paths: string[] = [];
  let switchedTo = '';
  const event = { id: 'member-event', hostId: 'host', version: 3, status: 'CONFIRMED',
    reviewStatus: 'PENDING', recruiting: false, visibleContentVersion: 2,
    payload: { title: '已审核标题', startAt: '2027-01-02T12:00:00.000Z',
      endAt: '2027-01-02T14:00:00.000Z', venueName: '已审核场馆', visibility: 'INVITE' } };
  const api = { async get(path: string) {
    paths.push(path);
    if (path.startsWith('/i/')) throw Object.assign(new Error('邀请暂不可用'), { code: 'NOT_FOUND' });
    if (path === '/events/member-event') return event;
    if (path === '/system/safety') return { status: 'OPEN' };
    if (path === '/me/registrations') return { items: [{ id: 'member-reg', event_id: event.id, status: 'CONFIRMED' }] };
    return { items: [] };
  } };
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'member' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    Date: class extends Date { static now() { return Date.parse('2027-01-02T12:00:00.000Z'); } },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? 'member' : ''; },
      switchTab({ url }: { url: string }) { switchedTo = url; } },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ id: event.id, token: 'old-token' });
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.event.payload.title, '已审核标题');
  assert.equal(page.data.canCheckIn, true);
  assert.ok(paths.includes('/events/member-event'));

  paths.length = 0;
  page.setData({ id: '', token: 'old-token', event: null, loadState: 'IDLE' });
  assert.equal(await page.refresh(), false);
  assert.equal(page.data.loadState, 'ERROR');
  assert.equal(paths.some(path => path.startsWith('/events/')), false);
  page.goToMyActivities();
  assert.equal(switchedTo, '/pages/index/index');
});
