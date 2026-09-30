const { api } = require('../../utils/api.js');
const config = require('../../config.js');

const noticeTitles = {
  WAITLIST_OFFER: '收到补位邀请', WAITLIST_WINDOW_CLOSED: '补位时间窗口已结束',
  REGISTRATION_STATUS: '报名状态已更新', REGISTRATION_APPROVED: '报名已通过',
  MANUAL_CHECKIN_REQUEST: '请核对到场补记', MATERIAL_CHANGE: '活动规则已更新',
  EVENT_CONFIRMED: '活动已成局', EVENT_CANCELLED: '活动已取消', EVENT_EXPIRED: '活动未成局',
  EVENT_SAFETY_PAUSED: '活动暂时停止招募', EVENT_SAFETY_RESUMED: '活动恢复招募',
  EVENT_REMINDER: '活动即将开始', EVENT_OUTCOME_DUE: '请记录活动结项',
  EVENT_OUTCOME_REVIEW: '请反馈活动结项', PUBLIC_RECRUITMENT_CLOSED: '活动招募暂停',
  PUBLIC_RECRUITMENT_OPEN: '活动招募恢复', REGISTRATION_REMOVED: '报名已移除',
  REPORT_IN_REVIEW: '举报正在处理', REPORT_RESOLVED: '举报已有处理结论',
  APPEAL_IN_REVIEW: '申诉正在复核', APPEAL_RESOLVED: '申诉已有复核结论',
  CONTENT_REJECTED: '活动内容未通过审核',
  EVENT_REVIEW_APPROVED: '活动内容审核通过', EVENT_REVIEW_REJECTED: '活动内容审核未通过',
  REPORT_CREATED_UNSCOPED: '举报已提交', REPORT_IN_REVIEW_UNSCOPED: '举报正在处理',
  REPORT_RESOLVED_UNSCOPED: '举报已有处理结论', APPEAL_CREATED: '申诉已提交',
  CONTENT_REVIEW_OVERTURN: '活动内容复核已有结论'
};
const noticeSummaries = {
  WAITLIST_OFFER: '收到补位机会，请在有效期内查看并处理。',
  WAITLIST_WINDOW_CLOSED: '补位期限已结束，请查看活动最新状态。',
  REGISTRATION_STATUS: '报名状态有变化，请查看活动详情。',
  REGISTRATION_APPROVED: '报名已通过，请核对活动安排。',
  MANUAL_CHECKIN_REQUEST: '收到到场补记请求，请核对签到记录。',
  MATERIAL_CHANGE: '时间、地点或规则有更新，请重新核对。',
  EVENT_CONFIRMED: '活动已达到成局条件，请查看后续安排。',
  EVENT_CANCELLED: '活动已取消，请查看详情和后续处理。',
  EVENT_EXPIRED: '活动未能成局，请查看最终状态。',
  EVENT_SAFETY_PAUSED: '因安全处理，活动暂时停止招募。',
  EVENT_SAFETY_RESUMED: '安全处理结束，活动已恢复招募。',
  EVENT_REMINDER: '活动即将开始，请核对时间地点与入场信息。',
  EVENT_OUTCOME_DUE: '活动结束后，请按流程记录结项。',
  EVENT_OUTCOME_REVIEW: '活动结项待反馈，请查看相关记录。',
  PUBLIC_RECRUITMENT_CLOSED: '活动当前暂停招募，请以详情页为准。',
  PUBLIC_RECRUITMENT_OPEN: '活动已恢复招募，请以详情页为准。',
  REGISTRATION_REMOVED: '报名已被移除，请查看处理记录。',
  REPORT_IN_REVIEW: '举报正在处理，请查看个人中心记录。',
  REPORT_RESOLVED: '举报处理已有结论，请查看个人中心记录。',
  APPEAL_IN_REVIEW: '申诉正在复核，请查看个人中心记录。',
  APPEAL_RESOLVED: '申诉复核已有结论，请查看个人中心记录。',
  CONTENT_REJECTED: '活动内容未通过审核，请查看原因。',
  EVENT_REVIEW_APPROVED: '活动内容已通过审核，请核对详情。',
  EVENT_REVIEW_REJECTED: '活动内容未通过审核，请核对详情。',
  REPORT_CREATED_UNSCOPED: '举报已收妥，请查看处理进度。',
  REPORT_IN_REVIEW_UNSCOPED: '举报正在处理，请查看最新状态。',
  REPORT_RESOLVED_UNSCOPED: '举报处理已有结论，请查看记录。',
  APPEAL_CREATED: '申诉已收妥，请查看处理进度。',
  CONTENT_REVIEW_OVERTURN: '活动内容复核已有结论，请查看记录。'
};
const externalHints = {
  DISPATCHING: '外部提醒请求处理中',
  PROVIDER_ACCEPTED: '外部提醒已受理，未确认送达',
  UNKNOWN_REQUIRES_RECONCILIATION: '外部提醒结果待核对',
  UNAVAILABLE: '外部提醒不可用，请以站内通知为准',
  PURPOSE_NOT_CONFIGURED: '未开通外部提醒，请以站内通知为准',
  CONSENT_WITHDRAWN: '外部提醒未授权',
  CONSENT_RECONFIRM_REQUIRED: '外部提醒需重新授权',
  PROVIDER_REJECTED: '外部提醒发送失败，请以站内通知为准',
  FAILED: '外部提醒发送失败，请以站内通知为准',
  STALE_VERSION: '旧版本提醒已取消',
  STALE_STATE: '过期外部提醒未发送',
  ACCOUNT_DISABLED: '账号停用，外部提醒未发送',
  DELETE_REQUEST_PENDING: '删除申请处理中，外部提醒未发送'
};
const profileFocusByKind = {
  WAITLIST_OFFER: 'noticeSection', REGISTRATION_REMOVED: 'appealSection',
  REPORT_IN_REVIEW: 'reportSection', REPORT_RESOLVED: 'reportSection',
  REPORT_CREATED_UNSCOPED: 'reportSection', REPORT_IN_REVIEW_UNSCOPED: 'reportSection',
  REPORT_RESOLVED_UNSCOPED: 'reportSection', APPEAL_CREATED: 'appealSection',
  APPEAL_IN_REVIEW: 'appealSection', APPEAL_RESOLVED: 'appealSection',
  CONTENT_REJECTED: 'contentSection', CONTENT_REVIEW_OVERTURN: 'contentSection'
};
const interactionKinds = new Set(['WAITLIST_OFFER', 'REGISTRATION_STATUS', 'REGISTRATION_APPROVED',
  'REGISTRATION_REMOVED', 'MANUAL_CHECKIN_REQUEST', 'CONTENT_REJECTED', 'REPORT_IN_REVIEW',
  'REPORT_RESOLVED', 'APPEAL_IN_REVIEW', 'APPEAL_RESOLVED', 'REPORT_CREATED_UNSCOPED',
  'REPORT_IN_REVIEW_UNSCOPED', 'REPORT_RESOLVED_UNSCOPED', 'APPEAL_CREATED', 'CONTENT_REVIEW_OVERTURN']);
