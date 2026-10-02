import { createHash, randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { AppError } from './errors.ts';
import { validateRetentionPolicy } from './retention-policy.ts';

type Run = { request_id: string; affected_events: number; structured_links: number; performed_at: Date };

function tombstone(requestId: string, eventId: string, attempt = 0): string {
  return `deleted:${createHash('sha256').update(attempt ? `${requestId}:${eventId}:${attempt}` :
    `${requestId}:${eventId}`).digest('hex').slice(0, 32)}`;
}

async function eventTombstone(tx: Queryable, requestId: string, eventId: string): Promise<string> {
  const { rows: prior } = await tx.query<{ tombstone_id: string }>(
    'SELECT tombstone_id FROM privacy_shared_event_tombstones WHERE request_id=$1 AND event_id=$2',
    [requestId, eventId]);
  if (prior[0]) return prior[0].tombstone_id;
  await tx.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [eventId]);
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = tombstone(requestId, eventId, attempt);
    const { rows } = await tx.query<{ occupied: boolean }>(`SELECT
      EXISTS(SELECT 1 FROM users WHERE id=$1) OR
      EXISTS(SELECT 1 FROM events WHERE host_id=$1) OR
      EXISTS(SELECT 1 FROM registrations WHERE user_id=$1) OR
      EXISTS(SELECT 1 FROM activity_content WHERE author_id=$1) OR
      EXISTS(SELECT 1 FROM activity_fact_todos WHERE requester_id=$1) OR
      EXISTS(SELECT 1 FROM checkins WHERE user_id=$1) OR
      EXISTS(SELECT 1 FROM manual_checkins WHERE user_id=$1 OR requested_by=$1) OR
      EXISTS(SELECT 1 FROM outcome_feedback WHERE user_id=$1) OR
      EXISTS(SELECT 1 FROM share_intents WHERE sender_id=$1) OR
      EXISTS(SELECT 1 FROM share_opens WHERE user_id=$1) OR
      EXISTS(SELECT 1 FROM invite_unknown_opens WHERE user_id=$1) OR
      EXISTS(SELECT 1 FROM reservations WHERE claimed_by=$1) OR
      EXISTS(SELECT 1 FROM cohost_grants WHERE user_id=$1 OR granted_by=$1) OR
      EXISTS(SELECT 1 FROM registration_removals WHERE user_id=$1 OR removed_by=$1) OR
      EXISTS(SELECT 1 FROM expense_ledgers WHERE created_by=$1) OR
      EXISTS(SELECT 1 FROM expense_shares WHERE user_id=$1) OR
      EXISTS(SELECT 1 FROM event_alias_consent_history WHERE user_id=$1) OR
      EXISTS(SELECT 1 FROM outcomes WHERE completed_by=$1) OR
      EXISTS(SELECT 1 FROM venue_evidence WHERE recorded_by=$1) OR
      EXISTS(SELECT 1 FROM privacy_shared_event_tombstones WHERE tombstone_id=$1)
      AS occupied`, [candidate]);
    if (rows[0]?.occupied) continue;
    await tx.query(`INSERT INTO privacy_shared_event_tombstones(request_id,event_id,tombstone_id)
      VALUES($1,$2,$3)`, [requestId, eventId, candidate]);
    return candidate;
  }
  throw new AppError('PSEUDONYM_COLLISION', '共享记录无法安全分配去标识标记', 409);
}

function safePayload(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {
    title: '已注销账号的活动', venueName: '已隐藏集合地点', cancellationRule: '原个人规则已移除'
  };
  for (const key of ['type', 'startAt', 'endAt', 'timeZone', 'templateDurationMinutes',
    'city', 'venueStatus', 'minParticipants', 'maxParticipants', 'registrationDeadline',
    'confirmationDeadline', 'feeMode', 'feeCapFen', 'visibility', 'approvalMode', 'hostParticipates']) {
    if (value[key] !== undefined) result[key] = value[key];
  }
  return result;
}

async function changed(tx: Queryable, sql: string, params: unknown[]): Promise<number> {
  const { rows } = await tx.query(sql, params);
  return rows.length;
}

function result(row: Run) {
  return { requestId: row.request_id,
    disposition: 'STRUCTURED_DEIDENTIFIED_REVIEW_PENDING' as const,
    affectedEvents: row.affected_events, structuredLinks: row.structured_links,
    performedAt: new Date(row.performed_at).toISOString() };
}

