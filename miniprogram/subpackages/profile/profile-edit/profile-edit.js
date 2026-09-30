const { backToProfile, statusBarHeight } = require('../navigation.js');

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
  data: { statusBarHeight: 24, headerPaddingRight: '112px', moreOpen: false, city: '上海' },
  onLoad(options) {
    this._focusInterests = options?.focus === 'interests';
    this.setData({ statusBarHeight: statusBarHeight(), headerPaddingRight: headerPaddingRight() });
  },
  onReady() {
    if (this._focusInterests) wx.pageScrollTo?.({ selector: '#interestInfoSection', duration: 180 });
  },
  onShow() { this.setData({ city: wx.getStorageSync('irlSelectedCity') || '上海',
    headerPaddingRight: headerPaddingRight() }); },
  onHide() { this.setData({ moreOpen: false }); },
  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },
  back: backToProfile,
  goCity() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/pages/city/city' }); },
  goProfile() { this.setData({ moreOpen: false }); wx.switchTab({ url: '/pages/me/me' }); },
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
