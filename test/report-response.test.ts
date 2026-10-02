import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase, type Database } from '../src/db.ts';
import { createOperatorEnrollment, totpCode } from '../src/operator-auth.ts';
import { assignReport, changeReportStatus, classifyReportSeverity, createReport, listReportTriage, listReports } from '../src/operations.ts';
import { parseReportResponsePolicy } from '../src/report-response-policy.ts';
import { createApp } from '../src/server.ts';

const responsePolicy = {
  defaultSeverityByKind: { SAFETY: 'HIGH' as const, CONTENT: 'NORMAL' as const,
    ATTENDANCE: 'NORMAL' as const, OTHER: 'NORMAL' as const },
  targetMinutesBySeverity: { HIGH: 5, NORMAL: 120 }
};

test('response policy requires HIGH to have a strictly shorter target than NORMAL', () => {
  assert.deepEqual(parseReportResponsePolicy(JSON.stringify(responsePolicy)), responsePolicy);
  for (const highMinutes of [120, 121]) {
    const invalid = { ...responsePolicy,
      targetMinutesBySeverity: { HIGH: highMinutes, NORMAL: 120 } };
    assert.throws(() => parseReportResponsePolicy(JSON.stringify(invalid)), /HIGH.*NORMAL/i);
  }
});

test('unassigned triage follows severity and earliest due time, invalidating old pages after reclassification', async () => {
  const db = await createDatabase();
  try {
    const normalSafety = await createReport(db, 'reporter',
      { kind: 'SAFETY', description: '普通安全类别但已人工核查为普通级' }, 'triage-normal', responsePolicy);
    await classifyReportSeverity(db, 'operator:safety', normalSafety.id, 'NORMAL', 'HIGH',
      '逐单核查后判定为普通严重度', 'triage-normal-classify', responsePolicy);
    const earlyHigh = await createReport(db, 'reporter',
      { kind: 'OTHER', description: '高严重度且目标较早' }, 'triage-high-early', responsePolicy);
    await classifyReportSeverity(db, 'operator:safety', earlyHigh.id, 'HIGH', 'NORMAL',
      '逐单核查后判定为高严重度', 'triage-high-early-classify', responsePolicy);
    const lateHigh = await createReport(db, 'reporter',
      { kind: 'OTHER', description: '高严重度但目标较晚' }, 'triage-high-late', responsePolicy);
    await classifyReportSeverity(db, 'operator:safety', lateHigh.id, 'HIGH', 'NORMAL',
      '逐单核查后判定为高严重度', 'triage-high-late-classify', responsePolicy);
    await db.query("UPDATE reports SET first_response_due_at=first_response_due_at+interval '1 hour' WHERE id=$1", [earlyHigh.id]);
    const before = await listReportTriage(db, []);
    assert.deepEqual(before.items.map((item: { id: string }) => item.id),
      [lateHigh.id, earlyHigh.id, normalSafety.id]);
    await classifyReportSeverity(db, 'operator:safety', normalSafety.id, 'HIGH', 'NORMAL',
      '出现新线索后升级为高严重度', 'triage-upgrade', responsePolicy);
    await assert.rejects(() => listReportTriage(db, [], 1, before.snapshot), { code: 'QUEUE_CHANGED' });
  } finally { await db.close(); }
});

test('assigned report queue follows severity and invalidates a cursor after case reclassification', async () => {
  const db = await createDatabase();
  try {
    const normalSafety = await createReport(db, 'reporter',
      { kind: 'SAFETY', description: '已核查为普通严重度的安全类别' }, 'assigned-normal', responsePolicy);
    await classifyReportSeverity(db, 'operator:safety', normalSafety.id, 'NORMAL', 'HIGH',
      '该工单线索目前属于普通严重度', 'assigned-normal-classify', responsePolicy);
    const highOther = await createReport(db, 'reporter',
      { kind: 'OTHER', description: '应优先处理的高严重度其他类别' }, 'assigned-high', responsePolicy);
    await classifyReportSeverity(db, 'operator:safety', highOther.id, 'HIGH', 'NORMAL',
      '逐单核查确认此工单为高严重度', 'assigned-high-classify', responsePolicy);
    for (const report of [normalSafety, highOther]) await assignReport(db, 'operator:safety', report.id,
      'operator:reviewer', '本班次由具名处理员负责此工单', `assign-${report.id}`);
    const before = await listReports(db, 'operator:reviewer');
    assert.deepEqual(before.items.map((item: { id: string }) => item.id), [highOther.id, normalSafety.id]);
    await classifyReportSeverity(db, 'operator:safety', normalSafety.id, 'HIGH', 'NORMAL',
      '出现新的严重线索需升级该工单', 'assigned-upgrade', responsePolicy);
    await assert.rejects(() => listReports(db, 'operator:reviewer', 1, before.snapshot), { code: 'QUEUE_CHANGED' });
  } finally { await db.close(); }
});

