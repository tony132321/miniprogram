import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { setConsent } from '../src/notifications.ts';

test('a missing account cannot create or replay a reminder consent grant', async () => {
  const db = await createDatabase();
  try {
    await assert.rejects(() => setConsent(db, 'missing-member', 'EVENT_REMINDER', true, 'grant'),
      { code: 'ACCOUNT_NOT_FOUND' });
    const { rows } = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM notification_consents
      WHERE user_id='missing-member'`);
    assert.equal(rows[0]?.count, 0);
    const { rows: keys } = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM idempotency
      WHERE actor_id='missing-member'`);
    assert.equal(keys[0]?.count, 0);
  } finally { await db.close(); }
});
