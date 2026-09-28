import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { createDraft, getEvent, hasGeneratedAiSuggestion, publishEvent, rotateInvite, updateDraft } from './events.ts';
import { reviewHostStatus } from './host-limits.ts';
import { confirmPublicCoverage, createPublicCoverage, getPublicGate, publicRecruitmentOpen,
  revokePublicCoverage, setPublicGate } from './public-gate.ts';
import { getEmergencyGate, setEmergencyGate } from './emergency-gate.ts';
import { register, expressInterest, cancelRegistration, removeRegistration, reserveSeats, claimReservation, acceptOffer, declineOffer, approveRegistration, databaseNow } from './registrations.ts';
import { previewEventChange, getPendingReconfirmation, changeEvent, reconfirm, confirmEvent, cancelEvent, createCheckInToken, checkIn, listCheckIns, requestManualCheckIn, respondManualCheckIn, listManualCheckIns, completeEvent, repeatEvent, listRepeatCandidates, recordExpense, listExpenses, markExpenseShare, recordOutcomeFeedback, getOutcomeEvidence } from './lifecycle.ts';
import { localDraftSuggestion } from './ai.ts';
import type { DraftProvider } from './ai-provider-boundary.ts';
import { askSemanticCurrentFact, listAiSemanticAlerts, listAiSemanticAlertReviews, reviewAiSemanticAlert,
  type SemanticFactProvider } from './ai-semantic-answer.ts';
import { listAiDraftAlerts, listAiDraftAlertReviews, listAiEventCosts, reviewAiDraftAlert, runRecordedDraftProvider } from './ai-draft-requests.ts';
import { approveAiAction, executeAiAction, prepareAiAction, revokeAiAction } from './ai-actions.ts';
import { createReport, listReports, listReportTriage, listReportResponseAlerts, inspectReportForSafety, assignReport, classifyReportSeverity, listMyReports, changeReportStatus, createAppeal, listAppeals, listMyAppeals, changeAppealStatus, listMyRemovals, createPrivacyRequest, listPrivacyRequests, listPrivacyForOperations, getPrivacyRequestImpact } from './operations.ts';
import type { ReportResponsePolicy } from './report-response-policy.ts';
import { actorFromBearer, loginWithWechat, logoutMember, type WechatExchange } from './auth.ts';
import { setConsent, consentNotice, markNotificationOpened, getAttentionItems, listMemberNotifications,
  reconcileUnknownNotification, type NotificationLookupAdapter } from './notifications.ts';
import { listNotificationFollowups, listNotificationFollowupHistory, recordNotificationFollowup } from './notification-followups.ts';
import { askCurrentFact, createContent, listContent, listMyRejectedContent, listFactTodos, listPendingContent, moderateContent } from './collaboration.ts';
import { recordShareIntent, recordAttributedOpen, getShareMetrics } from './sharing.ts';
import { createPersonalExportTicket, downloadPersonalExport, exportPersonalData } from './privacy.ts';
import { executePrivacyDeletionWithMarker, type DeletionMarkerStore } from './privacy-deletion-journal.ts';
import { getPrivacyDeletionDisposition } from './privacy-deletion.ts';
import { getPilotMetrics } from './metrics.ts';
import { listSupportMinutes, recordSupportMinutes } from './support-minutes.ts';
import { eventAliasConsentStatus, listEventAliases, setEventAlias } from './event-aliases.ts';
import { getActiveEventHold, listEventHolds, placeEventHold, releaseEventHold } from './safety.ts';
import { consumeRateLimit, listRateLimitViolations } from './rate-limits.ts';
import { getRegistrationAnomalyEvidence, listRegistrationAnomalies, reviewRegistrationAnomaly } from './registration-anomalies.ts';
import { listPendingEventReviews, reviewEvent } from './event-review.ts';
import { listFailedJobs, retryFailedJob } from './job-recovery.ts';
import { loginOperator, logoutOperator, operatorFromBearer, OPERATOR_PERMISSIONS, validateOperatorAccounts, type OperatorConfig, type OperatorPermission } from './operator-auth.ts';
import { setRequestPayload, withRequestFingerprint } from './idempotency.ts';
import { blockEventMember, listMyBlocks, revokeBlock } from './blocks.ts';
import { disabledFeatureForPath, R1_FEATURE_FLAGS } from './feature-flags.ts';
import { requiresVerifiedPilot } from './pilot-access.ts';
import { grantCohost, revokeCohost, listCohostGrants, hasCohostCapability } from './cohosts.ts';

export interface AppOptions {
  environment: 'development' | 'test' | 'production';
  devAuth: boolean;
  operationsUsers?: string[];
  operatorAuth?: OperatorConfig;
  operatorAccounts?: OperatorConfig[];
  checkInSecret: string;
  wechatExchange?: WechatExchange;
  clock?: () => number;
  trustedProxyIps?: string[];
  pilotUserIds?: string[];
  aiDraftProvider?: DraftProvider;
  aiSemanticProvider?: SemanticFactProvider;
  aiDraftBudgetFen?: number;
  notificationLookupAdapter?: NotificationLookupAdapter;
  privacyDeletion?: { markerStore: DeletionMarkerStore; approvedPolicyJson: string };
  reportResponsePolicy?: ReportResponsePolicy;
}

function send(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readJson(req: IncomingMessage): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += data.length;
    if (bytes > 64 * 1024) throw new AppError('BODY_TOO_LARGE', '请求内容过大', 413);
    chunks.push(data);
  }
  if (!bytes) { setRequestPayload({}); return {}; }
  try {
    const value = JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid object');
    setRequestPayload(value);
    return value;
  } catch { throw new AppError('INVALID_JSON', '请求内容不是有效 JSON'); }
}

async function actorFrom(req: IncomingMessage, db: Database, options: AppOptions): Promise<string> {
  if (options.devAuth) {
    const id = req.headers['x-dev-user'];
    if (typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id)) return id;
  }
  return actorFromBearer(db, req.headers.authorization);
}

async function ensureDevelopmentConsentAccount(req: IncomingMessage, db: Database,
  options: AppOptions, actor: string): Promise<void> {
  if (!options.devAuth || options.environment === 'production' || req.headers['x-dev-user'] !== actor) return;
  await db.query(`INSERT INTO users(id,wechat_openid) VALUES($1,$2)
    ON CONFLICT (id) DO NOTHING`, [actor, `dev:${actor}`]);
}

