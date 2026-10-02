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
// Preserve selectable cities saved by older versions even when they are not in the main A–Z list.
const extraCities = [
  ['长春', '吉林', 'changchun'], ['佛山', '广东', 'foshan'], ['福州', '福建', 'fuzhou'],
  ['济南', '山东', 'jinan'], ['青岛', '山东', 'qingdao'], ['天津', '天津', 'tianjin'],
  ['西安', '陕西', 'xian'], ['厦门', '福建', 'xiamen']
].map(([name, province, pinyin]) => ({ name, province, pinyin, badge: '' }));
const searchableCities = cities.concat(extraCities);
const popularCities = ['上海', '北京', '深圳', '广州', '杭州', '成都', '武汉', '南京', '厦门', '苏州'];
const cityNames = new Set(searchableCities.map(city => city.name));
const defaultCity = '上海';

function isSelectableCity(city) {
  return typeof city === 'string' && cityNames.has(city);
}

function selectedCity(storage) {
  const saved = storage.getStorageSync('irlSelectedCity');
  if (isSelectableCity(saved)) return saved;
  if (saved !== '' && saved !== undefined && saved !== null) storage.setStorageSync('irlSelectedCity', defaultCity);
  return defaultCity;
}

module.exports = { cities, searchableCities, popularCities, defaultCity, isSelectableCity, selectedCity };
