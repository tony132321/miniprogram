import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from '../src/db.ts';
import { createDraft, getEvent, publishEvent } from '../src/events.ts';
import { changeEvent } from '../src/lifecycle.ts';
import { createCheckInToken, checkIn, getPendingReconfirmation } from '../src/lifecycle.ts';
import { listPendingEventReviews, reviewEvent } from '../src/event-review.ts';
import { cancelRegistration, register } from '../src/registrations.ts';
import { recordShareIntent } from '../src/sharing.ts';
import { createApp } from '../src/server.ts';
import { getPilotMetrics } from '../src/metrics.ts';
import { openSyntheticPublicCoverage } from './helpers/public-coverage.ts';
import { askCurrentFact } from '../src/collaboration.ts';
import { buildAiEventContext } from '../src/ai-context.ts';
import { listContent } from '../src/collaboration.ts';

const input = {
  title: '邀请制球局审核', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共羽毛球馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
};

test('invite text waits for human review when no moderation provider is configured, including every later edit', async () => {
  const db = await createDatabase();
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const read = async (path: string, actor = 'member') => {
    const response = await fetch(base + path, { headers: { 'X-Dev-User': actor } });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    const draft = await createDraft(db, 'host', input, 'invite-draft', false);
    const pending = await publishEvent(db, 'host', draft.id, draft.version, 'invite-publish');
    assert.equal(pending.reviewStatus, 'PENDING');
    assert.equal(pending.recruiting, false);
    const publicationEvents = (await db.query<{ event_name: string }>(
      'SELECT event_name FROM business_events WHERE activity_id=$1 ORDER BY occurred_at,event_uuid', [pending.id]))
      .rows.map(row => row.event_name);
    assert.ok(publicationEvents.includes('INVITE_REVIEW_SUBMITTED'));
    assert.equal(publicationEvents.includes('ACTIVITY_PUBLISHED'), false);
    const matureCutoff = Date.now() + 35 * 24 * 60 * 60_000;
    assert.equal((await getPilotMetrics(db, matureCutoff, ['host'])).hostReuse28d.maturedHosts, 0);
    assert.equal((await listPendingEventReviews(db)).items[0]?.id, pending.id);
    assert.equal((await read(`/i/${pending.inviteToken}`)).status, 404);
    await db.query('UPDATE events SET recruiting=true WHERE id=$1', [pending.id]);
    await assert.rejects(() => recordShareIntent(db, 'host', pending.id, pending.version, 'd'.repeat(32), 'tampered-share'),
      { code: 'REVIEW_PENDING' });
    await assert.rejects(() => register(db, 'member', pending.id, pending.version, 'tampered-join', pending.inviteToken!),
      { code: 'REVIEW_PENDING' });
    await db.query('UPDATE events SET recruiting=false WHERE id=$1', [pending.id]);
    await assert.rejects(() => recordShareIntent(db, 'host', pending.id, pending.version, 'a'.repeat(32), 'pending-share'),
      { code: 'REVIEW_PENDING' });
    await assert.rejects(() => register(db, 'member', pending.id, pending.version, 'pending-join', pending.inviteToken!),
      { code: 'REVIEW_PENDING' });

    const approved = await reviewEvent(db, 'ops', pending.id, pending.version, 'APPROVED', '已人工核对邀请活动文本', 'invite-approve');
    assert.equal(approved.reviewStatus, 'APPROVED');
    assert.equal(approved.recruiting, true);
    assert.equal((await getPilotMetrics(db, matureCutoff, ['host'])).hostReuse28d.maturedHosts, 1);
    assert.equal((await read(`/i/${approved.inviteToken ?? pending.inviteToken}`)).status, 200);
    await recordShareIntent(db, 'host', approved.id, approved.version, 'b'.repeat(32), 'approved-share');
    const registration = await register(db, 'member', approved.id, approved.version, 'approved-join', pending.inviteToken!);
    assert.equal(registration.status, 'CONFIRMED');

    const changed = await changeEvent(db, 'host', approved.id, approved.version, { title: '更新后待审标题' }, 'invite-edit');
    assert.equal(changed.reviewStatus, 'PENDING');
    assert.equal(changed.recruiting, false);
    assert.equal((await read(`/i/${pending.inviteToken}`)).status, 404);
    const memberView = await read(`/events/${approved.id}`);
    assert.equal(memberView.status, 200);
    assert.equal(memberView.body.payload.title, input.title);
    assert.equal(memberView.body.version, changed.version);
    assert.equal(memberView.body.visibleContentVersion, approved.version);
    assert.equal(memberView.body.reviewStatus, 'PENDING');
    assert.equal(JSON.stringify(memberView.body).includes('更新后待审标题'), false);
    const summary = await read('/me/events');
    assert.equal(summary.body.items[0]?.title, '活动审核中');
    const report = await fetch(base + '/reports', { method: 'POST', headers: {
      'X-Dev-User': 'member', 'Idempotency-Key': 'pending-report', 'Content-Type': 'application/json'
    }, body: JSON.stringify({ eventId: approved.id, kind: 'SAFETY', description: '活动待审期间仍需可举报安全问题' }) });
    assert.equal(report.status, 201);
    const exit = await fetch(base + `/registrations/${registration.id}/cancel`, { method: 'POST', headers: {
      'X-Dev-User': 'member', 'Idempotency-Key': 'pending-exit', 'Content-Type': 'application/json'
    }, body: JSON.stringify({ expectedVersion: changed.version }) });
    assert.equal(exit.status, 200);
    await assert.rejects(() => recordShareIntent(db, 'host', changed.id, changed.version, 'c'.repeat(32), 'edited-share'),
      { code: 'REVIEW_PENDING' });
    const reapproved = await reviewEvent(db, 'ops', changed.id, changed.version, 'APPROVED', '已人工复核更新后标题', 'invite-reapprove');
    assert.equal(reapproved.recruiting, true);
    assert.equal((await read(`/i/${pending.inviteToken}`)).body.title, '更新后待审标题');
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await db.close(); }
});

