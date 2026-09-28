Page({
  data: {
    city: '上海', keyword: '', category: '全部',
    categories: ['全部', '运动', '桌游', '咖啡', '艺术', '城市漫步'],
    tokenInput: '', message: ''
  },
  onShow() {
    const city = wx.getStorageSync('irlSelectedCity');
    this.setData({ city: typeof city === 'string' && city ? city : '上海' });
  },
  keywordChanged(event) { this.setData({ keyword: event.detail.value }); },
  chooseCategory(event) { this.setData({ category: event.currentTarget.dataset.category }); },
  openCity() { wx.navigateTo({ url: '/pages/city/city' }); },
  tokenChanged(event) { this.setData({ tokenInput: event.detail.value.trim(), message: '' }); },
  openInvite() {
    if (!this.data.tokenInput) return this.setData({ message: '请输入邀请口令' });
    wx.navigateTo({ url: '/pages/event/event?token=' + encodeURIComponent(this.data.tokenInput) });
  },
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); }
});
