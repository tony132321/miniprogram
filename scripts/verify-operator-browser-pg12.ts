import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createDatabase } from '../src/db.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { createAppeal, createPrivacyRequest, createReport } from '../src/operations.ts';
import { createContent } from '../src/collaboration.ts';
import { createOperatorEnrollment, OPERATOR_PERMISSIONS, totpCode } from '../src/operator-auth.ts';
import { createApp } from '../src/server.ts';
import { runDueJobs } from '../src/jobs.ts';
import { openSyntheticPublicCoverage } from '../test/helpers/public-coverage.ts';
import { register } from '../test/helpers.ts';

// Local browser evidence only. The caller supplies a Playwright Core installation and Chrome.
const playwrightModule = process.env.PLAYWRIGHT_CORE_MODULE;
const chromeExecutable = process.env.CHROME_EXECUTABLE;
if (!playwrightModule || !chromeExecutable)
  throw new Error('Set PLAYWRIGHT_CORE_MODULE and CHROME_EXECUTABLE to local absolute paths');
const { chromium } = await import(pathToFileURL(playwrightModule).href);
const screenshotDirectory = new URL('../docs/evidence/screenshots/pg12-current-browser-2026-09-29/', import.meta.url);
await mkdir(screenshotDirectory, { recursive: true });

const now = Date.now();
const iso = (offset: number) => new Date(now + offset).toISOString();
const minutes = 60_000;
const input = {
  title: 'PG12 合成羽毛球活动', type: 'badminton', startAt: iso(2 * 24 * 60 * minutes),
  endAt: iso(2 * 24 * 60 * minutes + 2 * 60 * minutes), timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '合成测试球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: iso(24 * 60 * minutes + 60 * minutes),
  confirmationDeadline: iso(24 * 60 * minutes), feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
} as const;

