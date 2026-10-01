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

function headerPaddingRight() {
  try {
    const menu = wx.getMenuButtonBoundingClientRect?.();
    const width = (wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {}).windowWidth;
    if (Number.isFinite(menu?.left) && Number.isFinite(width) && menu.left >= 0 && menu.left < width)
      return `${Math.ceil(width - menu.left + 8)}px`;
  } catch (_) { /* Keep space for the native menu on older clients. */ }
  return '112px';
}

function statusBarHeight() {
  try {
    if (typeof wx.getSystemInfoSync === 'function') return wx.getSystemInfoSync().statusBarHeight || 20;
  } catch (_) { /* Keep a usable header if system metrics are unavailable. */ }
  return 20;
}

Page({
  data: { statusBarHeight: statusBarHeight(), headerPaddingRight: headerPaddingRight(), currentCity: defaultCity, query: '',
    visibleCities: cities, cityGroups: groupsFor(cities), letters: groupsFor(cities).map(group => group.letter),
    searchFocused: false, popularCities },
  onShow() {
    this.setData({ currentCity: selectedCity(wx), headerPaddingRight: headerPaddingRight() });
  },
  search(event) {
    const query = String(event.detail.value || '').trim().toLowerCase();
    const visibleCities = query ? searchableCities.filter(city => city.name.includes(query) ||
      city.province.includes(query) || city.pinyin.includes(query)) : cities;
    const cityGroups = groupsFor(visibleCities);
    this.setData({ query, visibleCities, cityGroups, letters: cityGroups.map(group => group.letter) });
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
    if (typeof wx.createSelectorQuery !== 'function') {
      wx.pageScrollTo({ selector: '#city-group-' + letter, duration: 250 });
      return;
    }
    const geometry = wx.createSelectorQuery();
    geometry.select('#city-group-' + letter).boundingClientRect();
    geometry.select('.city-search-sticky').boundingClientRect();
    geometry.selectViewport().scrollOffset();
    geometry.exec(([target, sticky, viewport]) => {
      if (!Number.isFinite(target?.top) || !Number.isFinite(sticky?.bottom) ||
          !Number.isFinite(viewport?.scrollTop)) return;
      wx.pageScrollTo({ scrollTop: Math.max(0, viewport.scrollTop + target.top - sticky.bottom - 4), duration: 250 });
    });
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
