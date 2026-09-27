CREATE TABLE IF NOT EXISTS wechat_login_exchanges (
  code_hash text PRIMARY KEY,
  exchanged_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wechat_login_exchanges_exchanged_at_idx
  ON wechat_login_exchanges(exchanged_at);
