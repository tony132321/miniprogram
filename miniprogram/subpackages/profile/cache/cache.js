const { backToProfile, statusBarHeight } = require('../navigation.js');
Page({
  data: { statusBarHeight: 24, storageSize: '', usagePercent: 0, storageState: 'IDLE' },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  onShow() { this.refreshStorage(); },
  refreshStorage() {
    try {
      const info = wx.getStorageInfoSync();
      const size = Number(info.currentSize);
      const limit = Number(info.limitSize);
      this.setData({ storageSize: Number.isFinite(size) ? (size / 1024).toFixed(2) + ' MB' : '',
        usagePercent: Number.isFinite(size) && Number.isFinite(limit) && limit > 0
          ? Math.min(100, Math.max(0, Math.round(size / limit * 100))) : 0, storageState: 'READY' });
    } catch { this.setData({ storageSize: '', usagePercent: 0, storageState: 'UNAVAILABLE' }); }
  },
  back: backToProfile
});
