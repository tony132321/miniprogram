import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { confirmEvent } from '../src/lifecycle.ts';
import { createAppeal, createPrivacyRequest, createReport } from '../src/operations.ts';
import { dispatchNotification, enqueueNotification, enqueueStartReminder, reconcileUnknownNotification, setConsent } from '../src/notifications.ts';
import { publishApprovedInvite, register } from './helpers.ts';
import { exportPersonalData } from '../src/privacy.ts';

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
    // Reconciliation can arrive after a later activity revision; the event
    // must retain the version bound into the original notification.
    await db.query('UPDATE events SET version=version+1 WHERE id=$1', [event.id]);
    const uncertainId = ids.get('unknown-secret')!;
    await reconcileUnknownNotification(db, 'operator:notifications', uncertainId, 'system-events-lookup', {
      lookup: async () => ({ status: 'ACCEPTED', providerRef: 'private-lookup-ref' })
    });
    await reconcileUnknownNotification(db, 'operator:notifications', uncertainId, 'system-events-lookup', {
      lookup: async () => { throw new Error('idempotent reconciliation must not call provider again'); }
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
    const { rows: acceptedEvents } = await db.query<{ event_uuid: string; event_name: string;
      occurred_at: Date; user_id_pseudonymous: string; activity_id: string; version: number;
      source: string; release: string; is_test: boolean }>(
      "SELECT * FROM business_events WHERE event_name='NOTIFICATION_PROVIDER_ACCEPTED' ORDER BY occurred_at,event_uuid");
    assert.equal(acceptedEvents.length, 2, 'direct and reconciled provider acceptance each count once');
    assert.ok(acceptedEvents.every(row => row.event_uuid.match(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/) &&
      row.occurred_at && row.activity_id === event.id && row.version === event.version &&
      ['JOB','OPS'].includes(row.source) && row.release === 'R1' && row.is_test === true &&
      /^[a-f0-9]{64}$/.test(row.user_id_pseudonymous)));
    assert.deepEqual(acceptedEvents.map(row => row.source), ['JOB','OPS']);
    assert.equal(new Set(acceptedEvents.map(row => row.event_uuid)).size, 2);
    assert.equal(new Set(acceptedEvents.map(row => row.user_id_pseudonymous)).size, 2);
    assert.deepEqual(Object.keys(acceptedEvents[0]!).sort(),
      ['event_uuid', 'event_name', 'occurred_at', 'user_id_pseudonymous', 'activity_id', 'version',
        'source', 'release', 'is_test'].sort());
    const acceptedSerialized = JSON.stringify(acceptedEvents);
    for (const secret of ['accepted-secret', 'unknown-secret', 'private-provider-ref', 'private-lookup-ref',
      'PRIVATE_REJECTION_CODE', uncertainId]) assert.equal(acceptedSerialized.includes(secret), false, secret);
    const exported = await exportPersonalData(db, 'accepted-secret');
    assert.equal(exported.businessEvents.filter(item => item.event_name === 'NOTIFICATION_PROVIDER_ACCEPTED').length, 1,
      'the recipient must be able to read their own accepted event in a private export');
    await dispatchNotification(db, ids.get('accepted-secret')!, { send: async () => { throw Error('replay must not send'); } });
    assert.equal((await db.query('SELECT 1 FROM system_business_events')).rows.length, rows.length);
    assert.equal((await db.query("SELECT 1 FROM business_events WHERE event_name='NOTIFICATION_PROVIDER_ACCEPTED'")).rows.length,
      acceptedEvents.length);
    // Defensive deduplication also holds if an operational writer reopens an
    // already accepted row after pseudonym salt rotation and confirms again.
    await db.query("UPDATE business_event_identity_salt SET salt='rotated-for-acceptance-replay' WHERE singleton=true");
    await db.query("UPDATE notifications SET external_status='UNKNOWN_REQUIRES_RECONCILIATION' WHERE id=$1",
      [ids.get('accepted-secret')!]);
    await db.query(`UPDATE notifications SET external_status='PROVIDER_ACCEPTED',
      provider_responded_at=clock_timestamp() WHERE id=$1`, [ids.get('accepted-secret')!]);
    assert.equal((await db.query("SELECT 1 FROM business_events WHERE event_name='NOTIFICATION_PROVIDER_ACCEPTED'")).rows.length,
      acceptedEvents.length);
    const systemCountBeforeRollback = (await db.query('SELECT 1 FROM system_business_events')).rows.length;
    await assert.rejects(db.transaction(async tx => {
      await tx.query("UPDATE notifications SET external_status='DISPATCHING' WHERE id=$1", [blockedId]);
      await tx.query(`UPDATE notifications SET external_status='PROVIDER_ACCEPTED',
        provider_ref='rollback-private-ref',provider_responded_at=clock_timestamp() WHERE id=$1`, [blockedId]);
      throw new Error('rollback-probe');
    }), /rollback-probe/);
    assert.equal((await db.query('SELECT 1 FROM system_business_events')).rows.length, systemCountBeforeRollback);
    assert.equal((await db.query("SELECT 1 FROM business_events WHERE event_name='NOTIFICATION_PROVIDER_ACCEPTED'")).rows.length,
      acceptedEvents.length);
    assert.equal((await db.query('SELECT 1 FROM notification_provider_accepted_event_keys')).rows.length,
      acceptedEvents.length, 'a rolled-back provider result must leave no deduplication key');
  } finally { await db.close(); }
});

