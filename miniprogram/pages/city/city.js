const { cities, searchableCities, popularCities, defaultCity, selectedCity, isSelectableCity } = require('../../utils/city.js');

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
  data: { statusBarHeight: statusBarHeight(), currentCity: defaultCity, query: '',
    visibleCities: cities, cityGroups: groupsFor(cities), letters: groupsFor(cities).map(group => group.letter),
    searchFocused: false, popularCities },
  onShow() {
    this.setData({ currentCity: selectedCity(wx) });
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
    if (!isSelectableCity(city)) return;
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
