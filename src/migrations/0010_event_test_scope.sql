-- Existing records remain outside pilot metrics until explicitly reviewed.
ALTER TABLE events ADD COLUMN is_test boolean NOT NULL DEFAULT true;
