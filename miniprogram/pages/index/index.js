const { api } = require('../../utils/api.js');
const config = require('../../config.js');
function currentIdentity() {
  return wx.getStorageSync('sessionToken')
    ? 'user:' + wx.getStorageSync('userId')
    : 'dev:' + (wx.getStorageSync('devUser') || config.developmentUser || '');
}
function sectionFor(item) {
  if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(item.status)) return 'history';
  if (item.isHost) return 'organized';
  if (['INTERESTED', 'REQUESTED', 'WAITLISTED', 'OFFERED', 'RECONFIRM_REQUIRED'].includes(item.myRegistrationStatus)) return 'pending';
  return 'attending';
}
const statusLabels = { DRAFT: '草稿', REVIEW_PENDING: '待审核', RECRUITING: '招募中', CONFIRMED: '已成局',
  COMPLETED: '已结束', CANCELLED: '已取消', EXPIRED: '已过期' };
const registrationLabels = { INTERESTED: '待决定', REQUESTED: '待主办审批', WAITLISTED: '候补中',
  OFFERED: '待接受补位', CONFIRMED: '已报名', RECONFIRM_REQUIRED: '待重新确认' };
Page({
  data: { items: [], organized: [], pending: [], attending: [], history: [],
    loadState: 'IDLE', errorCode: '', tokenInput: '', message: '' },
  async onShow() {
    const generation = this._loadGeneration = (this._loadGeneration || 0) + 1;
    let identity = currentIdentity();
    if (this._shownIdentity !== identity) {
      this._shownIdentity = identity;
      this.setData({ items: [], organized: [], pending: [], attending: [], history: [], message: '' });
    }
    this.setData({ loadState: 'LOADING', errorCode: '', message: '' });
    try {
      await getApp().globalData.ready;
      if (generation !== this._loadGeneration) return;
      const authenticatedIdentity = currentIdentity();
      if (identity !== authenticatedIdentity) {
        identity = authenticatedIdentity;
        this._shownIdentity = identity;
        this.setData({ items: [], organized: [], pending: [], attending: [], history: [], message: '' });
      }
      const result = await api.get('/me/events');
      if (generation !== this._loadGeneration || identity !== currentIdentity()) return;
      if (!Array.isArray(result.items)) throw new Error('活动列表无效，请重试');
      const groups = { organized: [], pending: [], attending: [], history: [] };
      const items = result.items.map(item => ({ ...item, statusLabel: statusLabels[item.status] || item.status || '状态待确认',
        registrationLabel: registrationLabels[item.myRegistrationStatus] || '' }));
      for (const item of items) groups[sectionFor(item)].push(item);
      this.setData({ items, ...groups, loadState: 'READY', errorCode: '', message: '' });
    } catch (error) {
      if (generation === this._loadGeneration && identity === currentIdentity())
        this.setData({ loadState: 'ERROR', errorCode: error.code || '', message: error.message || '活动列表加载失败' });
    }
  },
  async retry() {
    if (this.data.errorCode === 'UNAUTHENTICATED' && !config.developmentUser) {
      try { await api.login(); }
      catch (error) { return this.setData({ loadState: 'ERROR', message: error.message || '重新登录失败' }); }
    }
    return this.onShow();
  },
  tokenChanged(event) { this.setData({ tokenInput: event.detail.value.trim() }); },
  openInvite() {
    if (!this.data.tokenInput) return this.setData({ message: '请输入邀请口令' });
    wx.navigateTo({ url: '/pages/event/event?token=' + encodeURIComponent(this.data.tokenInput) });
  },
  openEvent(event) { wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); }
});
