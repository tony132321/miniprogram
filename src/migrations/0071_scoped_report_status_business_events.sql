-- Activity-scoped report review and ordinary resolution are successful
-- operational facts. The existing OUTCOME_REVIEW event already represents a
-- resolution with an attendance verdict, so keep one event per audit UUID.
-- Unscoped reports remain in the aggregate-only system stream. Historical
-- status changes cannot be assigned their original event version and are not
-- backfilled.
CREATE FUNCTION record_scoped_report_status_business_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  name text;
  current_version integer;
  test_scope boolean;
  identity_salt text;
BEGIN
  name := CASE
    WHEN NEW.detail->>'status'='IN_REVIEW' THEN 'REPORT_IN_REVIEW'
    WHEN NEW.detail->>'status'='RESOLVED' AND NOT (NEW.detail ? 'outcomeDecision')
      THEN 'REPORT_RESOLVED'
    ELSE NULL
  END;
  IF name IS NULL THEN RETURN NEW; END IF;

  SELECT version,is_test INTO STRICT current_version,test_scope FROM events WHERE id=NEW.event_id;
  SELECT salt INTO STRICT identity_salt FROM business_event_identity_salt WHERE singleton=true;
  INSERT INTO business_events(event_uuid,event_name,occurred_at,user_id_pseudonymous,
    activity_id,version,source,release,is_test)
  VALUES(NEW.id,name,NEW.created_at,
    CASE WHEN NEW.actor_id='system' THEN NULL
      ELSE encode(sha256(convert_to(identity_salt || ':' || NEW.actor_id,'UTF8')),'hex') END,
    NEW.event_id,current_version,'OPS','R1',test_scope);
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_scoped_report_status_business_event AFTER INSERT ON audit
  FOR EACH ROW WHEN (NEW.event_id IS NOT NULL AND NEW.action='REPORT_STATUS')
  EXECUTE FUNCTION record_scoped_report_status_business_event();
