import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePostgresTestUrl, assertEmptyPostgresTestDatabase } from '../scripts/verify-postgres-guard.ts';

test('PostgreSQL verification URL rejects connection-string query overrides', () => {
  assert.equal(validatePostgresTestUrl('postgresql://tsb@127.0.0.1:55432/irl_r1_test_safe'), 'irl_r1_test_safe');
  for (const url of [
    'postgresql://tsb@127.0.0.1:55432/irl_r1_test_safe?host=remote.example',
    'postgresql://tsb@127.0.0.1:55432/irl_r1_test_safe?options=-csearch_path%3Dapp',
    'postgresql://tsb@localhost:55432/irl_r1_test_safe',
    'postgresql://tsb@remote.example:55432/irl_r1_test_safe',
    'postgresql://tsb@127.0.0.1:55432/production'
  ]) assert.throws(() => validatePostgresTestUrl(url), /loopback|query|database/i);
});

test('PostgreSQL verification refuses another user schema or a nonpublic search path', async () => {
  const probe = { query: async () => ({ rows: [{ database: 'irl_r1_test_safe', server_address: '127.0.0.1',
    active_schema: 'app', user_relations: 1, extra_schemas: 1 }] }) };
  await assert.rejects(() => assertEmptyPostgresTestDatabase(probe, 'irl_r1_test_safe'), /empty|public/i);
});
