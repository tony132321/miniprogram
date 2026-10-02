CREATE TABLE privacy_shared_event_tombstones (
  request_id text NOT NULL REFERENCES privacy_requests(id),
  event_id text NOT NULL REFERENCES events(id),
  tombstone_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (request_id,event_id),
  UNIQUE (event_id,tombstone_id)
);

CREATE FUNCTION protect_privacy_deletion_intent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.kind='DELETE' AND (
      (OLD.status='EXECUTION_INTENT_RECORDED' AND NEW.status IN ('CANCELLED','FULFILLED')) OR
      (OLD.status='SAFEGUARDS_APPLIED_PENDING_REVIEW' AND NEW.status='CANCELLED')) THEN
    RAISE EXCEPTION 'durable deletion execution intent cannot be cancelled or fulfilled directly';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER privacy_deletion_intent_guard BEFORE UPDATE OF status ON privacy_requests
FOR EACH ROW EXECUTE FUNCTION protect_privacy_deletion_intent();
