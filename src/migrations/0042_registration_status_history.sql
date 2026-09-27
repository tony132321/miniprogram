CREATE TABLE registration_status_history (
  id bigserial PRIMARY KEY,
  registration_id text NOT NULL REFERENCES registrations(id) ON UPDATE CASCADE,
  status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  legacy_snapshot boolean NOT NULL DEFAULT false
);
CREATE INDEX registration_status_history_registration_time
  ON registration_status_history(registration_id,changed_at DESC,id DESC);

-- An existing registration has no trustworthy earlier status transitions.
INSERT INTO registration_status_history(registration_id,status,changed_at,legacy_snapshot)
SELECT id,status,clock_timestamp(),true FROM registrations;

CREATE FUNCTION record_registration_status_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  INSERT INTO registration_status_history(registration_id,status) VALUES(NEW.id,NEW.status);
  RETURN NEW;
END;
$$;
CREATE TRIGGER registrations_status_history AFTER INSERT OR UPDATE OF status ON registrations
FOR EACH ROW EXECUTE FUNCTION record_registration_status_history();
