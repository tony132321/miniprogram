import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { audit, command, databaseNow, lockEvent } from './registrations.ts';

export type CohostCapability = 'APPROVE_REGISTRATION' | 'MANAGE_ANNOUNCEMENTS' | 'CHECKIN_MANAGE';
export type CohostGrant = { id: string; eventId: string; userId: string; capabilities: CohostCapability[];
  expiresAt: string; status: 'ACTIVE' | 'REVOKED' };
type GrantRow = { id: string; event_id: string; user_id: string; capabilities: CohostCapability[];
  expires_at: Date; revoked_at: Date | null };
const capabilities = new Set<CohostCapability>(['APPROVE_REGISTRATION', 'MANAGE_ANNOUNCEMENTS', 'CHECKIN_MANAGE']);

function result(row: GrantRow): CohostGrant {
  return { id: row.id, eventId: row.event_id, userId: row.user_id, capabilities: row.capabilities,
    expiresAt: new Date(row.expires_at).toISOString(), status: row.revoked_at ? 'REVOKED' : 'ACTIVE' };
}

export async function grantCohost(db: Database, actor: string, eventId: string, version: number,
  userId: string, grantedCapabilities: string[], expiresAt: string, key: string): Promise<CohostGrant> {
  return command(db, actor, `grant-cohost:${eventId}`, key, async tx => {
    const event = await lockEvent(tx, eventId, version);
    if (event.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可授权协办', 403);
    if (typeof userId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(userId) || userId === actor ||
      !Array.isArray(grantedCapabilities) || grantedCapabilities.length < 1 ||
      grantedCapabilities.some(capability => !capabilities.has(capability as CohostCapability)) ||
      new Set(grantedCapabilities).size !== grantedCapabilities.length ||
      typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt)) ||
      Date.parse(expiresAt) > Date.parse(event.payload.endAt!) + 48 * 60 * 60_000)
      throw new AppError('BAD_REQUEST', '协办身份、能力或有效期无效');
    if (Date.parse(expiresAt) <= await databaseNow(tx))
      throw new AppError('BAD_REQUEST', '协办有效期必须晚于当前时间');
    if (event.status === 'DRAFT' || ['CANCELLED', 'EXPIRED'].includes(event.status))
      throw new AppError('INVALID_STATE', '活动当前不能授权协办');
    const { rows: existing } = await tx.query('SELECT 1 FROM cohost_grants WHERE event_id=$1 AND user_id=$2 AND revoked_at IS NULL', [eventId, userId]);
    if (existing.length) throw new AppError('GRANT_EXISTS', '协办已获授权，请先撤回原授权', 409);
    const { rows } = await tx.query<GrantRow>(`INSERT INTO cohost_grants(id,event_id,user_id,granted_by,capabilities,expires_at)
      SELECT $1,$2,$3,$4,$5,$6 FROM events WHERE id=$2 AND $6::timestamptz>clock_timestamp()
      RETURNING *`, [randomUUID(), eventId, userId, actor, grantedCapabilities, expiresAt]);
    if (!rows[0]) throw new AppError('BAD_REQUEST', '协办有效期必须晚于当前时间');
    await audit(tx, actor, eventId, 'GRANT_COHOST');
    return result(rows[0]!);
  });
}

export async function revokeCohost(db: Database, actor: string, grantId: string, key: string): Promise<CohostGrant> {
  return command(db, actor, `revoke-cohost:${grantId}`, key, async tx => {
    const { rows: found } = await tx.query<{ event_id: string }>('SELECT event_id FROM cohost_grants WHERE id=$1', [grantId]);
    if (!found[0]) throw new AppError('NOT_FOUND', '协办授权不存在', 404);
    const { rows: events } = await tx.query<{ host_id: string }>('SELECT host_id FROM events WHERE id=$1 FOR UPDATE', [found[0].event_id]);
    if (events[0]?.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可撤回协办', 403);
    const { rows: grants } = await tx.query<GrantRow>('SELECT * FROM cohost_grants WHERE id=$1 FOR UPDATE', [grantId]);
    const row = grants[0]!;
    if (row.revoked_at) return result(row);
    const { rows: updated } = await tx.query<GrantRow>('UPDATE cohost_grants SET revoked_at=now() WHERE id=$1 RETURNING *', [grantId]);
    await audit(tx, actor, row.event_id, 'REVOKE_COHOST');
    return result(updated[0]!);
  });
}

export async function hasCohostCapability(db: Queryable, actor: string, eventId: string,
  capability: CohostCapability): Promise<boolean> {
  return (await getCohostCapabilities(db, actor, eventId)).includes(capability);
}

export async function getCohostCapabilities(db: Queryable, actor: string, eventId: string): Promise<CohostCapability[]> {
  const { rows } = await db.query<{ capabilities: CohostCapability[] }>(`SELECT capabilities FROM cohost_grants
    WHERE event_id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp() LIMIT 1`, [eventId, actor]);
  return rows[0]?.capabilities ?? [];
}

export async function listCohostGrants(db: Database, actor: string, eventId: string): Promise<CohostGrant[]> {
  const { rows: events } = await db.query<{ host_id: string }>('SELECT host_id FROM events WHERE id=$1', [eventId]);
  if (!events[0]) throw new AppError('NOT_FOUND', '活动不存在', 404);
  if (events[0].host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可查看协办授权', 403);
  const { rows } = await db.query<GrantRow>('SELECT * FROM cohost_grants WHERE event_id=$1 ORDER BY created_at,id', [eventId]);
  return rows.map(result);
}
