import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase, type Database } from '../src/db.ts';
import { createApp } from '../src/server.ts';

async function serve(db: Database) {
  const server = createApp(db, { environment: 'test', devAuth: false, checkInSecret: 'test-secret' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  return { base: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}

test('readiness checks database access and hides errors while liveness stays independent', async () => {
  const db = await createDatabase();
  const healthy = await serve(db);
  try {
    const response = await fetch(healthy.base + '/ready');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ready' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally { await healthy.close(); }

  await db.close();
  const unhealthy = await serve(db);
  try {
    const readiness = await fetch(unhealthy.base + '/ready');
    assert.equal(readiness.status, 503);
    assert.deepEqual(await readiness.json(), { status: 'unavailable' });
    assert.equal((await (await fetch(unhealthy.base + '/health')).json() as { status: string }).status, 'ok');
  } finally { await unhealthy.close(); }
});
