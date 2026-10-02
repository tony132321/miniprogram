ALTER TABLE ai_draft_requests ADD COLUMN event_id text REFERENCES events(id);
ALTER TABLE ai_draft_requests ADD COLUMN reserved_fen integer NOT NULL DEFAULT 0 CHECK (reserved_fen >= 0);
CREATE INDEX ai_draft_requests_event_budget ON ai_draft_requests(event_id) WHERE event_id IS NOT NULL;
