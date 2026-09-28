CREATE TABLE host_publication_status (
  host_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ESTABLISHED')),
  reviewed_by text,
  reviewed_at timestamptz,
  reason text
);
