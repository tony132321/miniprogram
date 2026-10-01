import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8');

function mount(notifications: Record<string, any>[], activities: Record<string, any>[], navigationFails = false,
  storage: Record<string, string> = { devUser: 'member' }) {
  let page: Record<string, any> | undefined;
  const requests: string[] = [];
  const actions: string[] = [];
  const scrolls: string[] = [];
  const snapshot = 'a'.repeat(32);
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {
        async get(path: string) {
          requests.push(path);
          if (path === '/me/notifications?offset=0') return {
            items: notifications.slice(0, 1), total: notifications.length,
            nextOffset: notifications.length > 1 ? 1 : null, snapshot
          };
          if (path === `/me/notifications?offset=1&snapshot=${snapshot}`) return {
            items: notifications.slice(1), total: notifications.length, nextOffset: null, snapshot
          };
          if (path === '/me/events') return { items: activities };
          if (path === '/me/consents') return { eventReminder: false };
          if (path === '/me/similar-invites') return { granted: false };
          return { items: [] };
        },
        async post(path: string) { actions.push(path); }
      } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return storage[key] || ''; },
      navigateTo({ url, success, fail }: { url: string; success: () => void; fail: (error: Error) => void }) {
        actions.push(url);
        if (navigationFails) fail(new Error('navigation failed'));
        else success();
      },
      pageScrollTo({ selector }: { selector: string }) { scrolls.push(selector); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, requests, actions, scrolls, storage };
}

test('profile notices show Chinese labels and a real member event title without exposing its UUID', async () => {
  const eventId = '123e4567-e89b-12d3-a456-426614174000';
  const { page, actions } = mount([{
    id: 'notice-1', event_id: eventId, kind: 'EVENT_REMINDER', status: 'IN_APP',
    event_version: 4, external_status: 'DISPATCHING', detail: {}
  }], [{ id: eventId, title: '周六羽毛球', status: 'CONFIRMED' }]);

  await page.refresh();
  const notice = page.data.notifications[0];
  assert.equal(notice.kindLabel, '活动即将开始');
  assert.equal(notice.statusLabel, '未读');
  assert.equal(notice.eventLabel, '周六羽毛球');
  assert.equal(notice.externalStatusLabel, '外部提醒请求处理中');
  assert.equal(notice.event_id, eventId, 'the real event ID stays available for navigation');

  await page.openNotice({ currentTarget: { dataset: {
    id: notice.id, event: notice.event_id, kind: notice.kind
  } } });
  assert.deepEqual(actions, [
    `/pages/event/event?id=${eventId}&section=checkinSection`, '/me/notifications/notice-1/open'
  ]);
});

test('profile material-change notice opens the current registration rules before marking read', async () => {
  const eventId = 'changed-event';
  const { page, actions } = mount([{
    id: 'change-notice', event_id: eventId, kind: 'MATERIAL_CHANGE', status: 'IN_APP',
    external_status: 'UNAVAILABLE', detail: {}
  }], [{ id: eventId, title: '规则更新的羽球局', status: 'RECRUITING' }]);
  await page.refresh();
  await page.openNotice({ currentTarget: { dataset: {
    id: 'change-notice', event: eventId, kind: 'MATERIAL_CHANGE'
  } } });
  assert.deepEqual(actions, [
    `/pages/event/event?id=${eventId}&section=registrationSection`,
    '/me/notifications/change-notice/open'
  ]);
});

test('profile outcome-due notice opens the current host completion form before marking read', async () => {
  const eventId = 'finished-event';
  const { page, actions } = mount([{
    id: 'outcome-due', event_id: eventId, kind: 'EVENT_OUTCOME_DUE', status: 'IN_APP',
    external_status: 'NOT_REQUESTED', detail: {}
  }], [{ id: eventId, title: '周六羽毛球', status: 'IN_PROGRESS' }]);
  await page.refresh();
  await page.openNotice({ currentTarget: { dataset: {
    id: 'outcome-due', event: eventId, kind: 'EVENT_OUTCOME_DUE'
  } } });
  assert.deepEqual(actions, [
    `/pages/event/event?id=${eventId}&section=hostSection&entry=hostCompletion`,
    '/me/notifications/outcome-due/open'
  ]);
});

