const { backToProfile, statusBarHeight } = require('../navigation.js');

Page({
  data: { statusBarHeight: 24, city: '上海' },
  onLoad(options) {
    this._focusInterests = options?.focus === 'interests';
    this.setData({ statusBarHeight: statusBarHeight() });
  },
  onReady() {
    if (this._focusInterests) wx.pageScrollTo?.({ selector: '#interestInfoSection', duration: 180 });
  },
  onShow() { this.setData({ city: wx.getStorageSync('irlSelectedCity') || '上海' }); },
  back: backToProfile,
  goCity() { wx.navigateTo({ url: '/pages/city/city' }); },
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); },
  goPrivacyRequests() {
    getApp().globalData.profileFocus = 'privacySection';
    this.goProfile();
  }
});
