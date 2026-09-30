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
  function sessionIdentityFor(token, devUser) {
    return token ? JSON.stringify(['session', platform.getStorageSync('userId') || '', token])
      : JSON.stringify(['development', devUser || '']);
  }
  function mutationIdentityFor(token, devUser) {
    return token ? `user:${platform.getStorageSync('userId') || token}` : `dev:${devUser || ''}`;
  }
  function currentIdentity() {
    const token = platform.getStorageSync('sessionToken');
    const devUser = config.developmentUser ? (platform.getStorageSync('devUser') || config.developmentUser) : '';
    return sessionIdentityFor(token, devUser);
  }
  function currentMutationIdentity() {
    const token = platform.getStorageSync('sessionToken');
    const devUser = config.developmentUser ? (platform.getStorageSync('devUser') || config.developmentUser) : '';
    return mutationIdentityFor(token, devUser);
  }
  function hasDefinitiveResponse(statusCode) {
    return (statusCode >= 200 && statusCode < 300) ||
      (statusCode >= 400 && statusCode < 500 && statusCode !== 408);
  }
  function call(method, path, data, key, requestOptions) {
    return new Promise((resolve, reject) => {
      const token = platform.getStorageSync('sessionToken');
      const devUser = config.developmentUser ? (platform.getStorageSync('devUser') || config.developmentUser) : '';
      const identity = sessionIdentityFor(token, devUser);
      const header = { 'Content-Type': 'application/json' };
      if (token) header.Authorization = 'Bearer ' + token;
      else if (devUser) header['X-Dev-User'] = devUser;
      const fingerprint = method === 'GET' || key || path === '/auth/wechat'
        ? null : mutationFingerprint(mutationIdentityFor(token, devUser), method, path, data);
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
          if (method === 'GET' && currentIdentity() !== identity) {
            reject(Object.assign(new Error('账号已切换，请刷新'), { code: 'IDENTITY_CHANGED' }));
            return;
          }
          clearIfDefinitive(response.statusCode, response.data);
          if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data);
          else reject(Object.assign(new Error(response.statusCode === 408 || response.statusCode >= 500
            ? method === 'GET' ? '加载失败，服务暂时不可用；请重试' : '服务暂时不可用，提交结果尚未确认；请重试同一操作'
            : response.data?.message || '请求失败'),
          { code: response.data?.code || 'HTTP_ERROR', status: response.statusCode }));
        },
        fail(error) {
          if (method === 'GET' && currentIdentity() !== identity) {
            reject(Object.assign(new Error('账号已切换，请刷新'), { code: 'IDENTITY_CHANGED' }));
            return;
          }
          reject(Object.assign(new Error(method === 'GET'
          ? '网络中断，加载失败；请重试' : '网络中断，提交结果尚未确认；请重试同一操作'),
          { code: 'NETWORK_ERROR', detail: error.errMsg || '网络不可用' }));
        }
      });
    });
  }
  async function listMyEvents() {
    const identity = currentIdentity();
    const changedIdentity = () => Object.assign(new Error('账号已切换，请刷新活动列表'), { code: 'IDENTITY_CHANGED' });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (currentIdentity() !== identity) throw changedIdentity();
        const first = await call('GET', '/me/events?limit=100&offset=0');
        if (currentIdentity() !== identity) throw changedIdentity();
        if (!Array.isArray(first?.items)) throw new Error('活动列表无效，请重试');
        // An older server may ignore the new query and return its complete legacy list.
        if (first.nextOffset === undefined && first.snapshot === undefined)
          return { items: first.items };
        const total = first.total;
        const snapshot = first.snapshot;
        const pageSize = first.items.length;
        const invalidPage = () => new Error('活动列表分页无效，请重试');
        function validatePage(page, offset) {
          if (!Array.isArray(page?.items) || !Number.isSafeInteger(page.total) || page.total !== total ||
            total < 0 || !/^[a-f0-9]{32}$/.test(page.snapshot) || page.snapshot !== snapshot ||
            page.items.length > 100 || offset + page.items.length > total ||
            (offset < total && page.items.length !== Math.min(pageSize, total - offset)) ||
            page.nextOffset !== (offset + page.items.length < total ? offset + page.items.length : null))
            throw invalidPage();
        }
        if (!Number.isSafeInteger(total) || total < 0 || !/^[a-f0-9]{32}$/.test(snapshot) ||
          pageSize > 100 || (total > 0 && pageSize === 0) || pageSize > total ||
          first.nextOffset !== (pageSize < total ? pageSize : null)) throw invalidPage();
        if (first.nextOffset === null) return { items: first.items };

        const offsets = [];
        for (let offset = pageSize; offset < total; offset += pageSize) offsets.push(offset);
        const pages = new Array(offsets.length);
        let next = 0;
        let failure = null;
        async function loadWorker() {
          while (next < offsets.length && !failure) {
            if (currentIdentity() !== identity) { failure = changedIdentity(); return; }
            const index = next++;
            const offset = offsets[index];
            try {
              const page = await call('GET', `/me/events?limit=100&offset=${offset}` +
                `&snapshot=${encodeURIComponent(snapshot)}`);
              if (currentIdentity() !== identity) throw changedIdentity();
              validatePage(page, offset);
              pages[index] = page.items;
            } catch (error) { failure = failure || error; }
          }
        }
        await Promise.all(Array.from({ length: Math.min(4, offsets.length) }, () => loadWorker()));
        if (currentIdentity() !== identity) throw changedIdentity();
        if (failure) throw failure;
        const items = first.items.slice();
        for (const pageItems of pages) items.push(...pageItems);
        if (items.length !== total) throw new Error('活动列表分页不完整，请重试');
        return { items };
      } catch (error) {
        if (currentIdentity() !== identity) throw changedIdentity();
        if (error.code !== 'QUEUE_CHANGED' || attempt === 2) throw error;
      }
    }
  }
  return {
    get: path => path === '/me/events' ? listMyEvents() : call('GET', path),
    post: (path, data, key, requestOptions) => call('POST', path, data, key, requestOptions),
    acknowledgeMutation(method, path, data) {
      const fingerprint = mutationFingerprint(currentMutationIdentity(), method, path, data);
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
