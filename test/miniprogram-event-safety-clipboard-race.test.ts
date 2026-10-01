import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const eventA = { id: 'event-a', version: 1, payload: { title: 'A 的邀请活动',
  city: '上海', venueName: 'A 的私人集合点', startAt: '2026-10-01T10:00:00Z',
  endAt: '2026-10-01T12:00:00Z' } };
const eventB = { id: 'event-b', version: 1, payload: { title: 'B 的活动',
  city: '北京', venueName: 'B 的场馆', startAt: '2026-10-02T10:00:00Z',
  endAt: '2026-10-02T12:00:00Z' } };

function mount() {
  let page: Record<string, any> | undefined;
  let session = 'token-a';
  let user = 'user-a';
  let sheet: Record<string, any> | undefined;
  const clipboard: Array<Record<string, any>> = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'sessionToken' ? session : key === 'userId' ? user : ''; },
      showActionSheet(options: Record<string, any>) { sheet = options; },
      setClipboardData(options: Record<string, any>) { clipboard.push(options); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  page.setData({ id: eventA.id, event: eventA, loadState: 'READY', currentUser: 'session:user-a:token-a',
    hostAlias: 'A 的主办方', message: '' });
  return { page, clipboard,
    sheet() { assert.ok(sheet); return sheet; },
    switchAccount() { session = 'token-b'; user = 'user-b'; },
    showEventB() { page!.setData({ id: eventB.id, event: eventB, currentUser: `session:${user}:${session}`, message: 'B 的消息' }); } };
}

test('an old action sheet cannot copy A activity details after switching to account B', () => {
  const { page, clipboard, sheet, switchAccount, showEventB } = mount();
  page.openEventActions();
  switchAccount();
  showEventB();

  sheet().success({ tapIndex: 1 });
  assert.equal(clipboard.length, 0);
  assert.equal(page.data.message, 'B 的消息');
});

test('an old action sheet cannot copy activity A after the page opens activity B', () => {
  const { page, clipboard, sheet, showEventB } = mount();
  page.openEventActions();
  showEventB();

  sheet().success({ tapIndex: 1 });
  assert.equal(clipboard.length, 0);
});

test('direct copy refuses a stale activity still displayed after a session switch', () => {
  const { page, clipboard, switchAccount } = mount();
  switchAccount();

  page.copySafetyDetails();
  assert.equal(clipboard.length, 0);
});

test('late clipboard success and failure cannot post A feedback into B activity', () => {
  for (const callback of ['success', 'fail']) {
    const { page, clipboard, switchAccount, showEventB } = mount();
    page.copySafetyDetails();
    assert.equal(clipboard.length, 1);
    switchAccount();
    showEventB();

    clipboard[0]![callback]();
    assert.equal(page.data.message, 'B 的消息', `${callback} must not update account B`);
  }
});
