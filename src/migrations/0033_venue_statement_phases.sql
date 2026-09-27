ALTER TABLE venue_evidence
  ADD COLUMN phase text NOT NULL DEFAULT 'FORMATION' CHECK (phase IN ('PUBLISH','CHANGE','FORMATION')),
  ADD COLUMN activity_end_at timestamptz;

UPDATE venue_evidence e SET activity_end_at=(v.payload->>'endAt')::timestamptz
FROM event_versions v WHERE v.event_id=e.event_id AND v.version=e.event_version;

ALTER TABLE venue_evidence ALTER COLUMN activity_end_at SET NOT NULL;
ALTER TABLE venue_evidence DROP CONSTRAINT venue_evidence_pkey;
ALTER TABLE venue_evidence ADD PRIMARY KEY (event_id,event_version,phase);
