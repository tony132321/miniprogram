let currentState;

function supportsDataUrl(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version || '');
  if (!match) return false;
  const values = match.slice(1).map(Number);
  return values[0] > 3 || (values[0] === 3 && (values[1] > 7 || (values[1] === 7 && values[2] >= 9)));
}

function loadReferenceFonts(wxApi) {
  if (currentState) return currentState;
  currentState = { support: 'unsupported', sdkVersion: '', faces: [], ready: Promise.resolve([]) };
  if (!wxApi || typeof wxApi.loadFontFace !== 'function') {
    currentState.support = 'unavailable';
    return currentState;
  }
  try {
    const info = typeof wxApi.getAppBaseInfo === 'function' ? wxApi.getAppBaseInfo() : wxApi.getSystemInfoSync();
    currentState.sdkVersion = info.SDKVersion || '';
  } catch (_) { return currentState; }
  if (!supportsDataUrl(currentState.sdkVersion)) return currentState;

  currentState.support = 'supported';
  currentState.source = 'loading';
  if (typeof require.async !== 'function') {
    currentState.support = 'unavailable';
    currentState.source = 'unavailable';
    return currentState;
  }
  let pending;
  try { pending = require.async('../subpackages/profile/fonts/reference-font-data.js'); }
  catch (_) { currentState.source = 'failed'; return currentState; }
  currentState.ready = Promise.resolve(pending).then(resources => {
    if (!Array.isArray(resources)) throw new Error('Invalid reference font resources');
    currentState.source = 'loaded';
    currentState.faces = resources.map(resource => ({ family: resource.family, weight: resource.weight, status: 'loading' }));
    return Promise.all(resources.map((resource, index) => new Promise(resolve => {
      const face = currentState.faces[index];
      let settled = false;
      function settle(status) {
        if (settled) return;
        settled = true;
        face.status = status;
        resolve(face);
      }
      try {
        wxApi.loadFontFace({
          family: resource.family,
          source: `url("data:font/woff;base64,${resource.data}")`,
          desc: { style: 'normal', weight: resource.weight },
          global: true,
          scopes: ['webview'],
          success: () => settle('loaded'),
          fail: () => settle('failed')
        });
      } catch (_) { settle('failed'); }
    })));
  }).catch(() => { currentState.source = 'failed'; return []; });
  return currentState;
}

module.exports = { loadReferenceFonts };
