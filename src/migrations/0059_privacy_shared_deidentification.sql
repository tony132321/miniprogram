CREATE TABLE privacy_shared_deidentifications (
  request_id text PRIMARY KEY REFERENCES privacy_requests(id),
  user_id text NOT NULL,
  affected_events integer NOT NULL CHECK (affected_events >= 0),
  structured_links integer NOT NULL CHECK (structured_links >= 0),
  performed_by text NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
