const config = require('./config.js');
const { api } = require('./utils/api.js');
App({
  globalData: { ready: Promise.resolve() },
  onLaunch() {
    if (!config.developmentUser && !wx.getStorageSync('sessionToken') && !wx.getStorageSync('sessionSignedOut')) {
      this.globalData.ready = api.login().catch(error => {
        wx.showToast({ title: error.message || '登录失败', icon: 'none' });
      });
    }
  }
});
