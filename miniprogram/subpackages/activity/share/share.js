const { api } = require('../../../utils/api.js');
const config = require('../../../config.js');
const qrcode = require('../../../vendor/qrcode.js');

function drawInviteQr(token, context) {
  const size = 200;
  const qr = qrcode(0, 'M');
  qr.addData(token);
  qr.make();
  const count = qr.getModuleCount();
  const unit = size / (count + 8);
  context.setFillStyle('#fff');
  context.fillRect(0, 0, size, size);
  context.setFillStyle('#111');
  for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) {
    if (qr.isDark(y, x)) context.fillRect(Math.floor((x + 4) * unit), Math.floor((y + 4) * unit),
      Math.ceil((x + 5) * unit) - Math.floor((x + 4) * unit),
      Math.ceil((y + 5) * unit) - Math.floor((y + 4) * unit));
  }
  context.draw(false);
}

function currentActor() {
  return wx.getStorageSync('sessionToken') ? wx.getStorageSync('userId')
    : wx.getStorageSync('devUser') || config.developmentUser || '';
}
function currentIdentity() {
  const session = wx.getStorageSync('sessionToken');
  return session ? JSON.stringify(['session', session, wx.getStorageSync('userId')])
    : JSON.stringify(['development', wx.getStorageSync('devUser') || config.developmentUser || '']);
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
function registrationDeadlineReason(event, now) {
  const deadline = Date.parse(event?.payload?.registrationDeadline || '');
  if (!Number.isFinite(deadline)) return '报名截止时间无法核对，暂不能分享邀请。';
  if (now >= deadline) return '报名已截止，当前邀请码不可复制。';
  return '';
}
function shareReason(event, safetyStatus) {
  if (safetyStatus !== 'OPEN') return safetyStatus === 'CLOSED' ? '系统暂停新增邀请，请稍后查看。' : '暂时无法核对服务状态，请稍后重试。';
  if (event.reviewStatus !== 'APPROVED') return '活动内容尚未通过审核，暂不能分享邀请。';
  if (event.riskPaused) return '此活动已暂停招募，暂不能分享邀请。';
  if (!event.recruiting || !event.inviteToken) return '当前活动未开放邀请或邀请码已失效。';
  const deadlineReason = registrationDeadlineReason(event, Date.now());
  if (deadlineReason) return deadlineReason;
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
    if (options?.copy === '1' && this.data.loadState === 'READY' && this.data.canShare)
      await this.copyInvite();
  },
  async onShow() {
    if (this.hasShown) { this.hasShown = false; return; }
    await getApp().globalData.ready;
    await this.refresh();
  },
  onHide() { this.clearInviteDeadlineTimer(); },
  onUnload() { this.clearInviteDeadlineTimer(); },
  async refresh() {
    this.clearInviteDeadlineTimer();
    const id = this.data.id;
    const actor = currentActor();
    const identity = currentIdentity();
    const generation = this._loadGeneration = (this._loadGeneration || 0) + 1;
    const previous = this.data.event;
    const previousSource = this.data.sourceToken;
    const previousActor = this._loadedActor;
    const previousIdentity = this._loadedIdentity;
    this.setData({ loadState: 'LOADING', canShare: false, sourceToken: '', shareSheetOpen: false, message: '',
      ...(previousIdentity && previousIdentity !== identity ? { event: null, display: null } : {}) });
    if (!id) return this.setData({ loadState: 'ERROR', event: null, display: null, message: '缺少活动编号，请返回活动详情。' });
    if (!actor) return this.setData({ loadState: 'UNAUTHENTICATED', event: null, display: null, message: '请先登录主办账号。' });
    try {
      const event = await api.get('/events/' + encodeURIComponent(id));
      if (generation !== this._loadGeneration) return;
      if (identity !== currentIdentity()) return this.clearIfAccountChanged();
      if (event?.id !== id) throw new Error('活动信息不匹配，请重试。');
      if (event.hostId !== actor) {
        this._loadedActor = actor;
        this._loadedIdentity = identity;
        return this.setData({ loadState: 'FORBIDDEN', event: null, display: null,
          message: '只有本活动主办方可以查看邀请卡。' });
      }
      const safety = await api.get('/system/safety').catch(() => ({ status: 'UNKNOWN' }));
      if (generation !== this._loadGeneration) return;
      if (identity !== currentIdentity()) return this.clearIfAccountChanged();
      const safetyStatus = ['OPEN', 'CLOSED'].includes(safety?.status) ? safety.status : 'UNKNOWN';
      const reason = shareReason(event, safetyStatus);
      const payload = event.payload || {};
      const title = payload.title || '未命名活动';
      const confirmed = Number.isInteger(event.stats?.confirmed) ? event.stats.confirmed : null;
      const minimum = Number.isInteger(payload.minParticipants) ? payload.minParticipants : null;
      const display = { title, date: localDate(payload.startAt), end: localDate(payload.endAt),
        location: [payload.city, '具体地点请在活动详情核对'].filter(Boolean).join(' · '),
        status: { RECRUITING: '招募中', CONFIRMED: '已成局', IN_PROGRESS: '进行中',
          COMPLETED: '已结束', CANCELLED: '已取消', EXPIRED: '未成局' }[event.status] || event.status || '状态待确认',
        confirmed, minimum, cover: coverFor(title, payload.type), inviteToken: reason ? '' : event.inviteToken };
      this._loadedActor = actor;
      this._loadedIdentity = identity;
      this.setData({ event, display, canShare: !reason, shareReason: reason,
        sourceToken: !reason && previousActor === actor && previousIdentity === identity && previous?.id === event.id &&
          previous.version === event.version && previous.inviteToken === event.inviteToken ? previousSource : '',
        loadState: 'READY', message: '' });
      if (!reason) {
        this.scheduleInviteDeadline(event, generation, identity);
        const draw = () => {
          if (generation !== this._loadGeneration) return;
          if (identity !== currentIdentity()) return this.clearIfAccountChanged();
          if (!this.data.canShare || this.data.event?.inviteToken !== event.inviteToken) return;
          try { drawInviteQr(event.inviteToken, wx.createCanvasContext('inviteQr', this)); }
          catch (_) { this.setData({ message: '二维码暂不可用，请复制邀请码发送。' }); }
        };
        if (typeof wx.nextTick === 'function') wx.nextTick(draw);
        else draw();
      }
    } catch (error) {
      if (generation !== this._loadGeneration) return;
      if (identity !== currentIdentity()) return this.clearIfAccountChanged();
      this.setData({ loadState: 'ERROR', event: null, display: null, canShare: false, sourceToken: '',
        message: error.message || '邀请卡读取失败，请重试。' });
    }
  },
  clearIfAccountChanged() {
    if (this._loadedIdentity === currentIdentity()) return false;
    this._loadGeneration = (this._loadGeneration || 0) + 1;
    this._loadedActor = null;
    this._loadedIdentity = null;
    this.setData({ loadState: 'ERROR', event: null, display: null, canShare: false,
      sourceToken: '', shareSheetOpen: false, preparingShare: false,
      message: '账号已切换，请重新核对分享资格。' });
    return true;
  },
  clearInviteDeadlineTimer() {
    clearTimeout(this.inviteDeadlineTimer);
    this.inviteDeadlineTimer = null;
  },
  scheduleInviteDeadline(event, generation, identity) {
    const deadline = Date.parse(event.payload?.registrationDeadline || '');
    if (!Number.isFinite(deadline)) return;
    this.inviteDeadlineTimer = setTimeout(() => {
      this.inviteDeadlineTimer = null;
      if (generation !== this._loadGeneration || this.data.event?.id !== event.id) return;
      if (identity !== currentIdentity()) return this.clearIfAccountChanged();
      const reason = registrationDeadlineReason(this.data.event, Date.now());
      if (reason) this.setData({ canShare: false, shareReason: reason, sourceToken: '', shareSheetOpen: false,
        display: this.data.display ? { ...this.data.display, inviteToken: '' } : null });
      else this.scheduleInviteDeadline(event, generation, identity);
    }, Math.max(1, Math.min(deadline - Date.now(), 2_147_483_647)));
    if (typeof this.inviteDeadlineTimer?.unref === 'function') this.inviteDeadlineTimer.unref();
  },
  openShareSheet() {
    if (this.clearIfAccountChanged()) return;
    if (!this.data.canShare) return this.setData({ message: this.data.shareReason || '当前无法分享邀请。' });
    this.setData({ shareSheetOpen: true });
  },
  closeShareSheet() { this.setData({ shareSheetOpen: false }); },
  async prepareShare() {
    if (this.clearIfAccountChanged()) return;
    const event = this.data.event;
    const actor = currentActor();
    const identity = currentIdentity();
    if (this.data.preparingShare) return;
    if (!this.data.canShare || !event?.inviteToken || actor !== this._loadedActor || identity !== this._loadedIdentity)
      return this.setData({ message: this.data.shareReason || '当前无法准备分享。' });
    const sourceToken = newSourceToken();
    this.setData({ preparingShare: true, sourceToken: '' });
    try {
      await api.post(`/events/${encodeURIComponent(event.id)}/share-intents`, { expectedVersion: event.version, sourceToken });
      if (identity === currentIdentity() && this._loadedIdentity === identity && this.data.canShare &&
        this.data.event?.id === event.id && this.data.event.version === event.version &&
        this.data.event.inviteToken === event.inviteToken)
        this.setData({ sourceToken, message: '分享邀请已准备好，请点击微信好友或群聊。' });
    } catch (error) { if (identity === currentIdentity()) this.setData({ message: error.message || '准备分享失败，请重试。' }); }
    finally {
      if (identity !== currentIdentity()) this.clearIfAccountChanged();
      else this.setData({ preparingShare: false });
    }
  },
  async copyInvite() {
    if (this.clearIfAccountChanged()) return;
    if (this._copyInFlight) return;
    const actor = currentActor();
    const identity = currentIdentity();
    const id = this.data.id;
    if (!id || !actor || actor !== this._loadedActor || identity !== this._loadedIdentity)
      return this.setData({ message: '当前邀请码不可复制，请重新核对分享资格。' });
    const generation = (this._loadGeneration || 0) + 1;
    this._copyInFlight = true;
    try {
      await this.refresh();
      if (identity !== currentIdentity() || actor !== currentActor()) {
        this.clearIfAccountChanged();
        return;
      }
      if (generation !== this._loadGeneration || this.data.id !== id) return;
      const event = this.data.event;
      const deadlineReason = registrationDeadlineReason(event, Date.now());
      if (deadlineReason && this.data.loadState === 'READY') {
        this.setData({ canShare: false, shareReason: deadlineReason, sourceToken: '',
          display: this.data.display ? { ...this.data.display, inviteToken: '' } : null,
          message: deadlineReason });
        return;
      }
      if (this.data.loadState !== 'READY' || !this.data.canShare || !event?.inviteToken ||
        event.id !== id || event.hostId !== actor || actor !== this._loadedActor || identity !== this._loadedIdentity) {
        if (this.data.loadState === 'READY')
          this.setData({ message: this.data.shareReason || '当前邀请码不可复制。' });
        return;
      }
      const title = this.data.display?.title || '活动';
      const data = `耍起 CAPER 活动邀请：${title}\n邀请码：${event.inviteToken}\n请打开耍起 CAPER 小程序，在首页输入邀请码查看活动并按规则报名。`;
      const version = event.version;
      const token = event.inviteToken;
      await new Promise(resolve => wx.setClipboardData({ data,
        success: () => {
          if (identity !== currentIdentity()) this.clearIfAccountChanged();
          else if (generation === this._loadGeneration && this.data.event?.id === id &&
            this.data.event.version === version && this.data.event.inviteToken === token)
            this.setData({ message: '真实邀请码与使用说明已复制。' });
          resolve();
        },
        fail: () => {
          if (identity !== currentIdentity()) this.clearIfAccountChanged();
          else if (generation === this._loadGeneration) this.setData({ message: '复制失败，请重试。' });
          resolve();
        } }));
    } catch (_) {
      if (identity !== currentIdentity()) this.clearIfAccountChanged();
      else if (generation === this._loadGeneration)
        this.setData({ message: '暂时无法复制，请重试。' });
    } finally { this._copyInFlight = false; }
  },
  back() {
    wx.navigateBack({ delta: 1, fail: () => wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(this.data.id) }) });
  },
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); },
  onShareAppMessage() {
    if (this.clearIfAccountChanged()) return { title: '活动详情', path: '/pages/index/index' };
    const event = this.data.event;
    if (!this.data.canShare || !this.data.sourceToken || !event?.inviteToken ||
      registrationDeadlineReason(event, Date.now()) ||
      this._loadedActor !== currentActor() || this._loadedIdentity !== currentIdentity())
      return { title: '活动详情', path: '/pages/index/index' };
    return { title: (event.aiSuggestionGenerated ? '【曾生成 AI 建议】' : '') + this.data.display.title,
      path: '/pages/event/event?token=' + encodeURIComponent(event.inviteToken) + '&source=' + this.data.sourceToken };
  }
});
