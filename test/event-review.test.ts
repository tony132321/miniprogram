import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createDatabase, type Database } from '../src/db.ts';
import { createDraft, getEvent, publishEvent } from '../src/events.ts';
import { register } from '../src/registrations.ts';
import { changeEvent, confirmEvent } from '../src/lifecycle.ts';
import { listPendingEventReviews, reviewEvent } from '../src/event-review.ts';
import { createApp } from '../src/server.ts';

const input = {
  title: '受控公开羽毛球', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'AA', feeCapFen: 5000,
  cancellationRule: '开始前可退出', visibility: 'PUBLIC', approvalMode: 'MANUAL', hostParticipates: true
};

test('public publication waits for human review before outsiders can view or join', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'draft');
    const published = await publishEvent(db, 'host', draft.id, draft.version, 'publish');
    assert.equal(published.reviewStatus, 'PENDING');
    assert.equal(published.recruiting, false);
    assert.equal((await listPendingEventReviews(db)).items[0]?.id, published.id);
    await assert.rejects(() => getEvent(db, 'outsider', published.id), { code: 'FORBIDDEN' });
    await assert.rejects(() => register(db, 'p1', published.id, published.version, 'join', null), { code: 'REGISTRATION_CLOSED' });
    await assert.rejects(() => confirmEvent(db, 'host', published.id, published.version, 'confirm'), { code: 'REVIEW_PENDING' });

    const approved = await reviewEvent(db, 'ops', published.id, published.version, 'APPROVED', '核对主办、公共场地、时间与费用', 'approve');
    assert.equal(approved.reviewStatus, 'APPROVED');
    assert.equal(approved.recruiting, true);
    assert.equal((await getEvent(db, 'outsider', published.id)).reviewStatus, 'APPROVED');
    assert.equal((await register(db, 'p1', published.id, published.version, 'join-after-approval', null)).status, 'REQUESTED');
  } finally { await db.close(); }
});

test('public approval uses database time for both recruiting and confirmed activities', async () => {
  const db = await createDatabase();
  try {
    for (const status of ['RECRUITING', 'CONFIRMED']) {
      const draft = await createDraft(db, 'host', input, `review-clock-${status}-draft`);
      const event = await publishEvent(db, 'host', draft.id, draft.version, `review-clock-${status}-publish`);
      if (status === 'CONFIRMED') await db.query("UPDATE events SET status='CONFIRMED' WHERE id=$1", [event.id]);
      const late = new Date(Date.parse(status === 'CONFIRMED' ? input.startAt : input.confirmationDeadline) + 1000);
      const clockDb: Database = {
        ...db,
        transaction: fn => db.transaction(tx => fn({
          query: <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
            sql === 'SELECT clock_timestamp() AS current_time'
              ? Promise.resolve({ rows: [{ current_time: late } as unknown as T] })
              : tx.query(sql, params)
        }))
      };
      await assert.rejects(() => reviewEvent(clockDb, 'ops', event.id, event.version, 'APPROVED',
        '已经超出活动审核窗口', `review-clock-${status}`), { code: 'REVIEW_WINDOW_CLOSED' });
      assert.equal((await getEvent(db, 'host', event.id)).reviewStatus, 'PENDING');
    }
  } finally { await db.close(); }
});

test('public approval cannot open recruitment if its window closes just before the final update', async () => {
  const db = await createDatabase();
  try {
    for (const status of ['RECRUITING', 'CONFIRMED']) {
      const draft = await createDraft(db, 'host', input, `review-write-${status}-draft`);
      const event = await publishEvent(db, 'host', draft.id, draft.version, `review-write-${status}-publish`);
      if (status === 'CONFIRMED') await db.query("UPDATE events SET status='CONFIRMED' WHERE id=$1", [event.id]);
      let crossed = false;
      const racingDb: Database = {
        ...db,
        transaction: fn => db.transaction(tx => fn({
          query: async (sql, params = []) => {
            if (!crossed && sql.startsWith('UPDATE events SET review_status=$2')) {
              crossed = true;
              const field = status === 'CONFIRMED' ? 'startAt' : 'confirmationDeadline';
              await tx.query('UPDATE events SET payload=jsonb_set(payload,$2::text[],to_jsonb($3::text),true) WHERE id=$1',
                [event.id, [field], new Date(Date.now() - 1000).toISOString()]);
            }
            return tx.query(sql, params);
          }
        }))
      };
      await assert.rejects(() => reviewEvent(racingDb, 'ops', event.id, event.version, 'APPROVED',
        '活动时间边界重新检查', `review-write-${status}`), { code: 'REVIEW_WINDOW_CLOSED' });
      assert.equal(crossed, true);
      const unchanged = await getEvent(db, 'host', event.id);
      assert.equal(unchanged.reviewStatus, 'PENDING');
      assert.equal(unchanged.recruiting, false);
      assert.equal((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM event_review_decisions WHERE event_id=$1',
        [event.id])).rows[0]?.n, 0);
    }
  } finally { await db.close(); }
});

