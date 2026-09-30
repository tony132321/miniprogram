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
  data: { statusBarHeight: 24, headerPaddingRight: '112px', moreOpen: false, message: '' },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight(), headerPaddingRight: headerPaddingRight() }); },
  onShow() { this.setData({ headerPaddingRight: headerPaddingRight() }); },
  onHide() { this.setData({ moreOpen: false }); },
  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },
  goAbout() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/pages/about/about' }); },
  goProfile() { this.setData({ moreOpen: false }); wx.switchTab({ url: '/pages/me/me' }); },
  back: backToProfile,
  onShareAppMessage() {
    return { title: 'Project IRL · 开源许可与致谢',
      path: '/subpackages/profile/open-source/open-source' };
  },
  copyRepository() {
    wx.setClipboardData({ data: 'https://github.com/tony132321/miniprogram',
      success: () => this.setData({ message: '仓库地址已复制。' }),
      fail: () => this.setData({ message: '复制失败，请稍后重试。' }) });
  }
});
