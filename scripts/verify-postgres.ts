import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION, type Database, type Queryable } from '../src/db.ts';
import { createDraft, getEvent, publishEvent as submitEventForReview } from '../src/events.ts';
import { changeEvent, confirmEvent, listExpenses } from '../src/lifecycle.ts';
import { reviewEvent } from '../src/event-review.ts';
import { acceptOffer, cancelRegistration, claimReservation, expireOffers, expireReservations, expressInterest, register, reserveSeats } from '../src/registrations.ts';
import { getPublicGate, revokePublicCoverage, setPublicGate } from '../src/public-gate.ts';
import { getEmergencyGate, setEmergencyGate } from '../src/emergency-gate.ts';
import { runDueJobs } from '../src/jobs.ts';
import { dispatchNotification, enqueueStartReminder, setConsent } from '../src/notifications.ts';
import { eventAliasNotice, listEventAliases, setEventAlias } from '../src/event-aliases.ts';
import { listNotificationFollowups, listNotificationFollowupHistory, recordNotificationFollowup } from '../src/notification-followups.ts';
import { listFailedJobs, retryFailedJob } from '../src/job-recovery.ts';
import { exportPersonalData } from '../src/privacy.ts';
import { getPilotMetrics } from '../src/metrics.ts';
import { askCurrentFact, createContent, moderateContent, listContent } from '../src/collaboration.ts';
import { createPrivacyRequest, listPrivacyRequests, createReport, listReports, listMyReports, changeReportStatus, classifyReportSeverity,
  createAppeal, changeAppealStatus } from '../src/operations.ts';
import { recordSupportMinutes } from '../src/support-minutes.ts';
import { hashOperatorPassword, loginOperator, logoutOperator, operatorFromBearer, totpCode } from '../src/operator-auth.ts';
import { actorFromBearer, loginWithWechat, logoutMember } from '../src/auth.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';
import { openSyntheticPublicCoverage } from '../test/helpers/public-coverage.ts';

async function publishEvent(db: Database, hostId: string, eventId: string, version: number, key: string) {
  const submitted = await submitEventForReview(db, hostId, eventId, version, key);
  if (submitted.payload.visibility !== 'INVITE') return submitted;
  await reviewEvent(db, 'operator:pg_reviewer', submitted.id, submitted.version,
    'APPROVED', '已人工核查邀请活动发布文本', `${key}-review`);
  return getEvent(db, hostId, submitted.id);
}

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const databaseName = validatePostgresTestUrl(url);

const probe = new pg.Pool({ connectionString: url, max: 1 });
try {
  await assertEmptyPostgresTestDatabase(probe, databaseName);
} finally { await probe.end(); }

