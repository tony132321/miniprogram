-- Suppress newly materialized notices for a person whose DELETE request is
-- active or whose account is no longer active. Existing notices remain for
-- the separately reviewed retention disposition.
CREATE FUNCTION notification_deletion_recipient_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE recipient_status text;
BEGIN
  SELECT status INTO recipient_status FROM users WHERE id=NEW.user_id FOR SHARE;
  IF recipient_status IS NOT NULL AND recipient_status <> 'ACTIVE' THEN RETURN NULL; END IF;
  PERFORM id FROM privacy_requests WHERE user_id=NEW.user_id AND kind='DELETE'
    AND status NOT IN ('FULFILLED','CANCELLED') LIMIT 1 FOR SHARE;
  IF FOUND THEN RETURN NULL; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notification_deletion_recipient_guard_before_insert
BEFORE INSERT ON notifications FOR EACH ROW
EXECUTE FUNCTION notification_deletion_recipient_guard();
