import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { createApi } = require('../miniprogram/utils/api.js');

function makeApi(respond: (path: string, actor: string) => { statusCode: number; data: any }, actor = { value: 'one' }) {
  const paths: string[] = [];
  const api = createApi({
    getStorageSync(key: string) { return key === 'devUser' ? actor.value : ''; },
    request(options: Record<string, any>) {
      const path = new URL(options.url).pathname + new URL(options.url).search;
      paths.push(path);
      options.success(respond(path, options.header['X-Dev-User']));
    }
  }, { apiBase: 'https://api.example.test', developmentUser: 'fallback' });
  return { api, paths, actor };
}

test('all existing /me/events callers receive every page in server order', async () => {
  const firstItems = Array.from({ length: 100 }, (_, n) => ({ id: `event-${n}` }));
  const snapshot = 'a'.repeat(32);
  const { api, paths } = makeApi((path, actor) => {
    assert.equal(actor, 'one');
    if (path === '/me/events?limit=100&offset=0') return { statusCode: 200,
      data: { items: firstItems, total: 101, nextOffset: 100, snapshot } };
    if (path === `/me/events?limit=100&offset=100&snapshot=${snapshot}`) return { statusCode: 200,
      data: { items: [{ id: 'event-100' }], total: 101, nextOffset: null, snapshot } };
    throw new Error(`unexpected ${path}`);
  });
  const result = await api.get('/me/events');
  assert.equal(result.items.length, 101);
  assert.equal(result.items[100].id, 'event-100');
  assert.deepEqual(paths, ['/me/events?limit=100&offset=0',
    `/me/events?limit=100&offset=100&snapshot=${snapshot}`]);
});

test('remaining activity pages load concurrently and return in server order', async () => {
  const snapshot = 'a'.repeat(32);
  const first = Array.from({ length: 100 }, (_, n) => ({ id: `event-${n}` }));
  const second = Array.from({ length: 100 }, (_, n) => ({ id: `event-${n + 100}` }));
  const waiting = new Map<string, (response: object) => void>();
  const paths: string[] = [];
  const api = createApi({
    getStorageSync(key: string) { return key === 'devUser' ? 'member' : ''; },
    request(options: Record<string, any>) {
      const path = new URL(options.url).pathname + new URL(options.url).search;
      paths.push(path);
      if (path === '/me/events?limit=100&offset=0') options.success({ statusCode: 200,
        data: { items: first, total: 201, nextOffset: 100, snapshot } });
      else waiting.set(path, options.success);
    }
  }, { apiBase: 'https://api.example.test', developmentUser: 'member' });
  const pending = api.get('/me/events');
  await new Promise<void>(resolve => setImmediate(resolve));
  const secondPath = `/me/events?limit=100&offset=100&snapshot=${snapshot}`;
  const thirdPath = `/me/events?limit=100&offset=200&snapshot=${snapshot}`;
  assert.deepEqual(paths, ['/me/events?limit=100&offset=0', secondPath, thirdPath]);
  waiting.get(thirdPath)!({ statusCode: 200,
    data: { items: [{ id: 'event-200' }], total: 201, nextOffset: null, snapshot } });
  waiting.get(secondPath)!({ statusCode: 200,
    data: { items: second, total: 201, nextOffset: 200, snapshot } });
  const result = await pending;
  assert.deepEqual(result.items.map((item: { id: string }) => item.id),
    [...first, ...second, { id: 'event-200' }].map(item => item.id));
});

test('a changed page restarts from page one and never mixes two snapshots', async () => {
  const oldSnapshot = 'a'.repeat(32); const newSnapshot = 'b'.repeat(32);
  let firstCount = 0;
  const { api, paths } = makeApi(path => {
    if (path === '/me/events?limit=100&offset=0') {
      firstCount++;
      return { statusCode: 200, data: { items: [{ id: firstCount === 1 ? 'old' : 'new' }],
        total: 2, nextOffset: 1, snapshot: firstCount === 1 ? oldSnapshot : newSnapshot } };
    }
    if (path.endsWith(`snapshot=${oldSnapshot}`)) return { statusCode: 409,
      data: { code: 'QUEUE_CHANGED', message: '列表已变化' } };
    return { statusCode: 200, data: { items: [{ id: 'final' }], total: 2,
      nextOffset: null, snapshot: newSnapshot } };
  });
  const result = await api.get('/me/events');
  assert.deepEqual(result.items.map((item: { id: string }) => item.id), ['new', 'final']);
  assert.equal(paths.length, 4);
});

test('an account switch between pages stops the old traversal before another request', async () => {
  const actor = { value: 'one' };
  const snapshot = 'a'.repeat(32);
  const { api, paths } = makeApi((path) => {
    assert.equal(path, '/me/events?limit=100&offset=0');
    actor.value = 'two';
    return { statusCode: 200, data: { items: [{ id: 'private' }], total: 2,
      nextOffset: 1, snapshot } };
  }, actor);
  await assert.rejects(api.get('/me/events'), (error: any) => error.code === 'IDENTITY_CHANGED');
  assert.equal(paths.length, 1);
});

test('repeated page changes terminate with a retryable error', async () => {
  const { api, paths } = makeApi(path => path === '/me/events?limit=100&offset=0'
    ? { statusCode: 200, data: { items: [{ id: 'one' }], total: 2,
      nextOffset: 1, snapshot: 'a'.repeat(32) } }
    : { statusCode: 409, data: { code: 'QUEUE_CHANGED', message: '列表已变化' } });
  await assert.rejects(api.get('/me/events'), (error: any) => error.code === 'QUEUE_CHANGED');
  assert.equal(paths.length, 6);
});

test('a malformed empty continuation page terminates without requesting indefinitely', async () => {
  const { api, paths } = makeApi(() => ({ statusCode: 200,
    data: { items: [], total: 1, nextOffset: 0, snapshot: 'a'.repeat(32) } }));
  await assert.rejects(api.get('/me/events'), /活动列表分页无效/);
  assert.equal(paths.length, 1);
});
