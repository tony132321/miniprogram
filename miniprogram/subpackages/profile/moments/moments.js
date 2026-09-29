const { api } = require('../../../utils/api.js');
const config = require('../../../config.js');
const { backToProfile, statusBarHeight } = require('../navigation.js');

const filters = [
  { id: 'all', title: '全部精选' }, { id: 'participated', title: '我参与的' },
  { id: 'hosted', title: '我主办的' }
];
const statusLabels = { RECRUITING: '招募中', CONFIRMED: '已成局', IN_PROGRESS: '进行中',
  COMPLETED: '已结束', CANCELLED: '已取消', EXPIRED: '未成局' };
function currentIdentity() {
  const session = wx.getStorageSync('sessionToken');
  return session ? `user:${wx.getStorageSync('userId') || ''}`
    : (wx.getStorageSync('devUser') || config.developmentUser)
      ? `dev:${wx.getStorageSync('devUser') || config.developmentUser}` : '';
}
function dateLabel(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '时间待确认';
  const date = new Date(Date.parse(value) + 8 * 60 * 60_000);
  return `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日 ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}
function visibleEvents(events, filter) {
  if (filter === 'hosted') return events.filter(item => item.isHost);
  if (filter === 'participated') return events.filter(item => !item.isHost && item.myRegistrationStatus === 'CONFIRMED');
  return events;
}

Page({
  data: { statusBarHeight: 24, filters, activeFilter: 'all', events: [],
    visibleEvents: [], loadState: 'IDLE', message: '' },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  async onShow() {
    const generation = this._generation = (this._generation || 0) + 1;
    const identity = currentIdentity();
    this._identity = identity;
    this.setData({ events: [], visibleEvents: [], loadState: identity ? 'LOADING' : 'UNAUTHENTICATED', message: '' });
    if (!identity) return;
    try {
      await getApp().globalData.ready;
      if (generation !== this._generation || identity !== currentIdentity()) return;
      const response = await api.get('/me/events');
      if (generation !== this._generation || identity !== currentIdentity()) return;
      if (!Array.isArray(response?.items)) throw new Error('活动列表无效');
      const events = response.items.filter(item => item?.id).map(item => ({
        id: item.id, title: item.title || '未命名活动', isHost: Boolean(item.isHost),
        myRegistrationStatus: item.myRegistrationStatus || '',
        dateLabel: dateLabel(item.startAt), statusLabel: statusLabels[item.status] || '状态待确认'
      }));
      this.setData({ events, visibleEvents: visibleEvents(events, this.data.activeFilter), loadState: 'READY' });
    } catch (error) {
      if (generation === this._generation && identity === currentIdentity())
        this.setData({ events: [], visibleEvents: [], loadState: 'ERROR', message: error?.message || '活动加载失败' });
    }
  },
  back: backToProfile,
  selectFilter(event) {
    const filter = event?.currentTarget?.dataset?.filter;
    if (!filters.some(item => item.id === filter)) return;
    this.setData({ activeFilter: filter, visibleEvents: visibleEvents(this.data.events, filter) });
  },
  openActivity(event) {
    const id = event?.currentTarget?.dataset?.id;
    if (!id || this._identity !== currentIdentity() ||
      !this.data.visibleEvents.some(item => item.id === id)) return;
    wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(id) });
  },
  refresh() { return this.onShow(); },
  goActivities() { wx.switchTab({ url: '/pages/index/index' }); },
  goGuidelines() { wx.navigateTo({ url: '/subpackages/profile/guidelines/guidelines' }); }
});
