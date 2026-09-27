CREATE TABLE support_minutes (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  recorded_by text NOT NULL,
  category text NOT NULL CHECK (category IN ('SUPPORT','SAFETY','REVIEW')),
  minutes integer NOT NULL CHECK (minutes BETWEEN 0 AND 1440),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_minutes_event_time ON support_minutes(event_id,recorded_at);
