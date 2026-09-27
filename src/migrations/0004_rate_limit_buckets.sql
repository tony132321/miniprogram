CREATE TABLE rate_limit_buckets (
  scope text NOT NULL,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, window_start)
);
CREATE INDEX rate_limit_violation_review ON rate_limit_buckets(window_start DESC) WHERE rejected_count>0;
CREATE INDEX rate_limit_expiry ON rate_limit_buckets(window_start);
