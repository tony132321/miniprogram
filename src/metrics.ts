import type { Database } from './db.ts';
import type { EventInput } from './events.ts';

interface EvidenceRow extends Record<string, unknown> {
  id: string;
  status: string;
  payload: EventInput;
  initial_payload: EventInput;
  held: boolean | null;
  actual_count: number | null;
  disputed: boolean | null;
  review_decision: 'HELD_CONFIRMED' | 'NOT_HELD_CONFIRMED' | 'INCONCLUSIVE' | null;
  checkin_count: number;
  positive_feedback: number;
  open_cases: number;
  active_holds: number;
}

interface WeekCount {
  weekStart: string;
  qualified: number;
  pendingReview: number;
  unqualified: number;
  reasons: Record<string, number>;
}

interface PublishedRow extends Record<string, unknown> {
  id: string;
  host_id: string;
  payload: EventInput;
  published_at: Date;
}

interface ParticipationRow extends Record<string, unknown> {
  event_id: string;
  user_id: string;
  attended_at: Date;
  verified: boolean;
  possible_after_review: boolean;
}

interface FormationRow extends Record<string, unknown> {
  published_at: Date;
  confirmed_at: Date;
}

interface AttendanceRegistrationRow extends Record<string, unknown> {
  deadline_status: string | null;
  attended: boolean;
  cancelled_after_deadline: boolean;
  removed_after_deadline: boolean;
}

const missingProfitInputs = ['confirmedRevenue', 'paymentFees', 'aiCosts', 'messageCosts', 'variableCloudCosts',
  'directSupportCosts', 'subsidies', 'riskLossProvision'];

const firstAccessiblePublication = `SELECT candidate.published_at,candidate.payload FROM (
  SELECT v.created_at AS published_at,v.payload,v.version FROM event_versions v
    WHERE v.event_id=e.id AND v.payload->>'visibility'='INVITE'
      AND v.created_at<(SELECT applied_at FROM schema_migrations WHERE version=48)
  UNION ALL
  SELECT d.reviewed_at AS published_at,v.payload,d.event_version AS version
    FROM event_review_decisions d JOIN event_versions v ON v.event_id=d.event_id AND v.version=d.event_version
    WHERE d.event_id=e.id AND d.decision='APPROVED'
) candidate ORDER BY candidate.published_at,candidate.version LIMIT 1`;

const eventVersionAtCutoff = `SELECT accessible.payload FROM (
  SELECT v.created_at AS accessible_at,v.payload,v.version FROM event_versions v
    WHERE v.event_id=e.id AND v.payload->>'visibility'='INVITE'
      AND v.created_at<(SELECT applied_at FROM schema_migrations WHERE version=48)
  UNION ALL
  SELECT d.reviewed_at AS accessible_at,v.payload,d.event_version AS version
    FROM event_review_decisions d JOIN event_versions v ON v.event_id=d.event_id AND v.version=d.event_version
    WHERE d.event_id=e.id AND d.decision='APPROVED'
) accessible WHERE accessible.accessible_at<=$1::timestamptz
  ORDER BY accessible.version DESC,accessible.accessible_at DESC LIMIT 1`;

const eventStatusAtCutoff = `SELECT h.status FROM event_status_history h
  WHERE h.event_id=e.id AND h.changed_at<=$1::timestamptz
  ORDER BY h.changed_at DESC,h.id DESC LIMIT 1`;

const outcomeDisputedAtCutoff = `COALESCE(o.disputed,false) AND (
  NOT EXISTS (SELECT 1 FROM outcome_feedback feedback_any
    WHERE feedback_any.event_id=e.id AND feedback_any.held=false)
  OR EXISTS (SELECT 1 FROM outcome_feedback feedback_due
    WHERE feedback_due.event_id=e.id AND feedback_due.held=false
      AND feedback_due.created_at<=$1::timestamptz))`;

const effectiveOutcomeReview = `CASE WHEN review.created_at IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM outcome_feedback feedback_after_review
  WHERE feedback_after_review.event_id=e.id AND feedback_after_review.held=false
    AND feedback_after_review.created_at>review.created_at
    AND feedback_after_review.created_at<=$1::timestamptz)
  THEN review.decision ELSE NULL END`;

