CREATE TABLE privacy_quarantine (
  request_id text NOT NULL REFERENCES privacy_requests(id),
  source_table text NOT NULL,
  source_id text NOT NULL,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  legal_basis text NOT NULL,
  access_roles text[] NOT NULL,
  isolated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (request_id,source_table,source_id)
);
