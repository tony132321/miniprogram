import type { Queryable } from './db.ts';

type FieldClass = 'DIRECT_IDENTIFIER' | 'FREE_TEXT' | 'JSON' | 'CONSENT' |
  'AI_RECORD' | 'AUDIT_REPLAY' | 'EXTERNAL_DELIVERY';
type Field = { column: string; class: FieldClass };
type Group = { table: string; from: string; where: string; ownerLink: string; fields: Field[] };
const fields = (kind: FieldClass, ...columns: string[]): Field[] =>
  columns.map(column => ({ column, class: kind }));

// These SQL fragments only receive identifiers written in this source tree.
// They retain ownership after direct person IDs have been replaced by a
// request-bound tombstone; no original content is returned by the inventory.
export const historicallyHosted = (eventAlias: string): string =>
  `(${eventAlias}.host_id=$1 OR EXISTS (SELECT 1 FROM privacy_shared_event_tombstones h
    JOIN privacy_requests p ON p.id=h.request_id WHERE h.event_id=${eventAlias}.id
      AND h.tombstone_id=${eventAlias}.host_id AND p.user_id=$1))`;
export const sharedPerson = (identityColumn: string, eventColumn: string): string =>
  `(${identityColumn}=$1 OR EXISTS (SELECT 1 FROM privacy_shared_event_tombstones h
    JOIN privacy_requests p ON p.id=h.request_id WHERE h.event_id=${eventColumn}
      AND h.tombstone_id=${identityColumn} AND p.user_id=$1))`;
export const disputePerson = (identityColumn: string): string =>
  `(${identityColumn}=$1 OR EXISTS (SELECT 1 FROM privacy_requests p WHERE p.user_id=$1
    AND ${identityColumn}=('deleted:' || left(encode(sha256(convert_to(p.id,'UTF8')),'hex'),24))))`;
export const historicallyReported = (reportAlias: string): string =>
  `(${disputePerson(`${reportAlias}.reporter_id`)} OR EXISTS (SELECT 1 FROM privacy_quarantine q
    JOIN privacy_requests p ON p.id=q.request_id WHERE q.source_table='reports'
      AND q.source_id=${reportAlias}.id AND p.user_id=$1))`;
const notificationRecipient = (identityColumn: string): string =>
  `(${identityColumn}=$1 OR EXISTS (SELECT 1 FROM privacy_ordinary_profile_expiries e
    JOIN privacy_requests p ON p.id=e.request_id AND p.user_id=e.user_id
    WHERE e.user_id=$1 AND e.recipient_tombstone=${identityColumn}))`;

