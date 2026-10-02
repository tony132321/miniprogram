import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { Database } from '../src/db.ts';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';
import { createDraft } from '../src/events.ts';
import { accessDenialRoute } from '../src/access-denial-audit.ts';

test('deep protected paths stay auditable without storing the path or token', () => {
  assert.deepEqual(accessDenialRoute('/privacy/exports/a/b/c/d/e/f/g'),
    { routeTemplate: 'UNMAPPED_ROUTE', protectedRoute: true });
  assert.deepEqual(accessDenialRoute('/reservations/secret-token/claim'),
    { routeTemplate: '/reservations/:id/claim', protectedRoute: true });
});

async function fixture(adapt?: (db: Database) => Database) {
  const db = await createDatabase();
  const app = createApp(adapt?.(db) ?? db, {
    environment: 'development', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'test-secret'
  });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  const address = app.address();
  if (!address || typeof address === 'string') throw new Error('No server address');
  const base = `http://127.0.0.1:${address.port}`;
  const close = async () => { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); };
  return { db, base, close };
}

test('403 and protected 404 denials produce pseudonymous, template-only audit without business writes', async () => {
  const f = await fixture();
  try {
    const event = await createDraft(f.db, 'host', { title: 'private event' }, 'audit-seed');
    const ticket = '11111111-1111-4111-8111-111111111111';
    await f.db.query(`INSERT INTO personal_export_tickets(id,user_id,expires_at)
      VALUES($1,'host',clock_timestamp()+interval '10 minutes')`, [ticket]);
    const protectedUrl = `/privacy/exports/${ticket}?credential=never-in-audit`;
    const paths = [
      { path: `/events/${event.id}/registrations?credential=never-in-audit`, method: 'GET' },
      { path: `/events/${event.id}/expenses?credential=never-in-audit`, method: 'GET' },
      { path: '/ops/reports?credential=never-in-audit', method: 'GET' },
      { path: '/ops/reports/secret-report/status', method: 'POST' },
      { path: protectedUrl, method: 'GET' },
      { path: '/privacy/exports/a/b/c/d/e/f/g', method: 'GET' }
    ];
    const statuses: number[] = [];
    const requestIds: string[] = [];
    for (const { path, method } of paths) {
      const response = await fetch(f.base + path, { method,
        headers: { 'X-Dev-User': 'outsider', 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({ privateNote: 'never-in-audit-body' }) : undefined });
      statuses.push(response.status);
      requestIds.push(response.headers.get('x-request-id') || '');
      const body = await response.json() as Record<string, unknown>;
      assert.equal(body.message?.toString().includes('never-in-audit'), false);
    }
    assert.deepEqual(statuses, [403, 403, 403, 403, 404, 404]);
    const audit = await f.db.query<{ actor_id: string; event_id: string | null; action: string;
      detail: Record<string, unknown>; created_at: Date }>(
      "SELECT actor_id,event_id,action,detail,created_at FROM audit WHERE action='ACCESS_DENIED' ORDER BY created_at,id");
    assert.equal(audit.rows.length, 6);
    assert.deepEqual(audit.rows.map(row => row.detail.requestId).sort(), requestIds.sort());
    assert.deepEqual(audit.rows.map(row => row.detail.routeTemplate).sort(),
      ['/events/:id/registrations', '/events/:id/expenses', '/ops/reports',
        '/ops/reports/:id/status', '/privacy/exports/:id', 'UNMAPPED_ROUTE'].sort());
    for (const row of audit.rows) {
      assert.match(row.actor_id, /^denied:[a-f0-9]{64}$/);
      assert.equal(row.event_id, null);
      assert.equal(row.action, 'ACCESS_DENIED');
      assert.equal(row.detail.authenticationClass, 'DEVELOPMENT_MEMBER');
      assert.equal(typeof row.detail.requestId, 'string');
      assert.deepEqual(Object.keys(row.detail).sort(), ['authenticationClass', 'errorCode', 'requestId', 'routeTemplate']);
    }
    assert.deepEqual(audit.rows.map(row => row.detail.errorCode).sort(),
      ['FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN', 'NOT_FOUND', 'NOT_FOUND'].sort());
    assert.equal(JSON.stringify(audit.rows).includes(ticket), false);
    assert.equal(JSON.stringify(audit.rows).includes(event.id), false);
    assert.equal(JSON.stringify(audit.rows).includes('outsider'), false);
    assert.equal(JSON.stringify(audit.rows).includes('never-in-audit'), false);
    assert.equal(JSON.stringify(audit.rows).includes('secret-report'), false);
    assert.equal((await f.db.query<{ n: number }>('SELECT count(*)::int AS n FROM expense_ledgers')).rows[0]?.n, 0);
    assert.equal((await f.db.query<{ n: number }>('SELECT count(*)::int AS n FROM reports')).rows[0]?.n, 0);
    assert.equal((await f.db.query<{ n: number }>('SELECT count(*)::int AS n FROM personal_export_tickets')).rows[0]?.n, 1);
  } finally { await f.close(); }
});

test('audit storage failure leaves an unauthorized request denied', async () => {
  const f = await fixture(db => ({
    ...db,
    async query(sql, params) {
      if (sql.includes('INSERT INTO audit') && params?.includes('ACCESS_DENIED'))
        throw new Error('audit storage offline');
      return db.query(sql, params);
    }
  }));
  try {
    const response = await fetch(f.base + '/ops/reports', { headers: { 'X-Dev-User': 'outsider' } });
    assert.equal(response.status, 403);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.code, 'FORBIDDEN');
  } finally { await f.close(); }
});

test('missing reservation token returns 404 with a redacted denial audit', async () => {
  const f = await fixture();
  try {
    const response = await fetch(f.base + '/reservations/nonexistent-private-token/claim', {
      method: 'POST', headers: { 'X-Dev-User': 'outsider', 'Content-Type': 'application/json',
        'Idempotency-Key': 'missing-reservation-audit' },
      body: JSON.stringify({ expectedVersion: 1, expectedEventId: 'nonexistent-event' })
    });
    assert.equal(response.status, 404);
    const rows = (await f.db.query<{ detail: Record<string, unknown> }>(
      "SELECT detail FROM audit WHERE action='ACCESS_DENIED'")).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.detail.routeTemplate, '/reservations/:id/claim');
    assert.equal(JSON.stringify(rows).includes('nonexistent-private-token'), false);
  } finally { await f.close(); }
});