const outcomeReviewJoin = `LEFT JOIN LATERAL (
  SELECT decision,created_at FROM outcome_reviews rv WHERE rv.event_id=e.id AND rv.created_at<=$1::timestamptz
  ORDER BY rv.created_at DESC,rv.id DESC LIMIT 1
) review ON true`;

function localWeekStart(startAt: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(startAt));
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const day = new Date(Date.UTC(value('year'), value('month') - 1, value('day')));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

type Classification = { status: 'qualified' | 'pendingReview' | 'unqualified'; reason?: string };

function evidenceClassification(row: EvidenceRow): Classification {
  if (row.status === 'UNKNOWN') return { status: 'pendingReview', reason: 'UNKNOWN_HISTORICAL_STATUS' };
  if (row.status !== 'COMPLETED') return { status: 'unqualified', reason: 'NOT_COMPLETED' };
  if (row.held !== true) return { status: 'unqualified', reason: row.held === false ? 'NOT_HELD' : 'MISSING_OUTCOME' };
  const minimum = row.initial_payload.minParticipants;
  if (!Number.isInteger(minimum) || minimum! < 1) return { status: 'pendingReview', reason: 'MISSING_PUBLISHED_MINIMUM' };
  if ((row.actual_count ?? 0) < minimum!) return { status: 'unqualified', reason: 'INSUFFICIENT_ACTUAL_COUNT' };
  if (row.checkin_count < minimum!) return { status: 'unqualified', reason: 'INSUFFICIENT_CHECKINS' };
  if (row.positive_feedback < 1) return { status: 'unqualified', reason: 'NO_INDEPENDENT_FEEDBACK' };
  return { status: 'qualified' };
}

function classification(row: EvidenceRow): Classification {
  if (row.review_decision === 'NOT_HELD_CONFIRMED') return { status: 'unqualified', reason: 'REVIEWED_NOT_HELD' };
  if (row.review_decision === 'INCONCLUSIVE' || (row.disputed && row.review_decision !== 'HELD_CONFIRMED'))
    return { status: 'pendingReview', reason: 'OUTCOME_DISPUTED' };
  if (row.open_cases > 0) return { status: 'pendingReview', reason: 'OPEN_EVENT_REPORT' };
  if (row.active_holds > 0) return { status: 'pendingReview', reason: 'ACTIVE_SAFETY_HOLD' };
  return evidenceClassification(row);
}

