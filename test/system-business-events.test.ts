import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { confirmEvent } from '../src/lifecycle.ts';
import { createAppeal, createPrivacyRequest, createReport } from '../src/operations.ts';
import { dispatchNotification, enqueueNotification, enqueueStartReminder, reconcileUnknownNotification, setConsent } from '../src/notifications.ts';
import { publishApprovedInvite, register } from './helpers.ts';

const input = () => {
  const start = Date.now() + 7 * 24 * 60 * 60_000;
  return { title: '业务事件测试', type: 'badminton', startAt: new Date(start).toISOString(),
    endAt: new Date(start + 2 * 60 * 60_000).toISOString(), timeZone: 'Asia/Shanghai',
    city: '深圳', venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
    maxParticipants: 6, registrationDeadline: new Date(start - 30 * 60_000).toISOString(),
    confirmationDeadline: new Date(start - 90 * 60_000).toISOString(), feeMode: 'FREE', feeCapFen: 0,
    cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };
};

test('external dispatch events distinguish claim, provider responses, uncertainty, reconciliation and blocked sends', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host-secret', input(), 'system-events-draft');
    const event = await publishApprovedInvite(db, 'host-secret', draft.id, draft.version, 'system-events-publish');
    for (const actor of ['accepted-secret', 'rejected-secret', 'unknown-secret']) {
      await db.query('INSERT INTO users(id,wechat_openid) VALUES($1,$2)', [actor, `wx-${actor}`]);
      await setConsent(db, actor, 'EVENT_REMINDER', true, `consent-${actor}`);
      await register(db, actor, event.id, event.version, `join-${actor}`);
    }
    await confirmEvent(db, 'host-secret', event.id, event.version, 'system-events-confirm');
    const ids = new Map<string, string>();
    for (const actor of ['accepted-secret', 'rejected-secret', 'unknown-secret']) {
      await enqueueStartReminder(db, event.id, actor, event.version);
      const { rows: reminders } = await db.query<{ id: string }>(
        "SELECT id FROM notifications WHERE event_id=$1 AND user_id=$2 AND kind='EVENT_REMINDER'",
        [event.id, actor]);
      ids.set(actor, reminders[0]!.id);
    }
    await dispatchNotification(db, ids.get('accepted-secret')!, { send: async () =>
      ({ status: 'ACCEPTED', providerRef: 'private-provider-ref' }) });
    await dispatchNotification(db, ids.get('rejected-secret')!, { send: async () =>
      ({ status: 'REJECTED', failureCode: 'PRIVATE_REJECTION_CODE' }) });
    await dispatchNotification(db, ids.get('unknown-secret')!, { send: async () =>
      ({ status: 'UNKNOWN', failureCode: 'PROVIDER_TIMEOUT' }) });
    const blockedId = await enqueueNotification(db, event.id, 'accepted-secret', 'EVENT_CANCELLED', event.version);
    let called = false;
    await dispatchNotification(db, blockedId, { send: async () => {
      called = true; return { status: 'ACCEPTED', providerRef: 'should-not-exist' };
    } });
    assert.equal(called, false);
    const uncertainId = ids.get('unknown-secret')!;
    await reconcileUnknownNotification(db, 'operator:notifications', uncertainId, 'system-events-lookup', {
      lookup: async () => ({ status: 'ACCEPTED', providerRef: 'private-lookup-ref' })
    });
    const { rows } = await db.query<{ event_name: string; occurred_at: Date; is_test: boolean | null }>(
      'SELECT * FROM system_business_events ORDER BY occurred_at');
    const names = rows.map(row => row.event_name);
    assert.equal(names.filter(name => name === 'EXTERNAL_DISPATCH_CLAIMED').length, 4);
    for (const name of ['EXTERNAL_PROVIDER_ACCEPTED', 'EXTERNAL_PROVIDER_REJECTED',
      'EXTERNAL_OUTCOME_UNKNOWN', 'EXTERNAL_RECONCILED_ACCEPTED', 'EXTERNAL_NOT_SENT'])
      assert.equal(names.filter(item => item === name).length, 1, name);
    assert.ok(rows.every(row => row.is_test === true && row.occurred_at));
    assert.deepEqual(Object.keys(rows[0]!).sort(), ['event_name', 'is_test', 'occurred_at']);
    const serialized = JSON.stringify(rows);
    for (const secret of ['host-secret', 'accepted-secret', 'rejected-secret', 'unknown-secret',
      'private-provider-ref', 'private-lookup-ref', 'PRIVATE_REJECTION_CODE', event.id, uncertainId])
      assert.equal(serialized.includes(secret), false, secret);
    await dispatchNotification(db, ids.get('accepted-secret')!, { send: async () => { throw Error('replay must not send'); } });
    assert.equal((await db.query('SELECT 1 FROM system_business_events')).rows.length, rows.length);
    await assert.rejects(db.transaction(async tx => {
      await tx.query("UPDATE notifications SET external_status='DISPATCHING' WHERE id=$1", [blockedId]);
      throw new Error('rollback-probe');
    }), /rollback-probe/);
    assert.equal((await db.query('SELECT 1 FROM system_business_events')).rows.length, rows.length);
  } finally { await db.close(); }
});