test('account-scoped notifications retain aggregate acceptance without an activity event', async () => {
  const db = await createDatabase();
  try {
    await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version)
      VALUES('account-only-provider-result',NULL,'recipient','REPORT_RESOLVED',0)`);
    await db.query("UPDATE notifications SET external_status='DISPATCHING' WHERE id='account-only-provider-result'");
    await db.query(`UPDATE notifications SET external_status='PROVIDER_ACCEPTED',
      provider_ref='private-account-provider-ref',provider_responded_at=clock_timestamp()
      WHERE id='account-only-provider-result'`);
    const { rows: aggregate } = await db.query<{ event_name: string; is_test: boolean | null }>(
      'SELECT event_name,is_test FROM system_business_events ORDER BY occurred_at');
    assert.deepEqual(aggregate, [
      { event_name: 'EXTERNAL_DISPATCH_CLAIMED', is_test: null },
      { event_name: 'EXTERNAL_PROVIDER_ACCEPTED', is_test: null }
    ]);
    assert.equal((await db.query("SELECT 1 FROM business_events WHERE event_name='NOTIFICATION_PROVIDER_ACCEPTED'"))
      .rows.length, 0);
    assert.equal((await db.query('SELECT 1 FROM notification_provider_accepted_event_keys')).rows.length, 0);
  } finally { await db.close(); }
});

test('revoked consent and pending deletion block provider acceptance analytics before the adapter call', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'barrier-host', input(), 'barrier-draft');
    const event = await publishApprovedInvite(db, 'barrier-host', draft.id, draft.version, 'barrier-publish');
    for (const actor of ['consent-revoked', 'deletion-pending']) {
      await db.query('INSERT INTO users(id,wechat_openid) VALUES($1,$2)', [actor, `wx-${actor}`]);
      await setConsent(db, actor, 'EVENT_REMINDER', true, `barrier-consent-${actor}`);
      await register(db, actor, event.id, event.version, `barrier-join-${actor}`);
    }
    await register(db, 'third-member', event.id, event.version, 'barrier-join-third');
    await confirmEvent(db, 'barrier-host', event.id, event.version, 'barrier-confirm');
    const ids: string[] = [];
    for (const actor of ['consent-revoked', 'deletion-pending']) {
      await enqueueStartReminder(db, event.id, actor, event.version);
      const { rows } = await db.query<{ id: string }>(
        "SELECT id FROM notifications WHERE event_id=$1 AND user_id=$2 AND kind='EVENT_REMINDER'",
        [event.id, actor]);
      ids.push(rows[0]!.id);
    }
    await setConsent(db, 'consent-revoked', 'EVENT_REMINDER', false, 'barrier-revoke');
    await createPrivacyRequest(db, 'deletion-pending', { kind: 'DELETE' }, 'barrier-delete');
    let calls = 0;
    for (const id of ids) await dispatchNotification(db, id, { send: async () => {
      calls++;
      return { status: 'ACCEPTED', providerRef: 'must-never-be-used' };
    } });
    assert.equal(calls, 0);
    assert.equal((await db.query("SELECT 1 FROM business_events WHERE event_name='NOTIFICATION_PROVIDER_ACCEPTED'"))
      .rows.length, 0);
    const { rows: statuses } = await db.query<{ user_id: string; external_status: string }>(
      "SELECT user_id,external_status FROM notifications WHERE id=$1 OR id=$2 ORDER BY user_id", ids);
    assert.deepEqual(statuses, [
      { user_id: 'consent-revoked', external_status: 'CONSENT_WITHDRAWN' },
      { user_id: 'deletion-pending', external_status: 'DELETE_REQUEST_PENDING' }
    ]);
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
