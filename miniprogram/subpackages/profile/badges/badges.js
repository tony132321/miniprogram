const { backToProfile, statusBarHeight } = require('../navigation.js');
Page({
  data: { statusBarHeight: 24 },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  back: backToProfile,
  goActivities() { wx.switchTab({ url: '/pages/index/index' }); }
});
