import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runDraftProvider, type DraftProvider } from '../src/ai-provider-boundary.ts';

const at = Date.parse('2026-09-23T04:00:00.000Z');
const input = '本周六晚上8点在深圳打羽毛球，六个人，AA每人五十元';

test('provider suggestions keep explicit facts and leave venue and participation for host confirmation', async () => {
  const provider: DraftProvider = {
    estimateUpperBoundFen: () => 10,
    generate: async () => ({ costFen: 7, fields: { title: '周末羽毛球', city: '广州', startAt: '2030-01-01T00:00:00Z',
      venueName: '同名球馆', venueStatus: 'HOST_CONFIRMED', hostParticipates: true, maxParticipants: 9 } })
  };
  const result = await runDraftProvider(input, at, provider, 20);
  assert.equal(result.aiStatus, 'GENERATED');
  assert.equal(result.fields.title, '周末羽毛球');
  assert.equal(result.fields.city, '深圳');
  assert.equal(result.fields.startAt, '2026-09-26T12:00:00.000Z');
  assert.equal(result.fields.maxParticipants, 6);
  assert.equal(result.fields.venueName, '同名球馆');
  assert.equal(result.fields.venueStatus, undefined);
  assert.equal(result.fields.hostParticipates, undefined);
  assert.equal(result.fieldSources.venueName, 'NEEDS_CONFIRMATION');
  assert.equal(result.aiContentLabel, 'AI_GENERATED_UNVERIFIED');
  assert.equal(result.providerCostStatus, 'KNOWN');
  assert.ok(result.unknown.includes('公共场馆及预约依据'));
});

test('one correction retry respects remaining upper-bound budget', async () => {
  let calls = 0;
  const provider: DraftProvider = {
    estimateUpperBoundFen: () => 10,
    generate: async (_text, options) => {
      calls++;
      assert.equal(options.correction, calls === 2);
      return calls === 1 ? { costFen: 8, fields: 'invalid' } : { costFen: 9, fields: { title: '修正草稿' } };
    }
  };
  const result = await runDraftProvider(input, at, provider, 20);
  assert.equal(result.aiStatus, 'GENERATED');
  assert.equal(result.fields.title, '修正草稿');
  assert.equal(calls, 2);
  assert.equal(result.providerCostFen, 17);
});

test('unknown or insufficient upper-bound cost falls back without calling the provider', async () => {
  let calls = 0;
  const provider: DraftProvider = {
    estimateUpperBoundFen: () => 11,
    generate: async () => { calls++; return { costFen: 1, fields: {} }; }
  };
  const result = await runDraftProvider(input, at, provider, 10);
  assert.equal(result.aiStatus, 'UNAVAILABLE');
  assert.equal(result.fallbackReason, 'BUDGET');
  assert.equal(calls, 0);
  const invalid = await runDraftProvider(input, at, { ...provider, estimateUpperBoundFen: () => Number.NaN }, 20);
  assert.equal(invalid.aiStatus, 'UNAVAILABLE');
  assert.equal(invalid.fallbackReason, 'BUDGET');
  assert.equal(calls, 0);
});

test('an invalid first response does not trigger a correction call without remaining budget', async () => {
  let calls = 0;
  const provider: DraftProvider = {
    estimateUpperBoundFen: () => 10,
    generate: async () => { calls++; return { costFen: 9, fields: 'invalid' }; }
  };
  const result = await runDraftProvider(input, at, provider, 18);
  assert.equal(result.aiStatus, 'UNAVAILABLE');
  assert.equal(result.fallbackReason, 'BUDGET');
  assert.equal(result.providerCostFen, 9);
  assert.equal(result.providerCostStatus, 'KNOWN');
  assert.equal(calls, 1);
});

test('a provider that ignores abort cannot hold the draft service past its deadline', async () => {
  let signal: AbortSignal | undefined;
  const provider: DraftProvider = {
    estimateUpperBoundFen: () => 1,
    generate: async (_text, options) => {
      signal = options.signal;
      return new Promise(() => {});
    }
  };
  const result = await runDraftProvider(input, at, provider, 10, 10);
  assert.equal(result.aiStatus, 'UNAVAILABLE');
  assert.equal(result.fallbackReason, 'TIMEOUT');
  assert.equal(result.providerCostStatus, 'UNKNOWN');
  assert.equal(signal?.aborted, true);
});

test('a timeout after one billed attempt reports a lower bound, not a final cost', async () => {
  let calls = 0;
  const provider: DraftProvider = {
    estimateUpperBoundFen: () => 10,
    generate: async () => ++calls === 1 ? { costFen: 7, fields: {} } : new Promise(() => {})
  };
  const result = await runDraftProvider(input, at, provider, 20, 10);
  assert.equal(result.aiStatus, 'UNAVAILABLE');
  assert.equal(result.fallbackReason, 'TIMEOUT');
  assert.equal(result.providerCostFen, 7);
  assert.equal(result.providerCostStatus, 'LOWER_BOUND');
});
