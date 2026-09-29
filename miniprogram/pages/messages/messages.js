const { api } = require('../../utils/api.js');
const config = require('../../config.js');

const noticeTitles = {
  WAITLIST_OFFER: '收到补位邀请', WAITLIST_WINDOW_CLOSED: '补位时间窗口已结束',
  REGISTRATION_STATUS: '报名状态已更新', REGISTRATION_APPROVED: '报名已通过',
  MANUAL_CHECKIN_REQUEST: '请核对到场补记', MATERIAL_CHANGE: '活动规则已更新',
  EVENT_CONFIRMED: '活动已成局', EVENT_CANCELLED: '活动已取消', EVENT_EXPIRED: '活动未成局',
  EVENT_SAFETY_PAUSED: '活动暂时停止招募', EVENT_SAFETY_RESUMED: '活动恢复招募',
  EVENT_REMINDER: '活动提醒', EVENT_OUTCOME_DUE: '请记录活动结项',
  EVENT_OUTCOME_REVIEW: '请反馈活动结项', PUBLIC_RECRUITMENT_CLOSED: '活动招募暂停',
  PUBLIC_RECRUITMENT_OPEN: '活动招募恢复', REGISTRATION_REMOVED: '报名已移除',
  REPORT_IN_REVIEW: '举报正在处理', REPORT_RESOLVED: '举报已有处理结论',
  APPEAL_IN_REVIEW: '申诉正在复核', APPEAL_RESOLVED: '申诉已有复核结论',
  CONTENT_REJECTED: '活动内容未通过审核'
};
const interactionKinds = new Set(['WAITLIST_OFFER', 'REGISTRATION_STATUS', 'REGISTRATION_APPROVED',
  'REGISTRATION_REMOVED', 'MANUAL_CHECKIN_REQUEST', 'CONTENT_REJECTED', 'REPORT_IN_REVIEW',
  'REPORT_RESOLVED', 'APPEAL_IN_REVIEW', 'APPEAL_RESOLVED']);
