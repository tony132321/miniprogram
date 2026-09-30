import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/pages/me/me.js', import.meta.url), 'utf8');

function mount(notifications: Record<string, any>[], activities: Record<string, any>[]) {
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
      navigateTo({ url, success }: { url: string; success: () => void }) {
        actions.push(url); success();
      },
      pageScrollTo({ selector }: { selector: string }) { scrolls.push(selector); }
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  return { page, requests, actions, scrolls };
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
    `/pages/event/event?id=${eventId}`, '/me/notifications/notice-1/open'
  ]);
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
