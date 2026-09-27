CREATE SEQUENCE registration_enqueue_seq AS bigint START WITH 1;
ALTER TABLE registrations ADD COLUMN enqueue_seq bigint;

WITH ordered AS (
  SELECT id,row_number() OVER (ORDER BY created_at,id)::bigint AS sequence_number
  FROM registrations
)
UPDATE registrations AS r SET enqueue_seq=ordered.sequence_number
FROM ordered WHERE r.id=ordered.id;

SELECT setval('registration_enqueue_seq',COALESCE((SELECT max(enqueue_seq) FROM registrations),0)+1,false);
ALTER TABLE registrations ALTER COLUMN enqueue_seq SET DEFAULT nextval('registration_enqueue_seq');
ALTER TABLE registrations ALTER COLUMN enqueue_seq SET NOT NULL;
CREATE UNIQUE INDEX registrations_enqueue_seq_unique ON registrations(enqueue_seq);
