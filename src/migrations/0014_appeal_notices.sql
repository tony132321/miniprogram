ALTER TABLE notifications DROP CONSTRAINT notifications_account_scope;
ALTER TABLE notifications ADD CONSTRAINT notifications_account_scope CHECK (
  event_id IS NOT NULL OR (kind IN ('REPORT_IN_REVIEW', 'REPORT_RESOLVED', 'APPEAL_IN_REVIEW', 'APPEAL_RESOLVED') AND event_version = 0)
);

WITH resolved_audit AS (
  SELECT DISTINCT ON (detail->>'reportId') detail->>'reportId' AS report_id,actor_id
  FROM audit
  WHERE action='REPORT_STATUS' AND detail->>'status'='RESOLVED' AND detail->>'reportId' IS NOT NULL
  ORDER BY detail->>'reportId',created_at DESC,id DESC
)
UPDATE reports r SET resolved_by=a.actor_id FROM resolved_audit a
WHERE r.id=a.report_id AND r.status='RESOLVED' AND r.resolved_by IS NULL;
