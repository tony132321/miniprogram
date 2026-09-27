CREATE TABLE event_safety_holds (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  status text NOT NULL CHECK (status IN ('ACTIVE','RELEASED')),
  reason text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_by text,
  release_reason text,
  released_at timestamptz
);
CREATE UNIQUE INDEX one_active_safety_hold_per_event ON event_safety_holds(event_id) WHERE status='ACTIVE';
