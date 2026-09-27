CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  host_id text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL,
  payload jsonb NOT NULL,
  recruiting boolean NOT NULL DEFAULT false,
  invite_token text UNIQUE,
  invite_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  wechat_openid text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS event_versions (
  event_id text NOT NULL REFERENCES events(id),
  version integer NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, version)
);
CREATE TABLE IF NOT EXISTS share_intents (
  source_token text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  sender_id text NOT NULL,
  invite_token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS share_opens (
  source_token text NOT NULL,
  event_id text NOT NULL REFERENCES events(id),
  invite_token_hash text NOT NULL,
  user_id text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_token,user_id,invite_token_hash)
);
CREATE TABLE IF NOT EXISTS idempotency (
  actor_id text NOT NULL,
  route text NOT NULL,
  key text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, route, key)
);
CREATE TABLE IF NOT EXISTS registrations (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  user_id text NOT NULL,
  status text NOT NULL,
  accepted_version integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE TABLE IF NOT EXISTS reservations (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  claimed_by text,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS offers (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  registration_id text NOT NULL REFERENCES registrations(id),
  expires_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  user_id text NOT NULL,
  kind text NOT NULL,
  event_version integer NOT NULL,
  status text NOT NULL DEFAULT 'IN_APP',
  read_at timestamptz,
  external_status text NOT NULL DEFAULT 'NOT_REQUESTED',
  provider_ref text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS external_status text NOT NULL DEFAULT 'NOT_REQUESTED';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS provider_ref text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS one_start_reminder_per_version ON notifications(event_id,user_id,kind,event_version)
  WHERE kind='EVENT_REMINDER';
CREATE TABLE IF NOT EXISTS notification_consents (
  user_id text NOT NULL,
  purpose text NOT NULL,
  granted boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,purpose)
);
CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  kind text NOT NULL,
  event_id text REFERENCES events(id),
  due_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit (
  id text PRIMARY KEY,
  actor_id text NOT NULL,
  event_id text,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS checkins (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  user_id text NOT NULL,
  evidence text NOT NULL,
  checked_at timestamptz NOT NULL,
  disputed boolean NOT NULL DEFAULT false,
  UNIQUE (event_id,user_id)
);
CREATE TABLE IF NOT EXISTS manual_checkins (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  user_id text NOT NULL,
  requested_by text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','REJECTED','SUPERSEDED')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (event_id,user_id)
);
CREATE TABLE IF NOT EXISTS outcomes (
  event_id text PRIMARY KEY REFERENCES events(id),
  held boolean NOT NULL,
  actual_count integer NOT NULL,
  completed_by text NOT NULL,
  completed_at timestamptz NOT NULL,
  disputed boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS outcome_feedback (
  event_id text NOT NULL REFERENCES events(id),
  user_id text NOT NULL,
  held boolean NOT NULL,
  would_repeat boolean NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id,user_id)
);
CREATE TABLE IF NOT EXISTS expense_ledgers (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  total_fen integer NOT NULL CHECK(total_fen >= 0),
  status text NOT NULL DEFAULT 'RECORD_ONLY',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS expense_shares (
  ledger_id text NOT NULL REFERENCES expense_ledgers(id),
  user_id text NOT NULL,
  amount_fen integer NOT NULL CHECK(amount_fen >= 0),
  participant_handled boolean NOT NULL DEFAULT false,
  host_received boolean NOT NULL DEFAULT false,
  PRIMARY KEY (ledger_id,user_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id text PRIMARY KEY,
  reporter_id text NOT NULL,
  event_id text REFERENCES events(id),
  kind text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS registration_removals (
  id text PRIMARY KEY,
  registration_id text NOT NULL UNIQUE REFERENCES registrations(id),
  event_id text NOT NULL REFERENCES events(id),
  user_id text NOT NULL,
  removed_by text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS privacy_requests (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS appeals (
  id text PRIMARY KEY,
  report_id text REFERENCES reports(id),
  removal_id text REFERENCES registration_removals(id),
  appellant_id text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  resolution text,
  resolved_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((report_id IS NOT NULL) <> (removal_id IS NOT NULL))
);
ALTER TABLE appeals ALTER COLUMN report_id DROP NOT NULL;
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS removal_id text REFERENCES registration_removals(id);
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS resolution text;
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS resolved_by text;
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS activity_content (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  author_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ANNOUNCEMENT','QUESTION','ANSWER')),
  parent_id text REFERENCES activity_content(id),
  body text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW','APPROVED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  moderated_by text,
  moderated_at timestamptz
);
CREATE TABLE IF NOT EXISTS activity_fact_todos (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  event_version integer NOT NULL,
  requester_id text NOT NULL,
  question_text text NOT NULL,
  question_content_id text NOT NULL UNIQUE REFERENCES activity_content(id),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE activity_fact_todos ADD COLUMN IF NOT EXISTS question_text text;
UPDATE activity_fact_todos t SET question_text=c.body FROM activity_content c
  WHERE c.id=t.question_content_id AND t.question_text IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_fact_todo_per_question ON activity_fact_todos(event_id,event_version,requester_id,question_text);
