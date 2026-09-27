import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createDatabase, type Database } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { consentNotice, setConsent } from '../src/notifications.ts';
import { createPrivacyRequest, listPrivacyRequests } from '../src/operations.ts';
import * as privacyOperations from '../src/operations.ts';
import { exportPersonalData } from '../src/privacy.ts';

test('DELETE intake atomically protects the person and gives an accurate owner receipt', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','privacy-p1')");
    const event = await createDraft(db, 'p1', { title: '私密活动' }, 'privacy-protect-event');
    await db.query('INSERT INTO event_aliases(event_id,user_id,display_name) VALUES($1,$2,$3)',
      [event.id, 'p1', '原活动昵称']);
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'privacy-reminder');
    await setConsent(db, 'p1', 'SIMILAR_ACTIVITY_INVITES', true, 'privacy-repeat');

    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'privacy-delete-1');
    assert.equal(receipt.kind, 'DELETE');
    assert.equal(receipt.status, 'PROTECTED_PENDING_POLICY');
    assert.equal(receipt.protection?.state, 'APPLIED');
    assert.equal(receipt.protection?.consentWithdrawals, 2);
    assert.equal(receipt.protection?.aliasesRemoved, 1);
    assert.match(receipt.notice ?? '', /尚未.*删除.*去标识/);
    assert.ok(receipt.protection?.appliedAt);
    assert.deepEqual((await db.query<{ purpose: string; granted: boolean }>(
      "SELECT purpose,granted FROM notification_consents WHERE user_id='p1' ORDER BY purpose")).rows,
    [{ purpose: 'EVENT_REMINDER', granted: false }, { purpose: 'SIMILAR_ACTIVITY_INVITES', granted: false }]);
    assert.deepEqual((await db.query("SELECT event_id FROM event_aliases WHERE user_id='p1'")).rows, []);
    assert.deepEqual((await db.query<{ purpose: string; granted: boolean; source: string }>(
      "SELECT purpose,granted,source FROM event_alias_consent_history WHERE user_id='p1'")).rows,
    [{ purpose: 'EVENT_MEMBER_DISPLAY', granted: false, source: 'DELETE_REQUEST' }]);
    assert.deepEqual((await db.query<{ purpose: string; source: string }>(
      "SELECT purpose,source FROM notification_consent_history WHERE user_id='p1' AND granted=false ORDER BY purpose")).rows,
    [{ purpose: 'EVENT_REMINDER', source: 'DELETE_REQUEST' },
      { purpose: 'SIMILAR_ACTIVITY_INVITES', source: 'DELETE_REQUEST' }]);
    const withdrawal = await db.query<{ notice_version: string; notice_text: string }>(
      "SELECT notice_version,notice_text FROM notification_consent_history WHERE user_id='p1' AND granted=false AND purpose='EVENT_REMINDER'");
    assert.match(withdrawal.rows[0]!.notice_version, /^[a-f0-9]{64}$/);
    assert.notEqual(withdrawal.rows[0]!.notice_version, consentNotice('EVENT_REMINDER').version,
      'automatic withdrawal must not be recorded as the grant notice');
    assert.match(withdrawal.rows[0]!.notice_text, /注销或删除申请.*撤回/);
    assert.deepEqual((await listPrivacyRequests(db, 'p1')).find(item => item.id === receipt.id), receipt);
    const exportData = await exportPersonalData(db, 'p1');
    assert.ok(exportData.privacyRequests.some(item => item.id === receipt.id && item.protection_applied_at));
    assert.equal(exportData.notificationConsentHistory.filter(item => item.source === 'DELETE_REQUEST').length, 2);
    assert.equal(exportData.eventAliasConsentHistory.filter(item => item.source === 'DELETE_REQUEST').length, 1);
    const repeated = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'privacy-delete-2');
    assert.deepEqual(repeated, receipt, 'a new idempotency key reuses the active DELETE request');
    assert.deepEqual(await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'privacy-delete-1'), receipt,
      'the original idempotency key returns the same receipt');
    assert.equal((await db.query("SELECT count(*)::int AS count FROM privacy_requests WHERE user_id='p1' AND kind='DELETE'"))
      .rows[0]?.count, 1);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM notification_consent_history WHERE user_id='p1' AND granted=false"))
      .rows[0]?.count, 2);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM event_alias_consent_history WHERE user_id='p1' AND granted=false"))
      .rows[0]?.count, 1);
    const audit = await db.query<{ detail: { requestId: string; consentWithdrawals: number; aliasesRemoved: number } }>(
      "SELECT detail FROM audit WHERE actor_id='p1' AND action='PRIVACY_DELETE_PROTECTED'");
    assert.deepEqual(audit.rows, [{ detail: { requestId: receipt.id, consentWithdrawals: 2, aliasesRemoved: 1 } }]);
    assert.doesNotMatch(JSON.stringify(audit.rows), /原活动昵称|privacy-p1/);
  } finally { await db.close(); }
});

test('a prior open DELETE request is reused and protected when the owner retries', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','privacy-existing-p1')");
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'prior-reminder');
    await db.query("INSERT INTO privacy_requests(id,user_id,kind) VALUES('prior-delete','p1','DELETE')");
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'retry-prior-delete');
    assert.equal(receipt.id, 'prior-delete');
    assert.equal(receipt.status, 'PROTECTED_PENDING_POLICY');
    assert.equal(receipt.protection?.consentWithdrawals, 1);
    assert.equal((await db.query("SELECT granted FROM notification_consents WHERE user_id='p1' AND purpose='EVENT_REMINDER'"))
      .rows[0]?.granted, false);
  } finally { await db.close(); }
});

