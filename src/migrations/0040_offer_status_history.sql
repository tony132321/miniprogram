CREATE TABLE offer_status_history (
  id bigserial PRIMARY KEY,
  offer_id text NOT NULL REFERENCES offers(id),
  status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  legacy_snapshot boolean NOT NULL DEFAULT false
);
CREATE INDEX offer_status_history_offer_time ON offer_status_history(offer_id,changed_at DESC,id DESC);

-- Existing offers have no reliable historical transition times. Record only their state at migration time.
INSERT INTO offer_status_history(offer_id,status,changed_at,legacy_snapshot)
SELECT id,status,clock_timestamp(),true FROM offers;

CREATE FUNCTION record_offer_status_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  INSERT INTO offer_status_history(offer_id,status) VALUES(NEW.id,NEW.status);
  RETURN NEW;
END;
$$;
CREATE TRIGGER offers_status_history AFTER INSERT OR UPDATE OF status ON offers
FOR EACH ROW EXECUTE FUNCTION record_offer_status_history();
