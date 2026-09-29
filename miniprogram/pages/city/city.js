const cities = [
  ['鞍山', '辽宁', 'anshan'], ['安庆', '安徽', 'anqing'], ['安阳', '河南', 'anyang'],
  ['北京', '北京', 'beijing'], ['保定', '河北', 'baoding'], ['成都', '四川', 'chengdu'],
  ['重庆', '重庆', 'chongqing'], ['长春', '吉林', 'changchun'], ['长沙', '湖南', 'changsha'],
  ['大连', '辽宁', 'dalian'], ['东莞', '广东', 'dongguan'], ['佛山', '广东', 'foshan'],
  ['福州', '福建', 'fuzhou'], ['广州', '广东', 'guangzhou'], ['贵阳', '贵州', 'guiyang'],
  ['杭州', '浙江', 'hangzhou'], ['合肥', '安徽', 'hefei'], ['济南', '山东', 'jinan'],
  ['南京', '江苏', 'nanjing'], ['宁波', '浙江', 'ningbo'], ['青岛', '山东', 'qingdao'],
  ['上海', '上海', 'shanghai'], ['深圳', '广东', 'shenzhen'], ['沈阳', '辽宁', 'shenyang'],
  ['苏州', '江苏', 'suzhou'], ['天津', '天津', 'tianjin'], ['武汉', '湖北', 'wuhan'],
  ['无锡', '江苏', 'wuxi'], ['西安', '陕西', 'xian'], ['厦门', '福建', 'xiamen']
].map(([name, province, pinyin]) => ({ name, province, pinyin }))
  .sort((a, b) => a.pinyin.localeCompare(b.pinyin));
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
    visibleCities: cities, cityGroups: groupsFor(cities), popularCities },
  onShow() {
    const city = wx.getStorageSync('irlSelectedCity');
    this.setData({ currentCity: typeof city === 'string' && city ? city : '上海' });
  },
  search(event) {
    const query = String(event.detail.value || '').trim().toLowerCase();
    const visibleCities = query ? cities.filter(city => city.name.includes(query) ||
      city.province.includes(query) || city.pinyin.includes(query)) : cities;
    this.setData({ query, visibleCities, cityGroups: groupsFor(visibleCities) });
  },
  clearSearch() { this.setData({ query: '', visibleCities: cities, cityGroups: groupsFor(cities) }); },
  selectCity(event) {
    const city = event.currentTarget.dataset.city;
    if (!cities.some(item => item.name === city)) return;
    wx.setStorageSync('irlSelectedCity', city);
    this.setData({ currentCity: city });
    wx.navigateBack();
  },
  back() { wx.navigateBack(); }
});
