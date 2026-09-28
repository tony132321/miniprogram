const { api } = require('../../utils/api.js');
const config = require('../../config.js');
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
Page({
  data: { devUser: '', developmentMode: Boolean(config.developmentUser), hasSession: false, notifications: [], notificationsTotal: 0,
    nextNotificationOffset: null, notificationSnapshot: null, privacy: [], blocks: [], removals: [], reports: [], appeals: [], rejectedContent: [],
    appealDescription: '', reportAppealDescription: '', contentAppealDescription: '', eventReminder: false,
    similarInvites: false, eventReminderNeedsReconfirmation: false, similarInvitesNeedsReconfirmation: false,
    eventReminderNotice: '允许发送活动提醒；站内通知始终可查看，外部消息是否可用以实际服务配置为准。',
    eventReminderNoticeVersion: '',
    similarInvitesNotice: '允许旧活动主办方在结项后看到自己的活动内身份并将自己列入类似活动邀请候选；不会自动发送邀请。',
    similarInvitesNoticeVersion: '',
    loadState: 'IDLE', message: '', reportDescription: '', reportEventId: '' },
  async onShow() {
    if (this.data.developmentMode) this.setData({ devUser: wx.getStorageSync('devUser') || config.developmentUser });
    const app = getApp();
    await app.globalData.ready;
    const hasSession = Boolean(wx.getStorageSync('sessionToken'));
    this.setData({ hasSession });
    if (!hasSession && !this.data.developmentMode) {
      app.globalData.reportContext = undefined;
      this.clearPrivateData();
      this._privateActor = null;
      return this.setData({ loadState: 'UNAUTHENTICATED', message: '请先微信登录' });
    }
    const actor = hasSession ? wx.getStorageSync('userId') : this.data.devUser;
    const privateActor = `${hasSession ? 'session' : 'dev'}:${actor}`;
    if (this._privateActor !== privateActor) this.clearPrivateData();
    this._privateActor = privateActor;
    const reportContext = app.globalData.reportContext;
    app.globalData.reportContext = undefined;
    if (reportContext) this.setData({ reportEventId: reportContext.actor === actor ? reportContext.eventId : '' });
    await this.refresh();
  },
  async refresh() {
    const generation = this._refreshGeneration = (this._refreshGeneration || 0) + 1;
    this.setData({ nextNotificationOffset: null, loadState: 'LOADING' });
    try {
      const [notifications, privacy, blocks, removals, reports, appeals, rejectedContent, consents, similar] = await Promise.all([api.get('/me/notifications?offset=0'), api.get('/privacy/requests'), api.get('/me/blocks'),
        api.get('/me/removals'), api.get('/me/reports'), api.get('/me/appeals'), api.get('/me/content'), api.get('/me/consents'), api.get('/me/similar-invites')]);
      if (generation !== this._refreshGeneration) return false;
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
        loadState: 'READY', message: '' });
      return true;
    } catch (error) { if (generation === this._refreshGeneration) this.setData({ loadState: 'ERROR', message: error.message }); return false; }
  },
  retryRefresh() {
    if (!this.data.hasSession && !this.data.developmentMode) return;
    return this.refresh();
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
      notificationSnapshot: null, privacy: [], blocks: [], removals: [], reports: [], appeals: [], rejectedContent: [],
      eventReminder: false, similarInvites: false, eventReminderNeedsReconfirmation: false,
      similarInvitesNeedsReconfirmation: false, reportDescription: '', appealDescription: '',
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
    try {
      wx.removeStorageSync('devUser');
      const session = await api.login();
      if (generation !== (this._refreshGeneration || 0)) return;
      this.clearPrivateData();
      this._privateActor = `session:${session.userId}`;
      this.setData({ hasSession: true, message: '已登录：' + session.userId });
      await this.refresh();
    } catch (error) { if (generation === (this._refreshGeneration || 0)) this.setData({ message: error.message }); }
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
        return this.setData({ message: '请在下方“报名移除与申诉”查看原因。' });
      }
      if (kind === 'REPORT_IN_REVIEW' || kind === 'REPORT_RESOLVED') {
        await this.refresh();
        return this.setData({ message: '请在下方“举报与求助”查看处理进度与结论。' });
      }
      if (kind === 'APPEAL_IN_REVIEW' || kind === 'APPEAL_RESOLVED') {
        await this.refresh();
        return this.setData({ message: '请在下方“报名移除与申诉”查看复核进度与结论。' });
      }
      if (kind === 'CONTENT_REJECTED') {
        await this.refresh();
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
  goAbout() { wx.navigateTo({ url: '/pages/about/about' }); },
  goDiscover() { wx.switchTab({ url: '/pages/discover/discover' }); },
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); }
});
