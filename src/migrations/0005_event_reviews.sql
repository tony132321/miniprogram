ALTER TABLE events ADD COLUMN review_status text NOT NULL DEFAULT 'NOT_REQUIRED'
  CHECK (review_status IN ('NOT_REQUIRED','PENDING','APPROVED','REJECTED'));
ALTER TABLE events ADD COLUMN resume_recruiting_after_review boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN review_reason text;

UPDATE events SET review_status='PENDING',resume_recruiting_after_review=recruiting,recruiting=false
  WHERE payload->>'visibility'='PUBLIC' AND status<>'DRAFT';

CREATE TABLE event_review_decisions (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  event_version integer NOT NULL,
  decision text NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
  reason text NOT NULL,
  reviewed_by text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id,event_version)
);
CREATE INDEX event_review_queue ON events(updated_at,id) WHERE review_status='PENDING';
