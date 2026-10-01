const { api } = require('../../utils/api.js');
const { drawCheckInQr } = require('../../utils/checkin-qr.js');
const config = require('../../config.js');
function currentActorId() {
  return wx.getStorageSync('sessionToken') ? wx.getStorageSync('userId')
    : wx.getStorageSync('devUser') || config.developmentUser || '';
}
function currentIdentity() {
  const token = wx.getStorageSync('sessionToken');
  return token ? 'session:' + currentActorId() + ':' + token : currentActorId();
}
function editorIdentity() {
  const token = wx.getStorageSync('sessionToken');
  return token ? 'session:' + wx.getStorageSync('userId') + ':' + token
    : 'dev:' + (wx.getStorageSync('devUser') || config.developmentUser || '');
}
function newSourceToken() {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0')).join('');
}
function yuanFromFen(fen) {
  if (!Number.isSafeInteger(fen) || fen < 0) return '金额待核对';
  return `¥${Math.floor(fen / 100)}.${String(fen % 100).padStart(2, '0')}`;
}
function readOptional(path) {
  return api.get(path).then(value => ({ value }), error => ({ error }));
}
function optionalItems(result, enabled, label, itemType = 'object') {
  if (!enabled) return { items: [], state: 'FORBIDDEN', error: '' };
  if (result?.error || !Array.isArray(result?.value?.items) ||
    !result.value.items.every(item => item !== null && typeof item === itemType)) {
    const error = result?.error;
    return { items: [], state: error?.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR',
      error: error?.message || `${label}无效，请重试` };
  }
  return { items: result.value.items, state: result.value.items.length ? 'READY' : 'EMPTY', error: '' };
}
function statusText(status, context) {
  const labels = {
    registration: { INTERESTED: '暂不确定', REQUESTED: '待审核', WAITLISTED: '候补中', OFFERED: '待确认补位',
      CONFIRMED: '已确认', RECONFIRM_REQUIRED: '待重新确认', CANCELLED: '已退出', EXPIRED: '已过期',
      REJECTED: '未通过', REMOVED: '已移除' },
    manual: { PENDING: '待本人确认', CONFIRMED: '本人已确认', REJECTED: '本人已拒绝', SUPERSEDED: '已有其他到场记录' },
    fact: { OPEN: '待回答', RESOLVED: '已回答', REJECTED: '未通过' },
    attention: { EVENT_CANCELLED: '活动取消提醒', EVENT_EXPIRED: '活动未成局提醒',
      UNAVAILABLE: '外部通道不可用', PURPOSE_NOT_CONFIGURED: '外部用途未配置',
      UNKNOWN_REQUIRES_RECONCILIATION: '外部状态待核查', PROVIDER_REJECTED: '外部提供方拒绝',
      SENT: '提供方已接收', DELIVERED: '已确认送达' },
    expense: { RECORD_ONLY: '仅作记录', OPEN: '待处理', SETTLED: '已核对', CLOSED: '已关闭' },
    outcome: { NOT_HELD: '未举办', HOST_ONLY: '仅主办方结项', MEMBER_CORROBORATED: '成员独立确认',
      DISPUTED: '存在争议' },
    evidence: { SCAN: '扫码', MANUAL_CONFIRMED: '本人确认的人工补记' }
  };
  return labels[context]?.[status] || '状态待核对';
}
function eventPersonNames(eventId, actor, hostId, aliases) {
  const names = new Map(aliases.filter(item => /^[a-f0-9]{16}$/.test(item.id || '') &&
    typeof item.displayName === 'string').map(item => [item.id, item.displayName]));
  const hashAlias = names.size ? require('../../utils/sha256.js').sha256 : null;
  const anonymous = new Map();
  return userId => {
    if (userId === actor) return '我';
    const consented = userId && hashAlias && names.get(hashAlias(`${eventId}:${userId}`).slice(0, 16));
    if (consented) return consented;
    if (userId === hostId) return '主办方';
    if (!anonymous.has(userId)) anonymous.set(userId, anonymous.size + 1);
    return `参与者 ${anonymous.get(userId)}`;
  };
}
function chinaMomentOrUnknown(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? chinaMoment(timestamp) : '时间待确认';
}
function chinaDateTimeOrUnknown(value) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return '时间待确认';
  const local = new Date(timestamp + 8 * 60 * 60_000);
  return `${local.getUTCFullYear()}年${chinaMoment(timestamp)}`;
}
function changeValueLabel(field, value) {
  if (value == null || value === '') return '未设置';
  if (field === 'startAt' || field === 'endAt') return chinaDateTimeOrUnknown(value);
  if (field === 'feeCapFen') return yuanFromFen(value);
  return String(value);
}
function contentTimeline(items, displayPerson, hostId, actor, ownAlias) {
  const rows = items.map(item => {
    const isSystem = item.author_id === 'system';
    const isHostAuthor = !isSystem && item.author_id === hostId;
    return { ...item,
      authorName: isSystem ? '系统更新' : item.author_id === actor && ownAlias ? ownAlias : displayPerson(item.author_id),
      authorRole: isSystem ? '系统更新' : isHostAuthor ? '主办方' : '活动成员',
      avatarGlyph: isSystem ? '✦' : isHostAuthor ? '主' : '友',
      timeLabel: chinaMomentOrUnknown(item.created_at),
      statusLabel: { APPROVED: '', PENDING_REVIEW: '审核中 · 仅自己可见', REJECTED: '未通过 · 仅自己可见' }[item.status] ?? '状态待核对',
      replies: [] };
  });
  const byId = new Map(rows.map(item => [item.id, item]));
  const topLevel = [];
  for (const row of rows) {
    const parent = row.kind === 'ANSWER' && row.parent_id ? byId.get(row.parent_id) : null;
    if (parent?.kind === 'QUESTION') parent.replies.push(row);
    else topLevel.push(row);
  }
  const newestFirst = (a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0);
  topLevel.sort(newestFirst);
  for (const row of topLevel) row.replies.sort(newestFirst);
  return topLevel;
}
function visibleExpenseShares(ledger) {
  const shares = ledger.sortByAmount
    ? ledger.shares.map((share, index) => ({ share, index }))
      .sort((a, b) => b.share.amountFen - a.share.amountFen || a.index - b.index)
      .map(item => item.share)
    : ledger.shares;
  return ledger.membersExpanded ? shares : shares.slice(0, 4);
}
function changeExpenseLedger(page, ledgerId, changes) {
  if (page.data.expenseLoadState !== 'READY' || typeof ledgerId !== 'string') return;
  const index = page.data.expenses.findIndex(item => item.id === ledgerId);
  if (index < 0) return;
  const updated = { ...page.data.expenses[index], ...changes };
  updated.visibleShares = visibleExpenseShares(updated);
  page.setData({ expenses: page.data.expenses.map((item, position) => position === index ? updated : item) });
}
function eventDisplay(event) {
  const payload = event.payload || {};
  const title = payload.title || event.title || '未命名活动';
  const format = value => {
    const timestamp = Date.parse(value || '');
    if (!Number.isFinite(timestamp)) return '待确认';
    const local = new Date(timestamp + 8 * 60 * 60_000);
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][local.getUTCDay()];
    return `${local.getUTCMonth() + 1}月${local.getUTCDate()}日（${weekday}）${local.toISOString().slice(11, 16)}`;
  };
  const feeCap = Number(payload.feeCapFen);
  const startAt = payload.startAt || event.startAt;
  const endAt = payload.endAt || event.endAt;
  const startTime = Date.parse(startAt || '');
  const endTime = Date.parse(endAt || '');
  const chinaDay = timestamp => new Date(timestamp + 8 * 60 * 60_000).toISOString().slice(0, 10);
  const compactEnd = Number.isFinite(startTime) && Number.isFinite(endTime) && chinaDay(startTime) === chinaDay(endTime)
    ? new Date(endTime + 8 * 60 * 60_000).toISOString().slice(11, 16) : format(endAt);
  return {
    title,
    isBadminton: payload.type === 'badminton' || /羽毛球|badminton/i.test(title),
    date: format(startAt),
    end: compactEnd,
    location: [payload.city || event.city, payload.venueName || event.venueName].filter(Boolean).join(' · ') || '地点待确认',
    fee: payload.feeMode === 'FREE' ? '免费' : payload.feeMode === 'AA' && Number.isFinite(feeCap)
      ? `AA 制 · 每人上限 ¥${feeCap / 100}` : '费用待确认',
    status: { DRAFT: '草稿', RECRUITING: '招募中', CONFIRMED: '已成局', IN_PROGRESS: '进行中',
      COMPLETED: '已结束', CANCELLED: '已取消', EXPIRED: '未成局' }[event.status] || event.status || '状态待确认'
  };
}
function chinaMoment(timestamp) {
  const date = new Date(timestamp + 8 * 60 * 60_000);
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日 ${date.toISOString().slice(11, 16)}`;
}
function timedEventControls(event, now, myStatus, isHost, canManageCheckins) {
  const start = Date.parse(event?.payload?.startAt || '');
  const end = Date.parse(event?.payload?.endAt || '');
  const eligibleStatus = ['CONFIRMED', 'IN_PROGRESS'].includes(event?.status);
  const validTime = Number.isFinite(start) && Number.isFinite(end) && start < end;
  const opens = start - 30 * 60_000;
  const closes = end + 30 * 60_000;
  const checkInOpen = eligibleStatus && validTime && now >= opens && now <= closes;
  const checkInWindowNotice = !validTime ? '活动时间待确认，暂不能签到。' : !eligibleStatus
    ? '当前活动状态不能生成签到码或记录扫码签到。'
    : now < opens ? `签到将于 ${chinaMoment(opens)} 开放（活动开始前 30 分钟）。`
      : now > closes ? `签到已于 ${chinaMoment(closes)} 结束（活动结束后 30 分钟）。`
        : `现场签到进行中，将于 ${chinaMoment(closes)} 结束。`;
  const canCompleteEvent = Boolean(isHost && eligibleStatus && validTime && now >= end);
  const completionAvailability = !validTime ? '活动结束时间待确认，暂不能结项。'
    : !eligibleStatus ? '当前活动状态不能结项。'
      : now < end ? `活动结束后（${chinaMoment(end)}）可填写实际举办情况并结项。`
        : '活动已到结束时间，可填写实际举办情况并结项。';
  return {
    canCheckIn: Boolean(myStatus === 'CONFIRMED' && checkInOpen),
    canGenerateCheckInToken: Boolean((isHost || canManageCheckins) && checkInOpen),
    canCompleteEvent,
    checkInWindowNotice,
    checkInAvailability: myStatus === 'CONFIRMED' ? checkInWindowNotice
      : '只有已确认席位的参与者可现场扫码签到；请先查看报名状态。',
    completionAvailability,
    nextTimeBoundary: validTime ? [opens, end, closes + 1].filter(at => at > now).sort((a, b) => a - b)[0] : undefined
  };
}
function canCopyPublishedInvite(event, isHost, safetyStatus, now, inviteValidUntil) {
  const deadline = Date.parse(event?.payload?.registrationDeadline || '');
  return Boolean(isHost && event?.inviteToken && event.reviewStatus === 'APPROVED' &&
    event.recruiting && !event.riskPaused && safetyStatus === 'OPEN' &&
    typeof event.inviteRemainingMs === 'number' && Number.isFinite(event.inviteRemainingMs) &&
    event.inviteRemainingMs > 0 && Number.isFinite(inviteValidUntil) && now < inviteValidUntil &&
    Number.isFinite(deadline) && now < deadline);
}
function currentHostEvent(page) {
  return Boolean(page.data.isHost && page.data.id && page.data.event?.id === page.data.id &&
    page.data.event.hostId === currentActorId() &&
    page.data.currentUser && page.data.currentUser === currentIdentity());
}
function actionContext(page) {
  const actor = currentIdentity();
  const { id, event, loadState, currentUser } = page.data;
  if (loadState !== 'READY' || !id || event?.id !== id || !currentUser || currentUser !== actor)
    return null;
  return { actor, eventId: id, version: event.version };
}
function sameActionContext(page, context) {
  const current = actionContext(page);
  return Boolean(current && context && current.actor === context.actor &&
    current.eventId === context.eventId && current.version === context.version);
}
function sameActionOwner(page, context) {
  return Boolean(context && currentIdentity() === context.actor &&
    page.data.currentUser === context.actor && page.data.id === context.eventId &&
    page.data.event?.id === context.eventId);
}
function actionPathMatchesEvent(page, path, payload, eventId) {
  const eventPath = /^\/events\/([^/]+)(?:\/|$)/.exec(path);
  const registrationPath = /^\/registrations\/([^/]+)(?:\/|$)/.exec(path);
  const manualPath = /^\/manual-checkins\/([^/]+)(?:\/|$)/.exec(path);
  const expensePath = /^\/expenses\/([^/]+)\/shares\/([^/]+)$/.exec(path);
  try {
    if (eventPath) return decodeURIComponent(eventPath[1]) === eventId;
    if (registrationPath) {
      const id = decodeURIComponent(registrationPath[1]);
      return [page.data.myRegistration, ...(page.data.registrations || [])].some(item =>
        item?.id === id && (item.event_id === eventId || item.eventId === eventId));
    }
    if (manualPath) {
      const id = decodeURIComponent(manualPath[1]);
      return (page.data.manualCheckIns || []).some(item => item.id === id &&
        (!item.eventId || item.eventId === eventId) && (!item.event_id || item.event_id === eventId));
    }
    if (expensePath) {
      const ledgerId = decodeURIComponent(expensePath[1]);
      const userId = decodeURIComponent(expensePath[2]);
      return (page.data.expenses || []).some(ledger => ledger.id === ledgerId &&
        ledger.eventId === eventId &&
        ledger.shares?.some(share => share.userId === userId));
    }
    if (/^\/reservations\/[^/]+\/claim$/.test(path)) return payload?.expectedEventId === eventId;
    return false;
  }
  catch (_) { return false; }
}
function sectionAvailable(section, isHost, canApproveRegistration, canManageAnnouncements, canManageCheckins) {
  return ['detailsSection', 'registrationSection', 'contentSection', 'checkinSection', 'expenseSection'].includes(section) ||
    (section === 'hostSection' && isHost) ||
    (section === 'cohostApprovalSection' && !isHost && canApproveRegistration) ||
    (section === 'cohostContentSection' && !isHost && canManageAnnouncements) ||
    (section === 'cohostCheckinSection' && !isHost && canManageCheckins);
}
const sectionHeadings = {
  detailsSection: ['活动详情', '耍起 CAPER · 线下见面'],
  registrationSection: ['报名与成员', '席位与活动内昵称'],
  contentSection: ['活动公告', '一起把这场活动变得更好'],
  checkinSection: ['签到与反馈', '见面 · 参与 · 留下回忆'],
  expenseSection: ['费用记录', 'AA 制，更轻松也更尽兴'],
  hostSection: ['主办方工作台', '报名、成局与现场管理'],
  cohostApprovalSection: ['协办报名审批', '仅限本场授权'],
  cohostContentSection: ['协办公告与回答', '仅限本场授权'],
  cohostCheckinSection: ['协办签到管理', '仅限本场授权']
};
Page({
  data: { statusBarHeight: 24, id: '', token: '', source: '', activeSection: 'detailsSection', sectionTitle: '活动详情', sectionSubtitle: '耍起 CAPER · 线下见面', checkInMode: 'participant', event: null, display: null, registrationLabel: '未报名', inviteSummary: null, loadState: 'IDLE', isHost: false, successState: '', canCopyPublishedInvite: false,
    joinConfirmation: null, joinSubmitting: false,
    canJoin: false, canExpressInterest: false, canUseCollaboration: false, canPostQuestion: false, canCheckIn: false,
    canGenerateCheckInToken: false, canCompleteEvent: false, checkInWindowNotice: '', checkInAvailability: '', completionAvailability: '',
    canApproveRegistration: false, canManageCheckins: false, canManageAnnouncements: false,
    myRegistration: null, registrations: [], registrationsLoadState: 'IDLE', registrationsError: '', joinChoice: 'JOIN',
    cohostGrants: [], cohostGrantsLoadState: 'IDLE', cohostGrantsError: '', cohostUserId: '', cohostSelectedName: '',
    selectedCohostCapabilities: ['CHECKIN_MANAGE'], aliases: [], memberCards: [], confirmedRoster: [],
    safetyStatus: 'UNKNOWN',
    hostAlias: '', aliasInput: '', canSetAlias: false, aliasNoticeVersion: '', aliasNoticeText: '',
    aliasReconfirmationRequired: false, aliasLoadState: 'IDLE', aliasError: '',
    shareMetrics: null, shareMetricsLoadState: 'IDLE', shareMetricsError: '', shareSourceToken: '', preparingShare: false,
    repeatCandidates: [], repeatCandidatesLoadState: 'IDLE', repeatCandidatesError: '', repeatCandidateNames: '暂无',
    attentionItems: [], attentionLoadState: 'IDLE', attentionError: '',
    factTodos: [], factTodosLoadState: 'IDLE', factTodosError: '', message: '',
    reservationToken: '', reservationTokens: [], checkInToken: '', displayedCheckInToken: '', checkInExpiresIn: 0,
    totalYuan: '', actualCount: '', completionHeld: null, completionAnomaly: '', completionVenueIssue: '', content: [], contentTimeline: [], contentLoadState: 'IDLE', contentError: '',
    expenses: [], expenseLoadState: 'IDLE', expenseError: '', outcome: null, outcomeLoadState: 'IDLE', outcomeError: '',
    checkIns: [], manualCheckIns: [], attendanceLoadState: 'IDLE', attendanceError: '',
    reconfirmation: null, reconfirmationLoadState: 'IDLE', reconfirmationError: '',
    canRequestManualCheckIn: false, currentUser: '',
    feedbackHeld: null, feedbackWouldRepeat: null, feedbackReason: '', feedbackSubmitting: false, feedbackUncertain: false, questionText: '', factQuestionText: '',
    announcementText: '', answerText: '', answerQuestionId: '', answerQuestionLabel: '', answerInputFocus: false,
    removalReason: '' },
  async onLoad(options) {
    this.feedbackRequestId = (this.feedbackRequestId || 0) + 1;
    this.feedbackUncertainRequest = null;
    const pendingExitIntent = options.id && options.section === 'registrationSection' && options.entry === 'pendingExit'
      ? { eventId: options.id, actor: '' } : null;
    this.pendingExitIntent = pendingExitIntent;
    this.setData({ statusBarHeight: wx.getSystemInfoSync?.().statusBarHeight || 24,
      id: options.id || '', token: options.token || '', source: options.source || '', activeSection: 'detailsSection', sectionTitle: '活动详情', sectionSubtitle: '耍起 CAPER · 线下见面', checkInMode: 'participant', successState: '', feedbackSubmitting: false, feedbackUncertain: false });
    await getApp().globalData.ready;
    if (pendingExitIntent && this.pendingExitIntent === pendingExitIntent)
      pendingExitIntent.actor = currentIdentity();
    const loaded = await this.refresh();
    if (loaded && options.success === 'published' && this.data.isHost &&
      this.data.event?.id === options.id && this.data.event.status === 'RECRUITING' &&
      ['PENDING', 'APPROVED'].includes(this.data.event.reviewStatus))
      this.setData({ successState: 'PUBLISHED' });
    if (loaded && this.data.loadState === 'READY' &&
      sectionAvailable(options.section, this.data.isHost, this.data.canApproveRegistration,
        this.data.canManageAnnouncements, this.data.canManageCheckins)) {
      if (typeof wx.nextTick === 'function') await new Promise(resolve => wx.nextTick(resolve));
      if (this.data.currentUser && this.data.currentUser !== currentIdentity()) return;
      const sameEvent = Boolean(options.id && this.data.event?.id === options.id);
      const hostCheckin = sameEvent && options.section === 'checkinSection' && options.entry === 'hostCheckin' &&
        this.data.isHost && this.data.canManageCheckins &&
        ['CONFIRMED', 'IN_PROGRESS'].includes(this.data.event.status);
      const hostAnnouncement = sameEvent && options.section === 'hostSection' && options.entry === 'hostAnnouncement' &&
        this.data.isHost && this.data.canManageAnnouncements && this.data.event.status === 'RECRUITING' &&
        this.data.event.reviewStatus === 'APPROVED' && this.data.event.recruiting === true;
      const hostRepeat = sameEvent && options.section === 'hostSection' && options.entry === 'hostRepeat' &&
        this.data.isHost && this.data.event.status === 'COMPLETED' && this.data.safetyStatus === 'OPEN';
      const hostCompletion = sameEvent && options.section === 'hostSection' && options.entry === 'hostCompletion' &&
        this.data.isHost && this.data.currentUser && this.data.currentUser === currentIdentity() &&
        this.updateTimedControls().canCompleteEvent;
      const memberFeedback = sameEvent && options.section === 'checkinSection' && options.entry === 'memberFeedback' &&
        this.data.currentUser && this.data.currentUser === currentIdentity() &&
        this.data.event.status === 'COMPLETED' && !this.data.isHost &&
        this.data.myRegistration?.status === 'CONFIRMED' && this.data.outcomeLoadState === 'READY' &&
        this.data.outcome;
      const memberFeedbackAnchor = memberFeedback ?
        this.data.outcome.myFeedbackSubmitted ? '#memberFeedbackCard' : '#feedbackForm' : '';
      const aliasForm = sameEvent && options.section === 'registrationSection' && options.entry === 'alias' &&
        this.data.canSetAlias && this.data.aliasLoadState === 'READY';
      const pendingExit = sameEvent && options.section === 'registrationSection' && options.entry === 'pendingExit' &&
        this.data.currentUser === currentIdentity() && !this.data.isHost &&
        this.data.myRegistration?.event_id === options.id && this.data.myRegistration.status === 'REQUESTED' &&
        ['REVIEW_PENDING', 'RECRUITING', 'CONFIRMED'].includes(this.data.event.status);
      if (hostCheckin) this.setData({ checkInMode: 'host' });
      this.scrollToSection(options.section, pendingExit ? '#leaveButton' : aliasForm ? '#aliasForm' : memberFeedbackAnchor ? memberFeedbackAnchor :
        hostAnnouncement ? '#hostAnnouncementAnchor' : hostRepeat ? '#hostRepeatAnchor' :
          hostCompletion ? '#hostCompletionForm' : '');
    }
  },
  async onShow() {
    this.checkInPageHidden = false;
    const actor = currentIdentity();
    if (this.data.currentUser && this.data.currentUser !== actor) {
      this.pendingExitIntent = null;
      this.feedbackRequestId = (this.feedbackRequestId || 0) + 1;
      this.feedbackUncertainRequest = null;
      this.refreshId = (this.refreshId || 0) + 1;
      this.clearCheckInToken();
      this.setData({ token: '', source: '', activeSection: 'detailsSection', sectionTitle: '活动详情', sectionSubtitle: '耍起 CAPER · 线下见面', checkInMode: 'participant', event: null, display: null, registrationLabel: '未报名', inviteSummary: null, loadState: 'IDLE', isHost: false, successState: '', canCopyPublishedInvite: false,
        joinConfirmation: null, joinSubmitting: false,
        canJoin: false, canExpressInterest: false, canUseCollaboration: false, canPostQuestion: false, canCheckIn: false,
        canGenerateCheckInToken: false, canCompleteEvent: false, checkInWindowNotice: '', checkInAvailability: '', completionAvailability: '',
        canApproveRegistration: false, canManageCheckins: false, canManageAnnouncements: false,
        safetyStatus: 'UNKNOWN', myRegistration: null,
        registrations: [], registrationsLoadState: 'IDLE', registrationsError: '',
        cohostGrants: [], cohostGrantsLoadState: 'IDLE', cohostGrantsError: '', cohostUserId: '', cohostSelectedName: '',
        selectedCohostCapabilities: ['CHECKIN_MANAGE'], aliases: [], memberCards: [], confirmedRoster: [], hostAlias: '', aliasInput: '', canSetAlias: false,
        aliasNoticeVersion: '', aliasNoticeText: '', aliasReconfirmationRequired: false, aliasLoadState: 'IDLE', aliasError: '',
        shareMetrics: null, shareMetricsLoadState: 'IDLE', shareMetricsError: '', shareSourceToken: '',
        preparingShare: false, repeatCandidates: [], repeatCandidatesLoadState: 'IDLE', repeatCandidatesError: '',
        repeatCandidateNames: '暂无', attentionItems: [], attentionLoadState: 'IDLE', attentionError: '',
        factTodos: [], factTodosLoadState: 'IDLE', factTodosError: '', content: [], contentTimeline: [], contentLoadState: 'IDLE', contentError: '',
        expenses: [], expenseLoadState: 'IDLE', expenseError: '', outcome: null, outcomeLoadState: 'IDLE', outcomeError: '',
        checkIns: [], manualCheckIns: [], attendanceLoadState: 'IDLE', attendanceError: '',
        reconfirmation: null, reconfirmationLoadState: 'IDLE', reconfirmationError: '', canRequestManualCheckIn: false,
        reservationToken: '', reservationTokens: [], checkInToken: '', displayedCheckInToken: '', checkInExpiresIn: 0,
        totalYuan: '', actualCount: '', completionHeld: null, completionAnomaly: '', completionVenueIssue: '', feedbackHeld: null, feedbackWouldRepeat: null, feedbackSubmitting: false, feedbackUncertain: false,
        feedbackReason: '', questionText: '', factQuestionText: '', announcementText: '', answerText: '',
        answerQuestionId: '', answerQuestionLabel: '', answerInputFocus: false, removalReason: '',
        message: '', currentUser: actor });
    }
    if (!this.hasShown) { this.hasShown = true; return; }
    await getApp().globalData.ready;
    await this.refresh();
  },
  onHide() {
    this.checkInPageHidden = true;
    this.hostAnnouncementAttemptId = (this.hostAnnouncementAttemptId || 0) + 1;
    this.expenseShareAttemptId = (this.expenseShareAttemptId || 0) + 1;
    this.expenseShareSubmitting = false;
    this.calendarAttemptId = (this.calendarAttemptId || 0) + 1;
    this.calendarSubmitting = false;
    this.clearCheckInToken();
    this.clearTimeBoundaryTimer();
    this.closeJoinConfirmation();
    if (this.data.successState) this.setData({ successState: '' });
  },
  onUnload() {
    this.checkInPageHidden = true;
    this.hostAnnouncementAttemptId = (this.hostAnnouncementAttemptId || 0) + 1;
    this.expenseShareAttemptId = (this.expenseShareAttemptId || 0) + 1;
    this.expenseShareSubmitting = false;
    this.calendarAttemptId = (this.calendarAttemptId || 0) + 1;
    this.calendarSubmitting = false;
    this.clearCheckInToken();
    this.clearTimeBoundaryTimer();
    this.closeJoinConfirmation();
  },
  clearCheckInToken() {
    this.checkInRequestId = (this.checkInRequestId || 0) + 1;
    clearTimeout(this.checkInRefreshTimer);
    this.checkInRefreshTimer = null;
    if (this.data.displayedCheckInToken) this.setData({ displayedCheckInToken: '', checkInExpiresIn: 0 });
  },
  clearTimeBoundaryTimer() {
    clearTimeout(this.timeBoundaryTimer);
    this.timeBoundaryTimer = null;
  },
  updateTimedControls() {
    const now = Date.now();
    const controls = timedEventControls(this.data.event, now, this.data.myRegistration?.status,
      this.data.isHost, this.data.canManageCheckins);
    const canCopyInvite = canCopyPublishedInvite(this.data.event, this.data.isHost,
      this.data.safetyStatus, now, this._inviteValidUntil);
    const registrationDeadline = canCopyInvite ? Date.parse(this.data.event.payload.registrationDeadline) : Infinity;
    const inviteDeadline = canCopyInvite ? this._inviteValidUntil : Infinity;
    const nextTimeBoundary = Math.min(controls.nextTimeBoundary || Infinity, registrationDeadline, inviteDeadline);
    if (!controls.canGenerateCheckInToken && this.data.displayedCheckInToken) this.clearCheckInToken();
    this.setData({ canCheckIn: controls.canCheckIn, canGenerateCheckInToken: controls.canGenerateCheckInToken,
      canCopyPublishedInvite: canCopyInvite,
      canCompleteEvent: controls.canCompleteEvent, checkInWindowNotice: controls.checkInWindowNotice,
      checkInAvailability: controls.checkInAvailability, completionAvailability: controls.completionAvailability });
    this.clearTimeBoundaryTimer();
    if (this.data.event && !this.checkInPageHidden && Number.isFinite(nextTimeBoundary)) {
      const eventId = this.data.event.id;
      this.timeBoundaryTimer = setTimeout(() => {
        if (this.data.event?.id === eventId && !this.checkInPageHidden) this.updateTimedControls();
      }, Math.max(1, Math.min(nextTimeBoundary - Date.now(), 2_147_483_647)));
      if (typeof this.timeBoundaryTimer?.unref === 'function') this.timeBoundaryTimer.unref();
    }
    return controls;
  },
  async refresh() {
    const refreshId = (this.refreshId || 0) + 1;
    this.refreshId = refreshId;
    this.clearCheckInToken();
    this.clearTimeBoundaryTimer();
    this._inviteValidUntil = 0;
    const requestedAt = Date.now();
    const actor = currentIdentity();
    this.setData({ loadState: 'LOADING', canCopyPublishedInvite: false });
    let summary = null;
    try {
      if (this.data.token) {
        try {
          summary = await api.get('/i/' + encodeURIComponent(this.data.token) +
            (this.data.source ? '?source=' + encodeURIComponent(this.data.source) : ''));
        } catch (error) {
          // A known member may still read the last approved activity details by id.
          if (!this.data.id) throw error;
        }
      }
      if (summary && this.data.id && summary.id !== this.data.id)
        throw new Error('邀请口令与活动不匹配，请打开对应活动');
      const id = this.data.id || summary?.id;
      if (!id) {
        if (refreshId === this.refreshId) this.setData({ loadState: 'ERROR', message: '邀请或活动不存在' });
        return false;
      }
      const mine = await api.get('/me/registrations?eventId=' + encodeURIComponent(id));
      if (!Array.isArray(mine?.items)) throw new Error('本人报名状态无效，请重试');
      const myRegistration = mine.items.find(item => item.event_id === id) || null;
      const myStatus = myRegistration?.status;
      const knownMember = ['INTERESTED', 'REQUESTED', 'WAITLISTED', 'OFFERED', 'CONFIRMED', 'RECONFIRM_REQUIRED'].includes(myStatus);
      const privilegedFromOwnList = summary && !knownMember && summary.payload?.visibility !== 'PUBLIC'
        ? (await api.get('/me/events').catch(() => ({ items: [] }))).items.some(item =>
          item.id === id && (item.isHost || item.isCohost))
        : false;
      let event = summary;
      if (!summary || summary.payload?.visibility === 'PUBLIC' || knownMember || privilegedFromOwnList) {
        try { event = await api.get('/events/' + encodeURIComponent(id)); }
        catch (error) { if (!summary) throw error; }
      }
      if (!event || event.id !== id) throw new Error('活动信息不匹配，请刷新页面');
      const actorId = currentActorId();
      const isHost = event.hostId === actorId;
      const cohostCapabilities = Array.isArray(event.cohostCapabilities) ? event.cohostCapabilities : [];
      const canApproveRegistration = isHost || cohostCapabilities.includes('APPROVE_REGISTRATION');
      const canManageCheckins = isHost || cohostCapabilities.includes('CHECKIN_MANAGE');
      const canManageAnnouncements = isHost || cohostCapabilities.includes('MANAGE_ANNOUNCEMENTS');
      const registrationLabel = { CONFIRMED: '已确认报名', REQUESTED: '待主办方审核', WAITLISTED: '候补中',
        OFFERED: '待确认补位', INTERESTED: '暂不确定', RECONFIRM_REQUIRED: '待重新确认',
        CANCELLED: '已退出', EXPIRED: '已过期', REJECTED: '未通过' }[myStatus] || '未报名';
      const canJoin = !myStatus || ['CANCELLED', 'EXPIRED', 'REJECTED', 'INTERESTED'].includes(myStatus);
      const canExpressInterest = !myStatus || ['CANCELLED', 'EXPIRED', 'REJECTED'].includes(myStatus);
      const canUseCollaboration = isHost || cohostCapabilities.length > 0 || ['CONFIRMED', 'RECONFIRM_REQUIRED', 'WAITLISTED', 'OFFERED'].includes(myStatus);
      const canPostQuestion = canUseCollaboration && ['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(event.status);
      const timedControls = timedEventControls(event, Date.now(), myStatus, isHost, canManageCheckins);
      const canReadAliases = isHost || ['CONFIRMED', 'RECONFIRM_REQUIRED', 'WAITLISTED', 'OFFERED'].includes(myStatus);
      const canReadRegistrations = canApproveRegistration || canManageCheckins;
      const canReadExpenses = isHost || ['CONFIRMED', 'RECONFIRM_REQUIRED'].includes(myStatus);
      const canReadAttendance = isHost || cohostCapabilities.length > 0 ||
        ['INTERESTED', 'REQUESTED', 'WAITLISTED', 'OFFERED', 'CONFIRMED', 'RECONFIRM_REQUIRED'].includes(myStatus);
      const needsReconfirmation = myStatus === 'RECONFIRM_REQUIRED';
      const hasOutcome = event.status === 'COMPLETED';
      const readIf = (enabled, path) => enabled ? readOptional(path) : Promise.resolve(null);
      const base = `/events/${encodeURIComponent(id)}`;
      const [safetyRead, aliasRead, registrationRead, cohostRead, shareRead, repeatRead,
        attentionRead, factRead, contentRead, expenseRead, manualRead, scannedRead,
        reconfirmationRead, outcomeRead] = await Promise.all([
        readOptional('/system/safety'), readIf(canReadAliases, `${base}/aliases`),
        readIf(canReadRegistrations, `${base}/registrations`), readIf(isHost, `${base}/cohosts`),
        readIf(isHost && event.status !== 'DRAFT', `${base}/share-metrics`),
        readIf(isHost && hasOutcome, `${base}/repeat-candidates`),
        readIf(isHost && ['CANCELLED', 'EXPIRED'].includes(event.status), `${base}/attention`),
        readIf(isHost && event.status !== 'DRAFT', `${base}/fact-todos`),
        readIf(canUseCollaboration, `${base}/content`), readIf(canReadExpenses, `${base}/expenses`),
        readIf(canReadAttendance, `${base}/manual-checkins`), readIf(canReadAttendance, `${base}/checkins`),
        readIf(needsReconfirmation, `${base}/reconfirmation`), readIf(hasOutcome, `${base}/outcome`)
      ]);
      const safetyStatus = ['OPEN', 'CLOSED'].includes(safetyRead.value?.status) ? safetyRead.value.status : 'UNKNOWN';
      let aliasResponse = { items: [], notice: null, reconfirmationRequired: false };
      let aliasLoadState = canReadAliases ? 'READY' : 'FORBIDDEN'; let aliasError = '';
      if (canReadAliases) try {
        if (aliasRead.error) throw aliasRead.error;
        aliasResponse = aliasRead.value;
        if (!Array.isArray(aliasResponse.items) ||
          !aliasResponse.items.every(item => item && typeof item === 'object' &&
            typeof item.id === 'string' && typeof item.displayName === 'string') ||
          !aliasResponse.notice?.version || !aliasResponse.notice?.text)
          throw new Error('昵称授权信息无效，请重试');
      } catch (error) {
        aliasResponse = { items: [], notice: null, reconfirmationRequired: false };
        aliasLoadState = 'ERROR'; aliasError = error.message || '昵称授权信息加载失败，请重试';
      }
      const aliases = aliasResponse.items;
      const hostAlias = aliases.find(item => item.isHost)?.displayName || '主办方未设置活动内昵称';
      const canSetAlias = isHost || ['CONFIRMED', 'RECONFIRM_REQUIRED', 'WAITLISTED', 'OFFERED'].includes(myRegistration?.status);
      const displayPerson = eventPersonNames(id, actorId, event.hostId, aliases);
      const registrationSection = optionalItems(registrationRead, canReadRegistrations, '报名名单');
      const registrations = registrationSection.items.map(item => {
        if ((item.event_id && item.event_id !== id) || (item.eventId && item.eventId !== id))
          throw new Error('报名名单活动不符，请重试');
        return { ...item, eventId: id,
          displayName: displayPerson(item.user_id), statusLabel: statusText(item.status, 'registration') };
      });
      const confirmedRoster = registrations.filter(item => item.status === 'CONFIRMED').map(item => ({ ...item,
        avatarGlyph: item.displayName === '我' ? '我' : '友' }));
      const memberCards = aliases.map(item => ({ ...item,
        avatarGlyph: item.isHost ? '主' : item.isMine ? '我' : '友',
        roleLabel: item.isHost ? '主办方' : item.isMine ? '本人' : '已授权昵称' }));
      const cohostSection = optionalItems(cohostRead, isHost, '协办权限');
      const cohostGrants = cohostSection.items.map(grant => ({ ...grant,
        displayName: displayPerson(grant.userId),
        capabilitiesText: (Array.isArray(grant.capabilities) ? grant.capabilities : []).map(capability => ({ CHECKIN_MANAGE: '签到管理',
          APPROVE_REGISTRATION: '报名审批', MANAGE_ANNOUNCEMENTS: '公告与回答' })[capability] || '权限待核对').join('、'),
        expiresLabel: chinaMomentOrUnknown(grant.expiresAt),
        usable: grant.status === 'ACTIVE' && Date.parse(grant.expiresAt) > Date.now()
      }));
      const shareEnabled = isHost && event.status !== 'DRAFT';
      const shareMetrics = shareEnabled && !shareRead?.error &&
        ['shareIntents', 'attributedOpens', 'unknownSourceOpens'].every(key => Number.isSafeInteger(shareRead?.value?.[key]))
        ? shareRead.value : null;
      const shareMetricsLoadState = !shareEnabled ? 'IDLE' : shareMetrics ? 'READY' : 'ERROR';
      const shareMetricsError = shareMetricsLoadState === 'ERROR' ?
        shareRead?.error?.message || '分享统计无效，请重试' : '';
      const repeatEnabled = isHost && hasOutcome;
      const repeatSection = optionalItems(repeatRead, repeatEnabled, '再约成员名单', 'string');
      const repeatCandidates = repeatSection.items;
      const repeatCandidateNames = repeatSection.state === 'ERROR' ? '名单暂不可用' :
        repeatCandidates.map(displayPerson).join('、') || '暂无';
      const attentionSection = optionalItems(attentionRead,
        isHost && ['CANCELLED', 'EXPIRED'].includes(event.status), '未读提醒');
      const attentionItems = attentionSection.items.map(item => ({ ...item,
        displayName: displayPerson(item.userId), kindLabel: statusText(item.kind, 'attention'),
        externalStatusLabel: statusText(item.externalStatus, 'attention') }));
      const factSection = optionalItems(factRead, isHost && event.status !== 'DRAFT', '事实待办');
      const factTodos = factSection.items.map(item => ({ ...item, statusLabel: statusText(item.status, 'fact') }));
      const contentSection = optionalItems(contentRead, canUseCollaboration, '公告问答记录');
      const content = contentSection.items;
      const timeline = contentTimeline(content, displayPerson, event.hostId, actorId,
        aliases.find(item => item.isMine)?.displayName);
      const contentLoadState = contentSection.state;
      const contentError = contentSection.error;
      let expenses = [];
      const expenseSection = optionalItems(expenseRead, canReadExpenses, '费用记录');
      let expenseLoadState = expenseSection.state;
      let expenseError = expenseSection.error;
      if (expenseLoadState === 'READY') try {
        const consentedNames = new Map(aliases.filter(item => /^[a-f0-9]{16}$/.test(item.id || '') &&
          typeof item.displayName === 'string').map(item => [item.id, item.displayName]));
        const hashAlias = consentedNames.size ? require('../../utils/sha256.js').sha256 : null;
        expenses = expenseSection.items.map(ledger => {
          if ((ledger.event_id && ledger.event_id !== id) || (ledger.eventId && ledger.eventId !== id))
            throw new Error('费用记录活动不符，请重试');
          const shares = (ledger.shares || []).map((share, index) => ({ ...share,
            displayName: share.userId === actorId ? '我的份额' :
              (hashAlias && consentedNames.get(hashAlias(`${id}:${share.userId}`).slice(0, 16))) || `参与者 ${index + 1}`,
            amountYuan: yuanFromFen(share.amountFen),
            participantStatusLabel: share.participantHandled ? '本人已处理' : '本人未记录',
            hostStatusLabel: share.hostReceived ? '主办已收到' : '主办未记录',
            declarationStatusLabel: !ledger.current ? '历史版本' : share.participantHandled && share.hostReceived
              ? '双方已记录' : share.participantHandled !== share.hostReceived ? '记录不一致' : '待双方记录',
            declarationStatusTone: !ledger.current ? 'history' : share.participantHandled && share.hostReceived
              ? 'recorded' : share.participantHandled !== share.hostReceived ? 'review' : 'pending',
            canMarkHandled: Boolean(ledger.current && share.userId === actorId && !share.participantHandled),
            canMarkReceived: Boolean(ledger.current && isHost && !share.hostReceived) }));
          return { ...ledger, eventId: id, statusLabel: statusText(ledger.status, 'expense'),
            totalYuan: yuanFromFen(ledger.totalFen), shares,
            visibleShares: shares.slice(0, 4), membersExpanded: false, detailsOpen: false, sortByAmount: false };
        });
      } catch (error) {
        expenseLoadState = 'ERROR';
        expenseError = error.message || '费用记录加载失败，请重试';
      }
      let manualCheckIns = [];
      let checkIns = [];
      let attendanceLoadState = canReadAttendance ? 'EMPTY' : 'FORBIDDEN';
      let attendanceError = '';
      if (canReadAttendance) try {
        if (manualRead.error) throw manualRead.error;
        if (scannedRead.error) throw scannedRead.error;
        if (!Array.isArray(manualRead.value?.items) || !Array.isArray(scannedRead.value?.items) ||
          !manualRead.value.items.every(item => item && typeof item === 'object') ||
          !scannedRead.value.items.every(item => item && typeof item === 'object'))
          throw new Error('到场记录无效，请重试');
        manualCheckIns = manualRead.value.items.map(item => ({ ...item,
          displayName: displayPerson(item.userId), statusLabel: statusText(item.status, 'manual') }));
        checkIns = scannedRead.value.items.map(item => ({ ...item,
          displayName: displayPerson(item.userId), evidenceLabel: statusText(item.evidence, 'evidence'),
          checkedAtLabel: chinaMomentOrUnknown(item.checkedAt) }));
        attendanceLoadState = manualCheckIns.length || checkIns.length ? 'READY' : 'EMPTY';
      } catch (error) {
        attendanceLoadState = error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR';
        attendanceError = error.message || '到场记录加载失败，请重试';
      }
      const pending = !reconfirmationRead?.error ? reconfirmationRead?.value?.pending : null;
      const labels = { venueName: '场馆', startAt: '开始时间', endAt: '结束时间', feeCapFen: '费用上限（分）', feeMode: '费用模式',
        minParticipants: '最少人数', maxParticipants: '最多人数', visibility: '可见范围', cancellationRule: '取消规则', city: '城市' };
      const reconfirmation = pending && Array.isArray(pending.changes) &&
        pending.changes.every(change => change && typeof change === 'object') ?
        { ...pending, deadlineLabel: chinaDateTimeOrUnknown(pending.deadline),
          changes: pending.changes.map(change => ({ ...change, label: labels[change.field] || change.field,
            beforeLabel: changeValueLabel(change.field, change.before),
            afterLabel: changeValueLabel(change.field, change.after) })) } : null;
      const reconfirmationLoadState = !needsReconfirmation ? 'IDLE' : reconfirmation ? 'READY' : 'ERROR';
      const reconfirmationError = reconfirmationLoadState === 'ERROR' ?
        reconfirmationRead?.error?.message || '新规则确认信息无效，请重试' : '';
      let outcome = null;
      let outcomeLoadState = 'IDLE';
      let outcomeError = '';
      if (hasOutcome) {
        try {
          if (outcomeRead.error) throw outcomeRead.error;
          const response = outcomeRead.value;
          if (response?.eventId !== id || typeof response.held !== 'boolean' ||
            !Number.isInteger(response.actualCount) || typeof response.myFeedbackSubmitted !== 'boolean' ||
            !['NOT_HELD', 'HOST_ONLY', 'MEMBER_CORROBORATED', 'DISPUTED'].includes(response.level))
            throw new Error('结项证据无效，请重试');
          outcome = { ...response, levelLabel: statusText(response.level, 'outcome') };
          outcomeLoadState = 'READY';
        } catch (error) {
          outcomeLoadState = error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR';
          outcomeError = error.message || '结项证据加载失败，请重试';
        }
      }
      const now = Date.now();
      const canRequestManualCheckIn = canManageCheckins && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(event.status) &&
        now >= Date.parse(event.payload.startAt) - 30 * 60_000 && now <= Date.parse(event.payload.endAt) + 48 * 60 * 60_000;
      if (refreshId !== this.refreshId || actor !== currentIdentity()) return false;
      const previous = this.data.event;
      const shareSourceToken = event.recruiting && !event.riskPaused && previous?.id === id && previous.version === event.version &&
        previous.inviteToken === event.inviteToken ? this.data.shareSourceToken : '';
      const inviteRemainingMs = event.inviteRemainingMs;
      this._inviteValidUntil = isHost && typeof inviteRemainingMs === 'number' &&
        Number.isFinite(inviteRemainingMs) && inviteRemainingMs > 0 &&
        Number.isFinite(requestedAt + inviteRemainingMs) ? requestedAt + inviteRemainingMs : 0;
      this.setData({ id, event, display: eventDisplay(event), inviteSummary: null, loadState: 'READY', isHost, canJoin, canExpressInterest,
        canUseCollaboration, canPostQuestion, canCheckIn: timedControls.canCheckIn,
        canGenerateCheckInToken: timedControls.canGenerateCheckInToken, canCompleteEvent: timedControls.canCompleteEvent,
        checkInWindowNotice: timedControls.checkInWindowNotice, checkInAvailability: timedControls.checkInAvailability,
        completionAvailability: timedControls.completionAvailability,
        canApproveRegistration, canManageCheckins, canManageAnnouncements,
        safetyStatus, myRegistration, registrationLabel, registrations, confirmedRoster, memberCards,
        registrationsLoadState: registrationSection.state, registrationsError: registrationSection.error,
        cohostGrants, cohostGrantsLoadState: cohostSection.state, cohostGrantsError: cohostSection.error,
        aliases, hostAlias,
        aliasInput: aliases.find(item => item.isMine)?.displayName || '', canSetAlias,
        aliasNoticeVersion: aliasResponse.notice?.version || '', aliasNoticeText: aliasResponse.notice?.text || '',
        aliasReconfirmationRequired: Boolean(aliasResponse.reconfirmationRequired), aliasLoadState, aliasError,
        shareMetrics, shareMetricsLoadState, shareMetricsError, shareSourceToken,
        repeatCandidates, repeatCandidatesLoadState: repeatSection.state, repeatCandidatesError: repeatSection.error,
        repeatCandidateNames, attentionItems, attentionLoadState: attentionSection.state, attentionError: attentionSection.error,
        factTodos, factTodosLoadState: factSection.state, factTodosError: factSection.error,
        content, contentTimeline: timeline, contentLoadState, contentError,
        expenses, expenseLoadState, expenseError,
        outcome, outcomeLoadState, outcomeError, checkIns, manualCheckIns, attendanceLoadState, attendanceError,
        reconfirmation, reconfirmationLoadState, reconfirmationError,
        canRequestManualCheckIn, currentUser: actor, message: '' });
      this.updateTimedControls();
      this.reconcileSuccessState();
      return true;
    } catch (error) {
      if (refreshId !== this.refreshId || actor !== currentIdentity()) return false;
      this._inviteValidUntil = 0;
      const needsLogin = error.code === 'UNAUTHENTICATED' && summary && !config.developmentUser;
      this.setData({ event: null, display: null, registrationLabel: '未报名', inviteSummary: needsLogin ? summary : null,
        loadState: needsLogin ? 'LOGIN_REQUIRED' : 'ERROR', canCopyPublishedInvite: false, canJoin: false, canExpressInterest: false,
        canUseCollaboration: false, canPostQuestion: false, canCheckIn: false,
        canGenerateCheckInToken: false, canCompleteEvent: false, checkInWindowNotice: '', checkInAvailability: '', completionAvailability: '',
        canApproveRegistration: false, canManageCheckins: false, canManageAnnouncements: false,
        myRegistration: null, registrations: [], registrationsLoadState: 'IDLE', registrationsError: '',
        cohostGrants: [], cohostGrantsLoadState: 'IDLE', cohostGrantsError: '', aliases: [], memberCards: [], confirmedRoster: [], hostAlias: '', canSetAlias: false,
        aliasNoticeVersion: '', aliasNoticeText: '', aliasReconfirmationRequired: false, aliasLoadState: 'IDLE', aliasError: '',
        content: [], contentTimeline: [], contentLoadState: 'IDLE', contentError: '', expenses: [], expenseLoadState: 'IDLE', expenseError: '',
        outcome: null, outcomeLoadState: 'IDLE', outcomeError: '', checkIns: [],
        manualCheckIns: [], attendanceLoadState: 'IDLE', attendanceError: '',
        reconfirmation: null, reconfirmationLoadState: 'IDLE', reconfirmationError: '',
        shareMetrics: null, shareMetricsLoadState: 'IDLE', shareMetricsError: '',
        repeatCandidates: [], repeatCandidatesLoadState: 'IDLE', repeatCandidatesError: '', repeatCandidateNames: '暂无',
        attentionItems: [], attentionLoadState: 'IDLE', attentionError: '',
        factTodos: [], factTodosLoadState: 'IDLE', factTodosError: '', shareSourceToken: '',
        answerQuestionId: '', answerQuestionLabel: '', answerInputFocus: false,
        message: error.message || '加载失败' });
      return false;
    }
  },
  async retryLogin() {
    try { await api.login(); await this.refresh(); }
    catch (error) { this.setData({ loadState: 'LOGIN_REQUIRED', message: error.message || '登录失败，请重试' }); }
  },
  goToMyActivities() { wx.navigateTo({ url: '/subpackages/profile/moments/moments?filter=all' }); },
  goToItinerary() { wx.navigateTo({ url: '/subpackages/activity/itinerary/itinerary' }); },
  goBack() {
    if (this.data.joinConfirmation) return this.cancelJoin();
    if (this.data.successState) return this.dismissSuccess();
    if (this.data.activeSection !== 'detailsSection') return this.scrollToSection('detailsSection');
    if (typeof wx.navigateBack !== 'function') return wx.switchTab({ url: '/pages/index/index' });
    wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/index/index' }) });
  },
  jumpToSection(event) {
    const id = event.currentTarget.dataset.section;
    if (sectionAvailable(id, this.data.isHost, this.data.canApproveRegistration,
      this.data.canManageAnnouncements, this.data.canManageCheckins)) {
      if (this.data.successState) this.dismissSuccess();
      this.scrollToSection(id);
    }
  },
  openHostCompletion() {
    const controls = this.updateTimedControls();
    if (this.data.loadState !== 'READY' || !controls.canCompleteEvent) return;
    this.scrollToSection('hostSection', '#hostCompletionForm');
  },
  async openHostAnnouncement() {
    const attempt = this.hostAnnouncementAttemptId = (this.hostAnnouncementAttemptId || 0) + 1;
    const id = this.data.id;
    const actor = currentIdentity();
    const actorId = currentActorId();
    if (this.data.loadState !== 'READY' || !currentHostEvent(this)) {
      this.setData({ message: '账号或活动已切换，请重新核对公告资格。' });
      return;
    }
    const loaded = await this.refresh();
    if (!loaded || attempt !== this.hostAnnouncementAttemptId || id !== this.data.id ||
      actor !== currentIdentity() || actorId !== currentActorId()) return;
    const event = this.data.event;
    if (this.data.loadState !== 'READY' || !currentHostEvent(this) ||
      !this.data.canManageAnnouncements || event.reviewStatus !== 'APPROVED' ||
      !['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(event.status)) {
      this.setData({ message: '当前活动不能发布公告，请查看活动最新状态。' });
      return;
    }
    this.scrollToSection('hostSection', '#hostAnnouncementAnchor');
  },
  scrollToSection(id, targetSelector) {
    if (!sectionHeadings[id]) return;
    if (id !== this.data.activeSection) {
      this.clearCheckInToken();
      this.expenseShareAttemptId = (this.expenseShareAttemptId || 0) + 1;
      this.expenseShareSubmitting = false;
    }
    const [sectionTitle, sectionSubtitle] = sectionHeadings[id];
    this.setData({ activeSection: id, sectionTitle, sectionSubtitle }, () => {
      if (typeof wx.pageScrollTo === 'function') wx.pageScrollTo(targetSelector
        ? { selector: targetSelector, duration: 0 } : { scrollTop: 0, duration: 0 });
    });
  },
  selectCheckInMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode !== 'participant' && mode !== 'host') return;
    if (mode === 'host' && !this.data.isHost && !this.data.canManageCheckins) return;
    if (mode !== this.data.checkInMode) this.clearCheckInToken();
    this.setData({ checkInMode: mode });
  },
  dismissSuccess() { this.setData({ successState: '' }); },
  reconcileSuccessState() {
    const { successState, event, isHost, myRegistration } = this.data;
    const publishedStillCurrent = successState === 'PUBLISHED' && isHost && event?.status === 'RECRUITING' &&
      ['PENDING', 'APPROVED'].includes(event?.reviewStatus);
    const joinedStillCurrent = successState === 'JOINED' && myRegistration?.status === 'CONFIRMED' &&
      ['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(event?.status);
    if (successState && !publishedStillCurrent && !joinedStillCurrent) this.dismissSuccess();
  },
  viewSuccessDetails() {
    this.dismissSuccess();
    this.scrollToSection('detailsSection');
  },
  openEventActions() {
    if (typeof wx.showActionSheet !== 'function') return this.goToReport();
    const context = actionContext(this);
    const actor = currentIdentity();
    const eventId = this.data.id;
    const event = this.data.event;
    const version = event?.version;
    const owner = this.data.currentUser;
    const loadState = this.data.loadState;
    const refreshId = this.refreshId;
    const stillCurrent = () => actor === currentIdentity() && this.data.id === eventId &&
      this.data.event === event && this.data.event?.version === version &&
      this.data.currentUser === owner && this.data.loadState === loadState &&
      this.refreshId === refreshId;
    wx.showActionSheet({ itemList: ['举报与求助', '复制活动信息给可信任的人'],
      success: result => {
        if (!stillCurrent()) return;
        if (result.tapIndex === 0) this.goToReport();
        if (result.tapIndex === 1 && sameActionContext(this, context)) this.copySafetyDetails();
      } });
  },
  goToReport() {
    const actor = currentActorId() || wx.getStorageSync('sessionToken');
    getApp().globalData.reportContext = undefined;
    if (actor && this.data.id) getApp().globalData.reportContext = {
      actor, owner: editorIdentity(), eventId: this.data.id };
    wx.switchTab({ url: '/pages/me/me' });
  },
  copySafetyDetails() {
    const event = this.data.event;
    if (!event || this.data.loadState !== 'READY') {
      if (!this.data.currentUser || this.data.currentUser === currentIdentity())
        this.setData({ message: '活动信息尚未加载完成，请稍后重试。' });
      return;
    }
    const context = actionContext(this);
    if (!context) return;
    const details = [
      `活动：${event.payload.title || '未命名活动'}`,
      `时间：${event.payload.startAt || '待定'} 至 ${event.payload.endAt || '待定'}`,
      `公共集合地点：${event.payload.city || '待定'} · ${event.payload.venueName || '待定'}`,
      `主办方：${this.data.hostAlias || '未设置活动内昵称'}`,
      `活动编号：${this.data.id}`,
      '请以当前活动信息和主办方核实为准；遇到人身紧急危险，请先离开风险地点并联系当地应急服务。'
    ].join('\n');
    wx.setClipboardData({ data: details,
      success: () => {
        if (sameActionContext(this, context) && this.data.event === event)
          this.setData({ message: '活动信息已复制，请自行发给可信任的人。' });
      },
      fail: () => {
        if (sameActionContext(this, context) && this.data.event === event)
          this.setData({ message: '复制失败，请稍后重试。' });
      } });
  },
  copyVenue() {
    const event = this.data.event;
    if (!event || this.data.loadState !== 'READY' || event.id !== this.data.id ||
      (this.data.currentUser && this.data.currentUser !== currentIdentity())) return;
    const venueName = typeof event.payload?.venueName === 'string' ? event.payload.venueName.trim() : '';
    if (!venueName) return this.setData({ message: '当前活动尚未确认公共集合地点。' });
    const city = typeof event.payload?.city === 'string' ? event.payload.city.trim() : '';
    const venue = [city, venueName].filter(Boolean).join(' · ');
    const actor = currentIdentity();
    const eventId = event.id;
    wx.setClipboardData({ data: venue,
      success: () => {
        if (this.data.id === eventId && this.data.event?.id === eventId &&
          actor === currentIdentity()) wx.showToast?.({ title: '集合地点已复制', icon: 'none' });
      },
      fail: () => {
        if (this.data.id === eventId && this.data.event?.id === eventId &&
          actor === currentIdentity()) this.setData({ message: '复制地点失败，请稍后重试。' });
      } });
  },
  async copyJoinedVenue() {
    const eventId = this.data.id;
    const actor = currentIdentity();
    if (!actor || !eventId || this.data.currentUser !== actor || this.data.loadState !== 'READY' ||
      this.data.successState !== 'JOINED' || this.data.event?.id !== eventId ||
      this.data.myRegistration?.status !== 'CONFIRMED') return;
    const loaded = await this.refresh();
    if (!loaded || actor !== currentIdentity() || this.data.currentUser !== actor ||
      this.data.id !== eventId || this.data.event?.id !== eventId || this.data.loadState !== 'READY' ||
      this.data.successState !== 'JOINED' || this.data.myRegistration?.status !== 'CONFIRMED') return;
    this.copyVenue();
  },
  async addJoinedCalendar() {
    if (this.calendarSubmitting) return;
    const eventId = this.data.id;
    const actor = currentIdentity();
    const eligible = () => actor && eventId && actor === currentIdentity() &&
      this.data.currentUser === actor && this.data.id === eventId &&
      this.data.event?.id === eventId && this.data.loadState === 'READY' &&
      this.data.successState === 'JOINED' && this.data.myRegistration?.status === 'CONFIRMED';
    if (!eligible()) return;
    const attempt = this.calendarAttemptId = (this.calendarAttemptId || 0) + 1;
    this.calendarSubmitting = true;
    let submitted = false;
    try {
      const loaded = await this.refresh();
      if (!loaded || !eligible() || this.calendarAttemptId !== attempt) return;
      const event = this.data.event;
      const title = typeof event.payload?.title === 'string' ? event.payload.title.trim() : '';
      const start = Date.parse(event.payload?.startAt || '');
      const end = Date.parse(event.payload?.endAt || '');
      if (!title || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || start <= Date.now()) {
        this.setData({ message: '活动时间或名称已变化，请在详情页核对后重试添加日历。' });
        return;
      }
      if (typeof wx.addPhoneCalendar !== 'function' ||
        (typeof wx.canIUse === 'function' && !wx.canIUse('addPhoneCalendar'))) {
        this.setData({ message: '当前微信版本不支持添加系统日历，可在我的行程查看活动。' });
        return;
      }
      const city = typeof event.payload?.city === 'string' ? event.payload.city.trim() : '';
      const venueName = typeof event.payload?.venueName === 'string' ? event.payload.venueName.trim() : '';
      const location = [city, venueName].filter(Boolean).join(' · ');
      const readyRefreshId = this.refreshId;
      const stillCurrent = () => this.calendarAttemptId === attempt && this.refreshId === readyRefreshId &&
        eligible() && this.data.event === event;
      let completed = false;
      const finish = () => {
        if (completed) return false;
        completed = true;
        if (this.calendarAttemptId === attempt) this.calendarSubmitting = false;
        return true;
      };
      const success = () => {
        if (!finish() || !stillCurrent()) return;
        if (typeof wx.showToast === 'function') wx.showToast({ title: '已添加到日历', icon: 'none' });
        else this.setData({ message: '已添加到系统日历。' });
      };
      const fail = error => {
        if (!finish() || !stillCurrent()) return;
        const denied = /auth deny|authorize|permission|scope/i.test(error?.errMsg || '');
        this.setData({ message: denied ? '未获得日历授权，请在微信设置中允许后重试。' :
          '添加到系统日历失败，请稍后重试。' });
      };
      const result = wx.addPhoneCalendar({ title, startTime: Math.floor(start / 1000),
        endTime: String(Math.floor(end / 1000)), location,
        description: '活动时间和地点可能调整，请以小程序中的最新安排为准。',
        success, fail });
      submitted = true;
      if (result && typeof result.catch === 'function') result.catch(fail);
    } catch (error) {
      if (eligible() && this.calendarAttemptId === attempt)
        this.setData({ message: '添加到系统日历失败，请稍后重试。' });
    } finally {
      if (!submitted && this.calendarAttemptId === attempt) this.calendarSubmitting = false;
    }
  },
  shareCurrentEvent() {
    if (this.data.activeSection === 'expenseSection' && !this.data.successState &&
      !this.data.joinConfirmation) return this.copyCurrentExpenseSummary();
    if (this.data.isHost) return this.openShareCard();
    this.copySafetyDetails();
  },
  async copyCurrentExpenseSummary() {
    if (this.expenseShareSubmitting) return;
    const eventId = this.data.id;
    const actor = currentIdentity();
    const actorId = currentActorId();
    if (!actor || !actorId || !eventId || this.data.currentUser !== actor ||
      this.data.event?.id !== eventId || this.data.loadState !== 'READY' ||
      this.data.activeSection !== 'expenseSection' || this.data.successState ||
      this.data.joinConfirmation) return;
    const attempt = this.expenseShareAttemptId = (this.expenseShareAttemptId || 0) + 1;
    this.expenseShareSubmitting = true;
    const samePage = () => this.expenseShareAttemptId === attempt && actor === currentIdentity() &&
      actorId === currentActorId() && this.data.currentUser === actor && this.data.id === eventId &&
      this.data.event?.id === eventId && this.data.loadState === 'READY' &&
      this.data.activeSection === 'expenseSection' && !this.data.successState &&
      !this.data.joinConfirmation;
    try {
      const loaded = await this.refresh();
      if (!loaded || !samePage()) return;
      const refreshedEvent = this.data.event;
      const refreshedId = this.refreshId;
      if (!Number.isSafeInteger(refreshedEvent.version) || refreshedEvent.version < 1) {
        this.setData({ message: '当前活动版本无效，请刷新后核对。' });
        return;
      }
      if (this.data.event?.payload?.feeMode !== 'AA' || this.data.expenseLoadState !== 'READY') {
        this.setData({ message: this.data.expenseLoadState === 'FORBIDDEN'
          ? '当前账号无权查看费用记录。' : '当前没有可分享的 AA 费用记录，请刷新后核对。' });
        return;
      }
      const isHost = this.data.isHost && this.data.event.hostId === actorId;
      const isMember = !isHost && ['CONFIRMED', 'RECONFIRM_REQUIRED'].includes(this.data.myRegistration?.status);
      if (!isHost && !isMember) {
        this.setData({ message: '当前账号无权分享费用记录。' });
        return;
      }
      const currentLedgers = this.data.expenses.filter(item => item.current === true);
      const ledger = currentLedgers[0];
      if (currentLedgers.length !== 1 || !ledger || typeof ledger.id !== 'string' || !ledger.id ||
        ledger.status !== 'RECORD_ONLY' || !Number.isSafeInteger(ledger.revision) || ledger.revision < 1 ||
        !Number.isSafeInteger(ledger.totalFen) || ledger.totalFen < 0 ||
        !Array.isArray(ledger.shares) || ledger.shares.length < 1) {
        this.setData({ message: '当前账本版本或金额无效，请刷新后核对。' });
        return;
      }
      const title = typeof this.data.event.payload?.title === 'string'
        ? this.data.event.payload.title.trim() : '';
      if (!title) {
        this.setData({ message: '当前活动名称无效，请刷新后核对。' });
        return;
      }
      const latestEvent = await api.get(`/events/${encodeURIComponent(eventId)}`);
      if (!samePage() || this.refreshId !== refreshedId || this.data.event !== refreshedEvent) return;
      if (latestEvent?.id !== eventId || latestEvent.version !== refreshedEvent.version ||
        latestEvent.status !== refreshedEvent.status || latestEvent.hostId !== refreshedEvent.hostId ||
        latestEvent.payload?.feeMode !== 'AA' || latestEvent.payload?.title?.trim() !== title) {
        this.setData({ message: '活动信息已变化，请刷新后核对费用记录。' });
        return;
      }
      const lines = [`活动：${title}`, `当前 AA 费用记录 · 第 ${ledger.revision} 版 · 仅作记录`];
      if (isHost) {
        const uniqueUsers = new Set();
        const validShares = ledger.shares.every(share => {
          if (typeof share.userId !== 'string' || !share.userId || uniqueUsers.has(share.userId) ||
            !Number.isSafeInteger(share.amountFen) || share.amountFen < 0) return false;
          uniqueUsers.add(share.userId);
          return true;
        });
        const shareTotal = ledger.shares.reduce((sum, share) => sum + share.amountFen, 0);
        if (!validShares || !Number.isSafeInteger(shareTotal) || shareTotal !== ledger.totalFen) {
          this.setData({ message: '当前账本金额不一致，请刷新后核对。' });
          return;
        }
        lines.push(`总费用：${yuanFromFen(ledger.totalFen)}`, `参与份额：${ledger.shares.length} 人`);
      } else {
        const ownShares = ledger.shares.filter(share => share.userId === actorId);
        const ownShare = ownShares[0];
        if (ownShares.length !== 1 || !ownShare || !Number.isSafeInteger(ownShare.amountFen) ||
          ownShare.amountFen < 0 || typeof ownShare.participantHandled !== 'boolean' ||
          typeof ownShare.hostReceived !== 'boolean') {
          this.setData({ message: '本人当前份额无效，请刷新后核对。' });
          return;
        }
        lines.push(`我的份额：${yuanFromFen(ownShare.amountFen)}`,
          ownShare.participantHandled ? '本人已处理' : '本人未记录',
          ownShare.hostReceived ? '主办已收到' : '主办未记录');
      }
      lines.push('本摘要仅为 AA 费用记录，不代表付款或结清凭证。');
      const ledgerId = ledger.id;
      const ledgerRevision = ledger.revision;
      const ledgerTotal = ledger.totalFen;
      const stillCurrent = () => samePage() && this.refreshId === refreshedId &&
        this.data.event === refreshedEvent && this.data.expenseLoadState === 'READY' &&
        this.data.expenses.filter(item => item.current === true).length === 1 &&
        this.data.expenses.some(item => item.current === true && item.id === ledgerId &&
          item.revision === ledgerRevision && item.totalFen === ledgerTotal);
      if (!stillCurrent()) return;
      let completed = false;
      const finish = (success) => {
        if (completed) return;
        completed = true;
        if (stillCurrent()) this.setData({ message: success
          ? '当前 AA 费用记录摘要已复制。' : '复制费用记录失败，请稍后重试。' });
      };
      const result = wx.setClipboardData({ data: lines.join('\n'),
        success: () => finish(true), fail: () => finish(false) });
      if (result && typeof result.catch === 'function') result.catch(() => finish(false));
    } catch (error) {
      if (samePage()) this.setData({ message: error.message || '费用记录暂不可用，请稍后重试。' });
    } finally {
      if (this.expenseShareAttemptId === attempt) this.expenseShareSubmitting = false;
    }
  },
  async action(path, payload, successText, expectedContext) {
    const context = expectedContext || actionContext(this);
    if (!sameActionContext(this, context) || !actionPathMatchesEvent(this, path, payload, context.eventId)) {
      if (this.data.currentUser === currentIdentity())
        this.setData({ message: '账号或活动已变化，请刷新后重新操作。' });
      return null;
    }
    try {
      const result = await api.post(path, { expectedVersion: context.version, ...payload });
      if (!sameActionContext(this, context)) return null;
      if (!await this.refresh() || !sameActionOwner(this, context)) return null;
      this.setData({ message: successText });
      return result;
    } catch (error) {
      if (sameActionContext(this, context)) this.setData({ message: error.message || '操作失败' });
      return null;
    }
  },
  openJoinConfirmation() {
    if (this.data.loadState !== 'READY' || !this.data.canJoin || !this.data.event) return;
    const event = this.data.event;
    const payload = event.payload || {};
    const display = eventDisplay(event);
    this.joinConfirmationGeneration = (this.joinConfirmationGeneration || 0) + 1;
    this.joinConfirmationActor = currentIdentity();
    this.setData({ joinSubmitting: false, joinChoice: 'JOIN', joinConfirmation: {
      id: event.id, version: event.version, token: this.data.token,
      title: display.title, isBadminton: display.isBadminton,
      date: display.date, end: display.end, location: display.location, fee: display.fee,
      confirmed: event.stats?.confirmed ?? null, capacity: payload.maxParticipants || null,
      skillLevel: payload.skillLevel || '', cancellationRule: payload.cancellationRule || '请查看活动规则',
      approval: payload.approvalMode === 'MANUAL' ? '提交后由主办方逐一审批' : '自动接受；满员时可能进入候补'
    } });
  },
  closeJoinConfirmation() {
    this.joinConfirmationGeneration = (this.joinConfirmationGeneration || 0) + 1;
    this.joinConfirmationActor = '';
    if (this.data.joinConfirmation || this.data.joinSubmitting)
      this.setData({ joinConfirmation: null, joinSubmitting: false, joinChoice: 'JOIN' });
  },
  selectJoinChoice(event) {
    if (!this.data.joinConfirmation || this.data.joinSubmitting) return;
    const choice = event.currentTarget.dataset.choice;
    if (choice === 'JOIN' || (choice === 'INTERESTED' && this.data.canExpressInterest))
      this.setData({ joinChoice: choice });
  },
  cancelJoin() {
    if (!this.data.joinSubmitting) this.closeJoinConfirmation();
  },
  async submitRegistration(event, actor) {
    if (this.data.loadState !== 'READY' || !this.data.canJoin || this.data.event?.id !== event.id ||
      this.data.event?.version !== event.version || actor !== currentIdentity()) {
      this.setData({ message: '活动信息已变化，请刷新后重新确认报名规则' });
      return null;
    }
    const result = await this.action(`/events/${event.id}/registrations`,
      { inviteToken: this.data.token, acceptedRules: true }, '报名状态已更新');
    if (result && this.data.loadState === 'READY' && this.data.event?.id === event.id &&
      actor === currentIdentity() && this.data.myRegistration?.status === 'CONFIRMED')
      this.setData({ successState: 'JOINED' });
    return result;
  },
  async confirmJoin() {
    const review = this.data.joinConfirmation;
    if (!review || this.data.joinSubmitting) return;
    const generation = this.joinConfirmationGeneration;
    const actor = this.joinConfirmationActor;
    const choice = this.data.joinChoice === 'INTERESTED' ? 'INTERESTED' : 'JOIN';
    if (actor !== currentIdentity()) {
      this.closeJoinConfirmation();
      this.setData({ message: '登录身份已变化，请重新打开活动并核对报名规则。' });
      return;
    }
    if (this.data.event?.id !== review.id || this.data.event?.version !== review.version || this.data.token !== review.token) {
      this.closeJoinConfirmation();
      this.setData({ message: '活动信息已变化，请重新核对报名规则。' });
      return;
    }
    this.setData({ joinSubmitting: true });
    const loaded = await this.refresh();
    if (generation !== this.joinConfirmationGeneration) return;
    if (!loaded || this.data.loadState !== 'READY') {
      this.closeJoinConfirmation();
      return;
    }
    if (!(choice === 'INTERESTED' ? this.data.canExpressInterest : this.data.canJoin) ||
      this.data.event?.id !== review.id || this.data.event?.version !== review.version ||
      this.data.token !== review.token || actor !== currentIdentity()) {
      this.closeJoinConfirmation();
      this.setData({ message: '活动或登录身份已变化，请重新核对报名规则。' });
      return;
    }
    if (choice === 'INTERESTED')
      await this.action(`/events/${review.id}/interests`, { inviteToken: review.token }, '已记录待定意向，不占名额，也不会进入候补队列');
    else await this.submitRegistration(this.data.event, actor);
    if (generation === this.joinConfirmationGeneration) this.closeJoinConfirmation();
  },
  async join() {
    if (this.data.loadState !== 'READY' || !this.data.canJoin || !this.data.event) return;
    const event = this.data.event;
    const payload = event.payload || {};
    const actor = currentIdentity();
    const fee = payload.feeMode === 'FREE' ? '免费'
      : payload.feeMode === 'AA' ? `AA，上限 ${Number(payload.feeCapFen || 0) / 100} 元/人` : '费用以活动规则为准';
    const approval = payload.approvalMode === 'MANUAL' ? '主办方逐一审批' : '自动接受或候补';
    const content = `活动版本：${event.version}\n${payload.title || event.title || '本次活动'}\n` +
      `时间：${payload.startAt || '待确认'}\n地点：${payload.city || ''} ${payload.venueName || '待确认'}\n` +
      `费用：${fee}${payload.skillLevel ? `\n水平要求：${payload.skillLevel}` : ''}\n` +
      `取消规则：${payload.cancellationRule || '请查看活动规则'}\n报名方式：${approval}`;
    const decision = await new Promise(resolve => wx.showModal({ title: '确认本次报名规则', content,
      confirmText: '确认参加', success: resolve, fail: () => resolve({ confirm: false }) }));
    if (!decision.confirm) return;
    return this.submitRegistration(event, actor);
  },
  interested() { this.action(`/events/${this.data.id}/interests`, { inviteToken: this.data.token }, '已记录待定意向，不占用名额'); },
  async leave() {
    if (this.pendingExitChecking) return;
    const intent = this.pendingExitIntent;
    if (intent?.stateChanged)
      return this.setData({ message: '报名状态已变化，请返回我的活动，重新打开活动并核对后操作。' });
    if (intent) {
      this.pendingExitChecking = true;
      const actor = currentIdentity();
      const eventId = intent.eventId;
      const originalRegistrationId = this.data.myRegistration?.id;
      const sameContext = () => this.pendingExitIntent === intent && actor === currentIdentity() &&
        this.data.currentUser === actor && this.data.id === eventId && this.data.event?.id === eventId;
      try {
        if (!actor || intent.actor !== actor || !sameContext()) {
          intent.stateChanged = true;
          if (actor === currentIdentity()) this.setData({ message: '账号或活动已变化，请重新打开当前报名。' });
          return;
        }
        const loaded = await this.refresh();
        if (!sameContext() || !loaded) return;
        const registration = this.data.myRegistration;
        if (this.data.isHost || !registration || registration.id !== originalRegistrationId ||
          registration.event_id !== eventId || registration.status !== 'REQUESTED' ||
          !['REVIEW_PENDING', 'RECRUITING', 'CONFIRMED'].includes(this.data.event.status)) {
          intent.stateChanged = true;
          this.setData({ message: '报名状态已变化，请返回我的活动，重新打开活动并核对后操作。' });
          return;
        }
        await api.post(`/registrations/${registration.id}/cancel`,
          { expectedVersion: this.data.event.version, expectedStatus: 'REQUESTED' });
        if (!sameContext()) return;
        this.pendingExitIntent = null;
        if (await this.refresh() && actor === currentIdentity() && this.data.id === eventId &&
          this.data.myRegistration?.status === 'CANCELLED') {
          this.setData({ message: '已退出本次活动' });
          wx.switchTab({ url: '/pages/index/index' });
        }
      } catch (error) {
        if (!sameContext()) return;
        if (error.code === 'REGISTRATION_CHANGED') {
          await this.refresh();
          if (sameContext()) {
            intent.stateChanged = true;
            this.setData({ message: '报名状态已变化，请返回我的活动，重新打开活动并核对后操作。' });
          }
        } else this.setData({ message: error.message || '退出报名失败，请重试。' });
      } finally { this.pendingExitChecking = false; }
      return;
    }
    if (!this.data.myRegistration) return;
    const result = await this.action(`/registrations/${this.data.myRegistration.id}/cancel`, {}, '已退出本次活动');
    if (result) wx.switchTab({ url: '/pages/index/index' });
  },
  approve(event) { this.action(`/registrations/${event.currentTarget.dataset.id}/approve`, {}, '已审核报名'); },
  cohostUserInput(event) { this.setData({ cohostUserId: event.detail.value.trim() }); },
  selectCohostMember(event) { this.setData({ cohostUserId: event.currentTarget.dataset.user,
    cohostSelectedName: event.currentTarget.dataset.name || '所选参与者' }); },
  cohostCapabilitiesChanged(event) { this.setData({ selectedCohostCapabilities: event.detail.value }); },
  async grantCohost() {
    const context = actionContext(this);
    if (!context) return;
    if (!this.data.isHost || !this.data.cohostUserId || !this.data.selectedCohostCapabilities.length)
      return this.setData({ message: '请先选择协办成员和至少一项能力' });
    try {
      const expiresAt = new Date(Date.parse(this.data.event.payload.endAt) + 48 * 60 * 60_000).toISOString();
      await api.post(`/events/${encodeURIComponent(context.eventId)}/cohosts`, {
        expectedVersion: context.version, userId: this.data.cohostUserId,
        capabilities: this.data.selectedCohostCapabilities, expiresAt
      });
      if (!sameActionContext(this, context)) return;
      if (await this.refresh() && sameActionOwner(this, context))
        this.setData({ cohostUserId: '', cohostSelectedName: '', message: '本场协办权限已授予，可随时撤回。' });
    } catch (error) {
      if (sameActionContext(this, context)) this.setData({ message: error.message || '授权失败' });
    }
  },
  async revokeCohost(event) {
    const context = actionContext(this);
    if (!this.data.isHost || !context) return;
    const grantId = event.currentTarget.dataset.id;
    const decision = await new Promise(resolve => wx.showModal({ title: '撤回协办权限',
      content: '撤回后旧会话立即失去本场管理权限；该用户自己的报名仍保留。', success: resolve, fail: () => resolve({ confirm: false }) }));
    if (!decision.confirm || !sameActionContext(this, context)) return;
    try {
      await api.post(`/cohost-grants/${encodeURIComponent(grantId)}:revoke`, {});
      if (!sameActionContext(this, context)) return;
      if (await this.refresh() && sameActionOwner(this, context)) this.setData({ message: '协办权限已撤回。' });
    } catch (error) {
      if (sameActionContext(this, context)) this.setData({ message: error.message || '撤回失败' });
    }
  },
  removalReasonInput(event) { this.setData({ removalReason: event.detail.value }); },
  removeParticipant(event) {
    const context = actionContext(this);
    if (!context) return;
    const id = event.currentTarget.dataset.id; const userId = event.currentTarget.dataset.user;
    const reason = this.data.removalReason.trim();
    if (reason.length < 5) return this.setData({ message: '请先填写至少 5 字的活动内移除原因' });
    const displayName = this.data.registrations.find(item => item.id === id && item.user_id === userId)?.displayName || '所选参与者';
    wx.showModal({ title: '移除参与者', content: `将移除 ${displayName}，本人会看到原因并可申诉。原因：${reason}`, success: result => {
      if (result.confirm) this.action(`/registrations/${id}/remove`, { reason }, '已移除参与者，原因仅本人及运营可见', context);
    } });
  },
  reconfirm() {
    const context = actionContext(this);
    const registrationId = this.data.myRegistration?.id;
    if (!context || !registrationId) return;
    wx.showModal({ title: '确认新规则', content: `确认接受活动版本 ${this.data.reconfirmation?.toVersion} 的全部变更吗？`, success: result => {
      if (result.confirm) this.action(`/registrations/${registrationId}/reconfirm`, {}, '已确认新版本规则', context);
    } });
  },
  confirmEvent() { this.action(`/events/${this.data.id}/confirm`, {}, '主办方已确认成局'); },
  rotateInvite() { this.action(`/events/${this.data.id}/invite:rotate`, {}, '旧邀请已撤销，分享卡已更新'); },
  cancelEvent() {
    const context = actionContext(this);
    if (!context) return;
    wx.showModal({ title: '取消活动', content: '取消将通知已报名者，且不能继续招募。', success: result => {
      if (result.confirm) this.action(`/events/${context.eventId}/cancel`, {}, '活动已取消', context);
    } });
  },
  async reserve() {
    const result = await this.action(`/events/${this.data.id}/reservations`, { count: 1 }, '已预留一个席位，球友仍需自行认领');
    if (result) this.setData({ reservationTokens: result });
  },
  reservationInput(event) { this.setData({ reservationToken: event.detail.value.trim() }); },
  claim() { this.action(`/reservations/${encodeURIComponent(this.data.reservationToken)}/claim`,
    { expectedEventId: this.data.event.id }, '已认领预留名额'); },
  async showCheckInToken() {
    const context = actionContext(this);
    if (this.checkInPageHidden || !context || (!this.data.isHost && !this.data.canManageCheckins) ||
      !this.updateTimedControls().canGenerateCheckInToken) return;
    const requestId = this.checkInRequestId = (this.checkInRequestId || 0) + 1;
    const stillCurrent = () => requestId === this.checkInRequestId && !this.checkInPageHidden &&
      sameActionContext(this, context) &&
      (this.data.isHost || this.data.canManageCheckins) && timedEventControls(this.data.event, Date.now(),
        this.data.myRegistration?.status, this.data.isHost, this.data.canManageCheckins).canGenerateCheckInToken;
    clearTimeout(this.checkInRefreshTimer);
    if (this.data.displayedCheckInToken) this.setData({ displayedCheckInToken: '', checkInExpiresIn: 0 });
    try {
      const requestedAt = Date.now();
      const result = await api.post(`/events/${context.eventId}/checkin-token`, { expectedVersion: context.version });
      if (!stillCurrent()) return;
      // The server's remaining lifetime was measured before the response crossed the network.
      const remainingMs = result.expiresInSeconds * 1000 - Math.max(0, Date.now() - requestedAt) - 1000;
      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        this.setData({ displayedCheckInToken: '', checkInExpiresIn: 0, message: '签到码已过期，正在更新。' });
        this.checkInRefreshTimer = setTimeout(() => { if (stillCurrent()) this.showCheckInToken(); }, 1000);
        return;
      }
      this.setData({ displayedCheckInToken: result.token, checkInExpiresIn: Math.ceil(remainingMs / 1000),
        message: '现场二维码将在过期时自动更新。' }, () => {
        if (stillCurrent()) drawCheckInQr(result.token, wx.createCanvasContext(
          this.data.activeSection === 'checkinSection' && this.data.checkInMode === 'host' ? 'checkinQrScreen' : 'checkinQr', this));
      });
      this.checkInRefreshTimer = setTimeout(() => {
        if (stillCurrent()) this.showCheckInToken();
      }, remainingMs);
    } catch (error) {
      if (stillCurrent()) this.setData({ displayedCheckInToken: '', message: error.message || '签到码获取失败' });
    }
  },
  checkInInput(event) { this.setData({ checkInToken: event.detail.value.trim() }); },
  checkIn() {
    const controls = this.updateTimedControls();
    if (!controls.canCheckIn) return this.setData({ message: controls.checkInAvailability });
    this.action(`/events/${this.data.id}/checkins`, { token: this.data.checkInToken }, '签到证据已记录');
  },
  scanCheckIn() {
    const controls = this.updateTimedControls();
    if (!controls.canCheckIn) return this.setData({ message: controls.checkInAvailability });
    wx.scanCode({ onlyFromCamera: true, scanType: ['qrCode'], success: result => {
      const latest = this.updateTimedControls();
      if (!latest.canCheckIn) return this.setData({ message: latest.checkInAvailability });
      const token = String(result.result || '').trim();
      if (!/^\d+\.[A-Za-z0-9_-]{43}$/.test(token)) return this.setData({ message: '这不是本活动的签到二维码' });
      this.action(`/events/${this.data.id}/checkins`, { token }, '扫码签到证据已记录');
    }, fail: error => {
      if (error.errMsg && !error.errMsg.includes('cancel')) this.setData({ message: '扫码失败，请重试或输入口令' });
    } });
  },
  requestManualCheckIn(event) {
    const context = actionContext(this);
    if (!context) return;
    const userId = event.currentTarget.dataset.user;
    wx.showModal({ title: '补记到场', content: '只会向本人发起确认；未经本人确认不计为到场。', success: result => {
      if (result.confirm) this.action(`/events/${context.eventId}/manual-checkins`, { userId }, '已向参与者发起补记确认', context);
    } });
  },
  respondManualCheckIn(event) {
    this.action(`/manual-checkins/${event.currentTarget.dataset.id}/respond`, { accepted: event.currentTarget.dataset.accepted },
      event.currentTarget.dataset.accepted ? '已确认人工补记，证据类型与扫码分开' : '已拒绝人工补记');
  },
  actualCountInput(event) { this.setData({ actualCount: event.detail.value }); },
  setCompletionHeld(event) { this.setData({ completionHeld: event.detail.value === 'held' }); },
  completionAnomalyInput(event) { this.setData({ completionAnomaly: event.detail.value }); },
  completionVenueIssueInput(event) { this.setData({ completionVenueIssue: event.detail.value }); },
  complete() {
    const controls = this.updateTimedControls();
    if (!controls.canCompleteEvent) return this.setData({ message: controls.completionAvailability });
    const held = this.data.completionHeld;
    if (typeof held !== 'boolean') return this.setData({ message: '请先选择活动是否实际举办' });
    if (held && !/^\d+$/.test(String(this.data.actualCount).trim()))
      return this.setData({ message: '请填写实际到场人数' });
    const anomaly = String(this.data.completionAnomaly || '').trim();
    const venueIssue = String(this.data.completionVenueIssue || '').trim();
    if (anomaly.length > 497 || venueIssue.length > 495)
      return this.setData({ message: '异常或场地问题过长，请缩短至每项 500 字以内（含类型前缀）' });
    const issues = [...(anomaly ? [`异常：${anomaly}`] : []), ...(venueIssue ? [`场地问题：${venueIssue}`] : [])];
    this.action(`/events/${this.data.id}/complete`, { held, actualCount: held ? Number(this.data.actualCount) : 0, issues },
      held ? '活动已结项；可信完成仍需独立反馈' : '已记录活动未举办，不计为完成活动');
  },
  async repeat() {
    const result = await this.action(`/events/${this.data.id}/repeat`, {}, '已生成下一场草稿');
    if (result) wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(result.id) });
  },
  editDraft() {
    wx.removeStorageSync('editEventId');
    wx.setStorageSync('editDraftId', this.data.id);
    wx.setStorageSync('editTargetOwner', editorIdentity());
    wx.switchTab({ url: '/pages/create/create' });
  },
  editPublished() {
    wx.removeStorageSync('editDraftId');
    wx.setStorageSync('editEventId', this.data.id);
    wx.setStorageSync('editTargetOwner', editorIdentity());
    wx.switchTab({ url: '/pages/create/create' });
  },
  yuanInput(event) { this.setData({ totalYuan: event.detail.value }); },
  toggleExpenseDetails(event) {
    const ledgerId = event?.currentTarget?.dataset?.ledger;
    const ledger = this.data.expenses.find(item => item.id === ledgerId);
    if (ledger) changeExpenseLedger(this, ledgerId, { detailsOpen: !ledger.detailsOpen });
  },
  toggleExpenseMembers(event) {
    const ledgerId = event?.currentTarget?.dataset?.ledger;
    const ledger = this.data.expenses.find(item => item.id === ledgerId);
    if (ledger) changeExpenseLedger(this, ledgerId, { membersExpanded: !ledger.membersExpanded });
  },
  toggleExpenseSort(event) {
    const ledgerId = event?.currentTarget?.dataset?.ledger;
    const ledger = this.data.expenses.find(item => item.id === ledgerId);
    if (ledger) changeExpenseLedger(this, ledgerId, { sortByAmount: !ledger.sortByAmount });
  },
  expense() {
    if (!['READY', 'EMPTY'].includes(this.data.expenseLoadState))
      return this.setData({ message: '费用记录尚未加载，请先重新加载后再记录' });
    const text = String(this.data.totalYuan).trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return this.setData({ message: '请填写明确的非负费用金额，最多保留两位小数' });
    const [yuan, cents = ''] = text.split('.');
    const totalFen = Number(yuan) * 100 + Number(cents.padEnd(2, '0'));
    if (!Number.isSafeInteger(totalFen)) return this.setData({ message: '费用金额超出可记录范围' });
    const currentLedger = this.data.expenses.find(ledger => ledger.current);
    this.action(`/events/${this.data.id}/expenses`, { totalFen,
      expectedLedgerRevision: currentLedger?.revision ?? 0 },
    currentLedger ? '已建立新版费用记录；旧确认仅供历史查看' : '费用记录已保存，平台未收款');
  },
  markHandled(event) { this.action(`/expenses/${event.currentTarget.dataset.ledger}/shares/${event.currentTarget.dataset.user}`, { field: 'PARTICIPANT_HANDLED', value: true }, '已记录本人处理状态'); },
  markReceived(event) { this.action(`/expenses/${event.currentTarget.dataset.ledger}/shares/${event.currentTarget.dataset.user}`, { field: 'HOST_RECEIVED', value: true }, '已记录主办方收到状态'); },
  questionInput(event) { this.setData({ questionText: event.detail.value }); },
  aliasInput(event) { this.setData({ aliasInput: event.detail.value }); },
  async saveAlias() {
    const context = actionContext(this);
    if (!context) return;
    try {
      if (!this.data.aliasNoticeVersion) throw new Error('昵称展示说明暂不可用，请刷新后重试');
      await api.post(`/events/${encodeURIComponent(context.eventId)}/aliases`, {
        displayName: this.data.aliasInput, granted: true, noticeVersion: this.data.aliasNoticeVersion });
      if (!sameActionContext(this, context)) return;
      if (await this.refresh() && sameActionOwner(this, context))
        this.setData({ message: '仅在本活动内展示的昵称已保存。' });
    } catch (error) {
      if (!sameActionContext(this, context)) return;
      if (error.code === 'CONSENT_NOTICE_CHANGED') {
        if (await this.refresh() && sameActionOwner(this, context))
          this.setData({ message: '昵称展示说明已更新，请阅读后重新确认。' });
      } else this.setData({ message: error.message });
    }
  },
  async revokeAlias() {
    const context = actionContext(this);
    if (!context) return;
    try {
      await api.post(`/events/${encodeURIComponent(context.eventId)}/aliases`, { displayName: null, granted: false });
      if (!sameActionContext(this, context)) return;
      if (await this.refresh() && sameActionOwner(this, context)) this.setData({ message: '已撤回本活动的昵称展示。' });
    } catch (error) { if (sameActionContext(this, context)) this.setData({ message: error.message }); }
  },
  async blockMember(event) {
    const context = actionContext(this);
    if (!context) return;
    try {
      await api.post(`/events/${encodeURIComponent(context.eventId)}/blocks`, { memberId: event.currentTarget.dataset.member });
      if (!sameActionContext(this, context)) return;
      if (await this.refresh() && sameActionOwner(this, context))
        this.setData({ message: '已屏蔽此成员；当前活动记录和安全举报入口仍可使用。可在“我的”中撤销。' });
    } catch (error) { if (sameActionContext(this, context)) this.setData({ message: error.message }); }
  },
  factQuestionInput(event) { this.setData({ factQuestionText: event.detail.value }); },
  async askFact() {
    const context = actionContext(this);
    if (!context) return;
    try {
      const result = await api.post(`/events/${encodeURIComponent(context.eventId)}/facts:ask`, { question: this.data.factQuestionText });
      if (!sameActionContext(this, context)) return;
      if (await this.refresh() && sameActionOwner(this, context))
        this.setData({ factQuestionText: '', message: result.answer });
    } catch (error) { if (sameActionContext(this, context)) this.setData({ message: error.message }); }
  },
  announcementInput(event) { this.setData({ announcementText: event.detail.value }); },
  answerInput(event) { this.setData({ answerText: event.detail.value }); },
  answerQuestionInput(event) { this.setData({ answerQuestionId: event.detail.value.trim() }); },
  replyToQuestion(event) {
    if ((!this.data.isHost && !this.data.canManageAnnouncements) || !this.data.event ||
      !['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(this.data.event.status)) return;
    const id = event.currentTarget.dataset.id;
    const question = this.data.content.find(item => item.id === id && item.kind === 'QUESTION' &&
      item.status === 'APPROVED' && (!item.fact_event_version || item.fact_event_version === this.data.event.version));
    const todo = this.data.isHost && this.data.factTodos.find(item => item.questionContentId === id && item.status === 'OPEN');
    if (!question && !todo) return this.setData({ message: '此问题当前不可回复，请刷新后重试' });
    this.jumpToSection({ currentTarget: { dataset: { section: this.data.isHost ? 'hostSection' : 'cohostContentSection' } } });
    this.setData({ answerQuestionId: id, answerQuestionLabel: question?.body || todo.question,
      answerText: '', answerInputFocus: false });
    if (typeof wx.nextTick === 'function') wx.nextTick(() => this.setData({ answerInputFocus: true }));
    else this.setData({ answerInputFocus: true });
  },
  async submitContent(kind, body, parentId) {
    const context = actionContext(this);
    if (!context) return;
    try {
      await api.post(`/events/${context.eventId}/content`, { kind, body, parentId });
      if (!sameActionContext(this, context)) return;
      if (await this.refresh() && sameActionOwner(this, context))
        this.setData({ message: '内容已提交，审核通过后其他成员可见。',
          ...(kind === 'ANSWER' ? { answerQuestionId: '', answerQuestionLabel: '', answerText: '', answerInputFocus: false } : {}) });
    } catch (error) { if (sameActionContext(this, context)) this.setData({ message: error.message || '提交失败' }); }
  },
  askQuestion() { this.submitContent('QUESTION', this.data.questionText, null); },
  goToContentAppeal() {
    wx.setStorageSync('irlProfileFocusIntent', 'contentSection');
    wx.switchTab({ url: '/pages/me/me' });
  },
  postAnnouncement() { this.submitContent('ANNOUNCEMENT', this.data.announcementText, null); },
  answerQuestion() { return this.submitContent('ANSWER', this.data.answerText, this.data.answerQuestionId); },
  setFeedbackHeld(event) {
    const held = event.detail.value === 'yes' ? true : event.detail.value === 'no' ? false : null;
    this.setData({ feedbackHeld: held });
  },
  setFeedbackWouldRepeat(event) { this.setData({ feedbackWouldRepeat: event.detail.value === 'yes' ? true : event.detail.value === 'no' ? false : null }); },
  feedbackReasonInput(event) { this.setData({ feedbackReason: event.detail.value }); },
  async submitFeedback() {
    if (this.data.loadState !== 'READY' || this.data.currentUser !== currentIdentity() ||
      this.data.event?.id !== this.data.id || this.data.event.status !== 'COMPLETED' ||
      this.data.outcomeLoadState !== 'READY' || !this.data.outcome || this.data.outcome.myFeedbackSubmitted ||
      this.data.isHost || this.data.myRegistration?.status !== 'CONFIRMED')
      return this.setData({ message: '当前无法提交独立反馈，请刷新活动状态。' });
    if (this.data.feedbackSubmitting) return;
    const actor = currentIdentity();
    const eventId = this.data.id;
    const retry = this.feedbackUncertainRequest;
    const retryPayload = retry?.actor === actor && retry.eventId === eventId ? retry.payload : null;
    if (!retryPayload) {
      if (typeof this.data.feedbackHeld !== 'boolean') return this.setData({ message: '请先选择活动是否实际举办' });
      if (typeof this.data.feedbackWouldRepeat !== 'boolean') return this.setData({ message: '请先选择是否愿意再参加类似活动' });
      if (this.data.feedbackHeld === false && !String(this.data.feedbackReason || '').trim())
        return this.setData({ message: '如活动未举办，请填写原因' });
    }
    const refreshGeneration = this.refreshId || 0;
    const requestId = this.feedbackRequestId = (this.feedbackRequestId || 0) + 1;
    const payload = retryPayload || { expectedVersion: this.data.event.version, held: this.data.feedbackHeld,
      wouldRepeat: this.data.feedbackWouldRepeat, reason: this.data.feedbackReason };
    const sameContext = () => this.feedbackRequestId === requestId && currentIdentity() === actor &&
      this.data.currentUser === actor && this.data.id === eventId && this.data.event?.id === eventId;
    this.setData({ feedbackSubmitting: true });
    try {
      await api.post(`/events/${eventId}/feedback`, payload);
      if (this.feedbackRequestId === requestId) this.feedbackUncertainRequest = null;
      if (!sameContext() || (this.refreshId || 0) !== refreshGeneration) return;
      this.setData({ feedbackUncertain: false });
      const loaded = await this.refresh();
      if (loaded && sameContext() && this.data.outcome?.myFeedbackSubmitted)
        this.setData({ message: payload.held ? '独立反馈已记录。' : '独立反馈已记录；争议将进入人工处理。' });
    } catch (error) {
      if (sameContext() && (this.refreshId || 0) === refreshGeneration) {
        const uncertain = error.code === 'NETWORK_ERROR' || error.status === 408 || error.status >= 500;
        this.feedbackUncertainRequest = uncertain ? { actor, eventId, payload } : null;
        this.setData({ feedbackUncertain: uncertain, message: error.message || '反馈失败' });
      }
    } finally {
      if (this.feedbackRequestId === requestId) this.setData({ feedbackSubmitting: false });
    }
  },
  startAnotherEvent() {
    if (this.data.loadState !== 'READY' || this.data.currentUser !== currentIdentity() ||
      this.data.event?.id !== this.data.id || this.data.event.status !== 'COMPLETED' ||
      this.data.outcomeLoadState !== 'READY' ||
      !this.data.outcome || this.data.isHost ||
      this.data.myRegistration?.status !== 'CONFIRMED') return;
    wx.setStorageSync('irlCreateFreshIntent', { owner: editorIdentity() });
    wx.switchTab({ url: '/pages/create/create' });
  },
  async prepareShare() {
    const event = this.data.event;
    if (this.data.preparingShare) return;
    if (!currentHostEvent(this) || !canCopyPublishedInvite(event, this.data.isHost,
      this.data.safetyStatus, Date.now(), this._inviteValidUntil))
      return this.setData({ message: '当前活动不能生成分享卡' });
    const context = actionContext(this);
    if (!context) return;
    const attempt = this.sharePrepareAttemptId = (this.sharePrepareAttemptId || 0) + 1;
    const sameRequestOwner = () => attempt === this.sharePrepareAttemptId && sameActionOwner(this, context);
    const sameRequestDetails = () => sameRequestOwner() && this.data.loadState === 'READY' &&
      this.data.event?.version === event.version && this.data.event.inviteToken === event.inviteToken;
    const sourceToken = newSourceToken();
    this.setData({ preparingShare: true, shareSourceToken: '' });
    try {
      await api.post(`/events/${this.data.id}/share-intents`, { expectedVersion: event.version, sourceToken });
      if (sameRequestDetails() && currentHostEvent(this) &&
        canCopyPublishedInvite(this.data.event, this.data.isHost,
          this.data.safetyStatus, Date.now(), this._inviteValidUntil))
        this.setData({ shareSourceToken: sourceToken, message: '分享卡已准备好，请点击工作台中的“微信分享”。' });
    } catch (error) {
      if (sameRequestDetails()) this.setData({ message: error.message || '分享卡准备失败' });
    } finally {
      if (sameRequestOwner()) this.setData({ preparingShare: false });
    }
  },
  openShareCard(actionEvent) {
    if (!currentHostEvent(this)) {
      if (this.data.isHost) this.setData({ canCopyPublishedInvite: false, shareSourceToken: '',
        message: '账号或活动已切换，请重新核对分享资格。' });
      return;
    }
    const copy = actionEvent?.currentTarget?.dataset?.copy;
    const copyIntent = copy === true || copy === 'true' || copy === 1 || copy === '1';
    const poster = actionEvent?.currentTarget?.dataset?.poster;
    const posterIntent = poster === true || poster === 'true' || poster === 1 || poster === '1';
    const canCopyInvite = canCopyPublishedInvite(this.data.event, this.data.isHost,
      this.data.safetyStatus, Date.now(), this._inviteValidUntil);
    if ((copyIntent || posterIntent) && this.data.canCopyPublishedInvite !== canCopyInvite)
      this.setData({ canCopyPublishedInvite: canCopyInvite });
    wx.navigateTo({ url: '/subpackages/activity/share/share?id=' + encodeURIComponent(this.data.id) +
      (copyIntent && canCopyInvite ? '&copy=1' : posterIntent && canCopyInvite ? '&poster=1' :
        !copyIntent && !posterIntent ? '&share=1' : '') });
  },
  onShareAppMessage() {
    if (!currentHostEvent(this) ||
      !canCopyPublishedInvite(this.data.event, this.data.isHost,
        this.data.safetyStatus, Date.now(), this._inviteValidUntil))
      return { title: '活动详情', path: '/pages/index/index' };
    const source = this.data.shareSourceToken ? '&source=' + this.data.shareSourceToken : '';
    return { title: (this.data.event.aiSuggestionGenerated ? '【曾生成 AI 建议】' : '') + this.data.event.payload.title,
      path: '/pages/event/event?token=' + encodeURIComponent(this.data.event.inviteToken) + source };
  }
});
