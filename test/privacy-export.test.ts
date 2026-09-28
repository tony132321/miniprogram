import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { publishApprovedInvite } from './helpers.ts';
import { register } from './helpers.ts';
import { recordShareIntent, recordAttributedOpen } from '../src/sharing.ts';
import { askCurrentFact } from '../src/collaboration.ts';
import { createPersonalExportTicket, exportPersonalData } from '../src/privacy.ts';
import { runDueJobs } from '../src/jobs.ts';
import { reviewAiDraftAlert } from '../src/ai-draft-requests.ts';

const input = { title: '导出测试', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z',
  timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE',
  feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };

test('personal export includes only the owner’s host publication review', async () => {
  const db = await createDatabase();
  try {
    await db.query(`INSERT INTO host_publication_status(host_id,status,reviewed_by,reviewed_at,reason) VALUES
      ('host-one','ESTABLISHED','operator:safety',now(),'本人活动经历已核验'),
      ('host-two','NEW','operator:safety',now(),'另一人的复核资料')`);
    const own = await exportPersonalData(db, 'host-one');
    assert.equal(own.hostPublicationStatus?.status, 'ESTABLISHED');
    assert.equal(own.hostPublicationStatus?.reason, '本人活动经历已核验');
    assert.equal(own.hostPublicationStatus?.reviewed_by, undefined);
    assert.equal(JSON.stringify(own).includes('另一人的复核资料'), false);
    const other = await exportPersonalData(db, 'host-two');
    assert.equal(other.hostPublicationStatus?.status, 'NEW');
    assert.equal(other.hostPublicationStatus?.reason, '另一人的复核资料');
    assert.equal((await exportPersonalData(db, 'unreviewed')).hostPublicationStatus, null);
  } finally { await db.close(); }
});

test('personal export includes own AI alert review without another user or operator identity', async () => {
  const db = await createDatabase();
  try {
    await db.query(`INSERT INTO ai_draft_requests(actor_id,request_key,request_hash,status,budget_fen,reserved_fen)
      VALUES('p1','uncertain-one',$1,'UNKNOWN',20,20),
            ('p2','uncertain-two',$2,'UNKNOWN',20,20)`, ['a'.repeat(64), 'b'.repeat(64)]);
    await reviewAiDraftAlert(db, 'operator:jobs', 'p1', 'uncertain-one', '本人的异常核查说明', 'review-one');
    await reviewAiDraftAlert(db, 'operator:jobs', 'p2', 'uncertain-two', '另一人的异常核查说明', 'review-two');
    const own = await exportPersonalData(db, 'p1');
    assert.equal(own.aiDraftAlertReviews.length, 1);
    assert.equal(own.aiDraftAlertReviews[0]?.note, '本人的异常核查说明');
    assert.equal(own.aiDraftAlertReviews[0]?.status_at_review, 'UNKNOWN');
    assert.equal(own.aiDraftAlertReviews[0]?.reviewed_by, undefined);
    assert.equal(JSON.stringify(own).includes('另一人的异常核查说明'), false);
  } finally { await db.close(); }
});

