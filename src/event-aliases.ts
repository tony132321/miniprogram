import type { Database, Queryable } from './db.ts';
import { createHash } from 'node:crypto';
import { getEvent } from './events.ts';
import { AppError } from './errors.ts';
import { audit, command } from './registrations.ts';

export function eventAliasId(eventId: string, userId: string): string {
  return createHash('sha256').update(`${eventId}:${userId}`).digest('hex').slice(0, 16);
}

export async function requireActiveMember(db: Queryable, actor: string, eventId: string) {
  const event = await getEvent(db, actor, eventId);
  if (event.hostId === actor) return event;
  const { rows } = await db.query(`SELECT 1 FROM registrations WHERE event_id=$1 AND user_id=$2
    AND status IN ('CONFIRMED','RECONFIRM_REQUIRED','WAITLISTED','OFFERED')`, [eventId, actor]);
  if (!rows.length) throw new AppError('FORBIDDEN', '只有当前活动成员可设置或查看活动内昵称', 403);
  return event;
}

export async function setEventAlias(db: Database, actor: string, eventId: string, displayName: string | null,
  granted: boolean, key: string): Promise<{ granted: boolean; displayName: string | null }> {
  return command(db, actor, `event-alias:${eventId}`, key, async tx => {
    await requireActiveMember(tx, actor, eventId);
    if (granted === false && displayName === null) {
      await tx.query('DELETE FROM event_aliases WHERE event_id=$1 AND user_id=$2', [eventId, actor]);
      await audit(tx, actor, eventId, 'REVOKE_EVENT_ALIAS');
      return { granted: false, displayName: null };
    }
    if (granted !== true || typeof displayName !== 'string' || !displayName.trim() ||
      displayName.trim().length > 24 || /[\u0000-\u001f\u007f]/.test(displayName))
      throw new AppError('BAD_REQUEST', '请明确同意并填写 1 至 24 字的活动内昵称');
    const clean = displayName.trim();
    await tx.query(`INSERT INTO event_aliases(event_id,user_id,display_name) VALUES($1,$2,$3)
      ON CONFLICT(event_id,user_id) DO UPDATE SET display_name=EXCLUDED.display_name,consented_at=now()`, [eventId, actor, clean]);
    await audit(tx, actor, eventId, 'SET_EVENT_ALIAS');
    return { granted: true, displayName: clean };
  });
}

export async function listEventAliases(db: Database, actor: string, eventId: string): Promise<Array<{
  id: string; displayName: string; isHost: boolean; isMine: boolean
}>> {
  await requireActiveMember(db, actor, eventId);
  const { rows } = await db.query<{ user_id: string; display_name: string; is_host: boolean }>(
    `SELECT a.user_id,a.display_name,(a.user_id=e.host_id) AS is_host FROM event_aliases a
      JOIN events e ON e.id=a.event_id LEFT JOIN registrations r ON r.event_id=a.event_id AND r.user_id=a.user_id
      WHERE a.event_id=$1 AND (a.user_id=e.host_id OR r.status IN ('CONFIRMED','RECONFIRM_REQUIRED','WAITLISTED','OFFERED'))
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id=a.user_id AND u.status<>'ACTIVE')
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.revoked_at IS NULL
          AND ((b.blocker_id=$2 AND b.blocked_id=a.user_id) OR (b.blocker_id=a.user_id AND b.blocked_id=$2)))
      ORDER BY a.consented_at,a.user_id`, [eventId, actor]);
  return rows.map(row => ({ id: eventAliasId(eventId, row.user_id),
    displayName: row.display_name, isHost: row.is_host, isMine: row.user_id === actor }));
}
