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
  { title: '组局被爽约如何处理？', answer: '请先查看活动页的当前状态、取消规则和站内通知。若涉及安全、欺诈或争议，可保留相关凭证，在“我的”提交举报工单；平台尚未自动判定责任。' },
  { title: '报名费 AA 分摊有争议？', answer: '活动费用页只记录分摊和双方标记，不处理真实付款。请保留真实交易凭证，并以活动页当前账本版本核对差异；涉及违规可提交举报工单。' },
  { title: '活动无法成局怎么退改？', answer: '请查看活动页的当前状态与主办方公告。平台不处理退款；若已在线下支付，请依据双方约定协调并保留凭证。时间、地点等重大变更会要求按当前规则重新确认。' },
  { title: '如何申请成为认证主理人/局长？', answer: '主理人认证和等级尚未开放。当前可从发起页提出受控活动，按实际审核流程处理；发起活动不代表已获得认证。', action: 'create' }
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
  goCreate() {
    this.setData({ moreOpen: false, openIndex: -1 });
    wx.switchTab({ url: '/pages/create/create' });
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
