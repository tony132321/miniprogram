import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createPrivacyRequest } from '../src/operations.ts';
import { FileDeletionMarkerStore } from '../src/privacy-deletion-journal.ts';
import { createApp } from '../src/server.ts';

const policy = JSON.stringify({
  schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
  approved_by: 'synthetic-test-owner', approved_at: '2026-09-27T00:00:00.000Z',
  records: [...['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup']
    .map(name => ({ class: name, status: 'APPROVED', approved_days: 30,
      approved_trigger: 'DELETE_EXECUTION', legal_basis: 'Synthetic test basis only',
      deletion_action: 'Synthetic test action', access_roles: ['PRIVACY'] })),
    ...['voice_raw', 'photo'].map(name => ({ class: name, status: 'NOT_ENABLED' }))]
});

test('privacy execution HTTP requires an operator, records a marker and exposes a redacted disposition', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-delete-http-'));
  const db = await createDatabase();
  await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','delete-http-openid')");
  const request = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'http-delete-request');
  const markerStore = new FileDeletionMarkerStore(join(root, 'markers.jsonl'));
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'],
    checkInSecret: 'secret', privacyDeletion: { markerStore, approvedPolicyJson: policy } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const url = `http://127.0.0.1:${(app.address() as { port: number }).port}/ops/privacy/${request.id}/execute`;
  const post = (actor: string, body = '{}') => fetch(url, { method: 'POST',
    headers: { 'X-Dev-User': actor, 'Idempotency-Key': 'delete-execution', 'Content-Type': 'application/json' }, body });
  try {
    assert.equal((await post('p1')).status, 403);
    assert.equal((await post('ops', '{"force":true}')).status, 400);
    const response = await post('ops');
    assert.equal(response.status, 200);
    const receipt = await response.json() as { outcomes: { account: { state: string } } };
    assert.equal(receipt.outcomes.account.state, 'DISABLED');
    assert.deepEqual(await (await post('ops')).json(), receipt);
    const { rows } = await db.query<{ status: string }>("SELECT status FROM users WHERE id='p1'");
    assert.equal(rows[0]?.status, 'DISABLED');
    const dispositionUrl = url.replace('/execute', '/disposition');
    const deniedDisposition = await fetch(dispositionUrl, { headers: { 'X-Dev-User': 'p1' } });
    assert.equal(deniedDisposition.status, 403);
    const disposition = await fetch(dispositionUrl, { headers: { 'X-Dev-User': 'ops' } });
    assert.equal(disposition.status, 200);
    const snapshot = await disposition.json() as Record<string, unknown>;
    assert.equal(snapshot.status, 'SAFEGUARDS_APPLIED_PENDING_REVIEW');
    assert.deepEqual(snapshot.outcomes, receipt.outcomes);
    assert.equal(JSON.stringify(snapshot).includes('delete-http-openid'), false);
  } finally {
    await new Promise<void>(resolve => app.close(() => resolve()));
    await db.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('privacy execution stays unavailable when no independent marker store is configured', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${(app.address() as { port: number }).port}/ops/privacy/any/execute`,
      { method: 'POST', headers: { 'X-Dev-User': 'ops', 'Idempotency-Key': 'unavailable' }, body: '{}' });
    assert.equal(response.status, 503);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});
