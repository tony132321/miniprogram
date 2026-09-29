const { backToProfile, statusBarHeight } = require('../navigation.js');
Page({
  data: { statusBarHeight: 24 },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  back: backToProfile,
  goReport() { wx.switchTab({ url: '/pages/me/me' }); }
});
