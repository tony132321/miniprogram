CREATE INDEX registration_anomaly_recent_signals ON audit(created_at DESC,actor_id,event_id)
  WHERE action IN ('REGISTER_CONFIRMED','REGISTER_WAITLISTED','REGISTER_REQUESTED','CANCEL_REGISTRATION');

CREATE INDEX registration_anomaly_reviews ON audit(event_id,created_at DESC)
  WHERE action='REVIEW_REGISTRATION_ANOMALY';
