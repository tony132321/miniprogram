Page({
  data: { statusBarHeight: 24 },
  onLoad() { this.setData({ statusBarHeight: wx.getSystemInfoSync?.().statusBarHeight || 24 }); },
  goHome() { wx.switchTab({ url: '/pages/index/index' }); },
  goDiscover() { wx.switchTab({ url: '/pages/discover/discover' }); },
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); },
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); },
  goReleaseNotes() { wx.navigateTo({ url: '/subpackages/profile/release-notes/release-notes' }); },
  goGuidelines() { wx.navigateTo({ url: '/subpackages/profile/guidelines/guidelines' }); },
  goOpenSource() { wx.navigateTo({ url: '/subpackages/profile/open-source/open-source' }); },
  back() { wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/me/me' }) }); }
});
