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
  onLoad() { this.setData({ statusBarHeight: wx.getSystemInfoSync?.().statusBarHeight || 24,
    headerPaddingRight: headerPaddingRight() }); },
  onShow() { this.setData({ headerPaddingRight: headerPaddingRight() }); },
  onHide() { this.setData({ moreOpen: false }); },
  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },
  goHome() { wx.switchTab({ url: '/pages/index/index' }); },
  goDiscover() { wx.switchTab({ url: '/pages/discover/discover' }); },
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); },
  goProfile() { this.setData({ moreOpen: false }); wx.switchTab({ url: '/pages/me/me' }); },
  goReleaseNotes() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/subpackages/profile/release-notes/release-notes' }); },
  goGuidelines() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/subpackages/profile/guidelines/guidelines' }); },
  goOpenSource() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/subpackages/profile/open-source/open-source' }); },
  back() { wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/me/me' }) }); }
});
