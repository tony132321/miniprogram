-- Analysis identity salt stays in the operational database and is never copied to exports.
CREATE TABLE business_event_identity_salt (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  salt text NOT NULL
);
INSERT INTO business_event_identity_salt(singleton,salt) VALUES(true,gen_random_uuid()::text);

CREATE TABLE business_events (
  event_uuid text PRIMARY KEY REFERENCES audit(id),
  event_name text NOT NULL,
  occurred_at timestamptz NOT NULL,
  user_id_pseudonymous text,
  activity_id text NOT NULL REFERENCES events(id),
  version integer NOT NULL CHECK (version > 0),
  source text NOT NULL CHECK (source IN ('API','OPS','JOB')),
  release text NOT NULL,
  is_test boolean NOT NULL
);
CREATE INDEX business_events_activity_time ON business_events(activity_id,occurred_at,event_uuid);
CREATE INDEX business_events_name_time ON business_events(event_name,occurred_at);

CREATE FUNCTION record_business_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  current_version integer;
  test_scope boolean;
  identity_salt text;
  name text;
BEGIN
  IF NEW.event_id IS NULL THEN RETURN NEW; END IF;
  name := CASE
    WHEN NEW.action = 'PUBLISH' THEN 'ACTIVITY_PUBLISHED'
    WHEN NEW.action = 'SUBMIT_PUBLIC_REVIEW' THEN 'PUBLIC_REVIEW_SUBMITTED'
    WHEN NEW.action = 'EVENT_REVIEW' AND NEW.detail->>'decision' = 'APPROVED' THEN 'ACTIVITY_PUBLISHED'
    WHEN NEW.action = 'EVENT_REVIEW' AND NEW.detail->>'decision' = 'REJECTED' THEN 'PUBLIC_REVIEW_REJECTED'
    WHEN NEW.action IN (
      'REGISTER_REQUESTED','REGISTER_CONFIRMED','REGISTER_WAITLISTED','REGISTER_INTERESTED',
      'CANCEL_REGISTRATION','REMOVE_REGISTRATION','RESERVE_SEATS','CLAIM_RESERVATION',
      'ACCEPT_OFFER','APPROVE_REGISTRATION','MATERIAL_CHANGE','EDIT_EVENT','RECONFIRM',
      'CONFIRM_EVENT','CANCEL_EVENT','CHECK_IN','REQUEST_MANUAL_CHECKIN',
      'CONFIRM_MANUAL_CHECKIN','REJECT_MANUAL_CHECKIN','COMPLETE_EVENT','OUTCOME_FEEDBACK',
      'FORMATION_EXPIRED','CANCEL_SHORTFALL','SAFETY_HOLD_PLACE','SAFETY_HOLD_RELEASE'
    ) THEN NEW.action
    ELSE NULL
  END;
  IF name IS NULL THEN RETURN NEW; END IF;
  SELECT version,is_test INTO STRICT current_version,test_scope FROM events WHERE id=NEW.event_id;
  SELECT salt INTO STRICT identity_salt FROM business_event_identity_salt WHERE singleton=true;
  INSERT INTO business_events(event_uuid,event_name,occurred_at,user_id_pseudonymous,activity_id,version,source,release,is_test)
  VALUES (
    NEW.id,name,NEW.created_at,
    CASE WHEN NEW.actor_id='system' THEN NULL ELSE encode(sha256(convert_to(identity_salt || ':' || NEW.actor_id,'UTF8')),'hex') END,
    NEW.event_id,current_version,
    CASE WHEN NEW.actor_id='system' THEN 'JOB' WHEN NEW.actor_id LIKE 'operator:%' THEN 'OPS' ELSE 'API' END,
    'R1',test_scope
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER audit_business_event AFTER INSERT ON audit
FOR EACH ROW EXECUTE FUNCTION record_business_event();
