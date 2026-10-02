CREATE TABLE privacy_deletion_executions (
  request_id text PRIMARY KEY REFERENCES privacy_requests(id),
  user_id text NOT NULL,
  policy_sha256 text NOT NULL CHECK (policy_sha256 ~ '^[a-f0-9]{64}$'),
  outcomes jsonb NOT NULL CHECK (jsonb_typeof(outcomes)='object'),
  applied_by text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
