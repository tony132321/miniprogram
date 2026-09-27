import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft, publishEvent as publishRawEvent } from '../src/events.ts';
import { approveInviteEvent, publishApprovedInvite } from './helpers.ts';
import { register } from '../src/registrations.ts';
import { reviewEvent } from '../src/event-review.ts';
import { checkIn, confirmEvent, createCheckInToken, requestManualCheckIn, respondManualCheckIn,
  recordExpense, markExpenseShare } from '../src/lifecycle.ts';
import { recordAttributedOpen, recordShareIntent, getShareMetrics } from '../src/sharing.ts';
import { createReport } from '../src/operations.ts';
import { recordSupportMinutes } from '../src/support-minutes.ts';
import { openSyntheticPublicCoverage } from './helpers/public-coverage.ts';

const valid = (visibility: 'INVITE' | 'PUBLIC') => {
  const start = Date.now() + 4 * 24 * 60 * 60_000;
  return { title: '分析事件测试活动', type: 'badminton', startAt: new Date(start).toISOString(),
    endAt: new Date(start + 2 * 60 * 60_000).toISOString(), timeZone: 'Asia/Shanghai',
    city: '深圳', venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
    maxParticipants: 6, registrationDeadline: new Date(start - 30 * 60_000).toISOString(),
    confirmationDeadline: new Date(start - 60 * 60_000).toISOString(), feeMode: 'FREE', feeCapFen: 0,
    cancellationRule: '开始前可退出', visibility, approvalMode: visibility === 'PUBLIC' ? 'MANUAL' : 'AUTO',
    hostParticipates: true };
};

type BusinessEvent = { event_uuid: string; event_name: string; occurred_at: Date; user_id_pseudonymous: string | null;
  activity_id: string; version: number; source: string; release: string; is_test: boolean };

test('committed business events are pseudonymous, versioned and idempotent', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host-secret', valid('INVITE'), 'create', false);
    const submitted = await publishRawEvent(db, 'host-secret', draft.id, draft.version, 'publish');
    await publishRawEvent(db, 'host-secret', draft.id, draft.version, 'publish');
    const published = await approveInviteEvent(db, submitted);
    await register(db, 'participant-secret', draft.id, published.version, 'join', published.inviteToken!);
    await register(db, 'participant-secret', draft.id, published.version, 'join', published.inviteToken!);
    const { rows } = await db.query<BusinessEvent>('SELECT * FROM business_events WHERE activity_id=$1 ORDER BY occurred_at,event_uuid', [draft.id]);
    assert.deepEqual(rows.map(row => row.event_name).sort(),
      ['ACTIVITY_PUBLISHED', 'INVITE_REVIEW_SUBMITTED', 'REGISTER_CONFIRMED', 'REGISTER_CONFIRMED']);
    assert.ok(rows.every(row => row.activity_id === draft.id && row.version === published.version && !row.is_test));
    assert.ok(rows.every(row => row.release === 'R1' && row.occurred_at));
    assert.equal(rows.find(row => row.event_name === 'INVITE_REVIEW_SUBMITTED')?.source, 'API');
    assert.equal(rows.find(row => row.event_name === 'ACTIVITY_PUBLISHED')?.source, 'OPS');
    assert.ok(rows.every(row => /^[a-f0-9]{64}$/.test(row.user_id_pseudonymous ?? '')));
    assert.ok(rows.every(row => !JSON.stringify(row).includes('secret')));
    assert.equal(new Set(rows.filter(row => row.event_name === 'REGISTER_CONFIRMED').map(row => row.user_id_pseudonymous)).size, 2);
    const { rows: audit } = await db.query<{ id: string }>("SELECT id FROM audit WHERE event_id=$1 AND action='EVENT_REVIEW'", [draft.id]);
    assert.equal(rows.find(row => row.event_name === 'ACTIVITY_PUBLISHED')?.event_uuid, audit[0]?.id);
    await assert.rejects(db.transaction(async tx => {
      await tx.query("INSERT INTO audit(id,actor_id,event_id,action) VALUES('rollback-audit','host-secret',$1,'CHECK_IN')", [draft.id]);
      throw new Error('rollback');
    }), /rollback/);
    const { rows: rolledBack } = await db.query('SELECT event_uuid FROM business_events WHERE event_uuid=$1', ['rollback-audit']);
    assert.equal(rolledBack.length, 0);
  } finally { await db.close(); }
});

