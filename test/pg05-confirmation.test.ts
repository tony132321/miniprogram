import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const eventSource = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
const eventMarkup = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');

function makePage() {
  let page: Record<string, any> | undefined;
  let actor = 'guest';
  const scrolls: string[] = [];
  runInNewContext(eventSource, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {} };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'guest' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? actor : ''; },
      pageScrollTo({ selector }: { selector: string }) { scrolls.push(selector); }
    },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  page.setData({ loadState: 'READY', canJoin: true, token: 'invite-token',
    event: { id: 'event-1', version: 2, status: 'RECRUITING', recruiting: true,
      payload: { title: '周六羽毛球', startAt: '2026-10-10T06:00:00Z',
        endAt: '2026-10-10T08:00:00Z', city: '深圳', venueName: '公共球馆',
        feeMode: 'AA', feeCapFen: 5000, approvalMode: 'MANUAL',
        cancellationRule: '开始前可退出', skillLevel: '新手友好', maxParticipants: 8 } } });
  return { page, scrolls, setActor(value: string) { actor = value; } };
}

test('PG05 review shows the current server rules and cancelling never submits', async () => {
  assert.match(eventMarkup, /id="joinButton"[^>]*bindtap="openJoinConfirmation"/);
  assert.match(eventMarkup, /bindtap="confirmJoin"/);
  assert.match(eventMarkup, /bindtap="cancelJoin"/);
  const { page } = makePage();
  let submissions = 0;
  page.action = async () => { submissions++; return { id: 'registration-1' }; };
  page.openJoinConfirmation();
  assert.equal(page.data.joinConfirmation.version, 2);
  assert.match(page.data.joinConfirmation.fee, /50/);
  assert.match(page.data.joinConfirmation.location, /深圳/);
  assert.equal(page.data.joinConfirmation.cancellationRule, '开始前可退出');
  page.cancelJoin();
  assert.equal(page.data.joinConfirmation, null);
  assert.equal(submissions, 0);
});

test('PG05 final confirmation refuses changed rules or a different signed-in identity', async () => {
  const { page, setActor } = makePage();
  let submissions = 0;
  page.action = async () => { submissions++; return { id: 'registration-1' }; };
  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: { ...this.data.event, version: 3 } });
    return true;
  };
  page.openJoinConfirmation();
  await page.confirmJoin();
  assert.equal(submissions, 0);
  assert.match(page.data.message, /重新核对/);
  assert.equal(page.data.joinConfirmation, null);

  page.openJoinConfirmation();
  setActor('different-member');
  await page.confirmJoin();
  assert.equal(submissions, 0);
  assert.match(page.data.message, /身份/);
});

test('PG05 final confirmation submits once after a fresh read and shows only confirmed success', async () => {
  const { page } = makePage();
  const submissions: Array<Record<string, unknown>> = [];
  page.refresh = async function () { this.setData({ loadState: 'READY' }); return true; };
  page.action = async function (_path: string, payload: Record<string, unknown>) {
    submissions.push(payload);
    this.setData({ myRegistration: { status: 'CONFIRMED' } });
    return { id: 'registration-1' };
  };
  page.openJoinConfirmation();
  const pending = page.confirmJoin();
  await page.confirmJoin();
  await pending;
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0]?.inviteToken, 'invite-token');
  assert.equal(submissions[0]?.acceptedRules, true);
  assert.equal(page.data.joinConfirmation, null);
  assert.equal(page.data.successState, 'JOINED');
});

test('event deep link scrolls only to a loaded and authorized section', async () => {
  const { page, scrolls } = makePage();
  page.refresh = async function () { this.setData({ loadState: 'READY', isHost: false }); return true; };
  await page.onLoad({ id: 'event-1', section: 'checkinSection' });
  assert.deepEqual(scrolls, ['#checkinSection']);
  assert.equal(page.data.activeSection, 'checkinSection');
  scrolls.length = 0;
  await page.onLoad({ id: 'event-1', section: 'hostSection' });
  assert.deepEqual(scrolls, []);
  assert.equal(page.data.activeSection, 'detailsSection');
  page.refresh = async function () { this.setData({ loadState: 'READY', isHost: false, canApproveRegistration: true }); return true; };
  await page.onLoad({ id: 'event-1', section: 'cohostApprovalSection' });
  assert.deepEqual(scrolls, ['#cohostApprovalSection']);
  assert.equal(page.data.activeSection, 'cohostApprovalSection');
  scrolls.length = 0;
  page.refresh = async function () { this.setData({ loadState: 'READY', isHost: false,
    canApproveRegistration: false, canManageAnnouncements: true }); return true; };
  await page.onLoad({ id: 'event-1', section: 'cohostContentSection' });
  assert.deepEqual(scrolls, ['#cohostContentSection']);
  assert.equal(page.data.activeSection, 'cohostContentSection');
  scrolls.length = 0;
  page.refresh = async function () { this.setData({ loadState: 'READY', isHost: false,
    canManageAnnouncements: false, canManageCheckins: true }); return true; };
  await page.onLoad({ id: 'event-1', section: 'cohostCheckinSection' });
  assert.deepEqual(scrolls, ['#cohostCheckinSection']);
  assert.equal(page.data.activeSection, 'cohostCheckinSection');
  scrolls.length = 0;
  page.refresh = async function () { this.setData({ loadState: 'READY', isHost: true }); return true; };
  await page.onLoad({ id: 'event-1', section: 'hostSection' });
  assert.deepEqual(scrolls, ['#hostSection']);
  assert.equal(page.data.activeSection, 'hostSection');
  scrolls.length = 0;
  await page.onLoad({ id: 'event-1', section: 'cohostApprovalSection' });
  assert.deepEqual(scrolls, []);
  await page.onLoad({ id: 'event-1', section: 'nonexistent' });
  assert.deepEqual(scrolls, []);
});

test('cohost workbench sections have guarded top navigation and card layout', () => {
  for (const section of ['cohostApprovalSection', 'cohostContentSection', 'cohostCheckinSection']) {
    assert.match(eventMarkup, new RegExp(`data-section="${section}"[^>]*bindtap="jumpToSection"`));
    assert.match(eventMarkup, new RegExp(`id="${section}"[^>]*class="event-section`));
  }
});
