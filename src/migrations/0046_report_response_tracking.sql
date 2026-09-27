ALTER TABLE reports ADD COLUMN severity text NOT NULL DEFAULT 'UNCLASSIFIED'
  CHECK (severity IN ('UNCLASSIFIED','HIGH','NORMAL'));
ALTER TABLE reports ADD COLUMN first_response_target_minutes integer
  CHECK (first_response_target_minutes BETWEEN 1 AND 10080);
ALTER TABLE reports ADD COLUMN first_response_due_at timestamptz;
ALTER TABLE reports ADD COLUMN first_responded_at timestamptz;
ALTER TABLE reports ADD COLUMN first_responded_by text;
ALTER TABLE reports ADD COLUMN first_response_state text NOT NULL DEFAULT 'PENDING'
  CHECK (first_response_state IN ('PENDING','RECORDED','LEGACY_UNKNOWN'));
UPDATE reports SET first_response_state='LEGACY_UNKNOWN' WHERE status<>'OPEN';
ALTER TABLE reports ADD CONSTRAINT report_response_target_pair
  CHECK ((first_response_target_minutes IS NULL) = (first_response_due_at IS NULL));
ALTER TABLE reports ADD CONSTRAINT report_first_response_pair
  CHECK ((first_responded_at IS NULL) = (first_responded_by IS NULL));
ALTER TABLE reports ADD CONSTRAINT report_first_response_state_consistent
  CHECK ((first_response_state='RECORDED') = (first_responded_at IS NOT NULL));
CREATE INDEX report_first_response_attention
  ON reports(first_response_due_at,id) WHERE first_response_state='PENDING' AND status <> 'RESOLVED';
