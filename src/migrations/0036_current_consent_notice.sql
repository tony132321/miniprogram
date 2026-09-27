-- Existing grants have unknown disclosure provenance and must be reconfirmed.
ALTER TABLE notification_consents ADD COLUMN scope text;
ALTER TABLE notification_consents ADD COLUMN notice_version text;
