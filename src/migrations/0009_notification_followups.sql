CREATE TABLE notification_followups (
  notification_id text PRIMARY KEY REFERENCES notifications(id),
  recorded_by text NOT NULL,
  note text NOT NULL CHECK (char_length(btrim(note)) BETWEEN 5 AND 500),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jobs_external_notification_id_idx ON jobs ((payload->>'notificationId')) WHERE kind='SEND_EXTERNAL';