test('public review submission is not a publication event; approval emits once at approved version', async () => {
  const db = await createDatabase();
  try {
    const publicInput = valid('PUBLIC');
    await openSyntheticPublicCoverage(db, [publicInput]);
    const draft = await createDraft(db, 'public-host', publicInput, 'public-create', true);
    const submitted = await publishApprovedInvite(db, 'public-host', draft.id, draft.version, 'public-submit');
    let { rows } = await db.query<BusinessEvent>('SELECT * FROM business_events WHERE activity_id=$1', [draft.id]);
    assert.equal(rows.filter(row => row.event_name === 'PUBLIC_REVIEW_SUBMITTED').length, 1);
    assert.equal(rows.filter(row => row.event_name === 'ACTIVITY_PUBLISHED').length, 0);
    assert.equal(rows.filter(row => row.event_name === 'REGISTER_CONFIRMED').length, 1);
    await reviewEvent(db, 'operator:reviewer', draft.id, submitted.version, 'APPROVED', '真实场地已核实', 'approve');
    await reviewEvent(db, 'operator:reviewer', draft.id, submitted.version, 'APPROVED', '真实场地已核实', 'approve');
    ({ rows } = await db.query<BusinessEvent>('SELECT * FROM business_events WHERE activity_id=$1 ORDER BY occurred_at,event_uuid', [draft.id]));
    assert.equal(rows.filter(row => row.event_name === 'ACTIVITY_PUBLISHED').length, 1);
    assert.equal(rows.find(row => row.event_name === 'ACTIVITY_PUBLISHED')?.version, submitted.version);
    assert.equal(rows.find(row => row.event_name === 'ACTIVITY_PUBLISHED')?.source, 'OPS');
    assert.ok(rows.every(row => row.is_test));
  } finally { await db.close(); }
});

test('a repeat scan and a superseded manual request do not emit new attendance evidence', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', valid('INVITE'), 'attendance-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'attendance-publish');
    for (const actor of ['p1', 'p2', 'p3']) await register(db, actor, event.id, event.version, `join-${actor}`, event.inviteToken!);
    await confirmEvent(db, 'host', event.id, event.version, 'attendance-confirm');
    const at = Date.parse(event.payload.startAt!);
    const manual = await requestManualCheckIn(db, 'host', event.id, event.version, 'p1', 'manual-request', at);
    const token = createCheckInToken(event.id, 'test-checkin-secret', at);
    const first = await checkIn(db, 'p1', event.id, event.version, token, 'test-checkin-secret', 'scan-1', at);
    const repeat = await checkIn(db, 'p1', event.id, event.version, token, 'test-checkin-secret', 'scan-2', at);
    assert.equal(repeat.id, first.id);
    assert.equal((await respondManualCheckIn(db, 'p1', manual.id, event.version, true, 'manual-response', at)).status, 'SUPERSEDED');
    const { rows } = await db.query<BusinessEvent>('SELECT * FROM business_events WHERE activity_id=$1', [event.id]);
    assert.equal(rows.filter(row => row.event_name === 'CHECK_IN').length, 1);
    assert.equal(rows.filter(row => row.event_name === 'CONFIRM_MANUAL_CHECKIN').length, 0);
  } finally { await db.close(); }
});

