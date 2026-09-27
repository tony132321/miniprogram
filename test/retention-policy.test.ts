import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRetentionPolicy } from '../src/retention-policy.ts';

const active = ['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup'];
const disabled = ['voice_raw', 'photo'];
type TestRecord = { class: string; status: string; approved_days?: number; legal_basis?: string;
  deletion_action?: string; access_roles?: string[] };
const approved = () => ({
  schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
  approved_by: 'synthetic-test-owner', approved_at: '2026-09-27T00:00:00.000Z',
  records: [
    ...active.map(name => ({ class: name, status: 'APPROVED', approved_days: 30,
      legal_basis: 'Synthetic test basis only', deletion_action: 'Synthetic test action', access_roles: ['PRIVACY'] })),
    ...disabled.map(name => ({ class: name, status: 'NOT_ENABLED' }))
  ] as TestRecord[]
});

test('retention gate rejects missing, unapproved, global, and incomplete policies', () => {
  assert.throws(() => validateRetentionPolicy(undefined), /RETENTION_POLICY_JSON/);
  assert.throws(() => validateRetentionPolicy(JSON.stringify({ status: 'OWNER_REVIEW_REQUIRED_BEFORE_REAL_DATA' })), /RETENTION_POLICY_JSON/);
  const global = approved();
  global.records = [{ class: 'all', status: 'APPROVED', approved_days: 7,
    legal_basis: 'Synthetic test basis only', deletion_action: 'Synthetic test action', access_roles: ['PRIVACY'] }];
  assert.throws(() => validateRetentionPolicy(JSON.stringify(global)), /retention class/i);
  const missingBasis = approved();
  missingBasis.records[0]!.legal_basis = 'TO_BE_DETERMINED_BY_OWNER';
  assert.throws(() => validateRetentionPolicy(JSON.stringify(missingBasis)), /legal basis/i);
  const missingPeriod = approved();
  missingPeriod.records[0]!.approved_days = 0;
  assert.throws(() => validateRetentionPolicy(JSON.stringify(missingPeriod)), /retention period/i);
});

test('retention gate accepts a complete synthetic fixture without claiming owner approval', () => {
  assert.doesNotThrow(() => validateRetentionPolicy(JSON.stringify(approved())));
  const duplicate = approved();
  duplicate.records[1]!.class = duplicate.records[0]!.class;
  assert.throws(() => validateRetentionPolicy(JSON.stringify(duplicate)), /retention class/i);
});
