CREATE TABLE public_recruitment_coverage (
  id text PRIMARY KEY,
  responsible_actor text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  drill_reference text NOT NULL,
  drill_completed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  confirmed_by text,
  confirmed_at timestamptz,
  revoked_by text,
  revoked_at timestamptz,
  revocation_reason text,
  CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '24 hours'),
  CHECK (length(trim(drill_reference)) BETWEEN 8 AND 200),
  CHECK ((confirmed_by IS NULL) = (confirmed_at IS NULL)),
  CHECK ((revoked_by IS NULL) = (revoked_at IS NULL)),
  CHECK (confirmed_by IS NULL OR confirmed_by <> responsible_actor)
);
CREATE INDEX public_recruitment_coverage_window ON public_recruitment_coverage(starts_at,ends_at)
  WHERE confirmed_at IS NOT NULL AND revoked_at IS NULL;

ALTER TABLE public_recruitment_gate ADD COLUMN coverage_id text REFERENCES public_recruitment_coverage(id);

CREATE FUNCTION public_recruitment_covered(activity_start timestamptz, activity_end timestamptz)
RETURNS boolean LANGUAGE sql VOLATILE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public_recruitment_gate g
      JOIN public_recruitment_coverage current_shift ON current_shift.id=g.coverage_id
    WHERE g.id=1 AND g.status='OPEN'
      AND current_shift.confirmed_at IS NOT NULL AND current_shift.revoked_at IS NULL
      AND current_shift.drill_completed_at<=current_shift.confirmed_at
      AND current_shift.starts_at<=clock_timestamp() AND current_shift.ends_at>clock_timestamp()
      AND activity_start IS NOT NULL AND activity_end IS NOT NULL AND activity_end>activity_start
      AND EXISTS (
        SELECT 1 FROM public_recruitment_coverage event_shift
        WHERE event_shift.confirmed_at IS NOT NULL AND event_shift.revoked_at IS NULL
          AND event_shift.drill_completed_at<=event_shift.confirmed_at
          AND event_shift.ends_at>clock_timestamp()
          AND event_shift.starts_at<=activity_start AND event_shift.ends_at>=activity_end
      )
  );
$$;

WITH closed AS (
  UPDATE public_recruitment_gate SET status='CLOSED',coverage_id=NULL,
    reason='缺少已确认值守与应急演练，公开招募安全关闭',changed_by='system:migration-0043',
    changed_at=GREATEST(clock_timestamp(),changed_at + interval '1 microsecond')
    WHERE id=1 AND status='OPEN' RETURNING changed_at
)
INSERT INTO audit(id,actor_id,action,detail,created_at)
SELECT gen_random_uuid()::text,'system:migration-0043','PUBLIC_RECRUITMENT_CLOSED',
  jsonb_build_object('reason','COVERAGE_REQUIRED'),changed_at FROM closed;
