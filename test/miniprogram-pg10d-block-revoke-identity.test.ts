import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function mount(postGate?: Promise<void>) {
  let page: Record<string, any> | undefined;
  let session = 'account-a';
  const reads: string[] = [];
  const posts: string[] = [];
  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/profile/privacy-safety/privacy-safety.js', import.meta.url), 'utf8'), {
    Page(definition: Record<string, any>) { page = definition; },
    getApp() { return { globalData: { ready: Promise.resolve() } }; },
    wx: { getStorageSync(key: string) { return key === 'sessionToken' ? session : ''; } },
    require(module: string) {
      if (module === '../../../utils/api.js') return { api: {
        async get(path: string) {
          reads.push(`${session}:${path}`);
          return { items: [{ id: session === 'account-a' ? 'old-block' : 'new-block', eventTitle: session }] };
        },
        async post(path: string) { posts.push(`${session}:${path}`); await postGate; }
      } };
      if (module === '../../../config.js') return { developmentUser: '' };
      if (module === '../navigation.js') return { backToProfile() {}, statusBarHeight() { return 24; } };
      throw new Error(`unexpected require ${module}`);
    }
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  return { page, reads, posts, setSession(value: string) { session = value; } };
}

test('stale block card cannot revoke through a newly signed-in session before onShow', async () => {
  const { page, reads, posts, setSession } = mount();
  await page.onShow();
  assert.equal(page.data.blocks[0].id, 'old-block');

  setSession('account-b');
  await page.revokeBlock({ currentTarget: { dataset: { id: 'old-block' } } });
  assert.deepEqual(posts, [], 'do not submit the previous account block ID under the new session');
  assert.deepEqual(reads, ['account-a:/me/blocks', 'account-b:/me/blocks']);
  assert.equal(page.data.blocks[0].id, 'new-block');
  assert.equal(page.data.revokingId, '');
});

test('stale block card cannot revoke after sign-out and clears private details', async () => {
  const { page, reads, posts, setSession } = mount();
  await page.onShow();
  setSession('');

  await page.revokeBlock({ currentTarget: { dataset: { id: 'old-block' } } });
  assert.deepEqual(posts, []);
  assert.deepEqual(reads, ['account-a:/me/blocks']);
  assert.equal(page.data.loadState, 'UNAUTHENTICATED');
  assert.deepEqual(Array.from(page.data.blocks), []);
});

test('a pending revoke drops old block details when the session changes before its reply', async () => {
  let releasePost!: () => void;
  const postGate = new Promise<void>(resolve => { releasePost = resolve; });
  const { page, reads, posts, setSession } = mount(postGate);
  await page.onShow();

  const pending = page.revokeBlock({ currentTarget: { dataset: { id: 'old-block' } } });
  setSession('account-b');
  releasePost();
  await pending;
  assert.deepEqual(posts, ['account-a:/me/blocks/old-block/revoke']);
  assert.deepEqual(reads, ['account-a:/me/blocks', 'account-b:/me/blocks']);
  assert.equal(page.data.blocks[0].id, 'new-block');
  assert.equal(page.data.revokingId, '');
});
