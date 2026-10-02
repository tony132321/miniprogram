import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createApp } from '../src/server.ts';
import { getPilotMetrics } from '../src/metrics.ts';
import { changeReportStatus } from '../src/operations.ts';
import { getOutcomeEvidence } from '../src/lifecycle.ts';

test('an open second attendance case keeps the member evidence disputed after the first verdict', async () => {
  const db = await createDatabase();
  try {
    const payload = { title: '并列争议', visibility: 'INVITE', startAt: '2026-09-20T12:00:00Z',
      endAt: '2026-09-20T14:00:00Z', timeZone: 'Asia/Shanghai' };
    await db.query(`INSERT INTO events(id,host_id,status,version,payload)
      VALUES('parallel-review','host','COMPLETED',2,$1::jsonb)`, [JSON.stringify(payload)]);
    await db.query(`INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at,disputed)
      VALUES('parallel-review',true,4,'host','2026-09-20T15:00:00Z',true)`);
    await db.query(`INSERT INTO reports(id,reporter_id,event_id,kind,description) VALUES
      ('parallel-r1','p1','parallel-review','ATTENDANCE','第一份未举办反馈'),
      ('parallel-r2','p2','parallel-review','ATTENDANCE','第二份未举办反馈')`);
    await changeReportStatus(db, 'ops', 'parallel-r1', 'IN_REVIEW', undefined, 'triage');
    const { rows: triageEvents } = await db.query<{ event_name: string }>(
      "SELECT event_name FROM business_events WHERE activity_id='parallel-review' AND event_name='OUTCOME_REVIEW'");
    assert.equal(triageEvents.length, 0, 'opening a case review is not a completed outcome verdict');
    await changeReportStatus(db, 'ops', 'parallel-r1', 'RESOLVED', '第一份证据表明活动举办', 'first', 'HELD_CONFIRMED');
    const partial = await getOutcomeEvidence(db, 'host', 'parallel-review');
    assert.equal(partial.disputed, true);
    assert.equal(partial.reviewDecision, null);
    assert.equal(partial.level, 'DISPUTED');
    await changeReportStatus(db, 'ops', 'parallel-r2', 'RESOLVED', '第二份证据也表明活动举办', 'second', 'HELD_CONFIRMED');
    const final = await getOutcomeEvidence(db, 'host', 'parallel-review');
    assert.equal(final.disputed, false);
    assert.equal(final.reviewDecision, 'HELD_CONFIRMED');
  } finally { await db.close(); }
});

