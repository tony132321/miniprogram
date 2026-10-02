import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../miniprogram/utils/reference-fonts.js', import.meta.url), 'utf8');
function mount(version = '3.17.2') {
  let resolve!: (v: any) => void, reject!: (e: Error) => void;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  const asyncPaths: string[] = [], fonts: any[] = [];
  const loader = Object.assign((_path: string) => { throw new Error('synchronous cross-package loading is not allowed'); }, {
    async(path: string) { asyncPaths.push(path); return promise; }
  });
  const module = { exports: {} as any };
  runInNewContext(source, { require: loader, module });
  const wx = { getAppBaseInfo: () => ({ SDKVersion: version }), loadFontFace(options: any) { fonts.push(options); } };
  return { load: () => module.exports.loadReferenceFonts(wx), resolve, reject, fonts, asyncPaths };
}

test('fonts wait for one asynchronous package and retain global registration with independent callback results', async () => {
  const h = mount(), state = h.load(); assert.equal(h.load(), state);
  assert.deepEqual(h.asyncPaths, ['../subpackages/profile/fonts/reference-font-data.js']);
  assert.equal(h.fonts.length, 0);
  h.resolve([{ family: 'Caveat', weight: '600', data: 'font-a' }, { family: 'Caveat', weight: '700', data: 'font-b' }]);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(h.fonts.length, 2);
  assert.equal(h.fonts[0].global, true); assert.equal(h.fonts[0].desc.weight, '600');
  h.fonts[0].success(); h.fonts[1].fail();
  const result = await state.ready; assert.equal(result[0].status, 'loaded'); assert.equal(result[1].status, 'failed');
});

test('package download rejection resolves readiness and records failure without stopping the app', async () => {
  const h = mount(), state = h.load(); h.reject(new Error('package unavailable'));
  assert.equal((await state.ready).length, 0); assert.equal(state.source, 'failed'); assert.equal(h.fonts.length, 0);
});

test('unsupported SDK never downloads fonts or attempts registration', async () => {
  const h = mount('3.7.8'), state = h.load();
  assert.equal(state.support, 'unsupported'); assert.equal((await state.ready).length, 0);
  assert.deepEqual(h.asyncPaths, []); assert.equal(h.fonts.length, 0);
});
