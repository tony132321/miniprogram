ALTER TABLE idempotency ADD COLUMN request_hash text;
ALTER TABLE idempotency ADD CONSTRAINT idempotency_request_hash_valid
  CHECK (request_hash IS NULL OR request_hash ~ '^[0-9a-f]{64}$');
