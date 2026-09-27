CREATE OR REPLACE FUNCTION record_business_event() RETURNS trigger LANGUAGE plpgsql AS $$
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
    WHEN NEW.action = 'REPORT_STATUS' AND NEW.detail->>'status' = 'RESOLVED'
      AND NEW.detail->>'outcomeDecision' IN ('HELD_CONFIRMED','NOT_HELD_CONFIRMED','INCONCLUSIVE')
      THEN 'OUTCOME_REVIEW'
    WHEN NEW.action IN (
      'REGISTER_REQUESTED','REGISTER_CONFIRMED','REGISTER_WAITLISTED','REGISTER_INTERESTED',
      'CANCEL_REGISTRATION','REMOVE_REGISTRATION','RESERVE_SEATS','CLAIM_RESERVATION',
      'ACCEPT_OFFER','APPROVE_REGISTRATION','MATERIAL_CHANGE','EDIT_EVENT','RECONFIRM',
      'CONFIRM_EVENT','CANCEL_EVENT','CHECK_IN','REQUEST_MANUAL_CHECKIN',
      'CONFIRM_MANUAL_CHECKIN','REJECT_MANUAL_CHECKIN','COMPLETE_EVENT','OUTCOME_FEEDBACK',
      'FORMATION_EXPIRED','CANCEL_SHORTFALL','SAFETY_HOLD_PLACE','SAFETY_HOLD_RELEASE',
      'SHARE_INTENT','SHARE_OPEN_ATTRIBUTED','SHARE_OPEN_UNKNOWN',
      'RECORD_EXPENSE','EXPENSE_PARTICIPANT_HANDLED','EXPENSE_HOST_RECEIVED',
      'CREATE_REPORT','RECORD_SUPPORT_MINUTES'
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
    CASE WHEN NEW.actor_id='system' THEN 'JOB' WHEN name='OUTCOME_REVIEW' OR NEW.actor_id LIKE 'operator:%'
      THEN 'OPS' ELSE 'API' END,
    'R1',test_scope
  );
  RETURN NEW;
END;
$$;