test('public review HTTP endpoints are operator-only and invitations stay hidden until approval', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  async function request(path: string, actor: string, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, { method, headers: { 'X-Dev-User': actor,
      ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': `key-${path}` } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() as Record<string, any> };
  }
  try {
    const draft = await createDraft(db, 'host', input, 'http-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'http-publish');
    assert.equal((await request(`/i/${event.inviteToken}`, 'visitor')).status, 404);
    assert.equal((await request(`/events/${event.id}`, 'visitor')).status, 403);
    assert.equal((await request('/ops/events/reviews', 'visitor')).status, 403);
    assert.equal((await request('/ops/events/reviews', 'ops')).body.items[0].id, event.id);
    assert.equal((await request(`/ops/events/${event.id}/review`, 'host', 'POST',
      { expectedVersion: event.version, decision: 'APPROVED', reason: '核对主办方与活动事实' })).status, 403);
    const approved = await request(`/ops/events/${event.id}/review`, 'ops', 'POST',
      { expectedVersion: event.version, decision: 'APPROVED', reason: '核对主办方与活动事实' });
    assert.equal(approved.status, 200);
    assert.equal((await request(`/i/${event.inviteToken}`, 'visitor')).status, 200);
    assert.equal((await request(`/events/${event.id}`, 'visitor')).status, 200);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('operator pages every pending public review and restarts when the queue changes', async () => {
  const db = await createDatabase();
  const server = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not listen');
  const base = `http://127.0.0.1:${address.port}`;
  const get = (query = '', actor = 'ops') => fetch(`${base}/ops/events/reviews${query}`, { headers: { 'X-Dev-User': actor } });
  try {
    const draft = await createDraft(db, 'host', input, 'queue-draft');
    const published = await publishEvent(db, 'host', draft.id, draft.version, 'queue-publish');
    await db.query(`INSERT INTO events(id,host_id,status,version,payload,recruiting,review_status,updated_at)
      SELECT 'queue-review-'||n,host_id,status,version,payload,false,'PENDING',now()+n*interval '1 second'
      FROM events CROSS JOIN generate_series(1,104) n WHERE id=$1`, [published.id]);
    assert.equal((await get('', 'visitor')).status, 403);
    const first = await (await get('?offset=0')).json() as { items: Array<{ id: string }>; total: number; nextOffset: number | null; snapshot: string };
    assert.equal(first.total, 105);
    assert.equal(first.items.length, 100);
    assert.equal(first.nextOffset, 100);
    const second = await (await get(`?offset=100&snapshot=${first.snapshot}`)).json() as typeof first;
    assert.equal(second.items.length, 5);
    assert.equal(second.nextOffset, null);
    assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 105);
    assert.equal((await get('?offset=100')).status, 400);
    assert.equal((await get('?offset=-1')).status, 400);
    await db.query("UPDATE events SET review_status='APPROVED' WHERE id='queue-review-1'");
    const stale = await get(`?offset=100&snapshot=${first.snapshot}`);
    assert.equal(stale.status, 409);
    assert.equal((await stale.json() as { code: string }).code, 'QUEUE_CHANGED');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});

test('editing approved public details invalidates review and stale approval cannot reopen recruitment', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'draft');
    const published = await publishEvent(db, 'host', draft.id, draft.version, 'publish');
    await reviewEvent(db, 'ops', published.id, published.version, 'APPROVED', '核对原活动信息并通过', 'approve');
    await register(db, 'p1', published.id, published.version, 'join', null);
    const changed = await changeEvent(db, 'host', published.id, published.version, { title: '受控公开羽毛球（更改标题）' }, 'edit');
    assert.equal(changed.reviewStatus, 'PENDING');
    assert.equal(changed.recruiting, false);
    assert.equal((await getEvent(db, 'p1', published.id)).reviewStatus, 'PENDING');
    await assert.rejects(() => getEvent(db, 'new-reader', published.id), { code: 'FORBIDDEN' });
    await assert.rejects(() => reviewEvent(db, 'ops', published.id, published.version, 'APPROVED', '试图使用旧版本结果', 'stale'), { code: 'VERSION_CONFLICT' });
    const rejected = await reviewEvent(db, 'ops', published.id, changed.version, 'REJECTED', '标题需要主办方进一步说明', 'reject');
    assert.equal(rejected.reviewStatus, 'REJECTED');
    assert.equal((await getEvent(db, 'host', published.id)).reviewReason, '标题需要主办方进一步说明');
    assert.equal((await getEvent(db, 'p1', published.id)).reviewReason, undefined);
    const resubmitted = await changeEvent(db, 'host', published.id, changed.version, { title: '受控公开羽毛球（已核对）' }, 'resubmit');
    assert.equal(resubmitted.reviewStatus, 'PENDING');
    const approved = await reviewEvent(db, 'ops', published.id, resubmitted.version, 'APPROVED', '核对更新后的标题及活动事实', 'approve-again');
    assert.equal(approved.recruiting, true);
  } finally { await db.close(); }
});

test('approval after a material public change does not undo the separate recruitment pause', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'material-draft');
    const published = await publishEvent(db, 'host', draft.id, draft.version, 'material-publish');
    await reviewEvent(db, 'ops', published.id, published.version, 'APPROVED', '核对公开活动原始事实', 'material-approve');
    const changed = await changeEvent(db, 'host', published.id, published.version,
      { venueName: '另一处公共球馆', venueStatus: 'HOST_CONFIRMED' }, 'material-change');
    assert.equal(changed.reviewStatus, 'PENDING');
    assert.equal(changed.recruiting, false);
    const approved = await reviewEvent(db, 'ops', published.id, changed.version, 'APPROVED', '核对新的公共场馆信息', 'material-reapprove');
    assert.equal(approved.reviewStatus, 'APPROVED');
    assert.equal(approved.recruiting, false);
    await assert.rejects(() => register(db, 'new-member', approved.id, approved.version, 'material-join', null), { code: 'REGISTRATION_CLOSED' });
  } finally { await db.close(); }
});

