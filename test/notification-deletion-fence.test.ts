import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { createPrivacyRequest } from '../src/operations.ts';
import { enqueueInAppOutcomePrompt, enqueueNotification, enqueueStartReminder } from '../src/notifications.ts';

test('new in-app and queued notices cannot revive a deleted or disabled recipient', async () => {
  const db = await createDatabase();
  try {
    const event = await createDraft(db, 'host', {}, 'notice-delete-fence');
    await db.query(`INSERT INTO users(id,wechat_openid,status) VALUES
      ('deleting','wx-delete','ACTIVE'),('disabled','wx-disabled','DISABLED'),('active','wx-active','ACTIVE')`);
    await createPrivacyRequest(db, 'deleting', { kind: 'DELETE' }, 'notice-delete-request');

    assert.equal(await enqueueNotification(db, event.id, 'deleting', 'EVENT_CANCELLED', event.version), '');
    assert.equal(await enqueueNotification(db, event.id, 'disabled', 'EVENT_CANCELLED', event.version), '');
    await enqueueInAppOutcomePrompt(db, event.id, 'deleting', 'EVENT_OUTCOME_REVIEW', event.version);
    await enqueueStartReminder(db, event.id, 'disabled', event.version);
    const direct = await db.query<{ id: string }>(`INSERT INTO notifications(id,event_id,user_id,kind,event_version)
      VALUES('direct-deleted',$1,'deleting','EVENT_CANCELLED',$2) RETURNING id`, [event.id, event.version]);
    assert.equal(direct.rows.length, 0);
    assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM notifications
      WHERE user_id IN ('deleting','disabled')`)).rows[0]?.n, 0);

    const activeId = await enqueueNotification(db, event.id, 'active', 'EVENT_CANCELLED', event.version);
    assert.ok(activeId);
    assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM notifications
      WHERE user_id='active'`)).rows[0]?.n, 1);
  } finally { await db.close(); }
});
