CREATE TABLE event_aliases (
  event_id text NOT NULL REFERENCES events(id),
  user_id text NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 24),
  consented_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id,user_id)
);
