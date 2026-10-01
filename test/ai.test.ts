import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localDraftSuggestion } from '../src/ai.ts';

test('relative Saturday uses the activity city time zone and marks user-derived fields', () => {
  const at = Date.parse('2026-09-23T04:00:00.000Z'); // Wednesday, 12:00 in Shenzhen.
  const result = localDraftSuggestion('本周六晚上8点在深圳打羽毛球，六个人，AA每人五十元', at);
  assert.equal(result.aiStatus, 'UNAVAILABLE');
  assert.equal(result.fields.startAt, '2026-09-26T12:00:00.000Z');
  assert.equal(result.fields.timeZone, 'Asia/Shanghai');
  assert.equal(result.fields.city, '深圳');
  assert.equal(result.fields.maxParticipants, 6);
  assert.equal(result.fields.feeCapFen, 5000);
  assert.equal(result.fieldSources.startAt, 'USER_EXPLICIT');
  assert.equal(result.fieldSources.city, 'USER_EXPLICIT');
  assert.ok(result.unknown.includes('结束时间'));
  assert.ok(result.unknown.includes('公共场馆及预约依据'));
  assert.equal(result.fields.hostParticipates, undefined);
  assert.equal(result.fieldSources.hostParticipates, 'NEEDS_CONFIRMATION');
  assert.ok(result.unknown.includes('主办方是否参加并占位'));
});

test('all supported cities in the one-sentence draft keep an explicit China-local date', () => {
  const at = Date.parse('2026-09-23T04:00:00.000Z');
  for (const city of ['深圳', '广州', '上海', '北京', '杭州', '成都']) {
    const result = localDraftSuggestion(`本周六晚上八点在${city}打羽毛球`, at);
    assert.equal(result.fields.city, city);
    assert.equal(result.fields.timeZone, 'Asia/Shanghai');
    assert.equal(result.fields.startAt, '2026-09-26T12:00:00.000Z');
    assert.equal(result.fieldSources.city, 'USER_EXPLICIT');
    assert.equal(result.fieldSources.startAt, 'USER_EXPLICIT');
    assert.ok(!result.unknown.includes('城市'));
    assert.ok(!result.unknown.includes('具体日期时间'));
    assert.equal(result.fields.venueName, undefined);
  }
});

test('city and district names preserve the city and China-local start time', () => {
  const at = Date.parse('2026-09-23T04:00:00.000Z');
  const places = [
    ['深圳南山区', '深圳'], ['广州市天河区', '广州'], ['上海浦东新区', '上海'],
    ['北京市朝阳区', '北京'], ['杭州市西湖区', '杭州'], ['成都市锦江区', '成都']
  ] as const;
  for (const [place, city] of places) {
    const result = localDraftSuggestion(`本周六晚上八点在${place}打羽毛球`, at);
    assert.equal(result.fields.city, city, place);
    assert.equal(result.fields.timeZone, 'Asia/Shanghai', place);
    assert.equal(result.fields.startAt, '2026-09-26T12:00:00.000Z', place);
    assert.equal(result.fieldSources.city, 'USER_EXPLICIT', place);
    assert.equal(result.fields.venueName, undefined, place);
  }
});

test('unsupported cities and known city names embedded in street names remain unresolved', () => {
  const at = Date.parse('2026-09-23T04:00:00.000Z');
  for (const place of ['南宁', '成都路球馆', '成都北路球馆', '杭州街球馆',
    '杭州东路球馆', '上海路球馆', '上海路社区', '成都北路社区', '上海小区',
    '深圳街球馆', '广州大道球馆', '北京路球馆']) {
    const result = localDraftSuggestion(`本周六晚上八点在${place}打羽毛球`, at);
    assert.equal(result.fields.city, undefined, place);
    assert.equal(result.fields.timeZone, undefined, place);
    assert.equal(result.fields.startAt, undefined, place);
    assert.ok(result.unknown.includes('城市'), place);
    assert.ok(result.unknown.includes('具体日期时间'), place);
  }
});

