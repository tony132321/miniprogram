const { backToProfile, statusBarHeight } = require('../navigation.js');
Page({
  data: { statusBarHeight: 24 },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  back: backToProfile,
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); },
  goActivities() { wx.switchTab({ url: '/pages/index/index' }); }
});
