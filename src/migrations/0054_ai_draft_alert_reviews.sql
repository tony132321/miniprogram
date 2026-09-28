CREATE TABLE ai_draft_alert_reviews (
  actor_id text NOT NULL,
  request_key text NOT NULL,
  alert_state text NOT NULL CHECK (alert_state ~ '^[a-f0-9]{32}$'),
  status_at_review text NOT NULL,
  cost_status_at_review text,
  reserved_fen_at_review integer NOT NULL CHECK (reserved_fen_at_review >= 0),
  known_cost_fen_at_review integer CHECK (known_cost_fen_at_review >= 0),
  reviewed_by text NOT NULL,
  note text NOT NULL CHECK (char_length(note) BETWEEN 5 AND 500),
  reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (actor_id,request_key,alert_state),
  FOREIGN KEY (actor_id,request_key) REFERENCES ai_draft_requests(actor_id,request_key)
);
CREATE INDEX ai_draft_alert_reviews_time ON ai_draft_alert_reviews(reviewed_at DESC,actor_id,request_key);
