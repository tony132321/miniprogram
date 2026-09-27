CREATE TABLE ai_draft_requests (
  actor_id text NOT NULL,
  request_key text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('STARTED','COMPLETED','UNKNOWN')),
  budget_fen integer NOT NULL CHECK (budget_fen >= 0),
  known_cost_fen integer CHECK (known_cost_fen >= 0),
  cost_status text CHECK (cost_status IN ('KNOWN','LOWER_BOUND','UNKNOWN')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  PRIMARY KEY (actor_id,request_key),
  CHECK ((status='COMPLETED') = (result IS NOT NULL))
);
CREATE INDEX ai_draft_requests_pending ON ai_draft_requests(created_at)
  WHERE status IN ('STARTED','UNKNOWN');
