const { backToProfile, statusBarHeight } = require('../navigation.js');
const config = require('../../../config.js');
function headerPaddingRight() {
  try {
    const menu = wx.getMenuButtonBoundingClientRect?.();
    const width = (wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {}).windowWidth;
    if (Number.isFinite(menu?.left) && Number.isFinite(width) && menu.left >= 0 && menu.left < width)
      return `${Math.ceil(width - menu.left + 8)}px`;
  } catch (_) { /* Keep space for the native menu on older clients. */ }
  return '112px';
}
const questions = [
  { title: '主办方取消或活动未能成局怎么办？', answer: '请先查看活动页的当前状态及站内通知。若涉及安全、欺诈或争议，可在“我的”提交举报工单。' },
  { title: 'AA 费用有争议怎么办？', answer: '活动费用页只记录分摊和双方标记，不处理真实付款。请保留真实交易凭证，并在活动页查看当前账本版本。' },
  { title: '活动信息更新后为什么要重新确认？', answer: '时间、地点、费用等重大规则变化会要求已有参与者按当前审核版本重新确认。' },
  { title: '如何联系主办方？', answer: '当前版本可在活动公告问答区提交与本场有关的问题。私聊与电话号码交换尚未开放。' }
];
Page({
  data: { statusBarHeight: 24, headerPaddingRight: '112px', moreOpen: false, questions, openIndex: -1 },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight(), headerPaddingRight: headerPaddingRight() }); },
  onShow() { this.setData({ headerPaddingRight: headerPaddingRight() }); },
  onHide() { this.setData({ moreOpen: false }); },
  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },
  goAbout() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/pages/about/about' }); },
  goProfile() { this.setData({ moreOpen: false }); wx.switchTab({ url: '/pages/me/me' }); },
  toggleFaq(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= questions.length) return;
    this.setData({ openIndex: this.data.openIndex === index ? -1 : index });
  },
  back: backToProfile,
  goReport() {
    wx.setStorageSync('irlProfileFocusIntent', 'reportSection');
    const token = wx.getStorageSync('sessionToken');
    const actor = token ? wx.getStorageSync('userId')
      : wx.getStorageSync('devUser') || config.developmentUser || '';
    if (actor) getApp().globalData.reportContext = {
      actor, owner: token ? `session:${actor}:${token}` : `dev:${actor}`, eventId: '' };
    wx.switchTab({ url: '/pages/me/me' });
  }
});
