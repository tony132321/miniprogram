const { api } = require('../../utils/api.js');
const config = require('../../config.js');

const noticeTitles = {
  WAITLIST_OFFER: '收到补位邀请', WAITLIST_WINDOW_CLOSED: '补位时间窗口已结束',
  EVENT_REMINDER: '活动提醒', EVENT_OUTCOME_DUE: '请记录活动结项',
  EVENT_OUTCOME_REVIEW: '请反馈活动结项', PUBLIC_RECRUITMENT_CLOSED: '活动招募暂停',
  PUBLIC_RECRUITMENT_OPEN: '活动招募恢复', REGISTRATION_REMOVED: '报名已移除',
  REPORT_IN_REVIEW: '举报正在处理', REPORT_RESOLVED: '举报已有处理结论',
  APPEAL_IN_REVIEW: '申诉正在复核', APPEAL_RESOLVED: '申诉已有复核结论',
  CONTENT_REJECTED: '活动内容未通过审核'
};
function visible(item, filter) {
  return filter === 'ALL' || (filter === 'ACTIVITY' && Boolean(item.event_id)) ||
    (filter === 'SYSTEM' && !item.event_id);
}
function present(items, filter) {
  return items.map(item => ({ ...item, visible: visible(item, filter), title: noticeTitles[item.kind] || '站内通知',
    externalHint: item.external_status === 'PROVIDER_ACCEPTED'
      ? '外部提醒已受理，未确认送达' : item.external_status === 'UNKNOWN_REQUIRES_RECONCILIATION'
        ? '外部提醒结果待核对' : '请以站内通知为准' }));
}
function countVisible(items) { return items.filter(item => item.visible).length; }
Page({
  data: { items: [], filteredCount: 0, total: 0, nextOffset: null, snapshot: null,
    loadState: 'IDLE', loadingMore: false, message: '',
    filter: 'ALL', hasSession: false, developmentMode: Boolean(config.developmentUser) },
  async onShow() {
    await getApp().globalData.ready;
    const hasSession = Boolean(wx.getStorageSync('sessionToken'));
    const actor = hasSession ? wx.getStorageSync('userId') : this.data.developmentMode ? (wx.getStorageSync('devUser') || config.developmentUser) : '';
    if (this._actor !== actor) {
      this._generation = (this._generation || 0) + 1;
      this.setData({ items: [], filteredCount: 0, total: 0, nextOffset: null, snapshot: null,
        loadingMore: false });
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
      const items = present(page.items || [], this.data.filter);
      this.setData({ items, filteredCount: countVisible(items), total: page.total ?? (page.items || []).length,
        nextOffset: page.nextOffset ?? null, snapshot: page.snapshot ?? null, loadState: 'READY' });
    } catch (error) {
      if (generation === this._generation) this.setData({ loadState: 'ERROR', message: error.message || '消息加载失败' });
    }
  },
  setFilter(event) {
    const filter = event.currentTarget.dataset.filter;
    const items = this.data.items.map(item => ({ ...item, visible: visible(item, filter) }));
    this.setData({ filter, items, filteredCount: countVisible(items) });
  },
  async loadMore() {
    const offset = this.data.nextOffset;
    if (this.data.loadingMore || offset === null || offset === undefined) return;
    const generation = this._generation;
    this.setData({ loadingMore: true });
    try {
      const page = await api.get(`/me/notifications?offset=${offset}&snapshot=${encodeURIComponent(this.data.snapshot)}`);
      if (generation !== this._generation) return;
      const items = this.data.items.concat(present(page.items || [], this.data.filter));
      this.setData({ items, filteredCount: countVisible(items), total: page.total, loadingMore: false,
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
  async openNotice(event) {
    const { id, eventId, kind } = event.currentTarget.dataset;
    const profileKinds = ['REGISTRATION_REMOVED', 'REPORT_IN_REVIEW', 'REPORT_RESOLVED',
      'APPEAL_IN_REVIEW', 'APPEAL_RESOLVED', 'CONTENT_REJECTED', 'WAITLIST_OFFER'];
    const generation = this._generation;
    try {
      if (eventId && !profileKinds.includes(kind)) {
        await new Promise((resolve, reject) => wx.navigateTo({
          url: '/pages/event/event?id=' + encodeURIComponent(eventId), success: resolve, fail: reject
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
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); }
});
