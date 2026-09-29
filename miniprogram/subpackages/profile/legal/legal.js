const { backToProfile, statusBarHeight } = require('../navigation.js');
Page({
  data: { statusBarHeight: 24 },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  back: backToProfile,
  goPrivacy() {
    getApp().globalData.profileFocus = 'privacySection';
    wx.switchTab({ url: '/pages/me/me' });
  },
  goGuidelines() { wx.navigateTo({ url: '/subpackages/profile/guidelines/guidelines' }); }
});
