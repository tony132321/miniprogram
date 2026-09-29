const { backToProfile, statusBarHeight } = require('../navigation.js');

Page({
  data: { statusBarHeight: 24, city: '上海' },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  onShow() { this.setData({ city: wx.getStorageSync('irlSelectedCity') || '上海' }); },
  back: backToProfile,
  goCity() { wx.navigateTo({ url: '/pages/city/city' }); },
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); }
});
