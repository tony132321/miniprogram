-- Backfill the per-event mapping for deletion receipts written by migration 59
-- before migration 61 introduced the mapping table. Abort rather than guess if
-- the retained links no longer prove every event in the receipt.
CREATE FUNCTION reconcile_privacy_shared_event_tombstones() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  run record;
  activity record;
  candidate text;
  mapped_count integer;
BEGIN
  FOR run IN SELECT request_id,affected_events FROM privacy_shared_deidentifications LOOP
    FOR activity IN SELECT id FROM events LOOP
      candidate := 'deleted:' || left(encode(sha256(convert_to(run.request_id || ':' || activity.id,'UTF8')),'hex'),32);
      IF EXISTS(SELECT 1 FROM events WHERE id=activity.id AND host_id=candidate) OR
         EXISTS(SELECT 1 FROM registrations WHERE event_id=activity.id AND user_id=candidate) OR
         EXISTS(SELECT 1 FROM activity_content WHERE event_id=activity.id AND author_id=candidate) OR
         EXISTS(SELECT 1 FROM activity_fact_todos WHERE event_id=activity.id AND requester_id=candidate) OR
         EXISTS(SELECT 1 FROM checkins WHERE event_id=activity.id AND user_id=candidate) OR
         EXISTS(SELECT 1 FROM manual_checkins WHERE event_id=activity.id AND (user_id=candidate OR requested_by=candidate)) OR
         EXISTS(SELECT 1 FROM outcome_feedback WHERE event_id=activity.id AND user_id=candidate) OR
         EXISTS(SELECT 1 FROM share_intents WHERE event_id=activity.id AND sender_id=candidate) OR
         EXISTS(SELECT 1 FROM share_opens WHERE event_id=activity.id AND user_id=candidate) OR
         EXISTS(SELECT 1 FROM invite_unknown_opens WHERE event_id=activity.id AND user_id=candidate) OR
         EXISTS(SELECT 1 FROM reservations WHERE event_id=activity.id AND claimed_by=candidate) OR
         EXISTS(SELECT 1 FROM cohost_grants WHERE event_id=activity.id AND (user_id=candidate OR granted_by=candidate)) OR
         EXISTS(SELECT 1 FROM registration_removals WHERE event_id=activity.id AND (user_id=candidate OR removed_by=candidate)) OR
         EXISTS(SELECT 1 FROM expense_ledgers WHERE event_id=activity.id AND created_by=candidate) OR
         EXISTS(SELECT 1 FROM expense_shares s JOIN expense_ledgers l ON l.id=s.ledger_id
           WHERE l.event_id=activity.id AND s.user_id=candidate) OR
         EXISTS(SELECT 1 FROM event_alias_consent_history WHERE event_id=activity.id AND user_id=candidate) OR
         EXISTS(SELECT 1 FROM outcomes WHERE event_id=activity.id AND completed_by=candidate) OR
         EXISTS(SELECT 1 FROM venue_evidence WHERE event_id=activity.id AND recorded_by=candidate) THEN
        INSERT INTO privacy_shared_event_tombstones(request_id,event_id,tombstone_id)
        VALUES(run.request_id,activity.id,candidate) ON CONFLICT (request_id,event_id) DO NOTHING;
      END IF;
    END LOOP;
    SELECT count(*)::int INTO mapped_count FROM privacy_shared_event_tombstones WHERE request_id=run.request_id;
    IF mapped_count <> run.affected_events THEN
      RAISE EXCEPTION 'privacy tombstone mapping cannot be verified for request %: expected %, found %',
        run.request_id,run.affected_events,mapped_count;
    END IF;
  END LOOP;
END;
$$;
SELECT reconcile_privacy_shared_event_tombstones();
CREATE UNIQUE INDEX privacy_shared_tombstone_identity_unique
  ON privacy_shared_event_tombstones(tombstone_id);

-- Reject normal writes that claim a reserved person identifier. The deletion
-- transaction sets a request-scoped flag while it rewrites its own rows.
CREATE FUNCTION guard_privacy_shared_tombstone_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_row jsonb := to_jsonb(NEW);
  old_row jsonb;
  field_name text;
  identity_value text;
  marker_owner text;
  scope_field text;
  locked_user text;
  i integer;