export async function getPilotMetrics(db: Database, asOf: number, pilotUserIds: string[] = []) {
  if (!Number.isFinite(asOf)) throw new Error('asOf must be a finite timestamp');
  const eventCutoffAt = new Date(asOf).toISOString();
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows } = await tx.query<EvidenceRow>(`SELECT e.id,COALESCE(event_state.status,'UNKNOWN') AS status,
      effective_version.payload,publication.payload AS initial_payload,
      o.held,o.actual_count,(${outcomeDisputedAtCutoff}) AS disputed,
      (${effectiveOutcomeReview}) AS review_decision,
      (SELECT count(*)::int FROM checkins c WHERE c.event_id=e.id AND c.disputed=false AND c.checked_at<=$1::timestamptz
        AND c.evidence IN ('SCAN','MANUAL_CONFIRMED')) AS checkin_count,
      (SELECT count(*)::int FROM outcome_feedback f WHERE f.event_id=e.id AND f.user_id<>e.host_id
        AND f.held=true AND f.created_at<=$1::timestamptz) AS positive_feedback,
      (SELECT count(*)::int FROM reports r WHERE r.event_id=e.id AND r.created_at<=$1::timestamptz
        AND (r.status<>'RESOLVED' OR r.updated_at>$1::timestamptz)) AS open_cases,
      (SELECT count(*)::int FROM event_safety_holds h WHERE h.event_id=e.id AND h.created_at<=$1::timestamptz
        AND (h.released_at IS NULL OR h.released_at>$1::timestamptz)) AS active_holds
      FROM events e
      JOIN LATERAL (${firstAccessiblePublication}) publication ON true
      JOIN LATERAL (${eventVersionAtCutoff}) effective_version ON true
      LEFT JOIN LATERAL (${eventStatusAtCutoff}) event_state ON true
      LEFT JOIN outcomes o ON o.event_id=e.id AND o.completed_at<=$1::timestamptz
      ${outcomeReviewJoin}
      WHERE e.is_test=false AND e.host_id=ANY($2::text[]) AND event_state.status IS DISTINCT FROM 'DRAFT'
        AND publication.published_at<=$1::timestamptz
        AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.event_id=e.id
          AND r.created_at<=$1::timestamptz AND r.user_id<>ALL($2::text[]))
        AND (effective_version.payload->>'endAt')::timestamptz<=$1::timestamptz`, [eventCutoffAt, pilotUserIds]);
    const byWeek = new Map<string, WeekCount>();
    const dueCount = { evidenceQualified: 0, pendingReview: 0, unqualified: 0 };
    let reviewPossible = 0;
    for (const row of rows) {
      const weekStart = localWeekStart(row.payload.startAt!, row.payload.timeZone!);
      if (!byWeek.has(weekStart)) byWeek.set(weekStart,
        { weekStart, qualified: 0, pendingReview: 0, unqualified: 0, reasons: {} });
      const week = byWeek.get(weekStart)!;
      const result = classification(row);
      week[result.status] += 1;
      if (result.status === 'qualified') dueCount.evidenceQualified += 1;
      else dueCount[result.status] += 1;
      if (result.status === 'pendingReview' && evidenceClassification(row).status === 'qualified') reviewPossible += 1;
      if (result.reason) week.reasons[result.reason] = (week.reasons[result.reason] ?? 0) + 1;
    }
    const dueEvents = rows.length;
    const evidenceQualifiedRate = dueEvents ? dueCount.evidenceQualified / dueEvents : null;
    const possibleRateAfterReview = dueEvents ? (dueCount.evidenceQualified + reviewPossible) / dueEvents : null;
    const threshold70Met = dueEvents < 100 ? null : evidenceQualifiedRate! >= 0.7 ? true
      : possibleRateAfterReview! < 0.7 ? false : null;
    const dueEventCompletion = { dueEvents, ...dueCount, evidenceQualifiedRate, possibleRateAfterReview,
      minimumSampleMet: dueEvents >= 100,
      threshold70Met };
    const { rows: supportRows } = await tx.query<{ event_id: string; minutes: number }>(
      'SELECT event_id,minutes FROM support_minutes WHERE event_id=ANY($1::text[]) AND recorded_at<=$2::timestamptz',
      [rows.map(row => row.id), eventCutoffAt]);
    const directSupportMinutes = { status: 'PARTIAL' as const, dueEvents: rows.length,
      eventsWithEntries: new Set(supportRows.map(row => row.event_id)).size, entries: supportRows.length,
      recordedMinutes: supportRows.reduce((sum, row) => sum + row.minutes, 0) };
    const dueIds = rows.map(row => row.id);
    const missingDeadlineEvents = rows.filter(row => !Number.isFinite(Date.parse(row.payload.registrationDeadline ?? ''))).length;
    const { rows: attendanceRegistrations } = await tx.query<AttendanceRegistrationRow>(`SELECT
      deadline_state.status AS deadline_status,
      EXISTS (SELECT 1 FROM checkins c WHERE c.event_id=r.event_id AND c.user_id=r.user_id
        AND c.disputed=false AND c.evidence IN ('SCAN','MANUAL_CONFIRMED')
        AND c.checked_at<=$1::timestamptz) AS attended,
      EXISTS (SELECT 1 FROM registration_status_history h WHERE h.registration_id=r.id
        AND h.status='CANCELLED' AND h.legacy_snapshot=false
        AND h.changed_at>(effective_version.payload->>'registrationDeadline')::timestamptz
        AND h.changed_at<=$1::timestamptz) AS cancelled_after_deadline,
      EXISTS (SELECT 1 FROM registration_status_history h WHERE h.registration_id=r.id
        AND h.status='REMOVED' AND h.legacy_snapshot=false
        AND h.changed_at>(effective_version.payload->>'registrationDeadline')::timestamptz
        AND h.changed_at<=$1::timestamptz) AS removed_after_deadline
      FROM registrations r JOIN events e ON e.id=r.event_id
      JOIN LATERAL (${eventVersionAtCutoff}) effective_version ON true
      LEFT JOIN LATERAL (SELECT h.status FROM registration_status_history h
        WHERE h.registration_id=r.id
          AND h.changed_at<=(effective_version.payload->>'registrationDeadline')::timestamptz
        ORDER BY h.changed_at DESC,h.id DESC LIMIT 1) deadline_state ON true
      WHERE r.event_id=ANY($3::text[]) AND r.user_id=ANY($2::text[])
        AND r.created_at<=(effective_version.payload->>'registrationDeadline')::timestamptz
        AND r.created_at<=$1::timestamptz`, [eventCutoffAt, pilotUserIds, dueIds]);
    let confirmedAtDeadline = 0; let attendedFromDeadlineCohort = 0;
    let cancelledAfterDeadline = 0; let removedAfterDeadline = 0; let unknownDeadlineStates = 0;
    for (const registration of attendanceRegistrations) {
      if (!registration.deadline_status) { unknownDeadlineStates += 1; continue; }
      if (registration.deadline_status !== 'CONFIRMED') continue;
      confirmedAtDeadline += 1;
      if (registration.attended) attendedFromDeadlineCohort += 1;
      if (registration.cancelled_after_deadline) cancelledAfterDeadline += 1;
      if (registration.removed_after_deadline) removedAfterDeadline += 1;
    }
    const { rows: actualAttendance } = await tx.query<{ attended: number }>(`SELECT count(*)::int AS attended
      FROM checkins c WHERE c.event_id=ANY($1::text[]) AND c.user_id=ANY($2::text[])
        AND c.disputed=false AND c.evidence IN ('SCAN','MANUAL_CONFIRMED')
        AND c.checked_at<=$3::timestamptz`, [dueIds, pilotUserIds, eventCutoffAt]);
    const attendanceComplete = unknownDeadlineStates === 0 && missingDeadlineEvents === 0;
    const attendanceDiagnostic = { status: attendanceComplete ? 'COMPLETE' as const : 'PARTIAL' as const,
      dueEvents: rows.length, confirmedAtDeadline, attendedFromDeadlineCohort,
      finalActualAttended: actualAttendance[0]!.attended, cancelledAfterDeadline, removedAfterDeadline,
      unknownDeadlineStates, missingDeadlineEvents,
      cohortAttendanceRate: attendanceComplete && confirmedAtDeadline
        ? attendedFromDeadlineCohort / confirmedAtDeadline : null };
    const { rows: offerRows } = await tx.query<{ issued: number; accepted: number; expired: number;
      cancelled: number; active: number }>(`SELECT count(*)::int AS issued,
      count(*) FILTER (WHERE offer_state.status='ACCEPTED')::int AS accepted,
      count(*) FILTER (WHERE offer_state.status='EXPIRED' OR
        (offer_state.status='ACTIVE' AND o.expires_at<=$1::timestamptz))::int AS expired,
      count(*) FILTER (WHERE offer_state.status='CANCELLED')::int AS cancelled,
      count(*) FILTER (WHERE offer_state.status='ACTIVE' AND o.expires_at>$1::timestamptz)::int AS active
      FROM offers o JOIN events e ON e.id=o.event_id
      JOIN LATERAL (${firstAccessiblePublication}) publication ON true
      LEFT JOIN LATERAL (SELECT h.status FROM offer_status_history h
        WHERE h.offer_id=o.id AND h.changed_at<=$1::timestamptz
        ORDER BY h.changed_at DESC,h.id DESC LIMIT 1) offer_state ON true
      WHERE e.is_test=false AND e.host_id=ANY($2::text[]) AND o.created_at<=$1::timestamptz
        AND publication.published_at<=$1::timestamptz
        AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.event_id=e.id
          AND r.created_at<=$1::timestamptz AND r.user_id<>ALL($2::text[]))`,
    [eventCutoffAt, pilotUserIds]);
    const offers = offerRows[0]!;
    const maturedOffers = offers.accepted + offers.expired;
    const waitlistOfferConversion = { ...offers,
      unclassified: offers.issued - offers.accepted - offers.expired - offers.cancelled - offers.active,
      matured: maturedOffers, acceptanceRate: maturedOffers ? offers.accepted / maturedOffers : null };
    const { rows: formationRows } = await tx.query<FormationRow>(`SELECT publication.published_at,
      min(a.created_at) AS confirmed_at FROM events e
      JOIN LATERAL (${firstAccessiblePublication}) publication ON true
      JOIN audit a ON a.event_id=e.id AND a.action='CONFIRM_EVENT'
        AND a.created_at>=publication.published_at AND a.created_at<=$1::timestamptz
      WHERE e.is_test=false AND e.host_id=ANY($2::text[])
        AND publication.published_at<=$1::timestamptz
        AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.event_id=e.id
          AND r.created_at<=$1::timestamptz AND r.user_id<>ALL($2::text[]))
      GROUP BY e.id,publication.published_at`, [eventCutoffAt, pilotUserIds]);
    const formationMinutes = formationRows.map(row =>
      (new Date(row.confirmed_at).getTime() - new Date(row.published_at).getTime()) / 60_000)
      .filter(Number.isFinite).sort((a, b) => a - b);
    const mid = Math.floor(formationMinutes.length / 2);
    const formationTime = { formedEvents: formationMinutes.length, medianMinutes: formationMinutes.length
      ? formationMinutes.length % 2 ? formationMinutes[mid]! : (formationMinutes[mid - 1]! + formationMinutes[mid]!) / 2
      : null };
    const { rows: published } = await tx.query<PublishedRow>(`SELECT e.id,e.host_id,effective_version.payload,
      publication.published_at
      FROM events e JOIN LATERAL (${firstAccessiblePublication}) publication ON true
      JOIN LATERAL (${eventVersionAtCutoff}) effective_version ON true
      WHERE e.is_test=false AND e.host_id=ANY($2::text[])
        AND publication.published_at<=$1::timestamptz
        AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.event_id=e.id
          AND r.created_at<=$1::timestamptz AND r.user_id<>ALL($2::text[]))`,
    [eventCutoffAt, pilotUserIds]);
    const byHost = new Map<string, PublishedRow[]>();
    for (const event of published) {
      if (new Date(event.published_at).getTime() > asOf) continue;
      if (!byHost.has(event.host_id)) byHost.set(event.host_id, []);
      byHost.get(event.host_id)!.push(event);
    }
    const evidence = new Map(rows.map(row => [row.id, row]));
    const windowMs = 28 * 24 * 60 * 60_000;
    let maturedHosts = 0; let reusedHosts = 0; let secondEventDue = 0; let secondEventQualified = 0;
    for (const events of byHost.values()) {
      events.sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime() || a.id.localeCompare(b.id));
      const firstAt = new Date(events[0]!.published_at).getTime();
      if (firstAt + windowMs > asOf) continue;
      maturedHosts += 1;
      const second = events[1];
      if (!second || new Date(second.published_at).getTime() > firstAt + windowMs) continue;
      reusedHosts += 1;
      if (Date.parse(second.payload.endAt ?? '') > asOf) continue;
      secondEventDue += 1;
      if (evidence.has(second.id) && classification(evidence.get(second.id)!).status === 'qualified') secondEventQualified += 1;
    }
    const { rows: participation } = await tx.query<ParticipationRow>(`SELECT
      c.event_id,c.user_id,min(CASE WHEN c.evidence='MANUAL_CONFIRMED'
        THEN (effective_version.payload->>'endAt')::timestamptz ELSE c.checked_at END) AS attended_at,
      bool_or(event_state.status='COMPLETED' AND o.held=true
        AND (NOT (${outcomeDisputedAtCutoff}) OR (${effectiveOutcomeReview})='HELD_CONFIRMED')
        AND (${effectiveOutcomeReview}) IS DISTINCT FROM 'NOT_HELD_CONFIRMED'
        AND (effective_version.payload->>'endAt')::timestamptz<=$1::timestamptz) AS verified,
      bool_or(event_state.status IS DISTINCT FROM 'CANCELLED' AND o.held IS DISTINCT FROM false
        AND (${effectiveOutcomeReview}) IS DISTINCT FROM 'NOT_HELD_CONFIRMED') AS possible_after_review
      FROM checkins c JOIN events e ON e.id=c.event_id
      LEFT JOIN outcomes o ON o.event_id=e.id AND o.completed_at<=$1::timestamptz
      JOIN LATERAL (${firstAccessiblePublication}) publication ON true
      JOIN LATERAL (${eventVersionAtCutoff}) effective_version ON true
      LEFT JOIN LATERAL (${eventStatusAtCutoff}) event_state ON true
      ${outcomeReviewJoin}
      WHERE c.user_id=ANY($2::text[]) AND e.host_id=ANY($2::text[]) AND e.is_test=false
        AND c.disputed=false AND c.evidence IN ('SCAN','MANUAL_CONFIRMED')
        AND c.checked_at<=$1::timestamptz
        AND publication.published_at<=$1::timestamptz
        AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.event_id=e.id
          AND r.created_at<=$1::timestamptz AND r.user_id<>ALL($2::text[]))
      GROUP BY c.event_id,c.user_id`,
      [eventCutoffAt, pilotUserIds]);
    const byParticipant = new Map<string, ParticipationRow[]>();
    for (const item of participation) {
      if (!byParticipant.has(item.user_id)) byParticipant.set(item.user_id, []);
      byParticipant.get(item.user_id)!.push(item);
    }
    const participantWindowMs = 30 * 24 * 60 * 60_000;
    let observedParticipants = 0; let maturedParticipants = 0; let returnedParticipants = 0;
    let pendingFirstParticipants = 0;
    let pendingReturnParticipants = 0;
    for (const visits of byParticipant.values()) {
      visits.sort((a, b) => new Date(a.attended_at).getTime() - new Date(b.attended_at).getTime() ||
        a.event_id.localeCompare(b.event_id));
      const firstCandidate = visits.find(visit => visit.possible_after_review);
      if (firstCandidate && !firstCandidate.verified &&
        new Date(firstCandidate.attended_at).getTime() + participantWindowMs <= asOf)
        pendingFirstParticipants += 1;
      const first = visits.find(visit => visit.verified);
      if (!first) continue;
      observedParticipants += 1;
      const firstAt = new Date(first.attended_at).getTime();
      if (firstAt + participantWindowMs > asOf) continue;
      maturedParticipants += 1;
      const returns = visits.filter(visit => visit.event_id !== first.event_id &&
        new Date(visit.attended_at).getTime() > firstAt && new Date(visit.attended_at).getTime() <= firstAt + participantWindowMs);
      if (returns.some(visit => visit.verified)) returnedParticipants += 1;
      else if (returns.some(visit => visit.possible_after_review)) pendingReturnParticipants += 1;
    }
    const participantRate = maturedParticipants ? returnedParticipants / maturedParticipants : null;
    const possibleReturnRateAfterReview = maturedParticipants
      ? (returnedParticipants + pendingReturnParticipants) / maturedParticipants : null;
    const participantReturn30d = { observedParticipants, maturedParticipants, returnedParticipants,
      pendingFirstParticipants,
      pendingReturnParticipants, rate: participantRate, possibleRateAfterReview: possibleReturnRateAfterReview,
      minimumSampleMet: maturedParticipants >= 100,
      threshold25Met: maturedParticipants < 100 || pendingFirstParticipants > 0 ? null : participantRate! >= 0.25 ? true
        : possibleReturnRateAfterReview! < 0.25 ? false : null };
    return {
      eventCutoffAt,
      weeks: [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
      dueEventCompletion,
      hostReuse28d: { maturedHosts, reusedHosts, rate: maturedHosts ? reusedHosts / maturedHosts : null,
        secondEventDue, secondEventQualified,
        secondEventCompletionRate: secondEventDue ? secondEventQualified / secondEventDue : null },
      participantReturn30d,
      attendanceDiagnostic,
      directSupportMinutes,
      waitlistOfferConversion,
      formationTime,
      contributionProfit: { status: 'UNAVAILABLE' as const, missingInputs: missingProfitInputs }
    };
  });
}
