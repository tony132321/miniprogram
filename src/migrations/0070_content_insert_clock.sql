-- Migration 48's legacy INVITE exception compares content creation time with
-- its review cutoff. now() is the transaction start and can predate a later
-- insert in the same transaction; use the actual insertion clock instead.
ALTER TABLE activity_content ALTER COLUMN created_at SET DEFAULT clock_timestamp();
