import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createDatabase } from '../src/db.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { reviewHostStatus } from '../src/host-limits.ts';
import { approveAiAction, executeAiAction, prepareAiAction } from '../src/ai-actions.ts';
import { createApp } from '../src/server.ts';
import { createOperatorEnrollment, loginOperator, totpCode } from '../src/operator-auth.ts';
import { changeEvent, previewEventChange } from '../src/lifecycle.ts';

const input = {
  title: '周末羽毛球', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'AA', feeCapFen: 5000,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
};

test('new real host cannot submit more than one activity in seven days; replay is safe', async () => {
  const db = await createDatabase();
  try {
    const one = await createDraft(db, 'host', input, 'host-first-draft', false);
    const first = await publishEvent(db, 'host', one.id, one.version, 'host-first-publish');
    assert.deepEqual(await publishEvent(db, 'host', one.id, one.version, 'host-first-publish'), first);
    const two = await createDraft(db, 'host', input, 'host-second-draft', false);
    await assert.rejects(() => publishEvent(db, 'host', two.id, two.version, 'host-second-publish'),
      { code: 'NEW_HOST_FREQUENCY_LIMIT' });
    const { rows } = await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [two.id]);
    assert.equal(rows[0]?.status, 'DRAFT');
  } finally { await db.close(); }
});

test('new real host cannot submit an activity above the participant cap', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', { ...input, maxParticipants: 7 }, 'cap-draft', false);
    await assert.rejects(() => publishEvent(db, 'host', draft.id, draft.version, 'cap-publish'),
      { code: 'NEW_HOST_PARTICIPANT_LIMIT' });
  } finally { await db.close(); }
});

test('audited SAFETY review promotes a host and removes new-host caps', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('host','synthetic-review-host')");
    await assert.rejects(() => reviewHostStatus(db, 'host', 'host', 'ESTABLISHED', '本人审批', 'self'),
      { code: 'FORBIDDEN' });
    const promoted = await reviewHostStatus(db, 'operator:safety', 'host', 'ESTABLISHED',
      '人工核验主办方历史及活动表现', 'promote');
    assert.equal(promoted.status, 'ESTABLISHED');
    assert.deepEqual(await reviewHostStatus(db, 'operator:safety', 'host', 'ESTABLISHED',
      '人工核验主办方历史及活动表现', 'promote'), promoted);
    for (let i = 0; i < 2; i++) {
      const draft = await createDraft(db, 'host', { ...input, maxParticipants: 8 }, `promoted-draft-${i}`, false);
      await publishEvent(db, 'host', draft.id, draft.version, `promoted-publish-${i}`);
    }
    const { rows } = await db.query<{ action: string }>("SELECT action FROM audit WHERE action='HOST_STATUS_REVIEW'");
    assert.equal(rows.length, 1);
  } finally { await db.close(); }
});

test('SAFETY review cannot pre-authorize a user ID that does not exist', async () => {
  const db = await createDatabase();
  try {
    await assert.rejects(() => reviewHostStatus(db, 'operator:safety', 'future-host', 'ESTABLISHED',
      '尚不存在的用户不得提前晋级', 'future-host-review'), { code: 'NOT_FOUND' });
    const { rows } = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM host_publication_status WHERE host_id='future-host'");
    assert.equal(rows[0]?.count, 0);
  } finally { await db.close(); }
});

