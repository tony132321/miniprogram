import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type { Database, Queryable } from '../src/db.ts';
import { startPrivacyQuarantineMaintenance } from '../src/privacy-maintenance.ts';

test('configured quarantine expiry runs periodically with one in-flight sweep and can stop', async () => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let sweeps = 0;
  let errors = 0;
  const db = { transaction: async (run: (tx: Queryable) => Promise<unknown>) => run({
    query: async () => { sweeps++; if (sweeps === 1) await held; return { rows: [] }; }
  }) } as Database;
  const stop = startPrivacyQuarantineMaintenance(db, () => { errors++; }, 5);
  try {
    await delay(35);
    assert.equal(sweeps, 1);
    release();
    await delay(25);
    assert.ok(sweeps >= 2);
    assert.equal(errors, 0);
    stop();
    const afterStop = sweeps;
    await delay(20);
    assert.equal(sweeps, afterStop);
  } finally { release(); stop(); }
});
