const inspirationCards = [
  { title: '城市漫步', subtitle: '把周末还给真实风景', image: '/assets/stitch/caper_discover_citywalk.jpg', tag: '城市 · 户外' },
  { title: '周末篮球', subtitle: '约上球友，痛快打一场', image: '/assets/stitch/caper_discover_basketball.jpg', tag: '运动 · 球局' },
  { title: '咖啡聊天', subtitle: '从一杯咖啡开始认识彼此', image: '/assets/stitch/caper_discover_coffee.jpg', tag: '美食 · 社交' },
  { title: '桌游之夜', subtitle: '一起开局，一起笑出声', image: '/assets/stitch/caper_discover_boardgame.jpg', tag: '兴趣 · 桌游' }
];
const categories = ['全部', '附近', '本周', '运动', '文艺', '美食', '职场', '兴趣', '生活', '公益'];
Page({
  data: {
    statusBarHeight: typeof wx.getSystemInfoSync === 'function'
      ? wx.getSystemInfoSync().statusBarHeight || 20 : 20,
    city: '上海', categories, inspirationCards,
    discoveryEnabled: false, publicItems: [],
    tokenInput: '', message: '', availabilityMessage: ''
  },
  onShow() {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.setData({ selected: 1 });
    const city = wx.getStorageSync('irlSelectedCity');
    this.setData({ city: typeof city === 'string' && city ? city : '上海' });
  },
  openCity() { wx.navigateTo({ url: '/pages/city/city' }); },
  goHome() { wx.switchTab({ url: '/pages/index/index' }); },
  goMessages() { wx.switchTab({ url: '/pages/messages/messages' }); },
  showUnavailable() {
    this.setData({ availabilityMessage: '公开找局暂未开放。收到邀请可用口令进入，或先发起自己的活动。' });
  },
  tokenChanged(event) { this.setData({ tokenInput: event.detail.value.trim(), message: '' }); },
  openInvite() {
    if (!this.data.tokenInput) return this.setData({ message: '请输入邀请口令' });
    wx.navigateTo({ url: '/pages/event/event?token=' + encodeURIComponent(this.data.tokenInput) });
  },
  goCreate() { wx.switchTab({ url: '/pages/create/create' }); }
});
