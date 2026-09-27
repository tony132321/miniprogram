CREATE TABLE user_blocks (
  id text PRIMARY KEY,
  blocker_id text NOT NULL,
  blocked_id text NOT NULL,
  event_id text NOT NULL REFERENCES events(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);
CREATE UNIQUE INDEX user_blocks_active_pair ON user_blocks(blocker_id,blocked_id) WHERE revoked_at IS NULL;
CREATE INDEX user_blocks_target_active ON user_blocks(blocked_id,blocker_id) WHERE revoked_at IS NULL;
