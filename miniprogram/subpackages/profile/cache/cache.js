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
  data: { statusBarHeight: 24, headerPaddingRight: '112px', moreOpen: false,
    storageSize: '', storageLimit: '', usagePercent: 0, storageState: 'IDLE' },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight(), headerPaddingRight: headerPaddingRight() }); },
  onShow() { this.setData({ headerPaddingRight: headerPaddingRight() }); this.refreshStorage(); },
  onHide() { this.setData({ moreOpen: false }); },
  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },
  goProfile() { this.setData({ moreOpen: false }); wx.switchTab({ url: '/pages/me/me' }); },
  goLegal() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/subpackages/profile/legal/legal' }); },
  refreshStorage() {
    try {
      const info = wx.getStorageInfoSync();
      const size = Number(info.currentSize);
      const limit = Number(info.limitSize);
      if (!Number.isFinite(size) || size < 0 || !Number.isFinite(limit) || limit <= 0) throw new Error('invalid storage statistics');
      this.setData({ storageSize: (size / 1024).toFixed(2) + ' MB', storageLimit: (limit / 1024).toFixed(2) + ' MB',
        usagePercent: Math.min(100, Math.max(0, Math.round(size / limit * 100))), storageState: 'READY' });
    } catch { this.setData({ storageSize: '', storageLimit: '', usagePercent: 0, storageState: 'UNAVAILABLE' }); }
  },
  goPrivacy() {
    this.setData({ moreOpen: false });
    getApp().globalData.profileFocus = 'privacySection';
    wx.switchTab({ url: '/pages/me/me' });
  },
  back: backToProfile
});
