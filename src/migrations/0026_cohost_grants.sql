CREATE TABLE IF NOT EXISTS cohost_grants (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  user_id text NOT NULL,
  granted_by text NOT NULL,
  capabilities text[] NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cohost_grants_capabilities_nonempty CHECK (cardinality(capabilities)>0)
);

CREATE UNIQUE INDEX IF NOT EXISTS cohost_grants_one_active_user_per_event
  ON cohost_grants(event_id,user_id) WHERE revoked_at IS NULL;
