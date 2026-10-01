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
  onShareAppMessage() {
    return { title: 'Project IRL · 当前服务与隐私说明',
      path: '/subpackages/profile/legal/legal' };
  },
  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },
  goProfile() { this.setData({ moreOpen: false }); wx.switchTab({ url: '/pages/me/me' }); },
  goCache() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/subpackages/profile/cache/cache' }); },
  toggleTextSize() { this.setData({ largeText: !this.data.largeText }); },
  goPermissions() {
    this.setData({ moreOpen: false });
    const fallback = () => wx.pageScrollTo({ selector: '#legalPermissionsSection', duration: 180 });
    if (typeof wx.createSelectorQuery !== 'function') return fallback();
    try {
      const query = wx.createSelectorQuery();
      query.select('#legalPermissionsSection').boundingClientRect();
      query.selectViewport().scrollOffset();
      query.exec(results => {
        const [target, viewport] = results || [];
        const windowWidth = Number(wx.getWindowInfo?.().windowWidth || wx.getSystemInfoSync?.().windowWidth || 375);
        if (!Number.isFinite(target?.top) || !Number.isFinite(viewport?.scrollTop) ||
          !Number.isFinite(windowWidth) || windowWidth <= 0) return fallback();
        const headerOffset = this.data.statusBarHeight + 92 * windowWidth / 750 + 8;
        wx.pageScrollTo({ scrollTop: Math.max(0, viewport.scrollTop + target.top - headerOffset), duration: 180 });
      });
    } catch (_) { fallback(); }
  },
  goPrivacy() {
    this.setData({ moreOpen: false });
    getApp().globalData.profileFocus = 'privacySection';
    wx.switchTab({ url: '/pages/me/me' });
  },
  goGuidelines() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/subpackages/profile/guidelines/guidelines' }); }
});
