import { randomUUID } from 'node:crypto';
import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { command } from './registrations.ts';

type SupportCategory = 'SUPPORT' | 'SAFETY' | 'REVIEW';

export async function listSupportMinutes(db: Database) {
  const { rows } = await db.query<{ id: string; event_id: string; recorded_by: string; category: SupportCategory;
    minutes: number; recorded_at: Date }>(`SELECT id,event_id,recorded_by,category,minutes,recorded_at
    FROM support_minutes ORDER BY recorded_at DESC,id DESC LIMIT 100`);
  return rows.map(row => ({ id: row.id, eventId: row.event_id, recordedBy: row.recorded_by,
    category: row.category, minutes: row.minutes, recordedAt: new Date(row.recorded_at).toISOString() }));
}

export async function recordSupportMinutes(db: Database, actor: string, eventId: string,
  minutes: unknown, category: unknown, key: string) {
  if (!Number.isInteger(minutes) || (minutes as number) < 0 || (minutes as number) > 1440)
    throw new AppError('BAD_REQUEST', '人工时间必须为 0 至 1440 的整数分钟');
  if (!['SUPPORT', 'SAFETY', 'REVIEW'].includes(category as string))
    throw new AppError('BAD_REQUEST', '人工工作类别无效');
  if (!eventId) throw new AppError('BAD_REQUEST', '活动 ID 必填');
  return command(db, actor, `support-minutes:${eventId}`, key, async tx => {
    const { rows: events } = await tx.query('SELECT id FROM events WHERE id=$1', [eventId]);
    if (!events.length) throw new AppError('NOT_FOUND', '活动不存在', 404);
    const id = randomUUID();
    const { rows } = await tx.query<{ recorded_at: Date }>(`INSERT INTO support_minutes(id,event_id,recorded_by,category,minutes)
      VALUES($1,$2,$3,$4,$5) RETURNING recorded_at`, [id, eventId, actor, category, minutes]);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action,detail) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), actor, eventId, 'RECORD_SUPPORT_MINUTES', JSON.stringify({ supportMinutesId: id, category, minutes })]);
    return { id, eventId, recordedBy: actor, category: category as SupportCategory, minutes: minutes as number,
      recordedAt: new Date(rows[0]!.recorded_at).toISOString() };
  });
}
