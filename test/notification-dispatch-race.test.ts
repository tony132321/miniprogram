import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase, type Database } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { dispatchNotification, enqueueStartReminder, setConsent } from '../src/notifications.ts';
import { publishApprovedInvite, register } from './helpers.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

function after(ms: number): Promise<'waiting'> {
  return new Promise(resolve => setTimeout(() => resolve('waiting'), ms));
}

async function queuedReminder(db: Database): Promise<string> {
  const start = Date.now() + 7 * 24 * 60 * 60_000;
  const input = { title: '撤权发送竞争', type: 'badminton', startAt: new Date(start).toISOString(),
    endAt: new Date(start + 2 * 60 * 60_000).toISOString(), timeZone: 'Asia/Shanghai', city: '深圳',
    venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
    registrationDeadline: new Date(start - 30 * 60_000).toISOString(),
    confirmationDeadline: new Date(start - 90 * 60_000).toISOString(), feeMode: 'FREE',
    feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO',
    hostParticipates: true };
  const draft = await createDraft(db, 'host', input, 'race-draft');
  const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'race-publish');
  await db.query("INSERT INTO users(id,wechat_openid) VALUES('member','synthetic-race-member')");
  await setConsent(db, 'member', 'EVENT_REMINDER', true, 'race-grant');
  await register(db, 'member', event.id, event.version, 'race-register');
  await db.query("UPDATE events SET status='CONFIRMED' WHERE id=$1", [event.id]);
  await enqueueStartReminder(db, event.id, 'member', event.version);
  const { rows } = await db.query<{ id: string }>(
    "SELECT id FROM notifications WHERE event_id=$1 AND user_id='member' AND kind='EVENT_REMINDER'", [event.id]);
  return rows[0]!.id;
}

test('nested local send fence rejects promptly without waiting on its own gate', async () => {
  const db = await createDatabase();
  try {
    const fence = db.withExternalSendFence!;
    const outcome = await fence(async () => Promise.race([
      fence(async () => 'unexpected').then(() => 'nested send ran', error => String(error)),
      after(300)
    ]));
    assert.match(outcome, /Nested external send fence is not allowed/);
  } finally { await db.close(); }
});

test('a participating host with a current confirmed registration can receive the reminder', async () => {
  const db = await createDatabase();
  try {
    const memberReminderId = await queuedReminder(db);
    const { rows } = await db.query<{ event_id: string; event_version: number }>(
      'SELECT event_id,event_version FROM notifications WHERE id=$1', [memberReminderId]);
    const eventId = rows[0]!.event_id;
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('host','synthetic-race-host')");
    await setConsent(db, 'host', 'EVENT_REMINDER', true, 'host-grant');
    await enqueueStartReminder(db, eventId, 'host', rows[0]!.event_version);
    const hostReminder = (await db.query<{ id: string }>(
      "SELECT id FROM notifications WHERE event_id=$1 AND user_id='host' AND kind='EVENT_REMINDER'", [eventId]
    )).rows[0]!.id;
    let sends = 0;
    await dispatchNotification(db, hostReminder, { send: async () => {
      sends++;
      return { status: 'ACCEPTED', providerRef: 'participating-host' };
    } });
    assert.equal(sends, 1);
    assert.equal((await db.query<{ external_status: string }>(
      'SELECT external_status FROM notifications WHERE id=$1', [hostReminder]
    )).rows[0]?.external_status, 'PROVIDER_ACCEPTED');
  } finally { await db.close(); }
});

test('withdrawal after the durable dispatch marker is rechecked before provider send', async () => {
  const db = await createDatabase();
  try {
    const notificationId = await queuedReminder(db);
    const claimed = deferred();
    const resume = deferred();
    let firstTransaction = true;
    const dispatchDb: Database = {
      query: db.query,
      close: db.close,
      transaction: async fn => {
        const result = await db.transaction(fn);
        if (firstTransaction) {
          firstTransaction = false;
          claimed.resolve();
          await resume.promise;
        }
        return result;
      }
    };
    let sends = 0;
    const sending = dispatchNotification(dispatchDb, notificationId, { send: async () => {
      sends++;
      return { status: 'ACCEPTED', providerRef: 'must-not-send' };
    } });
    try {
      assert.equal(await Promise.race([claimed.promise.then(() => 'claimed'), after(3000)]), 'claimed');
      assert.equal((await db.query<{ external_status: string }>(
        'SELECT external_status FROM notifications WHERE id=$1', [notificationId]
      )).rows[0]?.external_status, 'DISPATCHING');
      await setConsent(db, 'member', 'EVENT_REMINDER', false, 'race-withdraw');
    } finally { resume.resolve(); }
    await sending;
    assert.equal(sends, 0);
    assert.equal((await db.query<{ external_status: string }>(
      'SELECT external_status FROM notifications WHERE id=$1', [notificationId]
    )).rows[0]?.external_status, 'CONSENT_WITHDRAWN');
  } finally { await db.close(); }
});

