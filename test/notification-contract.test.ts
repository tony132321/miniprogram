import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft, publishEvent } from '../src/events.ts';
import { reviewEvent } from '../src/event-review.ts';
import { dispatchNotification, enqueueNotification, enqueueStartReminder, reconcileUnknownNotification, setConsent } from '../src/notifications.ts';
import { listNotificationFollowups, recordNotificationFollowup } from '../src/notification-followups.ts';
import { exportPersonalData } from '../src/privacy.ts';
import { confirmEvent } from '../src/lifecycle.ts';
import { register } from './helpers.ts';
import { createApp } from '../src/server.ts';

const input = { title: '通知契约测试', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 6,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z',
  feeMode: 'FREE', feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE',
  approvalMode: 'AUTO', hostParticipates: true };

async function published(db: Awaited<ReturnType<typeof createDatabase>>) {
  const draft = await createDraft(db, 'host', input, 'contract-draft');
  const pending = await publishEvent(db, 'host', draft.id, draft.version, 'contract-publish');
  return reviewEvent(db, 'operator:review', pending.id, pending.version, 'APPROVED',
    '合成通知测试活动已人工核对', 'contract-review');
}

test('each queued kind stores its purpose, channel, template slot and schedule; broad reminder consent cannot send a cancellation', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const expected = [
      ['REGISTRATION_STATUS', 'REGISTRATION_RESULT', 'REGISTRATION_RESULT'],
      ['WAITLIST_OFFER', 'WAITLIST_OFFER', 'WAITLIST_OFFER'],
      ['MATERIAL_CHANGE', 'EVENT_CHANGE', 'EVENT_CHANGE'],
      ['EVENT_CANCELLED', 'EVENT_CANCELLATION', 'EVENT_CANCELLATION']
    ] as const;
    for (const [kind] of expected) await enqueueNotification(db, event.id, 'p1', kind, event.version);
    await enqueueStartReminder(db, event.id, 'p1', event.version);
    const { rows } = await db.query<{ id: string; kind: string; external_purpose: string;
      external_channel: string; template_slot: string; external_scheduled_at: Date; job_due_at: Date }>(`
      SELECT n.id,n.kind,n.external_purpose,n.external_channel,n.template_slot,n.external_scheduled_at,
        j.due_at AS job_due_at FROM notifications n JOIN jobs j ON j.payload->>'notificationId'=n.id
      WHERE n.event_id=$1 AND n.user_id='p1' ORDER BY n.kind`, [event.id]);
    assert.equal(rows.length, 5);
    for (const [kind, purpose, templateSlot] of [...expected, ['EVENT_REMINDER', 'EVENT_REMINDER', 'EVENT_START_REMINDER'] as const]) {
      const row = rows.find(item => item.kind === kind);
      assert.equal(row?.external_purpose, purpose);
      assert.equal(row?.external_channel, 'WECHAT_SUBSCRIPTION');
      assert.equal(row?.template_slot, templateSlot);
      assert.equal(new Date(row!.external_scheduled_at).toISOString(), new Date(row!.job_due_at).toISOString());
    }
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','contract-p1')");
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'broad-reminder-grant');
    const cancellation = rows.find(row => row.kind === 'EVENT_CANCELLED')!;
    let sends = 0;
    await dispatchNotification(db, cancellation.id, { send: async () => {
      sends++;
      return { status: 'ACCEPTED', providerRef: 'must-not-send' };
    } });
    assert.equal(sends, 0);
    const { rows: blocked } = await db.query<{ external_status: string; external_failure_code: string }>(
      'SELECT external_status,external_failure_code FROM notifications WHERE id=$1', [cancellation.id]);
    assert.deepEqual(blocked[0], { external_status: 'PURPOSE_NOT_CONFIGURED',
      external_failure_code: 'PURPOSE_NOT_CONFIGURED' });
    const followups = await listNotificationFollowups(db);
    const pending = followups.items.find(item => item.notificationId === cancellation.id);
    assert.equal(pending?.externalStatus, 'PURPOSE_NOT_CONFIGURED');
    assert.equal(pending?.failureCode, 'PURPOSE_NOT_CONFIGURED');
    const handled = await recordNotificationFollowup(db, 'operator:notifications', cancellation.id,
      '外部用途尚未获批，已安排主办方人工告知', 'followup-cancellation');
    assert.equal(handled.externalStatus, 'PURPOSE_NOT_CONFIGURED');
  } finally { await db.close(); }
});

