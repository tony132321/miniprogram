function statusBarHeight() {
  try { return wx.getSystemInfoSync?.().statusBarHeight || 24; } catch { return 24; }
}

function backToProfile() {
  wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/me/me' }) });
}

module.exports = { statusBarHeight, backToProfile };
