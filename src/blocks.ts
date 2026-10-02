import { randomUUID } from 'node:crypto';
import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { eventAliasId, requireActiveMember } from './event-aliases.ts';
import { audit, command } from './registrations.ts';

export async function blockEventMember(db: Database, actor: string, eventId: string, memberId: string, key: string): Promise<{ id: string }> {
  return command(db, actor, `block-member:${eventId}`, key, async tx => {
    await requireActiveMember(tx, actor, eventId);
    if (!/^[a-f0-9]{16}$/.test(memberId)) throw new AppError('BAD_REQUEST', '成员标识无效');
    const { rows } = await tx.query<{ user_id: string }>(`SELECT a.user_id FROM event_aliases a
      JOIN events e ON e.id=a.event_id LEFT JOIN registrations r ON r.event_id=a.event_id AND r.user_id=a.user_id
      WHERE a.event_id=$1 AND (a.user_id=e.host_id OR r.status IN ('CONFIRMED','RECONFIRM_REQUIRED','WAITLISTED','OFFERED'))`, [eventId]);
    const target = rows.find(row => eventAliasId(eventId, row.user_id) === memberId)?.user_id;
    if (!target || target === actor) throw new AppError('NOT_FOUND', '活动成员不可用', 404);
    const { rows: inserted } = await tx.query<{ id: string }>(`INSERT INTO user_blocks(id,blocker_id,blocked_id,event_id)
      VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id`, [randomUUID(), actor, target, eventId]);
    if (inserted[0]) await audit(tx, actor, eventId, 'BLOCK_MEMBER');
    const { rows: current } = inserted.length ? { rows: inserted } : await tx.query<{ id: string }>(
      'SELECT id FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2 AND revoked_at IS NULL', [actor, target]);
    return { id: current[0]!.id };
  });
}

export async function listMyBlocks(db: Database, actor: string): Promise<Array<{ id: string; eventId: string; eventTitle: string }>> {
  const { rows } = await db.query<{ id: string; event_id: string; event_title: string }>(`SELECT b.id,b.event_id,
    CASE WHEN e.review_status='APPROVED' OR (e.review_status='NOT_REQUIRED'
      AND e.payload->>'visibility'='INVITE' AND (
        e.status IN ('IN_PROGRESS','COMPLETED','CANCELLED','EXPIRED') OR
        (e.status='RECRUITING' AND (e.payload->>'confirmationDeadline')::timestamptz<=clock_timestamp()) OR
        (e.status='CONFIRMED' AND (e.payload->>'startAt')::timestamptz<=clock_timestamp())))
      THEN e.payload->>'title' ELSE '活动审核中' END AS event_title
    FROM user_blocks b JOIN events e ON e.id=b.event_id
    WHERE b.blocker_id=$1 AND b.revoked_at IS NULL ORDER BY b.created_at DESC,b.id`, [actor]);
  return rows.map(row => ({ id: row.id, eventId: row.event_id, eventTitle: row.event_title }));
}

export async function revokeBlock(db: Database, actor: string, blockId: string, key: string): Promise<{ id: string; revoked: boolean }> {
  return command(db, actor, `revoke-block:${blockId}`, key, async tx => {
    const { rows } = await tx.query<{ event_id: string; blocker_id: string; revoked_at: Date | null }>(
      'SELECT event_id,blocker_id,revoked_at FROM user_blocks WHERE id=$1 FOR UPDATE', [blockId]);
    if (!rows[0] || rows[0].blocker_id !== actor) throw new AppError('NOT_FOUND', '屏蔽记录不存在', 404);
    if (!rows[0].revoked_at) {
      await tx.query('UPDATE user_blocks SET revoked_at=now() WHERE id=$1', [blockId]);
      await audit(tx, actor, rows[0].event_id, 'REVOKE_MEMBER_BLOCK');
    }
    return { id: blockId, revoked: true };
  });
}
