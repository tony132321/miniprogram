import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('the closed conversation entry precedes live inbox notices only in the All view and keeps its preview route', () => {
  const markup = readFileSync(new URL('../miniprogram/pages/messages/messages.wxml', import.meta.url), 'utf8');
  const conversation = markup.match(/<view wx:if="\{\{([^"}]+)\}\}" class="card conversation-card">/);
  assert.ok(conversation, 'the unavailable conversation card needs an explicit visibility gate');
  const cardStart = conversation.index ?? -1;
  const noticeGroupsStart = markup.indexOf('class="notice-groups"');
  const inboxActionsStart = markup.indexOf('class="inbox-actions"');
  assert.ok(inboxActionsStart < cardStart && cardStart < noticeGroupsStart,
    'recent conversations belongs after inbox controls and before live notice groups');

  const expression = conversation[1];
  assert.ok(expression);
  const visible = (filter: string, loadState: string) =>
    runInNewContext(expression, { filter, loadState });
  assert.equal(visible('ALL', 'READY'), true);
  assert.equal(visible('ACTIVITY', 'READY'), false);
  assert.equal(visible('INTERACTION', 'READY'), false);
  assert.equal(visible('SYSTEM', 'READY'), false);
  assert.equal(visible('ALL', 'LOADING'), false);

  const cardMarkup = markup.slice(cardStart, noticeGroupsStart);
  assert.match(cardMarkup, /最近会话<text>尚未开放<\/text>/);
  assert.match(cardMarkup, /class="conversation-jump" bindtap="openPrivateChatPreview"/);
  assert.match(markup, /viewMode === 'CHAT_UNAVAILABLE'/);
});