test('a completed consent withdrawal cannot precede a new provider call across the final-check commit gap', async () => {
  const db = await createDatabase();
  try {
    const notificationId = await queuedReminder(db);

    // Pause a proposed short validation transaction just after it commits. In
    // the current implementation, that transaction stays open through send.
    const validationCommitted = deferred();
    const resumeAfterValidation = deferred();
    let paused = false;
    const dispatchDb: Database = {
      query: db.query,
      close: db.close,
      transaction: async fn => {
        let checkedConsent = false;
        const result = await db.transaction(tx => fn({ query: async (sql, params) => {
          if (sql.includes('FROM notification_consents WHERE user_id=$1 AND purpose=$2')) checkedConsent = true;
          return tx.query(sql, params);
        } }));
        if (checkedConsent && !paused) {
          paused = true;
          validationCommitted.resolve();
          await resumeAfterValidation.promise;
        }
        return result;
      }
    };
    const sendEntered = deferred();
    const releaseSend = deferred();
    let withdrawalCompleted = false;
    let lateSends = 0;
    let sends = 0;
    const sending = dispatchNotification(dispatchDb, notificationId, { send: async () => {
      sends++;
      if (withdrawalCompleted) lateSends++;
      sendEntered.resolve();
      await releaseSend.promise;
      return { status: 'ACCEPTED', providerRef: 'synthetic-race' };
    } });
    let withdrawing: Promise<unknown> | undefined;
    try {
      const first = await Promise.race([
        sendEntered.promise.then(() => 'send' as const),
        validationCommitted.promise.then(() => 'commit' as const),
        after(3000)
      ]);
      assert.notEqual(first, 'waiting', 'dispatch never reached the final check or provider');
      withdrawing = setConsent(db, 'member', 'EVENT_REMINDER', false, 'race-withdraw')
        .then(result => { withdrawalCompleted = true; return result; });
      const withdrawalBeforeRelease = await Promise.race([
        withdrawing.then(() => 'committed' as const), after(first === 'commit' ? 3000 : 150)
      ]);
      if (first === 'send') {
        assert.equal(withdrawalBeforeRelease, 'waiting',
          'withdrawal must wait for the already-started provider call');
      }
      // If a split transaction lets withdrawal commit in the gap, resuming
      // dispatch must not invoke the adapter afterward.
      resumeAfterValidation.resolve();
      releaseSend.resolve();
      await sending;
      await withdrawing;
      assert.equal(lateSends, 0, 'adapter.send started after withdrawal completed');
      assert.equal(sends, first === 'commit' && withdrawalBeforeRelease === 'committed' ? 0 : 1);
      assert.equal((await db.query<{ granted: boolean }>(
        "SELECT granted FROM notification_consents WHERE user_id='member' AND purpose='EVENT_REMINDER'"
      )).rows[0]?.granted, false);
    } finally {
      resumeAfterValidation.resolve();
      releaseSend.resolve();
      await Promise.allSettled([sending, withdrawing]);
    }
  } finally { await db.close(); }
});

test('provider send does not hold a database transaction while it waits for the external response', async () => {
  const db = await createDatabase();
  try {
    const notificationId = await queuedReminder(db);
    let readFinished = false;
    await dispatchNotification(db, notificationId, { send: async () => {
      const read = db.query('SELECT 1 AS healthy').then(() => { readFinished = true; });
      const first = await Promise.race([read.then(() => 'read'), after(250)]);
      assert.equal(first, 'read', 'database read remained blocked by an open send transaction');
      return { status: 'ACCEPTED', providerRef: 'outside-transaction' };
    } });
    assert.equal(readFinished, true);
    assert.equal((await db.query<{ external_status: string }>(
      'SELECT external_status FROM notifications WHERE id=$1', [notificationId]
    )).rows[0]?.external_status, 'PROVIDER_ACCEPTED');
  } finally { await db.close(); }
});