const db = await createDatabase();
const leadPassword = randomBytes(24).toString('hex');
const dutyPassword = randomBytes(24).toString('hex');
const handlerPassword = randomBytes(24).toString('hex');
const lead = { ...createOperatorEnrollment('lead', leadPassword), permissions: [...OPERATOR_PERMISSIONS] };
const duty = { ...createOperatorEnrollment('duty', dutyPassword), permissions: ['SAFETY'] };
const handler = { ...createOperatorEnrollment('handler', handlerPassword), permissions: ['REPORTS'] };
let browser: any;
let server: ReturnType<typeof createApp> | undefined;
try {
  await db.query("INSERT INTO users(id,wechat_openid) VALUES('host','pg12-browser-host-openid')");
  await db.query("INSERT INTO users(id,wechat_openid) VALUES('member','pg12-browser-member-openid')");
  const draft = await createDraft(db, 'host', input, 'pg12-browser-draft');
  const event = await publishEvent(db, 'host', draft.id, draft.version, 'pg12-browser-publish');
  assert.equal(event.reviewStatus, 'PENDING');
  const report = await createReport(db, 'reporter', {
    eventId: event.id, kind: 'SAFETY', description: 'PG12 合成安全举报，需逐单核查场地'
  }, 'pg12-browser-report');
  const fallbackCoverage = await openSyntheticPublicCoverage(db);
  server = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'],
    operatorAccounts: [lead, duty, handler], checkInSecret: 'pg12-browser-secret',
    reportResponsePolicy: { defaultSeverityByKind: { SAFETY: 'HIGH', CONTENT: 'NORMAL',
      ATTENDANCE: 'NORMAL', OTHER: 'NORMAL' }, targetMinutesBySeverity: { HIGH: 5, NORMAL: 60 } } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server did not bind');
  const base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ executablePath: chromeExecutable, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC' });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error: Error) => pageErrors.push(error.message));
  const waitText = async (selector: string, part: string) => {
    try {
      await page.waitForFunction(([id, value]: [string, string]) =>
        document.querySelector(id)?.textContent?.includes(value), [selector, part]);
    } catch {
      throw new Error(`Expected ${selector} to contain ${JSON.stringify(part)}; observed ${JSON.stringify(await page.locator(selector).innerText())}`);
    }
  };
  const count = (selector: string) => page.locator(selector).count();
  const waitCount = (selector: string, expected: number) =>
    page.waitForFunction(([id, value]: [string, number]) => document.querySelectorAll(id).length === value,
      [selector, expected]);
  const login = async (username: string, password: string, secret: string) => {
    const previousToken = await page.evaluate(() => sessionStorage.getItem('operatorToken'));
    const { rows: uses } = await db.query<{ last_counter: number }>(
      'SELECT last_counter FROM operator_otp_uses WHERE operator_id=$1', [`operator:${username}`]);
    const counter = Math.max(Math.floor(Date.now() / 30_000), Number(uses[0]?.last_counter ?? -1) + 1);
    while (counter > Math.floor(Date.now() / 30_000) + 1)
      await new Promise(resolve => setTimeout(resolve, 1000));
    await page.locator('#operatorUser').fill(username);
    await page.locator('#operatorPassword').fill(password);
    await page.locator('#operatorCode').fill(totpCode(secret, counter * 30_000));
    await page.locator('#operatorLogin').click();
    await page.waitForFunction((prior: string | null) => {
      const token = sessionStorage.getItem('operatorToken');
      return Boolean(token && token !== prior && !document.querySelector<HTMLInputElement>('#operatorUser')?.value);
    }, previousToken);
    await page.waitForFunction(() => !document.querySelector('#status')?.textContent?.includes('读取中'));
  };
  await page.goto(`${base}/ops`);
  await page.locator('#devUser').fill('ops');
  await page.locator('#refresh').click();
  await waitText('#status', '活动待审 1');
  assert.equal(await count('#eventReviews li'), 1);
  assert.equal(await count('#reports li'), 1);
  assert.match(await page.locator('#reports').innerText(), /PG12 合成安全举报/);
  await page.screenshot({ path: fileURLToPath(new URL('ops-pending.png', screenshotDirectory)), fullPage: true });

  await page.locator('#loadReportResponseAlerts').click();
  await waitCount('#reportResponseAlerts li', 1);
  assert.equal(await count('#reportResponseAlerts li'), 1);
  await page.locator('#loadReportTriage').click();
  await waitCount('#reportTriage li', 1);
  assert.equal(await count('#reportTriage li'), 1);
  await page.locator('#reportTriage li button').click();
  assert.equal(await page.locator('#reportCaseId').inputValue(), report.id);
  await page.locator('#reportScopeReason').fill('浏览器合成核查，逐单查看并分派');
  await page.locator('#inspectReport').click();
  await waitText('#reportInspection', 'PG12 合成安全举报');
  await page.locator('#reportSeverity').selectOption('HIGH');
  await page.locator('#classifyReportSeverity').click();
  await waitText('#status', '工单严重度已更新');
  assert.equal((await db.query<{ severity: string }>('SELECT severity FROM reports WHERE id=$1', [report.id])).rows[0]?.severity, 'HIGH');
  await page.locator('#loadReportTriage').click();
  await waitCount('#reportTriage li', 1);
  await page.locator('#reportTriage li button').click();
  await page.locator('#reportScopeReason').fill('浏览器合成核查，分派具名处理人员');
  await page.locator('#reportAssignee').fill('handler');
  await page.locator('#assignReport').click();
  await waitText('#status', '工单已分配给 handler');
  assert.equal((await db.query<{ assignee_id: string }>('SELECT assignee_id FROM report_assignments WHERE report_id=$1', [report.id])).rows[0]?.assignee_id,
    'operator:handler');

  const reviewRow = page.locator('#eventReviews li').first();
  await reviewRow.locator('input').fill('已核对合成活动基本事实');
  await reviewRow.getByRole('button', { name: '通过' }).click();
  await waitText('#status', '活动待审 0');
  assert.equal((await db.query<{ review_status: string }>('SELECT review_status FROM events WHERE id=$1', [event.id])).rows[0]?.review_status,
    'APPROVED');
  await register(db, 'member', event.id, event.version, 'pg12-browser-join');
  const approvedQuestion = await createContent(db, 'member', event.id, 'QUESTION', 'PG12 合成问题：几点集合？', null,
    'pg12-browser-question-approved');
  const rejectedQuestion = await createContent(db, 'member', event.id, 'QUESTION', 'PG12 合成问题：需要带球拍吗？', null,
    'pg12-browser-question-rejected');
  await page.locator('#refresh').click();
  await waitText('#status', '待审核内容 2');
  const approvedRow = page.locator('#content li').filter({ hasText: approvedQuestion.id });
  await approvedRow.getByRole('button', { name: '通过' }).click();
  await waitCount('#content li', 1);
  const rejectedRow = page.locator('#content li').filter({ hasText: rejectedQuestion.id });
  await rejectedRow.locator('input').fill('合成问题需要补充具体场地信息');
  await rejectedRow.getByRole('button', { name: '驳回' }).click();
  await waitCount('#content li', 0);
  assert.deepEqual((await db.query<{ id: string; status: string }>(
    'SELECT id,status FROM activity_content WHERE id IN ($1,$2) ORDER BY id', [approvedQuestion.id, rejectedQuestion.id])).rows
    .map(row => [row.id, row.status]).sort(),
    [[approvedQuestion.id, 'APPROVED'], [rejectedQuestion.id, 'REJECTED']].sort());
  const appeal = await createAppeal(db, 'member', { contentId: rejectedQuestion.id,
    description: '请由另一位运营复核该合成问题' }, 'pg12-browser-content-appeal');
  await page.locator('#refresh').click();
  await waitText('#status', '申诉 1');
  assert.equal(await count('#appeals li'), 1);
  await page.locator('#appeals li input').fill('原审核人员不能复核自己的结论');
  await page.locator('#appeals li').getByRole('button', { name: '维持驳回' }).click();
  await waitText('#status', '原内容审核人员须回避复核');
  assert.equal((await db.query<{ status: string }>('SELECT status FROM appeals WHERE id=$1', [appeal.id])).rows[0]?.status,
    'OPEN');
  await page.locator('#holdEventId').fill(event.id);
  await page.locator('#holdReason').fill('合成安全线索待人工核对');
  await page.locator('#placeHold').click();
  await page.waitForFunction(() => document.querySelectorAll('#holds li').length === 1);
  assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM event_safety_holds WHERE event_id=$1 AND status='ACTIVE'", [event.id])).rows[0]?.n, 1);
  await page.locator('#holds li input').fill('合成核查完成并解除暂停');
  await page.locator('#holds li button').click();
  await page.waitForFunction(() => document.querySelector('#holds')?.textContent?.includes('RELEASED'));
  assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM event_safety_holds WHERE event_id=$1 AND status='ACTIVE'", [event.id])).rows[0]?.n, 0);

  await page.locator('#recordSupportMinutes').click();
  await waitText('#status', '请填写活动 ID');
  await page.locator('#supportEventId').fill(event.id);
  await page.locator('#supportMinutes').fill('0');
  await page.locator('#recordSupportMinutes').click();
  await page.waitForFunction(() => document.querySelector('#supportMinutesHistory')?.textContent?.includes('0 分钟'));
  assert.equal((await db.query<{ minutes: number }>('SELECT minutes FROM support_minutes WHERE event_id=$1', [event.id])).rows[0]?.minutes, 0);
  await page.locator('#hostReviewUserId').fill('host');
  await page.locator('#hostReviewReason').fill('合成资料核验记录');
  await page.locator('#submitHostReview').click();
  await waitText('#hostReviewResult', '仅安全运营人员可审核主办方级别');
  await page.locator('#moreAiEventCosts').click();
  assert.equal(await count('#aiEventCosts li'), 0);
  assert.equal(await page.locator('#moreAiEventCosts').isDisabled(), true);

  await page.locator('#publicGateReason').fill('本地浏览器验收关闭公开招募');
  await page.locator('#closePublicGate').click();
  await waitText('#publicGate', '关闭');
  await page.locator('#coverageId').fill(fallbackCoverage.id);
  await page.locator('#publicGateReason').fill('本地浏览器验收恢复公开招募');
  await page.locator('#openPublicGate').click();
  await waitText('#publicGate', '开放');
  await page.locator('#emergencyReason').fill('本地浏览器验收暂停新增');
  await page.locator('#closeEmergencyGate').click();
  await waitText('#emergencyGate', '关闭');
  await page.locator('#emergencyReason').fill('本地浏览器验收恢复新增');
  await page.locator('#openEmergencyGate').click();
  await waitText('#emergencyGate', '开放');

  await page.locator('#operatorUser').fill('lead');
  await page.locator('#operatorPassword').fill('wrong password');
  await page.locator('#operatorCode').fill(totpCode(lead.totpSecret));
  await page.locator('#operatorLogin').click();
  await waitText('#status', '账号或验证码错误');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('operatorToken')), null);
  await login('lead', leadPassword, lead.totpSecret);
  assert.equal(await page.locator('#reportInspection').innerText(), '');
  assert.equal(await page.locator('#devUser').inputValue(), '');
  await page.locator('#appeals li input').fill('独立复核后撤销原内容驳回');
  await page.locator('#appeals li').getByRole('button', { name: '撤销驳回并公开' }).click();
  await waitText('#appeals', 'RESOLVED');
  assert.equal((await db.query<{ status: string; outcome: string }>(
    'SELECT status,outcome FROM appeals WHERE id=$1', [appeal.id])).rows[0]?.outcome, 'OVERTURN');
  assert.equal((await db.query<{ status: string }>('SELECT status FROM activity_content WHERE id=$1', [rejectedQuestion.id])).rows[0]?.status,
    'APPROVED');
  await page.locator('#hostReviewUserId').fill('host');
  await page.locator('#hostReviewReason').fill('合成资料核验记录');
  await page.locator('#submitHostReview').click();
  await waitText('#hostReviewResult', '已记录 host');

  await page.locator('#coverageStartsAt').fill(iso(-10 * minutes).slice(0, 16));
  await page.locator('#coverageEndsAt').fill(iso(2 * 60 * minutes).slice(0, 16));
  await page.locator('#coverageDrillCompletedAt').fill(iso(-60 * minutes).slice(0, 16));
  await page.locator('#coverageDrillReference').fill('pg12-browser-synthetic-drill');
  await page.locator('#createPublicCoverage').click();
  await waitText('#coverageResult', '等待另一名安全运营复核');
  const browserCoverageId = await page.locator('#coverageId').inputValue();
  await page.locator('#coverageReason').fill('同一人员不能复核值守');
  await page.locator('#confirmPublicCoverage').click();
  await waitText('#coverageResult', '另一位安全运营');
  await login('duty', dutyPassword, duty.totpSecret);
  assert.equal(await page.locator('#coverageResult').innerText(), '');
  assert.equal(await page.locator('#metrics').innerText(), '无权限查看');
  await page.locator('#coverageId').fill(browserCoverageId);
  await page.locator('#coverageReason').fill('另一位值守运营已核对合成记录');
  await page.locator('#confirmPublicCoverage').click();
  await waitText('#coverageResult', '已由 operator:duty 复核');
  assert.equal((await db.query<{ confirmed_by: string }>('SELECT confirmed_by FROM public_recruitment_coverage WHERE id=$1', [browserCoverageId])).rows[0]?.confirmed_by,
    'operator:duty');
  await login('lead', leadPassword, lead.totpSecret);
  await page.locator('#coverageId').fill(browserCoverageId);
  await page.locator('#coverageReason').fill('合成值守记录验收后撤销');
  await page.locator('#revokePublicCoverage').click();
  await waitText('#coverageResult', '已撤销');
  assert.equal((await db.query<{ revoked_by: string }>('SELECT revoked_by FROM public_recruitment_coverage WHERE id=$1', [browserCoverageId])).rows[0]?.revoked_by,
    'operator:lead');
  await runDueJobs(db);
  await page.locator('#refresh').click();
  await page.waitForFunction(() => document.querySelectorAll('#notificationFollowups li').length > 0);
  const firstFollowup = page.locator('#notificationFollowups li').first();
  await firstFollowup.locator('input').fill('已核对本地合成通知的不可用状态');
  await firstFollowup.getByRole('button', { name: '记录人工跟进' }).click();
  await waitText('#notificationHistory', '已核对本地合成通知的不可用状态');
  assert.ok((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM notification_followups WHERE recorded_by='operator:lead'")).rows[0]!.n >= 1);
  const failedJobId = 'pg12-browser-failed-job';
  await db.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload,status,attempts,last_error_code)
    VALUES($1,'FORMATION_DEADLINE',$2,now(),$3,'FAILED',5,'SYNTHETIC_FAILURE')`,
  [failedJobId, event.id, JSON.stringify({ version: event.version })]);
  await page.locator('#refresh').click();
  await waitCount('#failedJobs li', 1);
  await page.locator('#failedJobs li').getByRole('button', { name: '重新排队' }).click();
  await waitCount('#failedJobs li', 0);
  assert.equal((await db.query<{ status: string }>('SELECT status FROM jobs WHERE id=$1', [failedJobId])).rows[0]?.status,
    'PENDING');
  const deletionRequest = await createPrivacyRequest(db, 'member', { kind: 'DELETE' }, 'pg12-browser-delete-request');
  await page.locator('#refresh').click();
  await waitCount('#privacy li', 1);
  await page.locator('#privacy li').getByRole('button', { name: '核查记录类别' }).click();
  await waitText('#privacy', '待政策复核；已识别部分类别');
  assert.equal((await db.query<{ kind: string; status: string }>('SELECT kind,status FROM privacy_requests WHERE id=$1',
    [deletionRequest.id])).rows[0]?.kind, 'DELETE');

  const secondDraft = await createDraft(db, 'host', { ...input, title: 'PG12 第二场待审活动' }, 'pg12-browser-second-draft');
  await publishEvent(db, 'host', secondDraft.id, secondDraft.version, 'pg12-browser-second-publish');
  assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM events WHERE review_status='PENDING'")).rows[0]?.n, 1);

  await login('handler', handlerPassword, handler.totpSecret);
  assert.equal(await page.locator('#coverageResult').innerText(), '');
  assert.equal(await page.locator('#metrics').innerText(), '无权限查看');
  assert.equal(await count('#eventReviews li'), 0);
  assert.equal(await count('#reports li'), 1);
  assert.match(await page.locator('#status').innerText(), /\/ops\/events\/reviews/);
  assert.equal(await page.locator('#closeEmergencyGate').isDisabled(), true);
  await page.locator('#holdEventId').fill(event.id);
  await page.locator('#holdReason').fill('越权尝试暂停测试活动');
  await page.locator('#placeHold').click();
  await waitText('#status', '无运营权限');
  assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM event_safety_holds WHERE event_id=$1 AND status='ACTIVE'", [event.id])).rows[0]?.n, 0);
  await page.screenshot({ path: fileURLToPath(new URL('handler-permissions.png', screenshotDirectory)), fullPage: true });
  await page.locator('#reports li').getByRole('button', { name: '标记处理中' }).click();
  await waitText('#reports', 'IN_REVIEW');
  await page.locator('#reports li input').fill('已通知举报人并核查合成场地记录');
  await page.locator('#reports li').getByRole('button', { name: '结案并通知举报人' }).click();
  await waitText('#reports', 'RESOLVED');
  assert.equal((await db.query<{ status: string }>('SELECT status FROM reports WHERE id=$1', [report.id])).rows[0]?.status, 'RESOLVED');
  await page.locator('#operatorLogout').click();
  await waitText('#status', '已退出登录');
  assert.equal(await count('#reports li'), 0);
  assert.equal(await count('#supportMinutesHistory li'), 0);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('operatorToken')), null);

  await page.locator('#devUser').fill('guest');
  await page.locator('#refresh').click();
  await waitText('#status', '无权限');
  assert.equal(await count('#reports li'), 0);
  assert.equal(await count('#eventReviews li'), 0);
  assert.equal(await page.locator('#closeEmergencyGate').isDisabled(), true);
  await page.locator('#devUser').fill('ops');
  await page.route('**/ops/metrics', (route: any) => route.abort('failed'));
  await page.locator('#refresh').click();
  await waitText('#status', '网络连接失败，请检查网络后点击刷新');
  assert.equal(await page.locator('#metrics').innerText(), '读取失败，可点击刷新重试');
  await page.unroute('**/ops/metrics');
  await page.locator('#refresh').click();
  await waitText('#status', '举报 1');
  assert.doesNotMatch(await page.locator('#metrics').innerText(), /读取失败|无权限/);
  await page.screenshot({ path: fileURLToPath(new URL('network-recovered.png', screenshotDirectory)), fullPage: true });
  assert.deepEqual(pageErrors, []);
  const { rows: actions } = await db.query<{ action: string }>(`SELECT action FROM audit WHERE actor_id IN ('ops','operator:lead','operator:duty','operator:handler')
    AND action IN ('EVENT_REVIEW','REPORT_SAFETY_INSPECT','REPORT_ASSIGNED','REPORT_SEVERITY_CHANGED',
      'MODERATE_APPROVED','MODERATE_REJECTED','CONTENT_REVIEW_OVERTURN','APPEAL_STATUS',
      'RETRY_JOB','SAFETY_HOLD_PLACE','SAFETY_HOLD_RELEASE','PUBLIC_RECRUITMENT_CLOSED','PUBLIC_RECRUITMENT_OPEN',
      'EMERGENCY_CLOSED','EMERGENCY_OPEN','RECORD_SUPPORT_MINUTES')`);
  const auditActions = actions.map(row => row.action);
  for (const action of ['EVENT_REVIEW', 'REPORT_SAFETY_INSPECT', 'REPORT_ASSIGNED', 'REPORT_SEVERITY_CHANGED',
    'MODERATE_APPROVED', 'MODERATE_REJECTED', 'CONTENT_REVIEW_OVERTURN', 'APPEAL_STATUS',
    'RETRY_JOB', 'SAFETY_HOLD_PLACE', 'SAFETY_HOLD_RELEASE', 'PUBLIC_RECRUITMENT_CLOSED', 'PUBLIC_RECRUITMENT_OPEN',
    'EMERGENCY_CLOSED', 'EMERGENCY_OPEN', 'RECORD_SUPPORT_MINUTES'])
    assert.ok(auditActions.includes(action), `missing audit action ${action}`);
  console.log(JSON.stringify({ passed: true, eventId: event.id, reportId: report.id, browserCoverageId,
    auditActions: [...new Set(auditActions)].sort(), pageErrors }));
} finally {
  if (browser) await browser.close();
  if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
  await db.close();
}
