import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import type { Queryable } from './db.ts';
import { AppError } from './errors.ts';

type RequestFingerprint = { target: string; hash: string };
const context = new AsyncLocalStorage<RequestFingerprint>();

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function hash(target: string, body: unknown): string {
  return createHash('sha256').update(`${target}\n${canonical(body)}`).digest('hex');
}

export function withRequestFingerprint<T>(method: string, url: string, run: () => T): T {
  const target = `${method} ${url}`;
  return context.run({ target, hash: hash(target, {}) }, run);
}

export function setRequestPayload(body: Record<string, unknown>): void {
  const current = context.getStore();
  if (current) current.hash = hash(current.target, body);
}

export async function claimIdempotency(tx: Queryable, actor: string, route: string, key: string): Promise<boolean> {
  const requestHash = context.getStore()?.hash ?? null;
  const { rows: claimed } = await tx.query('INSERT INTO idempotency(actor_id,route,key,result,request_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING key',
    [actor, route, key, '{}', requestHash]);
  if (claimed.length) return true;
  const { rows } = await tx.query<{ request_hash: string | null }>(
    'SELECT request_hash FROM idempotency WHERE actor_id=$1 AND route=$2 AND key=$3', [actor, route, key]);
  if (requestHash && rows[0]?.request_hash !== requestHash)
    throw new AppError('IDEMPOTENCY_MISMATCH', '此幂等键已用于不同请求，请使用新键重试', 409);
  return false;
}
