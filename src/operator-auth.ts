import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Database } from './db.ts';
import { AppError } from './errors.ts';

export const OPERATOR_PERMISSIONS = ['REPORTS', 'SAFETY', 'EVENT_REVIEWS', 'APPEALS', 'PRIVACY', 'CONTENT', 'RATE_LIMITS', 'NOTIFICATIONS', 'METRICS', 'SUPPORT_MINUTES', 'JOBS'] as const;
export type OperatorPermission = typeof OPERATOR_PERMISSIONS[number];
export interface OperatorConfig { username: string; passwordHash: string; totpSecret: string; permissions?: string[] }

function decodeBase32(value: string): Buffer {
  if (!/^[A-Z2-7]{32,}$/.test(value)) throw new Error('OPS_TOTP_SECRET must be unpadded base32 with at least 20 bytes');
  if (![0, 2, 4, 5, 7].includes(value.length % 8)) throw new Error('OPS_TOTP_SECRET must use canonical base32 encoding');
  let bits = 0; let buffer = 0; const bytes: number[] = [];
  for (const char of value) {
    buffer = (buffer << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);
    bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >>> bits) & 255); }
  }
  if (bits && (buffer & ((1 << bits) - 1)) !== 0) throw new Error('OPS_TOTP_SECRET must use canonical base32 encoding');
  if (bytes.length < 20) throw new Error('OPS_TOTP_SECRET must contain at least 20 bytes');
  return Buffer.from(bytes);
}

export function hashOperatorPassword(password: string, salt = randomBytes(32).toString('hex')): string {
  if (password.length < 16 || !/^[a-f0-9]{64}$/.test(salt)) throw new Error('operator password must be at least 16 characters and salt must be 32 bytes');
  return `scrypt$${salt}$${scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex')}`;
}

export function createOperatorEnrollment(username: string, password: string): OperatorConfig {
  const raw = randomBytes(20);
  let bits = 0; let buffer = 0; let totpSecret = '';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  for (const byte of raw) {
    buffer = (buffer << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; totpSecret += alphabet[(buffer >>> bits) & 31]; }
  }
  const config = { username, passwordHash: hashOperatorPassword(password), totpSecret };
  validateOperatorConfig(config);
  return config;
}

export function validateOperatorConfig(config: OperatorConfig): void {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(config.username)) throw new Error('OPS_USERNAME is invalid');
  if (!/^scrypt\$[a-f0-9]{64}\$[a-f0-9]{128}$/.test(config.passwordHash)) throw new Error('OPS_PASSWORD_HASH is invalid');
  decodeBase32(config.totpSecret);
  if (config.permissions !== undefined && (!Array.isArray(config.permissions) || !config.permissions.length ||
    config.permissions.some(permission => !OPERATOR_PERMISSIONS.includes(permission as OperatorPermission)) ||
    new Set(config.permissions).size !== config.permissions.length)) throw new Error('operator permissions must be a nonempty unique list of known values');
}

export function validateOperatorAccounts(configs: OperatorConfig[], requirePermissions = false): void {
  if (!Array.isArray(configs)) throw new Error('OPS_ACCOUNTS_JSON must be an array');
  const usernames = new Set<string>();
  const seeds = new Set<string>();
  for (const config of configs) {
    if (!config || typeof config !== 'object') throw new Error('OPS_ACCOUNTS_JSON contains an invalid account');
    validateOperatorConfig(config);
    if (requirePermissions && !config.permissions) throw new Error('operator permissions are required');
    if (usernames.has(config.username)) throw new Error('duplicate username in operator accounts');
    const key = decodeBase32(config.totpSecret).toString('hex');
    if (seeds.has(key)) throw new Error('duplicate TOTP secret in operator accounts');
    usernames.add(config.username);
    seeds.add(key);
  }
}

export function parseOperatorAccounts(raw: string): OperatorConfig[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('OPS_ACCOUNTS_JSON must contain valid JSON'); }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('OPS_ACCOUNTS_JSON must contain at least one account');
  validateOperatorAccounts(parsed as OperatorConfig[], true);
  return parsed as OperatorConfig[];
}

export function operatorAccountsFromEnvironment(raw: string | undefined): OperatorConfig[] | undefined {
  return raw === undefined ? undefined : parseOperatorAccounts(raw);
}

