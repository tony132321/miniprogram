/** Structural candidate gate. Evidence provenance still needs independent tool readback. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export type CandidateSnapshot = {
  headSha: string;
  treeSha: string;
  changedTracked: string[];
  untrackedProduct: string[];
  workflowJobs: string[];
};
export type GateIssue = { code: string; message: string };

const productRoots = ['src/', 'miniprogram/', 'operations/', 'scripts/', 'test/', '.github/'];
const productFiles = new Set(['package.json', 'pnpm-lock.yaml', 'project.config.json', '.env.example']);
const shaPattern = /^[a-f0-9]{40}$/;
const digestPattern = /^[a-f0-9]{64}$/;

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function lines(value: string): string[] {
  return value ? value.split(/\r?\n/).filter(Boolean).sort() : [];
}

function isProductPath(path: string): boolean {
  return productFiles.has(path) || productRoots.some(root => path.startsWith(root));
}

function workflowJobNames(source: string): string[] {
  const start = source.match(/^jobs:\s*$/m);
  if (!start || start.index === undefined) return [];
  const body = source.slice(start.index + start[0].length);
  const end = body.search(/^[^\s#][^\n]*:/m);
  const section = end < 0 ? body : body.slice(0, end);
  return [...section.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)].map(match => match[1]!).sort();
}

/** The Git tree binds every tracked file; dirty product inputs cannot borrow that identity. */
export function readCandidateSnapshot(root: string): CandidateSnapshot {
  const workflow = readFileSync(resolve(root, '.github/workflows/r1-ci.yml'), 'utf8');
  return {
    headSha: git(root, 'rev-parse', 'HEAD'),
    treeSha: git(root, 'rev-parse', 'HEAD^{tree}'),
    changedTracked: lines(git(root, 'diff', '--name-only', 'HEAD', '--')),
    untrackedProduct: lines(git(root, 'ls-files', '--others', '--exclude-standard'))
      .filter(isProductPath),
    workflowJobs: workflowJobNames(workflow)
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function string(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
    ? value.map(item => item.trim()) : [];
}

function validTime(value: unknown): number | null {
  const text = string(value);
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function validProof(value: unknown, sha: string, frozenAt: number, issues: GateIssue[], code: string): void {
  const proof = object(value);
  if (!proof || proof.status !== 'PASS' || !string(proof.artifactRef) ||
      !digestPattern.test(string(proof.artifactSha256)) || proof.synthetic !== false ||
      validTime(proof.observedAt) === null) {
    issues.push({ code: `${code}_MISSING`, message: `${code} lacks a valid non-synthetic receipt` });
    return;
  }
  if (string(proof.candidateSha) !== sha || validTime(proof.observedAt)! < frozenAt)
    issues.push({ code: `STALE_${code}_SHA`, message: `${code} is not bound to this frozen candidate` });
  if (validTime(proof.observedAt)! > Date.now() + 5 * 60_000)
    issues.push({ code: `${code}_MISSING`, message: `${code} receipt is future-dated` });
}

/** Verify the local evidence bytes; this does not authenticate who produced them. */
export function checkCandidateArtifacts(receiptValue: unknown, root: string): GateIssue[] {
  const receipt = object(receiptValue);
  if (!receipt) return [{ code: 'RECEIPT_MISSING', message: 'Candidate gate receipt is missing' }];
  const evidenceRoot = resolve(root, 'docs/evidence');
  const realEvidenceRoot = existsSync(evidenceRoot) ? realpathSync(evidenceRoot) : evidenceRoot;
  const issues: GateIssue[] = [];
  for (const key of ['independentReview', 'devtools', 'realDevice', 'webOps', 'authoritativeReadback']) {
    const proof = object(receipt[key]);
    const ref = string(proof?.artifactRef);
    const expected = string(proof?.artifactSha256);
    const path = resolve(root, ref);
    try {
      if (!ref.startsWith('docs/evidence/') || !path.startsWith(evidenceRoot + sep) ||
          !digestPattern.test(expected) || !statSync(path).isFile() ||
          (relative(realEvidenceRoot, realpathSync(path)).startsWith('..'))) throw new Error('unsafe or missing evidence');
      const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
      if (actual !== expected) throw new Error('evidence bytes changed');
    } catch {
      issues.push({ code: 'ARTIFACT_MISMATCH', message: `${key} evidence is missing, unsafe or changed` });
    }
  }
  return issues;
}

/** Mirrors the v3.1 gate receipt shape, without promoting a structural PASS to UAT approval. */
export function checkCandidateGate(receiptValue: unknown, snapshot: CandidateSnapshot): GateIssue[] {
  const issues: GateIssue[] = [];
  const add = (code: string, message: string) => issues.push({ code, message });
  const receipt = object(receiptValue);
  if (!receipt || receipt.schema !== 'project-irl/candidate-gate-v1') {
    add('RECEIPT_MISSING', 'Candidate gate receipt is missing or has an unknown schema');
    return issues;
  }
  const candidate = object(receipt.candidate);
  const gitSha = string(candidate?.gitSha);
  const treeSha = string(candidate?.treeSha);
  const frozenAt = validTime(candidate?.frozenAt);
  const authorIds = stringArray(candidate?.authorIds);
  const authorSessionIds = stringArray(candidate?.authorSessionIds);
  if (!shaPattern.test(gitSha) || !shaPattern.test(treeSha) || frozenAt === null ||
      (frozenAt !== null && frozenAt > Date.now() + 5 * 60_000) ||
      authorIds.length === 0 || authorIds.some(id => !id) || authorSessionIds.length === 0 ||
      authorSessionIds.some(id => !id)) {
    add('CANDIDATE_NOT_FROZEN', 'A Git SHA, tree SHA, freeze time and named authors and sessions are required');
  }
  if (gitSha !== snapshot.headSha) add('CANDIDATE_SHA_MISMATCH', 'Receipt Git SHA differs from local HEAD');
  if (treeSha !== snapshot.treeSha) add('CANDIDATE_TREE_MISMATCH', 'Receipt tree SHA differs from local HEAD tree');
  if (snapshot.changedTracked.length || snapshot.untrackedProduct.length)
    add('WORKTREE_DRIFT', 'Tracked files or untracked product inputs changed after the candidate SHA');
  if (!shaPattern.test(snapshot.headSha) || !shaPattern.test(snapshot.treeSha))
    add('CANDIDATE_NOT_FROZEN', 'The repository does not have a valid committed HEAD and tree');

  const ci = object(receipt.requiredCi);
  const required = stringArray(ci?.requiredCheckNames);
  const workflow = snapshot.workflowJobs;
  const sourceTime = validTime(ci?.sourceObservedAt);
  if (!ci || ci.sourceStatus !== 'VERIFIED' || !string(ci.sourceRef) || sourceTime === null ||
      !string(ci.runUrl).startsWith('https://') || !workflow.length || !required.length ||
      new Set(required).size !== required.length || workflow.some(name => !required.includes(name)) ||
      (frozenAt !== null && sourceTime < frozenAt) ||
      (sourceTime !== null && sourceTime > Date.now() + 5 * 60_000)) {
    add('REQUIRED_CI_UNKNOWN', 'Required checks must be independently bound and cover every workflow job');
  }
  if (string(ci?.remoteHeadSha) !== gitSha)
    add('STALE_CI_SHA', 'Remote CI head is not the frozen candidate SHA');
  const jobs = Array.isArray(ci?.jobs) ? ci.jobs.map(object) : [];
  for (const name of required) {
    const matches = jobs.filter(job => job?.name === name);
    if (matches.length !== 1) {
      add('REQUIRED_CI_MISSING', `Required CI job ${name} is missing or duplicated`);
      continue;
    }
    const job = matches[0]!;
    if (string(job.candidateSha) !== gitSha)
      add('STALE_CI_SHA', `CI job ${name} belongs to another candidate`);
    if (job.status !== 'PASS') add('REQUIRED_CI_FAILED', `CI job ${name} did not pass`);
  }

  const review = object(receipt.independentReview);
  validProof(review, gitSha, frozenAt ?? Number.POSITIVE_INFINITY, issues, 'REVIEW');
  if (review && (!string(review.reviewerId) || !string(review.reviewerSessionId) ||
      authorIds.includes(string(review.reviewerId)) || authorSessionIds.includes(string(review.reviewerSessionId)) ||
      review.readOnly !== true || review.candidateUnchanged !== true))
    add('REVIEW_NOT_INDEPENDENT', 'Reviewer identity and session must differ from candidate authors');
  validProof(receipt.devtools, gitSha, frozenAt ?? Number.POSITIVE_INFINITY, issues, 'DEVTOOLS');
  validProof(receipt.realDevice, gitSha, frozenAt ?? Number.POSITIVE_INFINITY, issues, 'REAL_DEVICE');
  const device = object(object(receipt.realDevice)?.device);
  if (!device || ['platform', 'model', 'osVersion', 'appBuild', 'runId'].some(field => !string(device[field])))
    if (!issues.some(issue => issue.code === 'REAL_DEVICE_MISSING'))
      add('REAL_DEVICE_MISSING', 'Real-device evidence needs platform, model, OS, build and run identity');
  validProof(receipt.webOps, gitSha, frozenAt ?? Number.POSITIVE_INFINITY, issues, 'WEB_OPS');
  validProof(receipt.authoritativeReadback, gitSha, frozenAt ?? Number.POSITIVE_INFINITY, issues, 'READBACK');
  return issues;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const root = resolve(dirname(scriptPath), '..');
  const receiptPath = resolve(root, process.argv[2] || 'docs/evidence/candidate-gate-receipt.json');
  try {
    const value = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : null;
    const issues = checkCandidateGate(value, readCandidateSnapshot(root))
      .concat(value ? checkCandidateArtifacts(value, root) : []);
    const status = issues.length ? 'BLOCKED' : 'EVIDENCE_CONTRACT_SATISFIED';
    console.log(JSON.stringify({ gate: 'nick_uat', status,
      limits: 'Structural consistency only. Independently verify CI, device, actor and readback provenance; no UAT approval or release authorization.',
      issues }, null, 2));
    if (issues.length) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ gate: 'nick_uat', status: 'BLOCKED',
      issues: [{ code: 'GATE_INPUT_ERROR', message: error instanceof Error ? error.message : 'Gate input error' }] }, null, 2));
    process.exitCode = 1;
  }
}
