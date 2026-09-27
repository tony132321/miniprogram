import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, type Database } from '../src/db.ts';
import { createDraft, getEvent } from '../src/events.ts';
import { approveAiAction, executeAiAction, prepareAiAction, type AiActionProposal } from '../src/ai-actions.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const databaseName = validatePostgresTestUrl(url);
const probe = new pg.Pool({ connectionString: url, max: 1 });
try { await assertEmptyPostgresTestDatabase(probe, databaseName); }
finally { await probe.end(); }

let first: Database | undefined;
let second: Database | undefined;
try {
  first = await createProductionDatabase(url);
  second = await createProductionDatabase(url);
  const draft = await createDraft(first, 'pg-ai-host', { title: '原草稿' }, 'pg-ai-draft');
  const proposal: AiActionProposal = { kind: 'SAVE_DRAFT', eventId: draft.id,
    expectedVersion: draft.version, payload: { title: '已审定标题' } };
  const prepared = await prepareAiAction(first, 'pg-ai-host', proposal, 'pg-ai-prepare');
  await approveAiAction(first, 'pg-ai-host', prepared.id, true, prepared.payloadHash, 'pg-ai-approve');
  const executions = await Promise.allSettled([
    executeAiAction(first, 'pg-ai-host', prepared.id, { ...proposal, payloadHash: prepared.payloadHash }, 'pg-ai-run-a'),
    executeAiAction(second, 'pg-ai-host', prepared.id, { ...proposal, payloadHash: prepared.payloadHash }, 'pg-ai-run-b')
  ]);
  const committed = executions.filter(result => result.status === 'fulfilled');
  const rejected = executions.filter(result => result.status === 'rejected');
  assert.equal(committed.length, 1);
  assert.equal(rejected.length, 1);
  const receipt = committed[0]!.value;
  assert.equal(receipt.status, 'SUCCEEDED');
  assert.equal(receipt.resourceVersion, draft.version + 1);
  const event = await getEvent(second, 'pg-ai-host', draft.id);
  assert.equal(event.payload.title, '已审定标题');
  assert.equal(event.version, receipt.resourceVersion);
  const { rows } = await second.query<{ status: string; action_id: string; receipt: { actionId: string };
    audit_rows: number }>(`SELECT p.status,p.action_id,p.receipt,
    (SELECT count(*)::int FROM audit a WHERE a.id=p.action_id::text AND a.action='AI_ACTION_EXECUTE') AS audit_rows
    FROM ai_action_proposals p WHERE p.id=$1`, [prepared.id]);
  assert.equal(rows[0]?.status, 'SUCCEEDED');
  assert.equal(rows[0]?.action_id, receipt.actionId);
  assert.equal(rows[0]?.receipt.actionId, receipt.actionId);
  assert.equal(rows[0]?.audit_rows, 1);
  const competingDraft = await createDraft(first, 'pg-ai-host', { title: '竞争草稿' }, 'pg-ai-competing-draft');
  const proposals: AiActionProposal[] = ['第一人提交', '第二人提交'].map(title => ({
    kind: 'SAVE_DRAFT', eventId: competingDraft.id, expectedVersion: competingDraft.version,
    payload: { title }
  }));
  const preparedActions = await Promise.all(proposals.map((item, index) =>
    prepareAiAction(index === 0 ? first! : second!, 'pg-ai-host', item, `pg-ai-prepare-${index}`)));
  await Promise.all(preparedActions.map((item, index) =>
    approveAiAction(index === 0 ? first! : second!, 'pg-ai-host', item.id, true,
      item.payloadHash, `pg-ai-approve-${index}`)));
  const competing = await Promise.allSettled(preparedActions.map((item, index) =>
    executeAiAction(index === 0 ? first! : second!, 'pg-ai-host', item.id,
      { ...proposals[index]!, payloadHash: item.payloadHash }, `pg-ai-compete-${index}`)));
  const competingCommitted = competing.filter(result => result.status === 'fulfilled');
  const competingRejected = competing.filter(result => result.status === 'rejected');
  assert.equal(competingCommitted.length, 1);
  assert.equal(competingRejected.length, 1);
  assert.equal(competingRejected[0]!.reason.code, 'VERSION_CONFLICT');
  assert.equal((await getEvent(second, 'pg-ai-host', competingDraft.id)).version, competingDraft.version + 1);
  const expiringDraft = await createDraft(first, 'pg-ai-host', { title: '到期草稿' }, 'pg-ai-expiring-draft');
  const expiringProposal: AiActionProposal = { kind: 'SAVE_DRAFT', eventId: expiringDraft.id,
    expectedVersion: expiringDraft.version, payload: { title: '不得保存' } };
  const expiring = await prepareAiAction(first, 'pg-ai-host', expiringProposal, 'pg-ai-expiring-prepare');
  await approveAiAction(first, 'pg-ai-host', expiring.id, true, expiring.payloadHash, 'pg-ai-expiring-approve');
  await first.query("UPDATE ai_action_proposals SET expires_at=clock_timestamp()+interval '1 second' WHERE id=$1", [expiring.id]);
  const watcher = new pg.Pool({ connectionString: url, max: 1 });
  let expiryRejection: Promise<void> | undefined;
  try {
    await first.transaction(async tx => {
      await tx.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [expiringDraft.id]);
      const expiringExecution = executeAiAction(second!, 'pg-ai-host', expiring.id,
        { ...expiringProposal, payloadHash: expiring.payloadHash }, 'pg-ai-expiring-run');
      expiryRejection = assert.rejects(expiringExecution, { code: 'AI_APPROVAL_EXPIRED' });
      let blocked = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        const { rows: waits } = await watcher.query<{ waiting: number }>(`SELECT count(*)::int AS waiting
          FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'
            AND query ILIKE '%FROM events WHERE id=%FOR UPDATE%'`);
        if (waits[0]!.waiting > 0) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(blocked, true);
      const { rows: beforeExpiry } = await tx.query<{ live: boolean }>(
        'SELECT expires_at>clock_timestamp() AS live FROM ai_action_proposals WHERE id=$1', [expiring.id]);
      assert.equal(beforeExpiry[0]!.live, true);
      await new Promise(resolve => setTimeout(resolve, 1100));
    });
    await expiryRejection!;
  } finally { await watcher.end(); }
  const unchanged = await getEvent(second, 'pg-ai-host', expiringDraft.id);
  assert.equal(unchanged.version, expiringDraft.version);
  assert.equal(unchanged.payload.title, '到期草稿');
  const { rows: expiredRows } = await second.query<{ status: string; action_id: string | null }>(
    'SELECT status,action_id FROM ai_action_proposals WHERE id=$1', [expiring.id]);
  assert.deepEqual(expiredRows, [{ status: 'APPROVED', action_id: null }]);
  process.stdout.write(JSON.stringify({ database: databaseName, migrations: 45, pools: 2,
    committed: committed.length, rejected: rejected.length, resourceVersion: receipt.resourceVersion,
    auditRows: rows[0]?.audit_rows, competingProposals: preparedActions.length,
    competingCommitted: competingCommitted.length, competingVersionConflicts: competingRejected.length,
    expiredWhileBlocked: true }) + '\n');
} finally {
  await Promise.all([first?.close(), second?.close()]);
}
