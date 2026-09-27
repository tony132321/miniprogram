import type { Database } from './db.ts';
import { randomUUID } from 'node:crypto';
import { AppError } from './errors.ts';
import { command } from './registrations.ts';

export async function createPersonalExportTicket(db: Database, actor: string, key: string): Promise<{ path: string; expiresAt: string }> {
  return command(db, actor, 'personal-export-ticket', key, async tx => {
    const id = randomUUID();
    const { rows } = await tx.query<{ expires_at: Date }>(`INSERT INTO personal_export_tickets(id,user_id,expires_at)
      VALUES($1,$2,clock_timestamp()+interval '10 minutes') RETURNING expires_at`, [id, actor]);
    return { path: `/privacy/exports/${id}`, expiresAt: new Date(rows[0]!.expires_at).toISOString() };
  });
}

export async function downloadPersonalExport(db: Database, actor: string, ticketId: string) {
  const { rows } = await db.query<{ user_id: string; expired: boolean }>(
    'SELECT user_id,expires_at<=clock_timestamp() AS expired FROM personal_export_tickets WHERE id=$1', [ticketId]);
  if (!rows[0] || rows[0].user_id !== actor) throw new AppError('NOT_FOUND', '导出链接不存在', 404);
  if (rows[0].expired) throw new AppError('EXPORT_EXPIRED', '导出链接已过期，请重新生成', 410);
  return exportPersonalData(db, actor);
}

export async function pruneExpiredPersonalExportTickets(db: Database): Promise<void> {
  // Retain an expired ticket briefly so its owner receives the explicit 410
  // recovery response; the ticket remains unusable throughout this period.
  await db.query(`WITH removed AS (
    DELETE FROM personal_export_tickets WHERE expires_at<=clock_timestamp()-interval '1 day'
    RETURNING id,user_id
  ) DELETE FROM idempotency i USING removed t
    WHERE i.actor_id=t.user_id AND i.route='personal-export-ticket'
      AND i.result->>'path'='/privacy/exports/' || t.id`);
}

