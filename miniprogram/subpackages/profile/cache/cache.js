const { backToProfile, statusBarHeight } = require('../navigation.js');
Page({
  data: { statusBarHeight: 24, storageSize: '', storageLimit: '', usagePercent: 0, storageState: 'IDLE' },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  onShow() { this.refreshStorage(); },
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
    getApp().globalData.profileFocus = 'privacySection';
    wx.switchTab({ url: '/pages/me/me' });
  },
  back: backToProfile
});
