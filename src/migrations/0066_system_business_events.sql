-- Aggregate-only events for flows that cannot safely carry an activity or
-- recipient identifier into analytics. These rows intentionally have no
-- business IDs, foreign keys, free text, provider references, or tokens.
CREATE TABLE system_business_events (
  event_name text NOT NULL CHECK (event_name IN (
    'EXTERNAL_DISPATCH_CLAIMED', 'EXTERNAL_PROVIDER_ACCEPTED',
    'EXTERNAL_PROVIDER_REJECTED', 'EXTERNAL_OUTCOME_UNKNOWN',
    'EXTERNAL_RECONCILED_ACCEPTED', 'EXTERNAL_RECONCILED_REJECTED',
    'EXTERNAL_RECONCILIATION_INCONCLUSIVE', 'EXTERNAL_NOT_SENT',
    'REPORT_CREATED_UNSCOPED', 'REPORT_IN_REVIEW_UNSCOPED', 'REPORT_RESOLVED_UNSCOPED',
    'APPEAL_CREATED', 'APPEAL_IN_REVIEW', 'APPEAL_RESOLVED',
    'PRIVACY_EXPORT_REQUESTED', 'PRIVACY_DELETE_REQUESTED', 'PRIVACY_CORRECTION_REQUESTED',
    'PRIVACY_REQUESTED_OTHER', 'PRIVACY_DELETE_PROTECTED',
    'PRIVACY_DELETE_EXECUTION_INTENT', 'PRIVACY_DELETE_SAFEGUARDS_APPLIED',
    'PRIVACY_REQUEST_FULFILLED', 'PRIVACY_REQUEST_CANCELLED'
  )),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  is_test boolean
);
CREATE INDEX system_business_events_name_time
  ON system_business_events(event_name,occurred_at);

CREATE FUNCTION record_notification_system_business_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE name text;
BEGIN
  IF NEW.external_status IS NOT DISTINCT FROM OLD.external_status THEN RETURN NEW; END IF;
  name := CASE
    WHEN OLD.external_status='NOT_REQUESTED' AND NEW.external_status='DISPATCHING'
      THEN 'EXTERNAL_DISPATCH_CLAIMED'
    WHEN OLD.external_status='DISPATCHING' AND NEW.external_status='PROVIDER_ACCEPTED'
      THEN 'EXTERNAL_PROVIDER_ACCEPTED'
    WHEN OLD.external_status='DISPATCHING' AND NEW.external_status='PROVIDER_REJECTED'
      THEN 'EXTERNAL_PROVIDER_REJECTED'
    WHEN OLD.external_status='DISPATCHING' AND NEW.external_status='UNKNOWN_REQUIRES_RECONCILIATION'
      THEN 'EXTERNAL_OUTCOME_UNKNOWN'
    WHEN OLD.external_status='UNKNOWN_REQUIRES_RECONCILIATION' AND NEW.external_status='PROVIDER_ACCEPTED'
      THEN 'EXTERNAL_RECONCILED_ACCEPTED'
    WHEN OLD.external_status='UNKNOWN_REQUIRES_RECONCILIATION' AND NEW.external_status='PROVIDER_REJECTED'
      THEN 'EXTERNAL_RECONCILED_REJECTED'
    WHEN OLD.external_status='DISPATCHING' THEN 'EXTERNAL_NOT_SENT'
    ELSE NULL
  END;
  IF name IS NOT NULL THEN
    INSERT INTO system_business_events(event_name,is_test)
      VALUES(name,(SELECT is_test FROM events WHERE id=NEW.event_id));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notifications_system_business_event AFTER UPDATE OF external_status ON notifications
  FOR EACH ROW EXECUTE FUNCTION record_notification_system_business_event();

