const EVENT_PAGE = '/subpackages/activity/event/event';

// WeChat onLoad retains existing URL escapes. Preserve their wire value across
// the redirect while safely encoding any remaining reserved characters.
function encodeQueryValue(value) {
  return encodeURIComponent(String(value)).replace(/%25([0-9a-f]{2})/gi, '%$1');
}

function createEventEntryPage(wxApi, getPages) {
  return {
    data: { loading: true, message: '' },
    onLoad(options) {
      this._active = true;
      this._request = 0;
      const values = options || {};
      const query = Object.keys(values)
        .filter(key => ['string', 'number', 'boolean'].includes(typeof values[key]))
        .map(key => encodeQueryValue(key) + '=' + encodeQueryValue(values[key]))
        .join('&');
      this._target = EVENT_PAGE + (query ? '?' + query : '');
      this.openTarget();
    },
    openTarget() {
      if (!this._active || this._navigating || !this._target) return;
      this._navigating = true;
      const request = ++this._request;
      this.setData({ loading: true, message: '' });
      const fail = () => {
        if (!this._active || request !== this._request) return;
        this._navigating = false;
        this.setData({ loading: false, message: '活动页面加载失败，请重试。' });
      };
      try { wxApi.redirectTo({ url: this._target, fail }); }
      catch (_) { fail(); }
    },
    retry() { this.openTarget(); },
    goBack() {
      if (!this._active) return;
      const home = () => {
        if (this._active) wxApi.switchTab({ url: '/pages/index/index' });
      };
      try {
        if (getPages().length > 1) wxApi.navigateBack({ delta: 1, fail: home });
        else home();
      } catch (_) { home(); }
    },
    onUnload() {
      this._active = false;
      this._request += 1;
      this._target = '';
    }
  };
}
module.exports = { createEventEntryPage };
