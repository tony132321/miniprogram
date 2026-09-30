-- A provider's explicit acceptance is an activity-scoped success fact, not
-- proof that the member received or read the subscription message. Keep the
-- existing aggregate transition stream unchanged. No historical backfill:
-- old rows cannot prove the event version and recipient at acceptance time.
-- Keep the deduplication key in the operational database. The analytics
-- pseudonym salt may rotate, but that must never recount an accepted notice.
CREATE TABLE notification_provider_accepted_event_keys (
  notification_id text PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
  event_uuid text NOT NULL UNIQUE
);

CREATE FUNCTION record_notification_provider_accepted_business_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  identity_salt text;
  accepted_event_uuid text;
  test_scope boolean;
BEGIN
  IF NEW.event_id IS NULL OR NEW.event_version <= 0 OR
     NEW.external_status <> 'PROVIDER_ACCEPTED' OR
     OLD.external_status NOT IN ('DISPATCHING','UNKNOWN_REQUIRES_RECONCILIATION') OR
     NEW.provider_ref IS NULL OR btrim(NEW.provider_ref)='' OR
     NEW.provider_responded_at IS NULL OR
     NEW.provider_responded_at IS NOT DISTINCT FROM OLD.provider_responded_at THEN
    RETURN NEW;
  END IF;

  SELECT salt INTO STRICT identity_salt FROM business_event_identity_salt WHERE singleton=true;
  SELECT is_test INTO STRICT test_scope FROM events WHERE id=NEW.event_id;
  -- The notification row lock serializes a repeated transition. The private
  -- mapping survives user pseudonym salt rotation; no notification ID enters
  -- the analytics row. A transaction rollback removes this mapping as well.
  INSERT INTO notification_provider_accepted_event_keys(notification_id,event_uuid)
    VALUES(NEW.id,gen_random_uuid()::text)
    ON CONFLICT (notification_id) DO NOTHING RETURNING event_uuid INTO accepted_event_uuid;
  IF accepted_event_uuid IS NULL THEN RETURN NEW; END IF;
  -- The operational audit keeps the recipient as its actor so their private
  -- data export can include this event. The analytics table gets only a hash.
  INSERT INTO audit(id,actor_id,event_id,action,created_at)
    VALUES(accepted_event_uuid,NEW.user_id,NEW.event_id,'NOTIFICATION_PROVIDER_ACCEPTED',NEW.provider_responded_at);

  INSERT INTO business_events(event_uuid,event_name,occurred_at,user_id_pseudonymous,
    activity_id,version,source,release,is_test)
  VALUES(accepted_event_uuid,'NOTIFICATION_PROVIDER_ACCEPTED',NEW.provider_responded_at,
    encode(sha256(convert_to(identity_salt || ':' || NEW.user_id,'UTF8')),'hex'),
    NEW.event_id,NEW.event_version,
    CASE WHEN OLD.external_status='UNKNOWN_REQUIRES_RECONCILIATION' THEN 'OPS' ELSE 'JOB' END,
    'R1',test_scope);
  RETURN NEW;
END;
$$;

CREATE TRIGGER notifications_provider_accepted_business_event
  AFTER UPDATE OF external_status ON notifications
  FOR EACH ROW EXECUTE FUNCTION record_notification_provider_accepted_business_event();
