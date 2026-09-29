const { backToProfile, statusBarHeight } = require('../navigation.js');
Page({
  data: { statusBarHeight: 24, message: '' },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  back: backToProfile,
  copyRepository() {
    wx.setClipboardData({ data: 'https://github.com/tony132321/miniprogram',
      success: () => this.setData({ message: '仓库地址已复制。' }),
      fail: () => this.setData({ message: '复制失败，请稍后重试。' }) });
  }
});