// Static, reviewed SQL identifiers and ownership predicates only. A count is
// a non-null column in a row linked by the stated predicate, never a search of
// arbitrary text/JSON for a name or identifier.
const groups: Group[] = [
  { table: 'users', from: 'users t', where: 't.id=$1', ownerLink: 'id',
    fields: [...fields('DIRECT_IDENTIFIER', 'id', 'wechat_openid')] },
  { table: 'sessions', from: 'sessions t', where: 't.user_id=$1', ownerLink: 'user_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id', 'token_hash')] },
  { table: 'host_publication_status', from: 'host_publication_status t', where: 't.host_id=$1', ownerLink: 'host_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'host_id'), ...fields('FREE_TEXT', 'reason')] },
  { table: 'events', from: 'events t', where: historicallyHosted('t'), ownerLink: 'host_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'host_id', 'invite_token'), ...fields('JSON', 'payload'), ...fields('FREE_TEXT', 'review_reason')] },
  { table: 'event_versions', from: 'event_versions t',
    where: `EXISTS (SELECT 1 FROM events e WHERE e.id=t.event_id AND ${historicallyHosted('e')})`, ownerLink: 'hosted_event',
    fields: [...fields('JSON', 'payload')] },
  { table: 'event_status_history', from: 'event_status_history t JOIN events e ON e.id=t.event_id',
    where: historicallyHosted('e'), ownerLink: 'hosted_event',
    fields: [...fields('DIRECT_IDENTIFIER', 'event_id')] },
  { table: 'event_review_decisions', from: 'event_review_decisions t',
    where: `EXISTS (SELECT 1 FROM events e WHERE e.id=t.event_id AND ${historicallyHosted('e')})`, ownerLink: 'hosted_event',
    fields: [...fields('FREE_TEXT', 'reason')] },
  { table: 'event_safety_holds', from: 'event_safety_holds t',
    where: `EXISTS (SELECT 1 FROM events e WHERE e.id=t.event_id AND ${historicallyHosted('e')})`, ownerLink: 'hosted_event',
    fields: [...fields('FREE_TEXT', 'reason', 'release_reason')] },
  { table: 'activity_content', from: 'activity_content t', where: sharedPerson('t.author_id','t.event_id'), ownerLink: 'author_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'author_id'), ...fields('FREE_TEXT', 'body', 'moderation_reason')] },
  { table: 'activity_fact_todos', from: 'activity_fact_todos t', where: sharedPerson('t.requester_id','t.event_id'), ownerLink: 'requester_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'requester_id'), ...fields('FREE_TEXT', 'question_text')] },
  { table: 'registrations', from: 'registrations t', where: sharedPerson('t.user_id','t.event_id'), ownerLink: 'user_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id')] },
  { table: 'registration_status_history', from: 'registration_status_history t JOIN registrations r ON r.id=t.registration_id',
    where: sharedPerson('r.user_id','r.event_id'), ownerLink: 'registration_user_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'registration_id')] },
  { table: 'offers', from: 'offers t JOIN registrations r ON r.id=t.registration_id',
    where: sharedPerson('r.user_id','r.event_id'), ownerLink: 'registration_user_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'registration_id')] },
  { table: 'offer_status_history', from: `offer_status_history t JOIN offers o ON o.id=t.offer_id
    JOIN registrations r ON r.id=o.registration_id`,
    where: sharedPerson('r.user_id','r.event_id'), ownerLink: 'offer_registration_user_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'offer_id')] },
  { table: 'reservations', from: 'reservations t', where: sharedPerson('t.claimed_by','t.event_id'), ownerLink: 'claimed_by_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'claimed_by', 'token')] },
  { table: 'share_intents', from: 'share_intents t', where: sharedPerson('t.sender_id','t.event_id'), ownerLink: 'sender_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'sender_id', 'source_token', 'invite_token_hash')] },
  { table: 'share_opens', from: 'share_opens t', where: sharedPerson('t.user_id','t.event_id'), ownerLink: 'user_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id', 'source_token', 'invite_token_hash')] },
  { table: 'invite_unknown_opens', from: 'invite_unknown_opens t', where: sharedPerson('t.user_id','t.event_id'), ownerLink: 'user_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id', 'invite_token_hash')] },
  { table: 'cohost_grants', from: 'cohost_grants t',
    where: `${sharedPerson('t.user_id','t.event_id')} OR ${sharedPerson('t.granted_by','t.event_id')}`, ownerLink: 'user_id_or_granted_by_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id', 'granted_by')] },
  { table: 'expense_ledgers', from: 'expense_ledgers t', where: sharedPerson('t.created_by','t.event_id'), ownerLink: 'created_by_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'created_by')] },
  { table: 'expense_shares', from: 'expense_shares t JOIN expense_ledgers l ON l.id=t.ledger_id',
    where: sharedPerson('t.user_id','l.event_id'), ownerLink: 'user_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id')] },
  { table: 'reports', from: 'reports t', where: historicallyReported('t'), ownerLink: 'reporter_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'reporter_id'), ...fields('FREE_TEXT', 'description', 'resolution')] },
  { table: 'appeals', from: 'appeals t', where: disputePerson('t.appellant_id'), ownerLink: 'appellant_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'appellant_id'), ...fields('FREE_TEXT', 'description', 'resolution')] },
  { table: 'outcome_reviews', from: 'outcome_reviews t',
    where: `EXISTS (SELECT 1 FROM reports r WHERE r.id=t.report_id AND ${historicallyReported('r')})`, ownerLink: 'reported_dispute',
    fields: [...fields('FREE_TEXT', 'reason')] },
  { table: 'report_assignments', from: 'report_assignments t',
    where: `EXISTS (SELECT 1 FROM reports r WHERE r.id=t.report_id AND ${historicallyReported('r')})`, ownerLink: 'reported_dispute',
    fields: [...fields('FREE_TEXT', 'assignment_reason')] },
  { table: 'outcomes', from: 'outcomes t', where: sharedPerson('t.completed_by','t.event_id'), ownerLink: 'completed_by_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'completed_by'), ...fields('JSON', 'issues')] },
  { table: 'outcome_feedback', from: 'outcome_feedback t', where: sharedPerson('t.user_id','t.event_id'), ownerLink: 'user_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id'), ...fields('FREE_TEXT', 'reason')] },
  { table: 'registration_removals', from: 'registration_removals t',
    where: `${sharedPerson('t.user_id','t.event_id')} OR ${sharedPerson('t.removed_by','t.event_id')}`,
    ownerLink: 'user_id_or_removed_by_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id', 'removed_by'), ...fields('FREE_TEXT', 'reason')] },
  { table: 'checkins', from: 'checkins t', where: sharedPerson('t.user_id','t.event_id'), ownerLink: 'user_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id'), ...fields('FREE_TEXT', 'evidence')] },
  { table: 'manual_checkins', from: 'manual_checkins t',
    where: `${sharedPerson('t.user_id','t.event_id')} OR ${sharedPerson('t.requested_by','t.event_id')}`,
    ownerLink: 'user_id_or_requested_by_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id', 'requested_by')] },
  { table: 'notifications', from: 'notifications t', where: notificationRecipient('t.user_id'),
    ownerLink: 'user_id_or_expiry_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id'), ...fields('JSON', 'detail'),
      ...fields('EXTERNAL_DELIVERY', 'provider_ref', 'external_failure_code', 'external_dispatch_token',
        'external_status', 'external_purpose', 'external_channel', 'template_slot', 'external_scheduled_at',
        'external_dispatch_started_at', 'provider_responded_at')] },
  { table: 'notification_followups', from: 'notification_followups t',
    where: `EXISTS (SELECT 1 FROM notifications n WHERE n.id=t.notification_id
      AND ${notificationRecipient('n.user_id')})`, ownerLink: 'recipient_notification_or_expiry_tombstone',
    fields: [...fields('FREE_TEXT', 'note')] },
  { table: 'notification_consents', from: 'notification_consents t', where: 't.user_id=$1', ownerLink: 'user_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id'), ...fields('CONSENT', 'purpose', 'scope', 'notice_version')] },
  { table: 'notification_consent_history', from: 'notification_consent_history t', where: 't.user_id=$1', ownerLink: 'user_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id'), ...fields('CONSENT', 'purpose', 'scope', 'notice_version', 'notice_text')] },
  { table: 'event_aliases', from: 'event_aliases t', where: 't.user_id=$1', ownerLink: 'user_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id'), ...fields('FREE_TEXT', 'display_name')] },
  { table: 'event_alias_consent_history', from: 'event_alias_consent_history t',
    where: sharedPerson('t.user_id','t.event_id'), ownerLink: 'user_id_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id'), ...fields('CONSENT', 'scope', 'notice_version', 'notice_text')] },
  { table: 'user_blocks', from: 'user_blocks t', where: 't.blocker_id=$1 OR t.blocked_id=$1', ownerLink: 'blocker_id_or_blocked_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'blocker_id', 'blocked_id')] },
  { table: 'venue_evidence', from: 'venue_evidence t', where: sharedPerson('t.recorded_by','t.event_id'), ownerLink: 'recorded_by_or_deletion_tombstone',
    fields: [...fields('DIRECT_IDENTIFIER', 'recorded_by'), ...fields('FREE_TEXT', 'venue_name')] },
  { table: 'ai_draft_requests', from: 'ai_draft_requests t', where: 't.actor_id=$1', ownerLink: 'actor_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'actor_id'), ...fields('AI_RECORD', 'request_key', 'request_hash'),
      ...fields('JSON', 'result')] },
  { table: 'ai_draft_alert_reviews', from: 'ai_draft_alert_reviews t', where: 't.actor_id=$1', ownerLink: 'actor_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'actor_id'), ...fields('AI_RECORD', 'request_key'), ...fields('FREE_TEXT', 'note')] },
  { table: 'ai_semantic_requests', from: 'ai_semantic_requests t', where: 't.actor_id=$1', ownerLink: 'actor_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'actor_id'), ...fields('AI_RECORD', 'request_key', 'fallback_key', 'request_hash'),
      ...fields('JSON', 'provider_evidence', 'result')] },
  { table: 'ai_semantic_alert_reviews', from: 'ai_semantic_alert_reviews t', where: 't.actor_id=$1', ownerLink: 'actor_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'actor_id'), ...fields('AI_RECORD', 'request_key'), ...fields('FREE_TEXT', 'note')] },
  { table: 'ai_action_proposals', from: 'ai_action_proposals t', where: 't.actor_id=$1', ownerLink: 'actor_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'actor_id'), ...fields('JSON', 'payload', 'receipt')] },
  { table: 'audit', from: 'audit t', where: 't.actor_id=$1', ownerLink: 'actor_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'actor_id'), ...fields('AUDIT_REPLAY', 'detail')] },
  { table: 'idempotency', from: 'idempotency t', where: 't.actor_id=$1', ownerLink: 'actor_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'actor_id'), ...fields('AUDIT_REPLAY', 'key', 'result', 'request_hash')] },
  { table: 'privacy_requests', from: 'privacy_requests t', where: 't.user_id=$1', ownerLink: 'user_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id')] },
  { table: 'personal_export_tickets', from: 'personal_export_tickets t', where: 't.user_id=$1', ownerLink: 'user_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id')] },
  { table: 'privacy_deletion_executions', from: 'privacy_deletion_executions t', where: 't.user_id=$1', ownerLink: 'user_id',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id'), ...fields('JSON', 'outcomes')] },
  { table: 'privacy_quarantine', from: 'privacy_quarantine t',
    where: 'EXISTS (SELECT 1 FROM privacy_requests p WHERE p.id=t.request_id AND p.user_id=$1)', ownerLink: 'deletion_request',
    fields: [...fields('JSON', 'payload')] },
  { table: 'jobs', from: 'jobs t', where: "t.payload->>'userId'=$1", ownerLink: 'payload_userId_only',
    fields: [...fields('JSON', 'payload')] },
  { table: 'business_events', from: 'business_events t',
    where: 'EXISTS (SELECT 1 FROM audit a WHERE a.id=t.event_uuid AND a.actor_id=$1)', ownerLink: 'actor_audit',
    fields: [...fields('DIRECT_IDENTIFIER', 'user_id_pseudonymous')] }
];

