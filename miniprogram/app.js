const config = require('./config.js');
const { api } = require('./utils/api.js');
const { loadReferenceFonts } = require('./utils/reference-fonts.js');
App({
  globalData: { ready: Promise.resolve() },
  onLaunch() {
    if (!config.developmentUser && !wx.getStorageSync('sessionToken') && !wx.getStorageSync('sessionSignedOut')) {
      this.globalData.ready = api.login().catch(error => {
        wx.showToast({ title: error.message || '登录失败', icon: 'none' });
      });
    }
    this.globalData.referenceFonts = loadReferenceFonts(wx);
  }
});
