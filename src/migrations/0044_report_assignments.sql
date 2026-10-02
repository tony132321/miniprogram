CREATE TABLE report_assignments (
  report_id text PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  assignee_id text NOT NULL,
  assigned_by text NOT NULL,
  assignment_reason text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (left(assignee_id,9)='operator:'),
  CHECK (char_length(assignment_reason) BETWEEN 5 AND 500),
  CHECK (assigned_by<>assignee_id)
);
CREATE INDEX report_assignments_assignee ON report_assignments(assignee_id,report_id);
