const { backToProfile, statusBarHeight } = require('../navigation.js');
const { defaultCity, selectedCity } = require('../../../utils/city.js');
const aliasMemberStatuses = new Set(['CONFIRMED', 'RECONFIRM_REQUIRED', 'WAITLISTED', 'OFFERED']);

function aliasSessionIdentity() {
  const token = wx.getStorageSync?.('sessionToken') || '';
  if (token) return `session:${JSON.stringify([wx.getStorageSync?.('userId') || '', token])}`;
  const config = require('../../../config.js');
  const devUser = config.developmentUser ?
    (wx.getStorageSync?.('devUser') || config.developmentUser) : '';
  return devUser ? `dev:${devUser}` : '';
}

function headerPaddingRight() {
  try {
    const menu = wx.getMenuButtonBoundingClientRect?.();
    const width = (wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {}).windowWidth;
    if (Number.isFinite(menu?.left) && Number.isFinite(width) && menu.left >= 0 && menu.left < width)
      return `${Math.ceil(width - menu.left + 8)}px`;
  } catch (_) { /* Keep native capsule space on older clients. */ }
  return '112px';
}

Page({
  data: { statusBarHeight: 24, headerPaddingRight: '112px', moreOpen: false, city: defaultCity,
    aliasPickerOpen: false, aliasLoadState: 'IDLE', aliasCandidates: [], aliasError: '' },
  onLoad(options) {
    this._focusInterests = options?.focus === 'interests';
    this.setData({ statusBarHeight: statusBarHeight(), headerPaddingRight: headerPaddingRight() });
  },
  onReady() {
    if (this._focusInterests) wx.pageScrollTo?.({ selector: '#interestInfoSection', duration: 180 });
  },
  onShow() {
    if (this.data.aliasPickerOpen && this._aliasIdentity !== aliasSessionIdentity()) this.closeAliasPicker();
    this.setData({ city: selectedCity(wx), headerPaddingRight: headerPaddingRight() });
  },
  onHide() { this.closeAliasPicker(); this.setData({ moreOpen: false }); },
  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },
  back: backToProfile,
  async openAliasPicker() {
    const identity = aliasSessionIdentity();
    const requestId = this._aliasRequestId = (this._aliasRequestId || 0) + 1;
    this._aliasIdentity = identity;
    this.setData({ aliasPickerOpen: true, aliasLoadState: identity ? 'LOADING' : 'UNAUTHENTICATED',
      aliasCandidates: [], aliasError: '' });
    if (!identity) return;
    const stillCurrent = () => this._aliasRequestId === requestId &&
      this._aliasIdentity === identity && this.data.aliasPickerOpen && aliasSessionIdentity() === identity;
    const discardChangedIdentity = () => {
      if (this._aliasRequestId === requestId && this._aliasIdentity === identity &&
        aliasSessionIdentity() !== identity) this.closeAliasPicker();
    };
    try {
      await getApp().globalData.ready;
      if (!stillCurrent()) { discardChangedIdentity(); return; }
      const response = await require('../../../utils/api.js').api.get('/me/events');
      if (!stillCurrent()) { discardChangedIdentity(); return; }
      if (!Array.isArray(response?.items)) throw new Error('活动列表无效，请重试');
      const candidates = response.items.filter(item => item && typeof item.id === 'string' && item.id &&
        (item.isHost === true || aliasMemberStatuses.has(item.myRegistrationStatus)))
        .map(item => ({ id: item.id, title: item.title || '未命名活动',
          role: item.isHost ? '主办方' : '当前活动成员' }));
      this.setData({ aliasCandidates: candidates, aliasLoadState: candidates.length ? 'READY' : 'EMPTY' });
    } catch (error) {
      if (!stillCurrent()) { discardChangedIdentity(); return; }
      this.setData({ aliasCandidates: [], aliasLoadState: 'ERROR',
        aliasError: error?.message || '活动列表加载失败，请重试' });
    }
  },
  closeAliasPicker() {
    this._aliasRequestId = (this._aliasRequestId || 0) + 1;
    this._aliasIdentity = '';
    this.setData({ aliasPickerOpen: false, aliasLoadState: 'IDLE', aliasCandidates: [], aliasError: '' });
  },
  goAliasActivity(event) {
    if (this._aliasIdentity !== aliasSessionIdentity()) { this.closeAliasPicker(); return; }
    if (!this.data.aliasPickerOpen || this.data.aliasLoadState !== 'READY') return;
    const candidate = this.data.aliasCandidates.find(item => item.id === event.currentTarget?.dataset?.id);
    if (!candidate) return;
    this.closeAliasPicker();
    wx.navigateTo({ url: `/pages/event/event?id=${encodeURIComponent(candidate.id)}&section=registrationSection&entry=alias` });
  },
  goCity() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/pages/city/city' }); },
  goProfile() { this.setData({ moreOpen: false }); wx.switchTab({ url: '/pages/me/me' }); },
  goActivities() {
    this.closeAliasPicker();
    this.setData({ moreOpen: false });
    wx.navigateTo({ url: '/subpackages/profile/moments/moments?filter=all' });
  },
  goPrivacySafety() {
    this.setData({ moreOpen: false });
    wx.navigateTo({ url: '/subpackages/profile/privacy-safety/privacy-safety' });
  },
  goLegal() {
    this.setData({ moreOpen: false });
    wx.navigateTo({ url: '/subpackages/profile/legal/legal' });
  },
  goPrivacyRequests() {
    getApp().globalData.profileFocus = 'privacySection';
    this.goProfile();
  }
});
