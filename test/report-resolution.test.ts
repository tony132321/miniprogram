import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';

test('reporter alone sees a reviewable resolution and one durable in-app notice', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops', 'reviewer'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const call = async (path: string, actor: string, method = 'GET', body?: unknown, key = 'case-key') => {
    const response = await fetch(base + path, { method, headers: { 'X-Dev-User': actor,
      ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': key } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    const created = await call('/reports', 'reporter', 'POST', { kind: 'SAFETY', description: '现场存在安全问题' }, 'new-report');
    assert.equal(created.status, 201);
    const id = created.body.id as string;
    assert.deepEqual((await call('/me/reports', 'other')).body.items, []);
    assert.equal((await call('/appeals', 'reporter', 'POST', { reportId: id, description: '请复核' }, 'premature')).status, 409);
    assert.equal((await call(`/ops/reports/${id}/status`, 'reporter', 'POST',
      { status: 'RESOLVED', resolution: '违规操作已停止并核查' }, 'unauthorized')).status, 403);
    assert.equal((await call(`/ops/reports/${id}/status`, 'ops', 'POST',
      { status: 'RESOLVED', resolution: '短' }, 'bad-resolution')).status, 400);
    const resolved = await call(`/ops/reports/${id}/status`, 'ops', 'POST',
      { status: 'RESOLVED', resolution: '已核查活动情况并完成可逆安全处置' }, 'resolve');
    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.status, 'RESOLVED');
    assert.equal((await call(`/ops/reports/${id}/status`, 'ops', 'POST',
      { status: 'RESOLVED', resolution: '已核查活动情况并完成可逆安全处置' }, 'resolve')).body.id, id);
    assert.equal((await call(`/ops/reports/${id}/status`, 'ops', 'POST',
      { status: 'IN_REVIEW' }, 'reopen')).status, 409);
    const mine = await call('/me/reports', 'reporter');
    assert.equal(mine.body.items.length, 1);
    assert.equal(mine.body.items[0].resolution, '已核查活动情况并完成可逆安全处置');
    assert.deepEqual((await call('/me/reports', 'other')).body.items, []);
    const notices = await call('/me/notifications', 'reporter');
    assert.equal(notices.body.items.filter((item: Record<string, unknown>) => item.kind === 'REPORT_RESOLVED').length, 1);
    const resolutionNotice = notices.body.items.find((item: Record<string, unknown>) => item.kind === 'REPORT_RESOLVED');
    assert.equal(resolutionNotice.event_id, null);
    assert.equal(resolutionNotice.external_status, 'UNAVAILABLE');
    assert.equal((await call(`/me/notifications/${resolutionNotice.id}/open`, 'other', 'POST', {}, 'wrong-reader')).status, 403);
    assert.equal((await call(`/me/notifications/${resolutionNotice.id}/open`, 'reporter', 'POST', {}, 'read-result')).body.status, 'OPENED');
    assert.equal((await call('/privacy/export', 'reporter')).body.reports[0].resolution, '已核查活动情况并完成可逆安全处置');
    assert.equal((await call('/me/notifications', 'other')).body.items.length, 0);
    const appeal = await call('/appeals', 'reporter', 'POST', { reportId: id, description: '请复核结论' }, 'appeal');
    assert.equal(appeal.status, 201);
    const appealId = appeal.body.id as string;
    const opsAppeal = (await call('/ops/appeals', 'reviewer')).body.items.find((item: Record<string, unknown>) => item.id === appealId);
    assert.equal(opsAppeal.report_description, '现场存在安全问题');
    assert.equal(opsAppeal.report_resolution, '已核查活动情况并完成可逆安全处置');
    assert.equal((await call(`/ops/appeals/${appealId}/status`, 'ops', 'POST',
      { status: 'RESOLVED', resolution: '已独立核查并维持原结论' }, 'same-reviewer')).status, 409);
    assert.equal((await call(`/ops/appeals/${appealId}/status`, 'reviewer', 'POST',
      { status: 'IN_REVIEW' }, 'start-independent-review')).body.status, 'IN_REVIEW');
    assert.equal((await call(`/ops/appeals/${appealId}/status`, 'reviewer', 'POST',
      { status: 'IN_REVIEW' }, 'duplicate-review-state')).status, 409);
    assert.equal((await call('/me/notifications', 'reporter')).body.items.filter((item: Record<string, unknown>) => item.kind === 'APPEAL_IN_REVIEW').length, 1);
    const reviewed = await call(`/ops/appeals/${appealId}/status`, 'reviewer', 'POST',
      { status: 'RESOLVED', resolution: '已由另一名人员独立核查' }, 'independent-review');
    assert.equal(reviewed.status, 200);
    assert.equal((await call(`/ops/appeals/${appealId}/status`, 'reviewer', 'POST',
      { status: 'RESOLVED', resolution: '已由另一名人员独立核查' }, 'independent-review')).body.id, appealId);
    const appealNotices = (await call('/me/notifications', 'reporter')).body.items.filter((item: Record<string, unknown>) => item.kind === 'APPEAL_RESOLVED');
    assert.equal(appealNotices.length, 1);
    assert.equal(appealNotices[0].event_id, null);
    assert.equal(appealNotices[0].external_status, 'UNAVAILABLE');
    assert.equal((await call(`/me/notifications/${appealNotices[0].id}/open`, 'reporter', 'POST', {}, 'appeal-notice-read')).body.status, 'OPENED');
    assert.equal((await call('/me/notifications', 'other')).body.items.length, 0);
    await db.query(`INSERT INTO reports(id,reporter_id,kind,description,status,resolution)
      VALUES('legacy-unknown','reporter','SAFETY','历史工单','RESOLVED','历史结案说明')`);
    const legacyAppeal = await call('/appeals', 'reporter', 'POST',
      { reportId: 'legacy-unknown', description: '请复核历史结论' }, 'legacy-appeal');
    assert.equal(legacyAppeal.status, 201);
    assert.equal((await call(`/ops/appeals/${legacyAppeal.body.id}/status`, 'reviewer', 'POST',
      { status: 'RESOLVED', resolution: '历史来源已复核' }, 'legacy-review')).status, 409);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
