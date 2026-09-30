const { api } = require('../../../utils/api.js');
const config = require('../../../config.js');
const { backToProfile, statusBarHeight } = require('../navigation.js');

function headerPaddingRight() {
  try {
    const menu = wx.getMenuButtonBoundingClientRect?.();
    const width = (wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {}).windowWidth;
    if (Number.isFinite(menu?.left) && Number.isFinite(width) && menu.left >= 0 && menu.left < width)
      return `${Math.ceil(width - menu.left + 8)}px`;
  } catch (_) { /* Reserve space for the native capsule on older clients. */ }
  return '112px';
}

function identity() {
  const session = wx.getStorageSync('sessionToken');
  if (session) return 'session:' + session;
  if (config.developmentUser) return 'dev:' + (wx.getStorageSync('devUser') || config.developmentUser);
  return '';
}

Page({
  data: { statusBarHeight: 24, headerPaddingRight: '112px', moreOpen: false,
    blocks: [], loadState: 'IDLE', message: '', revokingId: '' },
  onLoad() { this.setData({ statusBarHeight: statusBarHeight(), headerPaddingRight: headerPaddingRight() }); },
  async onShow() {
    const generation = this._generation = (this._generation || 0) + 1;
    this.setData({ blocks: [], message: '', revokingId: '', moreOpen: false,
      headerPaddingRight: headerPaddingRight(), loadState: 'LOADING' });
    let actor = '';
    try {
      await getApp().globalData.ready;
      if (generation !== this._generation) return;
      actor = identity();
      if (!actor) { this.setData({ loadState: 'UNAUTHENTICATED' }); return; }
      const result = await api.get('/me/blocks');
      if (generation !== this._generation || identity() !== actor) return;
      if (!Array.isArray(result?.items)) throw new Error('屏蔽记录格式错误，请重试');
      this.setData({ blocks: result.items, loadState: 'READY' });
    } catch (error) {
      if (generation === this._generation && (!actor || identity() === actor))
        this.setData({ loadState: 'ERROR', message: error.message || '暂时无法加载屏蔽记录' });
    }
  },
  onHide() { this.setData({ moreOpen: false }); },
  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },
  async revokeBlock(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.loadState !== 'READY' || this.data.revokingId) return;
    const actor = identity();
    this.setData({ revokingId: id, message: '' });
    try {
      await api.post(`/me/blocks/${encodeURIComponent(id)}/revoke`, {});
      if (identity() !== actor) return;
      await this.onShow();
      if (identity() === actor && this.data.loadState === 'READY') this.setData({ message: '已解除屏蔽。' });
    } catch (error) {
      if (identity() === actor) this.setData({ message: error.message || '操作失败，请重试。' });
    } finally {
      if (identity() === actor) this.setData({ revokingId: '' });
    }
  },
  retry() { return this.onShow(); },
  back: backToProfile,
  goProfile() { this.setData({ moreOpen: false }); wx.switchTab({ url: '/pages/me/me' }); },
  goSupport() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/subpackages/profile/support/support' }); },
  goLegal() { this.setData({ moreOpen: false }); wx.navigateTo({ url: '/subpackages/profile/legal/legal' }); }
});