test('a legacy idempotency replay still applies safeguards and refreshes its receipt', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','privacy-legacy-p1')");
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'legacy-reminder');
    await db.query("INSERT INTO privacy_requests(id,user_id,kind) VALUES('legacy-delete','p1','DELETE')");
    await db.query(`INSERT INTO idempotency(actor_id,route,key,result) VALUES
      ('p1','privacy-request','legacy-key','{"id":"legacy-delete","kind":"DELETE","status":"OPEN"}')`);
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'legacy-key');
    assert.equal(receipt.id, 'legacy-delete');
    assert.equal(receipt.status, 'PROTECTED_PENDING_POLICY');
    assert.equal(receipt.protection?.state, 'APPLIED');
    assert.equal((await db.query("SELECT granted FROM notification_consents WHERE user_id='p1' AND purpose='EVENT_REMINDER'"))
      .rows[0]?.granted, false);
    const replay = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'legacy-key');
    assert.deepEqual(replay, receipt);
  } finally { await db.close(); }
});

test('DELETE intake rolls back the request and consent withdrawal if alias removal fails', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','privacy-rollback-p1')");
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'rollback-reminder');
    const failingDb: Database = { ...db, transaction: fn => db.transaction(tx => fn({
      query: (sql, params) => {
        if (sql.startsWith('DELETE FROM event_aliases')) throw new Error('simulated alias storage failure');
        return tx.query(sql, params);
      }
    })) };
    await assert.rejects(() => createPrivacyRequest(failingDb, 'p1', { kind: 'DELETE' }, 'rollback-delete'),
      /simulated alias storage failure/);
    assert.deepEqual((await db.query("SELECT id FROM privacy_requests WHERE user_id='p1'")).rows, []);
    assert.equal((await db.query("SELECT granted FROM notification_consents WHERE user_id='p1' AND purpose='EVENT_REMINDER'"))
      .rows[0]?.granted, true);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM notification_consent_history WHERE user_id='p1'"))
      .rows[0]?.count, 1);
  } finally { await db.close(); }
});

test('startup repair safeguards legacy OPEN requests before serving and is idempotent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'irl-privacy-upgrade-'));
  try {
    const db = await createDatabase(directory);
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','privacy-upgrade-p1')");
    const event = await createDraft(db, 'p1', { title: '历史活动' }, 'privacy-upgrade-event');
    await db.query('INSERT INTO event_aliases(event_id,user_id,display_name) VALUES($1,$2,$3)',
      [event.id, 'p1', '历史昵称']);
    await setConsent(db, 'p1', 'EVENT_REMINDER', true, 'upgrade-reminder');
    await setConsent(db, 'p1', 'SIMILAR_ACTIVITY_INVITES', true, 'upgrade-repeat');
    await db.query("INSERT INTO privacy_requests(id,user_id,kind) VALUES('legacy-open-a','p1','DELETE'),('legacy-open-b','p1','DELETE')");
    await db.close();

    const reopened = await createDatabase(directory);
    try {
      assert.equal(await privacyOperations.protectPendingDeletionRequests(reopened), 1);
      const own = await listPrivacyRequests(reopened, 'p1');
      assert.equal(own.length, 2);
      assert.ok(own.every(item => item.status === 'PROTECTED_PENDING_POLICY' && item.protection?.state === 'APPLIED'));
      assert.deepEqual((await reopened.query("SELECT purpose,granted FROM notification_consents WHERE user_id='p1' ORDER BY purpose")).rows,
        [{ purpose: 'EVENT_REMINDER', granted: false }, { purpose: 'SIMILAR_ACTIVITY_INVITES', granted: false }]);
      assert.deepEqual((await reopened.query("SELECT event_id FROM event_aliases WHERE user_id='p1'")).rows, []);
      assert.equal((await reopened.query("SELECT count(*)::int AS count FROM notification_consent_history WHERE user_id='p1' AND source='DELETE_REQUEST'"))
        .rows[0]?.count, 2);
      const audit = await reopened.query<{ detail: { source: string; consentWithdrawals: number; aliasesRemoved: number;
        additionalRequestsProtected: number } }>(
        "SELECT detail FROM audit WHERE actor_id='p1' AND action='PRIVACY_DELETE_PROTECTED'");
      assert.deepEqual(audit.rows.map(row => row.detail),
        [{ source: 'STARTUP_REPAIR', consentWithdrawals: 2, aliasesRemoved: 1, additionalRequestsProtected: 1,
          requestId: 'legacy-open-a' }]);
      assert.equal(await privacyOperations.protectPendingDeletionRequests(reopened), 0);
      assert.equal((await reopened.query("SELECT count(*)::int AS count FROM notification_consent_history WHERE user_id='p1' AND source='DELETE_REQUEST'"))
        .rows[0]?.count, 2);
      assert.equal((await reopened.query("SELECT count(*)::int AS count FROM audit WHERE actor_id='p1' AND action='PRIVACY_DELETE_PROTECTED'"))
        .rows[0]?.count, 1);
    } finally { await reopened.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
