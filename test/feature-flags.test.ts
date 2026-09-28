import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';

test('R1 explicitly denies deferred and unapproved AI APIs while local draft help remains usable', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'test', devAuth: true, checkInSecret: 'test-secret' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  const request = async (path: string, method = 'GET') => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: { 'X-Dev-User': 'host', 'Content-Type': 'application/json', 'Idempotency-Key': 'flags-test' },
      body: method === 'POST' ? JSON.stringify({ text: '六个人打羽毛球' }) : undefined
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };
  try {
    const manifest = await request('/system/capabilities');
    assert.equal(manifest.status, 200);
    for (const flag of ['ai_draft', 'public_discovery', 'open_matching', 'merchant_payments',
      'paid_pro', 'photo_album', 'auto_booking']) assert.equal((manifest.body.flags as Record<string, boolean>)[flag], false);
    for (const path of ['/events/drafts:generate', '/discovery/events', '/matching/requests', '/payments/orders',
      '/pro/subscriptions', '/albums/photos', '/bookings/venues', '/events/forged/payments', '/events/forged/albums']) {
      const denied = await request(path, 'POST');
      assert.equal(denied.status, 403, path);
      assert.equal(denied.body.code, 'FEATURE_DISABLED', path);
    }
    const manual = await request('/events/drafts:suggest-local', 'POST');
    assert.equal(manual.status, 200);
    assert.equal(manual.body.source, 'RULE_FALLBACK');
    assert.equal((await request('/me/events')).status, 200);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});

test('mini program has no deferred deep-link page and uses the local rule endpoint', async () => {
  const app = JSON.parse(await readFile(new URL('../miniprogram/app.json', import.meta.url), 'utf8')) as { pages: string[] };
  for (const page of ['pages/index/index', 'pages/create/create', 'pages/event/event', 'pages/me/me'])
    assert.ok(app.pages.includes(page), `${page} remains available`);
  assert.equal(new Set(app.pages).size, app.pages.length);
  assert.ok(app.pages.every(page => !/payments|matching|albums|bookings/.test(page)));
  const create = await readFile(new URL('../miniprogram/pages/create/create.js', import.meta.url), 'utf8');
  assert.match(create, /\/events\/drafts:suggest-local/);
  assert.doesNotMatch(create, /\/events\/drafts:generate/);
});
