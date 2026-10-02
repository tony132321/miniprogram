const sources = require('./sources.js');

Component({
  options: { virtualHost: true, styleIsolation: 'shared' },
  externalClasses: ['photo-class'],
  properties: { photoKey: { type: String, value: '' } },
  data: { src: '' },
  observers: {
    photoKey(key) {
      const src = Object.prototype.hasOwnProperty.call(sources, key) ? sources[key] : '';
      if (this.data.src !== src) this.setData({ src });
    }
  }
});