// Scrub every explicitly mapped shared identity column and host-supplied text.
// Opaque JSON, audit/provider copies and disputed free text still require
// separate review; the deletion request must therefore remain pending.
export async function deidentifySharedActivity(db: Database, operator: string,
  requestId: string, approvedPolicyJson: string) {
  validateRetentionPolicy(approvedPolicyJson);
  if (!operator.startsWith('operator:')) throw new AppError('FORBIDDEN', '需要运营身份', 403);
  const policySha256 = createHash('sha256').update(approvedPolicyJson).digest('hex');
  return db.transaction(async tx => {
    const { rows: requests } = await tx.query<{ user_id: string; status: string }>(
      "SELECT user_id,status FROM privacy_requests WHERE id=$1 AND kind='DELETE'", [requestId]);
    if (!requests[0]) throw new AppError('NOT_FOUND', '注销或删除申请不存在', 404);
    const userId = requests[0].user_id;
    await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    const { rows: executions } = await tx.query<{ policy_sha256: string }>(
      'SELECT policy_sha256 FROM privacy_deletion_executions WHERE request_id=$1 FOR UPDATE', [requestId]);
    if (!executions[0] || requests[0].status !== 'SAFEGUARDS_APPLIED_PENDING_REVIEW')
      throw new AppError('DELETE_NOT_PROTECTED', '注销前置保护未完成', 409);
    if (executions[0].policy_sha256 !== policySha256)
      throw new AppError('POLICY_MISMATCH', '去标识策略与已执行策略不一致', 409);
    await tx.query("SELECT set_config('app.privacy_tombstone_request',$1,true)", [requestId]);
    const { rows: previous } = await tx.query<Run>(
      'SELECT request_id,affected_events,structured_links,performed_at FROM privacy_shared_deidentifications WHERE request_id=$1', [requestId]);

    const { rows: eventRows } = await tx.query<{ event_id: string }>(`SELECT id AS event_id FROM events WHERE host_id=$1
      UNION SELECT event_id FROM registrations WHERE user_id=$1
      UNION SELECT event_id FROM activity_content WHERE author_id=$1
      UNION SELECT event_id FROM activity_fact_todos WHERE requester_id=$1
      UNION SELECT event_id FROM outcomes WHERE completed_by=$1
      UNION SELECT event_id FROM venue_evidence WHERE recorded_by=$1
      UNION SELECT event_id FROM event_alias_consent_history WHERE user_id=$1
      UNION SELECT event_id FROM checkins WHERE user_id=$1
      UNION SELECT event_id FROM manual_checkins WHERE user_id=$1 OR requested_by=$1
      UNION SELECT event_id FROM outcome_feedback WHERE user_id=$1
      UNION SELECT event_id FROM share_intents WHERE sender_id=$1
      UNION SELECT event_id FROM share_opens WHERE user_id=$1
      UNION SELECT event_id FROM invite_unknown_opens WHERE user_id=$1
      UNION SELECT event_id FROM reservations WHERE claimed_by=$1
      UNION SELECT event_id FROM cohost_grants WHERE user_id=$1 OR granted_by=$1
      UNION SELECT event_id FROM registration_removals WHERE user_id=$1 OR removed_by=$1
      UNION SELECT event_id FROM expense_ledgers WHERE created_by=$1
      UNION SELECT l.event_id FROM expense_shares s JOIN expense_ledgers l ON l.id=s.ledger_id WHERE s.user_id=$1`, [userId]);
    let structuredLinks = 0;
    for (const { event_id: eventId } of eventRows) {
      const replacement = await eventTombstone(tx, requestId, eventId);
      const params = [userId, replacement, eventId];
      const mapped = [
        ['registrations', 'user_id'], ['checkins', 'user_id'], ['manual_checkins', 'user_id'],
        ['manual_checkins', 'requested_by'], ['outcome_feedback', 'user_id'],
        ['share_intents', 'sender_id'], ['share_opens', 'user_id'],
        ['invite_unknown_opens', 'user_id'], ['reservations', 'claimed_by'],
        ['registration_removals', 'user_id'], ['registration_removals', 'removed_by'],
        ['expense_ledgers', 'created_by'], ['cohost_grants', 'user_id'],
        ['cohost_grants', 'granted_by'], ['event_alias_consent_history', 'user_id']
      ] as const;
      for (const [table, column] of mapped) {
        structuredLinks += await changed(tx,
          `UPDATE ${table} SET ${column}=$2 WHERE ${column}=$1 AND event_id=$3 RETURNING 1`, params);
      }
      structuredLinks += await changed(tx,
        'UPDATE expense_shares s SET user_id=$2 FROM expense_ledgers l WHERE s.ledger_id=l.id AND s.user_id=$1 AND l.event_id=$3 RETURNING 1', params);
      structuredLinks += await changed(tx,
        `UPDATE activity_content SET author_id=$2,body='[已移除的个人内容]',moderation_reason=NULL
          WHERE author_id=$1 AND event_id=$3 RETURNING 1`, params);
      structuredLinks += await changed(tx,
        `UPDATE activity_fact_todos SET requester_id=$2,question_text='[已移除的个人提问 ' || id || ']'
          WHERE requester_id=$1 AND event_id=$3 RETURNING 1`, params);
      structuredLinks += await changed(tx,
        `UPDATE outcome_feedback SET reason='[已移除的个人反馈]'
          WHERE user_id=$1 AND event_id=$2 AND reason IS NOT NULL RETURNING 1`, [replacement, eventId]);
      structuredLinks += await changed(tx,
        `UPDATE registration_removals SET reason='[已移除的个人说明]'
          WHERE event_id=$1 AND (user_id=$2 OR removed_by=$2) RETURNING 1`, [eventId, replacement]);
      structuredLinks += await changed(tx,
        'UPDATE outcomes SET completed_by=$2 WHERE completed_by=$1 AND event_id=$3 RETURNING 1', params);
      structuredLinks += await changed(tx,
        "UPDATE venue_evidence SET recorded_by=$2,venue_name='已隐藏集合地点' WHERE recorded_by=$1 AND event_id=$3 RETURNING 1", params);
      await tx.query(`UPDATE cohost_grants SET revoked_at=COALESCE(revoked_at,clock_timestamp())
        WHERE event_id=$1 AND (user_id=$2 OR granted_by=$2)`, [eventId, replacement]);
      const { rows: hosts } = await tx.query<{ payload: Record<string, unknown> }>(
        'SELECT payload FROM events WHERE id=$1 AND host_id=$2 FOR UPDATE', [eventId, userId]);
      if (hosts[0]) {
        const { rows: versions } = await tx.query<{ version: number; payload: Record<string, unknown> }>(
          'SELECT version,payload FROM event_versions WHERE event_id=$1', [eventId]);
        for (const version of versions) await tx.query('UPDATE event_versions SET payload=$3 WHERE event_id=$1 AND version=$2',
          [eventId, version.version, JSON.stringify(safePayload(version.payload))]);
        structuredLinks += await changed(tx, `UPDATE events SET host_id=$2,payload=$3,recruiting=false,
          invite_token=NULL,invite_expires_at=NULL WHERE id=$4 AND host_id=$1 RETURNING 1`,
        [userId, replacement, JSON.stringify(safePayload(hosts[0].payload)), eventId]);
        await tx.query('UPDATE cohost_grants SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE event_id=$1', [eventId]);
        await tx.query("UPDATE venue_evidence SET venue_name='已隐藏集合地点' WHERE event_id=$1", [eventId]);
      }
    }
    const globalTombstone = `deleted:${createHash('sha256').update(requestId).digest('hex').slice(0, 32)}`;
    await tx.query('UPDATE users SET wechat_openid=$2 WHERE id=$1', [userId, globalTombstone]);
    const { rows: inserted } = await tx.query<Run>(`INSERT INTO privacy_shared_deidentifications
      (request_id,user_id,affected_events,structured_links,performed_by)
      VALUES($1,$2,(SELECT count(*)::int FROM privacy_shared_event_tombstones WHERE request_id=$1),$3,$4)
      ON CONFLICT (request_id) DO UPDATE SET
        affected_events=(SELECT count(*)::int FROM privacy_shared_event_tombstones WHERE request_id=$1),
        structured_links=privacy_shared_deidentifications.structured_links+$3
      RETURNING request_id,affected_events,structured_links,performed_at`,
    [requestId, userId, structuredLinks, operator]);
    await tx.query(`UPDATE privacy_deletion_executions SET outcomes=jsonb_set(outcomes,
      '{sharedActivity}',$2::jsonb) WHERE request_id=$1`,
    [requestId, JSON.stringify({ state: 'DEIDENTIFIED_REVIEW_PENDING', affected: inserted[0]!.structured_links })]);
    if (!previous[0] || structuredLinks > 0) await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
      [randomUUID(), operator, 'PRIVACY_STRUCTURED_DEIDENTIFIED', JSON.stringify({ requestId,
        affectedEvents: inserted[0]!.affected_events, structuredLinks, pendingTextReview: true })]);
    return result(inserted[0]!);
  });
}
