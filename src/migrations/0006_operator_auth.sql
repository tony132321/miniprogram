CREATE TABLE operator_otp_uses (
  operator_id text PRIMARY KEY,
  last_counter bigint NOT NULL
);

CREATE TABLE operator_sessions (
  token_hash text PRIMARY KEY,
  operator_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX operator_sessions_expiry_idx ON operator_sessions(expires_at);
