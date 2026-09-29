const { api } = require('../../utils/api.js');
const config = require('../../config.js');

const inspirationCards = [
  { title: '城市漫步', subtitle: '把周末还给真实风景', image: '/assets/stitch/caper_discover_citywalk.jpg', tag: '城市 · 户外', sticker: 'CITY WALK', stickerNote: 'TOGETHER ☺', tags: ['城市', '户外'] },
  { title: '周末篮球', subtitle: '约上球友，痛快打一场', image: '/assets/stitch/caper_discover_basketball.jpg', tag: '运动 · 球局', sticker: 'BASKETBALL', stickerNote: 'NEVER ALONE!', tags: ['运动', '社交'] },
  { title: '咖啡聊天', subtitle: '从一杯咖啡开始认识彼此', image: '/assets/stitch/caper_discover_coffee.jpg', tag: '美食 · 社交', sticker: 'GOOD COFFEE', stickerNote: 'BETTER PEOPLE', tags: ['美食', '社交'] },
  { title: '桌游之夜', subtitle: '一起开局，一起笑出声', image: '/assets/stitch/caper_discover_boardgame.jpg', tag: '兴趣 · 桌游', sticker: 'BOARD GAME', stickerNote: 'GOOD TIMES ☺', tags: ['桌游', '社交'] }
];
const categories = ['全部', '附近', '本周', '活动', '文艺', '美食', '职场', '兴趣', '生活', '公益'];
function currentIdentity() {
  return wx.getStorageSync('sessionToken')
    ? 'user:' + wx.getStorageSync('userId')
    : 'dev:' + (wx.getStorageSync('devUser') || config.developmentUser || '');
}
function coverFor(title) {
  if (/羽毛球/.test(title)) return '/assets/stitch/caper_home_badminton.jpg';
  if (/篮球/.test(title)) return '/assets/stitch/caper_discover_basketball.jpg';
  if (/咖啡|聊天|创业/.test(title)) return '/assets/stitch/caper_discover_coffee.jpg';
  if (/桌游|游戏/.test(title)) return '/assets/stitch/caper_discover_boardgame.jpg';
  return '/assets/stitch/caper_discover_citywalk.jpg';
}
function dateLabel(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '时间待确认';
  const date = new Date(Date.parse(value) + 8 * 60 * 60_000);
  return `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日 ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}
function headerPaddingRight() {
  try {
    const menu = wx.getMenuButtonBoundingClientRect?.();
    const windowWidth = (wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {}).windowWidth;
    if (Number.isFinite(menu?.left) && Number.isFinite(windowWidth) && menu.left >= 0 && menu.left < windowWidth)
      return `${Math.ceil(windowWidth - menu.left + 8)}px`;
  } catch (_) { /* Fall back to a conservative inset on older clients. */ }
  return '112px';
}
Page({
  data: {
    statusBarHeight: typeof wx.getSystemInfoSync === 'function'
      ? wx.getSystemInfoSync().statusBarHeight || 20 : 20,
    city: '上海', categories, inspirationCards, headerPaddingRight: headerPaddingRight(),
    discoveryEnabled: false, publicItems: [],
    tokenInput: '', message: '', availabilityMessage: '', personalEvents: [], personalState: 'IDLE'
  },
  async onShow() {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.setData({ selected: 1 });
    const city = wx.getStorageSync('irlSelectedCity');
    this.setData({ city: typeof city === 'string' && city ? city : '上海' });
    const generation = this._personalGeneration = (this._personalGeneration || 0) + 1;
    const identity = currentIdentity();
    this.setData({ personalEvents: [], personalState: 'LOADING' });
    try {
      await getApp().globalData.ready;
      if (generation !== this._personalGeneration || identity !== currentIdentity()) return;
      const result = await api.get('/me/events');
      if (generation !== this._personalGeneration || identity !== currentIdentity()) return;
      if (!Array.isArray(result.items)) throw new Error('活动列表无效');
      const labels = { RECRUITING: '招募中', CONFIRMED: '已成局', IN_PROGRESS: '进行中',
        COMPLETED: '已结束', CANCELLED: '已取消', EXPIRED: '已过期' };
      const personalEvents = result.items.filter(item => item?.id && !['DRAFT', 'REVIEW_PENDING'].includes(item.status))
        .slice(0, 3).map(item => ({ id: item.id, title: item.title || '未命名活动',
          statusLabel: labels[item.status] || '状态待确认', dateLabel: dateLabel(item.startAt), cover: coverFor(item.title || '') }));
      this.setData({ personalEvents, personalState: 'READY' });
    } catch (_) {
      if (generation === this._personalGeneration && identity === currentIdentity())
        this.setData({ personalEvents: [], personalState: 'ERROR' });
    }
  },
  openCity() { wx.navigateTo({ url: '/pages/city/city' }); },
  goHome() { wx.switchTab({ url: '/pages/index/index' }); },
  goMessages() { wx.switchTab({ url: '/pages/messages/messages' }); },
  showUnavailable(event) {
    const name = event?.currentTarget?.dataset?.name;
    const title = name ? `${name}暂未开放` : '公开找局暂未开放';
    this.setData({ availabilityMessage: `${title}；收到邀请可用口令进入，或发起自己的活动。` });
    if (typeof wx.showToast === 'function') wx.showToast({ title, icon: 'none' });
  },
  tokenChanged(event) { this.setData({ tokenInput: event.detail.value.trim(), message: '' }); },
  openInvite() {
    if (!this.data.tokenInput) return this.setData({ message: '请输入邀请口令' });
    wx.navigateTo({ url: '/pages/event/event?token=' + encodeURIComponent(this.data.tokenInput) });
  },
  openPersonalEvent(event) {
    const id = event?.currentTarget?.dataset?.id;
    if (!id || !this.data.personalEvents.some(item => item.id === id)) return;
    wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(id) });
  },
  goPersonalAll() { wx.navigateTo({ url: '/subpackages/profile/moments/moments?filter=all' }); },
  openInspiration(event) {
    const title = String(event?.currentTarget?.dataset?.title || '这类活动');
    const notice = `${title}目前仅供灵感参考。当前只能发起羽毛球活动，是否前往发起？`;
    if (typeof wx.showModal !== 'function') return this.setData({ availabilityMessage: notice });
    wx.showModal({ title: '活动灵感', content: notice, confirmText: '发起羽毛球', cancelText: '继续浏览',
      success: result => { if (result.confirm) this.goCreate(); } });
  },
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); }
});