test('legacy unclassified SAFETY remains on the first page ahead of 100 configured NORMAL reports', async () => {
  const db = await createDatabase();
  try {
    const legacySafety = await createReport(db, 'reporter',
      { kind: 'SAFETY', description: '旧安全工单需先分流' }, 'legacy-safety-page');
    await db.query(`INSERT INTO reports(id,reporter_id,kind,description,severity,
      first_response_target_minutes,first_response_due_at)
      SELECT 'normal-page-'||n,'reporter','CONTENT','普通工单','NORMAL',120,
        clock_timestamp()+interval '120 minutes' FROM generate_series(1,100) AS n`);
    await db.query(`INSERT INTO report_assignments(report_id,assignee_id,assigned_by,assignment_reason)
      SELECT id,'operator:reviewer','operator:safety','用于队列分页的合成分配'
      FROM reports WHERE id=$1 OR id LIKE 'normal-page-%'`, [legacySafety.id]);
    const triage = await listReportTriage(db, []);
    assert.equal(triage.total, 101);
    assert.equal(triage.items[0]?.id, legacySafety.id);
    assert.equal(triage.nextOffset, 100);
    const assigned = await listReports(db, 'operator:reviewer');
    assert.equal(assigned.total, 101);
    assert.equal(assigned.items[0]?.id, legacySafety.id);
    assert.equal(assigned.nextOffset, 100);
  } finally { await db.close(); }
});

test('pending first responses rank before already reviewed cases at the same severity in both queues', async () => {
  const db = await createDatabase();
  try {
    const reviewed = await createReport(db, 'reporter',
      { kind: 'CONTENT', description: '已人工首次响应的内容举报' }, 'reviewed-order', responsePolicy);
    const pending = await createReport(db, 'reporter',
      { kind: 'CONTENT', description: '仍待人工首次响应的内容举报' }, 'pending-order', responsePolicy);
    for (const report of [reviewed, pending]) await assignReport(db, 'operator:safety', report.id,
      'operator:reviewer', '同一处理员的队列排序验证', `response-order-${report.id}`);
    await changeReportStatus(db, 'operator:reviewer', reviewed.id, 'IN_REVIEW', undefined, 'reviewed-first');
    const triage = await listReportTriage(db, []);
    assert.deepEqual(triage.items.map((item: { id: string }) => item.id), [pending.id, reviewed.id]);
    const assigned = await listReports(db, 'operator:reviewer');
    assert.deepEqual(assigned.items.map((item: { id: string }) => item.id), [pending.id, reviewed.id]);
    await db.query(`UPDATE reports SET first_response_state='RECORDED',
      first_responded_at=clock_timestamp(),first_responded_by='operator:reviewer' WHERE id=$1`, [pending.id]);
    await assert.rejects(() => listReportTriage(db, [], 1, triage.snapshot), { code: 'QUEUE_CHANGED' });
    await assert.rejects(() => listReports(db, 'operator:reviewer', 1, assigned.snapshot), { code: 'QUEUE_CHANGED' });
  } finally { await db.close(); }
});

test('resolved historical reports never fill triage pages or accept reassignment', async () => {
  const db = await createDatabase();
  try {
    const open = await createReport(db, 'reporter',
      { kind: 'SAFETY', description: '仍需人工分配的安全工单' }, 'open-after-closed');
    await db.query(`INSERT INTO reports(id,reporter_id,kind,description,status,severity,first_response_state)
      SELECT 'closed-old-'||n,'reporter','SAFETY','已结案的历史工单',
        'RESOLVED','HIGH','LEGACY_UNKNOWN' FROM generate_series(1,101) AS n`);
    const triage = await listReportTriage(db, []);
    assert.deepEqual(triage.items.map((item: { id: string }) => item.id), [open.id]);
    assert.equal(triage.total, 1);
    await assert.rejects(() => assignReport(db, 'operator:safety', 'closed-old-1',
      'operator:reviewer', '已结案工单不应重新分配给客服', 'closed-reassign'), { code: 'INVALID_STATE' });
    assert.deepEqual((await db.query('SELECT report_id FROM report_assignments WHERE report_id=$1',
      ['closed-old-1'])).rows, []);
  } finally { await db.close(); }
});

