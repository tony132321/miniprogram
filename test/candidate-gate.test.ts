import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkCandidateArtifacts, checkCandidateGate, readCandidateSnapshot } from '../scripts/check-candidate-gate.ts';

const sha = 'a'.repeat(40);
const tree = 'b'.repeat(40);
const frozenAt = '2026-09-27T10:00:00.000Z';
const observedAt = '2026-09-27T10:01:00.000Z';

function snapshot() {
  return { headSha: sha, treeSha: tree, changedTracked: [] as string[], untrackedProduct: [] as string[],
    workflowJobs: ['checks', 'postgres-privacy-expiry'] };
}

function receipt() {
  const proof = (kind: string) => ({ status: 'PASS', candidateSha: sha, observedAt,
    artifactRef: `docs/evidence/${kind}.json`, artifactSha256: 'd'.repeat(64), synthetic: false });
  return {
    schema: 'project-irl/candidate-gate-v1',
    candidate: { gitSha: sha, treeSha: tree, frozenAt, authorIds: ['author-1'],
      authorSessionIds: ['author-session-1'] },
    requiredCi: { sourceStatus: 'VERIFIED', sourceRef: 'github://branch-protection/main',
      sourceObservedAt: observedAt, remoteHeadSha: sha, runUrl: 'https://github.com/example/repo/actions/runs/1',
      requiredCheckNames: ['checks', 'postgres-privacy-expiry'], jobs: [
        { name: 'checks', candidateSha: sha, status: 'PASS' },
        { name: 'postgres-privacy-expiry', candidateSha: sha, status: 'PASS' }
      ] },
    independentReview: { ...proof('review'), reviewerId: 'reviewer-2', reviewerSessionId: 'session-2',
      readOnly: true, candidateUnchanged: true },
    devtools: proof('devtools'), realDevice: { ...proof('device'),
      device: { platform: 'wechat', model: 'fixture-phone', osVersion: 'fixture-os',
        appBuild: 'fixture-build', runId: 'fixture-run' } }, webOps: proof('ops'),
    authoritativeReadback: proof('readback')
  };
}

function codes(value: ReturnType<typeof receipt> | null, state = snapshot()) {
  return checkCandidateGate(value, state).map(issue => issue.code);
}

test('a frozen candidate with complete same-SHA evidence satisfies only the structural contract', () => {
  assert.deepEqual(codes(receipt()), []);
});

test('an unfrozen or drifting candidate cannot reuse a clean HEAD', () => {
  const unfrozen = receipt();
  unfrozen.candidate.frozenAt = '';
  assert.ok(codes(unfrozen).includes('CANDIDATE_NOT_FROZEN'));
  assert.ok(codes(receipt(), { ...snapshot(), changedTracked: ['src/server.ts'] }).includes('WORKTREE_DRIFT'));
  assert.ok(codes(receipt(), { ...snapshot(), untrackedProduct: ['miniprogram/pages/new.js'] }).includes('WORKTREE_DRIFT'));
  const future = receipt();
  future.candidate.frozenAt = '2099-01-01T00:00:00.000Z';
  assert.ok(codes(future).includes('CANDIDATE_NOT_FROZEN'));
});

test('unknown or incomplete required CI is blocked even when two jobs report success', () => {
  const unknown = receipt();
  unknown.requiredCi.sourceStatus = 'UNKNOWN';
  assert.ok(codes(unknown).includes('REQUIRED_CI_UNKNOWN'));
  const missing = receipt();
  missing.requiredCi.jobs.pop();
  assert.ok(codes(missing).includes('REQUIRED_CI_MISSING'));
  const omittedFromBinding = receipt();
  omittedFromBinding.requiredCi.requiredCheckNames.pop();
  assert.ok(codes(omittedFromBinding).includes('REQUIRED_CI_UNKNOWN'));
});

test('an old CI run or review cannot be transferred to a new candidate', () => {
  const stale = receipt();
  stale.requiredCi.jobs[0]!.candidateSha = 'c'.repeat(40);
  stale.independentReview.candidateSha = 'c'.repeat(40);
  assert.ok(codes(stale).includes('STALE_CI_SHA'));
  assert.ok(codes(stale).includes('STALE_REVIEW_SHA'));
});

test('a missing device receipt and an author self-review fail closed', () => {
  const missing = receipt();
  (missing as { realDevice: unknown }).realDevice = null;
  assert.ok(codes(missing).includes('REAL_DEVICE_MISSING'));
  const selfReview = receipt();
  selfReview.independentReview.reviewerId = 'author-1';
  assert.ok(codes(selfReview).includes('REVIEW_NOT_INDEPENDENT'));
  const sameSession = receipt();
  sameSession.independentReview.reviewerSessionId = 'author-session-1';
  assert.ok(codes(sameSession).includes('REVIEW_NOT_INDEPENDENT'));
  const noDeviceIdentity = receipt();
  noDeviceIdentity.realDevice.device.runId = '';
  assert.ok(codes(noDeviceIdentity).includes('REAL_DEVICE_MISSING'));
});

test('Git snapshot observes actual tracked drift and untracked product files', () => {
  const root = mkdtempSync(join(tmpdir(), 'irl-candidate-gate-'));
  try {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.test',
        GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.test' } }).trim();
    git('init', '-q');
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, '.github/workflows/r1-ci.yml'), 'jobs:\n  checks:\n    runs-on: ubuntu-latest\n  postgres-privacy-expiry:\n    runs-on: ubuntu-latest\n');
    writeFileSync(join(root, 'src/app.ts'), 'export const ready = true;\n');
    git('add', '.'); git('commit', '-qm', 'fixture');
    assert.deepEqual(readCandidateSnapshot(root).workflowJobs, ['checks', 'postgres-privacy-expiry']);
    assert.deepEqual(readCandidateSnapshot(root).changedTracked, []);
    writeFileSync(join(root, 'src/app.ts'), 'export const ready = false;\n');
    writeFileSync(join(root, 'src/new.ts'), 'export const newFile = true;\n');
    const state = readCandidateSnapshot(root);
    assert.deepEqual(state.changedTracked, ['src/app.ts']);
    assert.deepEqual(state.untrackedProduct, ['src/new.ts']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a receipt cannot pass after its referenced evidence file changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'irl-gate-artifact-'));
  try {
    mkdirSync(join(root, 'docs/evidence'), { recursive: true });
    const value = receipt();
    for (const kind of ['review', 'devtools', 'device', 'ops', 'readback']) {
      const path = join(root, 'docs/evidence', `${kind}.json`);
      writeFileSync(path, `${kind} proof`);
      const digest = createHash('sha256').update(`${kind} proof`).digest('hex');
      const proof = kind === 'review' ? value.independentReview : kind === 'devtools' ? value.devtools :
        kind === 'device' ? value.realDevice : kind === 'ops' ? value.webOps : value.authoritativeReadback;
      proof.artifactSha256 = digest;
    }
    assert.deepEqual(checkCandidateArtifacts(value, root), []);
    writeFileSync(join(root, 'docs/evidence/device.json'), 'changed evidence');
    assert.ok(checkCandidateArtifacts(value, root).some(issue => issue.code === 'ARTIFACT_MISMATCH'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
