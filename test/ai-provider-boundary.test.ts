import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runDraftProvider, type DraftProvider } from '../src/ai-provider-boundary.ts';
import { createHash } from 'node:crypto';

const at = Date.parse('2026-09-23T04:00:00.000Z');
const input = '本周六晚上8点在深圳打羽毛球，六个人，AA每人五十元';
const fixtureEvidence = { modelVersion: 'fixture-model-v1', promptHash: 'b'.repeat(64),
  usage: { inputTokens: 12, outputTokens: 8 }, receipt: { status: 'ACCEPTED', reference: 'fixture-call' } };

test('records validated model provenance and a hashed provider receipt without retaining its raw reference', async () => {
  const rawReference = 'provider-secret-13800138000';
  const provider: DraftProvider = { estimateUpperBoundFen: () => 10,
    generate: async () => ({ costFen: 7, fields: { title: '建议标题' }, evidence: {
      modelVersion: 'fixture-model-v1', promptHash: 'a'.repeat(64),
      usage: { inputTokens: 12, outputTokens: 8 },
      receipt: { status: 'ACCEPTED', reference: rawReference }
    } }) };
  const result = await runDraftProvider(input, at, provider, 10);
  assert.equal(result.aiStatus, 'GENERATED');
  assert.deepEqual(result.providerEvidence, [{ attempt: 1, modelVersion: 'fixture-model-v1',
    promptHash: 'a'.repeat(64), usage: { inputTokens: 12, outputTokens: 8 },
    receipt: { status: 'ACCEPTED', referenceHash: createHash('sha256').update(rawReference).digest('hex') }, costFen: 7 }]);
  assert.equal(JSON.stringify(result).includes(rawReference), false);
});

test('rejects missing provenance without treating a provider fee as settled', async () => {
  const result = await runDraftProvider(input, at, { estimateUpperBoundFen: () => 10,
    generate: async () => ({ costFen: 7, fields: { title: '无来源建议' },
      evidence: { ...fixtureEvidence, promptHash: 'not-a-hash' } }) }, 10);
  assert.equal(result.aiStatus, 'UNAVAILABLE');
  assert.equal(result.fallbackReason, 'INVALID_RESPONSE');
  assert.equal(result.providerCostStatus, 'UNKNOWN');
  assert.deepEqual(result.providerEvidence, []);
});

test('a rejected provider receipt cannot produce a generated suggestion', async () => {
  const result = await runDraftProvider(input, at, { estimateUpperBoundFen: () => 10,
    generate: async () => ({ costFen: 7, fields: { title: '未受理建议' },
      evidence: { ...fixtureEvidence, receipt: { status: 'REJECTED', reference: 'rejected-call' } } }) }, 10);
  assert.equal(result.aiStatus, 'UNAVAILABLE');
  assert.equal(result.providerCostStatus, 'LOWER_BOUND');
  assert.equal(result.providerEvidence[0]?.receipt.status, 'REJECTED');
});

test('provider suggestions keep explicit facts and leave venue and participation for host confirmation', async () => {
  const provider: DraftProvider = {
    estimateUpperBoundFen: () => 10,
    generate: async () => ({ evidence: fixtureEvidence, costFen: 7, fields: { title: '周末羽毛球', city: '广州', startAt: '2030-01-01T00:00:00Z',
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

test('provider calls omit a phone number supplied in the host draft text', async () => {
  const sent: string[] = [];
  const provider: DraftProvider = {
    estimateUpperBoundFen: text => { sent.push(text); return 10; },
    generate: async text => { sent.push(text); return { evidence: fixtureEvidence, costFen: 7, fields: { title: '周末羽毛球' } }; }
  };
  const result = await runDraftProvider('周六在深圳打羽毛球，联系 13800138000', at, provider, 20);
  assert.equal(result.aiStatus, 'GENERATED');
  assert.deepEqual(sent, ['周六在深圳打羽毛球，联系 [手机号]', '周六在深圳打羽毛球，联系 [手机号]']);
});

test('provider calls omit phones written with country-code parentheses or dots', async () => {
  const sent: string[] = [];
  const provider: DraftProvider = {
    estimateUpperBoundFen: text => { sent.push(text); return 1; },
    generate: async text => { sent.push(text); return { evidence: fixtureEvidence, costFen: 1, fields: { title: '周末羽毛球' } }; }
  };
  const result = await runDraftProvider('报名找 +86 (138) 0013 8000 或 138.0013.8000', at, provider, 2);
  assert.equal(result.aiStatus, 'GENERATED');
  assert.deepEqual(sent, ['报名找 [手机号] 或 [手机号]', '报名找 [手机号] 或 [手机号]']);
});

test('one correction retry respects remaining upper-bound budget', async () => {
  let calls = 0;
  const provider: DraftProvider = {
    estimateUpperBoundFen: () => 10,
    generate: async (_text, options) => {
      calls++;
      assert.equal(options.correction, calls === 2);
      return calls === 1 ? { evidence: fixtureEvidence, costFen: 8, fields: 'invalid' } : { evidence: fixtureEvidence, costFen: 9, fields: { title: '修正草稿' } };
    }
  };
  const result = await runDraftProvider(input, at, provider, 20);
  assert.equal(result.aiStatus, 'GENERATED');
  assert.equal(result.fields.title, '修正草稿');
  assert.equal(calls, 2);
  assert.equal(result.providerCostFen, 17);
  assert.deepEqual(result.providerEvidence.map(item => [item.attempt, item.costFen]), [[1, 8], [2, 9]]);
});

test('unknown or insufficient upper-bound cost falls back without calling the provider', async () => {
  let calls = 0;
  const provider: DraftProvider = {
    estimateUpperBoundFen: () => 11,
    generate: async () => { calls++; return { evidence: fixtureEvidence, costFen: 1, fields: {} }; }
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
    generate: async () => { calls++; return { evidence: fixtureEvidence, costFen: 9, fields: 'invalid' }; }
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
    generate: async () => ++calls === 1 ? { evidence: fixtureEvidence, costFen: 7, fields: {} } : new Promise(() => {})
  };
  const result = await runDraftProvider(input, at, provider, 20, 10);
  assert.equal(result.aiStatus, 'UNAVAILABLE');
  assert.equal(result.fallbackReason, 'TIMEOUT');
  assert.equal(result.providerCostFen, 7);
  assert.equal(result.providerCostStatus, 'LOWER_BOUND');
});
