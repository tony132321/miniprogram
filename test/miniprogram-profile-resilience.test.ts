import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
const eventId = '123e4567-e89b-12d3-a456-426614174000';

function mount(get: (path: string) => Promise<any>) {
  let page: Record<string, any> | undefined;
  const storage = new Map<string, string>([['sessionToken', 'session-a'], ['userId', 'member-a']]);
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return storage.get(key) || ''; },
      removeStorageSync(key: string) { storage.delete(key); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, storage };
}

function response(path: string) {
  if (path === '/me/notifications?offset=0') return { items: [{ id: 'notice', kind: 'EVENT_REMINDER', event_id: eventId,
    status: 'IN_APP', external_status: 'NOT_REQUESTED' }], total: 1, nextOffset: null };
  if (path === '/me/events') return { items: [{ id: eventId, title: '周末羽毛球', status: 'RECRUITING', isHost: true }] };
  if (path === '/me/consents') return { eventReminder: true, eventReminderNotice: { text: '活动提醒说明', version: 'v1' } };
  if (path === '/me/similar-invites') return { granted: false, notice: { text: '再约候选说明', version: 'v2' } };
  if (path === '/me/removals') return { items: [{ id: 'removal-1', event_id: eventId, reason: '名额调整' }] };
  if (path === '/me/appeals') return { items: [{ id: 'appeal-1', status: 'IN_REVIEW', description: '请复核', outcome: 'UPHOLD' }] };
  if (path === '/me/content') return { items: [{ id: 'content-1', event_id: eventId, kind: 'QUESTION',
    body: '几点见？', appeal_id: 'appeal-2', appeal_status: 'RESOLVED' }] };
  if (path === '/me/reports') return { items: [{ id: 'report-1', event_id: eventId, kind: 'SAFETY',
    status: 'RESOLVED', description: '现场问题' }] };
  if (path === '/privacy/requests') return { items: [{ id: 'privacy-1', kind: 'EXPORT', status: 'OPEN' }] };
  return { items: [] };
}

test('one profile module failure clears only that section and offers retry', async () => {
  let reportsOnline = false;
  const { page } = mount(async path => {
    if (path === '/me/reports' && !reportsOnline) throw Object.assign(new Error('网络中断'), { code: 'NETWORK_ERROR' });
    return response(path);
  });
  page.setData({ reports: [{ id: 'stale-report' }], hasSession: true });
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.loadState, 'PARTIAL');
  assert.equal(page.data.reports.length, 0, 'a failed module must not retain stale private rows');
  assert.equal(page.data.notifications[0].eventLabel, '周末羽毛球');
  assert.equal(page.data.activityPreview[0].title, '周末羽毛球');
  assert.equal(page.data.removals[0].eventLabel, '周末羽毛球');
  assert.equal(page.data.sectionLoadErrors.reports, true);
  assert.match(page.data.message, /部分内容加载失败/);
  assert.match(markup, /id="profileRetryButton"[^>]*bindtap="retryRefresh"/);

  reportsOnline = true;
  assert.equal(await page.retryRefresh(), true);
  assert.equal(page.data.loadState, 'READY');
  assert.equal(page.data.sectionLoadErrors.reports, false);
  assert.equal(page.data.reports[0].statusLabel, '已处理');
});

test('identity or permission denial clears every private section instead of rendering settled successes', async () => {
  for (const code of ['UNAUTHENTICATED', 'FORBIDDEN']) {
    const { page, storage } = mount(async path => {
      if (path === '/me/reports') throw Object.assign(new Error('访问被拒绝'), {
        code, status: code === 'UNAUTHENTICATED' ? 401 : 403
      });
      return response(path);
    });
    page.setData({ hasSession: true, privacy: [{ id: 'old-private-request' }], reports: [{ id: 'old-private-report' }] });
    assert.equal(await page.refresh(), false);
    assert.deepEqual(Array.from(page.data.notifications), []);
    assert.deepEqual(Array.from(page.data.privacy), []);
    assert.deepEqual(Array.from(page.data.reports), []);
    assert.deepEqual(Array.from(page.data.activityItems), []);
    assert.equal(page.data.advancedOpen, false);
    assert.equal(page.data.loadState, code === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'ACCESS_DENIED');
    if (code === 'UNAUTHENTICATED') assert.equal(storage.has('sessionToken'), false);
  }
});

