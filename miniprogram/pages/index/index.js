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
  if (item.myRegistrationStatus === 'CONFIRMED') return 'attending';
  if (item.isCohost) return 'cohosting';
  return 'attending';
}
const statusLabels = { DRAFT: '草稿', REVIEW_PENDING: '待审核', RECRUITING: '招募中', CONFIRMED: '已成局',
  COMPLETED: '已结束', CANCELLED: '已取消', EXPIRED: '已过期' };
const registrationLabels = { INTERESTED: '待决定', REQUESTED: '待主办审批', WAITLISTED: '候补中',
  OFFERED: '待接受补位', CONFIRMED: '已报名', RECONFIRM_REQUIRED: '待重新确认' };
const tabs = [
  { key: 'attending', label: '即将参加' }, { key: 'pending', label: '待确认' },
  { key: 'organized', label: '我组织的' }, { key: 'cohosting', label: '协办' }, { key: 'history', label: '历史' }
];
const categoryIdeas = [
  { icon: '🏸', label: '运动', tone: 'mint' }, { icon: '🥘', label: '美食', tone: 'peach' },
  { icon: '☕', label: '喝一杯', tone: 'cream' }, { icon: '🏙️', label: 'City Walk', tone: 'sky' },
  { icon: '🎲', label: '桌游', tone: 'pink' }, { icon: '•••', label: '更多', tone: 'gray' }
];
function dateLabel(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '时间待定';
  const date = new Date(Date.parse(value) + 8 * 60 * 60_000);
  return `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日 ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}
function coverFor(title) {
  if (/羽毛球/.test(title)) return '/assets/stitch/caper_home_badminton.jpg';
  if (/篮球/.test(title)) return '/assets/stitch/caper_discover_basketball.jpg';
  if (/咖啡|聊天|创业/.test(title)) return '/assets/stitch/caper_discover_coffee.jpg';
  if (/展览|艺术|画/.test(title)) return '/assets/stitch/caper_discover_art.jpg';
  if (/桌游|游戏/.test(title)) return '/assets/stitch/caper_discover_boardgame.jpg';
  return '/assets/stitch/caper_discover_citywalk.jpg';
}
Page({
  data: { items: [], organized: [], cohosting: [], pending: [], attending: [], history: [],
    tabs, categoryIdeas, activeTab: 'attending', visibleItems: [], featuredItem: null,
    city: '上海', statusBarHeight: typeof wx.getSystemInfoSync === 'function'
      ? wx.getSystemInfoSync().statusBarHeight || 20 : 20,
    loadState: 'IDLE', errorCode: '', tokenInput: '', message: '' },
  async onShow() {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.setData({ selected: 0 });
    const savedCity = wx.getStorageSync('irlSelectedCity');
    this.setData({ city: typeof savedCity === 'string' && savedCity ? savedCity : '上海' });
    const requestedTab = wx.getStorageSync('irlHomeTabIntent');
    if (tabs.some(tab => tab.key === requestedTab)) {
      wx.removeStorageSync('irlHomeTabIntent');
      this.setData({ activeTab: requestedTab, visibleItems: this.data[requestedTab] });
    }
    const generation = this._loadGeneration = (this._loadGeneration || 0) + 1;
    let identity = currentIdentity();
    if (this._shownIdentity !== identity) {
      this._shownIdentity = identity;
      this.setData({ items: [], organized: [], cohosting: [], pending: [], attending: [], history: [], visibleItems: [], featuredItem: null, message: '' });
    }
    this.setData({ loadState: 'LOADING', errorCode: '', message: '' });
    try {
      await getApp().globalData.ready;
      if (generation !== this._loadGeneration) return;
      const authenticatedIdentity = currentIdentity();
      if (identity !== authenticatedIdentity) {
        identity = authenticatedIdentity;
        this._shownIdentity = identity;
        this.setData({ items: [], organized: [], cohosting: [], pending: [], attending: [], history: [], visibleItems: [], featuredItem: null, message: '' });
      }
      const result = await api.get('/me/events');
      if (generation !== this._loadGeneration || identity !== currentIdentity()) return;
      if (!Array.isArray(result.items)) throw new Error('活动列表无效，请重试');
      const groups = { organized: [], cohosting: [], pending: [], attending: [], history: [] };
      const items = result.items.map(item => ({ ...item, statusLabel: statusLabels[item.status] || item.status || '状态待确认',
        registrationLabel: registrationLabels[item.myRegistrationStatus] || '',
        cardLabel: registrationLabels[item.myRegistrationStatus] ||
          (sectionFor(item) === 'cohosting' ? '协办中' : statusLabels[item.status] || item.status || '状态待确认'),
        dateLabel: dateLabel(item.startAt), cover: coverFor(item.title || '') }));
      for (const item of items) groups[sectionFor(item)].push(item);
      const featuredItem = items.find(item => !['DRAFT', 'REVIEW_PENDING'].includes(item.status)) || null;
      this.setData({ items, ...groups, featuredItem, visibleItems: groups[this.data.activeTab], loadState: 'READY', errorCode: '', message: '' });
    } catch (error) {
      if (generation === this._loadGeneration && identity === currentIdentity())
        this.setData({ loadState: 'ERROR', errorCode: error.code || '', message: error.message || '活动列表加载失败' });
    }
  },
  selectTab(event) {
    const key = event.currentTarget.dataset.key;
    if (!tabs.some(tab => tab.key === key)) return;
    this.setData({ activeTab: key, visibleItems: this.data[key] });
  },
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); },
  goCity() { wx.navigateTo({ url: '/pages/city/city' }); },
  goDiscover() { wx.switchTab({ url: '/pages/discover/discover' }); },
  goMessages() { wx.switchTab({ url: '/pages/messages/messages' }); },
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); },
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
