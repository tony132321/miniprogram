const { backToProfile, statusBarHeight } = require('../navigation.js');
const config = require('../../../config.js');
const questions = [
  { title: '主办方取消或活动未能成局怎么办？', answer: '请先查看活动页的当前状态及站内通知。若涉及安全、欺诈或争议，可在“我的”提交举报工单。' },
  { title: 'AA 费用有争议怎么办？', answer: '活动费用页只记录分摊和双方标记，不处理真实付款。请保留真实交易凭证，并在活动页查看当前账本版本。' },
  { title: '活动信息更新后为什么要重新确认？', answer: '时间、地点、费用等重大规则变化会要求已有参与者按当前审核版本重新确认。' },
  { title: '如何联系主办方？', answer: '当前版本可在活动公告问答区提交与本场有关的问题。私聊与电话号码交换尚未开放。' }
];
Page({
  data: { statusBarHeight: 24, questions, openIndex: -1 },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  toggleFaq(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= questions.length) return;
    this.setData({ openIndex: this.data.openIndex === index ? -1 : index });
  },
  back: backToProfile,
  goReport() {
    wx.setStorageSync('irlProfileFocusIntent', 'reportSection');
    const actor = wx.getStorageSync('sessionToken') ? wx.getStorageSync('userId')
      : wx.getStorageSync('devUser') || config.developmentUser || '';
    if (actor) getApp().globalData.reportContext = { actor, eventId: '' };
    wx.switchTab({ url: '/pages/me/me' });
  }
});