// Return only records owned by this account. Shared activity facts stay in the event table;
// another participant's identity is never included in this export.
export async function exportPersonalData(db: Database, actor: string) {
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const own = async (sql: string) => (await tx.query(sql, [actor])).rows;
    return {
    exportedAt: new Date().toISOString(),
    account: (await own('SELECT id,wechat_openid,status,created_at FROM users WHERE id=$1'))[0] ?? null,
    hostedEvents: await own('SELECT id,status,version,payload,created_at,updated_at FROM events WHERE host_id=$1 ORDER BY created_at,id'),
    hostedEventVersions: await own(`SELECT v.event_id,v.version,v.payload,v.created_at FROM event_versions v
      JOIN events e ON e.id=v.event_id WHERE e.host_id=$1 ORDER BY v.event_id,v.version`),
    hostedEventStatusHistory: await own(`SELECT h.event_id,h.status,h.changed_at,h.legacy_snapshot
      FROM event_status_history h JOIN events e ON e.id=h.event_id
      WHERE e.host_id=$1 ORDER BY h.changed_at,h.id`),
    hostedOutcomes: await own(`SELECT o.event_id,o.held,o.actual_count,o.completed_at,o.disputed,o.issues FROM outcomes o
      JOIN events e ON e.id=o.event_id WHERE e.host_id=$1 ORDER BY o.completed_at,o.event_id`),
    hostedOutcomeReviews: await own(`SELECT r.event_id,r.decision,r.created_at FROM outcome_reviews r
      JOIN events e ON e.id=r.event_id WHERE e.host_id=$1 ORDER BY r.created_at,r.id`),
    reportedOutcomeReviews: await own(`SELECT r.report_id,r.event_id,r.decision,r.created_at FROM outcome_reviews r
      JOIN reports p ON p.id=r.report_id WHERE p.reporter_id=$1 ORDER BY r.created_at,r.id`),
    hostedVenueEvidence: await own(`SELECT v.event_id,v.event_version,v.venue_name,v.source_type,v.phase,v.recorded_at,v.expires_at,v.activity_end_at
      FROM venue_evidence v JOIN events e ON e.id=v.event_id WHERE e.host_id=$1 ORDER BY v.event_id,v.event_version`),
    createdExpenseLedgers: await own('SELECT id,event_id,total_fen,status,revision,superseded_by,created_at FROM expense_ledgers WHERE created_by=$1 ORDER BY created_at,id'),
    shareIntents: await own('SELECT event_id,created_at FROM share_intents WHERE sender_id=$1 ORDER BY created_at,event_id'),
    shareOpens: await own('SELECT event_id,opened_at FROM share_opens WHERE user_id=$1 ORDER BY opened_at,event_id'),
    unknownSourceInviteOpens: await own('SELECT event_id,opened_at FROM invite_unknown_opens WHERE user_id=$1 ORDER BY opened_at,event_id'),
    registrations: await own('SELECT id,event_id,user_id,status,accepted_version,created_at,updated_at FROM registrations WHERE user_id=$1 ORDER BY created_at,id'),
    registrationStatusHistory: await own(`SELECT h.registration_id,r.event_id,h.status,h.changed_at,h.legacy_snapshot
      FROM registration_status_history h JOIN registrations r ON r.id=h.registration_id
      WHERE r.user_id=$1 ORDER BY h.changed_at,h.id`),
    claimedReservations: await own('SELECT id,event_id,created_at,released_at FROM reservations WHERE claimed_by=$1 ORDER BY created_at,id'),
    waitlistOffers: await own(`SELECT o.id,o.event_id,o.status,o.expires_at,o.created_at FROM offers o
      JOIN registrations r ON r.id=o.registration_id WHERE r.user_id=$1 ORDER BY o.created_at,o.id`),
    waitlistOfferHistory: await own(`SELECT h.offer_id,o.event_id,h.status,h.changed_at,h.legacy_snapshot
      FROM offer_status_history h JOIN offers o ON o.id=h.offer_id
      JOIN registrations r ON r.id=o.registration_id WHERE r.user_id=$1 ORDER BY h.changed_at,h.id`),
    eventAliases: await own('SELECT event_id,display_name,notice_version,consented_at FROM event_aliases WHERE user_id=$1 ORDER BY consented_at,event_id'),
    eventAliasConsentHistory: await own(`SELECT event_id,purpose,scope,notice_version,notice_text,granted,source,changed_at
      FROM event_alias_consent_history WHERE user_id=$1 ORDER BY changed_at,id`),
    blocks: await own('SELECT id,event_id,created_at,revoked_at FROM user_blocks WHERE blocker_id=$1 ORDER BY created_at,id'),
    receivedCohostGrants: await own(`SELECT id,event_id,capabilities,expires_at,revoked_at,created_at
      FROM cohost_grants WHERE user_id=$1 ORDER BY created_at,id`),
    issuedCohostGrants: await own(`SELECT event_id,capabilities,expires_at,revoked_at,created_at
      FROM cohost_grants WHERE granted_by=$1 ORDER BY created_at,id`),
    notificationConsents: await own('SELECT purpose,granted,scope,notice_version,updated_at FROM notification_consents WHERE user_id=$1 ORDER BY purpose'),
    notificationConsentHistory: await own(`SELECT purpose,scope,notice_version,notice_text,granted,source,changed_at
      FROM notification_consent_history WHERE user_id=$1 ORDER BY changed_at,id`),
    aiDraftRequests: await own(`SELECT event_id,status,budget_fen,reserved_fen,known_cost_fen,cost_status,result,created_at,finished_at
      FROM ai_draft_requests WHERE actor_id=$1 ORDER BY created_at,request_key`),
    aiActionProposals: await own(`SELECT id,event_id,kind,expected_version,payload,status,expires_at,
      approved_at,revoked_at,executed_at,receipt,created_at
      FROM ai_action_proposals WHERE actor_id=$1 ORDER BY created_at,id`),
    notifications: await own(`SELECT id,event_id,kind,event_version,status,read_at,external_status,
      external_purpose,external_channel,template_slot,external_scheduled_at,external_dispatch_started_at,
      provider_responded_at,external_failure_code,provider_ref,detail,created_at
      FROM notifications WHERE user_id=$1 ORDER BY created_at,id`),
    checkIns: await own('SELECT id,event_id,user_id,evidence,checked_at,disputed FROM checkins WHERE user_id=$1 ORDER BY checked_at,id'),
    manualCheckIns: await own('SELECT id,event_id,user_id,status,(requested_by=$1) AS requested_by_me,requested_at,responded_at FROM manual_checkins WHERE user_id=$1 ORDER BY requested_at,id'),
    outcomeFeedback: await own('SELECT event_id,user_id,held,would_repeat,reason,created_at FROM outcome_feedback WHERE user_id=$1 ORDER BY created_at,event_id'),
    expenseShares: await own(`SELECT s.ledger_id,l.event_id,s.user_id,s.amount_fen,s.participant_handled,s.host_received
      FROM expense_shares s JOIN expense_ledgers l ON l.id=s.ledger_id WHERE s.user_id=$1 ORDER BY l.created_at,s.ledger_id`),
    activityContent: await own('SELECT id,event_id,kind,parent_id,body,status,moderation_reason,created_at FROM activity_content WHERE author_id=$1 ORDER BY created_at,id'),
    factQuestions: await own('SELECT id,event_id,event_version,question_text,status,created_at,resolved_at FROM activity_fact_todos WHERE requester_id=$1 ORDER BY created_at,id'),
    reports: await own('SELECT id,event_id,kind,description,status,resolution,updated_at,created_at FROM reports WHERE reporter_id=$1 ORDER BY created_at,id'),
    appeals: await own('SELECT id,report_id,removal_id,content_id,description,status,resolution,outcome,created_at,updated_at FROM appeals WHERE appellant_id=$1 ORDER BY created_at,id'),
    removals: await own('SELECT id,registration_id,event_id,reason,created_at FROM registration_removals WHERE user_id=$1 ORDER BY created_at,id'),
    privacyRequests: await own(`SELECT id,kind,status,protection_applied_at,consents_revoked_count,
      aliases_removed_count,created_at FROM privacy_requests WHERE user_id=$1 ORDER BY created_at,id`),
    auditActions: await own('SELECT id,event_id,action,created_at FROM audit WHERE actor_id=$1 ORDER BY created_at,id'),
    businessEvents: await own(`SELECT b.event_uuid,b.event_name,b.occurred_at,b.user_id_pseudonymous,
      b.activity_id,b.version,b.source,b.release,b.is_test FROM business_events b
      JOIN audit a ON a.id=b.event_uuid WHERE a.actor_id=$1 ORDER BY b.occurred_at,b.event_uuid`)
    };
  });
}
