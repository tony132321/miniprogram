const { backToProfile, statusBarHeight } = require('../navigation.js');
function headerPaddingRight() {
  try {
    const menu = wx.getMenuButtonBoundingClientRect?.();
    const width = (wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {}).windowWidth;
    if (Number.isFinite(menu?.left) && Number.isFinite(width) && menu.left >= 0 && menu.left < width)
      return `${Math.ceil(width - menu.left + 8)}px`;
  } catch (_) { /* Keep space for the native menu on older clients. */ }
  return '112px';
}
Page({
  data: { statusBarHeight: 24, headerPaddingRight: '112px', moreOpen: false, largeText: false },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight(), headerPaddingRight: headerPaddingRight() }); },
  onShow() { this.setData({ headerPaddingRight: headerPaddingRight() }); },
  onHide() { this.setData({ moreOpen: false }); },
  back: backToProfile,
  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },
  goProfile() { this.setData({ moreOpen: false }); wx.switchTab({ url: '/pages/me/me' }); },
  goCache() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/subpackages/profile/cache/cache' }); },
  toggleTextSize() { this.setData({ largeText: !this.data.largeText }); },
  goPrivacy() {
    this.setData({ moreOpen: false });
    getApp().globalData.profileFocus = 'privacySection';
    wx.switchTab({ url: '/pages/me/me' });
  },
  goGuidelines() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/subpackages/profile/guidelines/guidelines' }); }
});
