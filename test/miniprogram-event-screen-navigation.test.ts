import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);

function eventPage(apiPost?: (path: string, body: Record<string, unknown>) => Promise<unknown>) {
  let page: Record<string, any> | undefined;
  const scrolls: Record<string, unknown>[] = [];
  const routes: string[] = [];
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { post: apiPost } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync() { return ''; },
      pageScrollTo(options: Record<string, unknown>) { scrolls.push(options); },
      navigateBack({ success }: { success?: () => void }) { routes.push('back'); success?.(); },
      navigateTo({ url }: { url: string }) { routes.push(url); },
      switchTab({ url }: { url: string }) { routes.push(url); }
    },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>, callback?: () => void) {
    Object.assign(this.data, patch);
    callback?.();
  };
  page.setData({
    event: { id: 'e1', status: 'CONFIRMED', version: 3 },
    isHost: true,
    canManageCheckins: true,
    loadState: 'READY'
  });
  return { page, scrolls, routes };
}

test('activity subsections open as focused screens and back returns to event details', () => {
  const { page, scrolls, routes } = eventPage();
  page.jumpToSection({ currentTarget: { dataset: { section: 'hostSection' } } });
  assert.equal(page.data.activeSection, 'hostSection');
  assert.equal(page.data.sectionTitle, '主办方工作台');
  assert.equal(scrolls.at(-1)?.scrollTop, 0);
  assert.equal(scrolls.at(-1)?.duration, 0);

  page.goBack();
  assert.equal(page.data.activeSection, 'detailsSection');
  assert.equal(page.data.sectionTitle, '活动详情');
  assert.deepEqual(routes, [], 'back from a section must keep the live event open');

  page.goBack();
  assert.deepEqual(routes, ['back']);
});

test('only an authorized organizer can enter the QR display mode', () => {
  const { page } = eventPage();
  page.setData({ isHost: false, canManageCheckins: false });
  page.selectCheckInMode({ currentTarget: { dataset: { mode: 'host' } } });
  assert.equal(page.data.checkInMode, 'participant');

  page.setData({ canManageCheckins: true });
  page.selectCheckInMode({ currentTarget: { dataset: { mode: 'host' } } });
  assert.equal(page.data.checkInMode, 'host');
  page.selectCheckInMode({ currentTarget: { dataset: { mode: 'participant' } } });
  assert.equal(page.data.checkInMode, 'participant');
});

test('confirmed registration success opens live details or the existing itinerary route', () => {
  const { page, routes } = eventPage();
  page.setData({ successState: 'JOINED', activeSection: 'detailsSection',
    myRegistration: { status: 'CONFIRMED' } });
  page.jumpToSection({ currentTarget: { dataset: { section: 'checkinSection' } } });
  assert.equal(page.data.successState, '', 'leaving success card must reveal the destination');
  assert.equal(page.data.activeSection, 'checkinSection');
  page.setData({ successState: 'JOINED' });
  page.viewSuccessDetails();
  assert.equal(page.data.successState, '');
  assert.equal(page.data.activeSection, 'detailsSection');
  page.goToItinerary();
  assert.deepEqual(routes, ['/subpackages/activity/itinerary/itinerary']);
});

test('the unsure choice records interest without presenting a confirmed seat', async () => {
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  let posted = false;
  const { page } = eventPage(async (path, body) => {
    writes.push({ path, body });
    posted = true;
    return { id: 'r-interest', status: 'INTERESTED' };
  });
  const liveEvent = { id: 'e1', version: 3, status: 'RECRUITING', recruiting: true,
    payload: { title: '周末羽毛球', startAt: '2027-01-02T12:00:00Z', endAt: '2027-01-02T14:00:00Z',
      city: '深圳', venueName: '测试球馆', maxParticipants: 6, feeMode: 'FREE', approvalMode: 'AUTO' },
    stats: { confirmed: 1 } };
  page.setData({ event: liveEvent, id: 'e1', token: 'invite-token', canJoin: true,
    canExpressInterest: true, isHost: false, successState: '' });
  page.refresh = async function () {
    this.setData({ loadState: 'READY', event: liveEvent, canJoin: !posted,
      canExpressInterest: !posted, myRegistration: posted ? { id: 'r-interest', status: 'INTERESTED' } : null });
    return true;
  };
  page.openJoinConfirmation();
  page.selectJoinChoice({ currentTarget: { dataset: { choice: 'INTERESTED' } } });
  assert.equal(page.data.joinChoice, 'INTERESTED');
  await page.confirmJoin();
  assert.equal(page.data.myRegistration.status, 'INTERESTED');
  assert.equal(page.data.successState, '');
  assert.equal(page.data.joinConfirmation, null);
  assert.equal(writes.length, 1);
  const write = writes[0]!;
  assert.equal(write.path, '/events/e1/interests');
  assert.equal(write.body.inviteToken, 'invite-token');
  assert.equal(write.body.expectedVersion, 3);
});

test('a rejected publication no longer shows the submitted success screen', () => {
  const { page } = eventPage();
  page.setData({ successState: 'PUBLISHED', isHost: true,
    event: { id: 'e1', status: 'RECRUITING', reviewStatus: 'REJECTED' } });
  page.reconcileSuccessState();
  assert.equal(page.data.successState, '');
});
