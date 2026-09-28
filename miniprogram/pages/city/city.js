const cities = [
  { name: '北京', province: '北京' }, { name: '长春', province: '吉林' }, { name: '成都', province: '四川' },
  { name: '重庆', province: '重庆' }, { name: '大连', province: '辽宁' }, { name: '东莞', province: '广东' },
  { name: '佛山', province: '广东' }, { name: '福州', province: '福建' }, { name: '广州', province: '广东' },
  { name: '贵阳', province: '贵州' }, { name: '杭州', province: '浙江' }, { name: '合肥', province: '安徽' },
  { name: '济南', province: '山东' }, { name: '南京', province: '江苏' }, { name: '宁波', province: '浙江' },
  { name: '青岛', province: '山东' }, { name: '上海', province: '上海' }, { name: '深圳', province: '广东' },
  { name: '沈阳', province: '辽宁' }, { name: '苏州', province: '江苏' }, { name: '天津', province: '天津' },
  { name: '武汉', province: '湖北' }, { name: '无锡', province: '江苏' }, { name: '西安', province: '陕西' },
  { name: '厦门', province: '福建' }
];
Page({
  data: { currentCity: '上海', query: '', visibleCities: cities, popularCities: ['上海', '北京', '深圳', '广州', '杭州', '成都', '武汉', '南京', '厦门', '苏州'] },
  onShow() {
    const city = wx.getStorageSync('irlSelectedCity');
    this.setData({ currentCity: typeof city === 'string' && city ? city : '上海' });
  },
  search(event) {
    const query = event.detail.value.trim();
    this.setData({ query, visibleCities: query ? cities.filter(city => city.name.includes(query) || city.province.includes(query)) : cities });
  },
  selectCity(event) {
    const city = event.currentTarget.dataset.city;
    if (!cities.some(item => item.name === city)) return;
    wx.setStorageSync('irlSelectedCity', city);
    this.setData({ currentCity: city });
    wx.navigateBack();
  },
  back() { wx.navigateBack(); }
});