let first: Database | undefined;
let second: Database | undefined;
try {
  [first, second] = await Promise.all([createProductionDatabase(url), createProductionDatabase(url)]);
  const { rows: migrations } = await first.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
  assert.deepEqual(migrations.map(row => row.version), Array.from({ length: LATEST_SCHEMA_VERSION }, (_, index) => index + 1));

  const start = Date.now() + 7 * 24 * 60 * 60_000;
  const input = {
    title: '独立 PostgreSQL 并发验收', type: 'badminton', startAt: new Date(start).toISOString(),
    endAt: new Date(start + 2 * 60 * 60_000).toISOString(), timeZone: 'Asia/Shanghai', city: '深圳',
    venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
    registrationDeadline: new Date(start - 60 * 60_000).toISOString(),
    confirmationDeadline: new Date(start - 2 * 60 * 60_000).toISOString(), feeMode: 'FREE', feeCapFen: 0,
    cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
  };
  const draft = await createDraft(first, 'pg_host', input, 'postgres-draft');
  const event = await publishEvent(first, 'pg_host', draft.id, draft.version, 'postgres-publish');
  await first.query("INSERT INTO users(id,wechat_openid) VALUES('pg_privacy_member','pg-privacy-openid')");
  const privacyDraft = await createDraft(first, 'pg_privacy_member', input, 'pg-privacy-event');
  const privacyEvent = await publishEvent(first, 'pg_privacy_member', privacyDraft.id, privacyDraft.version, 'pg-privacy-publish');
  await setConsent(first, 'pg_privacy_member', 'EVENT_REMINDER', true, 'pg-privacy-reminder-grant');
  await setConsent(first, 'pg_privacy_member', 'SIMILAR_ACTIVITY_INVITES', true, 'pg-privacy-repeat-grant');
  await setEventAlias(first, 'pg_privacy_member', privacyEvent.id, '待撤销活动昵称', true, 'pg-privacy-alias',
    eventAliasNotice(privacyEvent.id).version);
  assert.equal((await listEventAliases(second, 'pg_privacy_member', privacyEvent.id))[0]?.displayName, '待撤销活动昵称');
  await first.query("UPDATE events SET status='CONFIRMED' WHERE id=$1", [privacyEvent.id]);
  await enqueueStartReminder(first, privacyEvent.id, 'pg_privacy_member', privacyEvent.version);
  const { rows: privacyNotices } = await first.query<{ id: string }>(
    "SELECT id FROM notifications WHERE event_id=$1 AND user_id='pg_privacy_member' AND kind='EVENT_REMINDER'",
    [privacyEvent.id]);
  const privacyNoticeId = privacyNotices[0]!.id;
  let signalSend!: () => void;
  let releaseSend!: () => void;
  const sendEntered = new Promise<void>(resolve => { signalSend = resolve; });
  const sendRelease = new Promise<void>(resolve => { releaseSend = resolve; });
  let privacyProviderCalls = 0;
  const sending = dispatchNotification(first, privacyNoticeId, { send: async () => {
    privacyProviderCalls++;
    signalSend();
    await sendRelease;
    return { status: 'ACCEPTED', providerRef: 'pg-privacy-before-delete-ref' };
  } });
  await Promise.race([sendEntered, sending.then(() => { throw new Error('privacy provider was not entered'); })]);
  const deleting = createPrivacyRequest(second, 'pg_privacy_member', { kind: 'DELETE' }, 'pg-privacy-delete');
  try {
    const beforeRelease = await Promise.race([deleting.then(() => 'finished', () => 'failed'),
      new Promise<string>(resolve => setTimeout(() => resolve('waiting'), 150))]);
    assert.equal(beforeRelease, 'waiting', 'DELETE must wait for the final external send holding the user row');
  } finally { releaseSend(); }
  await sending;
  const privacyReceipt = await deleting;
  assert.equal(privacyReceipt.status, 'PROTECTED_PENDING_POLICY');
  assert.equal(privacyReceipt.protection?.state, 'APPLIED');
  assert.equal(privacyReceipt.protection?.consentWithdrawals, 2);
  assert.equal(privacyReceipt.protection?.aliasesRemoved, 1);
  assert.deepEqual((await listPrivacyRequests(first, 'pg_privacy_member')).find(row => row.id === privacyReceipt.id), privacyReceipt);
  assert.deepEqual((await first.query<{ purpose: string; granted: boolean }>(`SELECT purpose,granted FROM notification_consents
    WHERE user_id='pg_privacy_member' ORDER BY purpose`)).rows,
  [{ purpose: 'EVENT_REMINDER', granted: false }, { purpose: 'SIMILAR_ACTIVITY_INVITES', granted: false }]);
  assert.deepEqual(await listEventAliases(first, 'pg_privacy_member', privacyEvent.id), []);
  assert.equal((await first.query<{ external_status: string }>(
    'SELECT external_status FROM notifications WHERE id=$1', [privacyNoticeId])).rows[0]?.external_status,
  'PROVIDER_ACCEPTED');
  assert.deepEqual(await createPrivacyRequest(first, 'pg_privacy_member', { kind: 'DELETE' }, 'pg-privacy-delete-repeat'),
    privacyReceipt);
  assert.deepEqual(await createPrivacyRequest(second, 'pg_privacy_member', { kind: 'DELETE' }, 'pg-privacy-delete'),
    privacyReceipt);
  assert.equal((await second.query<{ n: number }>(`SELECT count(*)::int AS n FROM notification_consent_history
    WHERE user_id='pg_privacy_member' AND source='DELETE_REQUEST'`)).rows[0]?.n, 2);
  assert.equal((await second.query<{ n: number }>(`SELECT count(*)::int AS n FROM event_alias_consent_history
    WHERE user_id='pg_privacy_member' AND source='DELETE_REQUEST'`)).rows[0]?.n, 1);
  assert.equal((await second.query<{ n: number }>(`SELECT count(*)::int AS n FROM audit
    WHERE actor_id='pg_privacy_member' AND action='PRIVACY_DELETE_PROTECTED'`)).rows[0]?.n, 1);
  await assert.rejects(() => setConsent(first!, 'pg_privacy_member', 'EVENT_REMINDER', true,
    'pg-privacy-reminder-regrant'), { code: 'DELETE_REQUEST_PENDING' });
  await assert.rejects(() => setEventAlias(second!, 'pg_privacy_member', privacyEvent.id, '新昵称', true,
    'pg-privacy-alias-regrant', eventAliasNotice(privacyEvent.id).version), { code: 'DELETE_REQUEST_PENDING' });
  await second.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version)
    VALUES('pg-privacy-after-delete',$1,'pg_privacy_member','EVENT_CANCELLED',$2)`,
  [privacyEvent.id, privacyEvent.version]);
  await dispatchNotification(first, 'pg-privacy-after-delete', { send: async () => {
    privacyProviderCalls++;
    return { status: 'ACCEPTED', providerRef: 'unexpected-after-delete' };
  } });
  assert.equal(privacyProviderCalls, 1);
  assert.equal((await second.query<{ external_status: string }>(
    "SELECT external_status FROM notifications WHERE id='pg-privacy-after-delete'")).rows[0]?.external_status,
  'DELETE_REQUEST_PENDING');
  await setConsent(first, 'pg_p1', 'EVENT_REMINDER', true, 'postgres-consent-p1');
  await register(first, 'pg_p1', event.id, event.version, 'postgres-p1', event.inviteToken!);
  await register(second, 'pg_p2', event.id, event.version, 'postgres-p2', event.inviteToken!);
  assert.deepEqual(await listExpenses(second, 'pg_p1', event.id), []);
  await assert.rejects(() => listExpenses(first!, 'pg_expense_outsider', event.id), { code: 'FORBIDDEN' });
  const p1Export = await exportPersonalData(second, 'pg_p1');
  assert.equal(p1Export.registrations.length, 1);
  assert.equal(p1Export.auditActions.some(item => item.action === 'REGISTER_CONFIRMED'), true);
  assert.equal(p1Export.businessEvents.some(item => item.event_name === 'REGISTER_CONFIRMED'), true);
  assert.equal(JSON.stringify(p1Export).includes('pg_p2'), false);
  assert.equal((await exportPersonalData(first, 'pg_host')).hostedEventVersions.length, 1);
  await runDueJobs(second);
  const failedNotice = (await listNotificationFollowups(first)).items.find(item => item.userId === 'pg_p1');
  assert.equal(failedNotice?.externalStatus, 'PURPOSE_NOT_CONFIGURED');
  await recordNotificationFollowup(second, 'operator:pg_reviewer', failedNotice!.notificationId,
    '本机双连接池人工跟进记录验证', 'postgres-followup');
  assert.equal((await listNotificationFollowups(first)).items.some(item => item.notificationId === failedNotice!.notificationId), false);
  const history = await listNotificationFollowupHistory(first);
  assert.equal(history[0]?.notificationId, failedNotice!.notificationId);
  assert.equal(history[0]?.note, '本机双连接池人工跟进记录验证');
  const { rows: unchangedNotice } = await first.query<{ external_status: string }>('SELECT external_status FROM notifications WHERE id=$1', [failedNotice!.notificationId]);
  assert.equal(unchangedNotice[0]?.external_status, 'PURPOSE_NOT_CONFIGURED');
  const contenders = await Promise.all(Array.from({ length: 100 }, (_, index) =>
    register(index % 2 === 0 ? first! : second!, `pg_r${index}`, event.id, event.version,
      `postgres-contender-${index}`, event.inviteToken!)));
  assert.equal(contenders.filter(row => row.status === 'CONFIRMED').length, 1);
  assert.equal(contenders.filter(row => row.status === 'WAITLISTED').length, 99);
  assert.equal((await register(first, 'pg_r0', event.id, event.version, 'postgres-contender-0', event.inviteToken!)).id,
    contenders[0]!.id);
  const { rows: counts } = await first.query<{ confirmed: number; waitlisted: number }>(`SELECT
    count(*) FILTER (WHERE status='CONFIRMED')::int AS confirmed,
    count(*) FILTER (WHERE status='WAITLISTED')::int AS waitlisted FROM registrations WHERE event_id=$1`, [event.id]);
  assert.equal(counts[0]?.confirmed, 4);
  assert.equal(counts[0]?.waitlisted, 99);
  const { rows: audit } = await first.query<{ total: number }>('SELECT count(*)::int AS total FROM audit WHERE event_id=$1', [event.id]);
  const { rows: business } = await second.query<{ event_name: string; user_id_pseudonymous: string | null; source: string; is_test: boolean }>(
    'SELECT event_name,user_id_pseudonymous,source,is_test FROM business_events WHERE activity_id=$1', [event.id]);
  assert.equal(business.filter(row => row.event_name === 'ACTIVITY_PUBLISHED').length, 1);
  assert.equal(business.filter(row => row.event_name === 'INVITE_REVIEW_SUBMITTED').length, 1);
  assert.equal(business.filter(row => row.event_name === 'REGISTER_CONFIRMED').length, 4);
  assert.equal(business.filter(row => row.event_name === 'REGISTER_WAITLISTED').length, 99);
  assert.equal(business.every(row => row.is_test && /^[a-f0-9]{64}$/.test(row.user_id_pseudonymous ?? '')), true);
  assert.equal(business.filter(row => row.source === 'OPS').length, 1);
  assert.equal(business.find(row => row.event_name === 'ACTIVITY_PUBLISHED')?.source, 'OPS');
  const operator = { username: 'pg_reviewer', passwordHash: hashOperatorPassword('temporary verification password', 'c'.repeat(64)),
    totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' };
  const at = Date.now();
  const code = totpCode(operator.totpSecret, at);
  const logins = await Promise.allSettled([loginOperator(first, operator, operator.username, 'temporary verification password', code, at),
    loginOperator(second, operator, operator.username, 'temporary verification password', code, at)]);
  assert.equal(logins.filter(result => result.status === 'fulfilled').length, 1);
  const token = (logins.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<{ token: string }>).value.token;
  assert.equal(await operatorFromBearer(second, `Bearer ${token}`, operator), 'operator:pg_reviewer');
  await logoutOperator(first, `Bearer ${token}`);
  await assert.rejects(operatorFromBearer(second, `Bearer ${token}`, operator));
  const memberSession = await loginWithWechat(first, async code => code === 'pg-member-logout-code'
    ? { openid: 'pg-member-logout-openid' } : null, 'pg-member-logout-code');
  assert.equal(await actorFromBearer(second, `Bearer ${memberSession.token}`), memberSession.userId);
  await logoutMember(second, `Bearer ${memberSession.token}`);
  await assert.rejects(() => actorFromBearer(first!, `Bearer ${memberSession.token}`), { code: 'UNAUTHENTICATED' });
  const secondOperator = { username: 'pg_safety', passwordHash: hashOperatorPassword('another temporary password', 'd'.repeat(64)),
    totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' };
  const secondLogin = await loginOperator(second, secondOperator, secondOperator.username, 'another temporary password',
    totpCode(secondOperator.totpSecret, at), at);
  assert.equal(await operatorFromBearer(first, `Bearer ${secondLogin.token}`, [operator, secondOperator]), 'operator:pg_safety');
  await assert.rejects(operatorFromBearer(first, `Bearer ${secondLogin.token}`, [operator]));
  const coverage = await openSyntheticPublicCoverage(first, [input]);
  const publicDraft = await createDraft(first, 'pg_public_host', { ...input, visibility: 'PUBLIC', approvalMode: 'MANUAL' }, 'public-gate-draft');
  const publicEvent = await publishEvent(first, 'pg_public_host', publicDraft.id, publicDraft.version, 'public-gate-publish');
  await reviewEvent(second, 'operator:pg_reviewer', publicEvent.id, publicEvent.version, 'APPROVED', '已核查活动事实与场地', 'public-gate-approve');
  await setPublicGate(first, 'operator:pg_safety', 'CLOSED', '暂停公开活动招募核查', 'public-gate-close');
  assert.equal((await getPublicGate(second)).status, 'CLOSED');
  assert.equal((await second.query("SELECT id FROM jobs WHERE kind='PUBLIC_GATE_NOTICE' AND payload->>'status'='CLOSED'")).rows.length, 1);
  for (let i = 0; i < 3; i++) await runDueJobs(second);
  assert.equal((await first.query("SELECT id FROM notifications WHERE kind='PUBLIC_RECRUITMENT_CLOSED' AND user_id='pg_public_host'")).rows.length, 1);
  await assert.rejects(() => register(second!, 'pg_public_p1', publicEvent.id, publicEvent.version, 'public-gate-blocked', null),
    { code: 'PUBLIC_RECRUITMENT_PAUSED' });
  await setPublicGate(second, 'operator:pg_safety', 'OPEN', '核查完成允许继续招募', 'public-gate-open', coverage.id);
  assert.equal((await register(first, 'pg_public_p1', publicEvent.id, publicEvent.version, 'public-gate-joined', null)).status, 'REQUESTED');
  const blocker = new pg.Client({ connectionString: url });
  await blocker.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query('INSERT INTO idempotency(actor_id,route,key,result) VALUES($1,$2,$3,$4)',
      ['operator:pg_safety', 'public-recruitment-gate', 'race-open', '{}']);
    const opening = setPublicGate(second, 'operator:pg_safety', 'OPEN', '并发核查结束允许恢复', 'race-open', coverage.id);
    const early = await Promise.race([opening.then(() => 'finished', () => 'failed'),
      new Promise<string>(resolve => setTimeout(() => resolve('waiting'), 100))]);
    assert.equal(early, 'waiting');
    const closed = await setPublicGate(first, 'operator:pg_safety', 'CLOSED', '并发安全事件暂停招募', 'race-close');
    await blocker.query('ROLLBACK');
    const opened = await opening;
    assert.equal(closed.status, 'CLOSED');
    assert.equal(opened.status, 'OPEN');
    const { rows: ordered } = await first.query<{ ordered: boolean }>(`SELECT
      max(created_at) FILTER (WHERE payload->>'status'='CLOSED') <
        max(created_at) FILTER (WHERE payload->>'status'='OPEN') AS ordered
      FROM jobs WHERE kind='PUBLIC_GATE_NOTICE'`);
    assert.equal(ordered[0]?.ordered, true);
    const { rows: transitions } = await first.query<{ status: string }>(
      "SELECT payload->>'status' AS status FROM jobs WHERE kind='PUBLIC_GATE_NOTICE' ORDER BY created_at DESC,id DESC LIMIT 4");
    assert.deepEqual(transitions.map(row => row.status).reverse(), ['CLOSED', 'CLOSED', 'OPEN', 'OPEN']);
    const { rows: auditOrder } = await first.query<{ action: string; exact: boolean }>(`SELECT a.action,
      a.created_at=(SELECT max(j.created_at) FROM jobs j WHERE j.kind='PUBLIC_GATE_NOTICE'
        AND j.payload->>'status'=substring(a.action from 20)) AS exact
      FROM audit a WHERE a.action LIKE 'PUBLIC_RECRUITMENT_%'
      ORDER BY a.created_at DESC,a.id DESC LIMIT 2`);
    assert.deepEqual(auditOrder.map(row => row.action).reverse(), ['PUBLIC_RECRUITMENT_CLOSED', 'PUBLIC_RECRUITMENT_OPEN']);
    assert.equal(auditOrder.every(row => row.exact), true);
  } finally {
    await blocker.query('ROLLBACK').catch(() => undefined);
    await blocker.end();
  }
  let changedDuringExport = false;
  const watchedQuery = async <T extends Record<string, unknown>>(source: Queryable, sql: string, params?: unknown[]) => {
    const result = await source.query<T>(sql, params);
    if (!changedDuringExport && sql.includes('FROM events WHERE host_id=$1')) {
      changedDuringExport = true;
      await second!.transaction(async tx => {
        await tx.query('UPDATE events SET version=version+1 WHERE id=$1', [event.id]);
        await tx.query('INSERT INTO event_versions(event_id,version,payload) SELECT id,version,payload FROM events WHERE id=$1', [event.id]);
      });
    }
    return result;
  };
  const watchedDb: Database = {
    query: (sql, params) => watchedQuery(first!, sql, params),
    transaction: fn => first!.transaction(tx => fn({ query: (sql, params) => watchedQuery(tx, sql, params) })),
    close: () => Promise.resolve()
  };
  const snapshot = await exportPersonalData(watchedDb, 'pg_host');
  assert.equal(changedDuringExport, true);
  assert.equal(snapshot.hostedEvents[0]?.version, Math.max(...snapshot.hostedEventVersions.map(row => Number(row.version))));
  const metricDraft = await createDraft(first, 'pg_metric_host', input, 'postgres-metric-draft', false);
  const metricEvent = await publishEvent(first, 'pg_metric_host', metricDraft.id, metricDraft.version, 'postgres-metric-publish');
  for (const [index, userId] of ['pg_metric_p1', 'pg_metric_p2', 'pg_metric_p3'].entries())
    await register(first, userId, metricEvent.id, metricEvent.version, `postgres-metric-registration-${index}`, metricEvent.inviteToken!);
  await first.query("UPDATE events SET status='COMPLETED' WHERE id=$1", [metricEvent.id]);
  for (const userId of ['pg_metric_host', 'pg_metric_p1', 'pg_metric_p2', 'pg_metric_p3'])
    await first.query("INSERT INTO checkins(id,event_id,user_id,evidence,checked_at) VALUES($1,$2,$3,'SCAN',$4)",
      [`${metricEvent.id}-${userId}`, metricEvent.id, userId, new Date(start + 60 * 60_000).toISOString()]);
  await first.query('INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at) VALUES($1,true,4,$2,$3)',
    [metricEvent.id, 'pg_metric_host', new Date(start + 2 * 60 * 60_000).toISOString()]);
  await first.query('INSERT INTO outcome_feedback(event_id,user_id,held,would_repeat,created_at) VALUES($1,$2,true,true,$3)',
    [metricEvent.id, 'pg_metric_p1', new Date(start + 2 * 60 * 60_000 + 60_000).toISOString()]);
  await first.query(`INSERT INTO audit(id,actor_id,event_id,action,created_at)
    SELECT 'pg-metric-confirm-audit','pg_metric_host',$1,'CONFIRM_EVENT',reviewed_at+interval '30 minutes'
    FROM event_review_decisions WHERE event_id=$1 AND event_version=2`, [metricEvent.id]);
  await recordSupportMinutes(first, 'operator:pg_metrics', metricEvent.id, 18, 'SUPPORT', 'postgres-metric-support');
  const { rows: metricRegistrations } = await first.query<{ id: string }>(
    "SELECT id FROM registrations WHERE event_id=$1 AND user_id='pg_metric_p1'", [metricEvent.id]);
  await first.query(`INSERT INTO offers(id,event_id,registration_id,expires_at,status)
    VALUES('pg-metric-accepted-offer',$1,$2,$3,'ACCEPTED')`,
  [metricEvent.id, metricRegistrations[0]!.id, new Date(start + 90 * 60_000).toISOString()]);
  const ongoingStart = start + 2 * 60 * 60_000;
  const ongoingDraft = await createDraft(first, 'pg_metric_host', {
    ...input, startAt: new Date(ongoingStart).toISOString(), endAt: new Date(ongoingStart + 2 * 60 * 60_000).toISOString(),
    registrationDeadline: new Date(ongoingStart - 60 * 60_000).toISOString(),
    confirmationDeadline: new Date(ongoingStart - 90 * 60_000).toISOString()
  }, 'postgres-ongoing-metric-draft', false);
  await publishEvent(first, 'pg_metric_host', ongoingDraft.id, ongoingDraft.version, 'postgres-ongoing-metric-publish');
  const metricReport = await getPilotMetrics(second, start + 3 * 60 * 60_000,
    ['pg_metric_host', 'pg_metric_p1', 'pg_metric_p2', 'pg_metric_p3']);
  assert.equal(metricReport.weeks.reduce((total, week) => total + week.qualified, 0), 1);
  assert.deepEqual(metricReport.dueEventCompletion,
    { dueEvents: 1, evidenceQualified: 1, pendingReview: 0, unqualified: 0,
      evidenceQualifiedRate: 1, possibleRateAfterReview: 1, minimumSampleMet: false, threshold70Met: null });
  assert.deepEqual(metricReport.participantReturn30d,
    { observedParticipants: 4, maturedParticipants: 0, returnedParticipants: 0,
      pendingFirstParticipants: 0, pendingReturnParticipants: 0, rate: null, possibleRateAfterReview: null,
      minimumSampleMet: false, threshold25Met: null });
  assert.deepEqual(metricReport.directSupportMinutes,
    { status: 'PARTIAL', dueEvents: 1, eventsWithEntries: 1, entries: 1, recordedMinutes: 18 });
  assert.deepEqual(metricReport.waitlistOfferConversion,
    { issued: 1, accepted: 1, expired: 0, cancelled: 0, active: 0, unclassified: 0,
      matured: 1, acceptanceRate: 1 });
  assert.deepEqual(metricReport.formationTime, { formedEvents: 1, medianMinutes: 30 });
  assert.equal(metricReport.contributionProfit.status, 'UNAVAILABLE');
  const metricPublicDraft = await createDraft(first, 'pg_public_metric_host',
    { ...input, visibility: 'PUBLIC', approvalMode: 'MANUAL' }, 'postgres-public-metric-draft', false);
  const publicPending = await publishEvent(first, 'pg_public_metric_host', metricPublicDraft.id, metricPublicDraft.version,
    'postgres-public-metric-submit');
  const publicCutoff = start + 3 * 60 * 60_000;
  const syntheticPublishAt = new Date(publicCutoff - 29 * 24 * 60 * 60_000).toISOString();
  await first.query('UPDATE event_versions SET created_at=$2 WHERE event_id=$1', [publicPending.id, syntheticPublishAt]);
  assert.equal((await getPilotMetrics(second, publicCutoff, ['pg_public_metric_host'])).hostReuse28d.maturedHosts, 0);
  await reviewEvent(first, 'operator:pg_reviewer', publicPending.id, publicPending.version, 'APPROVED',
    '场地与活动资料已核实', 'postgres-public-metric-review');
  assert.equal((await getPilotMetrics(second, publicCutoff, ['pg_public_metric_host'])).hostReuse28d.maturedHosts, 0);
  await first.query('UPDATE event_review_decisions SET reviewed_at=$2 WHERE event_id=$1',
    [publicPending.id, syntheticPublishAt]);
  assert.equal((await getPilotMetrics(second, publicCutoff, ['pg_public_metric_host'])).hostReuse28d.maturedHosts, 1);
  await first.query(`INSERT INTO reports(id,reporter_id,kind,description,status,created_at) VALUES
    ('pg-queue-resolved','pg_public_p1','OTHER','已结案','RESOLVED',clock_timestamp()),
    ('pg-queue-safety','pg_public_p1','SAFETY','安全待核查','OPEN',clock_timestamp()-interval '1 day')`);
  const reportPage = await listReports(second, 'pg_case_operator');
  assert.equal(reportPage.items[0]?.id, 'pg-queue-safety');
  assert.equal(reportPage.total, 2);
  assert.equal((await listReports(second, 'pg_case_operator', 1, reportPage.snapshot)).items[0]?.id, 'pg-queue-resolved');
  await first.query("INSERT INTO reports(id,reporter_id,kind,description) VALUES('pg-queue-new','pg_public_p1','SAFETY','新安全举报')");
  await assert.rejects(() => listReports(second!, 'pg_case_operator', 1, reportPage.snapshot), { code: 'QUEUE_CHANGED' });
  assert.equal((await listReports(second, 'pg_case_operator')).items.some(item => item.id === 'pg-queue-new'), true);
  const caseReport = await createReport(first, 'pg_case_reporter', { kind: 'SAFETY', description: '独立连接池举报验证' }, 'pg-case-create');
  await changeReportStatus(second, 'pg_case_operator', caseReport.id, 'RESOLVED', '已由独立连接池核查并结案', 'pg-case-resolve');
  assert.equal((await listMyReports(first, 'pg_case_reporter'))[0]?.resolution, '已由独立连接池核查并结案');
  assert.equal((await first.query("SELECT id FROM notifications WHERE user_id='pg_case_reporter' AND kind='REPORT_RESOLVED' AND event_id IS NULL")).rows.length, 1);
  const responsePolicy = { defaultSeverityByKind: { SAFETY: 'HIGH' as const, CONTENT: 'NORMAL' as const,
    ATTENDANCE: 'NORMAL' as const, OTHER: 'NORMAL' as const },
  targetMinutesBySeverity: { HIGH: 5, NORMAL: 120 } };
  const lockedReport = await createReport(first, 'pg_case_reporter',
    { kind: 'SAFETY', description: '行锁等待后跨过首次响应截止时间' }, 'pg-response-lock-case', responsePolicy);
  const reportBlocker = new pg.Client({ connectionString: url });
  await reportBlocker.connect();
  try {
    await reportBlocker.query('BEGIN');
    await reportBlocker.query(`UPDATE reports SET first_response_due_at=clock_timestamp()+interval '250 milliseconds'
      WHERE id=$1`, [lockedReport.id]);
    const downgrade = classifyReportSeverity(second, 'operator:pg_safety', lockedReport.id, 'NORMAL', 'HIGH',
      '等候行锁时跨过高严重度首响截止时间', 'pg-response-downgrade-lock', responsePolicy);
    const waiting = await Promise.race([downgrade.then(() => 'finished', () => 'failed'),
      new Promise<string>(resolve => setTimeout(() => resolve('waiting'), 450))]);
    assert.equal(waiting, 'waiting');
    await reportBlocker.query('COMMIT');
    await assert.rejects(downgrade, { code: 'OVERDUE_REVIEW_REQUIRED' });
    const { rows: protectedReport } = await first.query<{ severity: string; first_response_due_at: Date }>(
      'SELECT severity,first_response_due_at FROM reports WHERE id=$1', [lockedReport.id]);
    assert.equal(protectedReport[0]?.severity, 'HIGH');
    assert.ok(new Date(protectedReport[0]!.first_response_due_at).getTime() < Date.now());
  } finally {
    await reportBlocker.query('ROLLBACK');
    await reportBlocker.end();
  }
  const caseAppeal = await createAppeal(first, 'pg_case_reporter', { reportId: caseReport.id, description: '请独立复核' }, 'pg-case-appeal');
  await assert.rejects(() => changeAppealStatus(second!, 'pg_case_operator', caseAppeal.id, 'RESOLVED', '维持原结论', 'pg-case-self-review'), { code: 'INVALID_STATE' });
  await changeAppealStatus(second, 'pg_case_reviewer', caseAppeal.id, 'RESOLVED', '已由另一名人员复核并记录结论', 'pg-case-independent-review');
  assert.equal((await first.query("SELECT id FROM notifications WHERE user_id='pg_case_reporter' AND kind='APPEAL_RESOLVED' AND event_id IS NULL")).rows.length, 1);
  const question = await createContent(first, 'pg_p1', event.id, 'QUESTION', '现场要带球拍吗？', null, 'pg-content-question');
  await moderateContent(second, 'pg_content_moderator', question.id, 'REJECTED', 'pg-content-reject', '请核实提问与活动相关');
  const contentAppeal = await createAppeal(first, 'pg_p1', { contentId: question.id, description: '请独立复核这条问题' }, 'pg-content-appeal');
  await assert.rejects(() => changeAppealStatus(second!, 'pg_content_moderator', contentAppeal.id, 'RESOLVED',
    '维持原结论', 'pg-content-self-review', 'UPHOLD'), { code: 'INVALID_STATE' });
  await changeAppealStatus(second, 'pg_content_reviewer', contentAppeal.id, 'RESOLVED',
    '核查后同意公开', 'pg-content-overturn', 'OVERTURN');
  assert.equal((await listContent(first, 'pg_p2', event.id)).some(item => item.id === question.id && item.status === 'APPROVED'), true);
  assert.equal((await first.query("SELECT id FROM notifications WHERE user_id='pg_p1' AND kind='APPEAL_RESOLVED' AND event_id IS NULL")).rows.length, 1);
  const faqFact = await askCurrentFact(first, 'pg_p1', event.id, '现场有更衣室吗？', 'pg-faq-before-approval');
  const faq = await createContent(first, 'pg_host', event.id, 'ANNOUNCEMENT',
    '问：现场有更衣室吗？\n答：本场场地提供更衣室。', null, 'pg-faq-announcement');
  await moderateContent(second, 'pg_content_moderator', faq.id, 'APPROVED', 'pg-faq-approve');
  const faqAnswer = await askCurrentFact(second, 'pg_p1', event.id, '现场有更衣室吗？', 'pg-faq-after-approval');
  assert.equal(faqAnswer.source, 'APPROVED_ANNOUNCEMENT');
  assert.equal(faqAnswer.sourceContentId, faq.id);
  assert.equal((await first.query<{ status: string }>('SELECT status FROM activity_fact_todos WHERE id=$1', [faqFact.todoId])).rows[0]?.status,
    'RESOLVED');
  const raceFact = await askCurrentFact(first, 'pg_p1', event.id, '现场提供饮用水吗？', 'pg-race-fact');
  const { rows: raceTodo } = await first.query<{ question_content_id: string }>(
    'SELECT question_content_id FROM activity_fact_todos WHERE id=$1', [raceFact.todoId]);
  await moderateContent(first, 'pg_content_moderator', raceTodo[0]!.question_content_id, 'APPROVED', 'pg-race-question-approve');
  let signalChecked!: () => void;
  let releaseChecked!: () => void;
  const checked = new Promise<void>(resolve => { signalChecked = resolve; });
  const release = new Promise<void>(resolve => { releaseChecked = resolve; });
  const pausedDb: Database = {
    query: (sql, params) => first!.query(sql, params),
    transaction: fn => first!.transaction(tx => fn({ query: async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]) => {
      const result = await tx.query<T>(sql, params);
      if (sql.includes('LEFT JOIN activity_fact_todos t ON t.question_content_id=c.id')) {
        signalChecked(); await release;
      }
      return result;
    } })),
    close: async () => {}
  };
  const pendingAnswer = createContent(pausedDb, 'pg_host', event.id, 'ANSWER', '请向主办方确认饮水安排',
    raceTodo[0]!.question_content_id, 'pg-race-answer');
  await checked;
  const { rows: raceEvents } = await second.query<{ version: number }>('SELECT version FROM events WHERE id=$1', [event.id]);
  const pendingChange = changeEvent(second, 'pg_host', event.id, raceEvents[0]!.version,
    { title: '独立 PostgreSQL 并发验收（信息更新）' }, 'pg-race-version-change');
  try {
    let changeError: unknown;
    const outcome = await Promise.race([pendingChange.then(() => 'changed', error => { changeError = error; return 'failed'; }),
      new Promise<string>(resolve => setTimeout(() => resolve('blocked'), 100))]);
    if (outcome === 'failed') throw changeError;
    assert.equal(outcome, 'blocked', 'event version update must wait for the answer transaction');
  } finally { releaseChecked(); }
  await pendingAnswer;
  const changedAfterAnswer = await pendingChange;
  await reviewEvent(first, 'operator:pg_reviewer', event.id, changedAfterAnswer.version,
    'APPROVED', '已人工复核信息更新标题', 'pg-race-version-review');
  let signalFactChecked!: () => void;
  let releaseFactChecked!: () => void;
  const factChecked = new Promise<void>(resolve => { signalFactChecked = resolve; });
  const factRelease = new Promise<void>(resolve => { releaseFactChecked = resolve; });
  const pausedFactDb: Database = {
    query: (sql, params) => first!.query(sql, params),
    transaction: fn => first!.transaction(tx => fn({ query: async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]) => {
      const result = await tx.query<T>(sql, params);
      if (sql.includes('SELECT count(*)::int AS n FROM activity_fact_todos')) {
        signalFactChecked(); await factRelease;
      }
      return result;
    } })),
    close: async () => {}
  };
  const pendingFact = askCurrentFact(pausedFactDb, 'pg_p1', event.id, '活动提供毛巾吗？', 'pg-race-current-fact');
  await factChecked;
  const { rows: factRaceEvents } = await second.query<{ version: number }>('SELECT version FROM events WHERE id=$1', [event.id]);
  const pendingFactChange = changeEvent(second, 'pg_host', event.id, factRaceEvents[0]!.version,
    { title: '独立 PostgreSQL 并发验收（再次更新）' }, 'pg-race-fact-version-change');
  try {
    let factChangeError: unknown;
    const outcome = await Promise.race([pendingFactChange.then(() => 'changed', error => { factChangeError = error; return 'failed'; }),
      new Promise<string>(resolve => setTimeout(() => resolve('blocked'), 100))]);
    if (outcome === 'failed') throw factChangeError;
    assert.equal(outcome, 'blocked', 'event version update must wait for current-fact creation');
  } finally { releaseFactChecked(); }
  await pendingFact;
  const changedAfterFact = await pendingFactChange;
  await reviewEvent(first, 'operator:pg_reviewer', event.id, changedAfterFact.version,
    'APPROVED', '已人工复核再次更新标题', 'pg-race-fact-version-review');
  const appealRaceFact = await askCurrentFact(first, 'pg_p1', event.id, '报名需要带证件吗？', 'pg-appeal-race-fact');
  const { rows: appealRaceTodo } = await first.query<{ question_content_id: string }>(
    'SELECT question_content_id FROM activity_fact_todos WHERE id=$1', [appealRaceFact.todoId]);
  await moderateContent(first, 'pg_content_moderator', appealRaceTodo[0]!.question_content_id, 'REJECTED',
    'pg-appeal-race-reject', '请核实活动报名规则');
  const appealRace = await createAppeal(first, 'pg_p1', { contentId: appealRaceTodo[0]!.question_content_id,
    description: '请复核报名问题' }, 'pg-appeal-race-create');
  let signalAppealChecked!: () => void;
  let releaseAppealChecked!: () => void;
  const appealChecked = new Promise<void>(resolve => { signalAppealChecked = resolve; });
  const appealRelease = new Promise<void>(resolve => { releaseAppealChecked = resolve; });
  const pausedAppealDb: Database = {
    query: (sql, params) => first!.query(sql, params),
    transaction: fn => first!.transaction(tx => fn({ query: async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]) => {
      const result = await tx.query<T>(sql, params);
      if (sql.includes("UPDATE activity_fact_todos t SET status='OPEN'")) {
        signalAppealChecked(); await appealRelease;
      }
      return result;
    } })),
    close: async () => {}
  };
  const pendingAppeal = changeAppealStatus(pausedAppealDb, 'pg_content_reviewer', appealRace.id, 'RESOLVED',
    '复核后允许该问题公开', 'pg-appeal-race-overturn', 'OVERTURN');
  await appealChecked;
  const { rows: appealRaceEvents } = await second.query<{ version: number }>('SELECT version FROM events WHERE id=$1', [event.id]);
  const pendingAppealChange = changeEvent(second, 'pg_host', event.id, appealRaceEvents[0]!.version,
    { title: '独立 PostgreSQL 并发验收（复核后更新）' }, 'pg-appeal-race-version-change');
  try {
    let appealChangeError: unknown;
    const outcome = await Promise.race([pendingAppealChange.then(() => 'changed', error => { appealChangeError = error; return 'failed'; }),
      new Promise<string>(resolve => setTimeout(() => resolve('blocked'), 100))]);
    if (outcome === 'failed') throw appealChangeError;
    assert.equal(outcome, 'blocked', 'event version update must wait for content appeal reversal');
  } finally { releaseAppealChecked(); }
  await pendingAppeal;
  const changedAfterAppeal = await pendingAppealChange;
  await reviewEvent(first, 'operator:pg_reviewer', event.id, changedAfterAppeal.version,
    'APPROVED', '已人工复核申诉后标题', 'pg-appeal-race-version-review');
  const { rows: recoveryEvents } = await first.query<{ version: number }>('SELECT version FROM events WHERE id=$1', [event.id]);
  await first.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload,status,attempts,last_error_code)
    VALUES('pg-failed-recovery','PUBLIC_GATE_NOTICE',$1,now()-interval '1 minute',$2,'FAILED',5,'INTERNAL_ERROR')`,
    [event.id, JSON.stringify({ eventId: event.id, eventVersion: recoveryEvents[0]!.version, userId: 'pg_host', status: 'CLOSED' })]);
  assert.equal((await listFailedJobs(second)).items.some(item => item.id === 'pg-failed-recovery'), true);
  await retryFailedJob(first, 'operator:pg_job_operator', 'pg-failed-recovery', 'pg-job-retry');
  assert.equal((await second.query<{ status: string }>("SELECT status FROM jobs WHERE id='pg-failed-recovery'")).rows[0]?.status, 'PENDING');
  for (let batch = 0; batch < 5; batch++) {
    await runDueJobs(second);
    const status = (await first.query<{ status: string }>(
      "SELECT status FROM jobs WHERE id='pg-failed-recovery'")).rows[0]?.status;
    if (status === 'DONE') break;
  }
  assert.equal((await first.query<{ status: string }>("SELECT status FROM jobs WHERE id='pg-failed-recovery'")).rows[0]?.status, 'DONE');
  assert.equal((await first.query<{ id: string }>("SELECT id FROM notifications WHERE id='pg-failed-recovery'")).rows.length, 1);
  await first.query(`INSERT INTO jobs(id,kind,due_at,payload,attempts)
    VALUES('pg-stale-worker','UNRECOGNIZED',now()-interval '1 year','{}',3)`);
  let signalStaleWorker!: () => void;
  let releaseStaleWorker!: () => void;
  const staleWorkerPaused = new Promise<void>(resolve => { signalStaleWorker = resolve; });
  const staleWorkerRelease = new Promise<void>(resolve => { releaseStaleWorker = resolve; });
  const heldWorker: Database = {
    query: async (sql, params) => {
      if (sql.includes('UPDATE jobs SET status=CASE') && params?.[0] === 'pg-stale-worker') {
        signalStaleWorker(); await staleWorkerRelease;
      }
      return first!.query(sql, params);
    },
    transaction: fn => first!.transaction(fn),
    close: async () => {}
  };
  const staleRun = runDueJobs(heldWorker);
  await staleWorkerPaused;
  await second.query("UPDATE jobs SET locked_at=now()-interval '6 minutes' WHERE id='pg-stale-worker'");
  await runDueJobs(second);
  assert.equal((await first.query<{ status: string }>("SELECT status FROM jobs WHERE id='pg-stale-worker'")).rows[0]?.status, 'FAILED');
  await retryFailedJob(second, 'operator:pg_job_operator', 'pg-stale-worker', 'pg-stale-retry');
  releaseStaleWorker();
  assert.deepEqual(await staleRun, { processed: 0, failed: 0 });
  assert.deepEqual((await first.query<{ status: string; attempts: number; last_error_code: string | null }>(
    "SELECT status,attempts,last_error_code FROM jobs WHERE id='pg-stale-worker'")).rows,
  [{ status: 'PENDING', attempts: 0, last_error_code: null }]);
  const tieDraft = await createDraft(first, 'pg_tie_host', input, 'pg-tie-draft');
  const tieEvent = await publishEvent(first, 'pg_tie_host', tieDraft.id, tieDraft.version, 'pg-tie-publish');
  const tieP1 = await register(first, 'pg_tie_p1', tieEvent.id, tieEvent.version, 'pg-tie-p1', tieEvent.inviteToken!);
  await register(second, 'pg_tie_p2', tieEvent.id, tieEvent.version, 'pg-tie-p2', tieEvent.inviteToken!);
  await register(first, 'pg_tie_p3', tieEvent.id, tieEvent.version, 'pg-tie-p3', tieEvent.inviteToken!);
  const tieW1 = await register(first, 'pg_tie_w1', tieEvent.id, tieEvent.version, 'pg-tie-w1', tieEvent.inviteToken!);
  const tieW2 = await register(second, 'pg_tie_w2', tieEvent.id, tieEvent.version, 'pg-tie-w2', tieEvent.inviteToken!);
  const tieW3 = await register(first, 'pg_tie_w3', tieEvent.id, tieEvent.version, 'pg-tie-w3', tieEvent.inviteToken!);
  await first.query("UPDATE registrations SET id='pg-z-w1',created_at='2026-01-01T00:00:00Z' WHERE id=$1", [tieW1.id]);
  await first.query("UPDATE registrations SET id='pg-a-w2',created_at='2026-01-01T00:00:00Z' WHERE id=$1", [tieW2.id]);
  await cancelRegistration(second, 'pg_tie_p1', tieP1.id, tieEvent.version, 'pg-tie-release');
  const { rows: tieOffers } = await first.query<{ id: string; registration_id: string }>(
    "SELECT id,registration_id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [tieEvent.id]);
  assert.deepEqual(tieOffers.map(row => row.registration_id), ['pg-z-w1']);
  const actualNow = Date.now;
  try {
    Date.now = () => actualNow() + 60 * 60_000;
    assert.equal((await acceptOffer(second, 'pg_tie_w1', tieOffers[0]!.id, tieEvent.version, 'pg-clock-accept')).status, 'CONFIRMED');
  } finally { Date.now = actualNow; }
  const tieP2 = await first.query<{ id: string }>("SELECT id FROM registrations WHERE event_id=$1 AND user_id='pg_tie_p2'", [tieEvent.id]);
  await cancelRegistration(first, 'pg_tie_p2', tieP2.rows[0]!.id, tieEvent.version, 'pg-race-release');
  const { rows: raceOffers } = await second.query<{ id: string; registration_id: string }>(
    "SELECT id,registration_id FROM offers WHERE event_id=$1 AND status='ACTIVE'", [tieEvent.id]);
  assert.deepEqual(raceOffers.map(row => row.registration_id), ['pg-a-w2']);
  await first.query("UPDATE offers SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [raceOffers[0]!.id]);
  const [lateAcceptance, expiration] = await Promise.allSettled([
    acceptOffer(first, 'pg_tie_w2', raceOffers[0]!.id, tieEvent.version, 'pg-race-accept'), expireOffers(second)]);
  assert.equal(lateAcceptance.status, 'rejected');
  assert.equal((lateAcceptance as PromiseRejectedResult).reason?.code, 'OFFER_UNAVAILABLE');
  assert.equal(expiration.status, 'fulfilled');
  const { rows: afterOfferRace } = await first.query<{ user_id: string; status: string }>(
    `SELECT r.user_id,o.status FROM offers o JOIN registrations r ON r.id=o.registration_id
      WHERE o.event_id=$1 ORDER BY o.created_at,o.id`, [tieEvent.id]);
  assert.equal(afterOfferRace.filter(row => row.status === 'ACTIVE').length, 1);
  assert.equal(afterOfferRace.find(row => row.status === 'ACTIVE')?.user_id, 'pg_tie_w3');
  assert.equal(afterOfferRace.find(row => row.user_id === 'pg_tie_w2')?.status, 'EXPIRED');
  const { rows: finalOffer } = await first.query<{ id: string }>(`SELECT o.id FROM offers o
    JOIN registrations r ON r.id=o.registration_id WHERE o.event_id=$1 AND r.user_id='pg_tie_w3' AND o.status='ACTIVE'`, [tieEvent.id]);
  let offerCrossedAtWrite = false;
  const crossingOfferDb: Database = {
    ...first,
    transaction: fn => first!.transaction(tx => fn({ query: async (sql, params = []) => {
      if (!offerCrossedAtWrite && sql.startsWith("UPDATE offers SET status='ACCEPTED'")) {
        offerCrossedAtWrite = true;
        await tx.query("UPDATE offers SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [finalOffer[0]!.id]);
      }
      return tx.query(sql, params);
    } }))
  };
  await assert.rejects(() => acceptOffer(crossingOfferDb, 'pg_tie_w3', finalOffer[0]!.id, tieEvent.version,
    'pg-offer-write-expiry'), { code: 'OFFER_UNAVAILABLE' });
  assert.equal(offerCrossedAtWrite, true);
  assert.equal((await first.query<{ status: string }>('SELECT status FROM offers WHERE id=$1', [finalOffer[0]!.id])).rows[0]?.status,
    'ACTIVE');
  const reservationDraft = await createDraft(first, 'pg_reservation_host', input, 'pg-reservation-race-draft');
  const reservationEvent = await publishEvent(first, 'pg_reservation_host', reservationDraft.id, reservationDraft.version, 'pg-reservation-race-publish');
  const reservation = (await reserveSeats(first, 'pg_reservation_host', reservationEvent.id, reservationEvent.version, 1, 'pg-reservation-race-hold'))[0]!;
  await register(first, 'pg_reservation_p1', reservationEvent.id, reservationEvent.version, 'pg-reservation-race-p1', reservationEvent.inviteToken!);
  await register(second, 'pg_reservation_p2', reservationEvent.id, reservationEvent.version, 'pg-reservation-race-p2', reservationEvent.inviteToken!);
  const reservationWaiting = await register(first, 'pg_reservation_w1', reservationEvent.id, reservationEvent.version,
    'pg-reservation-race-w1', reservationEvent.inviteToken!);
  assert.equal(reservationWaiting.status, 'WAITLISTED');
  await first.query("UPDATE reservations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [reservation.id]);
  const [lateClaim, reservationExpiry] = await Promise.allSettled([
    claimReservation(first, 'pg_reservation_friend', reservation.token, reservationEvent.version, 'pg-reservation-race-claim', reservationEvent.id),
    expireReservations(second)]);
  assert.equal(lateClaim.status, 'rejected');
  assert.equal((lateClaim as PromiseRejectedResult).reason?.code, 'RESERVATION_UNAVAILABLE');
  assert.equal(reservationExpiry.status, 'fulfilled');
  const { rows: afterReservationRace } = await second.query<{ status: string; user_id: string }>(
    `SELECT o.status,r.user_id FROM offers o JOIN registrations r ON r.id=o.registration_id
      WHERE o.event_id=$1`, [reservationEvent.id]);
  assert.deepEqual(afterReservationRace, [{ status: 'ACTIVE', user_id: 'pg_reservation_w1' }]);
  const { rows: reservationState } = await first.query<{ claimed_by: string | null; released_at: Date | null }>(
    'SELECT claimed_by,released_at FROM reservations WHERE id=$1', [reservation.id]);
  assert.equal(reservationState[0]?.claimed_by, null);
  assert.ok(reservationState[0]?.released_at);
  const writeReservationDraft = await createDraft(first, 'pg_write_reservation_host', input, 'pg-write-reservation-draft');
  const writeReservationEvent = await publishEvent(first, 'pg_write_reservation_host', writeReservationDraft.id,
    writeReservationDraft.version, 'pg-write-reservation-publish');
  const writeReservation = (await reserveSeats(first, 'pg_write_reservation_host', writeReservationEvent.id,
    writeReservationEvent.version, 1, 'pg-write-reservation-hold'))[0]!;
  let reservationCrossedAtWrite = false;
  const crossingReservationDb: Database = {
    ...first,
    transaction: fn => first!.transaction(tx => fn({ query: async (sql, params = []) => {
      if (!reservationCrossedAtWrite && sql.startsWith('UPDATE reservations SET claimed_by=$2')) {
        reservationCrossedAtWrite = true;
        await tx.query("UPDATE reservations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [writeReservation.id]);
      }
      return tx.query(sql, params);
    } }))
  };
  await assert.rejects(() => claimReservation(crossingReservationDb, 'pg_write_reservation_friend',
    writeReservation.token, writeReservationEvent.version, 'pg-write-reservation-claim', writeReservationEvent.id),
  { code: 'RESERVATION_UNAVAILABLE' });
  assert.equal(reservationCrossedAtWrite, true);
  assert.equal((await first.query<{ claimed_by: string | null }>('SELECT claimed_by FROM reservations WHERE id=$1',
    [writeReservation.id])).rows[0]?.claimed_by, null);
  assert.equal((await first.query<{ n: number }>(`SELECT count(*)::int AS n FROM registrations
    WHERE event_id=$1 AND user_id='pg_write_reservation_friend'`, [writeReservationEvent.id])).rows[0]?.n, 0);
  const writeDeadlineDraft = await createDraft(first, 'pg_write_deadline_host', input, 'pg-write-deadline-draft');
  const writeDeadlineEvent = await publishEvent(first, 'pg_write_deadline_host', writeDeadlineDraft.id,
    writeDeadlineDraft.version, 'pg-write-deadline-publish');
  let insertCrossedAtWrite = false;
  const crossingInsertDb: Database = {
    ...first,
    transaction: fn => first!.transaction(tx => fn({ query: async (sql, params = []) => {
      if (!insertCrossedAtWrite && sql.startsWith('INSERT INTO registrations(id,event_id,user_id,status,accepted_version)')) {
        insertCrossedAtWrite = true;
        await tx.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb((clock_timestamp()-interval '1 second')::text),true) WHERE id=$1",
          [writeDeadlineEvent.id]);
      }
      return tx.query(sql, params);
    } }))
  };
  await assert.rejects(() => register(crossingInsertDb, 'pg_write_deadline_member', writeDeadlineEvent.id,
    writeDeadlineEvent.version, 'pg-write-deadline-insert', writeDeadlineEvent.inviteToken!),
  { code: 'REGISTRATION_CLOSED' });
  assert.equal(insertCrossedAtWrite, true);
  assert.equal((await second.query<{ n: number }>("SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND user_id='pg_write_deadline_member'",
    [writeDeadlineEvent.id])).rows[0]?.n, 0);
  const deadlineMember = await register(second, 'pg_write_deadline_member', writeDeadlineEvent.id,
    writeDeadlineEvent.version, 'pg-write-deadline-valid', writeDeadlineEvent.inviteToken!);
  await cancelRegistration(second, 'pg_write_deadline_member', deadlineMember.id, writeDeadlineEvent.version,
    'pg-write-deadline-cancel');
  let updateCrossedAtWrite = false;
  const crossingUpdateDb: Database = {
    ...first,
    transaction: fn => first!.transaction(tx => fn({ query: async (sql, params = []) => {
      if (!updateCrossedAtWrite && sql.startsWith('UPDATE registrations SET status=$2,accepted_version=$3')) {
        updateCrossedAtWrite = true;
        await tx.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb((clock_timestamp()-interval '1 second')::text),true) WHERE id=$1",
          [writeDeadlineEvent.id]);
      }
      return tx.query(sql, params);
    } }))
  };
  await assert.rejects(() => register(crossingUpdateDb, 'pg_write_deadline_member', writeDeadlineEvent.id,
    writeDeadlineEvent.version, 'pg-write-deadline-update', writeDeadlineEvent.inviteToken!),
  { code: 'REGISTRATION_CLOSED' });
  assert.equal(updateCrossedAtWrite, true);
  assert.equal((await second.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1',
    [deadlineMember.id])).rows[0]?.status, 'CANCELLED');
  let interestInsertCrossed = false;
  const crossingInterestInsertDb: Database = {
    ...first,
    transaction: fn => first!.transaction(tx => fn({ query: async (sql, params = []) => {
      if (!interestInsertCrossed && sql.startsWith('INSERT INTO registrations(id,event_id,user_id,status)')) {
        interestInsertCrossed = true;
        await tx.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb((clock_timestamp()-interval '1 second')::text),true) WHERE id=$1",
          [writeDeadlineEvent.id]);
      }
      return tx.query(sql, params);
    } }))
  };
  await assert.rejects(() => expressInterest(crossingInterestInsertDb, 'pg_interest_member', writeDeadlineEvent.id,
    writeDeadlineEvent.version, 'pg-interest-insert', writeDeadlineEvent.inviteToken!),
  { code: 'REGISTRATION_CLOSED' });
  assert.equal(interestInsertCrossed, true);
  assert.equal((await second.query<{ n: number }>("SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND user_id='pg_interest_member'",
    [writeDeadlineEvent.id])).rows[0]?.n, 0);
  const interested = await expressInterest(second, 'pg_interest_member', writeDeadlineEvent.id,
    writeDeadlineEvent.version, 'pg-interest-valid', writeDeadlineEvent.inviteToken!);
  await cancelRegistration(second, 'pg_interest_member', interested.id, writeDeadlineEvent.version, 'pg-interest-cancel');
  let interestUpdateCrossed = false;
  const crossingInterestUpdateDb: Database = {
    ...first,
    transaction: fn => first!.transaction(tx => fn({ query: async (sql, params = []) => {
      if (!interestUpdateCrossed && sql.startsWith("UPDATE registrations SET status='INTERESTED'")) {
        interestUpdateCrossed = true;
        await tx.query("UPDATE events SET payload=jsonb_set(payload,'{registrationDeadline}',to_jsonb((clock_timestamp()-interval '1 second')::text),true) WHERE id=$1",
          [writeDeadlineEvent.id]);
      }
      return tx.query(sql, params);
    } }))
  };
  await assert.rejects(() => expressInterest(crossingInterestUpdateDb, 'pg_interest_member', writeDeadlineEvent.id,
    writeDeadlineEvent.version, 'pg-interest-update', writeDeadlineEvent.inviteToken!),
  { code: 'REGISTRATION_CLOSED' });
  assert.equal(interestUpdateCrossed, true);
  assert.equal((await second.query<{ status: string }>('SELECT status FROM registrations WHERE id=$1',
    [interested.id])).rows[0]?.status, 'CANCELLED');
  let bulkReservationInserts = 0;
  const crossingBulkReservationDb: Database = {
    ...first,
    transaction: fn => first!.transaction(tx => fn({ query: async (sql, params = []) => {
      if (sql.startsWith('INSERT INTO reservations(id,event_id,token,expires_at)') && ++bulkReservationInserts === 2) {
        await tx.query("UPDATE events SET payload=jsonb_set(payload,'{confirmationDeadline}',to_jsonb((clock_timestamp()-interval '1 second')::text),true) WHERE id=$1",
          [writeReservationEvent.id]);
      }
      return tx.query(sql, params);
    } }))
  };
  await assert.rejects(() => reserveSeats(crossingBulkReservationDb, 'pg_write_reservation_host',
    writeReservationEvent.id, writeReservationEvent.version, 2, 'pg-reserve-write-deadline'),
  { code: 'INVALID_RESERVATION' });
  assert.equal(bulkReservationInserts, 2);
  assert.equal((await second.query<{ n: number }>('SELECT count(*)::int AS n FROM reservations WHERE event_id=$1',
    [writeReservationEvent.id])).rows[0]?.n, 1);
  assert.equal((await second.query<{ n: number }>("SELECT count(*)::int AS n FROM jobs WHERE event_id=$1 AND kind='EXPIRE_RESERVATION'",
    [writeReservationEvent.id])).rows[0]?.n, 1);
  await setEmergencyGate(first, 'operator:pg_safety', 'CLOSED', '发现异常暂停所有新增活动和报名', 'pg-emergency-close');
  assert.equal((await getEmergencyGate(second)).status, 'CLOSED');
  await assert.rejects(() => createDraft(second!, 'pg_emergency_host', input, 'pg-emergency-draft'),
    { code: 'EMERGENCY_PAUSED' });
  await setEmergencyGate(second, 'operator:pg_safety', 'OPEN', '核查完成恢复所有新增能力', 'pg-emergency-open');
  assert.equal((await getEmergencyGate(first)).status, 'OPEN');
  assert.equal((await createDraft(first, 'pg_emergency_host', input, 'pg-emergency-draft')).status, 'DRAFT');
  const startDraft = await createDraft(first, 'pg_start_host', input, 'pg-start-draft');
  const startEvent = await publishEvent(first, 'pg_start_host', startDraft.id, startDraft.version, 'pg-start-publish');
  for (const actor of ['pg_start_p1', 'pg_start_p2', 'pg_start_p3'])
    await register(second, actor, startEvent.id, startEvent.version, `pg-start-${actor}`, startEvent.inviteToken!);
  await confirmEvent(first, 'pg_start_host', startEvent.id, startEvent.version, 'pg-start-confirm');
  assert.equal((await second.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM jobs WHERE event_id=$1 AND kind='EVENT_START' AND payload->>'version'=$2",
    [startEvent.id, String(startEvent.version)])).rows[0]?.n, 1);
  await second.query(`UPDATE events SET payload=jsonb_set(payload,'{startAt}',
    to_jsonb(to_char((clock_timestamp()-interval '1 second') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),true) WHERE id=$1`,
    [startEvent.id]);
  await second.query("UPDATE jobs SET due_at=clock_timestamp()-interval '1 second' WHERE event_id=$1 AND kind='EVENT_START'", [startEvent.id]);
  await Promise.all([runDueJobs(first, Date.now() - 24 * 60 * 60_000),
    runDueJobs(second, Date.now() - 24 * 60 * 60_000)]);
  assert.deepEqual((await first.query<{ status: string; recruiting: boolean }>(
    'SELECT status,recruiting FROM events WHERE id=$1', [startEvent.id])).rows,
  [{ status: 'IN_PROGRESS', recruiting: false }]);
  assert.equal((await second.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM audit WHERE event_id=$1 AND action='EVENT_STARTED'", [startEvent.id])).rows[0]?.n, 1);
  const { rows: eventShift } = await first.query<{ id: string }>(`SELECT id FROM public_recruitment_coverage
    WHERE id<>$1 AND starts_at<=$2::timestamptz AND ends_at>=$3::timestamptz`,
  [coverage.id, input.startAt, input.endAt]);
  assert.equal(eventShift.length, 1);
  await revokePublicCoverage(first, 'operator:pg_safety', eventShift[0]!.id,
    '合成活动时段覆盖已撤销并通知参与者', 'pg-event-shift-revoke');
  assert.equal((await getPublicGate(second)).status, 'OPEN');
  await assert.rejects(() => register(second!, 'pg_public_late', publicEvent.id, publicEvent.version,
    'pg-event-shift-late', null), { code: 'PUBLIC_COVERAGE_REQUIRED' });
  const { rows: coverageNotices } = await second.query<{ user_id: string }>(`SELECT j.payload->>'userId' AS user_id
    FROM jobs j JOIN public_recruitment_coverage c ON c.id=$2
    WHERE j.kind='PUBLIC_GATE_NOTICE' AND j.payload->>'eventId'=$1
      AND j.payload->>'status'='CLOSED' AND j.created_at=c.revoked_at
    ORDER BY j.payload->>'userId'`, [publicEvent.id, eventShift[0]!.id]);
  assert.deepEqual(coverageNotices.map(row => row.user_id), ['pg_public_host', 'pg_public_p1']);
  process.stdout.write(JSON.stringify({ database: databaseName, eventId: event.id, migrations: migrations.length,
    pools: 2, contenders: contenders.length, confirmed: counts[0]?.confirmed, waitlisted: counts[0]?.waitlisted,
    auditRows: audit[0]?.total, operatorOtpSingleUse: true, operatorCrossPoolSession: true, memberLogoutCrossPool: true,
    emptyExpenseMemberCrossPool: true,
    operatorIndividualAccounts: true,
    publicGateCrossPool: true, publicGateNoticeCrossPool: true, publicGateConcurrentOrder: true,
    eventCoverageRevokeCrossPool: true,
    notificationFollowupCrossPool: true, personalExportCrossPool: true, personalExportSnapshot: true,
    pilotMetricsCrossPool: true, waitlistOfferCrossPool: true, formationTimeCrossPool: true,
    supportMinutesCrossPool: true, publicPublicationGateCrossPool: true,
    reportQueueCrossPool: true, reportResolutionCrossPool: true,
    reportResponseLockDeadlineCrossPool: true, appealReviewCrossPool: true,
    contentAppealCrossPool: true, contentAnswerVersionLock: true, currentFactVersionLock: true,
    contentAppealVersionLock: true, contentAnnouncementCrossPool: true, failedJobRecoveryCrossPool: true,
    staleJobClaimCrossPool: true, waitlistTieCrossPool: true, offerDatabaseClockCrossPool: true,
    offerExpiryRaceCrossPool: true, reservationExpiryRaceCrossPool: true,
    offerWriteClockCrossPool: true, reservationWriteClockCrossPool: true, registrationWriteClockCrossPool: true,
    interestWriteClockCrossPool: true, reservationCreationClockCrossPool: true,
    emergencyGateCrossPool: true, eventStartCrossPool: true,
    privacyDeleteProtectionCrossPool: true, privacyDeleteSendLockCrossPool: true }) + '\n');
} finally {
  await Promise.all([first?.close(), second?.close()]);
}
