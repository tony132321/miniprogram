INSERT INTO jobs(id,kind,event_id,due_at,payload)
SELECT 'event-start-v27-' || id,'EVENT_START',id,(payload->>'startAt')::timestamptz,
  jsonb_build_object('version',version)
FROM events
WHERE status='CONFIRMED' AND payload ? 'startAt'
ON CONFLICT (id) DO NOTHING;
