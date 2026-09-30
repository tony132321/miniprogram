const cities = [
  ['鞍山', '辽宁', 'anshan'], ['安庆', '安徽', 'anqing'], ['安阳', '河南', 'anyang'],
  ['北京', '首都', 'beijing', '直辖市'], ['保定', '河北', 'baoding'],
  ['包头', '内蒙古', 'baotou'], ['蚌埠', '安徽', 'bengbu'],
  ['成都', '四川', 'chengdu', '潮人聚集'], ['重庆', '直辖市', 'chongqing'],
  ['长沙', '湖南', 'changsha'], ['常州', '江苏', 'changzhou'],
  ['大连', '辽宁', 'dalian'], ['东莞', '广东', 'dongguan'], ['大庆', '黑龙江', 'daqing'],
  ['广州', '广东', 'guangzhou'], ['贵阳', '贵州', 'guiyang'], ['桂林', '广西', 'guilin'],
  ['杭州', '浙江', 'hangzhou'], ['合肥', '安徽', 'hefei'],
  ['哈尔滨', '黑龙江', 'haerbin'], ['海口', '海南', 'haikou'],
  ['南京', '江苏', 'nanjing'], ['宁波', '浙江', 'ningbo'],
  ['南昌', '江西', 'nanchang'], ['南宁', '广西', 'nanning'],
  ['上海', '上海', 'shanghai'], ['深圳', '广东', 'shenzhen'],
  ['苏州', '江苏', 'suzhou'], ['沈阳', '辽宁', 'shenyang'], ['石家庄', '河北', 'shijiazhuang'],
  ['武汉', '湖北', 'wuhan'], ['无锡', '江苏', 'wuxi'],
  ['温州', '浙江', 'wenzhou'], ['乌鲁木齐', '新疆', 'wulumuqi']
].map(([name, province, pinyin, badge]) => ({ name, province, pinyin, badge: badge || '' }));
// Existing local city choices remain searchable although the reference image only lists the groups above.
const extraCities = [
  ['长春', '吉林', 'changchun'], ['佛山', '广东', 'foshan'], ['福州', '福建', 'fuzhou'],
  ['济南', '山东', 'jinan'], ['青岛', '山东', 'qingdao'], ['天津', '天津', 'tianjin'],
  ['西安', '陕西', 'xian'], ['厦门', '福建', 'xiamen']
].map(([name, province, pinyin]) => ({ name, province, pinyin, badge: '' }));
const searchableCities = cities.concat(extraCities);
const popularCities = ['上海', '北京', '深圳', '广州', '杭州', '成都', '武汉', '南京', '厦门', '苏州'];

function groupsFor(list) {
  const groups = [];
  for (const city of list) {
    const letter = city.pinyin[0].toUpperCase();
    let group = groups[groups.length - 1];
    if (!group || group.letter !== letter) {
      group = { letter, items: [] };
      groups.push(group);
    }
    group.items.push(city);
  }
  return groups;
}

function statusBarHeight() {
  try {
    if (typeof wx.getSystemInfoSync === 'function') return wx.getSystemInfoSync().statusBarHeight || 20;
  } catch (_) { /* Keep a usable header if system metrics are unavailable. */ }
  return 20;
}

Page({
  data: { statusBarHeight: statusBarHeight(), currentCity: '上海', query: '',
    visibleCities: cities, cityGroups: groupsFor(cities), letters: groupsFor(cities).map(group => group.letter),
    searchFocused: false, popularCities },
  onShow() {
    const city = wx.getStorageSync('irlSelectedCity');
    this.setData({ currentCity: searchableCities.some(item => item.name === city) ? city : '上海' });
  },
  search(event) {
    const query = String(event.detail.value || '').trim().toLowerCase();
    const visibleCities = query ? searchableCities.filter(city => city.name.includes(query) ||
      city.province.includes(query) || city.pinyin.includes(query)) : cities;
    const cityGroups = groupsFor(visibleCities);
    this.setData({ query, visibleCities, cityGroups, letters: cityGroups.map(group => group.letter), searchFocused: false });
  },
  clearSearch() { this.setData({ query: '', visibleCities: cities, cityGroups: groupsFor(cities),
    letters: groupsFor(cities).map(group => group.letter), searchFocused: true }); },
  selectCity(event) {
    const city = event.currentTarget.dataset.city;
    if (!searchableCities.some(item => item.name === city)) return;
    wx.setStorageSync('irlSelectedCity', city);
    this.setData({ currentCity: city });
    this.back();
  },
  jumpToLetter(event) {
    const letter = event.currentTarget.dataset.letter;
    if (!this.data.letters.includes(letter)) return;
    wx.pageScrollTo({ selector: '#city-group-' + letter, duration: 250 });
  },
  locationHint() {
    wx.showToast({ title: '请在列表中手动选择城市', icon: 'none' });
  },
  searchMoreCities() {
    this.clearSearch();
    wx.pageScrollTo({ scrollTop: 0, duration: 250 });
  },
  showCityInfo() {
    wx.showModal({ title: '城市浏览偏好', content: '当前仅支持手动选择城市，保存于本机。活动的实际地点和状态请以活动详情为准。', showCancel: false });
  },
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); },
  back() { wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/index/index' }) }); }
});