function keyFrom(req: IncomingMessage): string {
  const key = req.headers['idempotency-key'];
  if (typeof key !== 'string' || key.length < 1 || key.length > 128) throw new AppError('MISSING_IDEMPOTENCY_KEY', '缺少有效幂等键');
  return key;
}

function versionFrom(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1) throw new AppError('BAD_REQUEST', 'expectedVersion 必须为正整数');
  return Number(value);
}

function canonicalIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function peerScope(req: IncomingMessage, trustedProxyIps: Set<string>): string {
  let ip = canonicalIp(req.socket.remoteAddress ?? 'unknown');
  if (trustedProxyIps.has(ip)) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      for (const candidate of forwarded.split(',').map(value => canonicalIp(value.trim())).reverse()) {
        if (!isIP(candidate)) break;
        if (!trustedProxyIps.has(candidate)) { ip = candidate; break; }
      }
    }
  }
  return createHash('sha256').update(ip).digest('hex');
}

async function limitAuthenticatedRequest(db: Database, actor: string, method: string, path: string): Promise<void> {
  if (method === 'GET' && /^\/events\/[^/]+$/.test(path))
    return consumeRateLimit(db, `event-read:${actor}`, 120, 60_000);
  if (method !== 'POST') return;
  if (/^\/events\/[^/]+\/(registrations|interests)$/.test(path) || /^\/reservations\/[^/]+\/claim$/.test(path) ||
    /^\/offers\/[^/]+\/accept$/.test(path)) return consumeRateLimit(db, `join:${actor}`, 20, 60_000);
  if (path === '/events' || /^\/events\/[^/]+\/(publish|repeat)$/.test(path))
    return consumeRateLimit(db, `host-create:${actor}`, 10, 60 * 60_000);
  if (path === '/reports') return consumeRateLimit(db, `report:${actor}`, 10, 60 * 60_000);
}