test('report response targets use database time, stay private, and stop alerting after one scoped human response', async () => {
  const db = await createDatabase();
  const password = 'separate operator account password';
  const safety = { ...createOperatorEnrollment('response-safety', password), permissions: ['SAFETY'] };
  const reviewer = { ...createOperatorEnrollment('response-reviewer', password), permissions: ['REPORTS'] };
  const shiftedClock = () => Date.now() + 90 * 24 * 60 * 60_000;
  const app = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret',
    operatorAccounts: [safety, reviewer], reportResponsePolicy: responsePolicy,
    clock: shiftedClock });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const login = async (account: typeof safety) => {
    const response = await fetch(base + '/ops/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: account.username, password, code: totpCode(account.totpSecret, shiftedClock()) }) });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  };
  const get = (path: string, token: string) => fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
  const post = (path: string, token: string, body: unknown, key: string) => fetch(base + path, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body) });
  try {
    const created = await fetch(base + '/reports', { method: 'POST', headers: {
      'X-Dev-User': 'reporter', 'Content-Type': 'application/json', 'Idempotency-Key': 'response-case'
    }, body: JSON.stringify({ kind: 'SAFETY', description: '仅处理员和逐单核查可读的安全事实' }) });
    assert.equal(created.status, 201);
    const { id } = await created.json() as { id: string };
    const { rows } = await db.query<{ severity: string; target_minutes: number; due_at: Date;
      created_at: Date; first_responded_at: Date | null }>(
      'SELECT severity,first_response_target_minutes AS target_minutes,first_response_due_at AS due_at,created_at,first_responded_at FROM reports WHERE id=$1', [id]);
    assert.equal(rows[0]?.severity, 'HIGH');
    assert.equal(rows[0]?.target_minutes, 5);
    assert.equal(new Date(rows[0]!.due_at).getTime() - new Date(rows[0]!.created_at).getTime(), 5 * 60_000);
    assert.equal(rows[0]?.first_responded_at, null);
    assert.ok(new Date(rows[0]!.due_at).getTime() < Date.now() + 10 * 60_000);

    const [safetyToken, reviewerToken] = await Promise.all([login(safety), login(reviewer)]);
    assert.equal((await get('/ops/reports/response-alerts?offset=0', reviewerToken)).status, 403);
    assert.equal((await post(`/ops/reports/${id}/status`, reviewerToken,
      { status: 'IN_REVIEW' }, 'response-before-assignment')).status, 403);
    assert.equal((await post(`/ops/reports/${id}/assign`, safetyToken,
      { assignee: reviewer.username, reason: '本次值守将安全工单交给具名处理员' }, 'response-assign')).status, 200);
    await db.query("UPDATE reports SET first_response_due_at=clock_timestamp()-interval '1 second' WHERE id=$1", [id]);
    const alerts = await get('/ops/reports/response-alerts?offset=0', safetyToken);
    assert.equal(alerts.status, 200);
    const alertBody = await alerts.json() as { items: Array<{ id: string; attention: string; assignee_id: string }> };
    assert.deepEqual(alertBody.items.map(item => item.id), [id]);
    assert.equal(alertBody.items[0]?.attention, 'OVERDUE');
    assert.equal(alertBody.items[0]?.assignee_id, `operator:${reviewer.username}`);
    assert.doesNotMatch(JSON.stringify(alertBody), /仅处理员和逐单核查可读的安全事实|reporter/);

    const [first, duplicate] = await Promise.all([
      post(`/ops/reports/${id}/status`, reviewerToken, { status: 'IN_REVIEW' }, 'first-response'),
      post(`/ops/reports/${id}/status`, reviewerToken, { status: 'IN_REVIEW' }, 'duplicate-response')
    ]);
    assert.deepEqual([first.status, duplicate.status].sort(), [200, 409]);
    const responded = await db.query<{ first_responded_by: string; first_responded_at: Date; status: string }>(
      'SELECT first_responded_by,first_responded_at,status FROM reports WHERE id=$1', [id]);
    assert.equal(responded.rows[0]?.first_responded_by, `operator:${reviewer.username}`);
    assert.equal(responded.rows[0]?.status, 'IN_REVIEW');
    assert.ok(Math.abs(new Date(responded.rows[0]!.first_responded_at).getTime() - Date.now()) < 20_000);
    const cleared = await get('/ops/reports/response-alerts?offset=0', safetyToken);
    assert.deepEqual((await cleared.json() as { items: unknown[] }).items, []);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('reports without an approved response target stay visible as unconfigured instead of claiming an SLA', async () => {
  const db = await createDatabase();
  try {
    const report = await createReport(db, 'reporter', { kind: 'CONTENT', description: '需要人工分类的内容工单' }, 'unconfigured-case');
    const rows = await db.query<{ severity: string; first_response_due_at: Date | null }>(
      'SELECT severity,first_response_due_at FROM reports WHERE id=$1', [report.id]);
    assert.equal(rows.rows[0]?.severity, 'UNCLASSIFIED');
    assert.equal(rows.rows[0]?.first_response_due_at, null);
  } finally { await db.close(); }
});

test('only safety can reclassify a report with a reason, preserving the first response after it occurs', async () => {
  const db = await createDatabase();
  const password = 'separate operator account password';
  const safety = { ...createOperatorEnrollment('severity-safety', password), permissions: ['SAFETY'] };
  const reviewer = { ...createOperatorEnrollment('severity-reviewer', password), permissions: ['REPORTS'] };
  const app = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'test-secret',
    operatorAccounts: [safety, reviewer], reportResponsePolicy: responsePolicy });
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
    const report = await createReport(db, 'reporter', { kind: 'OTHER', description: '逐单改级时不能泄漏正文' },
      'severity-case', responsePolicy);
    const [safetyToken, reviewerToken] = await Promise.all([login(safety), login(reviewer)]);
    const classifyPath = `/ops/reports/${report.id}/severity`;
    const reason = '现场线索显示需按高严重度优先核查';
    assert.equal((await post(classifyPath, reviewerToken,
      { severity: 'HIGH', expectedSeverity: 'NORMAL', reason }, 'reviewer-classify')).status, 403);
    assert.equal((await post(classifyPath, safetyToken,
      { severity: 'HIGH', expectedSeverity: 'NORMAL', reason: '太短' }, 'short-reason')).status, 400);
    const changed = await post(classifyPath, safetyToken,
      { severity: 'HIGH', expectedSeverity: 'NORMAL', reason }, 'high-classify');
    assert.equal(changed.status, 200);
    const changedBody = await changed.json() as { severity: string; firstResponseTargetMinutes: number };
    assert.equal(changedBody.severity, 'HIGH');
    assert.equal(changedBody.firstResponseTargetMinutes, 5);
    const stale = await post(classifyPath, safetyToken,
      { severity: 'NORMAL', expectedSeverity: 'NORMAL', reason: '另一位值守人员基于旧列表执行的过期降级' }, 'stale-downgrade');
    assert.equal(stale.status, 409);
    assert.equal((await db.query<{ severity: string }>('SELECT severity FROM reports WHERE id=$1',
      [report.id])).rows[0]?.severity, 'HIGH');
    const first = await db.query<{ severity: string; target_minutes: number; due_at: Date; created_at: Date }>(
      'SELECT severity,first_response_target_minutes AS target_minutes,first_response_due_at AS due_at,created_at FROM reports WHERE id=$1',
      [report.id]);
    assert.equal(first.rows[0]?.severity, 'HIGH');
    assert.equal(first.rows[0]?.target_minutes, 5);
    assert.equal(new Date(first.rows[0]!.due_at).getTime() - new Date(first.rows[0]!.created_at).getTime(), 5 * 60_000);
    assert.equal((await post(`/ops/reports/${report.id}/assign`, safetyToken,
      { assignee: reviewer.username, reason: '分配给具名举报处理人员' }, 'severity-assign')).status, 200);
    assert.equal((await post(`/ops/reports/${report.id}/status`, reviewerToken,
      { status: 'IN_REVIEW' }, 'severity-first-response')).status, 200);
    const responded = await db.query<{ first_responded_at: Date; first_responded_by: string }>(
      'SELECT first_responded_at,first_responded_by FROM reports WHERE id=$1', [report.id]);
    const afterResponse = await post(classifyPath, safetyToken,
      { severity: 'NORMAL', expectedSeverity: 'HIGH',
        reason: '完成首轮核查后调整后续处置等级' }, 'normal-classify');
    assert.equal(afterResponse.status, 200);
    const final = await db.query<{ severity: string; first_response_target_minutes: number;
      first_response_due_at: Date; first_responded_at: Date; first_responded_by: string }>(
      'SELECT severity,first_response_target_minutes,first_response_due_at,first_responded_at,first_responded_by FROM reports WHERE id=$1',
      [report.id]);
    assert.equal(final.rows[0]?.severity, 'NORMAL');
    assert.equal(final.rows[0]?.first_response_target_minutes, 5);
    assert.equal(new Date(final.rows[0]!.first_response_due_at).getTime(), new Date(first.rows[0]!.due_at).getTime());
    assert.equal(new Date(final.rows[0]!.first_responded_at).getTime(), new Date(responded.rows[0]!.first_responded_at).getTime());
    assert.equal(final.rows[0]?.first_responded_by, responded.rows[0]?.first_responded_by);
    const audits = await db.query<{ actor_id: string; detail: { reportId: string; reason: string;
      previousSeverity: string; severity: string; oldTargetMinutes: number | null;
      newTargetMinutes: number | null; oldDueAt: string | null; newDueAt: string | null;
      changedAt: string } }>(
      "SELECT actor_id,detail FROM audit WHERE action='REPORT_SEVERITY_CHANGED' ORDER BY created_at,id");
    assert.equal(audits.rows.length, 2);
    assert.ok(audits.rows.every(row => row.actor_id === 'operator:severity-safety' && row.detail.reportId === report.id));
    assert.deepEqual(audits.rows.map(row => [row.detail.previousSeverity, row.detail.severity]),
      [['NORMAL', 'HIGH'], ['HIGH', 'NORMAL']]);
    assert.deepEqual(audits.rows.map(row => [row.detail.oldTargetMinutes, row.detail.newTargetMinutes]),
      [[120, 5], [5, 5]]);
    assert.equal(new Date(audits.rows[0]!.detail.newDueAt!).getTime(), new Date(first.rows[0]!.due_at).getTime());
    assert.equal(audits.rows[1]!.detail.oldDueAt, audits.rows[1]!.detail.newDueAt);
    assert.ok(audits.rows.every(row => Number.isFinite(Date.parse(row.detail.changedAt))));
    assert.doesNotMatch(JSON.stringify(audits.rows), /逐单改级时不能泄漏正文/);
    const noPolicyApp = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'test-secret',
      operatorAccounts: [safety, reviewer] });
    noPolicyApp.listen(0, '127.0.0.1'); await once(noPolicyApp, 'listening');
    try {
      const noPolicyBase = `http://127.0.0.1:${(noPolicyApp.address() as { port: number }).port}`;
      const denied = await fetch(noPolicyBase + classifyPath, { method: 'POST', headers: {
        Authorization: `Bearer ${safetyToken}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'missing-policy'
      }, body: JSON.stringify({ severity: 'HIGH', expectedSeverity: 'NORMAL',
        reason: '缺少正式目标配置时不得重新承诺响应期限' }) });
      assert.equal(denied.status, 409);
      const unchanged = await db.query<{ severity: string; first_response_target_minutes: number }>(
        'SELECT severity,first_response_target_minutes FROM reports WHERE id=$1', [report.id]);
      assert.equal(unchanged.rows[0]?.severity, 'NORMAL');
      assert.equal(unchanged.rows[0]?.first_response_target_minutes, 5);
    } finally { await new Promise<void>(resolve => noPolicyApp.close(() => resolve())); }
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('an overdue HIGH case cannot be downgraded or removed from first-response alerts', async () => {
  const db = await createDatabase();
  const safety = createOperatorEnrollment('overdue-safety', 'overdue operator password');
  const app = createApp(db, { environment: 'production', devAuth: false, checkInSecret: 'test-secret',
    operatorAccounts: [{ ...safety, permissions: ['SAFETY'] }], reportResponsePolicy: responsePolicy });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  try {
    const report = await createReport(db, 'reporter', { kind: 'SAFETY', description: '逾期高危工单不得通过降级抹除' },
      'overdue-high-case', responsePolicy);
    await db.query(`UPDATE reports SET created_at=clock_timestamp()-interval '10 minutes',
      first_response_due_at=clock_timestamp()-interval '5 minutes' WHERE id=$1`, [report.id]);
    const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
    const login = await fetch(base + '/ops/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: safety.username,
        password: 'overdue operator password', code: totpCode(safety.totpSecret) }) });
    assert.equal(login.status, 200);
    const token = (await login.json() as { token: string }).token;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const before = await fetch(base + '/ops/reports/response-alerts?offset=0', { headers });
    assert.equal(before.status, 200);
    assert.ok((await before.json() as { items: Array<{ id: string }> }).items.some(item => item.id === report.id));
    const downgrade = await fetch(base + `/ops/reports/${report.id}/severity`, { method: 'POST',
      headers: { ...headers, 'Idempotency-Key': 'overdue-downgrade' }, body: JSON.stringify({
        expectedSeverity: 'HIGH', severity: 'NORMAL', reason: '即使有人工理由也不能抹除逾期高危工单' }) });
    assert.equal(downgrade.status, 409);
    const unchanged = await db.query<{ severity: string; first_response_target_minutes: number;
      first_response_due_at: Date }>('SELECT severity,first_response_target_minutes,first_response_due_at FROM reports WHERE id=$1',
      [report.id]);
    assert.equal(unchanged.rows[0]?.severity, 'HIGH');
    assert.equal(unchanged.rows[0]?.first_response_target_minutes, 5);
    assert.ok(new Date(unchanged.rows[0]!.first_response_due_at).getTime() < Date.now());
    const after = await fetch(base + '/ops/reports/response-alerts?offset=0', { headers });
    assert.equal(after.status, 200);
    assert.ok((await after.json() as { items: Array<{ id: string }> }).items.some(item => item.id === report.id));
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('a HIGH downgrade is checked again at the final write after crossing its response deadline', async () => {
  const db = await createDatabase();
  try {
    const report = await createReport(db, 'reporter', { kind: 'SAFETY',
      description: '锁定时尚未逾期而最终写入时已逾期' }, 'deadline-crossing-case', responsePolicy);
    await db.query(`UPDATE reports SET first_response_due_at=clock_timestamp()+interval '2 seconds'
      WHERE id=$1`, [report.id]);
    let pausedAtWrite = false;
    const pausedDb: Database = { ...db, transaction: fn => db.transaction(tx => fn({
      query: async <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => {
        if (sql.startsWith('UPDATE reports SET severity=')) {
          pausedAtWrite = true;
          await new Promise(resolve => setTimeout(resolve, 2200));
        }
        return tx.query<T>(sql, params);
      }
    })) };
    await assert.rejects(() => classifyReportSeverity(pausedDb, 'operator:safety', report.id,
      'NORMAL', 'HIGH', '锁定后等待跨过首次响应目标时间', 'deadline-crossing-classify', responsePolicy),
    { code: 'OVERDUE_REVIEW_REQUIRED' });
    assert.equal(pausedAtWrite, true);
    const row = await db.query<{ severity: string; first_response_due_at: Date }>(
      'SELECT severity,first_response_due_at FROM reports WHERE id=$1', [report.id]);
    assert.equal(row.rows[0]?.severity, 'HIGH');
    assert.ok(new Date(row.rows[0]!.first_response_due_at).getTime() < Date.now());
  } finally { await db.close(); }
});

test('a responded HIGH report may be reclassified while preserving its original response deadline', async () => {
  const db = await createDatabase();
  try {
    const report = await createReport(db, 'reporter', { kind: 'SAFETY',
      description: '已有首响的高危报告仍可复核改级' }, 'responded-high-case', responsePolicy);
    await db.query(`UPDATE reports SET created_at=clock_timestamp()-interval '10 minutes',
      first_response_due_at=clock_timestamp()-interval '5 minutes' WHERE id=$1`, [report.id]);
    await assignReport(db, 'operator:safety', report.id, 'operator:reviewer',
      '首响前分配给独立具名处理人员', 'responded-high-assign');
    await changeReportStatus(db, 'operator:reviewer', report.id, 'IN_REVIEW', undefined,
      'responded-high-first');
    const before = await db.query<{ first_response_due_at: Date; first_responded_at: Date }>(
      'SELECT first_response_due_at,first_responded_at FROM reports WHERE id=$1', [report.id]);
    await classifyReportSeverity(db, 'operator:safety', report.id, 'NORMAL', 'HIGH',
      '首响后由安全运营复核为普通级别', 'responded-high-classify', responsePolicy);
    const after = await db.query<{ severity: string; first_response_due_at: Date; first_responded_at: Date }>(
      'SELECT severity,first_response_due_at,first_responded_at FROM reports WHERE id=$1', [report.id]);
    assert.equal(after.rows[0]?.severity, 'NORMAL');
    assert.equal(new Date(after.rows[0]!.first_response_due_at).getTime(),
      new Date(before.rows[0]!.first_response_due_at).getTime());
    assert.equal(new Date(after.rows[0]!.first_responded_at).getTime(),
      new Date(before.rows[0]!.first_responded_at).getTime());
  } finally { await db.close(); }
});