const unknownClasses = [
  { code: 'OPAQUE_EMBEDDED_IDENTIFIERS', scope: 'unmatched free text and nested JSON values', reason: 'Structured owner links cannot count identifiers embedded in content' },
  { code: 'PROVIDER_COPIES', scope: 'WeChat and other processors', reason: 'External copies and receipts require provider evidence' },
  { code: 'BACKUP_COPIES', scope: 'historical backups and restored snapshots', reason: 'Production backup inventory and marker replay evidence are external' },
  { code: 'INFRASTRUCTURE_LOGS', scope: 'proxy, application and monitoring logs', reason: 'Not represented by these database queries' },
  { code: 'UNMAPPED_SCHEMA_FIELDS', scope: 'other or future columns', reason: 'This selected field manifest is not an exhaustive schema/content scan' }
] as const;

export async function inspectPrivacyFields(tx: Queryable, actor: string) {
  const rows = [] as Array<{ table: string; column: string; class: FieldClass; ownerLink: string; populatedRows: number }>;
  for (const group of groups) {
    const projections = group.fields.map((field, index) => `count(t.${field.column})::int AS c${index}`).join(',');
    const { rows: counts } = await tx.query<Record<string, number>>(
      `SELECT ${projections} FROM ${group.from} WHERE ${group.where}`, [actor]);
    group.fields.forEach((field, index) => rows.push({ table: group.table, column: field.column,
      class: field.class, ownerLink: group.ownerLink, populatedRows: counts[0]?.[`c${index}`] ?? 0 }));
  }
  return { scope: 'SELECTED_STRUCTURED_OWNER_LINKS',
    countMeaning: 'NON_NULL_ROWS_MATCHING_STRUCTURED_OWNER_LINK', fields: rows,
    unknownClasses } as const;
}
