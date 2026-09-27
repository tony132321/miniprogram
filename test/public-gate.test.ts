import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft, getEvent, publishEvent, rotateInvite } from '../src/events.ts';
import { reviewEvent } from '../src/event-review.ts';
import { approveRegistration, cancelRegistration, claimReservation, register, removeRegistration, reserveSeats } from '../src/registrations.ts';
import { confirmEvent } from '../src/lifecycle.ts';
import { createApp } from '../src/server.ts';
import { recordShareIntent } from '../src/sharing.ts';
import { setPublicGate } from '../src/public-gate.ts';
import { runDueJobs } from '../src/jobs.ts';

const input = {
  title: '全局暂停测试', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'PUBLIC', approvalMode: 'MANUAL', hostParticipates: true
};

test('public gate notice timestamps follow a strictly ordered database transition', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', { ...input, hostParticipates: false }, 'timestamp-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'timestamp-publish');
    await reviewEvent(db, 'ops', event.id, event.version, 'APPROVED', '场地与活动资料已核实', 'timestamp-review');
    await db.query("UPDATE public_recruitment_gate SET changed_at='2030-01-01T00:00:00.123456Z' WHERE id=1");
    await setPublicGate(db, 'ops', 'CLOSED', '暂停招募检查时间顺序', 'timestamp-close');
    await setPublicGate(db, 'ops', 'OPEN', '核查结束恢复招募', 'timestamp-open');
    const { rows } = await db.query<{ monotonic: boolean; exact_jobs: boolean; jobs_ordered: boolean; exact_audit: boolean }>(`SELECT
      (SELECT changed_at>'2030-01-01T00:00:00.123456Z'::timestamptz FROM public_recruitment_gate WHERE id=1) AS monotonic,
      bool_and(j.created_at=j.due_at) AS exact_jobs,
      max(j.created_at) FILTER (WHERE j.payload->>'status'='CLOSED') <
        min(j.created_at) FILTER (WHERE j.payload->>'status'='OPEN') AS jobs_ordered,
      (SELECT bool_and(a.created_at=(SELECT min(created_at) FROM jobs
        WHERE kind='PUBLIC_GATE_NOTICE' AND payload->>'status'=substring(a.action from 20)))
        FROM audit a WHERE a.action LIKE 'PUBLIC_RECRUITMENT_%') AS exact_audit
      FROM jobs j WHERE j.kind='PUBLIC_GATE_NOTICE'`);
    assert.deepEqual(rows[0], { monotonic: true, exact_jobs: true, jobs_ordered: true, exact_audit: true });
    const { rows: precise } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM jobs j
      WHERE j.kind='PUBLIC_GATE_NOTICE' AND j.payload->>'status'='OPEN'
        AND j.created_at=(SELECT changed_at FROM public_recruitment_gate WHERE id=1)`);
    assert.equal(precise[0]?.n, 1);
    await runDueJobs(db, Date.parse('2031-01-01T00:00:00.000Z'));
    const { rows: notices } = await db.query<{ total: number; exact: number }>(`SELECT
      count(*)::int AS total,count(*) FILTER (WHERE n.created_at=j.created_at)::int AS exact
      FROM jobs j JOIN notifications n ON n.id=j.id WHERE j.kind='PUBLIC_GATE_NOTICE'`);
    assert.deepEqual(notices[0], { total: 2, exact: 2 });
  } finally { await db.close(); }
});

test('safety operator can close and reopen public recruitment with an auditable reason', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  async function call(path: string, actor: string, method = 'GET', body?: unknown, key = 'gate-key') {
    const response = await fetch(base + path, { method, headers: { 'X-Dev-User': actor,
      ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': key } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() as Record<string, any> };
  }
  try {
    assert.equal((await call('/ops/public-recruitment', 'host')).status, 403);
    assert.equal((await call('/ops/public-recruitment', 'ops')).body.status, 'OPEN');
    const close = await call('/ops/public-recruitment', 'ops', 'POST', { status: 'CLOSED', reason: '核查公开活动安全事件' });
    assert.equal(close.status, 200);
    assert.equal(close.body.status, 'CLOSED');
    assert.equal((await call('/ops/public-recruitment', 'ops', 'POST', { status: 'CLOSED', reason: '核查公开活动安全事件' })).body.status, 'CLOSED');
    assert.equal((await call('/ops/public-recruitment', 'host', 'POST', { status: 'OPEN', reason: '违规解除暂停' }, 'host-key')).status, 403);
    assert.equal((await call('/ops/public-recruitment', 'ops', 'POST', { status: 'OPEN', reason: '短' }, 'bad-key')).status, 400);
    assert.equal((await call('/ops/public-recruitment', 'ops')).body.status, 'CLOSED');
    assert.equal((await call('/ops/public-recruitment', 'ops', 'POST', { status: 'OPEN', reason: '完成安全核查允许恢复' }, 'open-key')).body.status, 'OPEN');
    const audit = await db.query<{ action: string }>("SELECT action FROM audit WHERE action LIKE 'PUBLIC_RECRUITMENT_%' ORDER BY created_at");
    assert.deepEqual(audit.rows.map(row => row.action), ['PUBLIC_RECRUITMENT_CLOSED', 'PUBLIC_RECRUITMENT_OPEN']);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('closed gate blocks new public recruitment while keeping members and private activities usable', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  async function close() {
    const response = await fetch(base + '/ops/public-recruitment', { method: 'POST', headers: { 'X-Dev-User': 'ops',
      'Content-Type': 'application/json', 'Idempotency-Key': 'close' }, body: JSON.stringify({ status: 'CLOSED', reason: '核查公开活动安全事件' }) });
    assert.equal(response.status, 200);
  }
  try {
    const draft = await createDraft(db, 'host', input, 'public-draft');
    const published = await publishEvent(db, 'host', draft.id, draft.version, 'public-publish');
    await reviewEvent(db, 'ops', published.id, published.version, 'APPROVED', '核对活动地点时间费用', 'public-approve');
    const member = await register(db, 'member', published.id, published.version, 'member-join', null);
    const removedMember = await register(db, 'removed-member', published.id, published.version, 'removed-join', null);
    const reserved = await reserveSeats(db, 'host', published.id, published.version, 1, 'reserve-before-close');
    const privateDraft = await createDraft(db, 'private-host', { ...input, visibility: 'INVITE', approvalMode: 'AUTO' }, 'private-draft');
    const privateEvent = await publishEvent(db, 'private-host', privateDraft.id, privateDraft.version, 'private-publish');
    await close();
    assert.equal((await fetch(base + `/i/${published.inviteToken}`)).status, 404);
    await assert.rejects(() => getEvent(db, 'outsider', published.id), { code: 'FORBIDDEN' });
    assert.equal((await getEvent(db, 'member', published.id)).id, published.id);
    await assert.rejects(() => register(db, 'newcomer', published.id, published.version, 'new-join', null), { code: 'PUBLIC_RECRUITMENT_PAUSED' });
    await assert.rejects(() => reserveSeats(db, 'host', published.id, published.version, 1, 'public-reserve'), { code: 'PUBLIC_RECRUITMENT_PAUSED' });
    await assert.rejects(() => claimReservation(db, 'reserved-person', reserved[0]!.token, published.version, 'claim-closed'),
      { code: 'PUBLIC_RECRUITMENT_PAUSED' });
    await assert.rejects(() => approveRegistration(db, 'host', member.id, published.version, 'approve-closed'),
      { code: 'PUBLIC_RECRUITMENT_PAUSED' });
    await assert.rejects(() => confirmEvent(db, 'host', published.id, published.version, 'confirm-closed'),
      { code: 'PUBLIC_RECRUITMENT_PAUSED' });
    await assert.rejects(() => recordShareIntent(db, 'host', published.id, published.version, 'a'.repeat(32), 'public-share'),
      { code: 'PUBLIC_RECRUITMENT_PAUSED' });
    await assert.rejects(() => rotateInvite(db, 'host', published.id, published.version, 'public-rotate'),
      { code: 'PUBLIC_RECRUITMENT_PAUSED' });
    const newDraft = await createDraft(db, 'host', input, 'new-public-draft');
    await assert.rejects(() => publishEvent(db, 'host', newDraft.id, newDraft.version, 'new-public-publish'), { code: 'PUBLIC_RECRUITMENT_PAUSED' });
    assert.equal((await register(db, 'private-host', privateEvent.id, privateEvent.version, 'private-join', null)).status, 'CONFIRMED');
    assert.equal((await cancelRegistration(db, 'member', member.id, published.version, 'member-exit')).status, 'CANCELLED');
    assert.equal((await getEvent(db, 'member', published.id)).id, published.id);
    await removeRegistration(db, 'host', removedMember.id, published.version, '需要复核参与者安全举报', 'remove-member');
    assert.equal((await getEvent(db, 'removed-member', published.id)).id, published.id);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('closed gate prevents a pending public approval from reopening recruitment', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'pending-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'pending-publish');
    await setPublicGate(db, 'ops', 'CLOSED', '核查公开活动安全事件', 'pending-close');
    await assert.rejects(() => reviewEvent(db, 'ops', event.id, event.version, 'APPROVED', '核对活动地点时间费用', 'blocked-approval'),
      { code: 'PUBLIC_RECRUITMENT_PAUSED' });
    assert.equal((await db.query<{ review_status: string }>('SELECT review_status FROM events WHERE id=$1', [event.id])).rows[0]?.review_status, 'PENDING');
    assert.equal((await reviewEvent(db, 'ops', event.id, event.version, 'REJECTED', '场地安全事实无法确认', 'rejected')).reviewStatus, 'REJECTED');
  } finally { await db.close(); }
});

test('gate changes create durable in-app notices for active public hosts and registrants only', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'public-host', { ...input, hostParticipates: false }, 'notice-public-draft');
    const event = await publishEvent(db, 'public-host', draft.id, draft.version, 'notice-public-publish');
    await reviewEvent(db, 'ops', event.id, event.version, 'APPROVED', '核对活动地点时间费用', 'notice-review');
    await register(db, 'active-member', event.id, event.version, 'active-join', null);
    const departed = await register(db, 'departed-member', event.id, event.version, 'departed-join', null);
    await cancelRegistration(db, 'departed-member', departed.id, event.version, 'departed-exit');
    const removed = await register(db, 'removed-member', event.id, event.version, 'removed-join', null);
    await removeRegistration(db, 'public-host', removed.id, event.version, '需要复核报名情况', 'removed');
    const privateDraft = await createDraft(db, 'private-host', { ...input, visibility: 'INVITE', approvalMode: 'AUTO' }, 'notice-private-draft');
    await publishEvent(db, 'private-host', privateDraft.id, privateDraft.version, 'notice-private-publish');
    const pendingDraft = await createDraft(db, 'pending-host', input, 'notice-pending-draft');
    await publishEvent(db, 'pending-host', pendingDraft.id, pendingDraft.version, 'notice-pending-publish');
    await createDraft(db, 'draft-host', input, 'unpublished-public');

    await setPublicGate(db, 'ops', 'CLOSED', '私密调查原因不得外泄', 'notice-close');
    await setPublicGate(db, 'ops', 'CLOSED', '私密调查原因不得外泄', 'notice-close');
    const queued = await db.query<{ payload: { userId: string; eventId: string; status: string } }>(
      "SELECT payload FROM jobs WHERE kind='PUBLIC_GATE_NOTICE' ORDER BY payload->>'userId'");
    assert.deepEqual(queued.rows.map(row => row.payload.userId), ['active-member', 'public-host']);
    assert.ok(queued.rows.every(row => row.payload.eventId === event.id && row.payload.status === 'CLOSED'));
    await runDueJobs(db);
    const closed = await db.query<{ id: string; user_id: string; kind: string; detail: Record<string, unknown>; external_status: string }>(
      "SELECT id,user_id,kind,detail,external_status FROM notifications WHERE kind='PUBLIC_RECRUITMENT_CLOSED' ORDER BY user_id");
    assert.deepEqual(closed.rows.map(row => row.user_id), ['active-member', 'public-host']);
    assert.ok(closed.rows.every(row => row.external_status === 'UNAVAILABLE' && !JSON.stringify(row.detail).includes('私密调查')));
    await db.query("UPDATE jobs SET status='PENDING' WHERE kind='PUBLIC_GATE_NOTICE'");
    await runDueJobs(db);
    assert.equal((await db.query("SELECT id FROM notifications WHERE kind='PUBLIC_RECRUITMENT_CLOSED'")).rows.length, 2);

    await setPublicGate(db, 'ops', 'OPEN', '人工复核后恢复招募', 'notice-open');
    await runDueJobs(db);
    const opened = await db.query<{ user_id: string }>("SELECT user_id FROM notifications WHERE kind='PUBLIC_RECRUITMENT_OPEN' ORDER BY user_id");
    assert.deepEqual(opened.rows.map(row => row.user_id), ['active-member', 'public-host']);
  } finally { await db.close(); }
});

test('a delayed close notice remains older than a later reopening notice', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'ordered-draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'ordered-publish');
    await reviewEvent(db, 'ops', event.id, event.version, 'APPROVED', '核对活动地点时间费用', 'ordered-review');
    await setPublicGate(db, 'ops', 'CLOSED', '核查公开活动安全事件', 'ordered-close');
    await db.query("UPDATE jobs SET status='PROCESSING',locked_at=now() WHERE kind='PUBLIC_GATE_NOTICE' AND payload->>'status'='CLOSED'");
    const closeJob = await db.query<{ created_at: Date }>("SELECT created_at FROM jobs WHERE kind='PUBLIC_GATE_NOTICE' AND payload->>'status'='CLOSED'");
    await setPublicGate(db, 'ops', 'OPEN', '核查完成允许继续招募', 'ordered-open');
    await runDueJobs(db);
    await db.query("UPDATE jobs SET locked_at=now()-interval '6 minutes' WHERE kind='PUBLIC_GATE_NOTICE' AND payload->>'status'='CLOSED'");
    await runDueJobs(db);
    const { rows } = await db.query<{ kind: string; created_at: Date }>("SELECT kind,created_at FROM notifications WHERE user_id='host' AND kind LIKE 'PUBLIC_RECRUITMENT_%' ORDER BY created_at DESC");
    assert.deepEqual(rows.map(row => row.kind), ['PUBLIC_RECRUITMENT_OPEN', 'PUBLIC_RECRUITMENT_CLOSED']);
    assert.equal(new Date(rows[1]!.created_at).toISOString(), new Date(closeJob.rows[0]!.created_at).toISOString());
  } finally { await db.close(); }
});
