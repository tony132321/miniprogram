import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../miniprogram/subpackages/activity/event/event.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/subpackages/activity/event/event.wxml', import.meta.url), 'utf8');

function pageWithApi(post: (path: string, body: Record<string, unknown>) => Promise<unknown>,
  get?: (path: string) => Promise<unknown>) {
  let page: Record<string, any> | undefined;
  runInNewContext(source, {
    require(path: string) {
      if ((path === '../../utils/api.js' || path === '../../../utils/api.js')) return { api: { post, get } };
      if ((path === '../../utils/checkin-qr.js' || path === '../../../utils/checkin-qr.js')) return { drawCheckInQr() {} };
      if ((path === '../../config.js' || path === '../../../config.js')) return { developmentUser: 'friend' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return ''; } }, setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  return page;
}

function visibleControl(handlerOrId: string, context: Record<string, unknown>): boolean {
  const tags = markup.match(/<(?:button|input|textarea)\b(?:"[^"]*"|[^>])*>/gs) || [];
  const tag = tags.find(value => value.includes(`bindtap="${handlerOrId}"`) || value.includes(`id="${handlerOrId}"`));
  assert.ok(tag, `missing ${handlerOrId} control`);
  const condition = tag.match(/wx:if="{{([^}]+)}}"/s)?.[1];
  if (!condition) return true;
  return Boolean(Function('state', `with (state) { return (${condition}); }`)(context));
}

test('reservation claim refuses a stale event when the page route points elsewhere', async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const page = pageWithApi(async (path, body) => { calls.push({ path, body }); return { eventId: 'event-a', status: 'CONFIRMED' }; });
  page.refresh = async () => true;
  page.setData({ id: 'event-b', reservationToken: 'token-b', event: { id: 'event-a', version: 4 },
    currentUser: 'friend', loadState: 'READY' });
  await page.claim();
  assert.equal(calls.length, 0);
});

test('reservation claim submits only the event displayed on the current route', async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const page = pageWithApi(async (path, body) => { calls.push({ path, body }); return { eventId: 'event-a', status: 'CONFIRMED' }; });
  page.refresh = async () => true;
  page.setData({ id: 'event-a', reservationToken: 'token-b', event: { id: 'event-a', version: 4 },
    currentUser: 'friend', loadState: 'READY' });
  await page.claim();
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.path, '/reservations/token-b/claim');
  assert.equal(calls[0]?.body.expectedVersion, 4);
  assert.equal(calls[0]?.body.expectedEventId, 'event-a');
});

test('an invite token cannot display another event under the URL event ID', async () => {
  const paths: string[] = [];
  const page = pageWithApi(async () => { throw new Error('unexpected mutation'); }, async path => {
    paths.push(path);
    if (path === '/i/invite-b') return { id: 'event-b', version: 4, payload: { visibility: 'INVITE_ONLY' } };
    throw new Error(`unexpected GET ${path}`);
  });
  page.setData({ id: 'event-a', token: 'invite-b' });
  assert.equal(await page.refresh(), false);
  assert.deepEqual(paths, ['/i/invite-b']);
  assert.equal(page.data.loadState, 'ERROR');
  assert.equal(page.data.event, null);
  assert.match(page.data.message, /邀请口令.*活动不匹配/);
});

test('terminal event and free activity controls cannot invite an action the server rejects', () => {
  const completed = { event: { status: 'COMPLETED', recruiting: false, riskPaused: false,
    payload: { feeMode: 'FREE' } }, isHost: true, currentUser: 'host',
    myRegistration: { status: 'CONFIRMED' }, item: { user_id: 'friend', status: 'CONFIRMED' },
    safetyStatus: 'OPEN', canUseCollaboration: true, canManageAnnouncements: true,
    canApproveRegistration: true, canCheckIn: false, canCompleteEvent: false, outcome: {} };
  for (const control of ['leaveButton', 'claim', 'removeParticipant', 'approve', 'completionAnomalyInput',
    'completionVenueIssueInput', 'expenseTotalYuan', 'postAnnouncement', 'askFact', 'reconfirmButton'])
    assert.equal(visibleControl(control, completed), false, `${control} should be unavailable after completion`);
  assert.equal(visibleControl('claim', { ...completed, event: { ...completed.event,
    status: 'RECRUITING', recruiting: true } }), true);
  assert.equal(visibleControl('expenseTotalYuan', { ...completed, event: { ...completed.event, status: 'CONFIRMED',
    payload: { feeMode: 'AA' } } }), true);
  assert.equal(visibleControl('leaveButton', { ...completed, event: { ...completed.event, status: 'RECRUITING' } }), true);
  assert.equal(visibleControl('leaveButton', { ...completed, myRegistration: { status: 'REJECTED' },
    event: { ...completed.event, status: 'RECRUITING' } }), false);
  assert.equal(visibleControl('reconfirmButton', { ...completed, myRegistration: { status: 'RECONFIRM_REQUIRED' },
    event: { ...completed.event, status: 'RECRUITING', reviewStatus: 'APPROVED' }, reconfirmation: { toVersion: 2 } }), true);
  assert.equal(visibleControl('reconfirmButton', { ...completed, myRegistration: { status: 'RECONFIRM_REQUIRED' },
    event: { ...completed.event, status: 'RECRUITING', reviewStatus: 'PENDING' }, reconfirmation: null }), false);
});
