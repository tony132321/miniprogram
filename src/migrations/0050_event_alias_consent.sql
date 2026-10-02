-- Existing nicknames predate versioned disclosure. Keep their records, but
-- require their owners to reconfirm before any nickname is shown to members.
ALTER TABLE event_aliases ADD COLUMN notice_version text;

CREATE TABLE event_alias_consent_history (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  user_id text NOT NULL,
  purpose text NOT NULL CHECK (purpose='EVENT_MEMBER_DISPLAY'),
  scope text NOT NULL,
  notice_version text NOT NULL,
  notice_text text NOT NULL,
  granted boolean NOT NULL,
  source text NOT NULL DEFAULT 'USER' CHECK (source IN ('USER','DELETE_REQUEST')),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX event_alias_consent_history_owner_time
  ON event_alias_consent_history(user_id,changed_at,id);
