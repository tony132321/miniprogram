import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { listAiSemanticAlerts, listAiSemanticAlertReviews, reviewAiSemanticAlert } from '../src/ai-semantic-answer.ts';

test('semantic anomaly review is named, audited, state-specific and preserves uncertain cost', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', {}, 'semantic-review-draft');
    await db.query(`INSERT INTO ai_semantic_requests
      (actor_id,event_id,request_key,fallback_key,request_hash,status,budget_fen,reserved_fen,created_at)
      VALUES('host',$1,'changing','review-fallback',$2,'STARTED',10,10,now()-interval '2 minutes')`,
    [draft.id, 'f'.repeat(64)]);
    assert.equal((await listAiSemanticAlerts(db)).total, 1);
    const [left, right] = await Promise.allSettled([
      reviewAiSemanticAlert(db, 'operator:ops', 'host', 'changing', '内部复核在途请求，账单仍待查证', 'review-one'),
      reviewAiSemanticAlert(db, 'operator:ops2', 'host', 'changing', '另一位运营复核同一状态，账单仍待查', 'review-two')
    ]);
    assert.deepEqual([left.status, right.status].sort(), ['fulfilled', 'rejected']);
    const winner = left.status === 'fulfilled' ? left.value : (right as PromiseFulfilledResult<any>).value;
    assert.equal(winner.reviewState, 'REVIEW_RECORDED');
    assert.equal((await listAiSemanticAlerts(db)).total, 0);
    await db.query(`UPDATE ai_semantic_requests SET status='UNKNOWN',cost_status='UNKNOWN',
      fallback_reason='PROCESS_INTERRUPTED',finished_at=clock_timestamp()
      WHERE actor_id='host' AND request_key='changing'`);
    assert.equal((await listAiSemanticAlerts(db)).total, 1);
    await reviewAiSemanticAlert(db, 'operator:ops', 'host', 'changing', '第二次复核未知状态，继续保留预算', 'review-unknown');
    assert.equal((await listAiSemanticAlerts(db)).total, 0);
    await db.query(`UPDATE ai_semantic_requests SET status='COMPLETED',result=$1::jsonb,
      fallback_reason='TIMEOUT' WHERE actor_id='host' AND request_key='changing'`,
    [JSON.stringify({ answer: '尚未确认', source: 'UNKNOWN', eventVersion: 1 })]);
    assert.equal((await listAiSemanticAlerts(db)).total, 1);
    await reviewAiSemanticAlert(db, 'operator:ops2', 'host', 'changing', '第三次复核已完成状态，预算继续保留', 'review-completed');
    assert.equal((await listAiSemanticAlerts(db)).total, 0);
    const history = await listAiSemanticAlertReviews(db);
    assert.deepEqual(history.items.map(item => item.status).sort(), ['COMPLETED', 'STARTED', 'UNKNOWN']);
    assert.equal(JSON.stringify(history).includes('review-fallback'), false);
    assert.equal(JSON.stringify(history).includes('f'.repeat(64)), false);
    const { rows: original } = await db.query<{ status: string; cost_status: string; reserved_fen: number }>(
      "SELECT status,cost_status,reserved_fen FROM ai_semantic_requests WHERE actor_id='host' AND request_key='changing'");
    assert.deepEqual(original[0], { status: 'COMPLETED', cost_status: 'UNKNOWN', reserved_fen: 10 });
    const { rows: audits } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE action='AI_SEMANTIC_ALERT_REVIEW'");
    assert.equal(audits[0]?.n, 3);
  } finally { await db.close(); }
});