test('an existing member without any previously approved content receives a redacted safe view', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'unreviewed-draft');
    const pending = await publishEvent(db, 'host', draft.id, draft.version, 'unreviewed-publish');
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status,accepted_version)
      VALUES('pre-review-member',$1,'pre-review-member','CONFIRMED',$2)`, [pending.id, pending.version]);
    const member = await getEvent(db, 'pre-review-member', pending.id);
    assert.equal(member.payload.title, '活动审核中');
    assert.equal(member.payload.venueName, undefined);
    assert.equal(member.visibleContentVersion, null);
    assert.equal(member.venueEvidence, undefined);
    assert.equal(JSON.stringify(member).includes(input.title), false);
  } finally { await db.close(); }
});

test('PUBLIC and INVITE members see only approved logistics while edits are pending or rejected', async () => {
  const db = await createDatabase();
  try {
    await openSyntheticPublicCoverage(db, [input]);
    for (const visibility of ['INVITE', 'PUBLIC'] as const) {
      const source = { ...input, visibility, approvalMode: visibility === 'PUBLIC' ? 'MANUAL' : 'AUTO',
        title: `${visibility} 已审标题`, venueName: `${visibility} 已审场馆` };
      const draft = await createDraft(db, `${visibility}-host`, source, `${visibility}-draft`);
      const pending = await publishEvent(db, `${visibility}-host`, draft.id, draft.version, `${visibility}-publish`);
      const approved = await reviewEvent(db, 'ops', pending.id, pending.version, 'APPROVED', '核对活动原始文字', `${visibility}-approve`);
      const joined = await register(db, `${visibility}-member`, approved.id, approved.version,
        `${visibility}-join`, visibility === 'INVITE' ? pending.inviteToken! : null);
      if (visibility === 'PUBLIC') await db.query(
        "UPDATE registrations SET status='CONFIRMED',accepted_version=$2 WHERE id=$1", [joined.id, approved.version]);
      const changed = await changeEvent(db, `${visibility}-host`, approved.id, approved.version,
        { title: `${visibility} 未审标题`, venueName: `${visibility} 未审场馆`, venueStatus: 'HOST_CONFIRMED' }, `${visibility}-edit`);
      const member = await getEvent(db, `${visibility}-member`, changed.id);
      assert.equal(member.version, changed.version);
      assert.equal(member.visibleContentVersion, approved.version);
      assert.equal(member.payload.title, source.title);
      assert.equal(member.payload.venueName, source.venueName);
      assert.equal(member.venueEvidence?.venueName, source.venueName);
      assert.equal(await getPendingReconfirmation(db, `${visibility}-member`, changed.id), null);
      assert.equal(JSON.stringify(member).includes(`${visibility} 未审`), false);
      const notice = (await listContent(db, `${visibility}-member`, changed.id))
        .find(item => item.kind === 'ANNOUNCEMENT' && item.event_version === changed.version);
      assert.ok(notice);
      assert.match(notice.body, /审核中/);
      assert.equal(notice.body.includes('请以当前详情为准'), false);
      const fact = await askCurrentFact(db, `${visibility}-member`, changed.id,
        '场地在哪里', `${visibility}-pending-fact`);
      assert.match(fact.answer, new RegExp(`已审核版本 ${approved.version}`));
      assert.equal(fact.eventVersion, approved.version);
      assert.equal(fact.answer.includes(`${visibility} 未审`), false);
      const aiContext = await buildAiEventContext(db, `${visibility}-member`, changed.id);
      assert.equal(aiContext.event.version, changed.version);
      assert.equal(aiContext.event.visibleContentVersion, approved.version);
      assert.equal(aiContext.event.venueName, source.venueName);
      await reviewEvent(db, 'ops', changed.id, changed.version, 'REJECTED', '新标题及场馆未通过审核', `${visibility}-reject`);
      const rejected = await getEvent(db, `${visibility}-member`, changed.id);
      assert.equal(rejected.reviewStatus, 'REJECTED');
      assert.equal(rejected.payload.title, source.title);
      assert.equal(rejected.payload.venueName, source.venueName);
      assert.equal(JSON.stringify(rejected).includes(`${visibility} 未审`), false);
      await cancelRegistration(db, `${visibility}-member`, joined.id, changed.version, `${visibility}-exit`);
    }
  } finally { await db.close(); }
});

test('legacy confirmed invite near start keeps prior member logistics and check-in if review misses start', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-near-start-review-'));
  try {
    const db = await createDatabase(directory);
    const startAt = Date.now() + 10 * 60_000;
    const prior = { ...input, title: '已发布临近开场活动', startAt: new Date(startAt).toISOString(),
      endAt: new Date(startAt + 60 * 60_000).toISOString(),
      confirmationDeadline: new Date(Date.now() - 60 * 60_000).toISOString(),
      registrationDeadline: new Date(Date.now() - 30 * 60_000).toISOString() };
    try {
      await db.query(`INSERT INTO events(id,host_id,status,version,payload,recruiting,review_status,invite_token,invite_expires_at)
        VALUES('legacy-near-start','host','CONFIRMED',3,$1,false,'NOT_REQUIRED','near-start-token',$2)`,
        [JSON.stringify(prior), prior.registrationDeadline]);
      await db.query('INSERT INTO event_versions(event_id,version,payload) VALUES($1,$2,$3)',
        ['legacy-near-start', 3, JSON.stringify(prior)]);
      await db.query(`INSERT INTO registrations(id,event_id,user_id,status,accepted_version)
        VALUES('legacy-near-start-member','legacy-near-start','member','CONFIRMED',3)`);
      await db.query('DELETE FROM schema_migrations WHERE version=48');
    } finally { await db.close(); }
    const upgraded = await createDatabase(directory);
    try {
      assert.equal((await getEvent(upgraded, 'host', 'legacy-near-start')).reviewStatus, 'PENDING');
      const member = await getEvent(upgraded, 'member', 'legacy-near-start');
      assert.equal(member.payload.title, prior.title);
      assert.equal(member.visibleContentVersion, 3);
      const now = Date.now();
      const token = createCheckInToken(member.id, 'secret', now);
      assert.equal((await checkIn(upgraded, 'member', member.id, member.version, token, 'secret',
        'legacy-near-start-checkin', now)).userId, 'member');
      await upgraded.query("UPDATE events SET status='IN_PROGRESS' WHERE id='legacy-near-start'");
      assert.equal((await getEvent(upgraded, 'member', member.id)).payload.title, prior.title);
      await assert.rejects(() => reviewEvent(upgraded, 'ops', member.id, member.version, 'APPROVED',
        '已经越过活动开始时间', 'legacy-late-approve'), { code: 'REVIEW_WINDOW_CLOSED' });
      await reviewEvent(upgraded, 'ops', member.id, member.version, 'REJECTED',
        '错过审核窗口，转人工处置', 'legacy-late-reject');
      assert.equal((await getEvent(upgraded, 'member', member.id)).payload.title, prior.title);
    } finally { await upgraded.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('confirmed invite participants retain reviewed details and check-in access after pending edit and start', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'confirmed-draft');
    const pending = await publishEvent(db, 'host', draft.id, draft.version, 'confirmed-publish');
    const approved = await reviewEvent(db, 'ops', pending.id, pending.version, 'APPROVED', '核对活动场地和标题', 'confirmed-approve');
    await register(db, 'member', approved.id, approved.version, 'confirmed-join', pending.inviteToken!);
    await db.query("UPDATE events SET status='CONFIRMED' WHERE id=$1", [approved.id]);
    const changed = await changeEvent(db, 'host', approved.id, approved.version,
      { title: '待审开始前改动' }, 'confirmed-edit');
    const beforeStart = await getEvent(db, 'member', changed.id);
    assert.equal(beforeStart.payload.title, input.title);
    assert.equal(beforeStart.visibleContentVersion, approved.version);
    const fakeCheckInAt = Date.parse(input.startAt!) - 10 * 60_000;
    const token = createCheckInToken(changed.id, 'secret', fakeCheckInAt);
    assert.equal((await checkIn(db, 'member', changed.id, changed.version, token, 'secret',
      'confirmed-checkin', fakeCheckInAt)).userId, 'member');
    await db.query("UPDATE events SET status='IN_PROGRESS' WHERE id=$1", [changed.id]);
    const afterStart = await getEvent(db, 'member', changed.id);
    assert.equal(afterStart.payload.title, input.title);
    assert.equal(afterStart.reviewStatus, 'PENDING');
    assert.equal(afterStart.status, 'IN_PROGRESS');
  } finally { await db.close(); }
});

test('upgrade quarantines active legacy invites without losing their review path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'project-irl-invite-review-upgrade-'));
  try {
    const db = await createDatabase(directory);
    try {
      await db.query(`INSERT INTO events(id,host_id,status,version,payload,recruiting,review_status,invite_token,invite_expires_at)
        VALUES('legacy-invite','host','RECRUITING',2,$1,true,'NOT_REQUIRED','legacy-token',$2)`,
        [JSON.stringify(input), input.registrationDeadline]);
      await db.query('INSERT INTO event_versions(event_id,version,payload) VALUES($1,$2,$3)',
        ['legacy-invite', 2, JSON.stringify(input)]);
      await db.query(`INSERT INTO registrations(id,event_id,user_id,status,accepted_version)
        VALUES('legacy-invite-member','legacy-invite','legacy-member','CONFIRMED',2)`);
      const ended = { ...input, startAt: '2026-01-02T12:00:00.000Z', endAt: '2026-01-02T14:00:00.000Z',
        registrationDeadline: '2026-01-02T11:30:00.000Z', confirmationDeadline: '2026-01-02T10:30:00.000Z' };
      await db.query(`INSERT INTO events(id,host_id,status,version,payload,recruiting,review_status,invite_token,invite_expires_at)
        VALUES('legacy-started','host','CONFIRMED',3,$1,false,'NOT_REQUIRED','started-token',$2)`,
        [JSON.stringify(ended), ended.registrationDeadline]);
      await db.query(`INSERT INTO registrations(id,event_id,user_id,status,accepted_version)
        VALUES('legacy-member','legacy-started','member','CONFIRMED',3)`);
      const soon = Date.now() + 60 * 60_000;
      const cutoff = { ...input, startAt: new Date(soon).toISOString(),
        endAt: new Date(soon + 60 * 60_000).toISOString(),
        registrationDeadline: new Date(soon - 15 * 60_000).toISOString(),
        confirmationDeadline: new Date(Date.now() - 60_000).toISOString() };
      await db.query(`INSERT INTO events(id,host_id,status,version,payload,recruiting,review_status,invite_token,invite_expires_at)
        VALUES('legacy-cutoff','host','RECRUITING',2,$1,true,'NOT_REQUIRED','cutoff-token',$2)`,
        [JSON.stringify(cutoff), cutoff.registrationDeadline]);
      await db.query(`INSERT INTO registrations(id,event_id,user_id,status,accepted_version)
        VALUES('legacy-cutoff-member','legacy-cutoff','member','CONFIRMED',2)`);
      await db.query('DELETE FROM schema_migrations WHERE version=48');
    } finally { await db.close(); }
    const upgraded = await createDatabase(directory);
    try {
      const event = await getEvent(upgraded, 'host', 'legacy-invite');
      assert.equal(event.reviewStatus, 'PENDING');
      assert.equal(event.recruiting, false);
      const legacyMember = await getEvent(upgraded, 'legacy-member', 'legacy-invite');
      assert.equal(legacyMember.payload.title, input.title);
      assert.equal(legacyMember.visibleContentVersion, 2);
      assert.deepEqual((await listPendingEventReviews(upgraded)).items.map(item => item.id), [event.id]);
      const approved = await reviewEvent(upgraded, 'ops', event.id, event.version, 'APPROVED',
        '已核对历史邀请活动文本', 'legacy-approve');
      assert.equal(approved.recruiting, true);
      assert.equal((await getEvent(upgraded, 'member', 'legacy-started')).id, 'legacy-started');
      assert.equal((await getEvent(upgraded, 'member', 'legacy-cutoff')).id, 'legacy-cutoff');
      await assert.rejects(() => register(upgraded, 'new-member', 'legacy-cutoff', 2,
        'legacy-cutoff-join', 'cutoff-token'), { code: 'REVIEW_PENDING' });
      const app = createApp(upgraded, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
      app.listen(0, '127.0.0.1'); await once(app, 'listening');
      try {
        const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
        assert.equal((await fetch(`${base}/i/cutoff-token`)).status, 404);
        const response = await fetch(`${base}/me/events`, { headers: { 'X-Dev-User': 'member' } });
        const summary = await response.json() as { items: Array<{ id: string; title: string }> };
        assert.equal(summary.items.find(item => item.id === 'legacy-cutoff')?.title, input.title);
      } finally { await new Promise<void>(resolve => app.close(() => resolve())); }
    } finally { await upgraded.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
