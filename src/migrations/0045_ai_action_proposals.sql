CREATE TABLE ai_action_proposals (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL,
  event_id text NOT NULL REFERENCES events(id),
  kind text NOT NULL CHECK (kind IN ('SAVE_DRAFT','PUBLISH_EVENT')),
  expected_version integer NOT NULL CHECK (expected_version > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('PROPOSED','APPROVED','REVOKED','SUCCEEDED')),
  expires_at timestamptz NOT NULL,
  approved_at timestamptz,
  revoked_at timestamptz,
  executed_at timestamptz,
  action_id uuid UNIQUE,
  receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status='SUCCEEDED') = (action_id IS NOT NULL AND receipt IS NOT NULL))
);
CREATE INDEX ai_action_proposals_actor_pending ON ai_action_proposals(actor_id,expires_at)
  WHERE status IN ('PROPOSED','APPROVED');
