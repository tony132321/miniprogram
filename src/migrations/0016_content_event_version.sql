ALTER TABLE activity_content ADD COLUMN event_version integer;
ALTER TABLE activity_content ADD CONSTRAINT activity_content_event_version_positive CHECK (event_version IS NULL OR event_version > 0);
CREATE INDEX activity_content_approved_announcements_version ON activity_content(event_id,event_version,created_at DESC)
  WHERE kind='ANNOUNCEMENT' AND status='APPROVED';
