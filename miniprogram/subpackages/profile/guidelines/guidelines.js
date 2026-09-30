const { backToProfile, statusBarHeight } = require('../navigation.js');
const config = require('../../../config.js');
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
  data: { statusBarHeight: 24, headerPaddingRight: '112px', moreOpen: false },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight(), headerPaddingRight: headerPaddingRight() }); },
  onShow() { this.setData({ headerPaddingRight: headerPaddingRight() }); },
  onHide() { this.setData({ moreOpen: false }); },
  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },
  goAbout() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/pages/about/about' }); },
  goProfile() { this.setData({ moreOpen: false }); wx.switchTab({ url: '/pages/me/me' }); },
  back: backToProfile,
  onShareAppMessage() {
    return { title: 'Project IRL · 社区引导与线下社交守则',
      path: '/subpackages/profile/guidelines/guidelines' };
  },
  goReport() {
    wx.setStorageSync('irlProfileFocusIntent', 'reportSection');
    const token = wx.getStorageSync('sessionToken');
    const actor = token ? wx.getStorageSync('userId')
      : (wx.getStorageSync('devUser') || config.developmentUser || '');
    if (actor) getApp().globalData.reportContext = {
      actor, owner: token ? `session:${actor}:${token}` : `dev:${actor}`, eventId: '' };
    wx.switchTab({ url: '/pages/me/me' });
  }
});
