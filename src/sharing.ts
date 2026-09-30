import { createHash } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { getEvent } from './events.ts';
import { audit, command, databaseNow, lockEvent } from './registrations.ts';
import { assertPublicRecruitmentOpen } from './public-gate.ts';
import { assertEventNotHeld } from './safety.ts';

function hashInvite(token: string): string { return createHash('sha256').update(token).digest('hex'); }

async function currentShareInvite(tx: Queryable, actor: string, eventId: string, expectedVersion: number): Promise<string> {
  const event = await lockEvent(tx, eventId, expectedVersion);
  if (event.host_id !== actor) throw new AppError('FORBIDDEN', '只有主办方可发起此活动分享', 403);
  await assertEventNotHeld(tx, eventId);
  await assertPublicRecruitmentOpen(tx, event.payload.visibility, event.payload);
  if (event.review_status !== 'APPROVED') throw new AppError('REVIEW_PENDING', '活动内容尚未通过审核', 409);
  const now = await databaseNow(tx);
  if (!['RECRUITING', 'CONFIRMED'].includes(event.status) || !event.recruiting || !event.invite_token ||
    !event.invite_expires_at || now >= new Date(event.invite_expires_at).getTime() ||
    now >= Date.parse(event.payload.registrationDeadline!))
    throw new AppError('INVALID_STATE', '当前邀请已停止');
  return event.invite_token;
}

export async function recordShareIntent(db: Database, actor: string, eventId: string, expectedVersion: number,
  sourceToken: string, key: string): Promise<{ sourceToken: string }> {
  if (typeof sourceToken !== 'string' || !/^[a-f0-9]{32}$/.test(sourceToken)) throw new AppError('BAD_REQUEST', '分享来源标识无效');
  return command(db, actor, `share-intent:${eventId}`, key, async tx => {
    const inviteToken = await currentShareInvite(tx, actor, eventId, expectedVersion);
    const { rows: existing } = await tx.query('SELECT 1 FROM share_intents WHERE source_token=$1', [sourceToken]);
    if (existing.length) throw new AppError('SOURCE_REUSED', '分享来源标识已使用');
    await tx.query('INSERT INTO share_intents(source_token,event_id,sender_id,invite_token_hash) VALUES($1,$2,$3,$4)',
      [sourceToken, eventId, actor, hashInvite(inviteToken)]);
    await audit(tx, actor, eventId, 'SHARE_INTENT');
    return { sourceToken };
  }, async (tx, previous) => {
    if (previous?.sourceToken !== sourceToken)
      throw new AppError('IDEMPOTENCY_MISMATCH', '此幂等键已用于不同请求，请使用新键重试', 409);
    const inviteToken = await currentShareInvite(tx, actor, eventId, expectedVersion);
    const { rows } = await tx.query<{ event_id: string; sender_id: string; invite_token_hash: string }>(
      'SELECT event_id,sender_id,invite_token_hash FROM share_intents WHERE source_token=$1', [sourceToken]);
    if (!rows[0] || rows[0].event_id !== eventId || rows[0].sender_id !== actor ||
      rows[0].invite_token_hash !== hashInvite(inviteToken))
      throw new AppError('SOURCE_STALE', '邀请码已更新或分享来源已失效，请重新准备分享', 409);
  });
}

export async function recordAttributedOpen(db: Database, actor: string | null, eventId: string, inviteToken: string,
  sourceToken: string | null): Promise<void> {
  if (!actor) return;
  await db.transaction(tx => recordAttributedOpenInTransaction(tx, actor, eventId, inviteToken, sourceToken));
}

export async function recordAttributedOpenInTransaction(tx: Queryable, actor: string | null,
  eventId: string, inviteToken: string, sourceToken: string | null): Promise<void> {
  if (!actor) return;
  const { rows: events } = await tx.query<{ host_id: string }>(`SELECT host_id FROM events
    WHERE id=$1 AND invite_token=$2 AND invite_expires_at>clock_timestamp()
      AND status<>'DRAFT' AND review_status='APPROVED' FOR SHARE`, [eventId, inviteToken]);
  if (!events[0] || events[0].host_id === actor) return;
  const inviteHash = hashInvite(inviteToken);
  const validSource = sourceToken && /^[a-f0-9]{32}$/.test(sourceToken) &&
    (await tx.query(`SELECT 1 FROM share_intents WHERE source_token=$1 AND event_id=$2
      AND invite_token_hash=$3 AND sender_id<>$4`, [sourceToken, eventId, inviteHash, actor])).rows.length > 0;
  if (validSource) {
    const { rows } = await tx.query(`INSERT INTO share_opens(source_token,event_id,invite_token_hash,user_id)
      VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING source_token`, [sourceToken, eventId, inviteHash, actor]);
    if (rows.length) await audit(tx, actor, eventId, 'SHARE_OPEN_ATTRIBUTED');
  } else {
    const { rows } = await tx.query(`INSERT INTO invite_unknown_opens(event_id,invite_token_hash,user_id)
      VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id`, [eventId, inviteHash, actor]);
    if (rows.length) await audit(tx, actor, eventId, 'SHARE_OPEN_UNKNOWN');
  }
}

export async function getShareMetrics(db: Database, actor: string, eventId: string): Promise<{ shareIntents: number; attributedOpens: number; unknownSourceOpens: number }> {
  const event = await getEvent(db, actor, eventId);
  if (event.hostId !== actor) throw new AppError('FORBIDDEN', '只有主办方可查看分享统计', 403);
  const { rows } = await db.query<{ intents: number; opens: number }>(`SELECT count(DISTINCT i.source_token)::int AS intents,
    count(o.user_id)::int AS opens FROM share_intents i LEFT JOIN share_opens o ON o.source_token=i.source_token
    AND o.event_id=i.event_id AND o.invite_token_hash=i.invite_token_hash AND o.user_id<>i.sender_id WHERE i.event_id=$1`, [eventId]);
  const { rows: unknown } = await db.query<{ opens: number }>(
    'SELECT count(*)::int AS opens FROM invite_unknown_opens WHERE event_id=$1', [eventId]);
  return { shareIntents: rows[0]?.intents ?? 0, attributedOpens: rows[0]?.opens ?? 0,
    unknownSourceOpens: unknown[0]?.opens ?? 0 };
}