BEGIN
  IF TG_OP='UPDATE' THEN old_row := to_jsonb(OLD); END IF;
  scope_field := CASE WHEN TG_ARGV[0]='@ledger' THEN 'ledger_id' ELSE TG_ARGV[0] END;
  FOR i IN 1..TG_NARGS-1 LOOP
    field_name := TG_ARGV[i];
    identity_value := new_row->>field_name;
    IF identity_value IS NULL OR (TG_OP='UPDATE' AND identity_value IS NOT DISTINCT FROM old_row->>field_name
      AND (scope_field='*' OR new_row->>scope_field IS NOT DISTINCT FROM old_row->>scope_field)) THEN
      CONTINUE;
    END IF;
    -- Deletion takes this person's row FOR UPDATE before its sweep. NOWAIT
    -- avoids a cycle when this trigger fires after an UPDATE already locked a
    -- shared row: the ordinary writer aborts and releases that row.
    IF TG_TABLE_NAME <> 'users' THEN
      SELECT id INTO locked_user FROM users WHERE id=identity_value FOR SHARE NOWAIT;
    END IF;
    SELECT request_id INTO marker_owner FROM privacy_shared_event_tombstones
      WHERE tombstone_id=identity_value LIMIT 1;
    IF marker_owner IS NOT NULL AND marker_owner IS DISTINCT FROM current_setting('app.privacy_tombstone_request',true) THEN
      RAISE EXCEPTION 'reserved privacy tombstone cannot be assigned by an ordinary write';
    END IF;
    IF NOT (TG_TABLE_NAME='event_alias_consent_history' AND new_row->>'source'='DELETE_REQUEST') AND (
      EXISTS(SELECT 1 FROM privacy_deletion_executions WHERE user_id=identity_value) OR
      EXISTS(SELECT 1 FROM privacy_requests WHERE user_id=identity_value AND kind='DELETE'
        AND status='EXECUTION_INTENT_RECORDED')) THEN
      RAISE EXCEPTION 'deleted account identity cannot be assigned by an ordinary write';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER privacy_tombstone_users BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('*','id');
CREATE TRIGGER privacy_tombstone_events BEFORE INSERT OR UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('id','host_id');
CREATE TRIGGER privacy_tombstone_registrations BEFORE INSERT OR UPDATE ON registrations
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','user_id');
CREATE TRIGGER privacy_tombstone_content BEFORE INSERT OR UPDATE ON activity_content
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','author_id');
CREATE TRIGGER privacy_tombstone_fact_todos BEFORE INSERT OR UPDATE ON activity_fact_todos
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','requester_id');
CREATE TRIGGER privacy_tombstone_checkins BEFORE INSERT OR UPDATE ON checkins
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','user_id');
CREATE TRIGGER privacy_tombstone_manual_checkins BEFORE INSERT OR UPDATE ON manual_checkins
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','user_id','requested_by');
CREATE TRIGGER privacy_tombstone_outcome_feedback BEFORE INSERT OR UPDATE ON outcome_feedback
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','user_id');
CREATE TRIGGER privacy_tombstone_share_intents BEFORE INSERT OR UPDATE ON share_intents
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','sender_id');
CREATE TRIGGER privacy_tombstone_share_opens BEFORE INSERT OR UPDATE ON share_opens
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','user_id');
CREATE TRIGGER privacy_tombstone_invite_opens BEFORE INSERT OR UPDATE ON invite_unknown_opens
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','user_id');
CREATE TRIGGER privacy_tombstone_reservations BEFORE INSERT OR UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','claimed_by');
CREATE TRIGGER privacy_tombstone_cohosts BEFORE INSERT OR UPDATE ON cohost_grants
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','user_id','granted_by');
CREATE TRIGGER privacy_tombstone_removals BEFORE INSERT OR UPDATE ON registration_removals
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','user_id','removed_by');
CREATE TRIGGER privacy_tombstone_expense_ledgers BEFORE INSERT OR UPDATE ON expense_ledgers
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','created_by');
CREATE TRIGGER privacy_tombstone_expense_shares BEFORE INSERT OR UPDATE ON expense_shares
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('@ledger','user_id');
CREATE TRIGGER privacy_tombstone_alias_history BEFORE INSERT OR UPDATE ON event_alias_consent_history
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','user_id');
CREATE TRIGGER privacy_tombstone_outcomes BEFORE INSERT OR UPDATE ON outcomes
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','completed_by');
CREATE TRIGGER privacy_tombstone_venue_evidence BEFORE INSERT OR UPDATE ON venue_evidence
FOR EACH ROW EXECUTE FUNCTION guard_privacy_shared_tombstone_identity('event_id','recorded_by');
