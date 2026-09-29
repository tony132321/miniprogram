const { backToProfile, statusBarHeight } = require('../navigation.js');

// These are design concepts, not earned awards. No badge-award API exists in R1.
const plannedBadges = [
  { id: 'badminton', title: '羽球常胜', note: '运动活动', icon: '⌕', color: 'amber', category: 'sports' },
  { id: 'host', title: '靠谱局长', note: '组织活动', icon: '✦', color: 'violet', category: 'organizer' },
  { id: 'quick', title: '秒速成局', note: '组织活动', icon: 'ϟ', color: 'lime', category: 'organizer' },
  { id: 'partner', title: '神仙搭子', note: '社交活动', icon: '♡', color: 'pink', category: 'social' },
  { id: 'walk', title: '城市漫步家', note: '探索活动', icon: '♧', color: 'orange', category: 'explorer' },
  { id: 'coffee', title: '咖啡探索家', note: '探索活动', icon: '☕', color: 'coffee', category: 'explorer' },
  { id: 'first', title: '首局破冰者', note: '组织活动', icon: '✧', color: 'blue', category: 'organizer' },
  { id: 'night', title: '夜猫子局长', note: '组织活动', icon: '☾', color: 'muted', category: 'organizer' },
  { id: 'crowd', title: '百人呼应', note: '社交活动', icon: '♢', color: 'muted', category: 'social' }
];
const categories = [
  { id: 'all', title: '全部' }, { id: 'sports', title: '运动狂热' },
  { id: 'social', title: '社交达人' }, { id: 'organizer', title: '靠谱组织' },
  { id: 'explorer', title: '探索家' }
];

Page({
  data: { statusBarHeight: 24, awardState: 'UNAVAILABLE', categories, showcaseSlots: [1, 2, 3, 4],
    activeCategory: 'all', visibleBadges: plannedBadges, badgeMessage: '' },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  back: backToProfile,
  selectCategory(event) {
    const category = event?.currentTarget?.dataset?.category;
    if (!categories.some(item => item.id === category)) return;
    this.setData({ activeCategory: category, badgeMessage: '', visibleBadges:
      category === 'all' ? plannedBadges : plannedBadges.filter(item => item.category === category) });
  },
  openBadge(event) {
    const id = event?.currentTarget?.dataset?.id;
    const badge = plannedBadges.find(item => item.id === id);
    if (badge) this.setData({ badgeMessage: `「${badge.title}」是设计中的勋章，评定和佩戴功能尚未开放。` });
  },
  goActivities() { wx.switchTab({ url: '/pages/index/index' }); }
});
