import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveRuntimeStage } from '../src/runtime-stage.ts';

test('local, integration, candidate and production stages select separate safe defaults', () => {
  assert.deepEqual(resolveRuntimeStage({ NODE_ENV: 'development' }),
    { stage: 'local', environment: 'development', dataPath: '.data/pgdata' });
  assert.deepEqual(resolveRuntimeStage({ NODE_ENV: 'test', APP_STAGE: 'test' }),
    { stage: 'test', environment: 'test', dataPath: '.data/test-pgdata' });
  assert.deepEqual(resolveRuntimeStage({ NODE_ENV: 'production', APP_STAGE: 'candidate' }),
    { stage: 'candidate', environment: 'production', dataPath: null });
  assert.deepEqual(resolveRuntimeStage({ NODE_ENV: 'production' }),
    { stage: 'production', environment: 'production', dataPath: null });
});

test('a nonproduction stage cannot run with production settings or vice versa', () => {
  for (const stage of ['local', 'test'])
    assert.throws(() => resolveRuntimeStage({ NODE_ENV: 'production', APP_STAGE: stage }), /APP_STAGE.*NODE_ENV/);
  for (const stage of ['candidate', 'production'])
    assert.throws(() => resolveRuntimeStage({ NODE_ENV: 'development', APP_STAGE: stage }), /APP_STAGE.*NODE_ENV/);
  assert.throws(() => resolveRuntimeStage({ NODE_ENV: 'production', APP_STAGE: 'demo' }), /APP_STAGE/);
});
