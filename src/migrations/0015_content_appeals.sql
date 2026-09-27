ALTER TABLE activity_content ADD COLUMN moderation_reason text;

ALTER TABLE appeals ADD COLUMN content_id text REFERENCES activity_content(id);
ALTER TABLE appeals ADD COLUMN outcome text CHECK (outcome IS NULL OR outcome IN ('UPHOLD','OVERTURN'));
ALTER TABLE appeals DROP CONSTRAINT appeals_check;
ALTER TABLE appeals ADD CONSTRAINT appeals_one_target CHECK (
  (report_id IS NOT NULL)::integer + (removal_id IS NOT NULL)::integer + (content_id IS NOT NULL)::integer = 1
);
CREATE UNIQUE INDEX appeals_one_content_review ON appeals(content_id) WHERE content_id IS NOT NULL;
