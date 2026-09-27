import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { validateMiniProgramRelease } from '../src/release-preflight.ts';

const require = createRequire(import.meta.url);
const clientConfig = require('../miniprogram/config.js');
const projectConfig = JSON.parse(readFileSync(new URL('../project.config.json', import.meta.url), 'utf8'));
const privateProjectPath = new URL('../project.private.config.json', import.meta.url);
const privateProjectConfig = existsSync(privateProjectPath)
  ? JSON.parse(readFileSync(privateProjectPath, 'utf8')) : undefined;
const issues = validateMiniProgramRelease(clientConfig, projectConfig, privateProjectConfig);

if (issues.length) {
  console.error('小程序发布配置检查未通过：');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('小程序静态发布配置检查通过；仍需微信后台、实际 HTTPS 网络和真机逐项验收。');
}