test('personal export includes own sharing, offers, questions and history without another participant data', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'publish');
    const p1 = await register(db, 'p1', event.id, event.version, 'join1');
    const p2 = await register(db, 'p2', event.id, event.version, 'join2');
    await recordShareIntent(db, 'host', event.id, event.version, 'a'.repeat(32), 'share');
    await recordAttributedOpen(db, 'p1', event.id, event.inviteToken!, 'a'.repeat(32));
    await recordAttributedOpen(db, 'p2', event.id, event.inviteToken!, 'a'.repeat(32));
    await recordAttributedOpen(db, 'p1', event.id, event.inviteToken!, null);
    await askCurrentFact(db, 'p1', event.id, '需要自带球拍吗？', 'question1');
    await askCurrentFact(db, 'p2', event.id, '集合地点在哪里？', 'question2');
    await db.query("INSERT INTO offers(id,event_id,registration_id,expires_at,status) VALUES('offer-p1',$1,$2,now()+interval '15 minutes','ACTIVE')", [event.id, p1.id]);
    await db.query("INSERT INTO offers(id,event_id,registration_id,expires_at,status) VALUES('offer-p2',$1,$2,now()+interval '15 minutes','ACTIVE')", [event.id, p2.id]);
    await db.query("INSERT INTO manual_checkins(id,event_id,user_id,requested_by) VALUES('manual-p1',$1,'p1','host')", [event.id]);
    await db.query("INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at,issues) VALUES($1,true,3,'host',now(),$2::jsonb)",
      [event.id, JSON.stringify(['场地照明不足'])]);
    await db.query("INSERT INTO reports(id,reporter_id,event_id,kind,description) VALUES('report-p1','p1',$1,'ATTENDANCE','个人争议内容')", [event.id]);
    await db.query("INSERT INTO outcome_reviews(id,event_id,report_id,decision,reason,reviewed_by) VALUES('review-p1',$1,'report-p1','HELD_CONFIRMED','内部复核依据','operator:private')", [event.id]);
    await db.query("INSERT INTO expense_ledgers(id,event_id,total_fen,created_by,revision) VALUES('ledger-host',$1,3000,'host',1)", [event.id]);
    await db.query("INSERT INTO cohost_grants(id,event_id,user_id,granted_by,capabilities,expires_at) VALUES('grant-p1',$1,'p1','host',ARRAY['CHECK_IN'],now()+interval '1 day'),('grant-p2',$1,'p2','host',ARRAY['CHECK_IN'],now()+interval '1 day')", [event.id]);
    const own = await exportPersonalData(db, 'p1');
    assert.equal(own.shareOpens.length, 1);
    assert.equal(own.unknownSourceInviteOpens.length, 1);
    assert.equal(own.unknownSourceInviteOpens[0]?.event_id, event.id);
    assert.equal(own.waitlistOffers[0]?.id, 'offer-p1');
    assert.deepEqual(own.registrationStatusHistory.map(item => item.registration_id), [p1.id]);
    assert.equal(own.registrationStatusHistory[0]?.status, 'CONFIRMED');
    assert.deepEqual(own.waitlistOfferHistory.map(item => item.offer_id), ['offer-p1']);
    assert.equal(own.waitlistOfferHistory[0]?.status, 'ACTIVE');
    assert.equal(own.hostedEventStatusHistory.length, 0);
    assert.deepEqual(own.reportedOutcomeReviews.map(item => item.decision), ['HELD_CONFIRMED']);
    assert.equal(own.reportedOutcomeReviews[0]?.report_id, 'report-p1');
    assert.equal(JSON.stringify(own.reportedOutcomeReviews).includes('内部复核依据'), false);
    assert.equal(JSON.stringify(own.reportedOutcomeReviews).includes('operator:private'), false);
    assert.equal(own.factQuestions[0]?.question_text, '需要自带球拍吗？');
    assert.equal(own.auditActions.some(item => item.action === 'UNKNOWN_FACT_QUESTION'), true);
    assert.deepEqual(own.businessEvents.map(item => item.event_name).sort(),
      ['REGISTER_CONFIRMED', 'SHARE_OPEN_ATTRIBUTED', 'SHARE_OPEN_UNKNOWN', 'UNKNOWN_FACT_QUESTION']);
    assert.ok(/^[a-f0-9]{64}$/.test(String(own.businessEvents[0]?.user_id_pseudonymous ?? '')));
    assert.deepEqual(own.notifications[0]?.detail, { status: 'CONFIRMED' });
    assert.equal(own.manualCheckIns[0]?.requested_by, undefined);
    assert.equal(own.manualCheckIns[0]?.requested_by_me, false);
    assert.equal(own.receivedCohostGrants[0]?.id, 'grant-p1');
    assert.deepEqual(own.receivedCohostGrants[0]?.capabilities, ['CHECK_IN']);
    assert.equal(own.receivedCohostGrants[0]?.granted_by, undefined);
    assert.equal(JSON.stringify(own).includes('offer-p2'), false);
    assert.equal(JSON.stringify(own).includes('grant-p2'), false);
    assert.equal(JSON.stringify(own).includes('集合地点在哪里'), false);
    assert.equal(JSON.stringify(own).includes('场地照明不足'), false);
    assert.deepEqual((await exportPersonalData(db, 'p2')).reportedOutcomeReviews, []);
    const host = await exportPersonalData(db, 'host');
    assert.equal(host.shareIntents.length, 1);
    assert.equal(host.hostedEventVersions.length, 1);
    assert.deepEqual(host.hostedEventStatusHistory.map(item => item.status), ['DRAFT', 'RECRUITING']);
    assert.equal(host.businessEvents.some(item => item.event_name === 'INVITE_REVIEW_SUBMITTED'), true);
    assert.equal(host.hostedOutcomes[0]?.actual_count, 3);
    assert.deepEqual(host.hostedOutcomes[0]?.issues, ['场地照明不足']);
    assert.equal(host.createdExpenseLedgers[0]?.total_fen, 3000);
    assert.equal(host.issuedCohostGrants.length, 2);
    assert.equal(host.issuedCohostGrants[0]?.user_id, undefined);
    assert.equal(host.issuedCohostGrants[0]?.id, undefined);
    assert.equal(JSON.stringify(host).includes('grant-p2'), false);
    assert.equal(JSON.stringify(host).includes('offer-p1'), false);
  } finally { await db.close(); }
});

test('background maintenance retains recent expiry diagnostics and removes old personal export tickets', async () => {
  const db = await createDatabase();
  try {
    await db.query(`INSERT INTO personal_export_tickets(id,user_id,expires_at) VALUES
      ('expired-export','p1',clock_timestamp()-interval '1 second'),
      ('old-export','p1',clock_timestamp()-interval '2 days'),
      ('live-export','p1',clock_timestamp()+interval '1 hour')`);
    await runDueJobs(db);
    const { rows } = await db.query<{ id: string }>('SELECT id FROM personal_export_tickets ORDER BY id');
    assert.deepEqual(rows.map(row => row.id), ['expired-export', 'live-export']);
  } finally { await db.close(); }
});

test('old personal export replay credentials are purged without touching another idempotency route', async () => {
  const db = await createDatabase();
  try {
    const old = await createPersonalExportTicket(db, 'p1', 'reused-export-key');
    const oldId = old.path.split('/').at(-1)!;
    await db.query("UPDATE personal_export_tickets SET expires_at=clock_timestamp()-interval '2 days' WHERE id=$1", [oldId]);
    await db.query(`INSERT INTO idempotency(actor_id,route,key,result) VALUES
      ('p1','other-route','other-key',$1::jsonb)`, [JSON.stringify({ path: old.path })]);

    await runDueJobs(db);
    const { rows: retained } = await db.query<{ route: string; key: string; result: { path: string } }>(
      "SELECT route,key,result FROM idempotency WHERE actor_id='p1' ORDER BY route");
    assert.deepEqual(retained, [{ route: 'other-route', key: 'other-key', result: { path: old.path } }]);

    const renewed = await createPersonalExportTicket(db, 'p1', 'reused-export-key');
    assert.notEqual(renewed.path, old.path);
    const { rows: live } = await db.query<{ id: string }>('SELECT id FROM personal_export_tickets WHERE id=$1',
      [renewed.path.split('/').at(-1)]);
    assert.equal(live.length, 1);
  } finally { await db.close(); }
});
