import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/pages/messages/messages.js', import.meta.url), 'utf8');
const reminder = { id: 'notice-1', event_id: 'event-1', kind: 'EVENT_REMINDER', event_version: 3,
  status: 'IN_APP' };

function mount(responses: { registration?: object; event?: object; registrationRead?: Promise<object>;
  eventRead?: Promise<object>; onClipboard?: (options: Record<string, any>) => void } = {}) {
  let page: Record<string, any> | undefined;
  let token = 'first-token';
  const reads: string[] = [];
  const copied: string[] = [];
  const toasts: string[] = [];
  runInNewContext(source, {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: {
        get(path: string) {
          reads.push(path);
          if (path === '/me/notifications?offset=0')
            return { items: [reminder], total: 1, unreadTotal: 1, nextOffset: null };
          if (path === '/me/registrations?eventId=event-1')
            return responses.registrationRead || responses.registration || { items: [
              { event_id: 'event-1', status: 'CONFIRMED', accepted_version: 3 }
            ] };
          if (path === '/events/event-1') return responses.eventRead || responses.event || {
            id: 'event-1', hostId: 'host', version: 3, status: 'CONFIRMED', reviewStatus: 'APPROVED',
            payload: { city: '深圳', venueName: '当前球馆' }
          };
          throw new Error(`unexpected GET ${path}`);
        }
      } };
      if (path === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: {
      getStorageSync(key: string) { return key === 'sessionToken' ? token : key === 'userId' ? 'member' : ''; },
      setClipboardData(options: Record<string, any>) {
        copied.push(options.data);
        if (responses.onClipboard) responses.onClipboard(options);
        else options.success?.();
      },
      showToast(options: { title: string }) { toasts.push(options.title); },
      showTabBar() {}, hideTabBar() {}
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>) { Object.assign(this.data, patch); };
  const tap = (overrides: Record<string, string> = {}) => ({ currentTarget: { dataset: {
    id: reminder.id, eventId: reminder.event_id, kind: reminder.kind, ...overrides
  } } });
  return { page, reads, copied, toasts, tap, rotateToken(value: string) { token = value; } };
}

test('copying an authentic reminder reloads current confirmation and activity before copying its venue', async () => {
  const { page, reads, copied, tap } = mount();
  await page.onShow();
  await page.copyReminderVenue(tap());
  assert.deepEqual(reads, ['/me/notifications?offset=0',
    '/me/registrations?eventId=event-1', '/events/event-1']);
  assert.deepEqual(copied, ['深圳 · 当前球馆']);
});

test('a spoofed reminder identity cannot trigger activity reads or clipboard writes', async () => {
  const { page, reads, copied, tap } = mount();
  await page.onShow();
  const changes: Array<Record<string, string>> = [
    { id: 'other' }, { kind: 'MATERIAL_CHANGE' }, { eventId: 'other-event' }
  ];
  for (const change of changes)
    await page.copyReminderVenue(tap(change));
  assert.deepEqual(reads, ['/me/notifications?offset=0']);
  assert.deepEqual(copied, []);
});

test('revoked registration, changed event version and empty venue cannot copy an old place', async () => {
  for (const responses of [
    { registration: { items: [{ event_id: 'event-1', status: 'CANCELLED', accepted_version: 3 }] } },
    { event: { id: 'event-1', hostId: 'host', version: 4, status: 'CONFIRMED', reviewStatus: 'APPROVED',
      payload: { city: '深圳', venueName: '变更后球馆' } } },
    { event: { id: 'event-1', hostId: 'host', version: 3, status: 'CONFIRMED', reviewStatus: 'APPROVED',
      payload: { city: '深圳', venueName: '  ' } } }
  ]) {
    const { page, copied, tap } = mount(responses);
    await page.onShow();
    await page.copyReminderVenue(tap());
    assert.deepEqual(copied, []);
  }
});

test('session changes while reading activity or after clipboard completion suppress old writes and feedback', async () => {
  let resolveEvent: ((event: object) => void) | undefined;
  const deferred = new Promise<object>(resolve => { resolveEvent = resolve; });
  const pending = mount({ eventRead: deferred });
  await pending.page.onShow();
  const copying = pending.page.copyReminderVenue(pending.tap());
  await Promise.resolve();
  pending.rotateToken('second-token');
  resolveEvent?.({ id: 'event-1', hostId: 'host', version: 3, status: 'CONFIRMED',
    reviewStatus: 'APPROVED', payload: { city: '深圳', venueName: '旧球馆' } });
  await copying;
  assert.deepEqual(pending.copied, []);
  assert.deepEqual(pending.toasts, []);

  let completeClipboard: (() => void) | undefined;
  const callback = mount({ onClipboard(options) { completeClipboard = options.success; } });
  await callback.page.onShow();
  await callback.page.copyReminderVenue(callback.tap());
  callback.rotateToken('second-token');
  completeClipboard?.();
  assert.deepEqual(callback.toasts, []);
  assert.equal(callback.page.data.message, '');
});
