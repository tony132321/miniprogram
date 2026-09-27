-- Every invalidating write obtains the same transaction advisory lock before
-- changing a row. The application database entry point also takes this lock
-- before its first business row lock; statement triggers cover direct SQL.
ALTER TABLE notifications ADD COLUMN external_dispatch_token text;

CREATE FUNCTION external_send_write_barrier() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(1229737265, 1);
  RETURN NULL;
END;
$$;

CREATE TRIGGER events_external_send_barrier BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON events FOR EACH STATEMENT EXECUTE FUNCTION external_send_write_barrier();
CREATE TRIGGER users_external_send_barrier BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON users FOR EACH STATEMENT EXECUTE FUNCTION external_send_write_barrier();
CREATE TRIGGER registrations_external_send_barrier BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON registrations FOR EACH STATEMENT EXECUTE FUNCTION external_send_write_barrier();
CREATE TRIGGER offers_external_send_barrier BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON offers FOR EACH STATEMENT EXECUTE FUNCTION external_send_write_barrier();
CREATE TRIGGER privacy_requests_external_send_barrier BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON privacy_requests FOR EACH STATEMENT EXECUTE FUNCTION external_send_write_barrier();
CREATE TRIGGER notification_consents_external_send_barrier BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON notification_consents FOR EACH STATEMENT EXECUTE FUNCTION external_send_write_barrier();
CREATE TRIGGER event_safety_holds_external_send_barrier BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON event_safety_holds FOR EACH STATEMENT EXECUTE FUNCTION external_send_write_barrier();
CREATE TRIGGER emergency_gate_external_send_barrier BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON emergency_gate FOR EACH STATEMENT EXECUTE FUNCTION external_send_write_barrier();
CREATE TRIGGER public_recruitment_gate_external_send_barrier BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON public_recruitment_gate FOR EACH STATEMENT EXECUTE FUNCTION external_send_write_barrier();
CREATE TRIGGER public_recruitment_coverage_external_send_barrier BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON public_recruitment_coverage FOR EACH STATEMENT EXECUTE FUNCTION external_send_write_barrier();
CREATE TRIGGER notifications_external_send_barrier BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON notifications FOR EACH STATEMENT EXECUTE FUNCTION external_send_write_barrier();

CREATE FUNCTION reject_external_dispatch_reset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.external_status <> 'NOT_REQUESTED' AND NEW.external_status = 'NOT_REQUESTED' THEN
    RAISE EXCEPTION 'external notification state cannot return to NOT_REQUESTED after dispatch';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notifications_no_dispatch_reset BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION reject_external_dispatch_reset();
