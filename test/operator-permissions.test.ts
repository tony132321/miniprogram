import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createOperatorEnrollment, OPERATOR_PERMISSIONS, totpCode } from '../src/operator-auth.ts';
import { createApp } from '../src/server.ts';

const reads = {
  REPORTS: '/ops/reports', SAFETY: '/ops/emergency', EVENT_REVIEWS: '/ops/events/reviews',
  APPEALS: '/ops/appeals', PRIVACY: '/ops/privacy', CONTENT: '/ops/content', RATE_LIMITS: '/ops/rate-limits',
  NOTIFICATIONS: '/ops/notifications/followups', METRICS: '/ops/metrics', SUPPORT_MINUTES: '/ops/support-minutes',
  JOBS: '/ops/jobs/failed'
};

test('pilot metrics require a dedicated operator permission and return aggregate data only', async () => {
  const db = await createDatabase();
  const password = 'metrics operator password';
  const metricOperator = { ...createOperatorEnrollment('metricreviewer', password), permissions: ['METRICS'] };
  const reportOperator = { ...createOperatorEnrollment('reportreviewer', password), permissions: ['REPORTS'] };
  const app = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'secret',
    operatorAccounts: [metricOperator, reportOperator] });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const login = async (account: typeof metricOperator) => {
    const response = await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: account.username, password, code: totpCode(account.totpSecret) }) });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  };
  try {
    const metricToken = await login(metricOperator);
    const reportToken = await login(reportOperator);
    const denied = await fetch(base + '/ops/metrics', { headers: { Authorization: `Bearer ${reportToken}` } });
    assert.equal(denied.status, 403);
    const response = await fetch(base + '/ops/metrics', { headers: { Authorization: `Bearer ${metricToken}` } });
    assert.equal(response.status, 200);
    const result = await response.json() as { weeks: unknown[]; hostReuse28d: { rate: number | null }; contributionProfit: { status: string } };
    assert.deepEqual(result.weeks, []);
    assert.equal(result.hostReuse28d.rate, null);
    assert.equal(result.contributionProfit.status, 'UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify(result), /metricreviewer|reportreviewer|wechat_openid/);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('each named operator can read only the assigned queue', async () => {
  const db = await createDatabase();
  const password = 'scoped operator password';
  const accounts = OPERATOR_PERMISSIONS.map((permission, index) => ({
    ...createOperatorEnrollment(`operator${index}`, password), permissions: [permission]
  }));
  const app = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'secret',
    operatorAccounts: accounts, trustedProxyIps: ['127.0.0.1'] });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  try {
    const tokens = new Map<string, string>();
    for (const [index, account] of accounts.entries()) {
      const response = await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json',
        'X-Forwarded-For': `10.0.0.${index + 1}` },
        body: JSON.stringify({ username: account.username, password, code: totpCode(account.totpSecret) }) });
      assert.equal(response.status, 200);
      tokens.set(account.permissions[0]!, (await response.json() as { token: string }).token);
    }
    for (const assigned of OPERATOR_PERMISSIONS) for (const requested of OPERATOR_PERMISSIONS) {
      const response = await fetch(base + reads[requested], { headers: { Authorization: `Bearer ${tokens.get(assigned)}` } });
      assert.equal(response.status, assigned === requested ? 200 : 403, `${assigned} requested ${requested}`);
    }
    for (const assigned of OPERATOR_PERMISSIONS) {
      const response = await fetch(base + '/ops/notifications/followups/history', { headers: { Authorization: `Bearer ${tokens.get(assigned)}` } });
      assert.equal(response.status, assigned === 'NOTIFICATIONS' ? 200 : 403, `${assigned} requested notification history`);
    }
    const mutations: Array<{ permission: typeof OPERATOR_PERMISSIONS[number]; path: string; body: unknown }> = [
      { permission: 'REPORTS', path: '/ops/reports/missing/status', body: { status: 'IN_REVIEW' } },
      { permission: 'SAFETY', path: '/ops/events/missing/hold', body: { reason: '需要安全复核' } },
      { permission: 'SAFETY', path: '/ops/holds/missing/release', body: { reason: '安全复核已完成' } },
      { permission: 'SAFETY', path: '/ops/public-recruitment', body: { status: 'CLOSED', reason: '核查公开活动安全事件' } },
      { permission: 'SAFETY', path: '/ops/emergency', body: { status: 'CLOSED', reason: '发现容量异常暂停新增' } },
      { permission: 'EVENT_REVIEWS', path: '/ops/events/missing/review', body: { expectedVersion: 1, decision: 'REJECTED', reason: '资料仍不完整' } },
      { permission: 'APPEALS', path: '/ops/appeals/missing/status', body: { status: 'IN_REVIEW' } },
      { permission: 'CONTENT', path: '/ops/content/missing/moderate', body: { status: 'REJECTED' } },
      { permission: 'NOTIFICATIONS', path: '/ops/notifications/missing/followup', body: { note: '已经人工核实消息状态' } },
      { permission: 'JOBS', path: '/ops/jobs/missing/retry', body: {} },
      { permission: 'SUPPORT_MINUTES', path: '/ops/events/missing/support-minutes', body: { minutes: 5, category: 'SUPPORT' } }
    ];
    for (const mutation of mutations) {
      const wrong = OPERATOR_PERMISSIONS.find(permission => permission !== mutation.permission)!;
      const response = await fetch(base + mutation.path, { method: 'POST', headers: { Authorization: `Bearer ${tokens.get(wrong)}`,
        'Content-Type': 'application/json', 'Idempotency-Key': `wrong-${mutation.permission}-${mutation.path}` },
        body: JSON.stringify(mutation.body) });
      assert.equal(response.status, 403, `${wrong} mutated ${mutation.permission}`);
      const permitted = await fetch(base + mutation.path, { method: 'POST', headers: { Authorization: `Bearer ${tokens.get(mutation.permission)}`,
        'Content-Type': 'application/json', 'Idempotency-Key': `allowed-${mutation.permission}-${mutation.path}` },
        body: JSON.stringify(mutation.body) });
      assert.notEqual(permitted.status, 403, `${mutation.permission} permitted mutation`);
    }
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