test('profile outcome-due notice requires its event and leaves failed navigation unread', async () => {
  const eventId = 'finished-event';
  const notice = { id: 'outcome-due', event_id: eventId, kind: 'EVENT_OUTCOME_DUE',
    status: 'IN_APP', external_status: 'NOT_REQUESTED', detail: {} };
  const missingEvent = mount([{ ...notice, event_id: null }], []);
  await missingEvent.page.refresh();
  await missingEvent.page.openNotice({ currentTarget: { dataset: {
    id: notice.id, event: '', kind: notice.kind
  } } });
  assert.deepEqual(missingEvent.actions, []);

  const failedNavigation = mount([notice], [], true);
  await failedNavigation.page.refresh();
  await failedNavigation.page.openNotice({ currentTarget: { dataset: {
    id: notice.id, event: eventId, kind: notice.kind
  } } });
  assert.deepEqual(failedNavigation.actions, [
    `/pages/event/event?id=${eventId}&section=hostSection&entry=hostCompletion`
  ]);
});

test('profile outcome-review notice opens the eligible member feedback section before marking read', async () => {
  const eventId = 'completed-event';
  const { page, actions } = mount([{
    id: 'review-notice', event_id: eventId, kind: 'EVENT_OUTCOME_REVIEW', status: 'IN_APP',
    external_status: 'NOT_REQUESTED', detail: {}
  }], [{ id: eventId, title: '周日桌游', status: 'COMPLETED' }]);
  await page.refresh();
  await page.openNotice({ currentTarget: { dataset: {
    id: 'review-notice', event: eventId, kind: 'EVENT_OUTCOME_REVIEW'
  } } });
  assert.deepEqual(actions, [
    `/pages/event/event?id=${eventId}&section=checkinSection&entry=memberFeedback`,
    '/me/notifications/review-notice/open'
  ]);
});

test('profile rejects forged or stale notice rows and accepts only a loaded page for the same identity', async () => {
  const notices = [
    { id: 'notice/one', event_id: 'event-A', kind: 'EVENT_OUTCOME_DUE', status: 'IN_APP', detail: {} },
    { id: 'notice-two', event_id: 'event-B', kind: 'EVENT_OUTCOME_REVIEW', status: 'IN_APP', detail: {} }
  ];
  const { page, actions, storage } = mount(notices, []);
  await page.refresh();
  page.setData({ loadState: 'LOADING' });
  await page.openNotice({ currentTarget: { dataset: {
    id: 'notice/one', event: 'event-A', kind: 'EVENT_OUTCOME_DUE'
  } } });
  page.setData({ loadState: 'READY' });
  for (const dataset of [
    { id: 'notice/one', event: 'event-B', kind: 'EVENT_OUTCOME_DUE' },
    { id: 'notice/one', event: 'event-A', kind: 'EVENT_OUTCOME_REVIEW' },
    { id: 'forged', event: 'event-A', kind: 'EVENT_OUTCOME_DUE' },
    { id: 'notice-two', event: 'event-B', kind: 'EVENT_OUTCOME_REVIEW' }
  ]) await page.openNotice({ currentTarget: { dataset } });
  assert.deepEqual(actions, [], 'forged and not-yet-loaded rows do not navigate or mark read');

  await page.loadMoreNotifications();
  await page.openNotice({ currentTarget: { dataset: {
    id: 'notice-two', event: 'event-B', kind: 'EVENT_OUTCOME_REVIEW'
  } } });
  assert.deepEqual(actions, [
    '/pages/event/event?id=event-B&section=checkinSection&entry=memberFeedback',
    '/me/notifications/notice-two/open'
  ]);

  storage.devUser = 'other-member';
  await page.openNotice({ currentTarget: { dataset: {
    id: 'notice/one', event: 'event-A', kind: 'EVENT_OUTCOME_DUE'
  } } });
  assert.equal(page.data.notifications.length, 0, 'identity switch clears the loaded private rows');
  assert.equal(actions.length, 2);

  storage.devUser = 'member';
  await page.refresh();
  await page.openNotice({ currentTarget: { dataset: {
    id: 'notice/one', event: 'event-A', kind: 'EVENT_OUTCOME_DUE'
  } } });
  assert.deepEqual(actions.slice(2), [
    '/pages/event/event?id=event-A&section=hostSection&entry=hostCompletion',
    '/me/notifications/notice%2Fone/open'
  ]);
});

