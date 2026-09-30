import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const markup = readFileSync(new URL('../miniprogram/pages/event/event.wxml', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../miniprogram/pages/event/event.wxss', import.meta.url), 'utf8');

test('badminton host and confirmed member detail presents the real title only on the cover', () => {
  assert.match(markup, /class="event-page[^\"]*event-live-host[^\"]*event-live-member/);
  assert.match(markup, /class="event-cover-title">{{display\.title}}<\/view>/);
  assert.match(markup, /class="detail-heading" wx:if="{{!\(display\.isBadminton && \(isHost \|\| myRegistration\.status === 'CONFIRMED'\)\)}}"/);
  assert.match(markup, /wx:if="{{display\.isBadminton && isHost}}" class="detail-host-state"/);
  assert.match(markup, /wx:if="{{!isHost && myRegistration && myRegistration\.status === 'CONFIRMED'}}" class="detail-participant-card"/);
  assert.match(markup, /class="detail-host-state"[\s\S]*?data-section="checkinSection" bindtap="jumpToSection"/);
});

test('live detail uses factual schedule venue fee seat cards and a bounded authorized-name preview', () => {
  assert.match(markup, /class="detail-facts"[\s\S]*?class="detail-row detail-time-row"[\s\S]*?{{display\.date}} – {{display\.end}}/);
  assert.match(markup, /class="detail-row venue-row detail-venue-row"[\s\S]*?{{display\.location}}[\s\S]*?bindtap="copyVenue"/);
  assert.match(markup, /class="detail-row detail-fee-row"[\s\S]*?{{display\.fee}}/);
  assert.match(markup, /class="detail-row detail-members-row"[\s\S]*?{{event\.stats\.confirmed}} \/ {{event\.payload\.maxParticipants/);
  assert.match(markup, /class="detail-member-preview"[\s\S]*?wx:for="{{memberCards}}"[\s\S]*?wx:if="{{index < 6}}"/);
  assert.match(markup, /仅展示成员自愿公开的本场昵称/);
  assert.match(markup, /可能包含候补；确认席位数以服务端统计为准/);
  assert.match(styles, /\.event-live-host \.detail-facts\s*\{[^}]*display:\s*grid/);
  assert.match(styles, /\.event-live-detail \.detail-member-preview-list\s*\{[^}]*display:\s*grid/);
  assert.doesNotMatch(markup, /真实头像|已核实地图|永久入场凭证/);
});
