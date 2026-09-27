import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { actorFromBearer, loginWithWechat } from '../src/auth.ts';
import { createApp } from '../src/server.ts';

test('a verified WeChat code creates one session and replay cannot mint another', async () => {
  const db = await createDatabase();
  const exchange = async (code: string) => ({ openid: `openid-${code}` });
  try {
    const first = await loginWithWechat(db, exchange, 'one-time-code');
    await assert.rejects(() => loginWithWechat(db, exchange, 'one-time-code'), { code: 'LOGIN_REPLAY' });
    assert.equal((await db.query('SELECT token_hash FROM sessions')).rows.length, 1);
    assert.equal(await actorFromBearer(db, `Bearer ${first.token}`), first.userId);
  } finally { await db.close(); }
});

test('concurrent exchanges of one code commit only one session', async () => {
  const db = await createDatabase();
  const exchange = async () => ({ openid: 'same-wechat-user' });
  try {
    const results = await Promise.allSettled([
      loginWithWechat(db, exchange, 'racing-code'), loginWithWechat(db, exchange, 'racing-code')
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected' && (result.reason as { code?: string }).code === 'LOGIN_REPLAY').length, 1);
    assert.equal((await db.query('SELECT token_hash FROM sessions')).rows.length, 1);
  } finally { await db.close(); }
});

test('an invalid provider code creates neither replay marker nor session', async () => {
  const db = await createDatabase();
  try {
    await assert.rejects(() => loginWithWechat(db, async () => null, 'invalid-code'), { code: 'LOGIN_FAILED' });
    assert.equal((await db.query('SELECT token_hash FROM sessions')).rows.length, 0);
    assert.equal((await db.query('SELECT code_hash FROM wechat_login_exchanges')).rows.length, 0);
  } finally { await db.close(); }
});

test('a disabled account cannot receive a new WeChat session or reactivate through login', async () => {
  const db = await createDatabase();
  const exchange = async () => ({ openid: 'disabled-wechat-user' });
  try {
    const first = await loginWithWechat(db, exchange, 'first-code');
    await db.query("UPDATE users SET status='DISABLED' WHERE id=$1", [first.userId]);
    await assert.rejects(() => actorFromBearer(db, `Bearer ${first.token}`), { code: 'UNAUTHENTICATED' });
    await assert.rejects(() => loginWithWechat(db, exchange, 'second-code'), { code: 'ACCOUNT_DISABLED' });
    assert.equal((await db.query('SELECT token_hash FROM sessions')).rows.length, 1);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM users WHERE id=$1', [first.userId])).rows[0]?.status, 'DISABLED');
  } finally { await db.close(); }
});

test('WeChat login HTTP rejects a disabled account without returning a token', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: false, checkInSecret: 'secret',
    wechatExchange: async () => ({ openid: 'disabled-http-user' }) });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const login = (code: string) => fetch(base + '/auth/wechat', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
  try {
    const first = await login('first-http-code');
    assert.equal(first.status, 200);
    const firstBody = await first.json() as { userId: string };
    await db.query("UPDATE users SET status='DISABLED' WHERE id=$1", [firstBody.userId]);
    const denied = await login('second-http-code');
    assert.equal(denied.status, 403);
    const body = await denied.json() as Record<string, unknown>;
    assert.equal(body.code, 'ACCOUNT_DISABLED');
    assert.equal(body.token, undefined);
    assert.equal((await db.query('SELECT token_hash FROM sessions')).rows.length, 1);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
