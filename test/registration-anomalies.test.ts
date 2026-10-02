import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';
import { createDraft } from '../src/events.ts';
import { publishApprovedInvite } from './helpers.ts';

const eventInput = { title: '异常报名人工复核', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z',
  timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 4, registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z',
  feeMode: 'FREE', feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };

test('repeated signup and exit is queued for human review without an automatic penalty', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  const draft = await createDraft(db, 'host', eventInput, 'draft-anomaly');
  const eventId = (await publishApprovedInvite(db, 'host', draft.id, draft.version, 'publish-anomaly')).id;
  const member = 'repeat-member';
  const record = async (action: string, createdAt: string | null = null) => db.query(
    'INSERT INTO audit(id,actor_id,event_id,action,created_at) VALUES($1,$2,$3,$4,coalesce($5::timestamptz,now()))',
    [randomUUID(), member, eventId, action, createdAt]);
  const queue = async (actor: string) => fetch(`${base}/ops/registration-anomalies`, { headers: { 'X-Dev-User': actor } });
  try {
    assert.equal((await queue('member')).status, 403);
    assert.deepEqual((await (await queue('ops')).json() as { items: unknown[] }).items, []);
    const firstAt = Date.now() - 60_000;
    await record('REGISTER_CONFIRMED', new Date(firstAt).toISOString());
    await record('CANCEL_REGISTRATION', new Date(firstAt + 1000).toISOString());
    await record('REGISTER_CONFIRMED', new Date(firstAt + 2000).toISOString());
    await record('CANCEL_REGISTRATION', new Date(firstAt + 3000).toISOString());
    assert.deepEqual((await (await queue('ops')).json() as { items: unknown[] }).items, []);
    await record('REGISTER_CONFIRMED', new Date(firstAt + 4000).toISOString());
    const pending = await queue('ops');
    assert.equal(pending.status, 200);
    const items = (await pending.json() as { items: Array<{ userId: string; eventId: string; registrations: number;
      cancellations: number; lastSignalAt: string }> }).items;
    assert.equal(items.length, 1);
    assert.deepEqual([items[0]!.userId, items[0]!.eventId, items[0]!.registrations, items[0]!.cancellations],
      [member, eventId, 3, 2]);
    const evidenceUrl = `${base}/ops/registration-anomalies/evidence?userId=${member}&eventId=${eventId}`;
    assert.equal((await fetch(evidenceUrl, { headers: { 'X-Dev-User': 'member' } })).status, 403);
    const evidence = await fetch(evidenceUrl, { headers: { 'X-Dev-User': 'ops' } });
    assert.equal(evidence.status, 200);
    assert.deepEqual((await evidence.json() as { actions: Array<{ action: string }> }).actions.map(item => item.action),
      ['REGISTER_CONFIRMED', 'CANCEL_REGISTRATION', 'REGISTER_CONFIRMED', 'CANCEL_REGISTRATION', 'REGISTER_CONFIRMED'].reverse());
    const review = (actor: string, body: Record<string, unknown>, key: string) => fetch(`${base}/ops/registration-anomalies/review`, {
      method: 'POST', headers: { 'X-Dev-User': actor, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(body) });
    const body = { userId: member, eventId, lastSignalAt: items[0]!.lastSignalAt,
      disposition: 'MONITOR', note: '已核对报名与退出记录，继续观察' };
    assert.equal((await review('member', body, 'denied')).status, 403);
    assert.equal((await review('ops', { ...body, note: '短' }, 'bad-note')).status, 400);
    const recorded = await review('ops', body, 'human-review');
    assert.equal(recorded.status, 200);
    assert.deepEqual((await (await queue('ops')).json() as { items: unknown[] }).items, []);
    const audit = (await db.query<{ actor_id: string; detail: Record<string, unknown> }>(
      "SELECT actor_id,detail FROM audit WHERE action='REVIEW_REGISTRATION_ANOMALY'")).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0]!.actor_id, 'ops');
    assert.equal(audit[0]!.detail.userId, member);
    assert.equal(audit[0]!.detail.disposition, 'MONITOR');
    assert.equal((await review('ops', body, 'human-review')).status, 200);
    assert.equal((await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM audit WHERE action='REVIEW_REGISTRATION_ANOMALY'")).rows[0]!.count, 1);
    await record('REGISTER_CONFIRMED');
    assert.equal((await (await queue('ops')).json() as { items: unknown[] }).items.length, 0);
    await record('CANCEL_REGISTRATION'); await record('REGISTER_CONFIRMED');
    await record('CANCEL_REGISTRATION'); await record('REGISTER_CONFIRMED');
    assert.equal((await (await queue('ops')).json() as { items: unknown[] }).items.length, 1);
    assert.equal((await review('ops', body, 'stale-review')).status, 409);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('anomaly queue pages beyond 100 and rejects a stale snapshot', async () => {
  const db = await createDatabase();
  const draft = await createDraft(db, 'host', eventInput, 'draft-anomaly-pages');
  const eventId = (await publishApprovedInvite(db, 'host', draft.id, draft.version, 'publish-anomaly-pages')).id;
  await db.query(`INSERT INTO audit(id,actor_id,event_id,action)
    SELECT 'anomaly-'||g.i||'-'||a.n,'member-'||g.i,$1,a.action
    FROM generate_series(1,101) AS g(i) CROSS JOIN (VALUES
      (1,'REGISTER_CONFIRMED'),(2,'CANCEL_REGISTRATION'),(3,'REGISTER_CONFIRMED'),
      (4,'CANCEL_REGISTRATION'),(5,'REGISTER_CONFIRMED')) AS a(n,action)`, [eventId]);
  const server = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const url = `http://127.0.0.1:${address.port}/ops/registration-anomalies`;
  const get = async (suffix = '') => fetch(url + suffix, { headers: { 'X-Dev-User': 'ops' } });
  try {
    const first = await get();
    assert.equal(first.status, 200);
    const page = await first.json() as { items: unknown[]; total: number; nextOffset: number; snapshot: string };
    assert.equal(page.items.length, 100);
    assert.equal(page.total, 101);
    assert.equal(page.nextOffset, 100);
    const next = await get(`?offset=100&snapshot=${page.snapshot}`);
    assert.equal(next.status, 200);
    assert.equal((await next.json() as { items: unknown[]; nextOffset: number | null }).items.length, 1);
    await db.query('INSERT INTO audit(id,actor_id,event_id,action) VALUES($1,$2,$3,$4)',
      [randomUUID(), 'member-1', eventId, 'REGISTER_CONFIRMED']);
    assert.equal((await get(`?offset=100&snapshot=${page.snapshot}`)).status, 409);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});
