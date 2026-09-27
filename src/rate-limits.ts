import type { Database } from './db.ts';
import { AppError } from './errors.ts';

export interface RateLimitViolation {
  scope: string;
  windowStart: Date;
  attempts: number;
  rejectedCount: number;
}

export async function consumeRateLimit(db: Database, scope: string, limit: number, windowMs: number): Promise<void> {
  if (!scope || scope.length > 160 || !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1000)
    throw new AppError('BAD_REQUEST', '限流参数无效');
  const { rows } = await db.query<{ attempts: number; retry_after_seconds: number }>(`WITH observed AS MATERIALIZED (
      SELECT clock_timestamp() AS observed_at
    ), boundary AS (
      SELECT timestamptz '1970-01-01 00:00:00+00' +
        (floor(extract(epoch FROM observed_at) * 1000 / $2::numeric) * $2::numeric) * interval '1 millisecond' AS window_start
      FROM observed
    )
    INSERT INTO rate_limit_buckets(scope,window_start,attempts,rejected_count)
    SELECT $1,window_start,1,0 FROM boundary
    ON CONFLICT(scope,window_start) DO UPDATE SET
      attempts=rate_limit_buckets.attempts+1,
      rejected_count=rate_limit_buckets.rejected_count+CASE WHEN rate_limit_buckets.attempts >= $3 THEN 1 ELSE 0 END
    RETURNING attempts,GREATEST(1,ceil(extract(epoch FROM (window_start + $2::double precision * interval '1 millisecond' - clock_timestamp()))))::int AS retry_after_seconds`,
    [scope, windowMs, limit]);
  if (rows[0]!.attempts > limit) {
    throw new AppError('RATE_LIMITED', '请求过于频繁，请稍后重试', 429, rows[0]!.retry_after_seconds);
  }
}

export async function listRateLimitViolations(db: Database): Promise<RateLimitViolation[]> {
  const { rows } = await db.query<{ scope: string; window_start: Date; attempts: number; rejected_count: number }>(
    "SELECT scope,window_start,attempts,rejected_count FROM rate_limit_buckets WHERE rejected_count>0 AND window_start>now()-interval '24 hours' ORDER BY window_start DESC,scope LIMIT 100");
  return rows.map(row => ({ scope: row.scope, windowStart: row.window_start, attempts: row.attempts, rejectedCount: row.rejected_count }));
}

export async function pruneRateLimits(db: Database): Promise<void> {
  await db.query("DELETE FROM rate_limit_buckets WHERE window_start<now()-interval '7 days'");
}
