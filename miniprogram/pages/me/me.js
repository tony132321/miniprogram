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
const defaultEventReminderNotice = '允许发送活动提醒；站内通知始终可查看，外部消息是否可用以实际服务配置为准。';
const defaultSimilarInvitesNotice = '允许旧活动主办方在结项后看到自己的活动内身份并将自己列入类似活动邀请候选；不会自动发送邀请。';
function emptySectionLoadErrors() {
  return { notifications: false, privacy: false, blocks: false, removals: false, reports: false,
    appeals: false, content: false, consents: false, similar: false, activities: false };
}
function readProfileIdentity() {
  return typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function'
    ? ['sessionToken', 'userId', 'devUser'].map(key => wx.getStorageSync(key)) : null;
}
function sameProfileIdentity(expected, current) {
  return !expected || !current || expected.every((value, index) => value === current[index]);
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
    consentLoadState: 'IDLE', similarInviteLoadState: 'IDLE', sectionLoadErrors: emptySectionLoadErrors(),
    loadState: 'IDLE', message: '', reportDescription: '', reportEventId: '' },
  onLoad() { this.setData({ statusBarHeight: wx.getSystemInfoSync?.().statusBarHeight || 24,
    headerPaddingRight: headerPaddingRight() }); },
  async onShow() {
    const bar = this.getTabBar && this.getTabBar(); if (bar) bar.setData({ selected: 4 });
    this.setData({ headerPaddingRight: headerPaddingRight() });
    if (this.data.developmentMode) this.setData({ devUser: wx.getStorageSync('devUser') || config.developmentUser });
    const app = getApp();
    await app.globalData.ready;
    const profileFocus = app.globalData.profileFocus === 'privacySection' ? 'privacySection' : '';
    app.globalData.profileFocus = undefined;
    const storedFocus = wx.getStorageSync('irlProfileFocusIntent');
    if (storedFocus) wx.removeStorageSync('irlProfileFocusIntent');
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
    if (reportContext) this.setData({ reportEventId: reportContext.actor === actor ? reportContext.eventId : '',
      advancedOpen: reportContext.actor === actor || this.data.advancedOpen });
    await this.refresh();
    if (this.data.loadState === 'UNAUTHENTICATED' || this.data.loadState === 'ACCESS_DENIED') return;
    if (reportContext?.actor === actor) this.revealAdvanced('reportSection');
    else if (requestedFocus) this.revealAdvanced(requestedFocus, requestedFocus !== 'notificationSettingsSection');
  },
  onHide() { this._pendingFocus = ''; },
  onUnload() { this._pendingFocus = ''; },
  clearForIdentitySwitch() {
    this.clearPrivateData(); this._privateActor = null;
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
    const generation = this._refreshGeneration = (this._refreshGeneration || 0) + 1;
    const identity = readProfileIdentity();
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
    this._refreshGeneration = (this._refreshGeneration || 0) + 1;
    this._loadedIdentity = null;
    this.setData({ notifications: [], notificationsTotal: 0, nextNotificationOffset: null,
      activityStats: { total: null, hosted: null, confirmed: null }, activityItems: [], activityFilter: 'all',
      activityEmptyLabel: activityEmptyLabels.all, activityPreview: [], hostedPreview: null,
      inviteReady: false, inviteCandidateCount: 0, activityLoadState: 'IDLE',
      notificationSnapshot: null, notificationLoadState: 'IDLE', privacy: [], blocks: [], removals: [], reports: [], appeals: [], rejectedContent: [],
      eventReminder: false, similarInvites: false, eventReminderNeedsReconfirmation: false,
      similarInvitesNeedsReconfirmation: false, eventReminderNotice: defaultEventReminderNotice,
      eventReminderNoticeVersion: '', similarInvitesNotice: defaultSimilarInvitesNotice,
      similarInvitesNoticeVersion: '', consentLoadState: 'IDLE', similarInviteLoadState: 'IDLE',
      sectionLoadErrors: emptySectionLoadErrors(), advancedOpen: false,
      reportDescription: '', appealDescription: '',
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
    try {
      await api.logout();
      this.clearPrivateData();
      this._privateActor = null;
      this.setData({ hasSession: false, message: '已退出登录' });
      wx.switchTab({ url: '/pages/index/index' });
    } catch (error) { this.setData({ message: '退出未完成：' + (error.message || '请重试') }); }
  },
  async toggleReminder(event) {
    const granted = event.detail.value;
    try {
      await api.post('/me/consents', { eventReminder: granted, noticeVersion: this.data.eventReminderNoticeVersion });
      this.setData({ eventReminder: granted, eventReminderNeedsReconfirmation: false,
        message: granted ? '已同意活动提醒' : '已关闭活动提醒' });
    } catch (error) {
      if (error.code === 'CONSENT_NOTICE_CHANGED') {
        if (await this.refresh()) this.setData({ message: '授权说明已更新，请重新阅读后确认。' });
        return;
      }
      this.setData({ eventReminder: !granted, message: error.message });
    }
  },
  async toggleSimilarInvites(event) {
    const granted = event.detail.value;
    try {
      await api.post('/me/similar-invites', { granted, noticeVersion: this.data.similarInvitesNoticeVersion });
      this.setData({ similarInvites: granted, similarInvitesNeedsReconfirmation: false,
        message: granted ? '已允许类似活动候选名单收录' : '已撤回类似活动候选名单同意' });
    } catch (error) {
      if (error.code === 'CONSENT_NOTICE_CHANGED') {
        if (await this.refresh()) this.setData({ message: '授权说明已更新，请重新阅读后确认。' });
        return;
      }
      this.setData({ similarInvites: !granted, message: error.message });
    }
  },
  async revokeBlock(event) {
    try {
      await api.post(`/me/blocks/${encodeURIComponent(event.currentTarget.dataset.id)}/revoke`, {});
      await this.refresh(); this.setData({ message: '已撤销屏蔽。' });
    } catch (error) { this.setData({ message: error.message }); }
  },
  async acceptOffer(event) {
    const id = event.currentTarget.dataset.id; const version = Number(event.currentTarget.dataset.version);
    try { await api.post(`/offers/${id}/accept`, { expectedVersion: version }); await this.refresh(); this.setData({ message: '已主动确认补位' }); }
    catch (error) { this.setData({ message: error.message }); }
  },
  async declineOffer(event) {
    const id = event.currentTarget.dataset.id; const version = Number(event.currentTarget.dataset.version);
    try { await api.post(`/offers/${id}/decline`, { expectedVersion: version }); await this.refresh(); this.setData({ message: '已拒绝补位，名额将按候补顺序处理。' }); }
    catch (error) { this.setData({ message: error.message }); }
  },
  async openNotice(event) {
    const id = event.currentTarget.dataset.id; const eventId = event.currentTarget.dataset.event;
    const kind = event.currentTarget.dataset.kind;
    const profileRecordSection = profileRecordSectionByNoticeKind[kind];
    try {
      if (eventId && !profileRecordSection) {
        await new Promise((resolve, reject) => wx.navigateTo({
          url: '/pages/event/event?id=' + encodeURIComponent(eventId), success: resolve, fail: reject
        }));
      }
      await api.post(`/me/notifications/${id}/open`, {});
      if (profileRecordSection) {
        await this.refresh();
        this.revealAdvanced(profileRecordSection);
        return this.setData({ message: profileRecordFocusMessages[profileRecordSection] });
      }
      if (!eventId) {
        await this.refresh();
        return this.setData({ message: '通知已打开。' });
      }
    } catch (error) { this.setData({ message: error.message || error.errMsg || '打开通知失败，请重试。' }); }
  },
  reportInput(event) { this.setData({ reportDescription: event.detail.value }); },
  appealInput(event) { this.setData({ appealDescription: event.detail.value }); },
  reportAppealInput(event) { this.setData({ reportAppealDescription: event.detail.value }); },
  contentAppealInput(event) { this.setData({ contentAppealDescription: event.detail.value }); },
  async appealRemoval(event) {
    try {
      await api.post('/appeals', { removalId: event.currentTarget.dataset.id, description: this.data.appealDescription });
      await this.refresh();
      this.setData({ appealDescription: '', message: '申诉已提交，等待人工复核。' });
    } catch (error) { this.setData({ message: error.message }); }
  },
  async appealReport(event) {
    try {
      await api.post('/appeals', { reportId: event.currentTarget.dataset.id, description: this.data.reportAppealDescription });
      await this.refresh();
      this.setData({ reportAppealDescription: '', message: '复核申请已提交，等待人工处理。' });
    } catch (error) { this.setData({ message: error.message }); }
  },
  async appealContent(event) {
    try {
      await api.post('/appeals', { contentId: event.currentTarget.dataset.id, description: this.data.contentAppealDescription });
      await this.refresh();
      this.setData({ contentAppealDescription: '', message: '内容复核申请已提交，等待独立审核。' });
    } catch (error) { this.setData({ message: error.message }); }
  },
  reportEventInput(event) { this.setData({ reportEventId: event.detail.value.trim() }); },
  async report() {
    try {
      await api.post('/reports', { kind: 'SAFETY', description: this.data.reportDescription, ...(this.data.reportEventId ? { eventId: this.data.reportEventId } : {}) });
      await this.refresh();
      this.setData({ reportDescription: '', message: '举报工单已提交，等待人工处理。' });
    } catch (error) { this.setData({ message: error.message }); }
  },
  async privacyRequest(event) {
    try {
      const receipt = await api.post('/privacy/requests', { kind: event.currentTarget.dataset.kind });
      if (await this.refresh()) this.setData({ message: receipt.notice || '请求已提交，等待人工处理。' });
    } catch (error) { this.setData({ message: error.message }); }
  },
  async exportData() {
    const generation = this._refreshGeneration || 0;
    const token = typeof wx.getStorageSync === 'function' ? wx.getStorageSync('sessionToken') : undefined;
    const isCurrent = () => generation === (this._refreshGeneration || 0) &&
      (token === undefined || wx.getStorageSync('sessionToken') === token);
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
    wx.setStorageSync('irlMessagesFocusIntent', 'approvals');
    wx.switchTab({ url: '/pages/messages/messages' });
  },
  selectActivityFilter(event) {
    const filter = event?.currentTarget?.dataset?.filter;
    if (!Object.prototype.hasOwnProperty.call(activityEmptyLabels, filter)) return;
    this.setData({ activityFilter: filter, activityEmptyLabel: activityEmptyLabels[filter],
      activityPreview: filteredActivityItems(this.data.activityItems, filter).slice(0, 4) });
  },
  goAllActivities() { this.goMoments(); },
  showPrivacyRequests() { this.revealAdvanced('privacySection'); },
  goHostedActivities() { wx.navigateTo({ url: '/subpackages/profile/moments/moments?filter=hosted' }); },
  goHostCenter() {
    wx.setStorageSync('irlHomeTabIntent', 'organized');
    this.goHome();
  },
  inviteFriends() {
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
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(id) });
  },
  goDiscover() { wx.switchTab({ url: '/pages/discover/discover' }); },
  goInviteEntry() {
    if (typeof wx.getStorageSync === 'function' && typeof wx.setStorageSync === 'function') {
      const identity = wx.getStorageSync('sessionToken')
        ? 'user:' + wx.getStorageSync('userId')
        : 'dev:' + (wx.getStorageSync('devUser') || config.developmentUser || '');
      wx.setStorageSync('irlDiscoverFocusInvite', identity);
    }
    this.goDiscover();
  },
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); }
});
