const { api } = require('../../utils/api.js');
const config = require('../../config.js');
const { defaultCity, selectedCity } = require('../../utils/city.js');

const inspirationCards = [
  { title: '城市漫步 · 滨江日落', subtitle: '把周末还给真实风景', image: '/assets/stitch/caper_discover_citywalk.jpg', tag: '城市 · 户外', stickerVariant: 'city', stickerLines: ['CITY', 'WALK'], stickerNoteLines: ['TOGETHER ☺'], tags: ['城市', '户外'] },
  { title: '周末篮球局', subtitle: '约上球友，痛快打一场', image: '/assets/stitch/caper_discover_basketball.jpg', tag: '运动 · 球局', stickerVariant: 'basketball', stickerLines: ['👑 BASKETBALL'], stickerNoteLines: ['NEVER', 'ALONE !'], tags: ['运动', '社交'] },
  { title: '咖啡聊天会', subtitle: '从一杯咖啡开始认识彼此', image: '/assets/stitch/caper_discover_coffee.jpg', tag: '美食 · 社交', stickerVariant: 'coffee', stickerLines: ['GOOD COFFEE'], stickerNoteLines: ['BETTER', 'PEOPLE'], tags: ['美食', '社交'] },
  { title: '周五桌游局', subtitle: '一起开局，一起笑出声', image: '/assets/stitch/caper_discover_boardgame.jpg', tag: '兴趣 · 桌游', stickerVariant: 'boardgame', stickerLines: ['BOARD GAME'], stickerNoteLines: ['GOOD TIMES ☺'], tags: ['桌游', '社交'] }
];
const recommendationSets = [
  [
    { title: '冲浪体验课', category: '户外运动', image: '/assets/stitch/caper_discover_surf.jpg' },
    { title: '周末一起看展', category: '文艺生活', image: '/assets/stitch/caper_discover_art.jpg' },
    { title: '咖啡馆里聊一聊', category: '美食社交', image: '/assets/stitch/caper_discover_coffee.jpg' }
  ],
  [
    { title: '春日露营', category: '户外生活', image: '/assets/stitch/caper_discover_camping.jpg' },
    { title: '城市漫步', category: '城市探索', image: '/assets/stitch/caper_discover_citywalk.jpg' },
    { title: '周五桌游局', category: '兴趣社交', image: '/assets/stitch/caper_discover_boardgame.jpg' }
  ]
];
const categories = ['全部', '附近', '本周', '活动', '文艺', '美食', '职场', '兴趣', '生活', '公益'];
function currentIdentity() {
  const token = wx.getStorageSync('sessionToken');
  return token
    ? 'session:' + wx.getStorageSync('userId') + ':' + token
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
function endTimeLabel(startAt, endAt) {
  if (!startAt || !endAt || Number.isNaN(Date.parse(startAt)) || Number.isNaN(Date.parse(endAt))) return '';
  const start = new Date(Date.parse(startAt) + 8 * 60 * 60_000);
  const end = new Date(Date.parse(endAt) + 8 * 60 * 60_000);
  if (start.getUTCFullYear() !== end.getUTCFullYear() || start.getUTCMonth() !== end.getUTCMonth() ||
    start.getUTCDate() !== end.getUTCDate()) return '—' + dateLabel(endAt);
  return `—${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`;
}
function locationLabel(city, venueName) {
  return [city, venueName].filter(value => typeof value === 'string' && value.trim()).join(' · ') || '地点待确认';
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
    city: defaultCity, categories, inspirationCards, recommendationCards: recommendationSets[0],
    recommendationSetIndex: 0, headerPaddingRight: headerPaddingRight(),
    discoveryEnabled: false, publicItems: [],
    tokenInput: '', message: '', availabilityMessage: '', personalEvents: [], personalState: 'IDLE',
    invitePreview: null, invitePreviewState: 'IDLE'
  },
  async onShow() {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.setData({ selected: 1 });
    this.setData({ city: selectedCity(wx) });
    const generation = this._personalGeneration = (this._personalGeneration || 0) + 1;
    const identity = currentIdentity();
    const staleInvite = Boolean(this.data.tokenInput && this._tokenIdentity !== identity) ||
      Boolean(this._visibleIdentity && this._visibleIdentity !== identity);
    this._visibleIdentity = identity;
    if (staleInvite) this._tokenIdentity = '';
    this._shownIdentity = '';
    this._inviteGeneration = (this._inviteGeneration || 0) + 1;
    this._previewToken = '';
    this._previewIdentity = '';
    this.setData({ personalEvents: [], personalState: 'LOADING', invitePreview: null, invitePreviewState: 'IDLE',
      tokenInput: staleInvite ? '' : this.data.tokenInput, message: '' });
    const focusIdentity = wx.getStorageSync('irlDiscoverFocusInvite');
    if (focusIdentity) {
      wx.removeStorageSync?.('irlDiscoverFocusInvite');
      if (focusIdentity === identity) {
        const jump = () => { if (identity === currentIdentity()) this.jumpToInvite(); };
        if (typeof wx.nextTick === 'function') wx.nextTick(jump);
        else jump();
      }
    }
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
          statusLabel: labels[item.status] || '状态待确认', dateLabel: dateLabel(item.startAt),
          endTimeLabel: endTimeLabel(item.startAt, item.endAt), locationLabel: locationLabel(item.city, item.venueName),
          isHost: Boolean(item.isHost), cover: coverFor(item.title || '') }));
      this._shownIdentity = identity;
      this.setData({ personalEvents, personalState: 'READY' });
    } catch (_) {
      if (generation === this._personalGeneration && identity === currentIdentity())
        this.setData({ personalEvents: [], personalState: 'ERROR' });
    }
  },
  openCity() { wx.navigateTo({ url: '/pages/city/city' }); },
  goHome() { wx.switchTab({ url: '/pages/index/index' }); },
  goMessages() { wx.switchTab({ url: '/pages/messages/messages' }); },
  selectCategory(event) {
    if (event?.currentTarget?.dataset?.name === '全部分类') {
      this.setData({ availabilityMessage: '' });
      return;
    }
    this.showUnavailable(event);
  },
  showUnavailable(event) {
    const name = event?.currentTarget?.dataset?.name;
    const title = name ? `${name}暂未开放` : '公开找局暂未开放';
    this.setData({ availabilityMessage: `${title}；收到邀请可用口令进入，或发起自己的活动。` });
    if (typeof wx.showToast === 'function') wx.showToast({ title, icon: 'none' });
  },
  rotateRecommendations() {
    const recommendationSetIndex = (this.data.recommendationSetIndex + 1) % recommendationSets.length;
    this.setData({ recommendationSetIndex, recommendationCards: recommendationSets[recommendationSetIndex] });
  },
  jumpToInvite() { wx.pageScrollTo?.({ selector: '#inviteEntry', duration: 300 }); },
  tokenChanged(event) {
    const identity = currentIdentity();
    if (this._visibleIdentity && this._visibleIdentity !== identity) {
      this._inviteGeneration = (this._inviteGeneration || 0) + 1;
      this._tokenIdentity = '';
      this._previewToken = '';
      this._previewIdentity = '';
      this.setData({ tokenInput: '', invitePreview: null, invitePreviewState: 'IDLE',
        message: '账号已切换，请重新进入发现页后输入邀请码。' });
      return;
    }
    this._visibleIdentity = identity;
    this._inviteGeneration = (this._inviteGeneration || 0) + 1;
    this._previewToken = '';
    this._previewIdentity = '';
    this._tokenIdentity = event.detail.value.trim() ? identity : '';
    this.setData({ tokenInput: event.detail.value.trim(), message: '', invitePreview: null, invitePreviewState: 'IDLE' });
  },
  clearStaleInvite() {
    const identity = currentIdentity();
    if ((!this._visibleIdentity || this._visibleIdentity === identity) &&
      (!this.data.tokenInput || this._tokenIdentity === identity)) return false;
    this._inviteGeneration = (this._inviteGeneration || 0) + 1;
    this._tokenIdentity = '';
    this._previewToken = '';
    this._previewIdentity = '';
    this.setData({ tokenInput: '', invitePreview: null, invitePreviewState: 'IDLE',
      message: '账号已切换，请重新输入邀请码。' });
    return true;
  },
  async previewInvite() {
    if (this.clearStaleInvite()) return;
    const token = String(this.data.tokenInput || '').trim();
    if (!/^[A-Za-z0-9_-]{32}$/.test(token))
      return this.setData({ invitePreview: null, invitePreviewState: 'IDLE', message: '请输入活动邀请卡上的 32 位口令。' });
    const identity = currentIdentity();
    const generation = this._inviteGeneration = (this._inviteGeneration || 0) + 1;
    this._previewToken = '';
    this._previewIdentity = '';
    this.setData({ invitePreview: null, invitePreviewState: 'LOADING', message: '' });
    try {
      const summary = await api.get('/i/' + encodeURIComponent(token));
      if (generation !== this._inviteGeneration || identity !== currentIdentity() || token !== this.data.tokenInput) return;
      if (!summary?.id || !(summary.title || summary.payload?.title)) throw new Error('邀请摘要无效');
      const title = summary.title || summary.payload.title;
      const startAt = summary.startAt || summary.payload?.startAt;
      const endAt = summary.endAt || summary.payload?.endAt;
      this._previewToken = token;
      this._previewIdentity = identity;
      this.setData({ invitePreview: { id: summary.id, title, cover: coverFor(title),
        dateLabel: dateLabel(startAt), endTimeLabel: endTimeLabel(startAt, endAt),
        locationLabel: locationLabel(summary.city || summary.payload?.city, summary.venueName || summary.payload?.venueName),
        statusLabel: summary.riskPaused ? '安全暂停' :
          summary.status === 'RECRUITING' && summary.recruiting === false ? '暂停招募' :
          ({ RECRUITING: '招募中', CONFIRMED: '已成局', IN_PROGRESS: '进行中',
            COMPLETED: '已结束', CANCELLED: '已取消', EXPIRED: '已过期' }[summary.status] || '以详情为准') },
      invitePreviewState: 'READY' });
    } catch (_) {
      if (generation === this._inviteGeneration && identity === currentIdentity() && token === this.data.tokenInput)
        this.setData({ invitePreview: null, invitePreviewState: 'ERROR', message: '邀请暂不可用或已失效，请核对口令。' });
    }
  },
  openPreviewedInvite() {
    if (!this.data.invitePreview?.id || !this._previewToken || this._previewIdentity !== currentIdentity() ||
      this._previewToken !== this.data.tokenInput) {
      this.setData({ invitePreview: null, invitePreviewState: 'IDLE', message: '邀请卡已过期或账号已切换，请重新预览。' });
      return;
    }
    wx.navigateTo({ url: '/pages/event/event?token=' + encodeURIComponent(this._previewToken) });
  },
  openInvite() {
    if (this.clearStaleInvite()) return;
    if (!this.data.tokenInput) return this.setData({ message: '请输入邀请口令' });
    wx.navigateTo({ url: '/pages/event/event?token=' + encodeURIComponent(this.data.tokenInput) });
  },
  scanInviteQr() {
    this.clearStaleInvite();
    const identity = currentIdentity();
    if (typeof wx.scanCode !== 'function') return this.setData({ message: '此设备暂不能扫码，请手动输入邀请码。' });
    try {
      wx.scanCode({ onlyFromCamera: true, scanType: ['qrCode'],
        success: result => {
          if (identity !== currentIdentity()) {
            this.clearStaleInvite();
            return this.setData({ message: '账号已切换，请重新扫码。' });
          }
          const token = typeof result?.result === 'string' ? result.result.trim() : '';
          if (!/^[A-Za-z0-9_-]{32}$/.test(token))
            return this.setData({ message: '这不是耍起 CAPER 的邀请码二维码，请扫描活动邀请卡。' });
          this._tokenIdentity = identity;
          this.setData({ tokenInput: token, message: '' });
          wx.navigateTo({ url: '/pages/event/event?token=' + encodeURIComponent(token) });
        },
        fail: error => {
          if (identity === currentIdentity() && !/cancel/i.test(String(error?.errMsg || '')))
            this.setData({ message: '扫码暂不可用，请手动输入邀请码。' });
        }
      });
    } catch (_) { this.setData({ message: '扫码暂不可用，请手动输入邀请码。' }); }
  },
  openPersonalEvent(event) {
    const id = event?.currentTarget?.dataset?.id;
    if (!id || this._shownIdentity !== currentIdentity() ||
      !this.data.personalEvents.some(item => item.id === id)) return;
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
