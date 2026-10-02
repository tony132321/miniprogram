CREATE TABLE privacy_ordinary_profile_expiries (
  request_id text PRIMARY KEY REFERENCES privacy_requests(id),
  user_id text NOT NULL,
  recipient_tombstone text NOT NULL UNIQUE,
  policy_sha256 text NOT NULL CHECK (policy_sha256 ~ '^[a-f0-9]{64}$'),
  marker_recorded_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  disposition_counts jsonb NOT NULL CHECK (jsonb_typeof(disposition_counts)='object'),
  performed_by text NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (expires_at > marker_recorded_at)
);
CREATE INDEX privacy_ordinary_profile_expiries_user
  ON privacy_ordinary_profile_expiries(user_id,performed_at);

-- A detached notification recipient must never become a live account later.
ALTER TABLE users ADD CONSTRAINT users_no_notification_tombstone
  CHECK (id !~ '^deleted:notification:');

-- Row locks serialize ordinary expiry with late writes. Keep ledger lookups
-- after the lock, so a writer waiting for expiry observes its committed row.
CREATE FUNCTION guard_ordinary_profile_notification_write() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE owner_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM id FROM users WHERE id = NEW.user_id FOR SHARE;
    IF NEW.user_id ~ '^deleted:notification:' OR EXISTS (
      SELECT 1 FROM privacy_ordinary_profile_expiries
      WHERE user_id = NEW.user_id OR recipient_tombstone = NEW.user_id) THEN
      RAISE EXCEPTION 'expired ordinary profile notification recipient cannot be recreated';
    END IF;
    RETURN NEW;
  END IF;

  PERFORM id FROM users WHERE id IN (OLD.user_id, NEW.user_id) ORDER BY id FOR SHARE;
  SELECT user_id INTO owner_id FROM privacy_ordinary_profile_expiries
    WHERE user_id IN (OLD.user_id, NEW.user_id)
       OR recipient_tombstone IN (OLD.user_id, NEW.user_id) LIMIT 1;
  IF owner_id IS NOT NULL AND
    (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.detail IS DISTINCT FROM '{}'::jsonb) THEN
    RAISE EXCEPTION 'expired ordinary profile notification fields cannot be restored';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ordinary_profile_notification_write_guard
BEFORE INSERT OR UPDATE ON notifications FOR EACH ROW
EXECUTE FUNCTION guard_ordinary_profile_notification_write();

CREATE FUNCTION guard_ordinary_profile_consent_write() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM users WHERE id = NEW.user_id FOR SHARE;
  IF EXISTS (SELECT 1 FROM privacy_ordinary_profile_expiries WHERE user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'expired ordinary profile notification consent cannot be recreated';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ordinary_profile_consent_write_guard
BEFORE INSERT OR UPDATE ON notification_consents FOR EACH ROW
EXECUTE FUNCTION guard_ordinary_profile_consent_write();
