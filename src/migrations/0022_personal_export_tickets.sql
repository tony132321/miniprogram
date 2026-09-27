CREATE TABLE personal_export_tickets (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX personal_export_tickets_owner_expiry ON personal_export_tickets(user_id,expires_at);
