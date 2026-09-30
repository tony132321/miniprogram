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
  data: { statusBarHeight: 24, headerPaddingRight: '112px', moreOpen: false },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight(), headerPaddingRight: headerPaddingRight() }); },
  onShow() { this.setData({ headerPaddingRight: headerPaddingRight() }); },
  onHide() { this.setData({ moreOpen: false }); },
  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },
  goAbout() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/pages/about/about' }); },
  goProfile() { this.setData({ moreOpen: false }); wx.switchTab({ url: '/pages/me/me' }); },
  back: backToProfile,
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); },
  goActivities() { wx.navigateTo({ url: '/subpackages/profile/moments/moments?filter=all' }); }
});
