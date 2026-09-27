import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function startWith(env: Record<string, string>) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 10_000,
    env: { PATH: process.env.PATH ?? '', NODE_ENV: 'production', CHECKIN_SECRET: 'local-test-checkin-secret', ...env }
  });
}

const operator = { username: 'moderator', passwordHash: `scrypt$${'a'.repeat(64)}$${'b'.repeat(128)}`,
  totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', permissions: ['REPORTS', 'CONTENT', 'APPEALS'] };

const syntheticRetentionPolicy = JSON.stringify({
  schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
  approved_by: 'synthetic-test-owner', approved_at: '2026-09-27T00:00:00.000Z',
  records: [...['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup'].map(name =>
    ({ class: name, status: 'APPROVED', approved_days: 30, legal_basis: 'Synthetic test basis only',
      deletion_action: 'Synthetic test action', access_roles: ['PRIVACY'] })),
    ...['voice_raw', 'photo'].map(name => ({ class: name, status: 'NOT_ENABLED' }))]
});

test('production startup rejects missing WeChat login credentials before database connection', () => {
  const result = startWith({});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /WECHAT_APP_ID.*WECHAT_APP_SECRET/);
});

test('production rejects development identity without printing configured secrets', () => {
  const sentinel = 'sensitive-secret-must-not-appear';
  const result = startWith({ DEV_AUTH: '1', WECHAT_APP_ID: 'test-appid', WECHAT_APP_SECRET: sentinel });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DEV_AUTH is forbidden/);
  assert.doesNotMatch(result.stdout + result.stderr, /sensitive-secret-must-not-appear/);
});

test('candidate uses production safety gates and production cannot claim a test stage', () => {
  const candidate = startWith({ APP_STAGE: 'candidate', DEV_AUTH: '1' });
  assert.equal(candidate.status, 1);
  assert.match(candidate.stderr, /DEV_AUTH is forbidden/);
  const disguisedTest = startWith({ APP_STAGE: 'test', DEV_AUTH: '1' });
  assert.equal(disguisedTest.status, 1);
  assert.match(disguisedTest.stderr, /APP_STAGE.*NODE_ENV/);
});

test('production startup rejects blank WeChat login credentials', () => {
  const result = startWith({ WECHAT_APP_ID: ' ', WECHAT_APP_SECRET: '\t' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /WECHAT_APP_ID.*WECHAT_APP_SECRET/);
});

test('production startup rejects missing independently assigned operator accounts before database connection', () => {
  const result = startWith({ WECHAT_APP_ID: 'test-appid', WECHAT_APP_SECRET: 'test-secret' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /OPS_ACCOUNTS_JSON/);
});

test('production startup requires a separate appeals reviewer', () => {
  const result = startWith({ WECHAT_APP_ID: 'test-appid', WECHAT_APP_SECRET: 'test-secret',
    OPS_ACCOUNTS_JSON: JSON.stringify([operator]) });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /independent.*APPEALS/);
});

test('production startup rejects appeals access only on the original moderator account', () => {
  const result = startWith({ WECHAT_APP_ID: 'test-appid', WECHAT_APP_SECRET: 'test-secret',
    OPS_ACCOUNTS_JSON: JSON.stringify([operator, { ...operator, username: 'second',
      totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', permissions: ['METRICS'] }]) });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /independent.*APPEALS/);
});

test('production startup accepts separately assigned review roles before checking database configuration', () => {
  const result = startWith({ WECHAT_APP_ID: 'test-appid', WECHAT_APP_SECRET: 'test-secret',
    RETENTION_POLICY_JSON: syntheticRetentionPolicy,
    OPS_ACCOUNTS_JSON: JSON.stringify([{ ...operator, permissions: [...operator.permissions, 'JOBS'] }, { ...operator, username: 'reviewer',
      totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', permissions: ['APPEALS'] }, { ...operator, username: 'safetydispatcher',
      totpSecret: 'KRSXG5AUKRSXG5AUKRSXG5AUKRSXG5AU', permissions: ['SAFETY'] }]) });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DATABASE_URL is required/);
});

test('production startup requires a safety dispatcher independent of the report assignee', () => {
  const shared = { ...operator, permissions: [...operator.permissions, 'JOBS', 'SAFETY'] };
  const appealReviewer = { ...operator, username: 'appealreviewer',
    totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', permissions: ['APPEALS'] };
  const result = startWith({ WECHAT_APP_ID: 'test-appid', WECHAT_APP_SECRET: 'test-secret',
    RETENTION_POLICY_JSON: syntheticRetentionPolicy,
    OPS_ACCOUNTS_JSON: JSON.stringify([shared, appealReviewer]) });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SAFETY.*REPORTS.*independent|independent.*SAFETY.*REPORTS/);
  assert.doesNotMatch(result.stderr, /DATABASE_URL is required/);
});

test('production refuses real data startup without owner-approved purpose retention policy', () => {
  const accounts = JSON.stringify([{ ...operator, permissions: [...operator.permissions, 'JOBS'] }, { ...operator,
    username: 'reviewer', totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', permissions: ['APPEALS'] }]);
  const missing = startWith({ WECHAT_APP_ID: 'test-appid', WECHAT_APP_SECRET: 'test-secret', OPS_ACCOUNTS_JSON: accounts });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /RETENTION_POLICY_JSON/);
  const proposal = startWith({ WECHAT_APP_ID: 'test-appid', WECHAT_APP_SECRET: 'test-secret', OPS_ACCOUNTS_JSON: accounts,
    RETENTION_POLICY_JSON: JSON.stringify({ schema: 'project-irl/retention-proposal-v1', status: 'OWNER_REVIEW_REQUIRED_BEFORE_REAL_DATA' }) });
  assert.equal(proposal.status, 1);
  assert.match(proposal.stderr, /RETENTION_POLICY_JSON/);
  const candidate = startWith({ APP_STAGE: 'candidate', WECHAT_APP_ID: 'test-appid', WECHAT_APP_SECRET: 'test-secret',
    OPS_ACCOUNTS_JSON: accounts });
  assert.equal(candidate.status, 1);
  assert.match(candidate.stderr, /RETENTION_POLICY_JSON/);
});

test('production startup requires a named failed-job operator', () => {
  const result = startWith({ WECHAT_APP_ID: 'test-appid', WECHAT_APP_SECRET: 'test-secret',
    OPS_ACCOUNTS_JSON: JSON.stringify([operator, { ...operator, username: 'reviewer',
      totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', permissions: ['APPEALS'] }]) });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /JOBS/);
});
