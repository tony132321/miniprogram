ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS issues jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(issues) = 'array');