test('a session switch while profile requests are pending cannot publish the former account data', async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const { page, storage } = mount(async path => {
    if (path === '/me/reports') await pending;
    return response(path);
  });
  page.setData({ hasSession: true, reports: [{ id: 'old-private-report' }] });
  const loading = page.refresh();
  storage.set('sessionToken', 'session-b');
  storage.set('userId', 'member-b');
  release();
  assert.equal(await loading, false);
  assert.deepEqual(Array.from(page.data.reports), []);
  assert.deepEqual(Array.from(page.data.notifications), []);
  assert.equal(page.data.loadState, 'UNAUTHENTICATED');
});

test('a late notification page or its access denial cannot leave former account rows visible', async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const { page, storage } = mount(async path => {
    if (path.includes('offset=1')) { await pending; return { items: [{ id: 'former-account-notice' }],
      total: 2, nextOffset: null, snapshot: 'a'.repeat(32) }; }
    if (path === '/me/notifications?offset=0') return { items: [{ id: 'first' }],
      total: 2, nextOffset: 1, snapshot: 'a'.repeat(32) };
    return response(path);
  });
  page.setData({ hasSession: true });
  await page.refresh();
  const loadingMore = page.loadMoreNotifications();
  storage.set('sessionToken', 'session-b');
  storage.set('userId', 'member-b');
  release();
  await loadingMore;
  assert.deepEqual(Array.from(page.data.notifications), []);
  assert.equal(page.data.loadState, 'UNAUTHENTICATED');

  const denied = mount(async path => {
    if (path.includes('offset=1')) throw Object.assign(new Error('请重新登录'), { code: 'UNAUTHENTICATED', status: 401 });
    if (path === '/me/notifications?offset=0') return { items: [{ id: 'first' }],
      total: 2, nextOffset: 1, snapshot: 'a'.repeat(32) };
    return response(path);
  });
  denied.page.setData({ hasSession: true });
  await denied.page.refresh();
  await denied.page.loadMoreNotifications();
  assert.deepEqual(Array.from(denied.page.data.notifications), []);
  assert.equal(denied.page.data.loadState, 'UNAUTHENTICATED');
});

test('advanced profile records use localized labels and keep IDs only for actions', async () => {
  const { page } = mount(async path => response(path));
  assert.equal(await page.refresh(), true);
  assert.equal(page.data.removals[0].eventLabel, '周末羽毛球');
  assert.equal(page.data.appeals[0].statusLabel, '复核中');
  assert.equal(page.data.appeals[0].outcomeLabel, '维持原结论');
  assert.equal(page.data.rejectedContent[0].kindLabel, '活动提问');
  assert.equal(page.data.rejectedContent[0].appealStatusLabel, '复核完成');
  assert.equal(page.data.privacy[0].kindLabel, '导出本人数据');
  assert.equal(page.data.privacy[0].statusLabel, '待处理');
  assert.equal(page.data.reports[0].kindLabel, '安全举报');
  assert.equal(page.data.reports[0].statusLabel, '已处理');
  for (const raw of ['item.event_id', 'item.kind}}', 'item.status}}', 'item.appeal_status}}', 'item.outcome}}'])
    assert.ok(!markup.includes(`>${'{{' + raw}`), `visible raw field ${raw}`);
  assert.match(markup, /data-id="{{item\.id}}" bindtap="appealRemoval"/);
  assert.match(markup, /data-id="{{item\.id}}" bindtap="appealReport"/);
});