export function createApp(db: Database, options: AppOptions) {
  if (options.aiDraftProvider && options.environment === 'production' && !R1_FEATURE_FLAGS.ai_draft)
    throw new Error('AI draft provider disabled in production until release approval');
  if (options.aiSemanticProvider && options.environment !== 'test')
    throw new Error('AI semantic provider is limited to isolated test fixtures');
  if ((options.aiDraftProvider || options.aiSemanticProvider) &&
    (!Number.isSafeInteger(options.aiDraftBudgetFen) || Number(options.aiDraftBudgetFen) < 0))
    throw new Error('AI event budget must be a nonnegative integer fen');
  if (options.aiDraftBudgetFen !== undefined && !options.aiDraftProvider && !options.aiSemanticProvider)
    throw new Error('AI draft budget requires a provider');
  if (options.environment === 'production' && options.devAuth) throw new Error('development identity must be disabled in production');
  if (options.environment === 'production' && options.clock) throw new Error('test clock must be disabled in production');
  if (options.environment === 'production' && options.operationsUsers?.length) throw new Error('development operators are forbidden in production');
  if (options.operatorAuth && options.operatorAccounts) throw new Error('configure one operator credential source');
  const operatorAccounts = options.operatorAccounts ?? (options.operatorAuth ? [options.operatorAuth] : []);
  validateOperatorAccounts(operatorAccounts, options.operatorAccounts !== undefined);
  if (!options.checkInSecret) throw new Error('CHECKIN_SECRET is required');
  const operators = new Set([...(options.operationsUsers ?? []), ...operatorAccounts.map(account => `operator:${account.username}`)]);
  const operatorByName = new Map(operatorAccounts.map(account => [account.username, account]));
  const permissionsByActor = new Map(operatorAccounts.map(account => [`operator:${account.username}`,
    account.permissions ?? (options.operatorAuth ? [...OPERATOR_PERMISSIONS] : [])]));
  function requireOperator(actor: string, permission: OperatorPermission): void {
    if (!operators.has(actor) || (permissionsByActor.has(actor) && !permissionsByActor.get(actor)?.includes(permission)))
      throw new AppError('FORBIDDEN', '无运营权限', 403);
  }
  const trustedProxyIps = new Set((options.trustedProxyIps ?? []).map(canonicalIp));
  const verifiedPilotUsers = new Set(options.pilotUserIds ?? []);
  return createServer((req, res) => withRequestFingerprint(req.method ?? 'GET', req.url ?? '/', async () => {
    try {
      const requestUrl = new URL(req.url ?? '/', 'http://localhost');
      const path = requestUrl.pathname;
      const method = req.method ?? 'GET';
      if (path === '/health' && method === 'GET') return send(res, 200, { status: 'ok' });
      if (path === '/system/capabilities' && method === 'GET') return send(res, 200, { flags: R1_FEATURE_FLAGS });
      if (disabledFeatureForPath(path)) throw new AppError('FEATURE_DISABLED', '当前版本未开放此功能', 403);
      if (path.startsWith('/ai/actions') && options.environment !== 'test')
        throw new AppError('FEATURE_DISABLED', 'AI 动作协议仅用于隔离测试', 403);
      if (path === '/system/safety' && method === 'GET') {
        const gate = await getEmergencyGate(db);
        return send(res, 200, { status: gate.status, changedAt: gate.changedAt });
      }
      if (path === '/ready' && method === 'GET') {
        try {
          await db.query('SELECT 1');
          return send(res, 200, { status: 'ready' });
        } catch {
          return send(res, 503, { status: 'unavailable' });
        }
      }
      if (path === '/ops' && method === 'GET') {
        const html = await readFile(new URL('../operations/index.html', import.meta.url), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }
      if (path === '/auth/wechat' && method === 'POST') {
        await consumeRateLimit(db, `auth-ip:${peerScope(req, trustedProxyIps)}`, 10, 60_000);
        const body = await readJson(req);
        return send(res, 200, await loginWithWechat(db, options.wechatExchange, body.code));
      }
      if (path === '/auth/logout' && method === 'POST')
        return send(res, 200, await logoutMember(db, req.headers.authorization));
      if (path === '/ops/auth/login' && method === 'POST') {
        if (!operatorAccounts.length) throw new AppError('OPERATOR_UNAVAILABLE', '运营账号尚未配置', 503);
        const at = options.clock?.() ?? Date.now();
        await consumeRateLimit(db, `ops-login-ip:${peerScope(req, trustedProxyIps)}`, 10, 60_000);
        const body = await readJson(req);
        await consumeRateLimit(db, `ops-login-user:${createHash('sha256').update(String(body.username ?? '')).digest('hex')}`, 10, 60_000);
        const account = operatorByName.get(typeof body.username === 'string' ? body.username : '') ?? operatorAccounts[0]!;
        return send(res, 200, await loginOperator(db, account, body.username, body.password, body.code, at));
      }
      if (path === '/ops/auth/logout' && method === 'POST') {
        if (!operatorAccounts.length) throw new AppError('OPERATOR_UNAVAILABLE', '运营账号尚未配置', 503);
        await operatorFromBearer(db, req.headers.authorization, operatorAccounts);
        await logoutOperator(db, req.headers.authorization);
        return send(res, 200, { ok: true });
      }
      if (path.startsWith('/i/') && method === 'GET') {
        await consumeRateLimit(db, `invite-ip:${peerScope(req, trustedProxyIps)}`, 60, 60_000);
        const token = path.slice(3);
        const { rows } = await db.query<{ id: string; status: string; payload: Record<string, unknown>; version: number;
          recruiting: boolean; review_status: string }>("SELECT id,status,payload,version,recruiting,review_status FROM events WHERE invite_token=$1 AND invite_expires_at>now() AND status<>'DRAFT' AND review_status='APPROVED'", [token]);
        const row = rows[0];
        if (!row) throw new AppError('NOT_FOUND', '邀请已失效', 404);
        if (row.payload.visibility === 'PUBLIC' && !(await publicRecruitmentOpen(db, false, row.payload)))
          throw new AppError('NOT_FOUND', '邀请已失效', 404);
        const visitor = await actorFrom(req, db, options).catch(() => null);
        await recordAttributedOpen(db, visitor, row.id, token, requestUrl.searchParams.get('source'));
        const payload = { title: row.payload.title, startAt: row.payload.startAt, endAt: row.payload.endAt,
          timeZone: row.payload.timeZone, city: row.payload.city, venueName: row.payload.venueName,
          venueStatus: row.payload.venueStatus, feeMode: row.payload.feeMode, feeCapFen: row.payload.feeCapFen,
          cancellationRule: row.payload.cancellationRule, approvalMode: row.payload.approvalMode,
          skillLevel: row.payload.skillLevel };
        return send(res, 200, { id: row.id, status: row.status, version: row.version, recruiting: row.recruiting,
          aiSuggestionGenerated: await hasGeneratedAiSuggestion(db, row.id),
          reviewStatus: row.review_status, riskPaused: Boolean(await getActiveEventHold(db, row.id)), payload,
          title: row.payload.title,
          startAt: row.payload.startAt, endAt: row.payload.endAt, city: row.payload.city, venueName: row.payload.venueName,
          feeMode: row.payload.feeMode, feeCapFen: row.payload.feeCapFen, cancellationRule: row.payload.cancellationRule });
      }
      let actor: string;
      if (path.startsWith('/ops/') && (options.environment === 'production' || req.headers.authorization?.startsWith('Bearer '))) {
        if (!operatorAccounts.length) throw new AppError('UNAUTHENTICATED', '请先登录', 401);
        actor = await operatorFromBearer(db, req.headers.authorization, operatorAccounts);
      } else actor = await actorFrom(req, db, options);
      if (options.environment === 'production' && requiresVerifiedPilot(method, path) && !verifiedPilotUsers.has(actor))
        throw new AppError('PILOT_NOT_VERIFIED', '仅已人工核验的成年试点成员可发起或参加活动', 403);
      await limitAuthenticatedRequest(db, actor, method, path);
      if (path === '/ai/actions:prepare' && method === 'POST') {
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 201, await prepareAiAction(db, actor, {
          kind: body.kind, eventId: body.eventId, expectedVersion: versionFrom(body.expectedVersion), payload: body.payload
        }, key));
      }
      const aiAction = path.match(/^\/ai\/actions\/([a-f0-9-]{36})\/(approve|revoke|execute)$/);
      if (aiAction && method === 'POST') {
        const key = keyFrom(req); const body = await readJson(req); const id = aiAction[1]!;
        if (aiAction[2] === 'approve') return send(res, 200, await approveAiAction(db, actor, id,
          body.approved, body.payloadHash, key));
        if (aiAction[2] === 'revoke') return send(res, 200, await revokeAiAction(db, actor, id, key));
        return send(res, 200, await executeAiAction(db, actor, id, {
          kind: body.kind, eventId: body.eventId, expectedVersion: versionFrom(body.expectedVersion),
          payload: body.payload, payloadHash: body.payloadHash
        }, key));
      }
      if (path === '/events/drafts:suggest-local' && method === 'POST') {
        const key = keyFrom(req);
        const body = await readJson(req);
        const text = String(body.text ?? '');
        const eventId = body.eventId;
        if (eventId !== undefined && (typeof eventId !== 'string' || !/^[0-9a-f-]{36}$/.test(eventId)))
          throw new AppError('BAD_REQUEST', '活动草稿 ID 无效');
        const at = options.clock?.() ?? Date.now();
        const suggestion = options.aiDraftProvider
          ? await runRecordedDraftProvider(db, actor, key, text, at, options.aiDraftProvider, options.aiDraftBudgetFen!, eventId)
          : localDraftSuggestion(text, at);
        return send(res, 200, suggestion);
      }
      if (path === '/events' && method === 'POST') {
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 201, await createDraft(db, actor, body, key,
          options.environment !== 'production' || !options.pilotUserIds?.includes(actor)));
      }
      if (path === '/me/events' && method === 'GET') {
        const { rows } = await db.query<{ id: string; status: string; payload: { title?: string; startAt?: string };
          review_status: string; legacy_review_closed: boolean | null; is_host: boolean; my_status: string | null }>(`SELECT e.id,e.status,e.payload,e.review_status,
          clock_timestamp()>=CASE WHEN e.status='RECRUITING' THEN
            (e.payload->>'confirmationDeadline')::timestamptz ELSE (e.payload->>'startAt')::timestamptz END
            AS legacy_review_closed,
          (e.host_id=$1) AS is_host,r.status AS my_status FROM events e
          LEFT JOIN registrations r ON r.event_id=e.id AND r.user_id=$1
          WHERE e.host_id=$1 OR r.status IN ('INTERESTED','REQUESTED','WAITLISTED','OFFERED','CONFIRMED','RECONFIRM_REQUIRED')
          ORDER BY e.id`, [actor]);
        return send(res, 200, { items: rows.map(r => {
          const reviewed = r.is_host || r.review_status === 'APPROVED' ||
            (r.review_status === 'NOT_REQUIRED' &&
              (r.legacy_review_closed === true || ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'].includes(r.status)));
          return { id: r.id, status: r.status, title: reviewed ? r.payload.title : '活动审核中',
            startAt: reviewed ? r.payload.startAt : undefined, isHost: r.is_host, myRegistrationStatus: r.my_status };
        }) });
      }
      if (path === '/me/registrations' && method === 'GET') {
        const { rows } = await db.query('SELECT id,event_id,status,accepted_version,created_at FROM registrations WHERE user_id=$1 ORDER BY created_at DESC', [actor]);
        return send(res, 200, { items: rows });
      }
      if (path === '/me/removals' && method === 'GET') return send(res, 200, { items: await listMyRemovals(db, actor) });
      if (path === '/me/appeals' && method === 'GET') return send(res, 200, { items: await listMyAppeals(db, actor) });
      if (path === '/me/content' && method === 'GET') return send(res, 200, { items: await listMyRejectedContent(db, actor) });
      if (path === '/me/blocks' && method === 'GET') return send(res, 200, { items: await listMyBlocks(db, actor) });
      const revokedBlock = path.match(/^\/me\/blocks\/([^/]+)\/revoke$/);
      if (revokedBlock && method === 'POST') return send(res, 200, await revokeBlock(db, actor, revokedBlock[1]!, keyFrom(req)));
      if (path === '/me/notifications' && method === 'GET') {
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', '通知列表页码无效');
        return send(res, 200, await listMemberNotifications(db, actor, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      const openedNotification = path.match(/^\/me\/notifications\/([^/]+)\/open$/);
      if (openedNotification && method === 'POST') return send(res, 200, await markNotificationOpened(db, actor, openedNotification[1]!, keyFrom(req)));
      if (path === '/me/consents' && method === 'GET') {
        const notice = consentNotice('EVENT_REMINDER');
        const { rows } = await db.query<{ granted: boolean; scope: string | null; notice_version: string | null }>(
          'SELECT granted,scope,notice_version FROM notification_consents WHERE user_id=$1 AND purpose=$2', [actor, 'EVENT_REMINDER']);
        const current = rows[0]?.scope === notice.scope && rows[0]?.notice_version === notice.version;
        return send(res, 200, { eventReminder: Boolean(rows[0]?.granted && current),
          reconfirmationRequired: Boolean(rows[0]?.granted && !current), eventReminderNotice: notice });
      }
      if (path === '/me/consents' && method === 'POST') {
        const key = keyFrom(req); const body = await readJson(req);
        if (body.eventReminder === true && body.noticeVersion !== consentNotice('EVENT_REMINDER').version)
          throw new AppError('CONSENT_NOTICE_CHANGED', '授权说明已变化，请重新加载后再确认', 409);
        if (body.eventReminder === true) await ensureDevelopmentConsentAccount(req, db, options, actor);
        return send(res, 200, await setConsent(db, actor, 'EVENT_REMINDER', body.eventReminder, key));
      }
      if (path === '/me/similar-invites' && method === 'GET') {
        const notice = consentNotice('SIMILAR_ACTIVITY_INVITES');
        const { rows } = await db.query<{ granted: boolean; scope: string | null; notice_version: string | null }>(
          'SELECT granted,scope,notice_version FROM notification_consents WHERE user_id=$1 AND purpose=$2', [actor, 'SIMILAR_ACTIVITY_INVITES']);
        const current = rows[0]?.scope === notice.scope && rows[0]?.notice_version === notice.version;
        return send(res, 200, { granted: Boolean(rows[0]?.granted && current),
          reconfirmationRequired: Boolean(rows[0]?.granted && !current), notice });
      }
      if (path === '/me/similar-invites' && method === 'POST') {
        const key = keyFrom(req); const body = await readJson(req);
        if (body.granted === true && body.noticeVersion !== consentNotice('SIMILAR_ACTIVITY_INVITES').version)
          throw new AppError('CONSENT_NOTICE_CHANGED', '授权说明已变化，请重新加载后再确认', 409);
        if (body.granted === true) await ensureDevelopmentConsentAccount(req, db, options, actor);
        return send(res, 200, await setConsent(db, actor, 'SIMILAR_ACTIVITY_INVITES', body.granted, key));
      }
      if (path === '/reports' && method === 'POST') return send(res, 201, await createReport(db, actor,
        await readJson(req), keyFrom(req), options.reportResponsePolicy));
      if (path === '/me/reports' && method === 'GET') return send(res, 200, { items: await listMyReports(db, actor) });
      if (path === '/ops/reports' && method === 'GET') {
        requireOperator(actor, 'REPORTS');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', '举报列表页码无效');
        return send(res, 200, await listReports(db, actor, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      if (path === '/ops/reports/triage' && method === 'GET') {
        requireOperator(actor, 'SAFETY');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', '待分配举报页码无效');
        const activeAssignees = [...permissionsByActor].filter(([, permissions]) => permissions.includes('REPORTS'))
          .map(([operatorId]) => operatorId);
        return send(res, 200, await listReportTriage(db, activeAssignees, Number(offsetText),
          requestUrl.searchParams.get('snapshot')));
      }
      if (path === '/ops/reports/response-alerts' && method === 'GET') {
        requireOperator(actor, 'SAFETY');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', '首次响应关注列表页码无效');
        return send(res, 200, await listReportResponseAlerts(db, Number(offsetText),
          requestUrl.searchParams.get('snapshot')));
      }
      if (path === '/ops/holds' && method === 'GET') {
        requireOperator(actor, 'SAFETY');
        return send(res, 200, { items: await listEventHolds(db) });
      }
      if (path === '/ops/public-recruitment' && method === 'GET') {
        requireOperator(actor, 'SAFETY');
        return send(res, 200, await getPublicGate(db));
      }
      if (path === '/ops/public-coverage' && method === 'POST') {
        requireOperator(actor, 'SAFETY');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 201, await createPublicCoverage(db, actor, body.startsAt, body.endsAt,
          body.drillReference, body.drillCompletedAt, key));
      }
      const coverageConfirm = path.match(/^\/ops\/public-coverage\/([a-f0-9-]{36})\/confirm$/);
      if (coverageConfirm && method === 'POST') {
        requireOperator(actor, 'SAFETY');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await confirmPublicCoverage(db, actor, coverageConfirm[1]!, body.reason, key));
      }
      const coverageRevoke = path.match(/^\/ops\/public-coverage\/([a-f0-9-]{36})\/revoke$/);
      if (coverageRevoke && method === 'POST') {
        requireOperator(actor, 'SAFETY');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await revokePublicCoverage(db, actor, coverageRevoke[1]!, body.reason, key));
      }
      if (path === '/ops/emergency' && method === 'GET') {
        requireOperator(actor, 'SAFETY');
        return send(res, 200, await getEmergencyGate(db));
      }
      if (path === '/ops/emergency' && method === 'POST') {
        requireOperator(actor, 'SAFETY');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await setEmergencyGate(db, actor, body.status, body.reason, key));
      }
      if (path === '/ops/public-recruitment' && method === 'POST') {
        requireOperator(actor, 'SAFETY');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await setPublicGate(db, actor, body.status, body.reason, key, body.coverageId));
      }
      if (path === '/ops/rate-limits' && method === 'GET') {
        requireOperator(actor, 'RATE_LIMITS');
        return send(res, 200, { items: await listRateLimitViolations(db) });
      }
      if (path === '/ops/registration-anomalies' && method === 'GET') {
        requireOperator(actor, 'RATE_LIMITS');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', '异常报名队列页码无效');
        return send(res, 200, await listRegistrationAnomalies(db, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      if (path === '/ops/registration-anomalies/evidence' && method === 'GET') {
        requireOperator(actor, 'RATE_LIMITS');
        const userId = requestUrl.searchParams.get('userId');
        const eventId = requestUrl.searchParams.get('eventId');
        if (!userId || !eventId || userId.length > 160 || eventId.length > 160)
          throw new AppError('BAD_REQUEST', '线索身份无效');
        return send(res, 200, await getRegistrationAnomalyEvidence(db, userId, eventId));
      }
      if (path === '/ops/registration-anomalies/review' && method === 'POST') {
        requireOperator(actor, 'RATE_LIMITS');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await reviewRegistrationAnomaly(db, actor, body, key));
      }
      if (path === '/ops/metrics' && method === 'GET') {
        requireOperator(actor, 'METRICS');
        return send(res, 200, await getPilotMetrics(db, options.clock?.() ?? Date.now(), options.pilotUserIds));
      }
      if (path === '/ops/support-minutes' && method === 'GET') {
        requireOperator(actor, 'SUPPORT_MINUTES');
        return send(res, 200, { items: await listSupportMinutes(db) });
      }
      const supportMinutes = path.match(/^\/ops\/events\/([^/]+)\/support-minutes$/);
      if (supportMinutes && method === 'POST') {
        requireOperator(actor, 'SUPPORT_MINUTES');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 201, await recordSupportMinutes(db, actor, supportMinutes[1]!, body.minutes, body.category, key));
      }
      if (path === '/ops/notifications/followups' && method === 'GET') {
        requireOperator(actor, 'NOTIFICATIONS');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', '通知待跟进列表页码无效');
        return send(res, 200, await listNotificationFollowups(db, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      if (path === '/ops/notifications/followups/history' && method === 'GET') {
        requireOperator(actor, 'NOTIFICATIONS');
        return send(res, 200, { items: await listNotificationFollowupHistory(db) });
      }
      if (path === '/ops/jobs/failed' && method === 'GET') {
        requireOperator(actor, 'JOBS');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', '失败任务列表页码无效');
        return send(res, 200, await listFailedJobs(db, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      if (path === '/ops/ai-draft-alerts' && method === 'GET') {
        requireOperator(actor, 'JOBS');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', 'AI 草稿异常列表页码无效');
        return send(res, 200, await listAiDraftAlerts(db, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      if (path === '/ops/ai-semantic-alerts' && method === 'GET') {
        requireOperator(actor, 'JOBS');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', 'AI 语义异常列表页码无效');
        return send(res, 200, await listAiSemanticAlerts(db, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      if (path === '/ops/ai-semantic-alerts/reviews' && method === 'GET') {
        requireOperator(actor, 'JOBS');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', 'AI 语义复核历史页码无效');
        return send(res, 200, await listAiSemanticAlertReviews(db, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      if (path === '/ops/ai-semantic-alerts/review' && method === 'POST') {
        requireOperator(actor, 'JOBS');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await reviewAiSemanticAlert(db, actor, body.userId, body.requestKey, body.note, key));
      }
      if (path === '/ops/ai-draft-alerts/reviews' && method === 'GET') {
        requireOperator(actor, 'JOBS');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', 'AI 草稿复核历史页码无效');
        return send(res, 200, await listAiDraftAlertReviews(db, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      if (path === '/ops/ai-draft-alerts/review' && method === 'POST') {
        requireOperator(actor, 'JOBS');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await reviewAiDraftAlert(db, actor, body.userId, body.requestKey, body.note, key));
      }
      if (path === '/ops/ai-event-costs' && method === 'GET') {
        requireOperator(actor, 'JOBS');
        return send(res, 200, await listAiEventCosts(db, requestUrl.searchParams.get('after')));
      }
      const failedJobRetry = path.match(/^\/ops\/jobs\/([^/]+)\/retry$/);
      if (failedJobRetry && method === 'POST') {
        requireOperator(actor, 'JOBS');
        return send(res, 202, await retryFailedJob(db, actor, failedJobRetry[1]!, keyFrom(req)));
      }
      const notificationFollowup = path.match(/^\/ops\/notifications\/([^/]+)\/followup$/);
      if (notificationFollowup && method === 'POST') {
        requireOperator(actor, 'NOTIFICATIONS');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await recordNotificationFollowup(db, actor, notificationFollowup[1]!, body.note, key));
      }
      const notificationReconciliation = path.match(/^\/ops\/notifications\/([^/]+)\/reconcile$/);
      if (notificationReconciliation && method === 'POST') {
        requireOperator(actor, 'NOTIFICATIONS');
        const key = keyFrom(req); const body = await readJson(req);
        if (Object.keys(body).length) throw new AppError('BAD_REQUEST', '通知查单不接受请求参数');
        return send(res, 200, await reconcileUnknownNotification(db, actor, notificationReconciliation[1]!, key,
          options.notificationLookupAdapter));
      }
      if (path === '/ops/events/reviews' && method === 'GET') {
        requireOperator(actor, 'EVENT_REVIEWS');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', '活动审核列表页码无效');
        return send(res, 200, await listPendingEventReviews(db, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      const hostStatusReview = path.match(/^\/ops\/hosts\/([^/]+)\/status$/);
      if (hostStatusReview && method === 'POST') {
        requireOperator(actor, 'SAFETY');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await reviewHostStatus(db, actor, hostStatusReview[1]!, body.status, body.reason, key));
      }
      const eventReview = path.match(/^\/ops\/events\/([^/]+)\/review$/);
      if (eventReview && method === 'POST') {
        requireOperator(actor, 'EVENT_REVIEWS');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await reviewEvent(db, actor, eventReview[1]!, versionFrom(body.expectedVersion), body.decision, body.reason, key));
      }
      const placeHold = path.match(/^\/ops\/events\/([^/]+)\/hold$/);
      if (placeHold && method === 'POST') {
        requireOperator(actor, 'SAFETY');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 201, await placeEventHold(db, actor, placeHold[1]!, body.reason, key));
      }
      const releaseHold = path.match(/^\/ops\/holds\/([^/]+)\/release$/);
      if (releaseHold && method === 'POST') {
        requireOperator(actor, 'SAFETY');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await releaseEventHold(db, actor, releaseHold[1]!, body.reason, key));
      }
      const reportStatus = path.match(/^\/ops\/reports\/([^/]+)\/status$/);
      const reportInspect = path.match(/^\/ops\/reports\/([^/]+)\/inspect$/);
      if (reportInspect && method === 'POST') {
        requireOperator(actor, 'SAFETY');
        const body = await readJson(req);
        return send(res, 200, await inspectReportForSafety(db, actor, reportInspect[1]!, body.reason));
      }
      const reportAssign = path.match(/^\/ops\/reports\/([^/]+)\/assign$/);
      if (reportAssign && method === 'POST') {
        requireOperator(actor, 'SAFETY');
        const key = keyFrom(req); const body = await readJson(req);
        const account = typeof body.assignee === 'string' ? operatorByName.get(body.assignee) : undefined;
        if (!account || !(account.permissions ?? (options.operatorAuth ? [...OPERATOR_PERMISSIONS] : [])).includes('REPORTS'))
          throw new AppError('BAD_REQUEST', '分配对象须为当前具名举报处理人员');
        return send(res, 200, await assignReport(db, actor, reportAssign[1]!, `operator:${account.username}`, body.reason, key));
      }
      const reportSeverity = path.match(/^\/ops\/reports\/([^/]+)\/severity$/);
      if (reportSeverity && method === 'POST') {
        requireOperator(actor, 'SAFETY');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await classifyReportSeverity(db, actor, reportSeverity[1]!, body.severity,
          body.expectedSeverity, body.reason, key, options.reportResponsePolicy));
      }
      if (reportStatus && method === 'POST') {
        requireOperator(actor, 'REPORTS');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await changeReportStatus(db, actor, reportStatus[1]!, body.status, body.resolution, key,
          body.outcomeDecision));
      }
      if (path === '/appeals' && method === 'POST') return send(res, 201, await createAppeal(db, actor, await readJson(req), keyFrom(req)));
      if (path === '/ops/appeals' && method === 'GET') {
        requireOperator(actor, 'APPEALS');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', '申诉列表页码无效');
        return send(res, 200, await listAppeals(db, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      const appealStatus = path.match(/^\/ops\/appeals\/([^/]+)\/status$/);
      if (appealStatus && method === 'POST') {
        requireOperator(actor, 'APPEALS');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await changeAppealStatus(db, actor, appealStatus[1]!, body.status, body.resolution, key, body.outcome));
      }
      if (path === '/privacy/requests' && method === 'POST') return send(res, 201, await createPrivacyRequest(db, actor, await readJson(req), keyFrom(req)));
      if (path === '/privacy/requests' && method === 'GET') return send(res, 200, { items: await listPrivacyRequests(db, actor) });
      if (path === '/privacy/export' && method === 'GET') return send(res, 200, await exportPersonalData(db, actor));
      if (path === '/privacy/exports' && method === 'POST')
        return send(res, 201, await createPersonalExportTicket(db, actor, keyFrom(req)));
      const exportTicket = path.match(/^\/privacy\/exports\/([a-f0-9-]+)$/);
      if (exportTicket && method === 'GET') return send(res, 200, await downloadPersonalExport(db, actor, exportTicket[1]!));
      const revokedCohost = path.match(/^\/cohost-grants\/([^/]+):revoke$/);
      if (revokedCohost && method === 'POST') return send(res, 200, await revokeCohost(db, actor, revokedCohost[1]!, keyFrom(req)));
      const privacyImpact = path.match(/^\/ops\/privacy\/([a-zA-Z0-9-]+)\/impact$/);
      if (privacyImpact && method === 'GET') {
        requireOperator(actor, 'PRIVACY');
        return send(res, 200, await getPrivacyRequestImpact(db, actor, privacyImpact[1]!));
      }
      const privacyDisposition = path.match(/^\/ops\/privacy\/([a-zA-Z0-9-]+)\/disposition$/);
      if (privacyDisposition && method === 'GET') {
        requireOperator(actor, 'PRIVACY');
        const operatorActor = actor.startsWith('operator:') ? actor : `operator:${actor}`;
        return send(res, 200, await getPrivacyDeletionDisposition(db, operatorActor, privacyDisposition[1]!));
      }
      const privacyExecution = path.match(/^\/ops\/privacy\/([a-zA-Z0-9-]+)\/execute$/);
      if (privacyExecution && method === 'POST') {
        requireOperator(actor, 'PRIVACY');
        keyFrom(req);
        const body = await readJson(req);
        if (Object.keys(body).length) throw new AppError('BAD_REQUEST', '注销处置不接受请求参数');
        if (!options.privacyDeletion) throw new AppError('DELETE_EXECUTION_UNAVAILABLE', '注销执行所需的独立标记存储未配置', 503);
        const operatorActor = actor.startsWith('operator:') ? actor : `operator:${actor}`;
        return send(res, 200, await executePrivacyDeletionWithMarker(db, options.privacyDeletion.markerStore,
          operatorActor, privacyExecution[1]!, options.privacyDeletion.approvedPolicyJson));
      }
      if (path === '/ops/privacy' && method === 'GET') {
        requireOperator(actor, 'PRIVACY');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', '个人信息请求页码无效');
        return send(res, 200, await listPrivacyForOperations(db, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      if (path === '/ops/content' && method === 'GET') {
        requireOperator(actor, 'CONTENT');
        const offsetText = requestUrl.searchParams.get('offset') ?? '0';
        if (!/^(0|[1-9]\d*)$/.test(offsetText)) throw new AppError('BAD_REQUEST', '内容审核列表页码无效');
        return send(res, 200, await listPendingContent(db, Number(offsetText), requestUrl.searchParams.get('snapshot')));
      }
      const contentModeration = path.match(/^\/ops\/content\/([^/]+)\/moderate$/);
      if (contentModeration && method === 'POST') {
        requireOperator(actor, 'CONTENT');
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await moderateContent(db, actor, contentModeration[1]!, body.status, key, body.reason));
      }
      const eventMatch = path.match(/^\/events\/([^/]+)(?:\/(.+))?$/);
      if (eventMatch) {
        const id = eventMatch[1]!; const action = eventMatch[2];
        if (!action && method === 'GET') {
          const event = await getEvent(db, actor, id);
          const { rows: counts } = await db.query<{ confirmed: number; waitlisted: number; reconfirmRequired: number; requested: number }>(`SELECT
            count(*) FILTER (WHERE status='CONFIRMED' AND accepted_version=$2)::int AS "confirmed",
            count(*) FILTER (WHERE status='WAITLISTED')::int AS "waitlisted",
            count(*) FILTER (WHERE status='RECONFIRM_REQUIRED')::int AS "reconfirmRequired",
            count(*) FILTER (WHERE status='REQUESTED')::int AS "requested"
            FROM registrations WHERE event_id=$1`, [id, event.version]);
          const { rows: reservations } = await db.query<{ reserved: number }>(`SELECT count(*)::int AS reserved FROM reservations
            WHERE event_id=$1 AND claimed_by IS NULL AND released_at IS NULL AND expires_at>now()`, [id]);
          const stats = { ...(counts[0] ?? { confirmed: 0, waitlisted: 0, reconfirmRequired: 0, requested: 0 }), reserved: reservations[0]?.reserved ?? 0 };
          return send(res, 200, { ...event, stats, riskPaused: Boolean(await getActiveEventHold(db, id)) ||
            (event.payload.visibility === 'PUBLIC' && !(await publicRecruitmentOpen(db, false, event.payload))),
            formationRisk: event.status === 'CONFIRMED' && stats.confirmed < event.payload.minParticipants! });
        }
        if (action === 'registrations' && method === 'GET') {
          const event = await getEvent(db, actor, id);
          const canApprove = event.hostId === actor || await hasCohostCapability(db, actor, id, 'APPROVE_REGISTRATION');
          const canManageCheckins = event.hostId === actor || await hasCohostCapability(db, actor, id, 'CHECKIN_MANAGE');
          if (!canApprove && !canManageCheckins) throw new AppError('FORBIDDEN', '没有本活动成员管理权限', 403);
          const { rows } = await db.query(canApprove
            ? 'SELECT id,user_id,status,accepted_version,created_at FROM registrations WHERE event_id=$1 ORDER BY created_at,id'
            : "SELECT id,user_id,status,accepted_version,created_at FROM registrations WHERE event_id=$1 AND status='CONFIRMED' ORDER BY created_at,id", [id]);
          return send(res, 200, { items: rows });
        }
        if (action === 'content' && method === 'GET') return send(res, 200, { items: await listContent(db, actor, id) });
        if (action === 'cohosts' && method === 'GET') return send(res, 200, { items: await listCohostGrants(db, actor, id) });
        if (action === 'aliases' && method === 'GET') return send(res, 200, {
          items: await listEventAliases(db, actor, id), ...(await eventAliasConsentStatus(db, actor, id)) });
        if (action === 'fact-todos' && method === 'GET') return send(res, 200, { items: await listFactTodos(db, actor, id) });
        if (action === 'expenses' && method === 'GET') return send(res, 200, { items: await listExpenses(db, actor, id) });
        if (action === 'manual-checkins' && method === 'GET') return send(res, 200, { items: await listManualCheckIns(db, actor, id) });
        if (action === 'checkins' && method === 'GET') return send(res, 200, { items: await listCheckIns(db, actor, id) });
        if (action === 'reconfirmation' && method === 'GET') return send(res, 200, { pending: await getPendingReconfirmation(db, actor, id) });
        if (action === 'share-metrics' && method === 'GET') return send(res, 200, await getShareMetrics(db, actor, id));
        if (action === 'repeat-candidates' && method === 'GET') return send(res, 200, { items: await listRepeatCandidates(db, actor, id) });
        if (action === 'attention' && method === 'GET') return send(res, 200, { items: await getAttentionItems(db, actor, id) });
        if (action === 'outcome' && method === 'GET') return send(res, 200, await getOutcomeEvidence(db, actor, id));
        if (method === 'POST') {
          const key = keyFrom(req); const body = await readJson(req);
          if (action === 'cohosts') {
            if (options.environment === 'production' && !verifiedPilotUsers.has(body.userId))
              throw new AppError('PILOT_NOT_VERIFIED', '仅可授权已核验试点成员', 403);
            return send(res, 200, await grantCohost(db, actor, id, versionFrom(body.expectedVersion),
              body.userId, body.capabilities, body.expiresAt, key));
          }
          if (action === 'content') return send(res, 201, await createContent(db, actor, id, body.kind, body.body, body.parentId ?? null, key));
          if (action === 'aliases') return send(res, 200, await setEventAlias(db, actor, id, body.displayName, body.granted, key,
            body.noticeVersion));
          if (action === 'blocks') return send(res, 201, await blockEventMember(db, actor, id, body.memberId, key));
          if (action === 'facts:ask') return send(res, 200, options.aiSemanticProvider
            ? await askSemanticCurrentFact(db, actor, id, body.question, key, options.aiSemanticProvider,
              { budgetFen: options.aiDraftBudgetFen, environment: options.environment })
            : await askCurrentFact(db, actor, id, body.question, key));
          const version = versionFrom(body.expectedVersion);
          if (action === 'publish') return send(res, 200, await publishEvent(db, actor, id, version, key));
          if (action === 'draft') return send(res, 200, await updateDraft(db, actor, id, version, body.patch ?? {}, key));
          if (action === 'invite:rotate') return send(res, 200, await rotateInvite(db, actor, id, version, key));
          if (action === 'registrations') {
            if (body.acceptedRules !== true)
              throw new AppError('RULES_NOT_ACCEPTED', '请先确认本次活动版本和报名规则', 400);
            return send(res, 201, await register(db, actor, id, version, key, typeof body.inviteToken === 'string' ? body.inviteToken : null));
          }
          if (action === 'interests') return send(res, 201, await expressInterest(db, actor, id, version, key,
            typeof body.inviteToken === 'string' ? body.inviteToken : null));
          if (action === 'reservations') return send(res, 201, await reserveSeats(db, actor, id, version, versionFrom(body.count), key));
          if (action === 'changes') return send(res, 200, await changeEvent(db, actor, id, version, body.patch ?? {}, key));
          if (action === 'changes:preview') return send(res, 200, await previewEventChange(db, actor, id, version, body.patch ?? {}));
          if (action === 'share-intents') return send(res, 201, await recordShareIntent(db, actor, id, version, body.sourceToken, key));
          if (action === 'confirm') return send(res, 200, await confirmEvent(db, actor, id, version, key));
          if (action === 'cancel') return send(res, 200, await cancelEvent(db, actor, id, version, key, options.clock?.()));
          if (action === 'checkin-token') {
            const token = await db.transaction(async tx => {
              // A completed revocation takes the same event lock as this action.
              await tx.query('SELECT id FROM events WHERE id=$1 FOR SHARE', [id]);
              const event = await getEvent(tx, actor, id);
              if (event.hostId !== actor && !(await hasCohostCapability(tx, actor, id, 'CHECKIN_MANAGE')))
                throw new AppError('FORBIDDEN', '没有本活动签到管理权限', 403);
              const now = await databaseNow(tx);
              if (!['CONFIRMED', 'IN_PROGRESS'].includes(event.status) || now < Date.parse(event.payload.startAt!) - 30 * 60_000 ||
                now > Date.parse(event.payload.endAt!) + 30 * 60_000) throw new AppError('CHECKIN_CLOSED', '当前不在签到时间内');
              return { token: createCheckInToken(id, options.checkInSecret, now),
                expiresInSeconds: Math.ceil((60_000 - now % 60_000) / 1000) };
            });
            return send(res, 200, token);
          }
          if (action === 'checkins') return send(res, 201, await checkIn(db, actor, id, version, String(body.token ?? ''), options.checkInSecret, key));
          if (action === 'manual-checkins') return send(res, 201, await requestManualCheckIn(db, actor, id, version, body.userId, key, options.clock?.()));
          if (action === 'complete') {
            if (!Array.isArray(body.issues)) throw new AppError('BAD_REQUEST', '请明确填写结项异常与场地问题，或提交空列表', 400);
            return send(res, 200, await completeEvent(db, actor, id, version,
              { held: body.held, actualCount: body.actualCount, issues: body.issues }, key));
          }
          if (action === 'repeat') return send(res, 201, await repeatEvent(db, actor, id, key));
          if (action === 'expenses') return send(res, 201, await recordExpense(db, actor, id, version, body.totalFen, key,
            body.expectedLedgerRevision));
          if (action === 'feedback') return send(res, 201, await recordOutcomeFeedback(db, actor, id, version,
            { held: body.held, wouldRepeat: body.wouldRepeat, reason: body.reason }, key));
        }
      }
      const regMatch = path.match(/^\/registrations\/([^/]+)\/(cancel|approve|reconfirm|remove)$/);
      if (regMatch && method === 'POST') {
        const key = keyFrom(req); const body = await readJson(req); const version = versionFrom(body.expectedVersion);
        if (regMatch[2] === 'cancel') return send(res, 200, await cancelRegistration(db, actor, regMatch[1]!, version, key));
        if (regMatch[2] === 'approve') return send(res, 200, await approveRegistration(db, actor, regMatch[1]!, version, key));
        if (regMatch[2] === 'remove') return send(res, 200, await removeRegistration(db, actor, regMatch[1]!, version, body.reason, key));
        return send(res, 200, await reconfirm(db, actor, regMatch[1]!, version, key, options.clock?.()));
      }
      const manualCheckInMatch = path.match(/^\/manual-checkins\/([^/]+)\/respond$/);
      if (manualCheckInMatch && method === 'POST') {
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await respondManualCheckIn(db, actor, manualCheckInMatch[1]!, versionFrom(body.expectedVersion),
          body.accepted, key, options.clock?.()));
      }
      const shareMatch = path.match(/^\/expenses\/([^/]+)\/shares\/([^/]+)$/);
      if (shareMatch && method === 'POST') {
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await markExpenseShare(db, actor, shareMatch[1]!, shareMatch[2]!, versionFrom(body.expectedVersion), body.field, body.value, key));
      }
      const claimMatch = path.match(/^\/reservations\/([^/]+)\/claim$/);
      if (claimMatch && method === 'POST') {
        const key = keyFrom(req); const body = await readJson(req);
        return send(res, 200, await claimReservation(db, actor, claimMatch[1]!, versionFrom(body.expectedVersion), key));
      }
      const offerMatch = path.match(/^\/offers\/([^/]+)\/(accept|decline)$/);
      if (offerMatch && method === 'POST') {
        const key = keyFrom(req); const body = await readJson(req);
        const version = versionFrom(body.expectedVersion);
        return send(res, 200, offerMatch[2] === 'accept'
          ? await acceptOffer(db, actor, offerMatch[1]!, version, key)
          : await declineOffer(db, actor, offerMatch[1]!, version, key));
      }
      throw new AppError('NOT_FOUND', '接口不存在', 404);
    } catch (error) {
      if (error instanceof AppError) {
        if (error.retryAfterSeconds) res.setHeader('Retry-After', String(error.retryAfterSeconds));
        send(res, error.status, { code: error.code, message: error.message });
      }
      else send(res, 500, { code: 'INTERNAL_ERROR', message: '服务暂时不可用' });
    }
  }));
}
