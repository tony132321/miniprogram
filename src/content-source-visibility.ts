// A content review does not approve the activity version it was written for.
// Legacy INVITE versions published before migration 48 remain readable, but
// content added to that version after the migration still awaits activity review.
const migration48 = '(SELECT applied_at FROM schema_migrations WHERE version=48)';

export function reviewedActivityContentSql(alias: 'a' | 'c'): string {
  return `(EXISTS (SELECT 1 FROM event_review_decisions d WHERE d.event_id=${alias}.event_id
      AND d.event_version=${alias}.event_version AND d.decision='APPROVED') OR
    (${alias}.created_at<${migration48} AND EXISTS (SELECT 1 FROM event_versions v
      WHERE v.event_id=${alias}.event_id AND v.version=${alias}.event_version
        AND v.payload->>'visibility'='INVITE' AND v.created_at<${migration48})))`;
}

export function actorReadableActivityContentSql(alias: 'a' | 'c', actorParameter: string): string {
  return `(${alias}.author_id=${actorParameter} OR EXISTS (SELECT 1 FROM events e
    WHERE e.id=${alias}.event_id AND e.host_id=${actorParameter}) OR ${reviewedActivityContentSql(alias)})`;
}
