const { api } = require('../../../utils/api.js');
const config = require('../../../config.js');

function currentActor() {
  return wx.getStorageSync('sessionToken') ? wx.getStorageSync('userId')
    : wx.getStorageSync('devUser') || config.developmentUser || '';
}
function newSourceToken() {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0')).join('');
}
function localDate(value) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return '时间待确认';
  const date = new Date(timestamp + 8 * 60 * 60_000);
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getUTCDay()];
  return `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日（${weekday}）${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}
function coverFor(title, type) {
  const typedCover = {
    badminton: '/assets/stitch/caper_home_badminton.jpg',
    basketball: '/assets/stitch/caper_discover_basketball.jpg',
    coffee: '/assets/stitch/caper_discover_coffee.jpg',
    boardgame: '/assets/stitch/caper_discover_boardgame.jpg',
    hiking: '/assets/stitch/caper_home_hiking.jpg',
    citywalk: '/assets/stitch/caper_discover_citywalk.jpg'
  };
  const normalizedType = String(type || '').trim().toLowerCase();
  if (normalizedType) return typedCover[normalizedType] || '/assets/stitch/caper_discover_citywalk.jpg';
  if (/羽毛球/.test(title)) return '/assets/stitch/caper_home_badminton.jpg';
  if (/篮球/.test(title)) return '/assets/stitch/caper_discover_basketball.jpg';
  if (/咖啡|创业|聊天/.test(title)) return '/assets/stitch/caper_discover_coffee.jpg';
  if (/桌游|游戏/.test(title)) return '/assets/stitch/caper_discover_boardgame.jpg';
  if (/徒步|露营|登山/.test(title)) return '/assets/stitch/caper_home_hiking.jpg';
  return '/assets/stitch/caper_discover_citywalk.jpg';
}
function headerPaddingRight() {
  try {
    const menu = wx.getMenuButtonBoundingClientRect?.();
    const windowWidth = (wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {}).windowWidth;
    if (Number.isFinite(menu?.left) && Number.isFinite(windowWidth) && menu.left >= 0 && menu.left < windowWidth)
      return `${Math.ceil(windowWidth - menu.left + 8)}px`;
  } catch (_) { /* Keep the native menu clear on older clients. */ }
  return '112px';
}
function shareReason(event, safetyStatus) {
  if (safetyStatus !== 'OPEN') return safetyStatus === 'CLOSED' ? '系统暂停新增邀请，请稍后查看。' : '暂时无法核对服务状态，请稍后重试。';
  if (event.reviewStatus !== 'APPROVED') return '活动内容尚未通过审核，暂不能分享邀请。';
  if (event.riskPaused) return '此活动已暂停招募，暂不能分享邀请。';
  if (!event.recruiting || !event.inviteToken) return '当前活动未开放邀请或邀请码已失效。';
  return '';
}

Page({
  data: { id: '', event: null, display: null, loadState: 'IDLE', message: '',
    statusBarHeight: 24, headerPaddingRight: headerPaddingRight(),
    canShare: false, shareReason: '', sourceToken: '', preparingShare: false, shareSheetOpen: false },
  async onLoad(options) {
    this.hasShown = true;
    this.setData({ id: typeof options?.id === 'string' ? options.id : '',
      statusBarHeight: wx.getSystemInfoSync?.().statusBarHeight || 24,
      headerPaddingRight: headerPaddingRight() });
    await getApp().globalData.ready;
    await this.refresh();
  },
  async onShow() {
    if (this.hasShown) { this.hasShown = false; return; }
    await getApp().globalData.ready;
    await this.refresh();
  },
  async refresh() {
    const id = this.data.id;
    const actor = currentActor();
    const generation = this._loadGeneration = (this._loadGeneration || 0) + 1;
    const previous = this.data.event;
    const previousSource = this.data.sourceToken;
    const previousActor = this._loadedActor;
    this.setData({ loadState: 'LOADING', canShare: false, sourceToken: '', shareSheetOpen: false, message: '' });
    if (!id) return this.setData({ loadState: 'ERROR', event: null, display: null, message: '缺少活动编号，请返回活动详情。' });
    if (!actor) return this.setData({ loadState: 'UNAUTHENTICATED', event: null, display: null, message: '请先登录主办账号。' });
    try {
      const event = await api.get('/events/' + encodeURIComponent(id));
      if (generation !== this._loadGeneration || actor !== currentActor()) return;
      if (event?.id !== id) throw new Error('活动信息不匹配，请重试。');
      if (event.hostId !== actor) {
        this._loadedActor = actor;
        return this.setData({ loadState: 'FORBIDDEN', event: null, display: null,
          message: '只有本活动主办方可以查看邀请卡。' });
      }
      const safety = await api.get('/system/safety').catch(() => ({ status: 'UNKNOWN' }));
      if (generation !== this._loadGeneration || actor !== currentActor()) return;
      const safetyStatus = ['OPEN', 'CLOSED'].includes(safety?.status) ? safety.status : 'UNKNOWN';
      const reason = shareReason(event, safetyStatus);
      const payload = event.payload || {};
      const title = payload.title || '未命名活动';
      const confirmed = Number.isInteger(event.stats?.confirmed) ? event.stats.confirmed : null;
      const minimum = Number.isInteger(payload.minParticipants) ? payload.minParticipants : null;
      const display = { title, date: localDate(payload.startAt), end: localDate(payload.endAt),
        location: [payload.city, payload.venueName].filter(Boolean).join(' · ') || '场地待确认',
        status: { RECRUITING: '招募中', CONFIRMED: '已成局', IN_PROGRESS: '进行中',
          COMPLETED: '已结束', CANCELLED: '已取消', EXPIRED: '未成局' }[event.status] || event.status || '状态待确认',
        confirmed, minimum, cover: coverFor(title, payload.type), inviteToken: reason ? '' : event.inviteToken };
      this._loadedActor = actor;
      this.setData({ event, display, canShare: !reason, shareReason: reason,
        sourceToken: !reason && previousActor === actor && previous?.id === event.id &&
          previous.version === event.version && previous.inviteToken === event.inviteToken ? previousSource : '',
        loadState: 'READY', message: '' });
    } catch (error) {
      if (generation !== this._loadGeneration || actor !== currentActor()) return;
      this.setData({ loadState: 'ERROR', event: null, display: null, canShare: false, sourceToken: '',
        message: error.message || '邀请卡读取失败，请重试。' });
    }
  },
  openShareSheet() {
    if (!this.data.canShare) return this.setData({ message: this.data.shareReason || '当前无法分享邀请。' });
    this.setData({ shareSheetOpen: true });
  },
  closeShareSheet() { this.setData({ shareSheetOpen: false }); },
  async prepareShare() {
    const event = this.data.event;
    const actor = currentActor();
    if (this.data.preparingShare) return;
    if (!this.data.canShare || !event?.inviteToken || actor !== this._loadedActor)
      return this.setData({ message: this.data.shareReason || '当前无法准备分享。' });
    const sourceToken = newSourceToken();
    this.setData({ preparingShare: true, sourceToken: '' });
    try {
      await api.post(`/events/${encodeURIComponent(event.id)}/share-intents`, { expectedVersion: event.version, sourceToken });
      if (actor === currentActor() && this._loadedActor === actor && this.data.canShare &&
        this.data.event?.id === event.id && this.data.event.version === event.version &&
        this.data.event.inviteToken === event.inviteToken)
        this.setData({ sourceToken, message: '分享邀请已准备好，请点击微信好友或群聊。' });
    } catch (error) { if (actor === currentActor()) this.setData({ message: error.message || '准备分享失败，请重试。' }); }
    finally { if (actor === currentActor()) this.setData({ preparingShare: false }); }
  },
  copyInvite() {
    const event = this.data.event;
    const actor = currentActor();
    if (!this.data.canShare || !event?.inviteToken || actor !== this._loadedActor)
      return this.setData({ message: this.data.shareReason || '当前邀请码不可复制。' });
    const title = this.data.display?.title || '活动';
    const data = `耍起 CAPER 活动邀请：${title}\n邀请码：${event.inviteToken}\n请打开耍起 CAPER 小程序，在首页输入邀请码查看活动并按规则报名。`;
    wx.setClipboardData({ data,
      success: () => { if (actor === currentActor()) this.setData({ message: '真实邀请码与使用说明已复制。' }); },
      fail: () => { if (actor === currentActor()) this.setData({ message: '复制失败，请重试。' }); } });
  },
  back() {
    wx.navigateBack({ delta: 1, fail: () => wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(this.data.id) }) });
  },
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); },
  onShareAppMessage() {
    const event = this.data.event;
    if (!this.data.canShare || !this.data.sourceToken || !event?.inviteToken ||
      this._loadedActor !== currentActor()) return { title: '活动详情', path: '/pages/index/index' };
    return { title: (event.aiSuggestionGenerated ? '【曾生成 AI 建议】' : '') + this.data.display.title,
      path: '/pages/event/event?token=' + encodeURIComponent(event.inviteToken) + '&source=' + this.data.sourceToken };
  }
});