test('unscoped report, appeal and privacy request events contain no personal fields and roll back with business writes', async () => {
  const db = await createDatabase();
  try {
    const report = await createReport(db, 'reporter-secret', { kind: 'OTHER', description: '私密举报正文' }, 'system-report');
    await createReport(db, 'reporter-secret', { kind: 'OTHER', description: '私密举报正文' }, 'system-report');
    await db.query("UPDATE reports SET status='IN_REVIEW' WHERE id=$1", [report.id]);
    await db.query("UPDATE reports SET status='RESOLVED' WHERE id=$1", [report.id]);
    const appeal = await createAppeal(db, 'reporter-secret', { reportId: report.id, description: '私密申诉正文' }, 'system-appeal');
    await createAppeal(db, 'reporter-secret', { reportId: report.id, description: '私密申诉正文' }, 'system-appeal');
    await db.query("UPDATE appeals SET status='IN_REVIEW' WHERE id=$1", [appeal.id]);
    await db.query("UPDATE appeals SET status='RESOLVED' WHERE id=$1", [appeal.id]);
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('privacy-secret','wx-privacy-secret')");
    await createPrivacyRequest(db, 'privacy-secret', { kind: 'EXPORT' }, 'system-export');
    await createPrivacyRequest(db, 'privacy-secret', { kind: 'DELETE' }, 'system-delete');
    const { rows } = await db.query<{ event_name: string; occurred_at: Date; is_test: boolean | null }>(
      'SELECT * FROM system_business_events ORDER BY occurred_at');
    assert.deepEqual(rows.map(row => row.event_name).sort(), [
      'REPORT_CREATED_UNSCOPED', 'REPORT_IN_REVIEW_UNSCOPED', 'REPORT_RESOLVED_UNSCOPED',
      'APPEAL_CREATED', 'APPEAL_IN_REVIEW', 'APPEAL_RESOLVED',
      'PRIVACY_EXPORT_REQUESTED', 'PRIVACY_DELETE_REQUESTED', 'PRIVACY_DELETE_PROTECTED'].sort());
    assert.ok(rows.every(row => row.is_test === null));
    assert.deepEqual(Object.keys(rows[0]!).sort(), ['event_name', 'is_test', 'occurred_at']);
    const serialized = JSON.stringify(rows);
    for (const secret of ['reporter-secret', 'privacy-secret', '私密举报正文', '私密申诉正文', report.id, appeal.id])
      assert.equal(serialized.includes(secret), false, secret);
    await assert.rejects(db.transaction(async tx => {
      await tx.query("INSERT INTO privacy_requests(id,user_id,kind) VALUES('rollback-secret','privacy-secret','CORRECT')");
      throw new Error('rollback-probe');
    }), /rollback-probe/);
    assert.equal((await db.query('SELECT 1 FROM system_business_events')).rows.length, rows.length);
  } finally { await db.close(); }
});
