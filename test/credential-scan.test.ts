import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const scanner = fileURLToPath(new URL('../scripts/scan-credentials.ts', import.meta.url));

function withRepository(files: Record<string, string>, run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'irl-credential-scan-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    for (const [path, content] of Object.entries(files)) {
      writeFileSync(join(root, path), content);
      execFileSync('git', ['-C', root, 'add', '--', path]);
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function scan(root: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', scanner, '--root', root], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8'
  });
}

test('a tracked credential fails the gate with location and category, never the value', () => {
  const fakeAwsKey = 'AKIA' + 'ABCDEFGHIJKLMNOP';
  const fakeGoogleKey = 'AQ.' + 'Ab1_'.repeat(10);
  withRepository({ '.env.example': `AWS_ACCESS_KEY_ID=${fakeAwsKey}\n`,
    'README.md': `X-Goog-Api-Key: ${fakeGoogleKey}\n` }, root => {
    const result = scan(root);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /\.env\.example:1 AWS_ACCESS_KEY/);
    assert.match(result.stdout, /README\.md:1 GOOGLE_API_KEY/);
    assert.equal((result.stdout + result.stderr).includes(fakeAwsKey), false);
    assert.equal((result.stdout + result.stderr).includes(fakeGoogleKey), false);
  });
});

test('tracked placeholders pass while untracked local inputs remain outside the scan', () => {
  const fakeGithubToken = 'github_pat_' + 'X'.repeat(48);
  withRepository({ '.env.example': 'WECHAT_APP_SECRET=replace-me\nOPENAI_API_KEY=sk-test-placeholder\n',
    'test-fixture.ts': "const checkInSecret = 'test-secret';\n" }, root => {
    writeFileSync(join(root, 'Project_IRL_Autonomous_Engineering_Package_v3.1.zip'), fakeGithubToken);
    writeFileSync(join(root, 'project.private.config.json'), fakeGithubToken);
    const result = scan(root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Credential scan passed/);
    assert.equal((result.stdout + result.stderr).includes(fakeGithubToken), false);
  });
});

test('a forcibly tracked private config cannot bypass the scan', () => {
  const fakeGithubToken = 'github_pat_' + 'X'.repeat(48);
  withRepository({ 'project.private.config.json': fakeGithubToken }, root => {
    const result = scan(root);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /project\.private\.config\.json:1 GITHUB_TOKEN/);
    assert.equal((result.stdout + result.stderr).includes(fakeGithubToken), false);
  });
});

test('a tracked ZIP is scanned for credentials inside its text entries', () => {
  const fakeAwsKey = 'AKIA' + 'ABCDEFGHIJKLMNOP';
  withRepository({ 'README.md': 'Synthetic archive fixture only\n' }, root => {
    writeFileSync(join(root, 'inside.txt'), `AWS_ACCESS_KEY_ID=${fakeAwsKey}\n`);
    execFileSync('zip', ['-q', 'fixture.zip', 'inside.txt'], { cwd: root });
    execFileSync('git', ['-C', root, 'add', '--', 'fixture.zip']);
    const result = scan(root);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /fixture\.zip!inside\.txt:1 AWS_ACCESS_KEY/);
    assert.equal((result.stdout + result.stderr).includes(fakeAwsKey), false);
  });
});

test('a literal WeChat AppSecret in tracked configuration is rejected', () => {
  const fakeAppSecret = '8d2c' + 'a71e'.repeat(7);
  withRepository({ 'config.js': `module.exports = { wechatAppSecret: '${fakeAppSecret}' };\n` }, root => {
    const result = scan(root);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /config\.js:1 WECHAT_APP_SECRET/);
    assert.equal(result.stdout.includes(fakeAppSecret), false);
  });
});

test('a high-entropy generic client secret is detected without flagging documented placeholders', () => {
  const fakeSecret = ['zQ1l', 'cH8v', 'pK5m', 'nR2a', 'wD7s', 'xF9t', 'yG3u', 'bJ4e'].join('');
  withRepository({ 'config.json': `{ "clientSecret": "${fakeSecret}" }\n`,
    'README.md': 'PASSWORD=YOUR_PASSWORD_PLACEHOLDER\n' }, root => {
    const result = scan(root);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /config\.json:1 HIGH_ENTROPY_CREDENTIAL/);
    assert.equal((result.stdout + result.stderr).includes(fakeSecret), false);
    assert.equal(result.stdout.includes('README.md'), false);
  });
});
