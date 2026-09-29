const { api } = require('../../../utils/api.js');
const config = require('../../../config.js');
const { backToProfile, statusBarHeight } = require('../navigation.js');

function identity() {
  const session = wx.getStorageSync('sessionToken');
  if (session) return 'session:' + session;
  if (config.developmentUser) return 'dev:' + (wx.getStorageSync('devUser') || config.developmentUser);
  return '';
}

Page({
  data: { statusBarHeight: 24, blocks: [], loadState: 'IDLE', message: '' },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight() }); },
  async onShow() {
    const actor = identity();
    const generation = this._generation = (this._generation || 0) + 1;
    this.setData({ blocks: [], message: '', loadState: actor ? 'LOADING' : 'UNAUTHENTICATED' });
    if (!actor) return;
    try {
      const result = await api.get('/me/blocks');
      if (generation !== this._generation || identity() !== actor) return;
      this.setData({ blocks: result.items || [], loadState: 'READY' });
    } catch (error) {
      if (generation === this._generation && identity() === actor)
        this.setData({ loadState: 'ERROR', message: error.message || '暂时无法加载屏蔽记录' });
    }
  },
  async revokeBlock(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.loadState !== 'READY') return;
    try {
      await api.post(`/me/blocks/${encodeURIComponent(id)}/revoke`, {});
      await this.onShow();
      this.setData({ message: '已解除屏蔽。' });
    } catch (error) { this.setData({ message: error.message || '操作失败，请重试。' }); }
  },
  retry() { return this.onShow(); },
  back: backToProfile,
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); },
  goSupport() { wx.navigateTo({ url: '/subpackages/profile/support/support' }); }
});