CREATE FUNCTION record_unscoped_system_business_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE name text;
BEGIN
  IF TG_TABLE_NAME='reports' THEN
    IF NEW.event_id IS NOT NULL THEN RETURN NEW; END IF;
    name := CASE
      WHEN TG_OP='INSERT' THEN 'REPORT_CREATED_UNSCOPED'
      WHEN NEW.status IS NOT DISTINCT FROM OLD.status THEN NULL
      WHEN NEW.status='IN_REVIEW' THEN 'REPORT_IN_REVIEW_UNSCOPED'
      WHEN NEW.status='RESOLVED' THEN 'REPORT_RESOLVED_UNSCOPED'
      ELSE NULL END;
  ELSIF TG_TABLE_NAME='appeals' THEN
    name := CASE
      WHEN TG_OP='INSERT' THEN 'APPEAL_CREATED'
      WHEN NEW.status IS NOT DISTINCT FROM OLD.status THEN NULL
      WHEN NEW.status='IN_REVIEW' THEN 'APPEAL_IN_REVIEW'
      WHEN NEW.status='RESOLVED' THEN 'APPEAL_RESOLVED'
      ELSE NULL END;
  ELSIF TG_TABLE_NAME='privacy_requests' THEN
    name := CASE
      WHEN TG_OP='INSERT' AND NEW.kind='EXPORT' THEN 'PRIVACY_EXPORT_REQUESTED'
      WHEN TG_OP='INSERT' AND NEW.kind='DELETE' THEN 'PRIVACY_DELETE_REQUESTED'
      WHEN TG_OP='INSERT' AND NEW.kind='CORRECT' THEN 'PRIVACY_CORRECTION_REQUESTED'
      WHEN TG_OP='INSERT' THEN 'PRIVACY_REQUESTED_OTHER'
      WHEN NEW.status IS NOT DISTINCT FROM OLD.status THEN NULL
      WHEN NEW.kind='DELETE' AND NEW.status='PROTECTED_PENDING_POLICY' THEN 'PRIVACY_DELETE_PROTECTED'
      WHEN NEW.kind='DELETE' AND NEW.status='EXECUTION_INTENT_RECORDED' THEN 'PRIVACY_DELETE_EXECUTION_INTENT'
      WHEN NEW.kind='DELETE' AND NEW.status='SAFEGUARDS_APPLIED_PENDING_REVIEW' THEN 'PRIVACY_DELETE_SAFEGUARDS_APPLIED'
      WHEN NEW.status='FULFILLED' THEN 'PRIVACY_REQUEST_FULFILLED'
      WHEN NEW.status='CANCELLED' THEN 'PRIVACY_REQUEST_CANCELLED'
      ELSE NULL END;
  END IF;
  IF name IS NOT NULL THEN INSERT INTO system_business_events(event_name) VALUES(name); END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reports_system_business_event AFTER INSERT OR UPDATE OF status ON reports
  FOR EACH ROW EXECUTE FUNCTION record_unscoped_system_business_event();
CREATE TRIGGER appeals_system_business_event AFTER INSERT OR UPDATE OF status ON appeals
  FOR EACH ROW EXECUTE FUNCTION record_unscoped_system_business_event();
CREATE TRIGGER privacy_requests_system_business_event AFTER INSERT OR UPDATE OF status ON privacy_requests
  FOR EACH ROW EXECUTE FUNCTION record_unscoped_system_business_event();

CREATE FUNCTION record_reconciliation_system_business_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.action='NOTIFICATION_RECONCILIATION' AND NEW.detail->>'resolution' IN
    ('INCONCLUSIVE','LOOKUP_FAILED','LOOKUP_UNAVAILABLE') THEN
    INSERT INTO system_business_events(event_name,is_test)
      VALUES('EXTERNAL_RECONCILIATION_INCONCLUSIVE',
        (SELECT is_test FROM events WHERE id=NEW.event_id));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER audit_reconciliation_system_business_event AFTER INSERT ON audit
  FOR EACH ROW EXECUTE FUNCTION record_reconciliation_system_business_event();
