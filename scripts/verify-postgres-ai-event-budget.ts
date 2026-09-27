import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION, type Database } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { listAiEventCosts, runRecordedDraftProvider } from '../src/ai-draft-requests.ts';
import type { DraftProvider } from '../src/ai-provider-boundary.ts';
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
  [first, second] = await Promise.all([createProductionDatabase(url), createProductionDatabase(url)]);
  const { rows: versions } = await first.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations');
  assert.equal(versions[0]?.version, LATEST_SCHEMA_VERSION);
  const draft = await createDraft(first, 'pg-ai-host', {}, 'pg-ai-event-budget');
  let calls = 0;
  const provider: DraftProvider = { estimateUpperBoundFen: () => 10,
    generate: async () => { calls++; return { costFen: 6, fields: { title: '预算验证草稿' } }; } };
  const [left, right] = await Promise.all([
    runRecordedDraftProvider(first, 'pg-ai-host', 'left', '周六晚上打羽毛球', Date.now(), provider, 10, draft.id),
    runRecordedDraftProvider(second, 'pg-ai-host', 'right', '周六晚上打羽毛球', Date.now(), provider, 10, draft.id)
  ]);
  const responses = [left, right] as Array<Record<string, unknown>>;
  assert.equal(responses.filter(result => result.aiStatus === 'GENERATED').length, 1);
  assert.equal(responses.filter(result => result.fallbackReason === 'BUDGET').length, 1);
  assert.equal(calls, 1);
  const costs = await listAiEventCosts(second);
  assert.deepEqual(costs.items, [{ event_id: draft.id, request_count: 2,
    known_cost_fen: 6, uncertain_reserved_fen: 0, uncertain_count: 0 }]);
  process.stdout.write(JSON.stringify({ schemaVersion: LATEST_SCHEMA_VERSION, eventId: draft.id,
    providerCalls: calls, eventCosts: costs.items[0] }) + '\n');
} finally {
  await Promise.all([first?.close(), second?.close()]);
}