test('parallel real submissions share a durable per-host limit', async () => {
  const db = await createDatabase();
  try {
    const drafts = await Promise.all([0, 1].map(i => createDraft(db, 'host', input, `parallel-draft-${i}`, false)));
    const settled = await Promise.allSettled(drafts.map((draft, i) =>
      publishEvent(db, 'host', draft.id, draft.version, `parallel-publish-${i}`)));
    assert.equal(settled.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(settled.filter(result => result.status === 'rejected' &&
      (result.reason as { code?: string }).code === 'NEW_HOST_FREQUENCY_LIMIT').length, 1);
  } finally { await db.close(); }
});

test('legacy real publication without audit still counts from its last activity update', async () => {
  const db = await createDatabase();
  try {
    const first = await createDraft(db, 'host', input, 'legacy-first-draft', false);
    await db.query("UPDATE events SET created_at=now()-interval '30 days' WHERE id=$1", [first.id]);
    const published = await publishEvent(db, 'host', first.id, first.version, 'legacy-first-publish');
    await db.query('DELETE FROM business_events WHERE event_uuid IN (SELECT id FROM audit WHERE event_id=$1)', [published.id]);
    await db.query('DELETE FROM audit WHERE event_id=$1', [published.id]);
    await db.query("UPDATE event_versions SET created_at=now()-interval '30 days' WHERE event_id=$1", [published.id]);
    const second = await createDraft(db, 'host', input, 'legacy-second-draft', false);
    await assert.rejects(() => publishEvent(db, 'host', second.id, second.version, 'legacy-second-publish'),
      { code: 'NEW_HOST_FREQUENCY_LIMIT' });
  } finally { await db.close(); }
});

test('AI approved publish still obeys the same real-host limit', async () => {
  const db = await createDatabase();
  try {
    const first = await createDraft(db, 'host', input, 'ai-first-draft', false);
    await publishEvent(db, 'host', first.id, first.version, 'ai-first-publish');
    const second = await createDraft(db, 'host', input, 'ai-second-draft', false);
    const proposal = { kind: 'PUBLISH_EVENT' as const, eventId: second.id,
      expectedVersion: second.version, payload: second.payload };
    const prepared = await prepareAiAction(db, 'host', proposal, 'ai-prepare');
    await approveAiAction(db, 'host', prepared.id, true, prepared.payloadHash, 'ai-approve');
    await assert.rejects(() => executeAiAction(db, 'host', prepared.id,
      { ...proposal, payloadHash: prepared.payloadHash }, 'ai-execute'),
    { code: 'NEW_HOST_FREQUENCY_LIMIT' });
    const { rows } = await db.query<{ status: string }>('SELECT status FROM events WHERE id=$1', [second.id]);
    assert.equal(rows[0]?.status, 'DRAFT');
  } finally { await db.close(); }
});

test('new host cannot raise a published activity above the cap through change or preview', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'change-cap-draft', false);
    const published = await publishEvent(db, 'host', draft.id, draft.version, 'change-cap-publish');
    await assert.rejects(() => previewEventChange(db, 'host', published.id, published.version,
      { maxParticipants: 7 }), { code: 'NEW_HOST_PARTICIPANT_LIMIT' });
    await assert.rejects(() => changeEvent(db, 'host', published.id, published.version,
      { maxParticipants: 7 }, 'change-cap'), { code: 'NEW_HOST_PARTICIPANT_LIMIT' });
    const { rows } = await db.query<{ max: number }>(
      "SELECT (payload->>'maxParticipants')::int AS max FROM events WHERE id=$1", [published.id]);
    assert.equal(rows[0]?.max, 6);
  } finally { await db.close(); }
});

test('only SAFETY operator route can promote a host', async () => {
  const db = await createDatabase();
  await db.query("INSERT INTO users(id,wechat_openid) VALUES('host','synthetic-route-host')");
  const password = 'correct horse battery staple';
  const account = { ...createOperatorEnrollment('safety', password), permissions: ['SAFETY'] };
  const reports = { ...createOperatorEnrollment('reports', password), permissions: ['REPORTS'] };
  const server = createApp(db, { environment: 'test', devAuth: true,
    checkInSecret: 'test-secret', operatorAccounts: [account, reports] });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const post = async (authorization: string | null, key: string, hostId = 'host') => {
      const response = await fetch(`${base}/ops/hosts/${hostId}/status`, { method: 'POST', headers: {
        ...(authorization ? { Authorization: authorization } : { 'X-Dev-User': 'host' }),
        'Idempotency-Key': key, 'Content-Type': 'application/json'
      }, body: JSON.stringify({ status: 'ESTABLISHED', reason: '人工核验主办活动经历' }) });
      return { status: response.status, body: await response.json() as { status?: string; code?: string } };
    };
    assert.equal((await post(null, 'bad-actor')).status, 403);
    const other = await loginOperator(db, reports, 'reports', password, totpCode(reports.totpSecret));
    assert.equal((await post(`Bearer ${other.token}`, 'wrong-scope')).status, 403);
    const { token } = await loginOperator(db, account, 'safety', password, totpCode(account.totpSecret));
    const missing = await post(`Bearer ${token}`, 'missing-host', 'future-host');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'NOT_FOUND');
    const allowed = await post(`Bearer ${token}`, 'approved');
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.status, 'ESTABLISHED');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});
