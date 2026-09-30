import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { cityModule } from './miniprogram-city-module.js';

const app = JSON.parse(readFileSync(new URL('../miniprogram/app.json', import.meta.url), 'utf8')) as {
  pages: string[];
  subPackages?: Array<{ root: string; pages: string[] }>;
};
const registeredRoutes = app.pages.concat((app.subPackages || []).flatMap(group =>
  group.pages.map(page => `${group.root}/${page}`)));

test('every WXML event binding has a page handler and every literal page navigation has a registered route', t => {
  let bindings = 0;
  let navigations = 0;
  for (const route of registeredRoutes) {
    const markup = readFileSync(new URL(`../miniprogram/${route}.wxml`, import.meta.url), 'utf8');
    const source = readFileSync(new URL(`../miniprogram/${route}.js`, import.meta.url), 'utf8');
    let page: Record<string, unknown> | undefined;
    runInNewContext(source, {
      Page(definition: Record<string, unknown>) { page = definition; },
      require(path: string) {
        if (path.endsWith('/config.js')) return { developmentUser: '' };
        if (path.endsWith('/utils/api.js')) return { api: {} };
        if (path.endsWith('/utils/city.js')) return cityModule;
        return new Proxy({}, { get: () => () => {} });
      },
      wx: {}, setTimeout, clearTimeout
    }, { filename: route });
    assert.ok(page, `${route} must register a Page`);
    for (const match of markup.matchAll(/\b(?:bind|catch)(?::)?[A-Za-z]+="([^"]+)"/g)) {
      const handler = match[1]!;
      if (!handler || handler.startsWith('{{')) continue;
      bindings++;
      assert.equal(typeof page[handler], 'function', `${route} binds missing handler ${handler}`);
    }
    for (const match of source.matchAll(/\bwx\.(?:navigateTo|switchTab|reLaunch|redirectTo)\s*\(\s*\{\s*url:\s*['"`]([^'"`?]+)(?:\?[^'"`]*)?['"`]/g)) {
      navigations++;
      const target = match[1]!.replace(/^\//, '');
      assert.ok(registeredRoutes.includes(target), `${route} navigates to unregistered page ${target}`);
    }
  }
  assert.ok(bindings > 0 && navigations > 0);
  t.diagnostic(`${registeredRoutes.length} pages, ${bindings} event bindings, ${navigations} literal routes checked`);
});
