import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createOperatorEnrollment, totpCode } from '../src/operator-auth.ts';
import { createReport } from '../src/operations.ts';
import { createApp } from '../src/server.ts';

test('named report operators can read and update only assigned cases, including after reassignment', async () => {
  const db = await createDatabase();
  const password = 'separate operator account password';
  const safety = { ...createOperatorEnrollment('dispatcher', password), permissions: ['SAFETY'] };
  const first = { ...createOperatorEnrollment('firstreviewer', password), permissions: ['REPORTS'] };
  const second = { ...createOperatorEnrollment('secondreviewer', password), permissions: ['REPORTS'] };
  const app = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'test-secret',
    operatorAccounts: [safety, first, second] });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const login = async (account: typeof safety) => {
    const response = await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: account.username, password, code: totpCode(account.totpSecret) }) });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  };
  const get = (path: string, token: string) => fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
  const post = (path: string, token: string, body: unknown, key: string) => fetch(base + path, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body) });
  try {
    const alpha = await createReport(db, 'reporter', { kind: 'SAFETY', description: '甲工单仅第一位客服可读' }, 'scope-alpha');
    const beta = await createReport(db, 'reporter', { kind: 'CONTENT', description: '乙工单仅第二位客服可读' }, 'scope-beta');
    const [safetyToken, firstToken, secondToken] = await Promise.all([login(safety), login(first), login(second)]);

    const before = await get('/ops/reports', firstToken);
    assert.equal(before.status, 200);
    assert.deepEqual((await before.json() as { items: unknown[] }).items, []);
    assert.equal((await post(`/ops/reports/${alpha.id}/status`, firstToken,
      { status: 'IN_REVIEW' }, 'before-assignment')).status, 403);

    const triage = await get('/ops/reports/triage', safetyToken);
    assert.equal(triage.status, 200);
    const triageBody = await triage.json() as { items: Array<{ id: string }> };
    assert.deepEqual(triageBody.items.map(item => item.id).sort(), [alpha.id, beta.id].sort());
    assert.doesNotMatch(JSON.stringify(triageBody), /甲工单|乙工单|reporter/);
    assert.equal((await get('/ops/reports/triage', firstToken)).status, 403);

    assert.equal((await post(`/ops/reports/${alpha.id}/assign`, safetyToken,
      { assignee: first.username, reason: '按值守分工指派甲工单' }, 'assign-alpha')).status, 200);
    assert.equal((await post(`/ops/reports/${beta.id}/assign`, safetyToken,
      { assignee: second.username, reason: '按值守分工指派乙工单' }, 'assign-beta')).status, 200);
    const assignedInspection = await post(`/ops/reports/${alpha.id}/inspect`, safetyToken,
      { reason: '现场安全事件交接前逐单复核已分配工单' }, 'inspect-assigned');
    assert.equal(assignedInspection.status, 200);
    assert.equal((await assignedInspection.json() as { description: string }).description, '甲工单仅第一位客服可读');
    const firstCases = await get('/ops/reports', firstToken);
    const secondCases = await get('/ops/reports', secondToken);
    assert.deepEqual((await firstCases.json() as { items: Array<{ id: string }> }).items.map(item => item.id), [alpha.id]);
    assert.deepEqual((await secondCases.json() as { items: Array<{ id: string }> }).items.map(item => item.id), [beta.id]);
    assert.equal((await post(`/ops/reports/${beta.id}/status`, firstToken,
      { status: 'IN_REVIEW' }, 'wrong-case')).status, 403);
    assert.equal((await post(`/ops/reports/${alpha.id}/status`, secondToken,
      { status: 'IN_REVIEW' }, 'other-wrong-case')).status, 403);
    assert.equal((await post(`/ops/reports/${alpha.id}/status`, firstToken,
      { status: 'IN_REVIEW' }, 'right-case')).status, 200);

    assert.equal((await post(`/ops/reports/${alpha.id}/assign`, safetyToken,
      { assignee: second.username, reason: '交接甲工单给第二位客服' }, 'reassign-alpha')).status, 200);
    assert.equal((await post(`/ops/reports/${alpha.id}/status`, firstToken,
      { status: 'RESOLVED', resolution: '旧负责人不能再结案' }, 'stale-owner')).status, 403);
    assert.equal((await post(`/ops/reports/${alpha.id}/status`, secondToken,
      { status: 'RESOLVED', resolution: '第二位客服完成安全核查' }, 'new-owner')).status, 200);
    const finalFirst = await get('/ops/reports', firstToken);
    assert.deepEqual((await finalFirst.json() as { items: unknown[] }).items, []);
    const state = await db.query<{ status: string }>('SELECT status FROM reports WHERE id=$1', [alpha.id]);
    assert.equal(state.rows[0]?.status, 'RESOLVED');
    const assignmentAudits = await db.query<{ actor_id: string }>(
      "SELECT actor_id FROM audit WHERE action='REPORT_ASSIGNED' ORDER BY created_at,id");
    assert.equal(assignmentAudits.rows.length, 3);
    assert.ok(assignmentAudits.rows.every(row => row.actor_id === 'operator:dispatcher'));
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('safety may inspect one case only with a reason and audit, but cannot resolve or open privacy data', async () => {
  const db = await createDatabase();
  const password = 'separate operator account password';
  const safety = { ...createOperatorEnrollment('safetydispatcher', password), permissions: ['SAFETY'] };
  const reviewer = { ...createOperatorEnrollment('casereviewer', password), permissions: ['REPORTS'] };
  const app = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'test-secret',
    operatorAccounts: [safety, reviewer] });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const login = async (account: typeof safety) => {
    const response = await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: account.username, password, code: totpCode(account.totpSecret) }) });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  };
  const post = (path: string, token: string, body: unknown, key: string) => fetch(base + path, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body) });
  try {
    const report = await createReport(db, 'reporter', { kind: 'SAFETY', description: '私密安全事实只能逐单核查' }, 'inspect-case');
    const [safetyToken, reviewerToken] = await Promise.all([login(safety), login(reviewer)]);
    assert.equal((await post(`/ops/reports/${report.id}/inspect`, safetyToken, { reason: '短' }, 'short-reason')).status, 400);
    assert.equal((await post(`/ops/reports/${report.id}/inspect`, reviewerToken,
      { reason: '非安全运营不得使用紧急核查' }, 'wrong-role')).status, 403);
    assert.equal((await post(`/ops/reports/${report.id}/assign`, safetyToken,
      { assignee: safety.username, reason: '试图给自己分配全部工单' }, 'self-assign')).status, 400);
    const inspected = await post(`/ops/reports/${report.id}/inspect`, safetyToken,
      { reason: '接到现场安全事件，必须先核查这一单' }, 'inspect-with-reason');
    assert.equal(inspected.status, 200);
    assert.equal((await inspected.json() as { description: string }).description, '私密安全事实只能逐单核查');
    const audits = await db.query<{ actor_id: string; detail: { reportId: string } }>(
      "SELECT actor_id,detail FROM audit WHERE action='REPORT_SAFETY_INSPECT'");
    assert.deepEqual(audits.rows.map(row => [row.actor_id, row.detail.reportId]),
      [['operator:safetydispatcher', report.id]]);
    assert.equal((await post(`/ops/reports/${report.id}/status`, safetyToken,
      { status: 'IN_REVIEW' }, 'safety-status')).status, 403);
    assert.equal((await fetch(base + '/ops/privacy', { headers: { Authorization: `Bearer ${reviewerToken}` } })).status, 403);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('named operators keep their declared permissions in a nonproduction server', async () => {
  const db = await createDatabase();
  const password = 'named test operator password';
  const safety = { ...createOperatorEnrollment('testdispatcher', password), permissions: ['SAFETY'] };
  const reviewer = { ...createOperatorEnrollment('testreviewer', password), permissions: ['REPORTS'] };
  const app = createApp(db, { environment: 'test', devAuth: false, checkInSecret: 'test-secret',
    operatorAccounts: [safety, reviewer] });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  try {
    const response = await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: reviewer.username, password, code: totpCode(reviewer.totpSecret) }) });
    assert.equal(response.status, 200);
    const token = (await response.json() as { token: string }).token;
    assert.equal((await fetch(base + '/ops/emergency', { headers: { Authorization: `Bearer ${token}` } })).status, 403);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('safety triage exposes a case assigned to a removed operator without exposing its description', async () => {
  const db = await createDatabase();
  const password = 'named operator recovery password';
  const safety = { ...createOperatorEnrollment('recoverysafety', password), permissions: ['SAFETY'] };
  const reviewer = { ...createOperatorEnrollment('activereviewer', password), permissions: ['REPORTS'] };
  const report = await createReport(db, 'reporter', { kind: 'SAFETY',
    description: '原处理人离职后仍须重新分配的私密事实' }, 'orphaned-case');
  await db.query(`INSERT INTO report_assignments(report_id,assignee_id,assigned_by,assignment_reason)
    VALUES($1,'operator:removedreviewer','operator:recoverysafety','原测试班次分配记录')`, [report.id]);
  const app = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'test-secret',
    operatorAccounts: [safety, reviewer] });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  try {
    const login = await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: safety.username, password, code: totpCode(safety.totpSecret) }) });
    assert.equal(login.status, 200);
    const token = (await login.json() as { token: string }).token;
    const triage = await fetch(base + '/ops/reports/triage', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(triage.status, 200);
    const body = await triage.json() as { items: Array<{ id: string }> };
    assert.deepEqual(body.items.map(item => item.id), [report.id]);
    assert.doesNotMatch(JSON.stringify(body), /原处理人离职后仍须重新分配的私密事实/);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
