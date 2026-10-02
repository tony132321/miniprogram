import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Finding = { path: string; line: number; kind: string };

const tokenPatterns = [
  { kind: 'PRIVATE_KEY', pattern: /-----BEGIN (?:OPENSSH |RSA |EC |DSA |PGP )?PRIVATE KEY-----/g },
  { kind: 'AWS_ACCESS_KEY', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { kind: 'GITHUB_TOKEN', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,})\b/g },
  { kind: 'OPENAI_API_KEY', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g },
  { kind: 'GOOGLE_API_KEY', pattern: /\b(?:AIza[0-9A-Za-z_-]{35}|AQ\.[A-Za-z0-9_-]{35,})\b/g },
  { kind: 'SLACK_TOKEN', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g }
] as const;

const wechatSecretAssignment = /\b(?:wechat[_-]?app[_-]?secret|app[_-]?secret|wechatAppSecret|appSecret)\s*[:=]\s*['"]?([a-f0-9]{32})(?=['"\s,;}])/gi;
const genericCredentialAssignment = /\b(?:api[_-]?key|app[_-]?secret|client[_-]?secret|access[_-]?token|password)\b['"]?\s*[:=]\s*['"]?([A-Za-z0-9+/_=-]{24,})(?=['"\s,;}])/gi;

function isPlaceholder(value: string): boolean {
  return /^(.)\1+$/.test(value) || /(?:test|demo|example|dummy|placeholder|replace|changeme|your[_-])/i.test(value);
}

function scanLine(path: string, line: string, lineNumber: number): Finding[] {
  const kinds = new Set<string>();
  for (const { kind, pattern } of tokenPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(line)) kinds.add(kind);
  }
  wechatSecretAssignment.lastIndex = 0;
  for (const match of line.matchAll(wechatSecretAssignment)) {
    if (match[1] && !isPlaceholder(match[1])) kinds.add('WECHAT_APP_SECRET');
  }
  genericCredentialAssignment.lastIndex = 0;
  for (const match of line.matchAll(genericCredentialAssignment)) {
    if (match[1] && !isPlaceholder(match[1]) && new Set(match[1]).size >= 10)
      kinds.add('HIGH_ENTROPY_CREDENTIAL');
  }
  return [...kinds].map(kind => ({ path, line: lineNumber, kind }));
}

function scanZipArchive(fullPath: string, path: string, decoder: TextDecoder): Finding[] {
  // A supplied archive is tracked in this repository. Inspect its text entries
  // too; a binary ZIP wrapper must not hide a credential committed inside it.
  let listing: string;
  try { listing = execFileSync('unzip', ['-Z1', fullPath], { encoding: 'utf8', maxBuffer: 1024 * 1024 }); }
  catch { throw new Error(`Tracked ZIP could not be inspected: ${path}`); }
  const entries = listing.split('\n').filter(Boolean);
  if (entries.length > 1000) throw new Error(`Archive has too many entries to scan: ${path}`);
  const findings: Finding[] = [];
  let scannedBytes = 0;
  for (const entry of entries) {
    if (entry.endsWith('/')) continue;
    if (entry.includes('\r')) throw new Error(`Archive entry name cannot be scanned safely: ${path}`);
    let bytes: Buffer;
    try { bytes = execFileSync('unzip', ['-p', fullPath, entry], { maxBuffer: 4 * 1024 * 1024 }); }
    catch { throw new Error(`Tracked ZIP entry could not be inspected: ${path}`); }
    scannedBytes += bytes.byteLength;
    if (scannedBytes > 32 * 1024 * 1024) throw new Error(`Archive exceeds credential scan limit: ${path}`);
    if (bytes.includes(0)) continue;
    let content: string;
    try { content = decoder.decode(bytes); }
    catch { continue; }
    content.split(/\r?\n/).forEach((line, index) => findings.push(...scanLine(`${path}!${entry}`, line, index + 1)));
  }
  return findings;
}

export function scanTrackedRepository(root: string): {
  files: number; archives: number; skippedBinary: number; findings: Finding[] } {
  const paths = execFileSync('git', ['-C', root, 'ls-files', '-z', '--cached'], { encoding: 'utf8' })
    .split('\0').filter(Boolean).sort();
  const findings: Finding[] = [];
  let files = 0;
  let archives = 0;
  let skippedBinary = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (const path of paths) {
    const fullPath = resolve(root, path);
    const stat = lstatSync(fullPath);
    if (stat.isSymbolicLink()) throw new Error(`Tracked symbolic link requires review: ${path}`);
    if (!stat.isFile()) continue;
    if (path.toLowerCase().endsWith('.zip')) {
      findings.push(...scanZipArchive(fullPath, path, decoder));
      archives++;
      continue;
    }
    const bytes = readFileSync(fullPath);
    if (bytes.includes(0)) { skippedBinary++; continue; }
    let content: string;
    try { content = decoder.decode(bytes); }
    catch { skippedBinary++; continue; }
    files++;
    content.split(/\r?\n/).forEach((line, index) => findings.push(...scanLine(path, line, index + 1)));
  }
  return { files, archives, skippedBinary, findings };
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--root' || !args[1]))
    throw new Error('Usage: scan-credentials.ts [--root REPOSITORY]');
  const root = resolve(args[1] ?? '.');
  const result = scanTrackedRepository(root);
  if (result.findings.length) {
    for (const finding of result.findings)
      process.stdout.write(`${finding.path}:${finding.line} ${finding.kind}\n`);
    process.stdout.write(`Credential scan failed: ${result.findings.length} finding(s). Values withheld.\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Credential scan passed: ${result.files} tracked text files, ` +
      `${result.archives} ZIP archives inspected, ${result.skippedBinary} binary files skipped.\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