test('share intent, attributed invite open, and unknown-source open have distinct deduplicated business events', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', valid('INVITE'), 'share-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'share-publish');
    const source = 'a'.repeat(32);
    await recordShareIntent(db, 'host', event.id, event.version, source, 'share-intent');
    await recordShareIntent(db, 'host', event.id, event.version, source, 'share-intent');
    await recordAttributedOpen(db, 'p1', event.id, event.inviteToken!, source);
    await recordAttributedOpen(db, 'p1', event.id, event.inviteToken!, source);
    await recordAttributedOpen(db, 'p2', event.id, event.inviteToken!, null);
    await recordAttributedOpen(db, 'p2', event.id, event.inviteToken!, null);
    await recordAttributedOpen(db, 'host', event.id, event.inviteToken!, null);
    const { rows } = await db.query<BusinessEvent>(
      "SELECT * FROM business_events WHERE activity_id=$1 AND event_name LIKE 'SHARE_%' ORDER BY occurred_at,event_uuid", [event.id]);
    assert.deepEqual(rows.map(row => row.event_name).sort(), ['SHARE_INTENT', 'SHARE_OPEN_ATTRIBUTED', 'SHARE_OPEN_UNKNOWN']);
    assert.ok(rows.every(row => row.source === 'API' && row.version === event.version && row.is_test));
    assert.ok(rows.every(row => /^[a-f0-9]{64}$/.test(row.user_id_pseudonymous ?? '')));
    assert.equal(JSON.stringify(rows).includes(source), false);
    assert.deepEqual(await getShareMetrics(db, 'host', event.id),
      { shareIntents: 1, attributedOpens: 1, unknownSourceOpens: 1 });
  } finally { await db.close(); }
});

test('expense, activity report and support actions enter the privacy-safe event stream only when state changes', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'expense-host-secret',
      { ...valid('INVITE'), feeMode: 'AA', feeCapFen: 5000 }, 'expense-events-draft', true);
    const event = await publishApprovedInvite(db, 'expense-host-secret', draft.id, draft.version, 'expense-events-publish');
    for (const actor of ['expense-p1-secret', 'expense-p2-secret'])
      await register(db, actor, event.id, event.version, `join-${actor}`, event.inviteToken!);
    await assert.rejects(() => recordExpense(db, 'expense-host-secret', event.id, event.version,
      20000, 'expense-events-over-cap'), { code: 'FEE_CAP_EXCEEDED' });
    const first = await recordExpense(db, 'expense-host-secret', event.id, event.version, 10001, 'expense-events-first');
    await recordExpense(db, 'expense-host-secret', event.id, event.version, 10001, 'expense-events-first');
    await markExpenseShare(db, 'expense-p1-secret', first.id, 'expense-p1-secret', event.version,
      'PARTICIPANT_HANDLED', true, 'expense-events-handled');
    await markExpenseShare(db, 'expense-p1-secret', first.id, 'expense-p1-secret', event.version,
      'PARTICIPANT_HANDLED', true, 'expense-events-handled-again');
    await markExpenseShare(db, 'expense-host-secret', first.id, 'expense-p1-secret', event.version,
      'HOST_RECEIVED', true, 'expense-events-received');
    await recordExpense(db, 'expense-host-secret', event.id, event.version, 10002, 'expense-events-revised', 1);
    await createReport(db, 'expense-p1-secret', { eventId: event.id, kind: 'OTHER', description: '测试描述只在业务表中保存' }, 'expense-events-report');
    await recordSupportMinutes(db, 'operator:metrics', event.id, 12, 'SUPPORT', 'expense-events-support');
    const { rows } = await db.query<BusinessEvent>(`SELECT * FROM business_events WHERE activity_id=$1
      AND event_name IN ('RECORD_EXPENSE','EXPENSE_PARTICIPANT_HANDLED','EXPENSE_HOST_RECEIVED','CREATE_REPORT','RECORD_SUPPORT_MINUTES')
      ORDER BY occurred_at,event_uuid`, [event.id]);
    assert.deepEqual(rows.map(row => row.event_name).sort(),
      ['RECORD_EXPENSE','RECORD_EXPENSE','EXPENSE_PARTICIPANT_HANDLED','EXPENSE_HOST_RECEIVED','CREATE_REPORT','RECORD_SUPPORT_MINUTES'].sort());
    assert.ok(rows.every(row => row.is_test && row.version === event.version && row.release === 'R1'));
    assert.equal(rows.find(row => row.event_name === 'RECORD_SUPPORT_MINUTES')?.source, 'OPS');
    assert.equal(JSON.stringify(rows).includes('测试描述'), false);
    assert.equal(JSON.stringify(rows).includes('10001'), false);
    assert.equal(JSON.stringify(rows).includes('secret'), false);
  } finally { await db.close(); }
});