test('a queued reminder fails closed when its user row has been deleted', async () => {
  const db = await createDatabase();
  try {
    const notificationId = await queuedReminder(db);
    await db.query("DELETE FROM users WHERE id='member'");
    let sends = 0;
    await dispatchNotification(db, notificationId, { send: async () => {
      sends++;
      return { status: 'ACCEPTED', providerRef: 'must-not-send' };
    } });
    assert.equal(sends, 0);
    assert.equal((await db.query<{ external_status: string }>(
      'SELECT external_status FROM notifications WHERE id=$1', [notificationId]
    )).rows[0]?.external_status, 'ACCOUNT_DISABLED');
  } finally { await db.close(); }
});

for (const [name, sql] of [
  ['deleted', "DELETE FROM registrations WHERE event_id=(SELECT event_id FROM notifications WHERE id=$1) AND user_id='member'"],
  ['waitlisted', "UPDATE registrations SET status='WAITLISTED' WHERE event_id=(SELECT event_id FROM notifications WHERE id=$1) AND user_id='member'"],
  ['old accepted version', "UPDATE registrations SET accepted_version=0 WHERE event_id=(SELECT event_id FROM notifications WHERE id=$1) AND user_id='member'"]
] as const) {
  test(`a queued reminder fails closed when registration is ${name}`, async () => {
    const db = await createDatabase();
    try {
      const notificationId = await queuedReminder(db);
      if (name === 'deleted') await db.query(`DELETE FROM registration_status_history
        WHERE registration_id=(SELECT id FROM registrations
          WHERE event_id=(SELECT event_id FROM notifications WHERE id=$1) AND user_id='member')`, [notificationId]);
      await db.query(sql, [notificationId]);
      let sends = 0;
      await dispatchNotification(db, notificationId, { send: async () => {
        sends++;
        return { status: 'ACCEPTED', providerRef: 'must-not-send' };
      } });
      assert.equal(sends, 0);
      assert.equal((await db.query<{ external_status: string }>(
        'SELECT external_status FROM notifications WHERE id=$1', [notificationId]
      )).rows[0]?.external_status, 'STALE_STATE');
    } finally { await db.close(); }
  });
}

test('a queued reminder fails closed after event starts or consent scope changes', async () => {
  for (const mutation of [
    "UPDATE events SET status='IN_PROGRESS' WHERE id=(SELECT event_id FROM notifications WHERE id=$1)",
    "UPDATE notification_consents SET scope='OTHER_SCOPE' WHERE user_id='member' AND purpose='EVENT_REMINDER'"
  ]) {
    const db = await createDatabase();
    try {
      const notificationId = await queuedReminder(db);
      await db.query(mutation, mutation.includes('$1') ? [notificationId] : []);
      let sends = 0;
      await dispatchNotification(db, notificationId, { send: async () => {
        sends++;
        return { status: 'ACCEPTED', providerRef: 'must-not-send' };
      } });
      assert.equal(sends, 0);
      assert.equal((await db.query<{ external_status: string }>(
        'SELECT external_status FROM notifications WHERE id=$1', [notificationId]
      )).rows[0]?.external_status,
      mutation.includes('notification_consents') ? 'CONSENT_RECONFIRM_REQUIRED' : 'STALE_STATE');
    } finally { await db.close(); }
  }
});

test('a notification whose recipient changes after claim is not sent using the old recipient', async () => {
  const db = await createDatabase();
  try {
    const notificationId = await queuedReminder(db);
    const claimed = deferred();
    const resume = deferred();
    let first = true;
    const pausedDb: Database = { ...db, transaction: async fn => {
      const result = await db.transaction(fn);
      if (first) {
        first = false;
        claimed.resolve();
        await resume.promise;
      }
      return result;
    } };
    let sends = 0;
    const sending = dispatchNotification(pausedDb, notificationId, { send: async () => {
      sends++;
      return { status: 'ACCEPTED', providerRef: 'must-not-send' };
    } });
    try {
      assert.equal(await Promise.race([claimed.promise.then(() => 'claimed'), after(3000)]), 'claimed');
      await db.query("UPDATE notifications SET user_id='other' WHERE id=$1", [notificationId]);
    } finally { resume.resolve(); }
    await sending;
    assert.equal(sends, 0);
    assert.equal((await db.query<{ external_status: string }>(
      'SELECT external_status FROM notifications WHERE id=$1', [notificationId]
    )).rows[0]?.external_status, 'STALE_STATE');
  } finally { await db.close(); }
});
