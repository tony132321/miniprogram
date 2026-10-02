import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('PG06 host completion shortcut opens the existing form only when completion is due', () => {
  let page: Record<string, any> | undefined;
  const scrolls: Array<Record<string, any>> = [];
  const posts: Array<Record<string, any>> = [];
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/activity/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if ((path === '../../utils/api.js' || path === '../../../utils/api.js')) return { api: { post: (...args: any[]) => posts.push({ args }) } };
      if ((path === '../../utils/checkin-qr.js' || path === '../utils/checkin-qr.js')) return { drawCheckInQr() {} };
      if ((path === '../../config.js' || path === '../../../config.js')) return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync() { return ''; },
      pageScrollTo(options: Record<string, any>) { scrolls.push(options); }
    },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, any>, callback?: () => void) {
    Object.assign(this.data, patch);
    callback?.();
  };
  page.checkInPageHidden = true;
  const now = Date.now();
  const event = (endAt: number) => ({ id: 'event-1', version: 3, status: 'CONFIRMED',
    payload: { startAt: new Date(now - 2 * 60 * 60_000).toISOString(), endAt: new Date(endAt).toISOString() } });

  page.setData({ id: 'event-1', loadState: 'READY', isHost: true,
    canCompleteEvent: true, event: event(now + 60 * 60_000) });
  page.openHostCompletion();
  assert.equal(page.data.canCompleteEvent, false);
  assert.equal(scrolls.length, 0);

  page.setData({ canCompleteEvent: false, event: event(now - 60 * 60_000) });
  page.openHostCompletion();
  assert.equal(page.data.activeSection, 'hostSection');
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0]?.selector, '#hostCompletionForm');
  assert.equal(posts.length, 0);

  page.setData({ isHost: false, canCompleteEvent: true });
  page.openHostCompletion();
  assert.equal(scrolls.length, 1);

  const markup = readFileSync(new URL('../miniprogram/subpackages/activity/event/event.wxml', import.meta.url), 'utf8');
  assert.match(markup, /wx:if="{{canCompleteEvent}}"[^>]*bindtap="openHostCompletion"/);
  assert.match(markup, /id="hostCompletionForm"[^>]*wx:if="{{canCompleteEvent}}"/);
  assert.match(markup, /bindtap="cancelEvent"[^>]*>[^<]*<text>□<\/text>取消活动/);
});

test('PG06 completion notes keep native textareas compact and editable', () => {
  const markup = readFileSync(new URL('../miniprogram/subpackages/activity/event/event.wxml', import.meta.url), 'utf8');
  for (const id of ['completionAnomalyInput', 'completionVenueIssueInput'])
    assert.match(markup, new RegExp(`<textarea id="${id}"[^>]*class="host-completion-note"[^>]*bindinput="${id}"`));
  const styles = readFileSync(new URL('../miniprogram/subpackages/activity/event/event.wxss', import.meta.url), 'utf8');
  assert.match(styles, /\.event-section \.host-completion-note\s*\{[^}]*height:\s*116rpx;[^}]*min-height:\s*116rpx;/);
});
