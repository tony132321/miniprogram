ALTER TABLE reports ADD COLUMN resolution text;
ALTER TABLE reports ADD COLUMN resolved_by text;
ALTER TABLE reports ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE notifications ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE notifications ADD CONSTRAINT notifications_account_scope CHECK (
  event_id IS NOT NULL OR (kind IN ('REPORT_IN_REVIEW', 'REPORT_RESOLVED') AND event_version = 0)
);
