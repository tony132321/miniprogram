const { api } = require('../../utils/api.js');
const config = require('../../config.js');
const activityStatusLabels = {
  DRAFT: '草稿', REVIEW_PENDING: '待审核', RECRUITING: '招募中', CONFIRMED: '已成局',
  IN_PROGRESS: '进行中', COMPLETED: '已结束', CANCELLED: '已取消', EXPIRED: '未成局'
};
const recordStatusLabels = {
  OPEN: '待处理', IN_REVIEW: '处理中', RESOLVED: '已处理', FULFILLED: '已完成', CANCELLED: '已取消',
  PROTECTED_PENDING_POLICY: '保护措施已生效，待人工核查',
  SAFEGUARDS_APPLIED_PENDING_REVIEW: '账号保护已执行，待人工核查'
};
const appealStatusLabels = { ...recordStatusLabels, IN_REVIEW: '复核中', RESOLVED: '复核完成' };
const appealOutcomeLabels = { UPHOLD: '维持原结论', OVERTURN: '复核改判' };
const privacyKindLabels = { EXPORT: '导出本人数据', DELETE: '注销或删除申请', CORRECT: '更正本人数据' };
const reportKindLabels = { SAFETY: '安全举报', CONTENT: '内容举报', ATTENDANCE: '到场争议', OTHER: '问题反馈' };
const contentKindLabels = { ANNOUNCEMENT: '活动公告', QUESTION: '活动提问', ANSWER: '主办方回复' };
const eventNoticeSections = {
  MATERIAL_CHANGE: 'registrationSection',
  EVENT_REMINDER: 'checkinSection',
  MANUAL_CHECKIN_REQUEST: 'checkinSection',
  EVENT_OUTCOME_REVIEW: 'checkinSection',
  EVENT_OUTCOME_DUE: 'hostSection'
};
const defaultEventReminderNotice = '允许发送活动提醒；站内通知始终可查看，外部消息是否可用以实际服务配置为准。';
const defaultSimilarInvitesNotice = '允许旧活动主办方在结项后看到自己的活动内身份并将自己列入类似活动邀请候选；不会自动发送邀请。';
const profileConsentRecoveryKey = 'irlProfileConsentRecoveryV1';
const maxOfferFocusPages = 5;
function emptySectionLoadErrors() {
  return { notifications: false, privacy: false, blocks: false, removals: false, reports: false,
    appeals: false, content: false, consents: false, similar: false, activities: false };
}
function readProfileIdentity() {
  return typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function'
    ? ['sessionToken', 'userId', 'devUser'].map(key => wx.getStorageSync(key)) : null;
}
function profileOfferIdentity() {
  const token = wx.getStorageSync('sessionToken');
  return token ? 'session:' + wx.getStorageSync('userId') + ':' + token :
    'dev:' + (wx.getStorageSync('devUser') || config.developmentUser || '');
}
function sameProfileIdentity(expected, current) {
  return !expected || !current || expected.every((value, index) => value === current[index]);
}
function beginProfileAction(page, key) {
  if (page._privateActionsBlocked) return null;
  const identity = readProfileIdentity();
  if (page._loadedIdentity && !sameProfileIdentity(page._loadedIdentity, identity)) {
    page.clearForIdentitySwitch();
    return null;
  }
  const generations = page._actionGenerations || (page._actionGenerations = {});
  const actionGeneration = generations[key] = (generations[key] || 0) + 1;
  const viewGeneration = page._viewGeneration || 0;
  const originalRefreshGeneration = page._refreshGeneration || 0;
  return (refreshGeneration = originalRefreshGeneration) =>
    generations[key] === actionGeneration && (page._viewGeneration || 0) === viewGeneration &&
    (page._refreshGeneration || 0) === refreshGeneration &&
    sameProfileIdentity(identity, readProfileIdentity());
}
const profileConsentActions = {
  reminder: { field: 'eventReminder', pending: 'reminderConsentPending', uncertain: 'reminderConsentUncertain',
    reconfirm: 'eventReminderNeedsReconfirmation', notice: 'eventReminderNoticeVersion',
    path: '/me/consents', payloadField: 'eventReminder',
    successOn: '已同意活动提醒', successOff: '已关闭活动提醒' },
  similar: { field: 'similarInvites', pending: 'similarInvitesConsentPending', uncertain: 'similarInvitesConsentUncertain',
    reconfirm: 'similarInvitesNeedsReconfirmation', notice: 'similarInvitesNoticeVersion',
    path: '/me/similar-invites', payloadField: 'granted',
    successOn: '已允许类似活动候选名单收录', successOff: '已撤回类似活动候选名单同意' }
};
function consentOwner(identity) {
  if (!identity) return '';
  if (identity[0]) return 'session:' + (identity[1] || identity[0]);
  const devUser = identity[2] || config.developmentUser;
  return devUser ? 'dev:' + devUser : '';
}
function readConsentRecovery() {
  try {
    const saved = wx.getStorageSync(profileConsentRecoveryKey);
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? { ...saved } : {};
  } catch (_) { return {}; }
}
function savedConsentKey(identity, kind) { return consentOwner(identity) + ':' + kind; }
function saveConsentRecovery(kind, operation) {
  if (!consentOwner(operation.identity) || typeof wx.setStorageSync !== 'function') return false;
  const saved = readConsentRecovery();
  saved[savedConsentKey(operation.identity, kind)] = { granted: operation.granted, payload: operation.payload };
  try { wx.setStorageSync(profileConsentRecoveryKey, saved); return true; }
  catch (_) { return false; }
}
function clearConsentRecovery(kind, operation) {
  const saved = readConsentRecovery();
  const key = savedConsentKey(operation.identity, kind);
  const recorded = saved[key];
  if (!recorded || JSON.stringify(recorded.payload) !== JSON.stringify(operation.payload)) return;
  delete saved[key];
  try { wx.setStorageSync(profileConsentRecoveryKey, saved); } catch (_) { /* Retry remains safe. */ }
}
function clearConsentRecoveryForIdentity(identity) {
  if (!consentOwner(identity)) return;
  const saved = readConsentRecovery();
  for (const kind of Object.keys(profileConsentActions))
    delete saved[savedConsentKey(identity, kind)];
  try { wx.setStorageSync(profileConsentRecoveryKey, saved); } catch (_) { /* The page remains signed out. */ }
}
function recoverConsentOperations(page, identity) {
  const saved = readConsentRecovery();
  const operations = page._consentOperations || (page._consentOperations = {});
  for (const [kind, action] of Object.entries(profileConsentActions)) {
    if (operations[kind]) continue;
    const recorded = saved[savedConsentKey(identity, kind)];
    if (!recorded || typeof recorded.granted !== 'boolean' ||
      !recorded.payload || typeof recorded.payload !== 'object' ||
      recorded.payload[action.payloadField] !== recorded.granted ||
      typeof recorded.payload.noticeVersion !== 'string') continue;
    operations[kind] = { identity, granted: recorded.granted,
      previous: page.data[action.field], payload: recorded.payload };
    page.setData({ [action.uncertain]: true, [action.pending]: false });
  }
}
function uncertainConsentResponse(error) {
  return error?.code === 'NETWORK_ERROR' || (Number.isInteger(error?.status) &&
    (error.status < 400 || error.status === 408 || error.status >= 500));
}
async function submitProfileConsent(page, kind, granted, retry = false) {
  const action = profileConsentActions[kind];
  const identity = readProfileIdentity();
  if (page._loadedIdentity && !sameProfileIdentity(page._loadedIdentity, identity)) {
    page.clearForIdentitySwitch();
    return;
  }
  const operations = page._consentOperations || (page._consentOperations = {});
  if (page.data[action.pending]) return;
  let operation = operations[kind];
  if (retry) {
    if (!page.data[action.uncertain] || !operation || !sameProfileIdentity(operation.identity, identity)) return;
  } else {
    if (page.data[action.uncertain]) {
      page.setData({ [action.field]: page.data[action.field] });
      return;
    }
    operation = { identity, granted: Boolean(granted), previous: page.data[action.field],
      payload: { [action.payloadField]: Boolean(granted), noticeVersion: page.data[action.notice] } };
    if (!saveConsentRecovery(kind, operation)) {
      page.setData({ [action.field]: operation.previous,
        message: '本地存储不可用，授权尚未提交，请恢复存储后重试。' });
      return;
    }
    operations[kind] = operation;
  }
  const current = () => page._consentOperations === operations && operations[kind] === operation &&
    sameProfileIdentity(operation.identity, readProfileIdentity());
  const originalRefreshGeneration = page._refreshGeneration || 0;
  page.setData({ [action.field]: operation.previous, [action.pending]: true, [action.uncertain]: false,
    message: retry ? '正在核对上次授权提交结果…' : '正在提交授权，请稍候…' });
  try {
    await api.post(action.path, operation.payload);
    if (!current()) return;
    const loaded = await page.refresh();
    if (!current()) return;
    delete operations[kind];
    clearConsentRecovery(kind, operation);
    const consentReady = page.data[kind === 'reminder' ? 'consentLoadState' : 'similarInviteLoadState'] === 'READY';
    const confirmed = loaded && consentReady && page.data[action.field] === operation.granted &&
      page.data[action.reconfirm] === false;
    page.setData({ [action.pending]: false, [action.uncertain]: false,
      message: confirmed ? (operation.granted ? action.successOn : action.successOff)
        : !loaded || !consentReady ? '授权提交已受理，但当前状态未能确认，请重新加载。'
          : '授权提交结果与当前状态不一致，已显示服务端状态；如需更改，请重新操作。' });
  } catch (error) {
    if (!current()) return;
    if (!uncertainConsentResponse(error)) clearConsentRecovery(kind, operation);
    if (page.handlePrivateAccessError(error)) return;
    if (uncertainConsentResponse(error)) {
      page.setData({ [action.field]: operation.previous, [action.pending]: false,
        [action.uncertain]: true,
        message: '授权提交结果尚未确认。请点击下方按钮核对同一次操作，暂不要重新切换。' });
      return;
    }
    if (error?.code === 'CONSENT_NOTICE_CHANGED' ||
      originalRefreshGeneration !== (page._refreshGeneration || 0)) {
      await page.refresh();
      if (!current()) return;
    }
    delete operations[kind];
    page.setData({ [action.pending]: false, [action.uncertain]: false,
      ...(error?.code === 'CONSENT_NOTICE_CHANGED' ||
        originalRefreshGeneration !== (page._refreshGeneration || 0)
        ? {} : { [action.field]: operation.previous }),
      message: error?.code === 'CONSENT_NOTICE_CHANGED'
        ? '授权说明已更新，请重新阅读后确认。' : error?.message || '授权未完成，请重试。' });
  }
}
function activityCover(item) {
  const title = item.title || '';
  if (item.type === 'badminton' || /羽毛球/.test(title)) return '/assets/stitch/caper_home_badminton.jpg';
  if (/篮球/.test(title)) return '/assets/stitch/caper_discover_basketball.jpg';
  if (/咖啡|创业|聊天/.test(title)) return '/assets/stitch/caper_discover_coffee.jpg';
  if (/桌游|游戏/.test(title)) return '/assets/stitch/caper_discover_boardgame.jpg';
  if (/徒步|露营|登山/.test(title)) return '/assets/stitch/caper_home_hiking.jpg';
  if (/展览|艺术|画/.test(title)) return '/assets/stitch/caper_discover_art.jpg';
  return '/assets/stitch/caper_discover_citywalk.jpg';
}
function activityDateLabel(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '时间待定';
  const date = new Date(Date.parse(value) + 8 * 60 * 60_000);
  return `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日 ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}
function headerPaddingRight() {
  try {
    const menu = wx.getMenuButtonBoundingClientRect?.();
    const windowWidth = (wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {}).windowWidth;
    if (Number.isFinite(menu?.left) && Number.isFinite(windowWidth) && menu.left >= 0 && menu.left < windowWidth)
      return `${Math.ceil(windowWidth - menu.left + 8)}px`;
  } catch (_) { /* Reserve a fixed space for the native menu on older clients. */ }
  return '112px';
}
const externalStatusLabels = {
  NOT_REQUESTED: '外部提醒待处理',
  DISPATCHING: '外部提醒请求处理中',
  UNAVAILABLE: '外部提醒不可用，请查看站内通知',
  PURPOSE_NOT_CONFIGURED: '未开通外部提醒，请查看站内通知',
  CONSENT_WITHDRAWN: '未开通外部提醒',
  CONSENT_RECONFIRM_REQUIRED: '外部提醒需重新授权',
  PROVIDER_ACCEPTED: '提供方已受理，未确认送达',
  UNKNOWN_REQUIRES_RECONCILIATION: '外部提醒结果待核对，请查看站内通知',
  STALE_VERSION: '旧版本提醒已取消',
  STALE_STATE: '过期外部提醒未发送',
  ACCOUNT_DISABLED: '账号已停用，外部提醒未发送',
  DELETE_REQUEST_PENDING: '删除申请处理中，外部提醒未发送',
  PROVIDER_REJECTED: '外部提醒发送失败，请查看站内通知',
  FAILED: '外部提醒发送失败，请查看站内通知'
};
const noticeKindLabels = {
  WAITLIST_OFFER: '收到补位邀请', WAITLIST_WINDOW_CLOSED: '补位时间窗口已结束',
  REGISTRATION_STATUS: '报名状态已更新', REGISTRATION_APPROVED: '报名已通过',
  REGISTRATION_REMOVED: '报名已移除', MANUAL_CHECKIN_REQUEST: '请核对到场补记',
  MATERIAL_CHANGE: '活动规则已更新', EVENT_CONFIRMED: '活动已成局',
  EVENT_CANCELLED: '活动已取消', EVENT_EXPIRED: '活动未成局',
  EVENT_SAFETY_PAUSED: '活动暂时停止招募', EVENT_SAFETY_RESUMED: '活动恢复招募',
  EVENT_SAFETY_REVIEW_CLOSED: '活动安全复核已结束', EVENT_REMINDER: '活动即将开始',
  EVENT_OUTCOME_DUE: '请记录活动结项', EVENT_OUTCOME_REVIEW: '请反馈活动结项',
  PUBLIC_RECRUITMENT_CLOSED: '活动招募暂停', PUBLIC_RECRUITMENT_OPEN: '活动招募恢复',
  REPORT_CREATED_UNSCOPED: '举报已提交', REPORT_IN_REVIEW: '举报正在处理',
  REPORT_IN_REVIEW_UNSCOPED: '举报正在处理', REPORT_RESOLVED: '举报已有处理结论',
  REPORT_RESOLVED_UNSCOPED: '举报已有处理结论', APPEAL_CREATED: '申诉已提交',
  APPEAL_IN_REVIEW: '申诉正在复核', APPEAL_RESOLVED: '申诉已有复核结论',
  CONTENT_REJECTED: '活动内容未通过审核', CONTENT_REVIEW_OVERTURN: '活动内容复核已有结论',
  EVENT_REVIEW_APPROVED: '活动内容审核通过', EVENT_REVIEW_REJECTED: '活动内容审核未通过'
};
const profileRecordSectionByNoticeKind = {
  REGISTRATION_REMOVED: 'appealSection',
  REPORT_IN_REVIEW: 'reportSection', REPORT_RESOLVED: 'reportSection',
  REPORT_CREATED_UNSCOPED: 'reportSection', REPORT_IN_REVIEW_UNSCOPED: 'reportSection',
  REPORT_RESOLVED_UNSCOPED: 'reportSection',
  APPEAL_CREATED: 'appealSection', APPEAL_IN_REVIEW: 'appealSection', APPEAL_RESOLVED: 'appealSection',
  CONTENT_REJECTED: 'contentSection', CONTENT_REVIEW_OVERTURN: 'contentSection'
};
const profileRecordFocusMessages = {
  reportSection: '请在下方“举报与求助”查看处理进度与结论。',
  appealSection: '请在下方“报名移除与申诉”查看原因和复核进度。',
  contentSection: '请在下方“内容审核与复核”查看原因和复核结论。'
};
function presentNotifications(items, activities = []) {
  const eventTitles = new Map(activities.filter(item => item.id && item.title)
    .map(item => [item.id, item.title]));
  return items.map(item => ({ ...item,
    kindLabel: noticeKindLabels[item.kind] || '站内通知',
    statusLabel: item.status === 'OPENED' ? '已读' : '未读',
    isOpened: item.status === 'OPENED',
    eventLabel: item.event_id ? (eventTitles.get(item.event_id) || '相关活动') : '',
    externalStatusLabel: Object.prototype.hasOwnProperty.call(externalStatusLabels, item.external_status)
      ? externalStatusLabels[item.external_status] : '外部提醒状态待核对' }));
}
function filteredActivityItems(items, filter) {
  if (filter === 'attended') return items.filter(item => item.myRegistrationStatus === 'CONFIRMED');
  if (filter === 'hosted') return items.filter(item => item.isHost);
  return items;
}
const activityEmptyLabels = {
  all: '暂无本人活动记录，可从邀请进入或发起一场活动。',
  attended: '暂无已确认报名的活动。',
  hosted: '暂无你发起的活动，可先发布一场受控活动。'
};
Page({
  data: { statusBarHeight: 24, headerPaddingRight: headerPaddingRight(), advancedOpen: false,
    devUser: '', developmentMode: Boolean(config.developmentUser), hasSession: false, notifications: [], notificationsTotal: 0,
    activityStats: { total: null, hosted: null, confirmed: null }, activityItems: [], activityFilter: 'all',
    activityEmptyLabel: activityEmptyLabels.all, activityPreview: [], hostedPreview: null,
    inviteReady: false, inviteCandidateCount: 0, activityLoadState: 'IDLE',
    nextNotificationOffset: null, notificationSnapshot: null, notificationLoadState: 'IDLE',
    privacy: [], blocks: [], removals: [], reports: [], appeals: [], rejectedContent: [],
    appealDescription: '', reportAppealDescription: '', contentAppealDescription: '', eventReminder: false,
    similarInvites: false, eventReminderNeedsReconfirmation: false, similarInvitesNeedsReconfirmation: false,
    eventReminderNotice: defaultEventReminderNotice,
    eventReminderNoticeVersion: '',
    similarInvitesNotice: defaultSimilarInvitesNotice,
    similarInvitesNoticeVersion: '',
    consentLoadState: 'IDLE', similarInviteLoadState: 'IDLE',
    reminderConsentPending: false, similarInvitesConsentPending: false,
    reminderConsentUncertain: false, similarInvitesConsentUncertain: false,
    sectionLoadErrors: emptySectionLoadErrors(),
    loadState: 'IDLE', message: '', reportDescription: '', reportEventId: '',
    focusedOfferId: '', offerFocusMessage: '' },
  onLoad() { this.setData({ statusBarHeight: wx.getSystemInfoSync?.().statusBarHeight || 24,
    headerPaddingRight: headerPaddingRight() }); },
  async onShow() {
    this._viewGeneration = (this._viewGeneration || 0) + 1;
    if (this._loadedIdentity && !sameProfileIdentity(this._loadedIdentity, readProfileIdentity()))
      this.clearPrivateData();
    const viewGeneration = this._viewGeneration;
    const offerFocusGeneration = this._offerFocusGeneration = (this._offerFocusGeneration || 0) + 1;
    const bar = this.getTabBar && this.getTabBar(); if (bar) bar.setData({ selected: 4 });
    this.setData({ headerPaddingRight: headerPaddingRight() });
    if (this.data.developmentMode) this.setData({ devUser: wx.getStorageSync('devUser') || config.developmentUser });
    const app = getApp();
    await app.globalData.ready;
    if (viewGeneration !== this._viewGeneration) return;
    const profileFocus = app.globalData.profileFocus === 'privacySection' ? 'privacySection' : '';
    app.globalData.profileFocus = undefined;
    const storedFocus = wx.getStorageSync('irlProfileFocusIntent');
    if (storedFocus) wx.removeStorageSync('irlProfileFocusIntent');
    const storedOfferIntent = wx.getStorageSync('irlProfileOfferIntent');
    if (storedOfferIntent) wx.removeStorageSync('irlProfileOfferIntent');
    const offerEventId = storedOfferIntent && typeof storedOfferIntent.eventId === 'string' &&
      storedOfferIntent.eventId && storedOfferIntent.owner === profileOfferIdentity()
      ? storedOfferIntent.eventId : '';
    this.setData({ focusedOfferId: '', offerFocusMessage: '' });
    const allowedNoticeSections = ['noticeSection', 'reportSection', 'appealSection', 'contentSection',
      'notificationSettingsSection'];
    const requestedFocus = profileFocus || (allowedNoticeSections.includes(storedFocus) ? storedFocus : '');
    const hasSession = Boolean(wx.getStorageSync('sessionToken'));
    this.setData({ hasSession });
    if (!hasSession && !this.data.developmentMode) {
      app.globalData.reportContext = undefined;
      this.clearPrivateData();
      this._privateActor = null;
      this._pendingFocus = requestedFocus;
      return this.setData({ loadState: 'UNAUTHENTICATED', message: '请先微信登录' });
    }
    this._pendingFocus = '';
    const actor = hasSession ? (wx.getStorageSync('userId') || wx.getStorageSync('sessionToken')) : this.data.devUser;
    const privateActor = `${hasSession ? 'session' : 'dev'}:${actor}`;
    if (this._privateActor !== privateActor) this.clearPrivateData();
    this._privateActor = privateActor;
    const reportContext = app.globalData.reportContext;
    app.globalData.reportContext = undefined;
    const reportContextMatches = reportContext?.actor === actor &&
      reportContext?.owner === profileOfferIdentity();
    if (reportContext) this.setData({ reportEventId: reportContextMatches ? reportContext.eventId : '',
      advancedOpen: reportContextMatches || this.data.advancedOpen });
    await this.refresh();
    if (this.data.loadState === 'UNAUTHENTICATED' || this.data.loadState === 'ACCESS_DENIED') return;
    if (offerEventId) await this.focusOfferNotification(offerEventId, privateActor, offerFocusGeneration);
    else if (reportContextMatches) this.revealAdvanced('reportSection');
    else if (requestedFocus) this.revealAdvanced(requestedFocus, requestedFocus !== 'notificationSettingsSection');
  },
  onHide() { this._pendingFocus = ''; this._offerFocusGeneration = (this._offerFocusGeneration || 0) + 1; },
  onUnload() { this._pendingFocus = ''; this._offerFocusGeneration = (this._offerFocusGeneration || 0) + 1; },
  clearForIdentitySwitch() {
    this.clearPrivateData(); this._privateActor = null;
    this._privateActionsBlocked = true;
    this.setData({ hasSession: false, loadState: 'UNAUTHENTICATED', message: '账号已切换，请重新进入个人页。' });
  },
  handlePrivateAccessError(error) {
    if (!['UNAUTHENTICATED', 'FORBIDDEN', 'IDENTITY_CHANGED'].includes(error?.code) &&
      error?.status !== 401 && error?.status !== 403) return false;
    const unauthenticated = error?.code === 'UNAUTHENTICATED' || error?.status === 401;
    this.clearPrivateData(); this._privateActor = null;
    if (unauthenticated && typeof wx !== 'undefined') {
      wx.removeStorageSync?.('sessionToken'); wx.removeStorageSync?.('userId');
    }
    this.setData({ hasSession: false, loadState: unauthenticated ? 'UNAUTHENTICATED' : 'ACCESS_DENIED',
      message: unauthenticated ? '登录已失效，请重新微信登录。' : '当前身份无法读取个人资料，请重新核对账号。' });
    return true;
  },
  async refresh() {
    const identity = readProfileIdentity();
    if (this._loadedIdentity && !sameProfileIdentity(this._loadedIdentity, identity)) {
      this.clearPrivateData();
      this._privateActor = null;
    }
    const generation = this._refreshGeneration = (this._refreshGeneration || 0) + 1;
    this.setData({ nextNotificationOffset: null, loadState: 'LOADING', sectionLoadErrors: emptySectionLoadErrors() });
    try {
      const names = ['notifications', 'privacy', 'blocks', 'removals', 'reports', 'appeals', 'content',
        'consents', 'similar', 'activities'];
      const paths = ['/me/notifications?offset=0', '/privacy/requests', '/me/blocks', '/me/removals',
        '/me/reports', '/me/appeals', '/me/content', '/me/consents', '/me/similar-invites', '/me/events'];
      const results = await Promise.all(paths.map(path => Promise.resolve().then(() => api.get(path))
        .then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }))));
      if (generation !== this._refreshGeneration) return false;
      if (!sameProfileIdentity(identity, readProfileIdentity())) { this.clearForIdentitySwitch(); return false; }
      const denied = results.find(result => result.status === 'rejected' &&
        (['UNAUTHENTICATED', 'FORBIDDEN', 'IDENTITY_CHANGED'].includes(result.reason?.code) ||
          result.reason?.status === 401 || result.reason?.status === 403));
      if (denied) { this.handlePrivateAccessError(denied.reason); return false; }
      const values = results.map(result => result.status === 'fulfilled' ? result.value : null);
      const sectionLoadErrors = emptySectionLoadErrors();
      names.forEach((name, index) => { sectionLoadErrors[name] = results[index].status === 'rejected'; });
      [0, 1, 2, 3, 4, 5, 6, 9].forEach(index => {
        if (values[index] && !Array.isArray(values[index].items)) {
          sectionLoadErrors[names[index]] = true; values[index] = null;
        }
      });
      if (values[7] && typeof values[7].eventReminder !== 'boolean') {
        sectionLoadErrors.consents = true; values[7] = null;
      }
      if (values[8] && typeof values[8].granted !== 'boolean') {
        sectionLoadErrors.similar = true; values[8] = null;
      }
      const [notifications, privacy, blocks, removals, reports, appeals, rejectedContent, consents, similar, activityResult] = values;
      const activityItems = Array.isArray(activityResult?.items) ? activityResult.items : null;
      if (!activityItems) sectionLoadErrors.activities = true;
      const eventTitles = new Map((activityItems || []).filter(item => item.id && item.title)
        .map(item => [item.id, item.title]));
      const eventLabel = eventId => eventTitles.get(eventId) || '相关活动';
      const listItems = value => Array.isArray(value?.items) ? value.items : [];
      const errors = Object.values(sectionLoadErrors).filter(Boolean).length;
      const mappedActivityItems = activityItems ? activityItems.map(item => ({
        ...item, statusLabel: activityStatusLabels[item.status] || '状态待核对',
        dateLabel: activityDateLabel(item.startAt), cover: activityCover(item)
      })) : [];
      const activityFilter = this.data.activityFilter;
      const notificationItems = listItems(notifications);
      this._loadedIdentity = identity;
      this._privateActionsBlocked = false;
      this.setData({ notifications: presentNotifications(notificationItems, activityItems || []),
        notificationsTotal: notifications ? notifications.total ?? notificationItems.length : 0,
        nextNotificationOffset: notifications?.nextOffset ?? null, notificationSnapshot: notifications?.snapshot ?? null,
        notificationLoadState: notifications ? 'READY' : 'ERROR',
        privacy: listItems(privacy).map(item => ({ ...item,
          kindLabel: privacyKindLabels[item.kind] || '个人信息请求',
          statusLabel: recordStatusLabels[item.status] || '状态待核对' })),
        blocks: listItems(blocks),
        removals: listItems(removals).map(item => ({ ...item, eventLabel: eventLabel(item.event_id) })),
        reports: listItems(reports).map(item => ({ ...item,
          eventLabel: item.event_id ? eventLabel(item.event_id) : '',
          kindLabel: reportKindLabels[item.kind] || '举报与求助',
          statusLabel: recordStatusLabels[item.status] || '状态待核对' })),
        appeals: listItems(appeals).map(item => ({ ...item,
          statusLabel: appealStatusLabels[item.status] || '状态待核对',
          outcomeLabel: item.outcome ? (appealOutcomeLabels[item.outcome] || '结论待核对') : '' })),
        rejectedContent: listItems(rejectedContent).map(item => ({ ...item,
          eventLabel: eventLabel(item.event_id),
          kindLabel: contentKindLabels[item.kind] || '活动内容',
          appealStatusLabel: item.appeal_status ? (appealStatusLabels[item.appeal_status] || '状态待核对') : '' })),
        eventReminder: Boolean(consents?.eventReminder), similarInvites: Boolean(similar?.granted),
        eventReminderNeedsReconfirmation: Boolean(consents?.reconfirmationRequired),
        similarInvitesNeedsReconfirmation: Boolean(similar?.reconfirmationRequired),
        eventReminderNotice: consents?.eventReminderNotice?.text || defaultEventReminderNotice,
        eventReminderNoticeVersion: consents?.eventReminderNotice?.version || '',
        similarInvitesNotice: similar?.notice?.text || defaultSimilarInvitesNotice,
        similarInvitesNoticeVersion: similar?.notice?.version || '',
        consentLoadState: consents ? 'READY' : 'ERROR', similarInviteLoadState: similar ? 'READY' : 'ERROR',
        activityStats: activityItems ? { total: activityItems.length,
          hosted: activityItems.filter(item => item.isHost).length,
          confirmed: activityItems.filter(item => item.myRegistrationStatus === 'CONFIRMED').length } :
          { total: null, hosted: null, confirmed: null },
        activityItems: mappedActivityItems,
        activityPreview: filteredActivityItems(mappedActivityItems, activityFilter).slice(0, 4),
        hostedPreview: mappedActivityItems.find(item => item.isHost) || null,
        inviteReady: mappedActivityItems.some(item => item.isHost && item.status === 'RECRUITING'),
        inviteCandidateCount: mappedActivityItems.filter(item => item.isHost && item.status === 'RECRUITING').length,
        activityLoadState: activityItems ? 'READY' : 'ERROR',
        sectionLoadErrors, loadState: errors === 0 ? 'READY' : errors === results.length ? 'ERROR' : 'PARTIAL',
        message: errors === results.length ? (results.find(result => result.status === 'rejected')?.reason?.message || '加载失败，请重试。')
          : errors ? '部分内容加载失败，请点击重新加载。' : '' });
      recoverConsentOperations(this, identity);
      return errors < results.length;
    } catch (_) {
      if (generation === this._refreshGeneration) {
        this.clearPrivateData();
        this.setData({ loadState: 'ERROR', message: '个人资料加载失败，请重试。' });
      }
      return false;
    }
  },
  retryRefresh() {
    if (!this.data.hasSession && !this.data.developmentMode)
      return this.data.loadState === 'ACCESS_DENIED' ? this.login() : undefined;
    return this.refresh();
  },
  toggleAdvanced() {
    if (!this.data.hasSession && !this.data.developmentMode) return;
    this.setData({ advancedOpen: !this.data.advancedOpen });
  },
  revealAdvanced(sectionId, unfold = true) {
    if (unfold) this.setData({ advancedOpen: true });
    const scroll = () => {
      const selector = '#' + sectionId;
      const fallback = () => wx.pageScrollTo?.({ selector, duration: 180 });
      const query = wx.createSelectorQuery?.();
      if (!query) return fallback();
      query.select(selector).boundingClientRect();
      query.selectViewport().scrollOffset();
      query.exec(([rect, viewport]) => {
        if (!Number.isFinite(rect?.top) || !Number.isFinite(viewport?.scrollTop)) return fallback();
        const stickyInset = (Number(this.data.statusBarHeight) || 24) + 76;
        wx.pageScrollTo?.({ scrollTop: Math.max(0, Math.round(viewport.scrollTop + rect.top - stickyInset)), duration: 180 });
      });
    };
    if (typeof wx.nextTick === 'function') wx.nextTick(scroll);
    else scroll();
  },
  async focusOfferNotification(eventId, actor, focusGeneration) {
    const current = () => this._offerFocusGeneration === focusGeneration &&
      this._privateActor === actor && this._loadedIdentity &&
      sameProfileIdentity(this._loadedIdentity, readProfileIdentity());
    const unavailable = message => {
      if (!current()) return;
      this.setData({ offerFocusMessage: message,
        notifications: this.data.notifications.map(item => item.kind === 'WAITLIST_OFFER' &&
          item.event_id === eventId ? { ...item, actionable: false, declinable: false } : item) });
      this.revealAdvanced('noticeSection');
    };
    if (this.data.notificationLoadState !== 'READY' || this.data.activityLoadState !== 'READY')
      return unavailable('当前补位通知或报名状态暂不可用，请重新加载后核对。');
    if (!this.data.activityItems.some(item => item.id === eventId && item.myRegistrationStatus === 'OFFERED'))
      return unavailable('这场活动的报名状态已变化，请到活动详情核对。');
    let event;
    try { event = await api.get('/events/' + encodeURIComponent(eventId)); }
    catch (error) {
      if (!current()) return;
      if (this.handlePrivateAccessError(error)) return;
      return unavailable('当前活动版本暂不可核对，请重新加载后处理补位。');
    }
    if (!current()) return;
    if (event?.id !== eventId || !Number.isSafeInteger(event.version))
      return unavailable('当前活动版本暂不可核对，请重新加载后处理补位。');
    let stale = null;
    let restarts = 0;
    let pagesRead = 1;
    while (current()) {
      const matches = this.data.notifications.filter(item =>
        item.kind === 'WAITLIST_OFFER' && item.event_id === eventId);
      const live = matches.find(item => typeof item.detail?.offerId === 'string' && item.detail.offerId &&
        item.event_version === event.version && Date.parse(item.detail.expiresAt) > Date.now() &&
        (item.actionable || item.declinable));
      if (live) {
        this.setData({ focusedOfferId: live.id,
          offerFocusMessage: '请核对补位截止时间，再选择确认或放弃。' });
        return this.revealAdvanced(/^[A-Za-z0-9_-]+$/.test(live.id) ? 'notice-' + live.id : 'noticeSection');
      }
      if (!stale && matches.length) stale = matches[0];
      const offset = this.data.nextNotificationOffset;
      if (offset === null || offset === undefined) break;
      if (pagesRead >= maxOfferFocusPages)
        return unavailable('通知较多，暂未定位到这场活动的补位邀请；请在全部通知中查找或刷新。');
      const beforeCount = this.data.notifications.length;
      const beforeSnapshot = this.data.notificationSnapshot;
      await this.loadMoreNotifications();
      if (!current()) return;
      pagesRead += beforeSnapshot === this.data.notificationSnapshot ? 1 : 2;
      if (pagesRead > maxOfferFocusPages)
        return unavailable('通知列表变化且通知较多，请在全部通知中查找或刷新。');
      if (beforeSnapshot !== this.data.notificationSnapshot) {
        if (++restarts > 1) return unavailable('通知列表持续变化，请重新加载后处理补位。');
        stale = null;
        continue;
      }
      if (this.data.notifications.length <= beforeCount || this.data.nextNotificationOffset === offset)
        return unavailable('后续通知暂不可用，请重新加载后处理补位。');
    }
    if (!current()) return;
    if (!stale) return unavailable('未找到这场活动当前可处理的补位通知，请刷新活动状态。');
    this.setData({ focusedOfferId: stale.id,
      offerFocusMessage: '这场活动的补位邀请已失效或版本已变化，请刷新活动状态。',
      notifications: this.data.notifications.map(item => item.kind === 'WAITLIST_OFFER' && item.event_id === eventId
        ? { ...item, actionable: false, declinable: false } : item) });
    this.revealAdvanced(/^[A-Za-z0-9_-]+$/.test(stale.id) ? 'notice-' + stale.id : 'noticeSection');
  },
  async loadMoreNotifications() {
    const offset = this.data.nextNotificationOffset;
    if (offset === null || offset === undefined) return;
    const generation = this._refreshGeneration;
    const identity = readProfileIdentity();
    if (!sameProfileIdentity(this._loadedIdentity, identity)) return this.clearForIdentitySwitch();
    const snapshot = this.data.notificationSnapshot;
    this.setData({ nextNotificationOffset: null });
    try {
      const page = await api.get(`/me/notifications?offset=${offset}&snapshot=${encodeURIComponent(snapshot)}`);
      if (generation !== this._refreshGeneration) return;
      if (!sameProfileIdentity(identity, readProfileIdentity())) return this.clearForIdentitySwitch();
      this.setData({ notifications: this.data.notifications.concat(presentNotifications(page.items, this.data.activityItems)), notificationsTotal: page.total,
        nextNotificationOffset: page.nextOffset ?? null, notificationSnapshot: page.snapshot });
    } catch (error) {
      if (generation !== this._refreshGeneration) return;
      if (!sameProfileIdentity(identity, readProfileIdentity())) return this.clearForIdentitySwitch();
      if (this.handlePrivateAccessError(error)) return;
      if (error.code === 'QUEUE_CHANGED') {
        if (await this.refresh() && this.data.notificationLoadState === 'READY')
          this.setData({ message: '通知列表已变化，已从最新通知重新加载。' });
      } else this.setData({ nextNotificationOffset: offset, message: error.message });
    }
  },
  clearPrivateData() {
    this._viewGeneration = (this._viewGeneration || 0) + 1;
    this._refreshGeneration = (this._refreshGeneration || 0) + 1;
    this._loadedIdentity = null;
    this._consentOperations = {};
    this.setData({ notifications: [], notificationsTotal: 0, nextNotificationOffset: null,
      activityStats: { total: null, hosted: null, confirmed: null }, activityItems: [], activityFilter: 'all',
      activityEmptyLabel: activityEmptyLabels.all, activityPreview: [], hostedPreview: null,
      inviteReady: false, inviteCandidateCount: 0, activityLoadState: 'IDLE',
      notificationSnapshot: null, notificationLoadState: 'IDLE', privacy: [], blocks: [], removals: [], reports: [], appeals: [], rejectedContent: [],
      eventReminder: false, similarInvites: false, eventReminderNeedsReconfirmation: false,
      similarInvitesNeedsReconfirmation: false, eventReminderNotice: defaultEventReminderNotice,
      eventReminderNoticeVersion: '', similarInvitesNotice: defaultSimilarInvitesNotice,
      similarInvitesNoticeVersion: '', consentLoadState: 'IDLE', similarInviteLoadState: 'IDLE',
      reminderConsentPending: false, similarInvitesConsentPending: false,
      reminderConsentUncertain: false, similarInvitesConsentUncertain: false,
      sectionLoadErrors: emptySectionLoadErrors(), advancedOpen: false,
      focusedOfferId: '', offerFocusMessage: '', reportDescription: '', appealDescription: '',
      reportAppealDescription: '', contentAppealDescription: '', reportEventId: '', loadState: 'IDLE', message: '' });
  },
  devInput(event) { this.setData({ devUser: event.detail.value.trim() }); },
  setDevUser() {
    if (!this.data.developmentMode) return this.setData({ message: '正式版本不支持测试身份' });
    this.clearPrivateData();
    this._privateActor = `dev:${this.data.devUser}`;
    wx.removeStorageSync('sessionToken'); wx.removeStorageSync('userId');
    wx.setStorageSync('devUser', this.data.devUser);
    this.setData({ hasSession: false, message: '本地测试身份已切换；正式服务不接受开发身份。' });
    this.refresh();
  },
  async login() {
    const generation = this._refreshGeneration || 0;
    const requestedFocus = this._pendingFocus;
    try {
      wx.removeStorageSync('devUser');
      const session = await api.login();
      if (generation !== (this._refreshGeneration || 0)) {
        this._pendingFocus = '';
        return;
      }
      this.clearPrivateData();
      this._privateActor = `session:${session.userId}`;
      this.setData({ hasSession: true, message: '已登录，正在加载个人资料。' });
      await this.refresh();
      this._pendingFocus = '';
      if (requestedFocus) this.revealAdvanced(requestedFocus, requestedFocus !== 'notificationSettingsSection');
    } catch (error) {
      this._pendingFocus = '';
      if (generation === (this._refreshGeneration || 0)) this.setData({ message: error.message });
    }
  },
  async logout() {
    const identity = readProfileIdentity();
    try {
      await api.logout();
      clearConsentRecoveryForIdentity(identity);
      this.clearPrivateData();
      this._privateActor = null;
      this.setData({ hasSession: false, message: '已退出登录' });
      wx.switchTab({ url: '/pages/index/index' });
    } catch (error) { this.setData({ message: '退出未完成：' + (error.message || '请重试') }); }
  },
  async toggleReminder(event) {
    return submitProfileConsent(this, 'reminder', event.detail.value);
  },
  async toggleSimilarInvites(event) {
    return submitProfileConsent(this, 'similar', event.detail.value);
  },
  async retryReminderConsent() { return submitProfileConsent(this, 'reminder', undefined, true); },
  async retrySimilarInvitesConsent() { return submitProfileConsent(this, 'similar', undefined, true); },
  async revokeBlock(event) {
    const current = beginProfileAction(this, 'revokeBlock');
    if (!current) return;
    try {
      await api.post(`/me/blocks/${encodeURIComponent(event.currentTarget.dataset.id)}/revoke`, {});
      if (!current()) return;
      const refreshing = this.refresh();
      const refreshGeneration = this._refreshGeneration || 0;
      if (await refreshing && current(refreshGeneration)) this.setData({ message: '已撤销屏蔽。' });
    } catch (error) { if (current()) this.setData({ message: error.message }); }
  },
  async acceptOffer(event) {
    return this.runOfferDecision(event, 'accept', '已主动确认补位');
  },
  async declineOffer(event) {
    return this.runOfferDecision(event, 'decline', '已拒绝补位，名额将按候补顺序处理。');
  },
  async runOfferDecision(event, decision, successMessage) {
    const id = event.currentTarget.dataset.id; const version = Number(event.currentTarget.dataset.version);
    const identity = readProfileIdentity();
    const actor = this._privateActor;
    const focusGeneration = this._offerFocusGeneration;
    const current = () => this._privateActor === actor && this._offerFocusGeneration === focusGeneration &&
      sameProfileIdentity(identity, readProfileIdentity());
    if (!current()) return;
    try {
      await api.post(`/offers/${id}/${decision}`, { expectedVersion: version });
      if (!current()) return;
      const refreshing = this.refresh();
      const refreshGeneration = this._refreshGeneration;
      await refreshing;
      if (!current() || this._refreshGeneration !== refreshGeneration) return;
      this.setData({ focusedOfferId: '', offerFocusMessage: '', message: successMessage });
    } catch (error) { if (current()) await this.handleOfferActionError(error, id, current); }
  },
  async handleOfferActionError(error, offerId, current) {
    if (!current()) return;
    if (['OFFER_UNAVAILABLE', 'VERSION_CONFLICT'].includes(error?.code)) {
      const refreshing = this.refresh();
      const refreshGeneration = this._refreshGeneration;
      await refreshing;
      if (!current() || this._refreshGeneration !== refreshGeneration) return;
      this.setData({ focusedOfferId: this.data.notifications.some(item => item.id === this.data.focusedOfferId)
        ? this.data.focusedOfferId : '', offerFocusMessage: error.message || '补位状态已变化，请重新核对。',
      notifications: this.data.notifications.map(item => item.kind === 'WAITLIST_OFFER' &&
        item.detail?.offerId === offerId ? { ...item, actionable: false, declinable: false } : item) });
    }
    if (current()) this.setData({ message: error?.message || '补位操作未完成，请重试。' });
  },
  async openNotice(event) {
    const current = beginProfileAction(this, 'openNotice');
    if (!current) return;
    const { id: tappedId, event: tappedEventId, kind: tappedKind } = event.currentTarget.dataset;
    if (!tappedId || this.data.notificationLoadState !== 'READY' || this.data.loadState === 'LOADING') return;
    const notice = this.data.notifications.find(item => String(item.id) === String(tappedId) &&
      item.kind === tappedKind && String(item.event_id ?? '') === String(tappedEventId ?? ''));
    if (!notice) return;
    const { id, event_id: eventId, kind } = notice;
    const profileRecordSection = profileRecordSectionByNoticeKind[kind];
    if (['EVENT_OUTCOME_DUE', 'EVENT_OUTCOME_REVIEW'].includes(kind) && !eventId)
      return this.setData({ message: '活动信息缺失，请刷新后重试。' });
    try {
      if (eventId && !profileRecordSection) {
        const targetSection = eventNoticeSections[kind];
        await new Promise((resolve, reject) => wx.navigateTo({
          url: '/pages/event/event?id=' + encodeURIComponent(eventId) +
            (targetSection ? '&section=' + targetSection : '') +
            (kind === 'EVENT_OUTCOME_DUE' ? '&entry=hostCompletion' :
              kind === 'EVENT_OUTCOME_REVIEW' ? '&entry=memberFeedback' : ''),
          success: resolve, fail: reject
        }));
      }
      if (!current()) return;
      await api.post(`/me/notifications/${encodeURIComponent(id)}/open`, {});
      if (!current()) return;
      if (profileRecordSection) {
        const refreshing = this.refresh();
        const refreshGeneration = this._refreshGeneration || 0;
        if (!await refreshing || !current(refreshGeneration)) return;
        this.revealAdvanced(profileRecordSection);
        return this.setData({ message: profileRecordFocusMessages[profileRecordSection] });
      }
      if (!eventId) {
        const refreshing = this.refresh();
        const refreshGeneration = this._refreshGeneration || 0;
        if (!await refreshing || !current(refreshGeneration)) return;
        return this.setData({ message: '通知已打开。' });
      }
    } catch (error) { if (current()) this.setData({ message: error.message || error.errMsg || '打开通知失败，请重试。' }); }
  },
  reportInput(event) { this.setData({ reportDescription: event.detail.value }); },
  appealInput(event) { this.setData({ appealDescription: event.detail.value }); },
  reportAppealInput(event) { this.setData({ reportAppealDescription: event.detail.value }); },
  contentAppealInput(event) { this.setData({ contentAppealDescription: event.detail.value }); },
  async appealRemoval(event) {
    const current = beginProfileAction(this, 'appealRemoval');
    if (!current) return;
    try {
      await api.post('/appeals', { removalId: event.currentTarget.dataset.id, description: this.data.appealDescription });
      if (!current()) return;
      const refreshing = this.refresh();
      const refreshGeneration = this._refreshGeneration || 0;
      if (await refreshing && current(refreshGeneration))
        this.setData({ appealDescription: '', message: '申诉已提交，等待人工复核。' });
    } catch (error) { if (current()) this.setData({ message: error.message }); }
  },
  async appealReport(event) {
    const current = beginProfileAction(this, 'appealReport');
    if (!current) return;
    try {
      await api.post('/appeals', { reportId: event.currentTarget.dataset.id, description: this.data.reportAppealDescription });
      if (!current()) return;
      const refreshing = this.refresh();
      const refreshGeneration = this._refreshGeneration || 0;
      if (await refreshing && current(refreshGeneration))
        this.setData({ reportAppealDescription: '', message: '复核申请已提交，等待人工处理。' });
    } catch (error) { if (current()) this.setData({ message: error.message }); }
  },
  async appealContent(event) {
    const current = beginProfileAction(this, 'appealContent');
    if (!current) return;
    try {
      await api.post('/appeals', { contentId: event.currentTarget.dataset.id, description: this.data.contentAppealDescription });
      if (!current()) return;
      const refreshing = this.refresh();
      const refreshGeneration = this._refreshGeneration || 0;
      if (await refreshing && current(refreshGeneration))
        this.setData({ contentAppealDescription: '', message: '内容复核申请已提交，等待独立审核。' });
    } catch (error) { if (current()) this.setData({ message: error.message }); }
  },
  reportEventInput(event) { this.setData({ reportEventId: event.detail.value.trim() }); },
  async report() {
    const current = beginProfileAction(this, 'report');
    if (!current) return;
    try {
      await api.post('/reports', { kind: 'SAFETY', description: this.data.reportDescription, ...(this.data.reportEventId ? { eventId: this.data.reportEventId } : {}) });
      if (!current()) return;
      const refreshing = this.refresh();
      const refreshGeneration = this._refreshGeneration || 0;
      if (await refreshing && current(refreshGeneration))
        this.setData({ reportDescription: '', message: '举报工单已提交，等待人工处理。' });
    } catch (error) { if (current()) this.setData({ message: error.message }); }
  },
  async privacyRequest(event) {
    const current = beginProfileAction(this, 'privacyRequest');
    if (!current) return;
    try {
      const receipt = await api.post('/privacy/requests', { kind: event.currentTarget.dataset.kind });
      if (!current()) return;
      const refreshing = this.refresh();
      const refreshGeneration = this._refreshGeneration || 0;
      if (await refreshing && current(refreshGeneration))
        this.setData({ message: receipt.notice || '请求已提交，等待人工处理。' });
    } catch (error) { if (current()) this.setData({ message: error.message }); }
  },
  async exportData() {
    const isCurrent = beginProfileAction(this, 'exportData');
    if (!isCurrent) return;
    try {
      const ticket = await api.post('/privacy/exports', {});
      if (!isCurrent()) return;
      const snapshot = await api.get(ticket.path);
      if (!isCurrent()) return;
      const data = JSON.stringify(snapshot);
      if (data.length > 100000) return this.setData({ message: '数据量较大，请点击“申请导出”由人工提供文件。' });
      wx.setClipboardData({ data, success: () => { if (isCurrent()) this.setData({ message: '本人数据 JSON 已复制，可粘贴保存。' }); },
        fail: () => { if (isCurrent()) this.setData({ message: '复制失败，请点击“申请导出”。' }); } });
    } catch (error) { if (isCurrent()) this.setData({ message: error.message }); }
  },
  goMessages() { wx.switchTab({ url: '/pages/messages/messages' }); },
  goApprovalManagement() {
    if (!beginProfileAction(this, 'approvalShortcut')) return;
    wx.setStorageSync('irlMessagesFocusIntent', 'approvals');
    wx.switchTab({ url: '/pages/messages/messages' });
  },
  selectActivityFilter(event) {
    if (!beginProfileAction(this, 'activityFilter')) return;
    const filter = event?.currentTarget?.dataset?.filter;
    if (!Object.prototype.hasOwnProperty.call(activityEmptyLabels, filter)) return;
    this.setData({ activityFilter: filter, activityEmptyLabel: activityEmptyLabels[filter],
      activityPreview: filteredActivityItems(this.data.activityItems, filter).slice(0, 4) });
  },
  goAllActivities() { this.goMoments(); },
  showPrivacyRequests() { this.revealAdvanced('privacySection'); },
  goHostedActivities() { wx.navigateTo({ url: '/subpackages/profile/moments/moments?filter=hosted' }); },
  goHostCenter() {
    if (!beginProfileAction(this, 'hostCenterShortcut')) return;
    wx.setStorageSync('irlHomeTabIntent', 'organized');
    this.goHome();
  },
  inviteFriends() {
    if (!beginProfileAction(this, 'inviteShortcut')) return;
    const shareable = this.data.activityItems.filter(item => item.isHost && item.status === 'RECRUITING');
    if (shareable.length === 1)
      return wx.navigateTo({ url: '/subpackages/activity/share/share?id=' + encodeURIComponent(shareable[0].id) });
    if (shareable.length > 1) return this.goHostCenter();
    this.goCreate();
  },
  goAbout() { wx.navigateTo({ url: '/pages/about/about' }); },
  openScanEntry() {
    wx.showModal({
      title: '现场签到与核验',
      content: '请选择已确认报名或正在主办的活动，在活动详情“签到与反馈”中扫码签到或现场核验。',
      confirmText: '查看行程',
      success: result => {
        if (result.confirm) wx.navigateTo({ url: '/subpackages/activity/itinerary/itinerary' });
      }
    });
  },
  goEditProfile() { wx.navigateTo({ url: '/subpackages/profile/profile-edit/profile-edit' }); },
  goInterestInfo() { wx.navigateTo({ url: '/subpackages/profile/profile-edit/profile-edit?focus=interests' }); },
  goBadges() { wx.navigateTo({ url: '/subpackages/profile/badges/badges' }); },
  goMoments() { wx.navigateTo({ url: '/subpackages/profile/moments/moments' }); },
  goPrivacySafety() { wx.navigateTo({ url: '/subpackages/profile/privacy-safety/privacy-safety' }); },
  goLegal() { wx.navigateTo({ url: '/subpackages/profile/legal/legal' }); },
  goCache() { wx.navigateTo({ url: '/subpackages/profile/cache/cache' }); },
  goSupport() { wx.navigateTo({ url: '/subpackages/profile/support/support' }); },
  goGuidelines() { wx.navigateTo({ url: '/subpackages/profile/guidelines/guidelines' }); },
  goHome() { wx.switchTab({ url: '/pages/index/index' }); },
  openActivity(event) {
    if (!beginProfileAction(this, 'openActivity')) return;
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(id) });
  },
  goDiscover() { wx.switchTab({ url: '/pages/discover/discover' }); },
  goInviteEntry() {
    if (typeof wx.getStorageSync === 'function' && typeof wx.setStorageSync === 'function') {
      const identity = wx.getStorageSync('sessionToken')
        ? 'session:' + wx.getStorageSync('userId') + ':' + wx.getStorageSync('sessionToken')
        : 'dev:' + (wx.getStorageSync('devUser') || config.developmentUser || '');
      wx.setStorageSync('irlDiscoverFocusInvite', identity);
    }
    this.goDiscover();
  },
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); }
});
