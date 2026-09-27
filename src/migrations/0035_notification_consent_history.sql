CREATE TABLE notification_consent_history (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  purpose text NOT NULL,
  scope text NOT NULL,
  notice_version text NOT NULL,
  notice_text text NOT NULL,
  granted boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX notification_consent_history_owner_time
  ON notification_consent_history(user_id,changed_at,id);