test('public events require manual participant approval before submission to review', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', { ...input, approvalMode: 'AUTO' }, 'auto-draft');
    await assert.rejects(() => publishEvent(db, 'host', draft.id, draft.version, 'auto-publish'), { code: 'INVALID_EVENT' });
  } finally { await db.close(); }
});

test('a confirmed public event can be reviewed after formation deadline if it has not started', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'confirmed-draft');
    const published = await publishEvent(db, 'host', draft.id, draft.version, 'confirmed-publish');
    await reviewEvent(db, 'ops', published.id, published.version, 'APPROVED', '核对原活动信息和公共场地', 'confirmed-first-review');
    await db.query("UPDATE events SET status='CONFIRMED',payload=jsonb_set(payload,'{confirmationDeadline}',to_jsonb($2::text)) WHERE id=$1",
      [published.id, new Date(Date.now() - 60_000).toISOString()]);
    const changed = await changeEvent(db, 'host', published.id, published.version, { title: '已成局活动标题更正' }, 'confirmed-edit');
    assert.equal(changed.reviewStatus, 'PENDING');
    const approved = await reviewEvent(db, 'ops', published.id, changed.version, 'APPROVED', '核对已成局活动的新标题与事实', 'confirmed-second-review');
    assert.equal(approved.reviewStatus, 'APPROVED');
    assert.equal((await getEvent(db, 'outsider', published.id)).payload.title, '已成局活动标题更正');
  } finally { await db.close(); }
});

test('legacy public AUTO approval cannot pass human event review', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'legacy-draft');
    const published = await publishEvent(db, 'host', draft.id, draft.version, 'legacy-publish');
    await db.query("UPDATE events SET payload=jsonb_set(payload,'{approvalMode}',to_jsonb('AUTO'::text)) WHERE id=$1", [published.id]);
    await assert.rejects(() => reviewEvent(db, 'ops', published.id, published.version, 'APPROVED',
      '核对主办方与活动事实', 'legacy-review'), { code: 'REVIEW_REQUIRES_MANUAL_APPROVAL' });
    assert.equal((await getEvent(db, 'host', published.id)).reviewStatus, 'PENDING');
  } finally { await db.close(); }
});
