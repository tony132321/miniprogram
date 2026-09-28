CREATE TABLE privacy_ai_input_expiry (
  request_id text PRIMARY KEY REFERENCES privacy_deletion_executions(request_id),
  user_id text NOT NULL,
  policy_sha256 text NOT NULL CHECK (policy_sha256 ~ '^[a-f0-9]{64}$'),
  execution_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  cleanup_at timestamptz,
  affected_rows integer NOT NULL DEFAULT 0 CHECK (affected_rows >= 0),
  CHECK (expires_at > execution_at)
);
CREATE INDEX privacy_ai_input_expiry_due ON privacy_ai_input_expiry(expires_at,request_id);

CREATE FUNCTION privacy_ai_personal_content_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE closed boolean;
BEGIN
  -- Match the cleanup sweep's users FOR UPDATE lock. A writer that commits
  -- first is included in its scan; a writer that starts later sees cleanup_at.
  IF TG_OP='INSERT' THEN
    PERFORM id FROM users WHERE id=NEW.actor_id FOR SHARE;
  ELSE
    PERFORM id FROM users WHERE id IN (NEW.actor_id,OLD.actor_id) ORDER BY id FOR SHARE;
  END IF;
  SELECT EXISTS(SELECT 1 FROM privacy_ai_input_expiry s
    WHERE s.user_id=NEW.actor_id AND s.cleanup_at IS NOT NULL) INTO closed;
  IF TG_OP='INSERT' THEN
    IF closed THEN RAISE EXCEPTION 'AI personal content is closed after privacy expiry'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.actor_id IS DISTINCT FROM OLD.actor_id THEN
    SELECT closed OR EXISTS(SELECT 1 FROM privacy_ai_input_expiry s
      WHERE s.user_id=OLD.actor_id AND s.cleanup_at IS NOT NULL) INTO closed;
  END IF;
  IF NOT closed THEN RETURN NEW; END IF;
  IF NEW.actor_id IS DISTINCT FROM OLD.actor_id THEN
    RAISE EXCEPTION 'AI personal content is closed after privacy expiry';
  END IF;
  IF TG_TABLE_NAME='ai_draft_requests' THEN
    IF NEW.result IS DISTINCT FROM OLD.result OR NEW.request_hash IS DISTINCT FROM OLD.request_hash OR
      NEW.request_key IS DISTINCT FROM OLD.request_key THEN
      RAISE EXCEPTION 'AI personal content is closed after privacy expiry';
    END IF;
  ELSIF TG_TABLE_NAME='ai_semantic_requests' THEN
    IF NEW.result IS DISTINCT FROM OLD.result OR NEW.request_hash IS DISTINCT FROM OLD.request_hash OR
      NEW.request_key IS DISTINCT FROM OLD.request_key OR NEW.fallback_key IS DISTINCT FROM OLD.fallback_key OR
      NEW.provider_evidence IS DISTINCT FROM OLD.provider_evidence THEN
      RAISE EXCEPTION 'AI personal content is closed after privacy expiry';
    END IF;
  ELSIF TG_TABLE_NAME='ai_action_proposals' THEN
    IF NEW.payload IS DISTINCT FROM OLD.payload OR NEW.receipt IS DISTINCT FROM OLD.receipt OR
      NEW.payload_hash IS DISTINCT FROM OLD.payload_hash OR NEW.status IN ('PROPOSED','APPROVED') THEN
      RAISE EXCEPTION 'AI personal content is closed after privacy expiry';
    END IF;
  ELSIF TG_TABLE_NAME='ai_draft_alert_reviews' OR TG_TABLE_NAME='ai_semantic_alert_reviews' THEN
    IF NEW.note IS DISTINCT FROM OLD.note OR NEW.request_key IS DISTINCT FROM OLD.request_key THEN
      RAISE EXCEPTION 'AI personal content is closed after privacy expiry';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER privacy_ai_draft_content_guard BEFORE INSERT OR UPDATE ON ai_draft_requests
  FOR EACH ROW EXECUTE FUNCTION privacy_ai_personal_content_guard();
CREATE TRIGGER privacy_ai_semantic_content_guard BEFORE INSERT OR UPDATE ON ai_semantic_requests
  FOR EACH ROW EXECUTE FUNCTION privacy_ai_personal_content_guard();
CREATE TRIGGER privacy_ai_proposal_content_guard BEFORE INSERT OR UPDATE ON ai_action_proposals
  FOR EACH ROW EXECUTE FUNCTION privacy_ai_personal_content_guard();
CREATE TRIGGER privacy_ai_draft_review_content_guard BEFORE INSERT OR UPDATE ON ai_draft_alert_reviews
  FOR EACH ROW EXECUTE FUNCTION privacy_ai_personal_content_guard();
CREATE TRIGGER privacy_ai_semantic_review_content_guard BEFORE INSERT OR UPDATE ON ai_semantic_alert_reviews
  FOR EACH ROW EXECUTE FUNCTION privacy_ai_personal_content_guard();