test('synthetic provider acceptance, definite rejection and uncertainty persist distinct receipts and failure codes', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    for (const actor of ['accepted', 'rejected', 'unknown']) {
      await db.query('INSERT INTO users(id,wechat_openid) VALUES($1,$2)', [actor, `synthetic-contract-${actor}`]);
      await setConsent(db, actor, 'EVENT_REMINDER', true, `grant-${actor}`);
      await register(db, actor, event.id, event.version, `register-${actor}`);
    }
    await confirmEvent(db, 'host', event.id, event.version, 'contract-confirm');
    for (const actor of ['accepted', 'rejected', 'unknown'])
      await enqueueStartReminder(db, event.id, actor, event.version);
    const { rows: notices } = await db.query<{ id: string; user_id: string }>(
      "SELECT id,user_id FROM notifications WHERE event_id=$1 AND kind='EVENT_REMINDER'", [event.id]);
    for (const notice of notices) await dispatchNotification(db, notice.id, { send: async item => {
      assert.equal(item.externalPurpose, 'EVENT_REMINDER');
      assert.equal(item.externalChannel, 'WECHAT_SUBSCRIPTION');
      assert.equal(item.templateSlot, 'EVENT_START_REMINDER');
      if (notice.user_id === 'accepted') return { status: 'ACCEPTED', providerRef: 'provider-accepted' };
      if (notice.user_id === 'rejected') return { status: 'REJECTED', failureCode: 'TEMPLATE_NOT_AUTHORIZED' };
      return { status: 'UNKNOWN', failureCode: 'TIMEOUT' };
    } });
    const { rows } = await db.query<{ user_id: string; external_status: string; provider_ref: string | null;
      external_failure_code: string | null; external_dispatch_started_at: Date | null;
      provider_responded_at: Date | null }>(`SELECT user_id,external_status,provider_ref,external_failure_code,
      external_dispatch_started_at,provider_responded_at FROM notifications
      WHERE event_id=$1 AND kind='EVENT_REMINDER' ORDER BY user_id`, [event.id]);
    assert.deepEqual(rows.map(row => [row.user_id, row.external_status, row.provider_ref, row.external_failure_code]), [
      ['accepted', 'PROVIDER_ACCEPTED', 'provider-accepted', null],
      ['rejected', 'PROVIDER_REJECTED', null, 'TEMPLATE_NOT_AUTHORIZED'],
      ['unknown', 'UNKNOWN_REQUIRES_RECONCILIATION', null, 'TIMEOUT']
    ]);
    assert.equal(rows.every(row => row.external_dispatch_started_at !== null), true);
    assert.equal(rows[0]?.provider_responded_at !== null, true);
    assert.equal(rows[1]?.provider_responded_at !== null, true);
    assert.equal(rows[2]?.provider_responded_at, null);
    const own = await exportPersonalData(db, 'accepted');
    const ownReminder = own.notifications.filter(item => item.external_purpose === 'EVENT_REMINDER');
    assert.equal(ownReminder.length, 1);
    assert.equal(ownReminder[0]?.template_slot, 'EVENT_START_REMINDER');
    assert.equal(ownReminder[0]?.provider_ref, 'provider-accepted');
    assert.equal(ownReminder[0]?.provider_responded_at !== null, true);
    const followups = await listNotificationFollowups(db);
    assert.deepEqual(new Set(followups.items.map(item => item.externalStatus)),
      new Set(['PROVIDER_REJECTED', 'UNKNOWN_REQUIRES_RECONCILIATION']));
    assert.equal(followups.items.find(item => item.externalStatus === 'PROVIDER_REJECTED')?.failureCode,
      'TEMPLATE_NOT_AUTHORIZED');
  } finally { await db.close(); }
});

test('an uncertain external send is queried without resending and a verified acceptance stays distinct from delivery', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const id = await enqueueNotification(db, event.id, 'p1', 'EVENT_REMINDER', event.version);
    await db.query(`UPDATE notifications SET external_status='UNKNOWN_REQUIRES_RECONCILIATION',
      external_failure_code='PROVIDER_TIMEOUT' WHERE id=$1`, [id]);
    let lookups = 0; let sends = 0;
    const adapter = {
      send: async () => { sends++; return { status: 'ACCEPTED' as const, providerRef: 'wrong-send' }; },
      lookup: async (request: { id: string }) => {
        lookups++;
        assert.equal(request.id, id);
        return { status: 'ACCEPTED' as const, providerRef: 'receipt-123' };
      }
    };
    const first = await reconcileUnknownNotification(db, 'operator:notifications', id, 'lookup-once', adapter);
    const replay = await reconcileUnknownNotification(db, 'operator:notifications', id, 'lookup-once', adapter);
    assert.deepEqual(replay, first);
    assert.equal(first.externalStatus, 'PROVIDER_ACCEPTED');
    assert.equal(first.deliveryConfirmed, false);
    assert.equal(lookups, 1);
    assert.equal(sends, 0);
    const { rows } = await db.query<{ external_status: string; provider_ref: string; read_at: Date | null }>(
      'SELECT external_status,provider_ref,read_at FROM notifications WHERE id=$1', [id]);
    assert.equal(rows[0]?.external_status, 'PROVIDER_ACCEPTED');
    assert.equal(rows[0]?.provider_ref, 'receipt-123');
    assert.equal(rows[0]?.read_at, null);
  } finally { await db.close(); }
});