test('profile notice remains unread when its action destination cannot open', async () => {
  const eventId = 'changed-event';
  const { page, actions } = mount([{
    id: 'change-notice', event_id: eventId, kind: 'MATERIAL_CHANGE', status: 'IN_APP',
    external_status: 'UNAVAILABLE', detail: {}
  }], [], true);
  await page.refresh();
  await page.openNotice({ currentTarget: { dataset: {
    id: 'change-notice', event: eventId, kind: 'MATERIAL_CHANGE'
  } } });
  assert.deepEqual(actions, [`/pages/event/event?id=${eventId}&section=registrationSection`]);
});

test('later profile notices use a neutral event context when no member event title is available', async () => {
  const eventId = '123e4567-e89b-12d3-a456-426614174001';
  const { page, requests } = mount([
    { id: 'known', event_id: null, kind: 'REPORT_RESOLVED_UNSCOPED', status: 'OPENED',
      external_status: 'NOT_REQUESTED', detail: {} },
    { id: 'unknown', event_id: eventId, kind: 'NEW_SERVER_KIND', status: 'IN_APP',
      external_status: 'NOT_REQUESTED', detail: {} }
  ], []);

  await page.refresh();
  await page.loadMoreNotifications();
  assert.equal(page.data.notifications[0].kindLabel, '举报已有处理结论');
  assert.equal(page.data.notifications[0].statusLabel, '已读');
  assert.equal(page.data.notifications[0].eventLabel, '');
  assert.equal(page.data.notifications[1].kindLabel, '站内通知');
  assert.equal(page.data.notifications[1].statusLabel, '未读');
  assert.equal(page.data.notifications[1].eventLabel, '相关活动');
  assert.ok(!page.data.notifications[1].eventLabel.includes(eventId));
  assert.deepEqual(requests.filter(path => path.startsWith('/me/notifications')), [
    '/me/notifications?offset=0', `/me/notifications?offset=1&snapshot=${'a'.repeat(32)}`
  ]);
});

test('profile notice markup renders presentation labels while retaining the real notification action', () => {
  const markup = readFileSync(new URL('../miniprogram/pages/me/me.wxml', import.meta.url), 'utf8');
  const section = markup.slice(markup.indexOf('id="noticeSection"'), markup.indexOf('id="appealSection"'));
  assert.match(section, /{{item\.kindLabel}}/);
  assert.match(section, /{{item\.statusLabel}}/);
  assert.match(section, /{{item\.eventLabel}}/);
  assert.doesNotMatch(section, />[^<]*{{item\.(?:kind|status|event_id|event_version)}}/);
  assert.match(section, /data-id="{{item\.id}}" data-event="{{item\.event_id}}" data-kind="{{item\.kind}}" bindtap="openNotice"/);
});

test('profile processing notices open their matching record section after marking read', async () => {
  const cases = [
    ['REPORT_CREATED_UNSCOPED', null, '#reportSection'],
    ['REPORT_IN_REVIEW_UNSCOPED', null, '#reportSection'],
    ['REPORT_RESOLVED_UNSCOPED', null, '#reportSection'],
    ['APPEAL_CREATED', null, '#appealSection'],
    ['CONTENT_REVIEW_OVERTURN', 'event-1', '#contentSection']
  ] as const;
  for (const [kind, eventId, destination] of cases) {
    const { page, actions, scrolls } = mount([{
      id: 'notice-1', event_id: eventId, kind, status: 'IN_APP',
      external_status: 'NOT_REQUESTED', detail: {}
    }], []);
    await page.refresh();
    await page.openNotice({ currentTarget: { dataset: {
      id: 'notice-1', event: eventId, kind
    } } });
    assert.deepEqual(actions, ['/me/notifications/notice-1/open'], kind);
    assert.equal(scrolls.at(-1), destination, kind);
    assert.equal(page.data.advancedOpen, true, kind);
  }
});
