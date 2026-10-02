-- Keep existing activity events unchanged; add the two successful draft actions
-- to the same transaction-bound, pseudonymous event stream.
CREATE FUNCTION record_draft_business_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  current_version integer;
  test_scope boolean;
  identity_salt text;
BEGIN
  SELECT version,is_test INTO STRICT current_version,test_scope
    FROM events WHERE id=NEW.event_id;
  SELECT salt INTO STRICT identity_salt
    FROM business_event_identity_salt WHERE singleton=true;
  INSERT INTO business_events(event_uuid,event_name,occurred_at,user_id_pseudonymous,
    activity_id,version,source,release,is_test)
  VALUES (NEW.id,
    CASE NEW.action WHEN 'CREATE_DRAFT' THEN 'DRAFT_CREATED' ELSE 'DRAFT_UPDATED' END,
    NEW.created_at,
    CASE WHEN NEW.actor_id='system' THEN NULL
      ELSE encode(sha256(convert_to(identity_salt || ':' || NEW.actor_id,'UTF8')),'hex') END,
    NEW.event_id,current_version,
    CASE WHEN NEW.actor_id='system' THEN 'JOB'
      WHEN NEW.actor_id LIKE 'operator:%' THEN 'OPS' ELSE 'API' END,
    'R1',test_scope);
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_draft_business_event AFTER INSERT ON audit
  FOR EACH ROW WHEN (NEW.event_id IS NOT NULL AND NEW.action IN ('CREATE_DRAFT','UPDATE_DRAFT'))
  EXECUTE FUNCTION record_draft_business_event();
