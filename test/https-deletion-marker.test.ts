import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { HttpsDeletionMarkerStore } from '../src/https-deletion-marker.ts';

const marker = { schema: 'project-irl/deletion-marker-v1' as const, requestId: 'request-1',
  userId: 'person-1', policySha256: 'a'.repeat(64), recordedAt: '2026-09-28T00:00:00.000Z' };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' }
});

test('HTTPS marker append requires exact durable immutable acknowledgement', async () => {
  const calls: Array<{ url: string; token: string | null; redirect: RequestRedirect }> = [];
  const store = new HttpsDeletionMarkerStore('https://markers.example/isolated/', 'secret-token',
    async (url, options) => {
      calls.push({ url: String(url), token: new Headers(options?.headers).get('authorization'),
        redirect: options?.redirect ?? 'follow' });
      assert.deepEqual(JSON.parse(String(options?.body)), marker);
      return json({ schema: 'project-irl/deletion-marker-ack-v1', markerSha256: hash(marker),
        durable: true, immutable: true }, 201);
    });
  await store.append(marker);
  assert.deepEqual(calls, [{ url: 'https://markers.example/isolated/v1/markers',
    token: 'Bearer secret-token', redirect: 'error' }]);
  for (const response of [
    { schema: 'project-irl/deletion-marker-ack-v1', markerSha256: '0'.repeat(64), durable: true, immutable: true },
    { schema: 'project-irl/deletion-marker-ack-v1', markerSha256: hash(marker), durable: false, immutable: true },
    { schema: 'project-irl/deletion-marker-ack-v1', markerSha256: hash(marker), durable: true, immutable: false }
  ]) {
    const bad = new HttpsDeletionMarkerStore('https://markers.example/', 'secret-token', async () => json(response, 201));
    await assert.rejects(() => bad.append(marker), /marker acknowledgement/);
  }
});

test('HTTPS marker list verifies a complete immutable snapshot across pages', async () => {
  const second = { ...marker, requestId: 'request-2', recordedAt: '2026-09-28T01:00:00.000Z' };
  const snapshotSha256 = hash([marker, second]);
  const requests: string[] = [];
  const store = new HttpsDeletionMarkerStore('https://markers.example/', 'token', async url => {
    requests.push(String(url));
    return requests.length === 1
      ? json({ schema: 'project-irl/deletion-marker-list-v1', snapshotSha256,
        total: 2, offset: 0, markers: [marker], nextOffset: 1, complete: false,
        durable: true, immutable: true })
      : json({ schema: 'project-irl/deletion-marker-list-v1', snapshotSha256,
        total: 2, offset: 1, markers: [second], nextOffset: null, complete: true,
        durable: true, immutable: true });
  });
  assert.deepEqual(await store.list(), [marker, second]);
  assert.deepEqual(requests, [
    'https://markers.example/v1/markers?offset=0',
    `https://markers.example/v1/markers?offset=1&snapshot=${snapshotSha256}`
  ]);
});

test('HTTPS marker store fails closed on incomplete list, tampering, transport failure and unsafe URL', async () => {
  assert.throws(() => new HttpsDeletionMarkerStore('http://markers.example/', 'token'), /HTTPS/);
  assert.throws(() => new HttpsDeletionMarkerStore('https://user:password@markers.example/', 'token'), /HTTPS/);
  const incomplete = new HttpsDeletionMarkerStore('https://markers.example/', 'token',
    async () => json({ schema: 'project-irl/deletion-marker-list-v1', snapshotSha256: hash([marker]),
      total: 2, offset: 0, markers: [marker], nextOffset: null, complete: true,
      durable: true, immutable: true }));
  await assert.rejects(() => incomplete.list(), /complete marker snapshot/);
  const tampered = new HttpsDeletionMarkerStore('https://markers.example/', 'token',
    async () => json({ schema: 'project-irl/deletion-marker-list-v1', snapshotSha256: '0'.repeat(64),
      total: 1, offset: 0, markers: [marker], nextOffset: null, complete: true,
      durable: true, immutable: true }));
  await assert.rejects(() => tampered.list(), /complete marker snapshot/);
  const offline = new HttpsDeletionMarkerStore('https://markers.example/', 'secret-token',
    async () => { throw new Error('network leaked secret-token'); });
  await assert.rejects(() => offline.list(), error => {
    assert.doesNotMatch(String(error), /secret-token/);
    return true;
  });
});
