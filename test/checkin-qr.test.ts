import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCheckInMatrix, drawCheckInQr } = require('../miniprogram/subpackages/activity/utils/checkin-qr.js');

test('check-in token becomes a square scannable matrix with a quiet zone', () => {
  const token = '12345678.' + 'a'.repeat(43);
  const matrix = createCheckInMatrix(token);
  assert.ok(matrix.length >= 21);
  assert.ok(matrix.every((row: boolean[]) => row.length === matrix.length));
  assert.ok(matrix.some((row: boolean[]) => row.some(Boolean)));
  const fills: Array<[number, number, number, number]> = [];
  const context = {
    setFillStyle() {},
    fillRect(x: number, y: number, width: number, height: number) { fills.push([x, y, width, height]); },
    draw() {}
  };
  drawCheckInQr(token, context, 240);
  assert.ok(fills.length > 1);
  assert.deepEqual(fills[0], [0, 0, 240, 240]);
  assert.ok(fills.slice(1).every(([x, y]) => x > 0 && y > 0));
});
