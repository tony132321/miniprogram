ALTER TABLE operator_sessions ADD COLUMN credential_fingerprint text NOT NULL DEFAULT '';
ALTER TABLE operator_sessions ALTER COLUMN credential_fingerprint DROP DEFAULT;
