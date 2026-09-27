CREATE TABLE event_status_history (
  id bigserial PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  legacy_snapshot boolean NOT NULL DEFAULT false
);
CREATE INDEX event_status_history_event_time ON event_status_history(event_id,changed_at DESC,id DESC);

-- The current state of an existing event is known only at upgrade time.
INSERT INTO event_status_history(event_id,status,changed_at,legacy_snapshot)
SELECT id,status,clock_timestamp(),true FROM events;

CREATE FUNCTION record_event_status_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  INSERT INTO event_status_history(event_id,status) VALUES(NEW.id,NEW.status);
  RETURN NEW;
END;
$$;
CREATE TRIGGER events_status_history AFTER INSERT OR UPDATE OF status ON events
FOR EACH ROW EXECUTE FUNCTION record_event_status_history();
