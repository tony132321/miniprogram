import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function loadPage() {
  let page: Record<string, any> | undefined;
  let actor = 'host';
  const scrolls: Array<Record<string, unknown>> = [];
  const posts: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/activity/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if ((path === '../../utils/api.js' || path === '../../../utils/api.js')) return { api: { async post(url: string) { posts.push(url); } } };
      if ((path === '../../utils/checkin-qr.js' || path === '../../../utils/checkin-qr.js')) return { drawCheckInQr() {} };
      if ((path === '../../config.js' || path === '../../../config.js')) return { developmentUser: '' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? actor : ''; },
      pageScrollTo(options: Record<string, unknown>) { scrolls.push(options); } },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  const loadedPage = page;
  loadedPage.setData = function (patch: Record<string, unknown>, callback?: () => void) {
    Object.assign(this.data, patch); callback?.();
  };
  const event = { id: 'event-1', hostId: 'host', version: 4, status: 'RECRUITING',
    reviewStatus: 'APPROVED', recruiting: true };
  loadedPage.setData({ id: 'event-1', currentUser: 'host', loadState: 'READY', isHost: true,
    canManageAnnouncements: true, event, activeSection: 'hostSection' });
  let latest: Record<string, any> = { event, loadState: 'READY', currentUser: 'host',
    isHost: true, canManageAnnouncements: true };
  let reads = 0;
  loadedPage.refresh = async function (this: Record<string, any>) {
    reads++;
    this.refreshId = (this.refreshId || 0) + 1;
    this.setData(latest);
    return true;
  };
  return { page: loadedPage, scrolls, posts, get reads() { return reads; },
    setLatest(patch: Record<string, any>) { latest = { ...latest, ...patch }; },
    setActor(value: string) { actor = value; },
    holdRefresh() {
      let release: (() => void) | undefined;
      const gate = new Promise<void>(resolve => { release = resolve; });
      loadedPage.refresh = async function (this: Record<string, any>) {
        reads++;
        await gate;
        this.refreshId = (this.refreshId || 0) + 1;
        this.setData(latest);
        return true;
      };
      return () => release?.();
    }
  };
}

test('PG06 send announcement shortcut reads live host eligibility and focuses the existing composer', async () => {
  const h = loadPage();
  await h.page.openHostAnnouncement();
  assert.equal(h.reads, 1);
  assert.equal(h.page.data.activeSection, 'hostSection');
  assert.equal(h.scrolls.at(-1)?.selector, '#hostAnnouncementAnchor');
  assert.deepEqual(h.posts, [], 'opening a composer must not submit an announcement');
  const markup = readFileSync(new URL('../miniprogram/subpackages/activity/event/event.wxml', import.meta.url), 'utf8');
  assert.match(markup, /id="hostAnnouncementShortcut"[^>]+bindtap="openHostAnnouncement"/);
  assert.match(markup, /id="hostAnnouncementAnchor"[\s\S]*?id="hostAnnouncementForm"/);
});

test('PG06 shortcut cannot focus a write form after host revocation, review loss or event close', async () => {
  for (const change of [
    { isHost: false },
    { canManageAnnouncements: false },
    { event: { id: 'event-1', hostId: 'another-host', status: 'RECRUITING', reviewStatus: 'APPROVED' } },
    { event: { id: 'event-1', hostId: 'host', status: 'RECRUITING', reviewStatus: 'PENDING' } },
    { event: { id: 'event-1', hostId: 'host', status: 'COMPLETED', reviewStatus: 'APPROVED' } },
    { event: { id: 'event-2', hostId: 'host', status: 'RECRUITING', reviewStatus: 'APPROVED' } }
  ]) {
    const h = loadPage();
    h.setLatest(change);
    await h.page.openHostAnnouncement();
    assert.equal(h.reads, 1);
    assert.ok(!h.scrolls.some(scroll => scroll.selector === '#hostAnnouncementAnchor'));
    assert.deepEqual(h.posts, []);
  }
});

test('PG06 shortcut remains usable after recruitment when an approved event is confirmed or in progress', async () => {
  for (const status of ['CONFIRMED', 'IN_PROGRESS']) {
    const h = loadPage();
    h.setLatest({ event: { id: 'event-1', hostId: 'host', version: 5,
      status, reviewStatus: 'APPROVED', recruiting: false } });
    await h.page.openHostAnnouncement();
    assert.equal(h.scrolls.at(-1)?.selector, '#hostAnnouncementAnchor');
  }
});

test('PG06 old callback cannot open the composer after account change or page hide', async () => {
  const switched = loadPage();
  const finishSwitch = switched.holdRefresh();
  const oldAction = switched.page.openHostAnnouncement();
  switched.setActor('another-user');
  finishSwitch();
  await oldAction;
  assert.deepEqual(switched.scrolls, []);

  const hidden = loadPage();
  const finishHidden = hidden.holdRefresh();
  const pending = hidden.page.openHostAnnouncement();
  hidden.page.onHide();
  finishHidden();
  await pending;
  assert.deepEqual(hidden.scrolls, []);
});
