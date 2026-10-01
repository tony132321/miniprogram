const { api } = require('../../../utils/api.js');
const config = require('../../../config.js');
const { backToProfile, statusBarHeight } = require('../navigation.js');

const filters = [
  { id: 'all', title: '全部精选', icon: '✧' }, { id: 'participated', title: '我参与的', icon: '♧' },
  { id: 'hosted', title: '我主办的', icon: '♛' }
];
const statusLabels = { DRAFT: '草稿', REVIEW_PENDING: '待审核', RECRUITING: '招募中', CONFIRMED: '已成局', IN_PROGRESS: '进行中',
  COMPLETED: '已结束', CANCELLED: '已取消', EXPIRED: '未成局' };
function activityStatusLabel(item) {
  if (item.isHost && item.status === 'RECRUITING' &&
    !(item.reviewStatus === 'APPROVED' && item.recruiting === true)) {
    if (item.reviewStatus === 'PENDING') return '待审核';
    if (item.reviewStatus === 'REJECTED') return '审核未通过';
    if (item.reviewStatus === 'APPROVED') return '招募暂停';
    return '资格待核对';
  }
  return statusLabels[item.status] || '状态待确认';
}
function currentIdentity() {
  const session = wx.getStorageSync('sessionToken');
  return session ? JSON.stringify(['user', wx.getStorageSync('userId') || '', session])
    : (wx.getStorageSync('devUser') || config.developmentUser)
      ? `dev:${wx.getStorageSync('devUser') || config.developmentUser}` : '';
}
function dateLabel(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '时间待确认';
  const date = new Date(Date.parse(value) + 8 * 60 * 60_000);
  return `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日 ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}
function headerPaddingRight() {
  try {
    const menu = wx.getMenuButtonBoundingClientRect?.();
    const width = (wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {}).windowWidth;
    if (Number.isFinite(menu?.left) && Number.isFinite(width) && menu.left >= 0 && menu.left < width)
      return `${Math.ceil(width - menu.left + 8)}px`;
  } catch (_) { /* Use the reserved fallback width on older clients. */ }
  return '112px';
}
function eventIllustrations(item) {
  const title = item.title || '';
  if (item.type === 'badminton' || /羽毛球/.test(title)) return [
    '/assets/stitch/pg01_badminton_player.jpg', '/assets/stitch/itinerary_badminton.jpg',
    '/assets/stitch/caper_home_badminton.jpg'
  ];
  if (/咖啡|聊天|创业/.test(title)) return [
    '/assets/stitch/caper_discover_coffee.jpg', '/assets/stitch/caper_home_dinner.jpg',
    '/assets/stitch/caper_discover_boardgame.jpg'
  ];
  if (/桌游|游戏/.test(title)) return [
    '/assets/stitch/caper_discover_boardgame.jpg', '/assets/stitch/caper_home_dinner.jpg',
    '/assets/stitch/caper_discover_coffee.jpg'
  ];
  if (/徒步|露营|登山/.test(title)) return [
    '/assets/stitch/caper_home_hiking.jpg', '/assets/stitch/caper_discover_camping.jpg',
    '/assets/stitch/caper_discover_citywalk.jpg'
  ];
  if (/展览|艺术|摄影/.test(title)) return [
    '/assets/stitch/caper_discover_art.jpg', '/assets/stitch/caper_discover_citywalk.jpg',
    '/assets/stitch/caper_discover_coffee.jpg'
  ];
  return ['/assets/stitch/pg01_badminton_player.jpg', '/assets/stitch/itinerary_badminton.jpg',
    '/assets/stitch/caper_home_badminton.jpg'];
}
function visibleEvents(events, filter) {
  if (filter === 'hosted') return events.filter(item => item.isHost);
  if (filter === 'participated') return events.filter(item => item.myRegistrationStatus === 'CONFIRMED');
  return events;
}

Page({
  data: { statusBarHeight: 24, headerPaddingRight: '112px', moreOpen: false,
    filters, activeFilter: 'all', events: [],
    visibleEvents: [], loadState: 'IDLE', message: '' },
  onLoad(options) {
    const requestedFilter = options?.filter;
    this.setData({ statusBarHeight: statusBarHeight(), headerPaddingRight: headerPaddingRight(),
      activeFilter: filters.some(item => item.id === requestedFilter) ? requestedFilter : 'all' });
  },
  async onShow() {
    const generation = this._generation = (this._generation || 0) + 1;
    let identity = currentIdentity();
    this._identity = identity;
    this.setData({ events: [], visibleEvents: [], headerPaddingRight: headerPaddingRight(),
      loadState: 'LOADING', message: '' });
    try {
      await getApp().globalData.ready;
      if (generation !== this._generation) return;
      identity = currentIdentity();
      this._identity = identity;
      if (!identity) return this.setData({ loadState: 'UNAUTHENTICATED' });
      const response = await api.get('/me/events');
      if (generation !== this._generation || identity !== currentIdentity()) return;
      if (!Array.isArray(response?.items)) throw new Error('活动列表无效');
      const events = response.items.filter(item => item?.id).map(item => {
        const [cover, sideCover, detailCover] = eventIllustrations(item);
        return {
          id: item.id, title: item.title || '未命名活动', isHost: Boolean(item.isHost),
          myRegistrationStatus: item.myRegistrationStatus || '',
          venueName: item.venueName || '',
          dateLabel: dateLabel(item.startAt), statusLabel: activityStatusLabel(item),
          cover, sideCover, detailCover
        };
      });
      this.setData({ events, visibleEvents: visibleEvents(events, this.data.activeFilter), loadState: 'READY' });
    } catch (error) {
      if (generation === this._generation && identity === currentIdentity())
        this.setData({ events: [], visibleEvents: [], loadState: 'ERROR', message: error?.message || '活动加载失败' });
    }
  },
  onHide() { this.setData({ moreOpen: false }); },
  clearPrivateAfterIdentityChange() {
    if (!this._identity || this._identity === currentIdentity()) return false;
    this._generation = (this._generation || 0) + 1;
    this.setData({ events: [], visibleEvents: [], activeFilter: 'all', moreOpen: false,
      loadState: 'ERROR', message: '账号已切换，请重新加载活动记录。' });
    return true;
  },
  back: backToProfile,
  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },
  goProfile() {
    this.setData({ moreOpen: false });
    wx.switchTab({ url: '/pages/me/me' });
  },
  goPrivacy() {
    this.setData({ moreOpen: false });
    wx.navigateTo({ url: '/subpackages/profile/privacy-safety/privacy-safety' });
  },
  selectFilter(event) {
    if (this.clearPrivateAfterIdentityChange()) return;
    const filter = event?.currentTarget?.dataset?.filter;
    if (!filters.some(item => item.id === filter)) return;
    this.setData({ activeFilter: filter, visibleEvents: visibleEvents(this.data.events, filter) });
  },
  openActivity(event) {
    if (this.clearPrivateAfterIdentityChange()) return;
    const id = event?.currentTarget?.dataset?.id;
    if (!id || this._identity !== currentIdentity() ||
      !this.data.visibleEvents.some(item => item.id === id)) return;
    wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(id) });
  },
  refresh() { return this.onShow(); },
  showAllActivities() {
    if (this.clearPrivateAfterIdentityChange()) return;
    if (this.data.loadState !== 'READY' || !this.data.events.length ||
      this._identity !== currentIdentity()) return;
    this.setData({ activeFilter: 'all', visibleEvents: this.data.events });
  },
  goActivities() { wx.switchTab({ url: '/pages/index/index' }); },
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); },
  goGuidelines() {
    this.setData({ moreOpen: false });
    wx.navigateTo({ url: '/subpackages/profile/guidelines/guidelines' });
  }
});
