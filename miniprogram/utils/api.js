const { sha256 } = require('./sha256.js');
const PENDING_STORAGE_KEY = 'irlUncertainMutationKeysV1';

function createApi(platform, config) {
  let authGeneration = 0;
  let logoutInProgress = false;
  const storedPending = platform.getStorageSync(PENDING_STORAGE_KEY);
  const uncertainMutations = new Map(Array.isArray(storedPending) ? storedPending.filter(entry =>
    Array.isArray(entry) && /^[a-f0-9]{64}$/.test(entry[0]) &&
    typeof entry[1] === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(entry[1])) : []);
  function persistPending() {
    if (typeof platform.setStorageSync === 'function')
      platform.setStorageSync(PENDING_STORAGE_KEY, [...uncertainMutations]);
  }
  function mutationFingerprint(identity, method, path, data) {
    const normalized = JSON.stringify([identity, method, path, data], (_key, value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      const sorted = {};
      Object.keys(value).sort().forEach(key => { sorted[key] = value[key]; });
      return sorted;
    });
    return sha256(normalized);
  }
  function currentIdentity() {
    const token = platform.getStorageSync('sessionToken');
    const devUser = config.developmentUser ? (platform.getStorageSync('devUser') || config.developmentUser) : '';
    return token ? `user:${platform.getStorageSync('userId') || token}` : `dev:${devUser || ''}`;
  }
  function hasDefinitiveResponse(statusCode) {
    return (statusCode >= 200 && statusCode < 300) ||
      (statusCode >= 400 && statusCode < 500 && statusCode !== 408);
  }
  function call(method, path, data, key, requestOptions) {
    return new Promise((resolve, reject) => {
      const token = platform.getStorageSync('sessionToken');
      const devUser = config.developmentUser ? (platform.getStorageSync('devUser') || config.developmentUser) : '';
      const identity = token ? `user:${platform.getStorageSync('userId') || token}` : `dev:${devUser || ''}`;
      const header = { 'Content-Type': 'application/json' };
      if (token) header.Authorization = 'Bearer ' + token;
      else if (devUser) header['X-Dev-User'] = devUser;
      const fingerprint = method === 'GET' || key || path === '/auth/wechat'
        ? null : mutationFingerprint(identity, method, path, data);
      if (method !== 'GET') {
        const requestKey = key || uncertainMutations.get(fingerprint) || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        header['Idempotency-Key'] = requestKey;
        if (fingerprint) {
          const previous = uncertainMutations.get(fingerprint);
          uncertainMutations.set(fingerprint, requestKey);
          try { persistPending(); }
          catch {
            if (!previous) uncertainMutations.delete(fingerprint);
            reject(Object.assign(new Error('本地存储不可用，操作尚未提交'), { code: 'LOCAL_STORAGE_UNAVAILABLE' }));
            return;
          }
        }
      }
      function clearIfDefinitive(statusCode, responseData) {
        if (requestOptions?.keepKeyUntilAck && ((statusCode >= 200 && statusCode < 300) ||
          (statusCode === 409 && responseData?.code === 'AI_REQUEST_UNCERTAIN'))) return;
        if (fingerprint && hasDefinitiveResponse(statusCode)
          && uncertainMutations.get(fingerprint) === header['Idempotency-Key'])
          {
            uncertainMutations.delete(fingerprint);
            try { persistPending(); }
            catch { uncertainMutations.set(fingerprint, header['Idempotency-Key']); }
          }
      }
      platform.request({ url: config.apiBase + path, method, data, header,
        ...(requestOptions?.timeoutMs ? { timeout: requestOptions.timeoutMs } : {}),
        success(response) {
          clearIfDefinitive(response.statusCode, response.data);
          if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data);
          else reject(Object.assign(new Error(response.statusCode === 408 || response.statusCode >= 500
            ? method === 'GET' ? '加载失败，服务暂时不可用；请重试' : '服务暂时不可用，提交结果尚未确认；请重试同一操作'
            : response.data?.message || '请求失败'),
          { code: response.data?.code || 'HTTP_ERROR', status: response.statusCode }));
        },
        fail(error) { reject(Object.assign(new Error(method === 'GET'
          ? '网络中断，加载失败；请重试' : '网络中断，提交结果尚未确认；请重试同一操作'),
          { code: 'NETWORK_ERROR', detail: error.errMsg || '网络不可用' })); }
      });
    });
  }
  return {
    get: path => call('GET', path),
    post: (path, data, key, requestOptions) => call('POST', path, data, key, requestOptions),
    acknowledgeMutation(method, path, data) {
      const fingerprint = mutationFingerprint(currentIdentity(), method, path, data);
      const key = uncertainMutations.get(fingerprint);
      if (!key) return false;
      uncertainMutations.delete(fingerprint);
      try { persistPending(); return true; }
      catch { uncertainMutations.set(fingerprint, key); return false; }
    },
    async logout() {
      authGeneration++;
      logoutInProgress = true;
      try {
        try { await call('POST', '/auth/logout', {}); }
        catch (error) { if (error.code !== 'UNAUTHENTICATED') throw error; }
        authGeneration++;
        platform.setStorageSync('sessionSignedOut', true);
        platform.removeStorageSync('sessionToken');
        platform.removeStorageSync('userId');
        uncertainMutations.clear();
        persistPending();
        return { ok: true };
      } finally { logoutInProgress = false; }
    },
    login() {
      const generation = authGeneration;
      return new Promise((resolve, reject) => platform.login({
        success: async ({ code }) => {
          try {
            const session = await call('POST', '/auth/wechat', { code });
            if (generation !== authGeneration || logoutInProgress)
              throw Object.assign(new Error('登录已取消，请重试'), { code: 'LOGIN_CANCELLED' });
            platform.setStorageSync('sessionToken', session.token);
            platform.setStorageSync('userId', session.userId);
            platform.removeStorageSync('sessionSignedOut');
            resolve(session);
          } catch (error) { reject(error); }
        }, fail: reject
      }));
    }
  };
}

const config = require('../config.js');
module.exports = { createApi, api: typeof wx === 'undefined' ? null : createApi(wx, config) };