test('unsupported, failed and inconclusive provider lookup leave an uncertain notification pending', async () => {
  const db = await createDatabase();
  try {
    const event = await published(db);
    const id = await enqueueNotification(db, event.id, 'p1', 'EVENT_REMINDER', event.version);
    await db.query(`UPDATE notifications SET external_status='UNKNOWN_REQUIRES_RECONCILIATION',
      external_failure_code='INTERRUPTED_DISPATCH' WHERE id=$1`, [id]);
    const unsupported = await reconcileUnknownNotification(db, 'operator:notifications', id, 'lookup-unsupported');
    assert.equal(unsupported.externalStatus, 'UNKNOWN_REQUIRES_RECONCILIATION');
    assert.equal(unsupported.resolution, 'LOOKUP_UNAVAILABLE');
    const failed = await reconcileUnknownNotification(db, 'operator:notifications', id, 'lookup-failed', {
      lookup: async () => { throw new Error('secret provider detail'); }
    });
    assert.equal(failed.externalStatus, 'UNKNOWN_REQUIRES_RECONCILIATION');
    assert.equal(failed.resolution, 'LOOKUP_FAILED');
    const inconclusive = await reconcileUnknownNotification(db, 'operator:notifications', id, 'lookup-inconclusive', {
      lookup: async () => ({ status: 'UNKNOWN', failureCode: 'NOT_FOUND' })
    });
    assert.equal(inconclusive.externalStatus, 'UNKNOWN_REQUIRES_RECONCILIATION');
    assert.equal(inconclusive.resolution, 'INCONCLUSIVE');
    const { rows } = await db.query<{ external_status: string; external_failure_code: string }>(
      'SELECT external_status,external_failure_code FROM notifications WHERE id=$1', [id]);
    assert.equal(rows[0]?.external_status, 'UNKNOWN_REQUIRES_RECONCILIATION');
    assert.equal(rows[0]?.external_failure_code, 'INTERRUPTED_DISPATCH');
  } finally { await db.close(); }
});

test('operator reconciliation route enforces permission and does not send a second notification', async () => {
  const db = await createDatabase();
  let lookups = 0;
  const app = createApp(db, { environment: 'test', devAuth: true, operationsUsers: ['ops'], checkInSecret: 'secret',
    notificationLookupAdapter: { lookup: async () => { lookups++; return { status: 'REJECTED', failureCode: 'TEMPLATE_DENIED' }; } } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  try {
    const event = await published(db);
    const id = await enqueueNotification(db, event.id, 'p1', 'EVENT_REMINDER', event.version);
    await db.query("UPDATE notifications SET external_status='UNKNOWN_REQUIRES_RECONCILIATION' WHERE id=$1", [id]);
    const url = `http://127.0.0.1:${(app.address() as { port: number }).port}/ops/notifications/${id}/reconcile`;
    const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': 'reconcile-http' };
    const denied = await fetch(url, { method: 'POST', headers: { ...headers, 'X-Dev-User': 'p1' }, body: '{}' });
    assert.equal(denied.status, 403);
    assert.equal(lookups, 0);
    const unexpectedBody = await fetch(url, { method: 'POST',
      headers: { ...headers, 'X-Dev-User': 'ops' }, body: '{"forceRetry":true}' });
    assert.equal(unexpectedBody.status, 400);
    assert.equal(lookups, 0);
    const response = await fetch(url, { method: 'POST', headers: { ...headers, 'X-Dev-User': 'ops' }, body: '{}' });
    assert.equal(response.status, 200);
    const receipt = await response.json() as { externalStatus: string; deliveryConfirmed: boolean; resolution: string };
    assert.deepEqual(receipt, { notificationId: id, externalStatus: 'PROVIDER_REJECTED',
      deliveryConfirmed: false, resolution: 'REJECTED' });
    const replay = await fetch(url, { method: 'POST', headers: { ...headers, 'X-Dev-User': 'ops' }, body: '{}' });
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), receipt);
    assert.equal(lookups, 1);
  } finally { app.close(); await db.close(); }
});
