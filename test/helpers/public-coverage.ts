import { randomUUID } from 'node:crypto';
import type { Database } from '../../src/db.ts';
import { confirmPublicCoverage, createPublicCoverage, setPublicGate } from '../../src/public-gate.ts';

// Synthetic test fixture only. It proves gate behavior, not real people or an actual drill.
export async function openSyntheticPublicCoverage(db: Database,
  activities: Array<{ startAt?: string; endAt?: string }> = []) {
  const drill = new Date(Date.now() - 60 * 60_000).toISOString();
  for (const activity of activities) {
    const start = Date.parse(activity.startAt ?? '');
    const end = Date.parse(activity.endAt ?? '');
    if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('synthetic public fixture needs event times');
    const coverage = await createPublicCoverage(db, 'synthetic-duty-owner',
      new Date(start - 60 * 60_000).toISOString(), new Date(end + 60 * 60_000).toISOString(),
      'synthetic-drill-reference', drill, randomUUID());
    await confirmPublicCoverage(db, 'synthetic-duty-reviewer', coverage.id,
      '已核对合成活动时段记录', randomUUID());
  }
  const current = await createPublicCoverage(db, 'synthetic-duty-owner',
    new Date(Date.now() - 60 * 60_000).toISOString(), new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
    'synthetic-current-drill', drill, randomUUID());
  await confirmPublicCoverage(db, 'synthetic-duty-reviewer', current.id,
    '已核对当前合成值守记录', randomUUID());
  await setPublicGate(db, 'synthetic-duty-reviewer', 'OPEN', '合成测试覆盖记录允许公开活动',
    randomUUID(), current.id);
  return current;
}
