CREATE TABLE outcome_reviews (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  report_id text NOT NULL UNIQUE REFERENCES reports(id),
  decision text NOT NULL CHECK (decision IN ('HELD_CONFIRMED','NOT_HELD_CONFIRMED','INCONCLUSIVE')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 1000),
  reviewed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX outcome_reviews_event_time ON outcome_reviews(event_id,created_at DESC,id DESC);