function visible(item, filter, searchQuery = '') {
  const matchesFilter = filter === 'ALL' || (filter === 'ACTIVITY' && Boolean(item.event_id) && !interactionKinds.has(item.kind)) ||
    (filter === 'INTERACTION' && interactionKinds.has(item.kind)) ||
    (filter === 'SYSTEM' && !item.event_id);
  if (!matchesFilter || !searchQuery) return matchesFilter;
  return `${item.title || noticeTitles[item.kind] || '站内通知'} ${item.event_id || ''} ${item.kind || ''}`
    .toLowerCase().includes(searchQuery.toLowerCase());
}
function present(items, filter, searchQuery = '') {
  return items.map(item => ({ ...item, visible: visible(item, filter, searchQuery), title: noticeTitles[item.kind] || '站内通知',
    externalHint: item.external_status === 'PROVIDER_ACCEPTED'
      ? '外部提醒已受理，未确认送达' : item.external_status === 'UNKNOWN_REQUIRES_RECONCILIATION'
        ? '外部提醒结果待核对' : '请以站内通知为准' }));
}
function countVisible(items) { return items.filter(item => item.visible).length; }
Page({
  data: { statusBarHeight: 24, items: [], filteredCount: 0, total: 0, unreadTotal: 0, nextOffset: null, snapshot: null,
    loadState: 'IDLE', loadingMore: false, markingAllRead: false, message: '',
    approvals: [], approvalTotal: 0, approvalNextOffset: null, approvalSnapshot: null, approvalLoadState: 'IDLE',
    approvingId: '', loadingMoreApprovals: false,
    filter: 'ALL', searchOpen: false, searchQuery: '', hasSession: false, developmentMode: Boolean(config.developmentUser) },
  onLoad() { this.setData({ statusBarHeight: wx.getSystemInfoSync?.().statusBarHeight || 24 }); },
  async onShow() {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.setData({ selected: 3 });
    await getApp().globalData.ready;
    const hasSession = Boolean(wx.getStorageSync('sessionToken'));
    const actor = hasSession ? wx.getStorageSync('userId') : this.data.developmentMode ? (wx.getStorageSync('devUser') || config.developmentUser) : '';
    if (this._actor !== actor) {
      this._generation = (this._generation || 0) + 1;
      this.setData({ items: [], filteredCount: 0, total: 0, unreadTotal: 0, nextOffset: null, snapshot: null,
        loadingMore: false, markingAllRead: false, approvals: [], approvalTotal: 0,
        approvalNextOffset: null, approvalSnapshot: null, approvalLoadState: 'IDLE',
        approvingId: '', loadingMoreApprovals: false, searchOpen: false, searchQuery: '' });
    }
    this._actor = actor;
    this.setData({ hasSession });
    if (!actor) return this.setData({ loadState: 'UNAUTHENTICATED', message: '请先微信登录后查看本人消息。' });
    return this.refresh();
  },
  async refresh() {
    const generation = this._generation = (this._generation || 0) + 1;
    this.setData({ loadState: 'LOADING', loadingMore: false, message: '', nextOffset: null });
    try {
      const page = await api.get('/me/notifications?offset=0');
      if (generation !== this._generation) return;
      const items = present(page.items || [], this.data.filter, this.data.searchQuery);
      this.setData({ items, filteredCount: countVisible(items), total: page.total ?? (page.items || []).length,
        unreadTotal: page.unreadTotal ?? (page.items || []).filter(item => item.status !== 'OPENED').length,
        nextOffset: page.nextOffset ?? null, snapshot: page.snapshot ?? null, loadState: 'READY' });
      if (this.data.filter === 'INTERACTION') await this.loadApprovals();
    } catch (error) {
      if (generation === this._generation) this.setData({ loadState: 'ERROR', message: error.message || '消息加载失败' });
    }
  },
  setFilter(event) {
    if (this.data.loadState !== 'READY') return;
    const filter = event.currentTarget.dataset.filter;
    if (!['ALL', 'ACTIVITY', 'INTERACTION', 'SYSTEM'].includes(filter)) return;
    const items = this.data.items.map(item => ({ ...item, visible: visible(item, filter, this.data.searchQuery) }));
    this.setData({ filter, items, filteredCount: countVisible(items) });
    if (filter === 'INTERACTION' && this.data.approvalLoadState === 'IDLE') return this.loadApprovals();
  },
  toggleSearch() {
    const searchOpen = !this.data.searchOpen;
    const searchQuery = searchOpen ? this.data.searchQuery : '';
    const items = this.data.items.map(item => ({ ...item, visible: visible(item, this.data.filter, searchQuery) }));
    this.setData({ searchOpen, searchQuery, items, filteredCount: countVisible(items) });
  },
  searchInput(event) {
    const searchQuery = (event.detail.value || '').trim();
    const items = this.data.items.map(item => ({ ...item, visible: visible(item, this.data.filter, searchQuery) }));
    this.setData({ searchQuery, items, filteredCount: countVisible(items) });
  },
  async loadMore() {
    const offset = this.data.nextOffset;
    if (this.data.loadingMore || offset === null || offset === undefined) return;
    const generation = this._generation;
    this.setData({ loadingMore: true });
    try {
      const page = await api.get(`/me/notifications?offset=${offset}&snapshot=${encodeURIComponent(this.data.snapshot)}`);
      if (generation !== this._generation) return;
      const items = this.data.items.concat(present(page.items || [], this.data.filter, this.data.searchQuery));
      this.setData({ items, filteredCount: countVisible(items), total: page.total,
        unreadTotal: page.unreadTotal ?? this.data.unreadTotal, loadingMore: false,
        nextOffset: page.nextOffset ?? null, snapshot: page.snapshot });
    } catch (error) {
      if (generation !== this._generation) return;
      if (error.code === 'QUEUE_CHANGED') {
        await this.refresh();
        return this.setData({ message: '消息列表已变化，已重新加载。' });
      }
      this.setData({ loadingMore: false, message: error.message || '加载更多失败' });
    }
  },
  async markAllRead() {
    if (this.data.markingAllRead || this.data.loadState !== 'READY' || !this.data.unreadTotal) return;
    const generation = this._generation;
    const actor = this._actor;
    this.setData({ markingAllRead: true, message: '' });
    try {
      await api.post('/me/notifications/open-all', {});
      if (generation !== this._generation) return;
      await this.refresh();
      if (actor === this._actor && this.data.loadState === 'READY') this.setData({ message: '已将全部站内通知标为已读。' });
    } catch (error) {
      if (actor === this._actor) this.setData({ message: error.message || '标记失败，请重试' });
    } finally {
      if (actor === this._actor) this.setData({ markingAllRead: false });
    }
  },
  async loadApprovals() {
    const generation = this._generation;
    const approvalLoadId = this._approvalLoadId = (this._approvalLoadId || 0) + 1;
    this.setData({ approvalLoadState: 'LOADING', approvalNextOffset: null,
      approvalSnapshot: null, approvals: [], approvalTotal: 0, loadingMoreApprovals: false });
    try {
      const page = await api.get('/me/approval-requests?offset=0');
      if (generation !== this._generation || approvalLoadId !== this._approvalLoadId) return;
      this.setData({ approvals: page.items || [], approvalTotal: page.total || 0,
        approvalNextOffset: page.nextOffset ?? null, approvalSnapshot: page.snapshot ?? null,
        approvalLoadState: 'READY' });
    } catch (error) {
      if (generation === this._generation && approvalLoadId === this._approvalLoadId) this.setData({ approvalLoadState: 'ERROR',
        message: error.message || '待审核报名加载失败' });
    }
  },
  async loadMoreApprovals() {
    const offset = this.data.approvalNextOffset;
    if (this.data.loadingMoreApprovals || offset === null || offset === undefined) return;
    const generation = this._generation;
    const approvalLoadId = this._approvalLoadId;
    this.setData({ loadingMoreApprovals: true });
    try {
      const page = await api.get(`/me/approval-requests?offset=${offset}&snapshot=${encodeURIComponent(this.data.approvalSnapshot)}`);
      if (generation !== this._generation || approvalLoadId !== this._approvalLoadId) return;
      this.setData({ approvals: this.data.approvals.concat(page.items || []), approvalTotal: page.total,
        approvalNextOffset: page.nextOffset ?? null, approvalSnapshot: page.snapshot ?? null,
        loadingMoreApprovals: false });
    } catch (error) {
      if (generation !== this._generation || approvalLoadId !== this._approvalLoadId) return;
      if (error.code === 'QUEUE_CHANGED') {
        await this.loadApprovals();
        return this.setData({ message: '审核列表已变化，已重新加载。', loadingMoreApprovals: false });
      }
      this.setData({ loadingMoreApprovals: false, message: error.message || '加载更多审核失败' });
    }
  },
  async approveRequest(event) {
    const { id, version } = event.currentTarget.dataset;
    if (!id || this.data.approvingId || !this.data.approvals.some(item => item.registrationId === id && item.canApprove)) return;
    const generation = this._generation;
    this.setData({ approvingId: id, message: '' });
    try {
      await api.post(`/registrations/${encodeURIComponent(id)}/approve`, { expectedVersion: Number(version) });
      if (generation !== this._generation) return;
      await this.loadApprovals();
      if (generation === this._generation) this.setData({ message: '报名已通过，名额以服务端结果为准。' });
    } catch (error) {
      if (generation === this._generation) {
        await this.loadApprovals();
        this.setData({ message: error.message || '审核失败，请重试' });
      }
    } finally {
      if (generation === this._generation) this.setData({ approvingId: '' });
    }
  },
  viewApproval(event) {
    const { eventId, isHost } = event.currentTarget.dataset;
    if (eventId) wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(eventId) +
      '&section=' + (isHost ? 'hostSection' : 'cohostApprovalSection') });
  },
  async openNotice(event) {
    const { id, eventId, kind, section } = event.currentTarget.dataset;
    const profileKinds = ['REGISTRATION_REMOVED', 'REPORT_IN_REVIEW', 'REPORT_RESOLVED',
      'APPEAL_IN_REVIEW', 'APPEAL_RESOLVED', 'CONTENT_REJECTED', 'WAITLIST_OFFER'];
    const generation = this._generation;
    try {
      if (eventId && !profileKinds.includes(kind)) {
        await new Promise((resolve, reject) => wx.navigateTo({
          url: '/pages/event/event?id=' + encodeURIComponent(eventId) +
            (['checkinSection', 'expenseSection', 'detailsSection'].includes(section) ? '&section=' + section : ''),
          success: resolve, fail: reject
        }));
      }
      await api.post(`/me/notifications/${encodeURIComponent(id)}/open`, {});
      if (generation !== this._generation) return;
      if (profileKinds.includes(kind)) return wx.switchTab({ url: '/pages/me/me' });
      if (!eventId) {
        await this.refresh();
        this.setData({ message: '通知已打开。' });
      }
    } catch (error) { if (generation === this._generation) this.setData({ message: error.message || '打开通知失败' }); }
  },
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); },
  goNotificationSettings() { wx.switchTab({ url: '/pages/me/me' }); },
  goDiscover() { wx.switchTab({ url: '/pages/discover/discover' }); }
});
