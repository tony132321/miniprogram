const { backToProfile, statusBarHeight } = require('../navigation.js');
const config = require('../../../config.js');
Page({
  data: { statusBarHeight: 24 },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  back: backToProfile,
  goReport() {
    const actor = wx.getStorageSync('sessionToken') ? wx.getStorageSync('userId')
      : (wx.getStorageSync('devUser') || config.developmentUser || '');
    getApp().globalData.reportContext = { actor, eventId: '' };
    wx.switchTab({ url: '/pages/me/me' });
  }
});