test('ambiguous time and missing city never become a specific date', () => {
  const result = localDraftSuggestion('周六晚上打羽毛球', Date.parse('2026-09-23T04:00:00.000Z'));
  assert.equal(result.fields.startAt, undefined);
  assert.equal(result.fields.city, undefined);
  assert.ok(result.unknown.includes('具体日期时间'));
});

test('an explicitly stated activity level is preserved without inventing one', () => {
  const stated = localDraftSuggestion('本周六晚上八点在深圳打羽毛球，中等水平', Date.parse('2026-09-23T04:00:00.000Z'));
  assert.equal(stated.fields.skillLevel, '中等水平');
  assert.equal(stated.fieldSources.skillLevel, 'USER_EXPLICIT');
  const unstated = localDraftSuggestion('本周六晚上八点在深圳打羽毛球', Date.parse('2026-09-23T04:00:00.000Z'));
  assert.equal(unstated.fields.skillLevel, undefined);
});

test('short Saturday and AA estimate keep ambiguous city and per-person cost for confirmation', () => {
  const at = Date.parse('2026-09-23T04:00:00.000Z');
  const result = localDraftSuggestion('周六晚八点羽毛球六人AA大概五十', at);
  assert.equal(result.fields.city, undefined);
  assert.equal(result.fields.startAt, undefined);
  assert.equal(result.fields.maxParticipants, 6);
  assert.equal(result.fields.feeMode, 'AA');
  assert.equal(result.fields.feeCapFen, 5000);
  assert.equal(result.fieldSources.feeCapFen, 'NEEDS_CONFIRMATION');
  assert.ok(result.unknown.includes('城市'));
  assert.ok(result.unknown.includes('每人费用上限'));
});

test('a named city anchors a short weekday but a past same-day time stays unconfirmed', () => {
  const wednesday = Date.parse('2026-09-23T04:00:00.000Z');
  const upcoming = localDraftSuggestion('周六晚八点在深圳打羽毛球', wednesday);
  assert.equal(upcoming.fields.startAt, '2026-09-26T12:00:00.000Z');
  const saturdayNight = Date.parse('2026-09-26T13:00:00.000Z');
  const past = localDraftSuggestion('本周六晚八点在深圳打羽毛球', saturdayNight);
  assert.equal(past.fields.startAt, undefined);
  assert.ok(past.unknown.includes('具体日期时间'));
});

test('an explicit two-hour duration completes the draft time range', () => {
  const at = Date.parse('2026-09-23T04:00:00.000Z');
  const result = localDraftSuggestion('本周六晚上八点在深圳打两小时羽毛球，六个人', at);
  assert.equal(result.fields.startAt, '2026-09-26T12:00:00.000Z');
  assert.equal(result.fields.endAt, '2026-09-26T14:00:00.000Z');
  assert.equal(result.fieldSources.endAt, 'USER_EXPLICIT');
  assert.ok(!result.unknown.includes('结束时间'));
});

test('duration alone does not invent a date or an end time', () => {
  const result = localDraftSuggestion('周六晚上八点打两小时羽毛球', Date.parse('2026-09-23T04:00:00.000Z'));
  assert.equal(result.fields.startAt, undefined);
  assert.equal(result.fields.endAt, undefined);
  assert.equal(result.fields.templateDurationMinutes, 120);
  assert.equal(result.fieldSources.templateDurationMinutes, 'USER_EXPLICIT');
  assert.ok(result.unknown.includes('具体日期时间'));
});

test('an explicit three-hour duration remains available while its date needs confirmation', () => {
  const result = localDraftSuggestion('周六晚上八点打三小时羽毛球', Date.parse('2026-09-23T04:00:00.000Z'));
  assert.equal(result.fields.templateDurationMinutes, 180);
  assert.equal(result.fields.endAt, undefined);
  assert.ok(result.unknown.includes('具体日期时间'));
});
