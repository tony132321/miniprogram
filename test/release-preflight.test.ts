import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateMiniProgramRelease } from '../src/release-preflight.ts';

test('release preflight rejects every current local mini-program setting', () => {
  const issues = validateMiniProgramRelease(
    { apiBase: 'http://127.0.0.1:3000', developmentUser: 'host' },
    { appid: 'wxbbcab69099026d3f', setting: { urlCheck: false } });
  assert.equal(issues.length, 4);
  assert.ok(issues.some(issue => /HTTPS/.test(issue)));
  assert.ok(issues.some(issue => /开发身份/.test(issue)));
  assert.ok(issues.some(issue => /AppID/.test(issue)));
  assert.ok(issues.some(issue => /域名校验/.test(issue)));
  assert.ok(issues.every(issue => !issue.includes('host')));
});

test('release preflight accepts only a plausible production configuration', () => {
  assert.deepEqual(validateMiniProgramRelease(
    { apiBase: 'https://api.example.cn', developmentUser: '' },
    { appid: 'wx1234567890abcdef', setting: { urlCheck: true } }), []);
  const issues = validateMiniProgramRelease(
    { apiBase: 'https://localhost:3000', developmentUser: '' },
    { appid: 'wx1234567890abcdef', setting: { urlCheck: true } });
  assert.equal(issues.length, 1);
  assert.match(issues[0]!, /HTTPS/);
});

test('release preflight catches a local private project override disabling domain checks', () => {
  const issues = validateMiniProgramRelease(
    { apiBase: 'https://api.example.cn', developmentUser: '' },
    { appid: 'wx1234567890abcdef', setting: { urlCheck: true } },
    { setting: { urlCheck: false } });
  assert.equal(issues.length, 1);
  assert.match(issues[0]!, /本机.*域名校验/);
});
