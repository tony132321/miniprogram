CREATE TABLE ai_semantic_requests (
  actor_id text NOT NULL,
  event_id text NOT NULL REFERENCES events(id),
  request_key text NOT NULL,
  fallback_key text NOT NULL UNIQUE,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('STARTED','COMPLETED','UNKNOWN')),
  budget_fen integer NOT NULL CHECK (budget_fen >= 0),
  reserved_fen integer NOT NULL CHECK (reserved_fen >= 0),
  known_cost_fen integer NOT NULL DEFAULT 0 CHECK (known_cost_fen >= 0),
  cost_status text CHECK (cost_status IN ('KNOWN','LOWER_BOUND','UNKNOWN')),
  provider_evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(provider_evidence)='array'),
  fallback_reason text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  PRIMARY KEY (actor_id,request_key),
  CHECK ((status='COMPLETED') = (result IS NOT NULL))
);
CREATE INDEX ai_semantic_requests_event_budget ON ai_semantic_requests(event_id);
CREATE INDEX ai_semantic_requests_pending ON ai_semantic_requests(created_at)
  WHERE status IN ('STARTED','UNKNOWN') OR cost_status IN ('LOWER_BOUND','UNKNOWN');
