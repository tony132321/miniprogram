import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactAiContactText } from '../src/ai-data-minimization.ts';

test('AI boundary redacts labelled WeChat and QQ contacts but retains activity quantities', () => {
  const text = '微信号：tony132321；vx: tony132321；企鹅号 123456789；QQ：987654321；费用 30 元、6 人；活动编号 123456789';
  const minimized = redactAiContactText(text);
  assert.equal(minimized.includes('tony132321'), false);
  assert.equal(minimized.includes('企鹅号 123456789'), false);
  assert.equal(minimized.includes('QQ：987654321'), false);
  assert.equal(minimized.includes('费用 30 元、6 人'), true);
  assert.equal(minimized.includes('活动编号 123456789'), true);
});
