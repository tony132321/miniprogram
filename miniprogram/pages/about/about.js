Page({
  goHome() { wx.switchTab({ url: '/pages/index/index' }); },
  goDiscover() { wx.switchTab({ url: '/pages/discover/discover' }); },
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); }
});
