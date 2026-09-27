ALTER TABLE expense_ledgers ADD COLUMN revision integer;
ALTER TABLE expense_ledgers ADD COLUMN superseded_by text;

WITH ordered AS (
  SELECT id,
    row_number() OVER (PARTITION BY event_id ORDER BY created_at,id)::integer AS revision,
    lead(id) OVER (PARTITION BY event_id ORDER BY created_at,id) AS next_id
  FROM expense_ledgers
)
UPDATE expense_ledgers AS ledger
SET revision=ordered.revision, superseded_by=ordered.next_id
FROM ordered WHERE ledger.id=ordered.id;

ALTER TABLE expense_ledgers ALTER COLUMN revision SET NOT NULL;
ALTER TABLE expense_ledgers ADD CONSTRAINT expense_revision_positive CHECK (revision >= 1);
CREATE UNIQUE INDEX expense_event_revision_unique ON expense_ledgers(event_id,revision);
CREATE UNIQUE INDEX expense_one_current_per_event ON expense_ledgers(event_id) WHERE superseded_by IS NULL;