function credentialFingerprint(config: OperatorConfig): string {
  return createHash('sha256').update(JSON.stringify([config.username, config.passwordHash, config.totpSecret, config.permissions ?? null])).digest('hex');
}

function verifyPassword(password: string, encoded: string): boolean {
  if (typeof password !== 'string' || password.length > 1024) return false;
  const [, salt, expected] = encoded.split('$');
  const actual = scryptSync(password, Buffer.from(salt!, 'hex'), 64);
  return timingSafeEqual(actual, Buffer.from(expected!, 'hex'));
}

function codeForCounter(secret: Buffer, counter: number): string {
  const data = Buffer.alloc(8); data.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(data).digest();
  const offset = hmac[hmac.length - 1]! & 15;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

export function totpCode(secret: string, at = Date.now()): string {
  return codeForCounter(decodeBase32(secret), Math.floor(at / 30_000));
}

export async function loginOperator(db: Database, config: OperatorConfig, username: unknown, password: unknown, code: unknown, at = Date.now()) {
  validateOperatorConfig(config);
  const invalid = () => new AppError('LOGIN_FAILED', '账号或验证码错误', 401);
  if (typeof username !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code)) throw invalid();
  const userMatch = username === config.username;
  const passwordMatch = verifyPassword(password as string, config.passwordHash);
  if (!userMatch || !passwordMatch) throw invalid();
  const secret = decodeBase32(config.totpSecret);
  const current = Math.floor(at / 30_000);
  const matching = [current - 1, current, current + 1].find(counter => counter >= 0 &&
    timingSafeEqual(Buffer.from(code), Buffer.from(codeForCounter(secret, counter))));
  if (matching === undefined) throw invalid();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(at + 12 * 60 * 60_000).toISOString();
  const actor = `operator:${config.username}`;
  await db.transaction(async tx => {
    const { rows } = await tx.query(`INSERT INTO operator_otp_uses(operator_id,last_counter) VALUES($1,$2)
      ON CONFLICT(operator_id) DO UPDATE SET last_counter=EXCLUDED.last_counter
      WHERE operator_otp_uses.last_counter<EXCLUDED.last_counter RETURNING operator_id`, [actor, matching]);
    if (!rows.length) throw invalid();
    await tx.query('INSERT INTO operator_sessions(token_hash,operator_id,credential_fingerprint,expires_at) VALUES($1,$2,$3,$4)',
      [tokenHash, actor, credentialFingerprint(config), expiresAt]);
    await tx.query('INSERT INTO audit(id,actor_id,action) VALUES(gen_random_uuid(),$1,$2)', [actor, 'OPERATOR_LOGIN']);
  });
  return { token, expiresAt };
}

function tokenHashFromBearer(authorization: unknown): string {
  if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))
    throw new AppError('UNAUTHENTICATED', '请先登录', 401);
  return createHash('sha256').update(authorization.slice(7)).digest('hex');
}

export async function operatorFromBearer(db: Database, authorization: unknown, config: OperatorConfig | OperatorConfig[]): Promise<string> {
  const configs = Array.isArray(config) ? config : [config];
  const { rows } = await db.query<{ operator_id: string; credential_fingerprint: string }>(
    'SELECT operator_id,credential_fingerprint FROM operator_sessions WHERE token_hash=$1 AND expires_at>now()',
    [tokenHashFromBearer(authorization)]);
  const row = rows[0];
  const current = configs.find(account => `operator:${account.username}` === row?.operator_id);
  if (!row || !current || row.credential_fingerprint !== credentialFingerprint(current))
    throw new AppError('UNAUTHENTICATED', '登录已失效', 401);
  return row.operator_id;
}

export async function logoutOperator(db: Database, authorization: unknown): Promise<void> {
  const tokenHash = tokenHashFromBearer(authorization);
  const { rows } = await db.query<{ operator_id: string }>('DELETE FROM operator_sessions WHERE token_hash=$1 RETURNING operator_id', [tokenHash]);
  if (rows[0]) await db.query('INSERT INTO audit(id,actor_id,action) VALUES(gen_random_uuid(),$1,$2)', [rows[0].operator_id, 'OPERATOR_LOGOUT']);
}
