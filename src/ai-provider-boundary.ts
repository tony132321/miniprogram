import type { EventInput } from './events.ts';
import { localDraftSuggestion } from './ai.ts';
import { redactAiContactText } from './ai-data-minimization.ts';
import { createHash } from 'node:crypto';

export interface DraftProvider {
  // A conservative per-attempt upper bound in fen. An unknown bound disables the call.
  estimateUpperBoundFen(text: string, correction: boolean): number;
  generate(text: string, options: { signal: AbortSignal; correction: boolean; at: number }): Promise<unknown>;
}

type RuleSuggestion = ReturnType<typeof localDraftSuggestion>;
export type ProviderEvidence = { attempt: number; modelVersion: string; promptHash: string;
  usage: { inputTokens: number; outputTokens: number };
  receipt: { status: 'ACCEPTED' | 'REJECTED' | 'UNKNOWN'; referenceHash: string }; costFen: number };
type ProviderResult = { aiStatus: 'GENERATED'; source: 'MODEL'; fields: EventInput;
  fieldSources: Record<string, 'USER_EXPLICIT' | 'TEMPLATE_DEFAULT' | 'NEEDS_CONFIRMATION'>;
  unknown: string[]; aiContentLabel: 'AI_GENERATED_UNVERIFIED'; providerCostFen: number;
  providerCostStatus: 'KNOWN'; providerEvidence: ProviderEvidence[] };
type FallbackResult = RuleSuggestion & { fallbackReason: 'BUDGET' | 'TIMEOUT' | 'PROVIDER_ERROR' | 'INVALID_RESPONSE' | 'COST_BOUND_VIOLATION';
  providerCostFen: number; providerCostStatus: 'KNOWN' | 'LOWER_BOUND' | 'UNKNOWN'; providerEvidence: ProviderEvidence[] };

class ProviderDeadline extends Error {}

export function validatedEvidence(value: unknown, attempt: number, costFen: number): ProviderEvidence | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const usage = source.usage as Record<string, unknown> | undefined;
  const receipt = source.receipt as Record<string, unknown> | undefined;
  if (typeof source.modelVersion !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/.test(source.modelVersion) ||
    typeof source.promptHash !== 'string' || !/^[a-f0-9]{64}$/i.test(source.promptHash) ||
    !usage || typeof usage !== 'object' || Array.isArray(usage) ||
    !Number.isSafeInteger(usage.inputTokens) || Number(usage.inputTokens) < 0 ||
    !Number.isSafeInteger(usage.outputTokens) || Number(usage.outputTokens) < 0 ||
    !receipt || typeof receipt !== 'object' || Array.isArray(receipt) ||
    !['ACCEPTED', 'REJECTED', 'UNKNOWN'].includes(String(receipt.status)) ||
    typeof receipt.reference !== 'string' || !receipt.reference.trim() || receipt.reference.length > 2000) return null;
  return { attempt, modelVersion: source.modelVersion, promptHash: source.promptHash.toLowerCase(),
    usage: { inputTokens: Number(usage.inputTokens), outputTokens: Number(usage.outputTokens) },
    receipt: { status: receipt.status as ProviderEvidence['receipt']['status'],
      referenceHash: createHash('sha256').update(receipt.reference).digest('hex') }, costFen };
}

function candidateFields(value: unknown): EventInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const fields: EventInput = {};
  const putString = (key: 'title' | 'city' | 'venueName' | 'skillLevel', maximum: number) => {
    const item = source[key];
    if (typeof item === 'string' && item.trim() && item.length <= maximum) fields[key] = item.trim();
  };
  putString('title', 80);
  putString('city', 40);
  putString('venueName', 120);
  putString('skillLevel', 40);
  if (source.type === 'badminton') fields.type = 'badminton';
  if (source.timeZone === 'Asia/Shanghai') fields.timeZone = 'Asia/Shanghai';
  if (source.feeMode === 'AA' || source.feeMode === 'FREE') fields.feeMode = source.feeMode;
  for (const key of ['startAt', 'endAt'] as const) {
    const item = source[key];
    if (typeof item === 'string' && !Number.isNaN(Date.parse(item))) fields[key] = new Date(item).toISOString();
  }
  for (const key of ['minParticipants', 'maxParticipants', 'feeCapFen'] as const) {
    const item = source[key];
    if (Number.isSafeInteger(item) && Number(item) >= (key === 'feeCapFen' ? 0 : 1)) fields[key] = Number(item);
  }
  return Object.keys(fields).length ? fields : null;
}

export async function runDraftProvider(text: string, at: number, provider: DraftProvider, budgetFen: number,
  deadlineMs = 30_000): Promise<ProviderResult | FallbackResult> {
  const rule = localDraftSuggestion(text, at);
  const providerText = redactAiContactText(text);
  if (!Number.isSafeInteger(budgetFen) || budgetFen < 0) throw new Error('AI draft budget must be a nonnegative integer fen');
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 30_000) throw new Error('AI draft deadline must be 1..30000 ms');
  let spent = 0;
  const providerEvidence: ProviderEvidence[] = [];
  const fallback = (reason: FallbackResult['fallbackReason'], uncertain = false): FallbackResult =>
    ({ ...rule, fallbackReason: reason, providerCostFen: spent,
      providerCostStatus: uncertain ? (spent > 0 ? 'LOWER_BOUND' : 'UNKNOWN') : 'KNOWN', providerEvidence });
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new ProviderDeadline('AI draft deadline reached')); }, deadlineMs);
  });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      let bound: number;
      try { bound = provider.estimateUpperBoundFen(providerText, attempt === 1); }
      catch { return fallback('BUDGET'); }
      if (!Number.isSafeInteger(bound) || bound < 0 || spent + bound > budgetFen) return fallback('BUDGET');
      let output: unknown;
      try { output = await Promise.race([provider.generate(providerText, { signal: controller.signal, correction: attempt === 1, at }), deadline]); }
      catch (error) { return fallback(error instanceof ProviderDeadline ? 'TIMEOUT' : 'PROVIDER_ERROR', true); }
      if (!output || typeof output !== 'object' || Array.isArray(output)) return fallback('INVALID_RESPONSE', true);
      const result = output as { costFen?: unknown; fields?: unknown; evidence?: unknown };
      if (!Number.isSafeInteger(result.costFen) || Number(result.costFen) < 0) return fallback('INVALID_RESPONSE', true);
      if (Number(result.costFen) > bound || spent + Number(result.costFen) > budgetFen)
        return fallback('COST_BOUND_VIOLATION', true);
      const evidence = validatedEvidence(result.evidence, attempt + 1, Number(result.costFen));
      if (!evidence) return fallback('INVALID_RESPONSE', true);
      providerEvidence.push(evidence);
      spent += Number(result.costFen);
      if (evidence.receipt.status !== 'ACCEPTED') return fallback('PROVIDER_ERROR', true);
      const extracted = candidateFields(result.fields);
      if (!extracted) {
        if (attempt === 0) continue;
        return fallback('INVALID_RESPONSE');
      }
      const fields = { ...extracted, ...rule.fields };
      const fieldSources = { ...rule.fieldSources };
      for (const key of Object.keys(extracted)) if (!rule.fieldSources[key]) fieldSources[key] = 'NEEDS_CONFIRMATION';
      return { aiStatus: 'GENERATED', source: 'MODEL', fields, fieldSources, unknown: rule.unknown,
        aiContentLabel: 'AI_GENERATED_UNVERIFIED', providerCostFen: spent, providerCostStatus: 'KNOWN', providerEvidence };
    }
    return fallback('INVALID_RESPONSE');
  } finally { clearTimeout(timer); }
}
