CREATE UNIQUE INDEX IF NOT EXISTS one_outcome_prompt_per_version
  ON notifications(event_id,user_id,kind,event_version)
  WHERE kind IN ('EVENT_OUTCOME_DUE','EVENT_OUTCOME_REVIEW');

INSERT INTO jobs(id,kind,event_id,due_at,payload)
SELECT 'event-end-v29-' || id,'EVENT_END',id,(payload->>'endAt')::timestamptz,
  jsonb_build_object('version',version)
FROM events
WHERE status IN ('CONFIRMED','IN_PROGRESS') AND payload ? 'endAt'
ON CONFLICT (id) DO NOTHING;
