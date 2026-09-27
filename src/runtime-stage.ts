export type RuntimeStage = 'local' | 'test' | 'candidate' | 'production';

export function resolveRuntimeStage(env: { NODE_ENV?: string; APP_STAGE?: string }): {
  stage: RuntimeStage;
  environment: 'development' | 'test' | 'production';
  dataPath: string | null;
} {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV is invalid');
  const stage = env.APP_STAGE ?? (nodeEnv === 'production' ? 'production' : nodeEnv === 'test' ? 'test' : 'local');
  if (!['local', 'test', 'candidate', 'production'].includes(stage)) throw new Error('APP_STAGE is invalid');
  if ((stage === 'candidate' || stage === 'production') !== (nodeEnv === 'production'))
    throw new Error('APP_STAGE and NODE_ENV must use the same security mode');
  return {
    stage: stage as RuntimeStage,
    environment: stage === 'candidate' || stage === 'production' ? 'production' : stage === 'test' ? 'test' : 'development',
    dataPath: stage === 'local' ? '.data/pgdata' : stage === 'test' ? '.data/test-pgdata' : null
  };
}
