import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const detail = { id: 'event-one', hostId: 'member', version: 3, status: 'RECRUITING', recruiting: true,
  payload: { title: '周末羽毛球', visibility: 'INVITE', feeMode: 'FREE',
    startAt: '2027-03-22T11:00:00Z', endAt: '2027-03-22T13:00:00Z' } };

function mount(readDetail: () => Promise<unknown>) {
  const storage = new Map([['sessionToken', 'token-first'], ['userId', 'member']]);
  let page: Record<string, any> | undefined;
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/activity/event/event.js', import.meta.url), 'utf8'), {
    require(module: string) {
      if ((module === '../../utils/api.js' || module === '../../../utils/api.js')) return { api: { async get(route: string) {
        if (route === '/events/event-one') return readDetail();
        if (route === '/system/safety') return { status: 'OPEN' };
        if (route === '/events/event-one/aliases') return { items: [], notice: { version: 'v1', text: '说明' } };
        return { items: [] };
      } } };
      if ((module === '../../utils/checkin-qr.js' || module === '../utils/checkin-qr.js')) return { drawCheckInQr() {} };
      if ((module === '../../config.js' || module === '../../../config.js')) return { developmentUser: '' };
      throw new Error(`unexpected require ${module}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return storage.get(key) ?? ''; } },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  page.setData({ id: 'event-one' });
  return { page, storage };
}

test('same member new session discards a late old activity detail response', async () => {
  let finishDetail!: (value: unknown) => void;
  let markStarted!: () => void;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  const { page, storage } = mount(() => new Promise(resolve => { finishDetail = resolve; markStarted(); }));
  const loading = page.refresh();
  await started;
  storage.set('sessionToken', 'token-second');
  finishDetail(detail);
  assert.equal(await loading, false);
  assert.equal(page.data.event, null);
  assert.notEqual(page.data.loadState, 'READY');
});

test('same member new session clears old host controls before refreshing', async () => {
  const { page, storage } = mount(async () => detail);
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.isHost, true);
  page.setData({ registrations: [{ id: 'private-seat' }], shareSourceToken: 'old-source',
    questionText: '旧会话私密内容' });
  storage.set('sessionToken', 'token-second');
  await page.onShow();
  assert.equal(page.data.event, null);
  assert.equal(page.data.isHost, false);
  assert.equal(page.data.registrations.length, 0);
  assert.equal(page.data.shareSourceToken, '');
  assert.equal(page.data.questionText, '');
});
