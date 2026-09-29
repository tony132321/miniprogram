const { api } = require('../../utils/api.js');
const config = require('../../config.js');
const activityStatusLabels = {
  DRAFT: '草稿', REVIEW_PENDING: '待审核', RECRUITING: '招募中', CONFIRMED: '已成局',
  IN_PROGRESS: '进行中', COMPLETED: '已结束', CANCELLED: '已取消', EXPIRED: '未成局'
};
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
function withExternalStatusLabels(items) {
  return items.map(item => ({ ...item, externalStatusLabel:
    Object.prototype.hasOwnProperty.call(externalStatusLabels, item.external_status)
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
    nextNotificationOffset: null, notificationSnapshot: null, privacy: [], blocks: [], removals: [], reports: [], appeals: [], rejectedContent: [],
    appealDescription: '', reportAppealDescription: '', contentAppealDescription: '', eventReminder: false,
    similarInvites: false, eventReminderNeedsReconfirmation: false, similarInvitesNeedsReconfirmation: false,
    eventReminderNotice: '允许发送活动提醒；站内通知始终可查看，外部消息是否可用以实际服务配置为准。',
    eventReminderNoticeVersion: '',
    similarInvitesNotice: '允许旧活动主办方在结项后看到自己的活动内身份并将自己列入类似活动邀请候选；不会自动发送邀请。',
    similarInvitesNoticeVersion: '',
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
    const requestedFocus = profileFocus || (storedFocus === 'noticeSection' ? 'noticeSection' : '');
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
    const actor = hasSession ? wx.getStorageSync('userId') : this.data.devUser;
    const privateActor = `${hasSession ? 'session' : 'dev'}:${actor}`;
    if (this._privateActor !== privateActor) this.clearPrivateData();
    this._privateActor = privateActor;
    const reportContext = app.globalData.reportContext;
    app.globalData.reportContext = undefined;
    if (reportContext) this.setData({ reportEventId: reportContext.actor === actor ? reportContext.eventId : '',
      advancedOpen: reportContext.actor === actor || this.data.advancedOpen });
    await this.refresh();
    if (reportContext?.actor === actor) this.revealAdvanced('reportSection');
    else if (requestedFocus) this.revealAdvanced(requestedFocus);
  },
  onHide() { this._pendingFocus = ''; },
  onUnload() { this._pendingFocus = ''; },
  async refresh() {
    const generation = this._refreshGeneration = (this._refreshGeneration || 0) + 1;
    this.setData({ nextNotificationOffset: null, loadState: 'LOADING' });
    try {
      const [notifications, privacy, blocks, removals, reports, appeals, rejectedContent, consents, similar, activityResult] = await Promise.all([api.get('/me/notifications?offset=0'), api.get('/privacy/requests'), api.get('/me/blocks'),
        api.get('/me/removals'), api.get('/me/reports'), api.get('/me/appeals'), api.get('/me/content'), api.get('/me/consents'), api.get('/me/similar-invites'),
        api.get('/me/events').catch(() => null)]);
      if (generation !== this._refreshGeneration) return false;
      const activityItems = Array.isArray(activityResult?.items) ? activityResult.items : null;
      const mappedActivityItems = activityItems ? activityItems.map(item => ({
        ...item, statusLabel: activityStatusLabels[item.status] || item.status || '状态待核对',
        dateLabel: activityDateLabel(item.startAt), cover: activityCover(item)
      })) : [];
      const activityFilter = this.data.activityFilter;
      this.setData({ notifications: withExternalStatusLabels(notifications.items), notificationsTotal: notifications.total ?? notifications.items.length,
        nextNotificationOffset: notifications.nextOffset ?? null, notificationSnapshot: notifications.snapshot ?? null,
        privacy: privacy.items, blocks: blocks.items, removals: removals.items, reports: reports.items,
        appeals: appeals.items, rejectedContent: rejectedContent.items,
        eventReminder: consents.eventReminder, similarInvites: similar.granted,
        eventReminderNeedsReconfirmation: Boolean(consents.reconfirmationRequired),
        similarInvitesNeedsReconfirmation: Boolean(similar.reconfirmationRequired),
        eventReminderNotice: consents.eventReminderNotice?.text || this.data.eventReminderNotice,
        eventReminderNoticeVersion: consents.eventReminderNotice?.version || '',
        similarInvitesNotice: similar.notice?.text || this.data.similarInvitesNotice,
        similarInvitesNoticeVersion: similar.notice?.version || '',
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
        loadState: 'READY', message: '' });
      return true;
    } catch (error) { if (generation === this._refreshGeneration) this.setData({ loadState: 'ERROR', message: error.message }); return false; }
  },
  retryRefresh() {
    if (!this.data.hasSession && !this.data.developmentMode) return;
    return this.refresh();
  },
  toggleAdvanced() {
    if (!this.data.hasSession && !this.data.developmentMode) return;
    this.setData({ advancedOpen: !this.data.advancedOpen });
  },
  revealAdvanced(sectionId) {
    this.setData({ advancedOpen: true });
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
    const snapshot = this.data.notificationSnapshot;
    this.setData({ nextNotificationOffset: null });
    try {
      const page = await api.get(`/me/notifications?offset=${offset}&snapshot=${encodeURIComponent(snapshot)}`);
      if (generation !== this._refreshGeneration) return;
      this.setData({ notifications: this.data.notifications.concat(withExternalStatusLabels(page.items)), notificationsTotal: page.total,
        nextNotificationOffset: page.nextOffset ?? null, notificationSnapshot: page.snapshot });
    } catch (error) {
      if (generation !== this._refreshGeneration) return;
      if (error.code === 'QUEUE_CHANGED') {
        if (await this.refresh()) this.setData({ message: '通知列表已变化，已从最新通知重新加载。' });
      } else this.setData({ nextNotificationOffset: offset, message: error.message });
    }
  },
  clearPrivateData() {
    this._refreshGeneration = (this._refreshGeneration || 0) + 1;
    this.setData({ notifications: [], notificationsTotal: 0, nextNotificationOffset: null,
      activityStats: { total: null, hosted: null, confirmed: null }, activityItems: [], activityFilter: 'all',
      activityEmptyLabel: activityEmptyLabels.all, activityPreview: [], hostedPreview: null,
      inviteReady: false, inviteCandidateCount: 0, activityLoadState: 'IDLE',
      notificationSnapshot: null, privacy: [], blocks: [], removals: [], reports: [], appeals: [], rejectedContent: [],
      eventReminder: false, similarInvites: false, eventReminderNeedsReconfirmation: false,
      similarInvitesNeedsReconfirmation: false, advancedOpen: false,
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
      this.setData({ hasSession: true, message: '已登录：' + session.userId });
      await this.refresh();
      this._pendingFocus = '';
      if (requestedFocus) this.revealAdvanced(requestedFocus);
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
    const detailOnProfile = ['REGISTRATION_REMOVED', 'REPORT_IN_REVIEW', 'REPORT_RESOLVED',
      'APPEAL_IN_REVIEW', 'APPEAL_RESOLVED', 'CONTENT_REJECTED'].includes(kind);
    try {
      if (eventId && !detailOnProfile) {
        await new Promise((resolve, reject) => wx.navigateTo({
          url: '/pages/event/event?id=' + encodeURIComponent(eventId), success: resolve, fail: reject
        }));
      }
      await api.post(`/me/notifications/${id}/open`, {});
      if (kind === 'REGISTRATION_REMOVED') {
        await this.refresh();
        this.revealAdvanced('appealSection');
        return this.setData({ message: '请在下方“报名移除与申诉”查看原因。' });
      }
      if (kind === 'REPORT_IN_REVIEW' || kind === 'REPORT_RESOLVED') {
        await this.refresh();
        this.revealAdvanced('reportSection');
        return this.setData({ message: '请在下方“举报与求助”查看处理进度与结论。' });
      }
      if (kind === 'APPEAL_IN_REVIEW' || kind === 'APPEAL_RESOLVED') {
        await this.refresh();
        this.revealAdvanced('appealSection');
        return this.setData({ message: '请在下方“报名移除与申诉”查看复核进度与结论。' });
      }
      if (kind === 'CONTENT_REJECTED') {
        await this.refresh();
        this.revealAdvanced('contentSection');
        return this.setData({ message: '请在下方“内容审核与复核”查看原因并申请复核。' });
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
  goEditProfile() { wx.navigateTo({ url: '/subpackages/profile/profile-edit/profile-edit' }); },
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
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); }
});