const groupSpecs = [
  { key: 'INTERACTION', title: '互动与审核', icon: '✦', badge: '互', tone: 'violet' },
  { key: 'ACTIVITY', title: '活动动态', icon: '🔥', badge: '活', tone: 'blue' },
  { key: 'SYSTEM', title: '系统通知', icon: '📢', badge: '系', tone: 'amber' }
];
function groupFor(item) {
  if (interactionKinds.has(item.kind)) return 'INTERACTION';
  return item.event_id ? 'ACTIVITY' : 'SYSTEM';
}
function timeLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const two = number => String(number).padStart(2, '0');
  return `${date.getMonth() + 1}月${date.getDate()}日 ${two(date.getHours())}:${two(date.getMinutes())}`;
}
function visible(item, filter, searchQuery = '') {
  const matchesFilter = filter === 'ALL' || filter === groupFor(item);
  if (!matchesFilter || !searchQuery) return matchesFilter;
  return `${item.title || noticeTitles[item.kind] || '站内通知'} ${item.summary || ''} ${item.event_id || ''} ${item.kind || ''}`
    .toLowerCase().includes(searchQuery.toLowerCase());
}
function present(items) {
  return items.map(item => {
    const isCheckin = ['EVENT_REMINDER', 'MANUAL_CHECKIN_REQUEST'].includes(item.kind);
    const isProfileRecord = ['WAITLIST_OFFER', 'REGISTRATION_REMOVED', 'REPORT_IN_REVIEW',
      'REPORT_RESOLVED', 'REPORT_CREATED_UNSCOPED', 'REPORT_IN_REVIEW_UNSCOPED',
      'REPORT_RESOLVED_UNSCOPED', 'APPEAL_CREATED', 'APPEAL_IN_REVIEW',
      'APPEAL_RESOLVED', 'CONTENT_REJECTED', 'CONTENT_REVIEW_OVERTURN'].includes(item.kind);
    const group = groupFor(item);
    const caution = ['EVENT_CANCELLED', 'EVENT_EXPIRED', 'EVENT_SAFETY_PAUSED',
      'EVENT_REVIEW_REJECTED', 'CONTENT_REJECTED'].includes(item.kind);
    const cardVariant = item.kind === 'EVENT_REMINDER' ? 'reminder' :
      item.kind === 'MATERIAL_CHANGE' ? 'update' :
        item.kind === 'EVENT_CONFIRMED' ? 'milestone' : 'standard';
    return { ...item, title: noticeTitles[item.kind] || '站内通知',
      summary: noticeSummaries[item.kind] || (item.event_id ? '活动有新进展，请查看详情。' : '站内通知有更新，请查看详情。'),
      timeLabel: timeLabel(item.created_at),
      externalHint: externalHints[item.external_status] || '',
      actionLabel: item.kind === 'EVENT_REMINDER' ? '查看现场签到' :
        item.kind === 'MANUAL_CHECKIN_REQUEST' ? '核对到场补记' :
          item.kind === 'MATERIAL_CHANGE' ? '查看最新安排' :
        item.kind === 'EVENT_CONFIRMED' ? '查看活动安排' : item.kind === 'EVENT_OUTCOME_DUE' ? '记录活动结项' :
          item.kind === 'EVENT_OUTCOME_REVIEW' ? '反馈活动结项' :
          isProfileRecord ? '查看处理记录' : item.event_id ? '查看活动详情' : '标为已读',
      actionSection: isCheckin ? 'checkinSection' :
        item.kind === 'MATERIAL_CHANGE' ? 'registrationSection' :
          item.kind === 'EVENT_CONFIRMED' ? 'detailsSection' :
            item.kind === 'EVENT_OUTCOME_DUE' ? 'hostSection' :
              item.kind === 'EVENT_OUTCOME_REVIEW' ? 'checkinSection' : '',
      categoryLabel: group === 'INTERACTION' ? '互动消息' : group === 'ACTIVITY' ? '活动提醒' : '系统通知',
      cardVariant,
      icon: caution ? '!' : item.kind === 'EVENT_REMINDER' ? '◷' : item.kind === 'MATERIAL_CHANGE' ? '⌖'
        : ['EVENT_CONFIRMED', 'REGISTRATION_APPROVED'].includes(item.kind) ? '✓'
          : item.kind === 'EVENT_OUTCOME_DUE' ? '▣' : item.kind === 'WAITLIST_OFFER' ? 'ϟ'
            : group === 'INTERACTION' ? '✦' : '✉',
      tone: caution || item.kind === 'WAITLIST_OFFER' ? 'pink' : item.kind === 'MATERIAL_CHANGE' ? 'lime'
        : ['EVENT_CONFIRMED', 'REGISTRATION_APPROVED'].includes(item.kind) ? 'green'
          : item.kind === 'EVENT_OUTCOME_DUE' ? 'violet' : isCheckin ? 'blue'
            : group === 'INTERACTION' ? 'violet' : item.event_id ? 'blue' : 'gray' };
  });
}
function displayed(items, filter, searchQuery = '') {
  const shown = items.map(item => ({ ...item, visible: visible(item, filter, searchQuery) }));
  const centerItems = shown.filter(item => item.visible);
  return { items: shown, centerItems, filteredCount: centerItems.length,
    noticeGroups: groupSpecs.map(spec => ({ ...spec, items: shown.filter(item => item.visible && groupFor(item) === spec.key) })) };
}
function currentIdentity(developmentMode) {
  const hasSession = Boolean(wx.getStorageSync?.('sessionToken'));
  const actor = hasSession ? wx.getStorageSync?.('userId') :
    developmentMode ? (wx.getStorageSync?.('devUser') || config.developmentUser) : '';
  return { hasSession, actor, key: actor ? `${hasSession ? 'user' : 'dev'}:${actor}` : '' };
}
function noticeEventId(value) { return value == null ? '' : String(value); }
Page({
  data: { statusBarHeight: 24, capsuleInset: 96, items: [], centerItems: [], noticeGroups: [], filteredCount: 0, total: 0, unreadTotal: 0, nextOffset: null, snapshot: null,
    loadState: 'IDLE', loadingMore: false, markingAllRead: false, message: '',
    approvals: [], approvalTotal: 0, approvalNextOffset: null, approvalSnapshot: null, approvalLoadState: 'IDLE',
    approvingId: '', loadingMoreApprovals: false,
    filter: 'ALL', viewMode: 'INBOX', searchOpen: false, searchQuery: '', hasSession: false, developmentMode: Boolean(config.developmentUser) },
  onLoad() {
    const system = wx.getSystemInfoSync?.() || {};
    const capsule = typeof wx.getMenuButtonBoundingClientRect === 'function'
      ? wx.getMenuButtonBoundingClientRect() : null;
    const width = system.windowWidth || system.screenWidth;
    const capsuleInset = capsule?.left > 0 && width
      ? Math.max(96, Math.ceil(width - capsule.left + 8)) : 96;
    this.setData({ statusBarHeight: system.statusBarHeight || 24, capsuleInset });
  },
  async onShow() {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.setData({ selected: 3 });
    await getApp().globalData.ready;
    const focusIntent = wx.getStorageSync?.('irlMessagesFocusIntent');
    if (focusIntent) wx.removeStorageSync?.('irlMessagesFocusIntent');
    const { hasSession, actor, key } = currentIdentity(this.data.developmentMode);
    if (this._identity !== key) {
      this._generation = (this._generation || 0) + 1;
      this.setData({ items: [], centerItems: [], noticeGroups: [], filteredCount: 0, total: 0, unreadTotal: 0, nextOffset: null, snapshot: null,
        loadingMore: false, markingAllRead: false, approvals: [], approvalTotal: 0,
        approvalNextOffset: null, approvalSnapshot: null, approvalLoadState: 'IDLE',
        approvingId: '', loadingMoreApprovals: false, viewMode: 'INBOX', filter: 'ALL',
        searchOpen: false, searchQuery: '' });
    }
    this._identity = key;
    this._actor = actor;
    if (focusIntent === 'approvals') this.setData({ viewMode: 'INBOX', filter: 'INTERACTION' });
    this.setData({ hasSession });
    this.setTabBarHidden(this.data.viewMode !== 'INBOX');
    if (!actor) return this.setData({ loadState: 'UNAUTHENTICATED', message: '请先微信登录后查看本人消息。' });
    return this.refresh();
  },
  onHide() { this.setTabBarHidden(false); },
  setTabBarHidden(hidden) {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.setData({ hidden });
    if (hidden) wx.hideTabBar?.({ animation: false });
    else wx.showTabBar?.({ animation: false });
  },
  async refresh() {
    if (this.clearPrivateAfterIdentityChange()) return;
    const identity = this._identity;
    if (!identity || identity !== currentIdentity(this.data.developmentMode).key) return;
    const generation = this._generation = (this._generation || 0) + 1;
    const stillCurrent = () => generation === this._generation && identity === this._identity &&
      identity === currentIdentity(this.data.developmentMode).key;
    this.setData({ loadState: 'LOADING', loadingMore: false, message: '', nextOffset: null });
    try {
      const page = await api.get('/me/notifications?offset=0');
      if (!stillCurrent()) return;
      const inbox = displayed(present(page.items || []), this.data.filter, this.data.searchQuery);
      this.setData({ ...inbox, total: page.total ?? (page.items || []).length,
        unreadTotal: page.unreadTotal ?? (page.items || []).filter(item => item.status !== 'OPENED').length,
        nextOffset: page.nextOffset ?? null, snapshot: page.snapshot ?? null, loadState: 'READY' });
      if (this.data.filter === 'INTERACTION' || this.data.viewMode === 'CENTER') await this.loadApprovals();
    } catch (error) {
      if (stillCurrent()) this.setData({ loadState: 'ERROR', message: error.message || '消息加载失败' });
    }
  },
  setFilter(event) {
    if (this.clearPrivateAfterIdentityChange()) return;
    if (this.data.loadState !== 'READY') return;
    const filter = event.currentTarget.dataset.filter;
    if (!['ALL', 'ACTIVITY', 'INTERACTION', 'SYSTEM'].includes(filter)) return;
    this.setData({ filter, ...displayed(this.data.items, filter, this.data.searchQuery) });
    if (filter === 'INTERACTION' && this.data.approvalLoadState === 'IDLE') return this.loadApprovals();
  },
  async openNotificationCenter() {
    if (this.clearPrivateAfterIdentityChange()) return;
    const filter = 'ALL';
    this.setData({ viewMode: 'CENTER', filter, searchOpen: false, searchQuery: '',
      ...displayed(this.data.items, filter) });
    this.setTabBarHidden(true);
    if (this.data.loadState === 'READY' && this.data.approvalLoadState === 'IDLE')
      await this.loadApprovals();
  },
  openPrivateChatPreview() {
    if (this.clearPrivateAfterIdentityChange()) return;
    const filter = 'ALL';
    this.setData({ viewMode: 'CHAT_UNAVAILABLE', filter, searchOpen: false, searchQuery: '',
      ...displayed(this.data.items, filter) });
    this.setTabBarHidden(true);
  },
  backToInbox() {
    if (this.clearPrivateAfterIdentityChange()) return;
    const filter = 'ALL';
    this.setData({ viewMode: 'INBOX', filter,
      ...displayed(this.data.items, filter, this.data.searchQuery) });
    this.setTabBarHidden(false);
  },
  toggleSearch() {
    if (this.clearPrivateAfterIdentityChange()) return;
    const searchOpen = !this.data.searchOpen;
    const searchQuery = searchOpen ? this.data.searchQuery : '';
    this.setData({ searchOpen, searchQuery, ...displayed(this.data.items, this.data.filter, searchQuery) });
  },
  searchInput(event) {
    if (this.clearPrivateAfterIdentityChange()) return;
    const searchQuery = (event.detail.value || '').trim();
    this.setData({ searchQuery, ...displayed(this.data.items, this.data.filter, searchQuery) });
  },
  async loadMore() {
    if (this.clearPrivateAfterIdentityChange()) return;
    const offset = this.data.nextOffset;
    if (this.data.loadingMore || offset === null || offset === undefined) return;
    const identity = this._identity;
    if (!identity || identity !== currentIdentity(this.data.developmentMode).key) return;
    const generation = this._generation;
    const stillCurrent = () => generation === this._generation && identity === this._identity &&
      identity === currentIdentity(this.data.developmentMode).key;
    this.setData({ loadingMore: true });
    try {
      const page = await api.get(`/me/notifications?offset=${offset}&snapshot=${encodeURIComponent(this.data.snapshot)}`);
      if (!stillCurrent()) return;
      const inbox = displayed(this.data.items.concat(present(page.items || [])), this.data.filter, this.data.searchQuery);
      this.setData({ ...inbox, total: page.total,
        unreadTotal: page.unreadTotal ?? this.data.unreadTotal, loadingMore: false,
        nextOffset: page.nextOffset ?? null, snapshot: page.snapshot });
    } catch (error) {
      if (!stillCurrent()) return;
      if (error.code === 'QUEUE_CHANGED') {
        await this.refresh();
        if (identity === this._identity && identity === currentIdentity(this.data.developmentMode).key &&
          this.data.loadState === 'READY') this.setData({ message: '消息列表已变化，已重新加载。' });
        return;
      }
      this.setData({ loadingMore: false, message: error.message || '加载更多失败' });
    }
  },
  async markAllRead() {
    if (this.clearPrivateAfterIdentityChange()) return;
    if (this.data.markingAllRead || this.data.loadState !== 'READY' || !this.data.unreadTotal) return;
    const identity = this._identity;
    if (!identity || currentIdentity(this.data.developmentMode).key !== identity) return;
    let expectedGeneration = this._generation;
    const stillCurrent = () => expectedGeneration === this._generation &&
      identity === this._identity && currentIdentity(this.data.developmentMode).key === identity;
    this.setData({ markingAllRead: true, message: '' });
    try {
      if (!stillCurrent()) return;
      await api.post('/me/notifications/open-all', {});
      if (!stillCurrent()) return;
      const refresh = this.refresh();
      expectedGeneration = this._generation;
      await refresh;
      if (stillCurrent() && this.data.loadState === 'READY') this.setData({ message: '已将全部站内通知标为已读。' });
    } catch (error) {
      if (stillCurrent()) this.setData({ message: error.message || '标记失败，请重试' });
    } finally {
      if (stillCurrent()) this.setData({ markingAllRead: false });
    }
  },
  clearPrivateAfterIdentityChange() {
    if (!this._identity || this._identity === currentIdentity(this.data.developmentMode).key) return false;
    this._generation = (this._generation || 0) + 1;
    this._approvalLoadId = (this._approvalLoadId || 0) + 1;
    this.setData({ items: [], centerItems: [], noticeGroups: [], filteredCount: 0,
      total: 0, unreadTotal: 0, nextOffset: null, snapshot: null, loadState: 'IDLE',
      loadingMore: false, markingAllRead: false,
      approvals: [], approvalTotal: 0, approvalNextOffset: null, approvalSnapshot: null,
      approvalLoadState: 'IDLE', approvingId: '', loadingMoreApprovals: false,
      viewMode: 'INBOX', filter: 'ALL', searchOpen: false, searchQuery: '',
      message: '账号已切换，请返回后重新加载消息。' });
    this.setTabBarHidden(false);
    return true;
  },
  async loadApprovals() {
    if (this.clearPrivateAfterIdentityChange()) return;
    const generation = this._generation;
    const approvalLoadId = this._approvalLoadId = (this._approvalLoadId || 0) + 1;
    const identity = this._identity;
    this.setData({ approvalLoadState: 'LOADING', approvalNextOffset: null,
      approvalSnapshot: null, approvals: [], approvalTotal: 0, loadingMoreApprovals: false });
    try {
      const page = await api.get('/me/approval-requests?offset=0');
      if (generation !== this._generation || approvalLoadId !== this._approvalLoadId ||
        identity !== this._identity || this.clearPrivateAfterIdentityChange()) return;
      this.setData({ approvals: (page.items || []).map(item => ({ ...item, timeLabel: timeLabel(item.createdAt) })),
        approvalTotal: page.total || 0,
        approvalNextOffset: page.nextOffset ?? null, approvalSnapshot: page.snapshot ?? null,
        approvalLoadState: 'READY' });
    } catch (error) {
      if (generation === this._generation && approvalLoadId === this._approvalLoadId &&
        identity === this._identity && !this.clearPrivateAfterIdentityChange()) this.setData({ approvalLoadState: 'ERROR',
        message: error.message || '待审核报名加载失败' });
    }
  },
  async loadMoreApprovals() {
    if (this.clearPrivateAfterIdentityChange()) return;
    const offset = this.data.approvalNextOffset;
    if (this.data.loadingMoreApprovals || offset === null || offset === undefined) return;
    const generation = this._generation;
    const approvalLoadId = this._approvalLoadId;
    const identity = this._identity;
    this.setData({ loadingMoreApprovals: true });
    try {
      const page = await api.get(`/me/approval-requests?offset=${offset}&snapshot=${encodeURIComponent(this.data.approvalSnapshot)}`);
      if (generation !== this._generation || approvalLoadId !== this._approvalLoadId ||
        identity !== this._identity || this.clearPrivateAfterIdentityChange()) return;
      this.setData({ approvals: this.data.approvals.concat((page.items || []).map(item => ({
        ...item, timeLabel: timeLabel(item.createdAt) }))), approvalTotal: page.total,
        approvalNextOffset: page.nextOffset ?? null, approvalSnapshot: page.snapshot ?? null,
        loadingMoreApprovals: false });
    } catch (error) {
      if (generation !== this._generation || approvalLoadId !== this._approvalLoadId ||
        identity !== this._identity || this.clearPrivateAfterIdentityChange()) return;
      if (error.code === 'QUEUE_CHANGED') {
        await this.loadApprovals();
        return this.setData({ message: '审核列表已变化，已重新加载。', loadingMoreApprovals: false });
      }
      this.setData({ loadingMoreApprovals: false, message: error.message || '加载更多审核失败' });
    }
  },
  async approveRequest(event) {
    if (this.clearPrivateAfterIdentityChange()) return;
    const { id, version } = event.currentTarget.dataset;
    if (!id || this.data.approvingId || !this.data.approvals.some(item => item.registrationId === id && item.canApprove)) return;
    const generation = this._generation;
    const identity = this._identity;
    if (identity && identity !== currentIdentity(this.data.developmentMode).key) return;
    const stillCurrent = () => generation === this._generation && identity === this._identity &&
      identity === currentIdentity(this.data.developmentMode).key;
    this.setData({ approvingId: id, message: '' });
    try {
      await api.post(`/registrations/${encodeURIComponent(id)}/approve`, { expectedVersion: Number(version) });
      if (!stillCurrent()) { if (identity === this._identity) this.clearPrivateAfterIdentityChange(); return; }
      await this.loadApprovals();
      if (stillCurrent()) this.setData({ message: '报名已通过，名额以服务端结果为准。' });
    } catch (error) {
      if (stillCurrent()) {
        await this.loadApprovals();
        this.setData({ message: error.message || '审核失败，请重试' });
      } else if (identity === this._identity) this.clearPrivateAfterIdentityChange();
    } finally {
      if (stillCurrent()) this.setData({ approvingId: '' });
    }
  },
  viewApproval(event) {
    if (this.clearPrivateAfterIdentityChange()) return;
    const { eventId, isHost } = event.currentTarget.dataset;
    if (eventId) wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(eventId) +
      '&section=' + (isHost ? 'hostSection' : 'cohostApprovalSection') });
  },
  async openNotice(event) {
    if (this.clearPrivateAfterIdentityChange()) return;
    const { id, eventId, kind, section } = event.currentTarget.dataset;
    if (!id || !kind || !this.data.items.some(item =>
      String(item.id) === String(id) && item.kind === kind &&
      noticeEventId(item.event_id) === noticeEventId(eventId))) return;
    if (this._identity !== undefined && currentIdentity(this.data.developmentMode).key !== this._identity) return;
    if (kind === 'MATERIAL_CHANGE' && !eventId) return;
    const profileFocus = profileFocusByKind[kind];
    const generation = this._generation;
    const targetSection = kind === 'MATERIAL_CHANGE' ? 'registrationSection' : section;
    try {
      if (profileFocus) {
        wx.setStorageSync?.('irlProfileFocusIntent', profileFocus);
        try {
          await new Promise((resolve, reject) => wx.switchTab({ url: '/pages/me/me', success: resolve, fail: reject }));
        } catch (error) {
          wx.removeStorageSync?.('irlProfileFocusIntent');
          throw error;
        }
      } else if (eventId) {
        await new Promise((resolve, reject) => wx.navigateTo({
          url: '/pages/event/event?id=' + encodeURIComponent(eventId) +
            ((kind === 'MATERIAL_CHANGE' || ['checkinSection', 'expenseSection', 'detailsSection', 'hostSection'].includes(targetSection))
              ? '&section=' + targetSection : ''),
          success: resolve, fail: reject
        }));
      }
      if (generation !== this._generation || (this._identity !== undefined &&
        currentIdentity(this.data.developmentMode).key !== this._identity)) return;
      await api.post(`/me/notifications/${encodeURIComponent(id)}/open`, {});
      if (generation !== this._generation) return;
      if (profileFocus) return;
      if (!eventId) {
        await this.refresh();
        this.setData({ message: '通知已打开。' });
      }
    } catch (error) { if (generation === this._generation) this.setData({ message: error.message || '打开通知失败' }); }
  },
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); },
  goMyActivities() {
    this.backToInbox();
    wx.switchTab({ url: '/pages/index/index' });
  },
  goNotificationSettings() {
    wx.setStorageSync?.('irlProfileFocusIntent', 'notificationSettingsSection');
    wx.switchTab({ url: '/pages/me/me' });
  },
  goDiscover() { wx.switchTab({ url: '/pages/discover/discover' }); }
});
