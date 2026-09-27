CREATE TABLE venue_evidence (
  event_id text NOT NULL REFERENCES events(id),
  event_version integer NOT NULL CHECK (event_version > 0),
  venue_name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('HOST_STATEMENT')),
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (event_id,event_version)
);
