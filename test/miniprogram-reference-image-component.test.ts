import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const base = new URL('../miniprogram/subpackages/profile/components/reference-image/', import.meta.url);
function mount() {
  let definition: Record<string, any> | undefined;
  const module = { exports: {} };
  runInNewContext(readFileSync(new URL('sources.js', base), 'utf8'), { module, Object });
  runInNewContext(readFileSync(new URL('reference-image.js', base), 'utf8'), {
    require(path: string) { assert.equal(path, './sources.js'); return module.exports; },
    Component(value: Record<string, any>) { definition = value; }
  });
  assert.ok(definition);
  const instance = { data: { src: '' }, setData(patch: { src: string }) { this.data.src = patch.src; } };
  return { instance, change(key: unknown) { definition!.observers.photoKey.call(instance, key); } };
}

test('reference images never resolve arbitrary URL, path traversal or inherited object keys', () => {
  const h = mount();
  for (const key of ['https://example.com/photo.jpg', '../profile.jpg', '/assets/private.jpg', '__proto__', 'constructor', 'toString', '', null, undefined]) {
    h.change(key); assert.equal(h.instance.data.src, '');
  }
});

test('switching from an allowed illustration to an unknown key clears the previous photo', () => {
  const h = mount(); h.change('home-brand-party'); assert.match(h.instance.data.src, /\/home-brand-party\.jpg$/);
  h.change('missing-photo'); assert.equal(h.instance.data.src, '');
  h.change('discover-park'); assert.match(h.instance.data.src, /\/discover-park\.jpg$/);
});

test('every registered source exists in the component package and contains real image bytes', () => {
  const module = { exports: {} as Record<string, string> };
  runInNewContext(readFileSync(new URL('sources.js', base), 'utf8'), { module, Object });
  assert.equal(Object.keys(module.exports).length, 12);
  for (const src of Object.values(module.exports)) {
    assert.match(src, /^\/subpackages\/profile\/components\/reference-image\/assets\/[a-z-]+\.jpg$/);
    const bytes = readFileSync(new URL('../miniprogram' + src, import.meta.url));
    assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8);
  }
});
