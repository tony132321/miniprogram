const { api } = require('../../../utils/api.js');
const config = require('../../../config.js');

function currentIdentity() {
  const token = wx.getStorageSync('sessionToken');
  if (token) return 'user:' + wx.getStorageSync('userId');
  const developer = wx.getStorageSync('devUser') || config.developmentUser;
  return developer ? 'dev:' + developer : '';
}
function coverFor(title) {
  if (/羽毛球/.test(title)) return '/assets/stitch/caper_home_badminton.jpg';
  if (/篮球/.test(title)) return '/assets/stitch/caper_discover_basketball.jpg';
  if (/咖啡|聊天|创业/.test(title)) return '/assets/stitch/caper_discover_coffee.jpg';
  if (/展览|艺术|画/.test(title)) return '/assets/stitch/caper_discover_art.jpg';
  if (/桌游|游戏/.test(title)) return '/assets/stitch/caper_discover_boardgame.jpg';
  return '/assets/stitch/caper_discover_citywalk.jpg';
}
function present(item, now) {
  const timestamp = Date.parse(item.startAt);
  const local = new Date(timestamp + 8 * 60 * 60_000);
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][local.getUTCDay()];
  const dateLabel = `${local.getUTCMonth() + 1} 月 ${local.getUTCDate()} 日（${weekday}）`;
  const timeLabel = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
  const days = Math.ceil((timestamp - now) / 86_400_000);
  const feeLabel = item.feeMode === 'FREE' ? '免费' :
    item.feeMode === 'AA' && Number.isSafeInteger(item.feeCapFen)
      ? `AA 制 · 每人上限 ¥${(item.feeCapFen / 100).toFixed(2)}` : '费用以活动详情为准';
  return { ...item, dateLabel, timeLabel, feeLabel, cover: coverFor(item.title || ''),
    venueLabel: item.venueName || '具体场地以活动详情为准',
    countdown: item.status === 'IN_PROGRESS' ? '进行中' : days <= 0 ? '今天开始' :
      days === 1 ? '明天开始' : `约 ${days} 天后开始`,
    stateLabel: item.status === 'IN_PROGRESS' ? '进行中' : item.status === 'CONFIRMED' ? '已成局' :
      item.isHost ? '我组织的 · 招募中' : '已确认报名' };
}
function eligible(item, now) {
  const timestamp = Date.parse(item.startAt);
  return Number.isFinite(timestamp) && (timestamp >= now ||
    (item.status === 'IN_PROGRESS' && timestamp >= now - 24 * 60 * 60_000)) &&
    !['CANCELLED', 'EXPIRED', 'COMPLETED', 'DRAFT', 'REVIEW_PENDING'].includes(item.status) &&
    (item.myRegistrationStatus === 'CONFIRMED' || item.isHost);
}
Page({
  data: { statusBarHeight: 24, loadState: 'IDLE', message: '', featured: null, later: [], total: 0 },
  onLoad() { this.setData({ statusBarHeight: wx.getSystemInfoSync?.().statusBarHeight || 24 }); },
  async onShow() { return this.refresh(); },
  onHide() { this._generation = (this._generation || 0) + 1; },
  onUnload() { this._generation = (this._generation || 0) + 1; },
  async onPullDownRefresh() { await this.refresh(); wx.stopPullDownRefresh?.(); },
  async refresh() {
    const generation = this._generation = (this._generation || 0) + 1;
    this.setData({ loadState: 'LOADING', message: '', featured: null, later: [], total: 0 });
    await getApp().globalData.ready;
    if (generation !== this._generation) return;
    const identity = currentIdentity();
    if (!identity) return this.setData({ loadState: 'UNAUTHENTICATED' });
    try {
      const response = await api.get('/me/events');
      if (generation !== this._generation || currentIdentity() !== identity) return;
      if (!Array.isArray(response.items)) throw new Error('行程列表无效，请重试');
      const now = Date.now();
      const upcoming = response.items.filter(item => eligible(item, now))
        .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))
        .map(item => present(item, now));
      this.setData({ featured: upcoming[0] || null, later: upcoming.slice(1), total: upcoming.length,
        loadState: 'READY' });
    } catch (error) {
      if (generation === this._generation && currentIdentity() === identity)
        this.setData({ loadState: 'ERROR', message: error.message || '行程读取失败，请重试' });
    }
  },
  openEvent(event) {
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(id) + '&section=detailsSection' });
  },
  goHome() { wx.switchTab({ url: '/pages/index/index' }); },
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); },
  back() { wx.navigateBack({ fail: () => this.goHome() }); }
});
