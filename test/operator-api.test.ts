import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { hashOperatorPassword, totpCode } from '../src/operator-auth.ts';
import { createApp } from '../src/server.ts';
import { createReport } from '../src/operations.ts';

const operatorAuth = { username: 'reviewer', passwordHash: hashOperatorPassword('correct horse battery staple', 'b'.repeat(64)),
  totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' };

test('production operations require separate MFA login and reject ordinary identities', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'secret', operatorAuth });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const post = async (path: string, body: unknown, headers: Record<string,string> = {}) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    const page = await fetch(base + '/ops');
    assert.match(await page.text(), /id="operatorLogin"/);
    assert.equal((await fetch(base + '/ops/reports', { headers: { 'X-Dev-User': 'reviewer' } })).status, 401);
    assert.equal((await post('/ops/auth/login', { username: 'reviewer', password: 'wrong', code: totpCode(operatorAuth.totpSecret) })).status, 401);
    const login = await post('/ops/auth/login', { username: 'reviewer', password: 'correct horse battery staple', code: totpCode(operatorAuth.totpSecret) });
    assert.equal(login.status, 200);
    const { token } = await login.json() as { token: string };
    assert.equal((await fetch(base + '/ops/reports', { headers: { Authorization: `Bearer ${token}` } })).status, 200);
    assert.equal((await fetch(base + '/me/events', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
    assert.equal((await post('/ops/auth/login', { username: 'reviewer', password: 'correct horse battery staple', code: totpCode(operatorAuth.totpSecret) })).status, 401);
    assert.equal((await post('/ops/auth/logout', {}, { Authorization: `Bearer ${token}` })).status, 200);
    assert.equal((await fetch(base + '/ops/reports', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('missing enrollment fails closed and repeated login attempts are throttled', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  try {
    assert.equal((await fetch(base + '/ops/reports')).status, 401);
    assert.equal((await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 503);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('operator login is throttled by source IP before repeated password guesses', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'secret', operatorAuth });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  try {
    for (let i = 0; i < 10; i++) {
      const response = await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'wrong', password: 'wrong', code: '000000' }) });
      assert.equal(response.status, 401);
    }
    const blocked = await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'reviewer', password: 'correct horse battery staple', code: totpCode(operatorAuth.totpSecret) }) });
    assert.equal(blocked.status, 429);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('two named operators sign in separately and removing one blocks only that session', async () => {
  const db = await createDatabase();
  const second = { username: 'safety', passwordHash: hashOperatorPassword('a different private password', 'f'.repeat(64)),
    totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', permissions: ['REPORTS'] };
  const options = { environment: 'production' as const, devAuth: false, checkInSecret: 'secret', operatorAccounts: [{ ...operatorAuth, permissions: ['REPORTS'] }, second] };
  const app = createApp(db, options);
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const login = async (username: string, password: string, secret: string) => {
    const response = await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, code: totpCode(secret) }) });
    return { status: response.status, body: await response.json() as { token?: string } };
  };
  try {
    const first = await login('reviewer', 'correct horse battery staple', operatorAuth.totpSecret);
    const other = await login('safety', 'a different private password', second.totpSecret);
    const unknown = await login('unknown', 'correct horse battery staple', operatorAuth.totpSecret);
    assert.equal(first.status, 200); assert.equal(other.status, 200);
    assert.equal(unknown.status, 401);
    assert.equal((await fetch(base + '/ops/reports', { headers: { Authorization: `Bearer ${first.body.token}` } })).status, 200);
    assert.equal((await fetch(base + '/ops/reports', { headers: { Authorization: `Bearer ${other.body.token}` } })).status, 200);
    const report = await createReport(db, 'reporter', { kind: 'SAFETY', description: '需要人工核查活动安全问题' }, 'multi-operator-report');
    await db.query(`INSERT INTO report_assignments(report_id,assignee_id,assigned_by,assignment_reason)
      VALUES($1,'operator:safety','operator:reviewer','合成测试明确指派处理人')`, [report.id]);
    const reviewed = await fetch(base + `/ops/reports/${report.id}/status`, { method: 'POST',
      headers: { Authorization: `Bearer ${other.body.token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'multi-operator-review' },
      body: JSON.stringify({ status: 'IN_REVIEW' }) });
    assert.equal(reviewed.status, 200);
    const audit = await db.query<{ actor_id: string }>("SELECT actor_id FROM audit WHERE action='OPERATOR_LOGIN' ORDER BY actor_id");
    assert.deepEqual(audit.rows.map(row => row.actor_id), ['operator:reviewer', 'operator:safety']);
    const reviewAudit = await db.query<{ actor_id: string }>("SELECT actor_id FROM audit WHERE action='REPORT_STATUS'");
    assert.equal(reviewAudit.rows[0]?.actor_id, 'operator:safety');
    await new Promise<void>(resolve => app.close(() => resolve()));
    const reconfigured = createApp(db, { ...options, operatorAccounts: [second] });
    reconfigured.listen(0, '127.0.0.1'); await once(reconfigured, 'listening');
    try {
      const nextBase = `http://127.0.0.1:${(reconfigured.address() as { port: number }).port}`;
      assert.equal((await fetch(nextBase + '/ops/reports', { headers: { Authorization: `Bearer ${first.body.token}` } })).status, 401);
      assert.equal((await fetch(nextBase + '/ops/reports', { headers: { Authorization: `Bearer ${other.body.token}` } })).status, 200);
    } finally { await new Promise<void>(resolve => reconfigured.close(() => resolve())); }
  } finally { if (app.listening) await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('duplicate operator accounts fail server startup instead of sharing one identity', async () => {
  const db = await createDatabase();
  try {
    assert.throws(() => createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'secret',
      operatorAccounts: [{ ...operatorAuth, permissions: ['REPORTS'] }, { ...operatorAuth, permissions: ['REPORTS'] }] }), /duplicate username/);
  } finally { await db.close(); }
});
