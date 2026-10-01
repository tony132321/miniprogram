import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const event = { id: 'event-one', hostId: 'host', version: 3, status: 'RECRUITING',
  recruiting: true, payload: { title: '周末羽毛球', visibility: 'INVITE', feeMode: 'FREE',
    startAt: '2027-03-22T11:00:00Z', endAt: '2027-03-22T13:00:00Z' } };

function mount() {
  let page: Record<string, any> | undefined;
  let token = 'first-token';
  let modal: Record<string, any> | undefined;
  const posts: Array<{ token: string; path: string; body: Record<string, unknown> }> = [];
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(module: string) {
      if (module === '../../utils/api.js') return { api: {
        async get(path: string) {
          if (path === '/me/registrations?eventId=event-one') return { items: [] };
          if (path === '/events/event-one') return event;
          if (path === '/system/safety') return { status: 'OPEN' };
          if (path === '/events/event-one/aliases') return { items: [], notice: { version: 'v1', text: '说明' } };
          return { items: [] };
        },
        async post(path: string, body: Record<string, unknown>) {
          posts.push({ token, path, body });
          return { id: 'result' };
        }
      } };
      if (module === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (module === '../../config.js') return { developmentUser: '' };
      throw new Error(`unexpected require ${module}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'sessionToken' ? token : key === 'userId' ? 'host' : ''; },
      showModal(options: Record<string, any>) { modal = options; },
      pageScrollTo() {}
    },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  page.setData({ id: 'event-one' });
  return { page, posts, setToken(value: string) { token = value; },
    modal() { assert.ok(modal); return modal; } };
}

test('old activity controls never write under a new session before onShow refreshes them', async () => {
  const { page, posts, setToken } = mount();
  assert.equal(await page.refresh(), true);
  setToken('second-token');

  await page.action('/events/event-one/confirm', {}, '已确认');
  assert.equal(posts.length, 0);
});

test('a READY activity without a recorded owner cannot write', async () => {
  const { page, posts } = mount();
  assert.equal(await page.refresh(), true);
  page.setData({ currentUser: '' });

  await page.action('/events/event-one/confirm', {}, '已确认');
  assert.equal(posts.length, 0);
});

test('the shared action helper refuses an unrecognized mutation route', async () => {
  const { page, posts } = mount();
  assert.equal(await page.refresh(), true);

  await page.action('/unknown/old-row', {}, '已确认');
  assert.equal(posts.length, 0);
});

test('cancel modal cannot apply the old decision to a newly displayed event', async () => {
  const { page, posts, modal } = mount();
  assert.equal(await page.refresh(), true);
  page.cancelEvent();
  page.setData({ id: 'event-two', event: { ...event, id: 'event-two', version: 3 } });

  modal().success({ confirm: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(posts.length, 0);
});

test('a modal decision is discarded when the activity version changes', async () => {
  const { page, posts, modal } = mount();
  assert.equal(await page.refresh(), true);
  page.cancelEvent();
  page.setData({ event: { ...event, version: 4 } });

  modal().success({ confirm: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(posts.length, 0);
});

test('a modal decision is discarded when the session changes', async () => {
  const { page, posts, modal, setToken } = mount();
  assert.equal(await page.refresh(), true);
  page.cancelEvent();
  setToken('second-token');

  modal().success({ confirm: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(posts.length, 0);
});

test('cohost revoke confirmation never writes with the next session token', async () => {
  const { page, posts, modal, setToken } = mount();
  assert.equal(await page.refresh(), true);
  const pending = page.revokeCohost({ currentTarget: { dataset: { id: 'grant-one' } } });
  setToken('second-token');

  modal().success({ confirm: true });
  await pending;
  assert.equal(posts.length, 0);
});

test('direct activity writers cannot submit old details under a new session', async () => {
  for (const write of [
    (page: Record<string, any>) => page.grantCohost(),
    (page: Record<string, any>) => page.saveAlias(),
    (page: Record<string, any>) => page.revokeAlias(),
    (page: Record<string, any>) => page.blockMember({ currentTarget: { dataset: { member: 'member-one' } } }),
    (page: Record<string, any>) => page.askFact(),
    (page: Record<string, any>) => page.postAnnouncement()
  ]) {
    const { page, posts, setToken } = mount();
    assert.equal(await page.refresh(), true);
    page.setData({ cohostUserId: 'member-one', selectedCohostCapabilities: ['CHECKIN_MANAGE'],
      aliasInput: '小林', factQuestionText: '集合时间？', announcementText: '场地已确认' });
    setToken('second-token');
    await write(page);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(posts.length, 0, `${write.toString()} must not submit with the new session`);
  }
});

test('old registration and attendance row actions cannot target a different loaded activity', async () => {
  const { page, posts } = mount();
  assert.equal(await page.refresh(), true);
  page.setData({ id: 'event-two', event: { ...event, id: 'event-two' },
    registrations: [{ id: 'registration-two', event_id: 'event-two' }],
    manualCheckIns: [{ id: 'manual-two', eventId: 'event-two' }],
    expenses: [{ id: 'ledger-two', shares: [{ userId: 'member-two' }] }] });

  await page.action('/registrations/registration-one/approve', {}, '已审核');
  await page.action('/manual-checkins/manual-one/respond', { accepted: true }, '已确认');
  await page.action('/expenses/ledger-one/shares/member-one', { field: 'HOST_RECEIVED', value: true }, '已记录');
  assert.equal(posts.length, 0);
});

test('row IDs alone do not authorize registration or expense writes for another activity', async () => {
  const { page, posts } = mount();
  assert.equal(await page.refresh(), true);
  page.setData({
    registrations: [{ id: 'registration-one', eventId: 'event-two' }],
    expenses: [{ id: 'ledger-one', eventId: 'event-two', shares: [{ userId: 'member-one' }] }]
  });

  await page.action('/registrations/registration-one/approve', {}, '已审核');
  await page.action('/expenses/ledger-one/shares/member-one', { field: 'HOST_RECEIVED', value: true }, '已记录');
  assert.equal(posts.length, 0);
});

test('the loaded activity can still approve its own registration row', async () => {
  const { page, posts } = mount();
  assert.equal(await page.refresh(), true);
  page.setData({ registrations: [{ id: 'registration-one', event_id: 'event-one', status: 'REQUESTED' }] });

  await page.action('/registrations/registration-one/approve', {}, '已审核');
  assert.equal(posts.length, 1);
  assert.equal(posts[0]?.path, '/registrations/registration-one/approve');
  assert.equal(posts[0]?.body.expectedVersion, 3);
});

test('the loaded activity can still update its own expense row', async () => {
  const { page, posts } = mount();
  assert.equal(await page.refresh(), true);
  page.setData({ expenses: [{ id: 'ledger-one', eventId: 'event-one', shares: [{ userId: 'member-one' }] }] });

  await page.action('/expenses/ledger-one/shares/member-one', { field: 'HOST_RECEIVED', value: true }, '已记录');
  assert.equal(posts.length, 1);
  assert.equal(posts[0]?.path, '/expenses/ledger-one/shares/member-one');
});

test('current activity action writes once with the displayed version', async () => {
  const { page, posts } = mount();
  assert.equal(await page.refresh(), true);
  await page.action('/events/event-one/confirm', {}, '已确认');

  assert.equal(posts.length, 1);
  assert.equal(posts[0]?.token, 'first-token');
  assert.equal(posts[0]?.path, '/events/event-one/confirm');
  assert.equal(posts[0]?.body.expectedVersion, 3);
});
