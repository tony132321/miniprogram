import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
const event = { id: 'e1', hostId: 'host', version: 2, status: 'CONFIRMED', recruiting: true,
  payload: { title: '周末羽毛球', visibility: 'INVITE', feeMode: 'FREE',
    startAt: '2027-03-22T11:00:00Z', endAt: '2027-03-22T13:00:00Z' } };

function pageWithReads(read: (route: string) => Promise<unknown>,
  post?: (route: string, body: Record<string, unknown>) => Promise<unknown>) {
  let page: Record<string, any> | undefined;
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: read, post } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../utils/sha256.js') return { sha256(value: string) {
        return createHash('sha256').update(value).digest('hex');
      } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync() { return ''; }, pageScrollTo() {}, nextTick(callback: () => void) { callback(); } },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>, callback?: () => void) {
    Object.assign(this.data, patch);
    callback?.();
  };
  page.setData({ id: 'e1' });
  return page;
}

test('auxiliary read failures leave current activity visible and independent sections retryable', async () => {
  const called: string[] = [];
  const page = pageWithReads(async route => {
    called.push(route);
    if (route === '/events/e1') return event;
    if (route === '/me/registrations?eventId=e1') return { items: [] };
    if (route === '/system/safety') return { status: 'OPEN' };
    if (route === '/events/e1/aliases') return { items: [], notice: { version: 'v1', text: '说明' } };
    if (['/events/e1/registrations', '/events/e1/cohosts', '/events/e1/share-metrics',
      '/events/e1/fact-todos'].includes(route)) throw new Error(`${route} 暂不可用`);
    return { items: [] };
  });
  assert.equal(await page.refresh(), true);
  assert.ok(called.includes('/me/registrations?eventId=e1'));
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.event.id, 'e1');
  assert.equal(page.data.display.title, '周末羽毛球');
  assert.equal(page.data.registrationsLoadState, 'ERROR');
  assert.equal(page.data.cohostGrantsLoadState, 'ERROR');
  assert.equal(page.data.shareMetricsLoadState, 'ERROR');
  assert.equal(page.data.factTodosLoadState, 'ERROR');
  assert.match(markup, /registrationsLoadState === 'ERROR'[^\n]*bindtap="refresh"/);
  assert.match(markup, /cohostGrantsLoadState === 'ERROR'[^\n]*bindtap="refresh"/);
  assert.match(markup, /factTodosLoadState === 'ERROR'[^\n]*bindtap="refresh"/);
});

test('slow registration roster does not delay dispatch of independent host reads', async () => {
  let releaseRoster: ((value: { items: unknown[] }) => void) | undefined;
  const pendingRoster = new Promise<{ items: unknown[] }>(resolve => { releaseRoster = resolve; });
  const called: string[] = [];
  const page = pageWithReads(async route => {
    called.push(route);
    if (route === '/events/e1') return event;
    if (route === '/me/registrations?eventId=e1') return { items: [] };
    if (route === '/events/e1/registrations') return pendingRoster;
    if (route === '/system/safety') return { status: 'OPEN' };
    if (route === '/events/e1/aliases') return { items: [], notice: { version: 'v1', text: '说明' } };
    return { items: [] };
  });
  const refreshing = page.refresh();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(called.includes('/events/e1/cohosts'));
  assert.ok(called.includes('/events/e1/fact-todos'));
  releaseRoster?.({ items: [] });
  assert.equal(await refreshing, true);
});

test('malformed auxiliary member rows cannot blank an otherwise valid activity', async () => {
  const page = pageWithReads(async route => {
    if (route === '/events/e1') return event;
    if (route === '/me/registrations?eventId=e1') return { items: [] };
    if (route === '/system/safety') return { status: 'OPEN' };
    if (route === '/events/e1/aliases') return { items: [null], notice: { version: 'v1', text: '说明' } };
    if (['/events/e1/registrations', '/events/e1/cohosts', '/events/e1/fact-todos',
      '/events/e1/checkins'].includes(route)) return { items: [null] };
    return { items: [] };
  });
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.aliasLoadState, 'ERROR');
  assert.equal(page.data.registrationsLoadState, 'ERROR');
  assert.equal(page.data.cohostGrantsLoadState, 'ERROR');
  assert.equal(page.data.factTodosLoadState, 'ERROR');
  assert.equal(page.data.attendanceLoadState, 'ERROR');
});

