CREATE INDEX events_host_for_me ON events(host_id,id);

CREATE INDEX registrations_active_user_for_me ON registrations(user_id,event_id)
  WHERE status IN ('INTERESTED','REQUESTED','WAITLISTED','OFFERED','CONFIRMED','RECONFIRM_REQUIRED');

CREATE INDEX cohost_grants_active_user_for_me ON cohost_grants(user_id,event_id)
  WHERE revoked_at IS NULL;
