import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { register } from './helpers.ts';
import { recordShareIntent, recordAttributedOpen } from '../src/sharing.ts';
import { askCurrentFact } from '../src/collaboration.ts';
import { exportPersonalData } from '../src/privacy.ts';

const input = { title: '导出测试', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z',
  timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE',
  feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };

test('personal export includes own sharing, offers, questions and history without another participant data', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'draft');
    const event = await publishEvent(db, 'host', draft.id, draft.version, 'publish');
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
    assert.equal(own.factQuestions[0]?.question_text, '需要自带球拍吗？');
    assert.equal(own.auditActions.some(item => item.action === 'UNKNOWN_FACT_QUESTION'), true);
    assert.deepEqual(own.businessEvents.map(item => item.event_name).sort(),
      ['REGISTER_CONFIRMED', 'SHARE_OPEN_ATTRIBUTED', 'SHARE_OPEN_UNKNOWN']);
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
    const host = await exportPersonalData(db, 'host');
    assert.equal(host.shareIntents.length, 1);
    assert.equal(host.hostedEventVersions.length, 1);
    assert.deepEqual(host.hostedEventStatusHistory.map(item => item.status), ['DRAFT', 'RECRUITING']);
    assert.equal(host.businessEvents.some(item => item.event_name === 'ACTIVITY_PUBLISHED'), true);
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
