import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createOperatorEnrollment, hashOperatorPassword, loginOperator, logoutOperator, operatorAccountsFromEnvironment, operatorFromBearer, parseOperatorAccounts, totpCode, validateOperatorAccounts, validateOperatorConfig } from '../src/operator-auth.ts';

const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const config = { username: 'reviewer', passwordHash: hashOperatorPassword('correct horse battery staple', 'a'.repeat(64)), totpSecret: secret };

test('TOTP follows the RFC 6238 SHA1 vector at 59 seconds', () => {
  assert.equal(totpCode(secret, 59_000), '287082');
});

test('enrollment generates usable verifier and distinct base32 authenticator secret', () => {
  const first = createOperatorEnrollment('reviewer', 'correct horse battery staple');
  const second = createOperatorEnrollment('reviewer', 'correct horse battery staple');
  validateOperatorConfig(first);
  assert.notEqual(first.passwordHash, second.passwordHash);
  assert.notEqual(first.totpSecret, second.totpSecret);
  assert.match(first.totpSecret, /^[A-Z2-7]{32}$/);
});

test('operator password and one-time code issue a separate expiring session', async () => {
  const db = await createDatabase();
  try {
    const now = Date.now();
    const code = totpCode(secret, now);
    await assert.rejects(loginOperator(db, config, 'reviewer', 'wrong', code, now), { code: 'LOGIN_FAILED' });
    await assert.rejects(loginOperator(db, config, 'reviewer', 'correct horse battery staple', '000000', now), { code: 'LOGIN_FAILED' });
    const { token } = await loginOperator(db, config, 'reviewer', 'correct horse battery staple', code, now);
    assert.equal(await operatorFromBearer(db, `Bearer ${token}`, config), 'operator:reviewer');
    await assert.rejects(loginOperator(db, config, 'reviewer', 'correct horse battery staple', code, now), { code: 'LOGIN_FAILED' });
    await logoutOperator(db, `Bearer ${token}`);
    await assert.rejects(operatorFromBearer(db, `Bearer ${token}`, config), { code: 'UNAUTHENTICATED' });
  } finally { await db.close(); }
});

test('two simultaneous logins cannot reuse one one-time code', async () => {
  const db = await createDatabase();
  try {
    const now = Date.now();
    const code = totpCode(secret, now);
    const results = await Promise.allSettled(Array.from({ length: 2 }, () => loginOperator(db, config, 'reviewer', 'correct horse battery staple', code, now)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  } finally { await db.close(); }
});

test('expired operator session is rejected', async () => {
  const db = await createDatabase();
  try {
    const now = Date.now();
    const { token } = await loginOperator(db, config, 'reviewer', 'correct horse battery staple', totpCode(secret, now), now);
    await db.query("UPDATE operator_sessions SET expires_at=now()-interval '1 second'");
    await assert.rejects(operatorFromBearer(db, `Bearer ${token}`, config), { code: 'UNAUTHENTICATED' });
  } finally { await db.close(); }
});

test('rotating the configured operator credentials invalidates existing sessions', async () => {
  const db = await createDatabase();
  try {
    const now = Date.now();
    const { token } = await loginOperator(db, config, 'reviewer', 'correct horse battery staple', totpCode(secret, now), now);
    const rotated = { ...config, passwordHash: hashOperatorPassword('new correct horse battery staple', 'd'.repeat(64)) };
    await assert.rejects(operatorFromBearer(db, `Bearer ${token}`, rotated), { code: 'UNAUTHENTICATED' });
  } finally { await db.close(); }
});

test('credential list rejects duplicate names and shared authenticator seeds', () => {
  assert.throws(() => validateOperatorAccounts([config, { ...config }]), /duplicate username/i);
  assert.throws(() => validateOperatorAccounts([config, { ...config, username: 'second' }]), /duplicate totp/i);
  assert.throws(() => validateOperatorAccounts([config, { ...config, username: 'second', totpSecret: secret + 'A' }]), /base32|duplicate totp/i);
});

test('operator list configuration rejects malformed or empty JSON', () => {
  assert.throws(() => parseOperatorAccounts('{broken'), /valid JSON/);
  assert.throws(() => parseOperatorAccounts('[]'), /at least one account/);
  assert.throws(() => parseOperatorAccounts(JSON.stringify([config])), /permissions/i);
  const scoped = { ...config, permissions: ['REPORTS'] };
  assert.deepEqual(parseOperatorAccounts(JSON.stringify([scoped])), [scoped]);
  assert.equal(operatorAccountsFromEnvironment(undefined), undefined);
  assert.throws(() => operatorAccountsFromEnvironment(''), /valid JSON/);
});

test('named operator permissions reject empty, unknown and duplicate grants', () => {
  assert.throws(() => validateOperatorAccounts([{ ...config, permissions: [] }], true), /permissions/i);
  assert.throws(() => validateOperatorAccounts([{ ...config, permissions: ['EVERYTHING'] }], true), /permissions/i);
  assert.throws(() => validateOperatorAccounts([{ ...config, permissions: ['REPORTS', 'REPORTS'] }], true), /permissions/i);
});

test('changing permissions invalidates an existing operator session', async () => {
  const db = await createDatabase();
  const scoped = { ...config, permissions: ['REPORTS'] };
  try {
    const now = Date.now();
    const { token } = await loginOperator(db, scoped, scoped.username, 'correct horse battery staple', totpCode(secret, now), now);
    assert.equal(await operatorFromBearer(db, `Bearer ${token}`, scoped), 'operator:reviewer');
    await assert.rejects(operatorFromBearer(db, `Bearer ${token}`, { ...scoped, permissions: ['PRIVACY'] }), { code: 'UNAUTHENTICATED' });
  } finally { await db.close(); }
});

test('named operators have separate sessions and removing one revokes only that account', async () => {
  const db = await createDatabase();
  const second = { username: 'second', passwordHash: hashOperatorPassword('different correct horse battery', 'e'.repeat(64)),
    totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' };
  try {
    const now = Date.now();
    const firstSession = await loginOperator(db, config, config.username, 'correct horse battery staple', totpCode(config.totpSecret, now), now);
    const secondSession = await loginOperator(db, second, second.username, 'different correct horse battery', totpCode(second.totpSecret, now), now);
    assert.equal(await operatorFromBearer(db, `Bearer ${firstSession.token}`, [config, second]), 'operator:reviewer');
    assert.equal(await operatorFromBearer(db, `Bearer ${secondSession.token}`, [config, second]), 'operator:second');
    await assert.rejects(operatorFromBearer(db, `Bearer ${firstSession.token}`, [second]), { code: 'UNAUTHENTICATED' });
    assert.equal(await operatorFromBearer(db, `Bearer ${secondSession.token}`, [second]), 'operator:second');
    const audit = await db.query<{ actor_id: string }>("SELECT actor_id FROM audit WHERE action='OPERATOR_LOGIN' ORDER BY actor_id");
    assert.deepEqual(audit.rows.map(row => row.actor_id), ['operator:reviewer', 'operator:second']);
  } finally { await db.close(); }
});
