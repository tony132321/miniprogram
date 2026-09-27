import type { Database, Queryable } from './db.ts';
import { createHash, randomUUID } from 'node:crypto';
import { getEvent } from './events.ts';
import { AppError } from './errors.ts';
import { audit, command } from './registrations.ts';

export function eventAliasId(eventId: string, userId: string): string {
  return createHash('sha256').update(`${eventId}:${userId}`).digest('hex').slice(0, 16);
}

export function eventAliasNotice(eventId: string) {
  // This is the existing page disclosure, not a legal/privacy notice approval.
  const purpose = 'EVENT_MEMBER_DISPLAY';
  const scope = `EVENT:${eventId}:MEMBERS`;
  const text = '仅在本活动内展示的昵称（可选）';
  return { purpose, scope, text,
    version: createHash('sha256').update(`${purpose}\n${scope}\n${text}`).digest('hex') };
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
  granted: boolean, key: string, noticeVersion?: string): Promise<{ granted: boolean; displayName: string | null }> {
  const notice = eventAliasNotice(eventId);
  if (granted === true && noticeVersion !== notice.version)
    throw new AppError('CONSENT_NOTICE_CHANGED', '昵称展示说明已变化，请重新加载后再确认', 409);
  // Check before the idempotency replay too: an old successful grant must not
  // look like a new grant after a deletion request has been accepted.
  if (granted === true) await assertAliasGrantAllowed(db, actor);
  return command(db, actor, `event-alias:${eventId}`, key, async tx => {
    if (granted === true) await assertAliasGrantAllowed(tx, actor);
    await requireActiveMember(tx, actor, eventId);
    if (granted === false && displayName === null) {
      const { rows: removed } = await tx.query('DELETE FROM event_aliases WHERE event_id=$1 AND user_id=$2 RETURNING event_id', [eventId, actor]);
      if (removed.length) await recordAliasDecision(tx, actor, eventId, notice, false);
      await audit(tx, actor, eventId, 'REVOKE_EVENT_ALIAS');
      return { granted: false, displayName: null };
    }
    if (granted !== true || typeof displayName !== 'string' || !displayName.trim() ||
      displayName.trim().length > 24 || /[\u0000-\u001f\u007f]/.test(displayName))
      throw new AppError('BAD_REQUEST', '请明确同意并填写 1 至 24 字的活动内昵称');
    const clean = displayName.trim();
    await tx.query(`INSERT INTO event_aliases(event_id,user_id,display_name,notice_version) VALUES($1,$2,$3,$4)
      ON CONFLICT(event_id,user_id) DO UPDATE SET display_name=EXCLUDED.display_name,
        notice_version=EXCLUDED.notice_version,consented_at=clock_timestamp()`, [eventId, actor, clean, notice.version]);
    await recordAliasDecision(tx, actor, eventId, notice, true);
    await audit(tx, actor, eventId, 'SET_EVENT_ALIAS');
    return { granted: true, displayName: clean };
  });
}

async function recordAliasDecision(tx: Queryable, actor: string, eventId: string,
  notice: ReturnType<typeof eventAliasNotice>, granted: boolean): Promise<void> {
  await tx.query(`INSERT INTO event_alias_consent_history
    (id,event_id,user_id,purpose,scope,notice_version,notice_text,granted)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
  [randomUUID(), eventId, actor, notice.purpose, notice.scope, notice.version, notice.text, granted]);
}

export async function eventAliasConsentStatus(db: Database, actor: string, eventId: string) {
  await requireActiveMember(db, actor, eventId);
  const notice = eventAliasNotice(eventId);
  const { rows } = await db.query<{ notice_version: string | null }>(
    'SELECT notice_version FROM event_aliases WHERE event_id=$1 AND user_id=$2', [eventId, actor]);
  return { notice, reconfirmationRequired: Boolean(rows[0] && rows[0].notice_version !== notice.version) };
}

async function assertAliasGrantAllowed(db: Queryable, actor: string): Promise<void> {
  const { rows: users } = await db.query<{ status: string }>('SELECT status FROM users WHERE id=$1 FOR SHARE', [actor]);
  if (users[0] && users[0].status !== 'ACTIVE') throw new AppError('ACCOUNT_DISABLED', '账号已停用', 403);
  const { rows: deletions } = await db.query(`SELECT 1 FROM privacy_requests
    WHERE user_id=$1 AND kind='DELETE' AND status NOT IN ('FULFILLED','CANCELLED') LIMIT 1 FOR SHARE`, [actor]);
  if (deletions.length) throw new AppError('DELETE_REQUEST_PENDING', '注销或删除申请处理中，暂不能设置活动内昵称', 409);
}

export async function listEventAliases(db: Database, actor: string, eventId: string): Promise<Array<{
  id: string; displayName: string; isHost: boolean; isMine: boolean
}>> {
  await requireActiveMember(db, actor, eventId);
  const { rows } = await db.query<{ user_id: string; display_name: string; is_host: boolean }>(
    `SELECT a.user_id,a.display_name,(a.user_id=e.host_id) AS is_host FROM event_aliases a
      JOIN events e ON e.id=a.event_id LEFT JOIN registrations r ON r.event_id=a.event_id AND r.user_id=a.user_id
      WHERE a.event_id=$1 AND (a.user_id=e.host_id OR r.status IN ('CONFIRMED','RECONFIRM_REQUIRED','WAITLISTED','OFFERED'))
        AND a.notice_version=$3
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id=a.user_id AND u.status<>'ACTIVE')
        AND NOT EXISTS (SELECT 1 FROM privacy_requests pr WHERE pr.user_id=a.user_id
          AND pr.kind='DELETE' AND pr.status NOT IN ('FULFILLED','CANCELLED'))
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.revoked_at IS NULL
          AND ((b.blocker_id=$2 AND b.blocked_id=a.user_id) OR (b.blocker_id=a.user_id AND b.blocked_id=$2)))
      ORDER BY a.consented_at,a.user_id`, [eventId, actor, eventAliasNotice(eventId).version]);
  return rows.map(row => ({ id: eventAliasId(eventId, row.user_id),
    displayName: row.display_name, isHost: row.is_host, isMine: row.user_id === actor }));
}