test('an attendance dispute needs an audited human verdict before trusted completion can return', async () => {
  const db = await createDatabase();
  const payload = { title: '结项争议复核', type: 'badminton', startAt: '2026-09-20T12:00:00.000Z',
    endAt: '2026-09-20T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共场馆',
    minParticipants: 4, maxParticipants: 6, feeMode: 'FREE', visibility: 'INVITE' };
  await db.query(`INSERT INTO events(id,host_id,status,version,payload,is_test)
    VALUES('review-event','host','COMPLETED',2,$1::jsonb,false)`, [JSON.stringify(payload)]);
  await db.query(`INSERT INTO event_versions(event_id,version,payload,created_at)
    VALUES('review-event',2,$1::jsonb,'2026-09-19T00:00:00Z')`, [JSON.stringify(payload)]);
  await db.query(`INSERT INTO registrations(id,event_id,user_id,status) VALUES
    ('review-host','review-event','host','CONFIRMED'),('review-p1','review-event','p1','CONFIRMED'),
    ('review-p2','review-event','p2','CONFIRMED'),('review-p3','review-event','p3','CONFIRMED')`);
  await db.query(`INSERT INTO checkins(id,event_id,user_id,evidence,checked_at) VALUES
    ('check-host','review-event','host','SCAN','2026-09-20T12:30:00Z'),
    ('check-p1','review-event','p1','SCAN','2026-09-20T12:30:00Z'),
    ('check-p2','review-event','p2','SCAN','2026-09-20T12:30:00Z'),
    ('check-p3','review-event','p3','SCAN','2026-09-20T12:30:00Z')`);
  await db.query(`INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at,disputed)
    VALUES('review-event',true,4,'host','2026-09-20T15:00:00Z',true)`);
  await db.query(`INSERT INTO outcome_feedback(event_id,user_id,held,would_repeat,reason,created_at) VALUES
    ('review-event','p1',true,true,NULL,'2026-09-21T00:00:00Z'),
    ('review-event','p2',false,false,'活动未举办','2026-09-21T01:00:00Z')`);
  await db.query(`INSERT INTO reports(id,reporter_id,event_id,kind,description,created_at,updated_at)
    VALUES('outcome-report','p2','review-event','ATTENDANCE','活动未举办','2026-09-21T01:00:00Z','2026-09-21T01:00:00Z')`);
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret' });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  const decide = async (actor: string, key: string, outcomeDecision?: string) => {
    const response = await fetch(base + '/ops/reports/outcome-report/status', { method: 'POST', headers: {
      'X-Dev-User': actor, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ status: 'RESOLVED', resolution: '已核对活动场地及到场证据并记录复核结论', outcomeDecision }) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  try {
    const before = (await getPilotMetrics(db, Date.parse('2026-09-23T00:00:00Z'), ['host', 'p1', 'p2', 'p3'])).dueEventCompletion;
    assert.equal(before.pendingReview, 1);
    const evidenceBefore = await fetch(base + '/events/review-event/outcome', { headers: { 'X-Dev-User': 'host' } });
    assert.equal((await evidenceBefore.json() as Record<string, any>).disputed, true);
    assert.equal((await decide('p1', 'member-decision', 'HELD_CONFIRMED')).status, 403);
    assert.equal((await decide('ops', 'no-decision')).status, 400);
    const { rows: stillOpen } = await db.query<{ status: string }>("SELECT status FROM reports WHERE id='outcome-report'");
    assert.equal(stillOpen[0]?.status, 'OPEN');
    assert.equal((await decide('ops', 'human-decision', 'HELD_CONFIRMED')).status, 200);
    assert.equal((await decide('ops', 'human-decision', 'HELD_CONFIRMED')).status, 200,
      'idempotent retry replays the same verdict');
    const { rows: reviewEvents } = await db.query<{ event_name: string; source: string; user_id_pseudonymous: string; version: number }>(
      "SELECT event_name,source,user_id_pseudonymous,version FROM business_events WHERE activity_id='review-event' AND event_name IN ('OUTCOME_REVIEW','REPORT_RESOLVED')");
    assert.deepEqual(reviewEvents.map(row => row.event_name), ['OUTCOME_REVIEW'],
      'an attendance verdict already has one event and must not be counted again as a report resolution');
    assert.equal(reviewEvents[0]?.source, 'OPS');
    assert.equal(reviewEvents[0]?.version, 2);
    assert.match(reviewEvents[0]!.user_id_pseudonymous, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(reviewEvents).includes('活动未举办'), false);
    const after = await getPilotMetrics(db, Date.now() + 1_000, ['host', 'p1', 'p2', 'p3']);
    assert.equal(after.dueEventCompletion.evidenceQualified, 1);
    assert.equal(after.participantReturn30d.observedParticipants, 4);
    const evidenceAfter = await fetch(base + '/events/review-event/outcome', { headers: { 'X-Dev-User': 'host' } });
    const readback = await evidenceAfter.json() as Record<string, any>;
    assert.equal(readback.reviewDecision, 'HELD_CONFIRMED');
    assert.equal(readback.disputed, false);
    assert.equal(readback.level, 'MEMBER_CORROBORATED');
    const hostExport = await fetch(base + '/privacy/export', { headers: { 'X-Dev-User': 'host' } });
    const hostData = await hostExport.json() as Record<string, any>;
    assert.deepEqual(hostData.hostedOutcomeReviews.map((row: Record<string, unknown>) => row.decision), ['HELD_CONFIRMED']);
    assert.equal(JSON.stringify(hostData.hostedOutcomeReviews).includes('活动未举办'), false,
      'host export omits another member’s private allegation');
    const memberExport = await fetch(base + '/privacy/export', { headers: { 'X-Dev-User': 'p1' } });
    assert.deepEqual((await memberExport.json() as Record<string, any>).hostedOutcomeReviews, []);
    const { rows: reviews } = await db.query<{ decision: string; reviewed_by: string }>(
      "SELECT decision,reviewed_by FROM outcome_reviews WHERE event_id='review-event'");
    assert.deepEqual(reviews, [{ decision: 'HELD_CONFIRMED', reviewed_by: 'ops' }]);
    const { rows: audit } = await db.query<{ detail: Record<string, unknown> }>(
      "SELECT detail FROM audit WHERE action='REPORT_STATUS' AND event_id='review-event'");
    assert.equal(audit.some(row => row.detail.outcomeDecision === 'HELD_CONFIRMED'), true);
    const { rows: feedback } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM outcome_feedback WHERE event_id='review-event' AND held=false");
    assert.equal(feedback[0]?.n, 1, 'negative evidence is retained');
    const historical = (await getPilotMetrics(db, Date.parse('2026-09-23T00:00:00Z'), ['host', 'p1', 'p2', 'p3'])).dueEventCompletion;
    assert.equal(historical.pendingReview, 1, 'review does not rewrite a prior report');
    await db.query(`INSERT INTO outcome_feedback(event_id,user_id,held,would_repeat,reason)
      VALUES('review-event','p3',false,false,'另有未举办证据')`);
    await db.query(`INSERT INTO reports(id,reporter_id,event_id,kind,description)
      VALUES('later-outcome-report','p3','review-event','ATTENDANCE','另有未举办证据')`);
    assert.equal((await getPilotMetrics(db, Date.now() + 1_000, ['host', 'p1', 'p2', 'p3']))
      .dueEventCompletion.pendingReview, 1, 'new negative feedback reopens review');
    const second = await fetch(base + '/ops/reports/later-outcome-report/status', { method: 'POST', headers: {
      'X-Dev-User': 'ops', 'Content-Type': 'application/json', 'Idempotency-Key': 'second-verdict' },
    body: JSON.stringify({ status: 'RESOLVED', resolution: '已核实未举办并保留主办方原结项记录',
      outcomeDecision: 'NOT_HELD_CONFIRMED' }) });
    assert.equal(second.status, 200);
    const { rows: allReviewEvents } = await db.query<{ event_name: string }>(
      "SELECT event_name FROM business_events WHERE activity_id='review-event' AND event_name='OUTCOME_REVIEW'");
    assert.equal(allReviewEvents.length, 2, 'a later human verdict is a second distinct event');
    const rejected = await getPilotMetrics(db, Date.now() + 1_000, ['host', 'p1', 'p2', 'p3']);
    assert.equal(rejected.dueEventCompletion.unqualified, 1);
    assert.equal(rejected.participantReturn30d.observedParticipants, 0);
    const evidenceRejected = await fetch(base + '/events/review-event/outcome', { headers: { 'X-Dev-User': 'p1' } });
    const rejectedReadback = await evidenceRejected.json() as Record<string, any>;
    assert.equal(rejectedReadback.level, 'NOT_HELD');
    assert.equal(rejectedReadback.reviewDecision, 'NOT_HELD_CONFIRMED');
    assert.equal(rejectedReadback.disputed, false);
  } finally {
    await new Promise<void>(resolve => app.close(() => resolve()));
    await db.close();
  }
});