test('authorized roster and attendance use consented nickname or anonymous number while actions keep IDs', async () => {
  const alias = createHash('sha256').update('e1:member-b').digest('hex').slice(0, 16);
  const page = pageWithReads(async route => {
    if (route === '/events/e1') return event;
    if (route === '/me/registrations?eventId=e1') return { items: [] };
    if (route === '/system/safety') return { status: 'OPEN' };
    if (route === '/events/e1/aliases') return { items: [{ id: alias, displayName: '阿北', isHost: false }],
      notice: { version: 'v1', text: '说明' } };
    if (route === '/events/e1/registrations') return { items: [
      { id: 'registration-b', user_id: 'member-b', status: 'CONFIRMED' },
      { id: 'registration-c', user_id: 'member-c', status: 'WAITLISTED' }
    ] };
    if (route === '/events/e1/cohosts') return { items: [{ id: 'grant-b', userId: 'member-b',
      capabilities: ['CHECKIN_MANAGE'], status: 'ACTIVE', expiresAt: '2027-03-23T13:00:00Z' }] };
    if (route === '/events/e1/checkins') return { items: [{ id: 'scan-c', userId: 'member-c', evidence: 'SCAN',
      checkedAt: '2027-03-22T11:00:00Z' }] };
    if (route === '/events/e1/manual-checkins') return { items: [{ id: 'manual-b', userId: 'member-b', status: 'PENDING' }] };
    return { items: [] };
  });
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.registrations[0].displayName, '阿北');
  assert.equal(page.data.registrations[0].statusLabel, '已确认');
  assert.equal(page.data.registrations[1].displayName, '参与者 1');
  assert.equal(page.data.cohostGrants[0].displayName, '阿北');
  assert.equal(page.data.checkIns[0].displayName, '参与者 1');
  assert.equal(page.data.manualCheckIns[0].displayName, '阿北');
  assert.equal(page.data.manualCheckIns[0].statusLabel, '待本人确认');
  assert.equal(page.data.registrations[0].user_id, 'member-b', 'server ID is retained for authorized actions');
  for (const rawField of ['user_id', 'userId', 'status', 'evidence'])
    assert.ok(!new RegExp(`<(?:view|text)[^>]*>[^<]*\\{\\{item\\.${rawField}\\}\\}`).test(markup),
      `${rawField} must not be printed in the activity UI`);
});

test('an approved question can be selected for the host answer without copying an ID', () => {
  const page = pageWithReads(async () => ({ items: [] }));
  page.setData({ event, isHost: true, loadState: 'READY', activeSection: 'contentSection',
    content: [{ id: 'question-1', kind: 'QUESTION', status: 'APPROVED', body: '需要自带球拍吗？' }] });
  page.replyToQuestion({ currentTarget: { dataset: { id: 'question-1' } } });
  assert.equal(page.data.answerQuestionId, 'question-1');
  assert.equal(page.data.activeSection, 'hostSection');
  assert.equal(page.data.answerInputFocus, true);
  assert.match(markup, /bindtap="replyToQuestion"/);
  assert.match(markup, /focus="{{answerInputFocus}}"/);
});

test('reply button sends the selected approved question ID and clears the composer after success', async () => {
  const posts: Array<{ route: string; body: Record<string, unknown> }> = [];
  const page = pageWithReads(async () => ({ items: [] }), async (route, body) => {
    posts.push({ route, body }); return { id: 'answer-1' };
  });
  page.refresh = async () => true;
  page.setData({ event, isHost: true, loadState: 'READY',
    content: [{ id: 'question-1', kind: 'QUESTION', status: 'APPROVED', body: '需要自带球拍吗？' }] });
  page.replyToQuestion({ currentTarget: { dataset: { id: 'question-1' } } });
  page.answerInput({ detail: { value: '请自带球拍。' } });
  await page.answerQuestion();
  assert.equal(posts.length, 1);
  const submitted = posts[0];
  assert.ok(submitted);
  assert.equal(submitted.route, '/events/e1/content');
  assert.equal(submitted.body.kind, 'ANSWER');
  assert.equal(submitted.body.parentId, 'question-1');
  assert.equal(submitted.body.body, '请自带球拍。');
  assert.equal(page.data.answerQuestionId, '');
  assert.equal(page.data.answerText, '');
});

test('cancelled-event follow-up list shows an anonymous member and readable delivery state', async () => {
  const page = pageWithReads(async route => {
    if (route === '/events/e1') return { ...event, status: 'CANCELLED' };
    if (route === '/me/registrations?eventId=e1') return { items: [] };
    if (route === '/system/safety') return { status: 'OPEN' };
    if (route === '/events/e1/aliases') return { items: [], notice: { version: 'v1', text: '说明' } };
    if (route === '/events/e1/attention') return { items: [{ notificationId: 'n1', userId: 'member-secret',
      kind: 'EVENT_CANCELLED', externalStatus: 'UNKNOWN_REQUIRES_RECONCILIATION' }] };
    return { items: [] };
  });
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.attentionItems[0].displayName, '参与者 1');
  assert.equal(page.data.attentionItems[0].kindLabel, '活动取消提醒');
  assert.equal(page.data.attentionItems[0].externalStatusLabel, '外部状态待核查');
  assert.ok(!markup.includes('>{{item.userId}} ·'));
});
