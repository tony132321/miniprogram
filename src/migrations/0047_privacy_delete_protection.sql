ALTER TABLE privacy_requests ADD COLUMN protection_applied_at timestamptz;
ALTER TABLE privacy_requests ADD COLUMN consents_revoked_count integer NOT NULL DEFAULT 0
  CHECK (consents_revoked_count >= 0);
ALTER TABLE privacy_requests ADD COLUMN aliases_removed_count integer NOT NULL DEFAULT 0
  CHECK (aliases_removed_count >= 0);
CREATE INDEX privacy_requests_pending_delete_by_user
  ON privacy_requests(user_id,created_at,id)
  WHERE kind='DELETE' AND status NOT IN ('FULFILLED','CANCELLED');

ALTER TABLE notification_consent_history ADD COLUMN source text NOT NULL DEFAULT 'USER'
  CHECK (source IN ('USER','DELETE_REQUEST'));
