import { createHash, randomUUID } from 'node:crypto';
import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { command } from './registrations.ts';
import { consentNotice, type NotificationPurpose } from './notifications.ts';
import { eventAliasNotice } from './event-aliases.ts';
import { claimIdempotency } from './idempotency.ts';
import { parseAnnouncementFaq } from './announcement-faq.ts';
import type { ReportResponsePolicy } from './report-response-policy.ts';

export async function createReport(db: Database, actor: string, input: { eventId?: string; kind?: string; description?: string },
  key: string, responsePolicy?: ReportResponsePolicy) {
  return command(db, actor, 'report', key, async tx => {
    if (!['SAFETY', 'CONTENT', 'ATTENDANCE', 'OTHER'].includes(input.kind ?? '') || !input.description?.trim() || input.description.length > 2000)
      throw new AppError('BAD_REQUEST', '举报类型或描述无效');
    const id = randomUUID();
    const severity = responsePolicy?.defaultSeverityByKind[input.kind as keyof ReportResponsePolicy['defaultSeverityByKind']];
    const targetMinutes = severity ? responsePolicy!.targetMinutesBySeverity[severity] : null;
    const { rows } = await tx.query<{ id: string; status: string }>(`WITH report_clock AS (SELECT clock_timestamp() AS at)
      INSERT INTO reports(id,reporter_id,event_id,kind,description,severity,
        first_response_target_minutes,first_response_due_at,created_at)
      SELECT $1,$2,$3,$4,$5,$6,$7,report_clock.at + $7::int * interval '1 minute',report_clock.at
      FROM report_clock RETURNING id,status`, [id, actor, input.eventId ?? null, input.kind,
      input.description.trim(), severity ?? 'UNCLASSIFIED', targetMinutes]);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action) VALUES($1,$2,$3,$4)', [randomUUID(), actor, input.eventId ?? null, 'CREATE_REPORT']);
    return rows[0]!;
  });
}

export async function listReports(db: Database, actor: string, offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', '举报列表页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取举报需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const assignedOnly = actor.startsWith('operator:');
    const assignmentFilter = assignedOnly
      ? ' WHERE EXISTS (SELECT 1 FROM report_assignments ra WHERE ra.report_id=reports.id AND ra.assignee_id=$1)'
      : '';
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(id,kind,status,severity,first_response_state,
        first_response_due_at,created_at,
        kind='ATTENDANCE' AND EXISTS (SELECT 1 FROM outcomes o WHERE o.event_id=reports.event_id AND o.disputed))::text,
        ',' ORDER BY id),'')) AS snapshot FROM reports${assignmentFilter}`, assignedOnly ? [actor] : []);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', '举报列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query<{ id: string; kind: string; description: string; status: string; event_id: string | null;
      outcome_review_required: boolean }>(`SELECT id,kind,description,status,event_id,severity,
      first_response_state,first_response_due_at,first_responded_at,first_responded_by,
      (kind='ATTENDANCE' AND EXISTS (SELECT 1 FROM outcomes o WHERE o.event_id=reports.event_id AND o.disputed))
        AS outcome_review_required FROM reports${assignmentFilter} ORDER BY
      CASE WHEN status='RESOLVED' THEN 4 WHEN severity='HIGH' THEN 0
        WHEN severity='UNCLASSIFIED' AND kind='SAFETY' THEN 1
        WHEN severity='NORMAL' THEN 2 ELSE 3 END,
      CASE WHEN status<>'RESOLVED' AND first_response_state='PENDING' THEN 0 ELSE 1 END,
      CASE WHEN status<>'RESOLVED' AND first_response_state='PENDING' AND first_response_due_at IS NULL THEN 1 ELSE 0 END,
      CASE WHEN status<>'RESOLVED' AND first_response_state='PENDING' THEN first_response_due_at END,
      CASE WHEN status='RESOLVED' THEN created_at END DESC,
      CASE WHEN status<>'RESOLVED' THEN created_at END ASC,id ASC
      LIMIT 100 OFFSET $${assignedOnly ? 2 : 1}`, assignedOnly ? [actor, offset] : [offset]);
    const total = totals[0]?.total ?? 0;
    return { items: rows, total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
      snapshot: currentSnapshot };
  });
}

export async function listReportTriage(db: Database, activeReportAssignees: string[], offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', '待分配举报页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取待分配举报需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const unassigned = `r.status<>'RESOLVED' AND NOT EXISTS
      (SELECT 1 FROM report_assignments a WHERE a.report_id=r.id AND a.assignee_id=ANY($1::text[]))`;
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(r.id,r.kind,r.status,r.severity,
        r.first_response_state,r.first_response_due_at,r.created_at)::text,',' ORDER BY r.id),'')) AS snapshot
      FROM reports r WHERE ${unassigned}`, [activeReportAssignees]);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', '待分配举报列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query<{ id: string; kind: string; status: string; created_at: Date }>(
      `SELECT r.id,r.kind,r.status,r.severity,r.first_response_state,r.first_response_due_at,r.created_at
       FROM reports r WHERE ${unassigned}
       ORDER BY CASE WHEN r.severity='HIGH' THEN 0
         WHEN r.severity='UNCLASSIFIED' AND r.kind='SAFETY' THEN 1
         WHEN r.severity='NORMAL' THEN 2 ELSE 3 END,
         CASE WHEN r.first_response_state='PENDING' THEN 0 ELSE 1 END,
         CASE WHEN r.first_response_state='PENDING' AND r.first_response_due_at IS NULL THEN 1 ELSE 0 END,
         CASE WHEN r.first_response_state='PENDING' THEN r.first_response_due_at END,
         r.created_at,r.id LIMIT 100 OFFSET $2`,
      [activeReportAssignees, offset]);
    const total = totals[0]!.total;
    return { items: rows, total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
      snapshot: currentSnapshot };
  });
}

export async function listReportResponseAlerts(db: Database, offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', '首次响应关注列表页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取首次响应关注列表需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: clock } = await tx.query<{ at: Date }>('SELECT clock_timestamp() AS at');
    const at = new Date(clock[0]!.at).toISOString();
    const filter = `r.status<>'RESOLVED' AND r.first_response_state='PENDING'
      AND (r.first_response_due_at IS NULL OR r.first_response_due_at<=$1::timestamptz)`;
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(r.id,r.kind,r.status,r.severity,
        r.first_response_due_at,a.assignee_id)::text,',' ORDER BY r.id),'')) AS snapshot
      FROM reports r LEFT JOIN report_assignments a ON a.report_id=r.id WHERE ${filter}`, [at]);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', '首次响应关注列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query(`SELECT r.id,r.kind,r.status,r.severity,r.created_at,
      r.first_response_target_minutes,r.first_response_due_at,a.assignee_id,
      CASE WHEN r.first_response_due_at IS NULL THEN 'TARGET_UNCONFIGURED' ELSE 'OVERDUE' END AS attention
      FROM reports r LEFT JOIN report_assignments a ON a.report_id=r.id WHERE ${filter}
      ORDER BY CASE WHEN r.first_response_due_at IS NULL THEN 1 ELSE 0 END,
        r.first_response_due_at,r.created_at,r.id LIMIT 100 OFFSET $2`, [at, offset]);
    const total = totals[0]!.total;
    return { items: rows, total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
      snapshot: currentSnapshot };
  });
}

function reportReason(reason: unknown): string {
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 500)
    throw new AppError('BAD_REQUEST', '逐单核查或分配原因需为 10 至 500 字');
  return reason.trim();
}

export async function inspectReportForSafety(db: Database, actor: string, reportId: string, reason: unknown) {
  const safeReason = reportReason(reason);
  return db.transaction(async tx => {
    const { rows } = await tx.query<{ id: string; kind: string; description: string; status: string;
      event_id: string | null; severity: string; created_at: Date }>(
      'SELECT id,kind,description,status,event_id,severity,created_at FROM reports WHERE id=$1 FOR SHARE', [reportId]);
    if (!rows[0]) throw new AppError('NOT_FOUND', '工单不存在', 404);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action,detail) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), actor, rows[0].event_id, 'REPORT_SAFETY_INSPECT', JSON.stringify({ reportId, reason: safeReason })]);
    return rows[0];
  });
}

export async function assignReport(db: Database, actor: string, reportId: string, assignee: string,
  reason: unknown, key: string) {
  const safeReason = reportReason(reason);
  if (!assignee.startsWith('operator:') || assignee === actor)
    throw new AppError('BAD_REQUEST', '工单须分配给另一名具名举报处理人员');
  return command(db, actor, `report-assignment:${reportId}`, key, async tx => {
    const { rows: reports } = await tx.query<{ id: string; event_id: string | null; status: string }>(
      'SELECT id,event_id,status FROM reports WHERE id=$1 FOR UPDATE', [reportId]);
    if (!reports[0]) throw new AppError('NOT_FOUND', '工单不存在', 404);
    if (reports[0].status === 'RESOLVED') throw new AppError('INVALID_STATE', '已结案工单不能重新分配', 409);
    const { rows } = await tx.query<{ report_id: string; assignee_id: string; assigned_by: string; assigned_at: Date }>(
      `INSERT INTO report_assignments(report_id,assignee_id,assigned_by,assignment_reason)
       VALUES($1,$2,$3,$4) ON CONFLICT (report_id) DO UPDATE SET assignee_id=EXCLUDED.assignee_id,
       assigned_by=EXCLUDED.assigned_by,assignment_reason=EXCLUDED.assignment_reason,assigned_at=clock_timestamp()
       RETURNING report_id,assignee_id,assigned_by,assigned_at`, [reportId, assignee, actor, safeReason]);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action,detail) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), actor, reports[0].event_id, 'REPORT_ASSIGNED', JSON.stringify({ reportId, assignee, reason: safeReason })]);
    return rows[0]!;
  });
}

export async function classifyReportSeverity(db: Database, actor: string, reportId: string, severity: unknown,
  expectedSeverity: unknown, reason: unknown, key: string, policy?: ReportResponsePolicy) {
  if (severity !== 'HIGH' && severity !== 'NORMAL')
    throw new AppError('BAD_REQUEST', '工单严重度只能为 HIGH 或 NORMAL');
  if (!['UNCLASSIFIED', 'HIGH', 'NORMAL'].includes(expectedSeverity as string))
    throw new AppError('BAD_REQUEST', '必须提供核查时的工单严重度');
  const safeReason = reportReason(reason);
  if (!policy) throw new AppError('RESPONSE_POLICY_REQUIRED', '尚未配置首次响应目标，不能给工单重新定级', 409);
  const targetMinutes = policy.targetMinutesBySeverity[severity];
  return command(db, actor, `report-severity:${reportId}`, key, async tx => {
    const { rows: current } = await tx.query<{ id: string; event_id: string | null;
      status: string; severity: string; first_response_target_minutes: number | null;
      first_response_due_at: Date | null; first_response_state: string }>(
      `SELECT id,event_id,status,severity,first_response_target_minutes,first_response_due_at,
       first_response_state FROM reports WHERE id=$1 FOR UPDATE`, [reportId]);
    const report = current[0];
    if (!report) throw new AppError('NOT_FOUND', '工单不存在', 404);
    if (report.severity !== expectedSeverity)
      throw new AppError('REPORT_CHANGED', '工单严重度已变化，请刷新后复核', 409);
    if (report.status === 'RESOLVED') throw new AppError('INVALID_STATE', '已结案工单不能改级', 409);
    if (report.severity === severity) throw new AppError('INVALID_STATE', '工单已是当前严重度', 409);
    const { rows: clock } = await tx.query<{ changed_at: Date }>('SELECT clock_timestamp() AS changed_at');
    const changedAt = clock[0]!.changed_at;
    if (report.severity === 'HIGH' && severity === 'NORMAL' && report.first_response_state === 'PENDING' &&
      report.first_response_due_at &&
      new Date(report.first_response_due_at).getTime() <= new Date(changedAt).getTime())
      throw new AppError('OVERDUE_REVIEW_REQUIRED', '逾期高严重度工单不能降级，请独立复核', 409);
    const { rows } = await tx.query<{ severity: string; first_response_target_minutes: number | null;
      first_response_due_at: Date | null; first_responded_at: Date | null; changed_at: Date }>(`UPDATE reports SET severity=$2,
      first_response_target_minutes=CASE WHEN first_response_state='PENDING' THEN $3 ELSE first_response_target_minutes END,
      first_response_due_at=CASE WHEN first_response_state='PENDING'
        THEN created_at + $3::int * interval '1 minute' ELSE first_response_due_at END
      WHERE id=$1 AND NOT (severity='HIGH' AND $2='NORMAL' AND first_response_state='PENDING'
        AND first_response_due_at IS NOT NULL AND first_response_due_at<=clock_timestamp())
      RETURNING severity,first_response_target_minutes,first_response_due_at,first_responded_at,
        clock_timestamp() AS changed_at`,
    [reportId, severity, targetMinutes]);
    if (!rows[0]) throw new AppError('OVERDUE_REVIEW_REQUIRED',
      '逾期高严重度工单不能降级，请独立复核', 409);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action,detail) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), actor, report.event_id, 'REPORT_SEVERITY_CHANGED', JSON.stringify({ reportId,
        previousSeverity: report.severity, severity, reason: safeReason,
        oldTargetMinutes: report.first_response_target_minutes,
        newTargetMinutes: rows[0]!.first_response_target_minutes,
        oldDueAt: report.first_response_due_at,
        newDueAt: rows[0]!.first_response_due_at,
        changedAt: rows[0].changed_at })]);
    return { reportId, severity: rows[0]!.severity,
      firstResponseTargetMinutes: rows[0]!.first_response_target_minutes,
      firstResponseDueAt: rows[0]!.first_response_due_at,
      firstRespondedAt: rows[0]!.first_responded_at };
  });
}

export async function listMyReports(db: Database, actor: string) {
  const { rows } = await db.query('SELECT id,event_id,kind,description,status,resolution,updated_at,created_at FROM reports WHERE reporter_id=$1 ORDER BY created_at DESC,id DESC', [actor]);
  return rows;
}

export async function changeReportStatus(db: Database, actor: string, reportId: string, status: string,
  resolution: string | undefined, key: string, outcomeDecision?: unknown) {
  return command(db, actor, `report-status:${reportId}`, key, async tx => {
    if (!['IN_REVIEW', 'RESOLVED'].includes(status)) throw new AppError('BAD_REQUEST', '工单状态无效');
    if (status === 'RESOLVED' && (typeof resolution !== 'string' || resolution.trim().length < 5 || resolution.length > 1000))
      throw new AppError('BAD_REQUEST', '处理结论需为 5 至 1000 字');
    const { rows: current } = await tx.query<{ id: string; reporter_id: string; event_id: string | null;
      kind: string; status: string }>('SELECT id,reporter_id,event_id,kind,status FROM reports WHERE id=$1 FOR UPDATE', [reportId]);
    if (!current[0]) throw new AppError('NOT_FOUND', '工单不存在', 404);
    if (actor.startsWith('operator:')) {
      const { rows: assignment } = await tx.query<{ assignee_id: string }>(
        'SELECT assignee_id FROM report_assignments WHERE report_id=$1', [reportId]);
      if (assignment[0]?.assignee_id !== actor) throw new AppError('FORBIDDEN', '工单未分配给当前处理人', 403);
    }
    if (current[0].status === 'RESOLVED' || current[0].status === status)
      throw new AppError('INVALID_STATE', '工单状态不可重复或回退', 409);
    const { rows: outcomes } = current[0].kind === 'ATTENDANCE' && current[0].event_id
      ? await tx.query<{ disputed: boolean }>('SELECT disputed FROM outcomes WHERE event_id=$1', [current[0].event_id])
      : { rows: [] };
    const requiresOutcomeDecision = status === 'RESOLVED' && outcomes[0]?.disputed === true;
    const decisions = ['HELD_CONFIRMED', 'NOT_HELD_CONFIRMED', 'INCONCLUSIVE'];
    if (requiresOutcomeDecision && !decisions.includes(outcomeDecision as string))
      throw new AppError('BAD_REQUEST', '结项争议结案前须选择人工复核结论');
    if (!requiresOutcomeDecision && outcomeDecision !== undefined)
      throw new AppError('BAD_REQUEST', '当前工单不接受结项裁决');
    const { rows } = await tx.query<{ id: string; status: string; resolution: string | null }>(
      `UPDATE reports SET status=$2,resolution=$3,resolved_by=$4,updated_at=clock_timestamp(),
        first_response_state=CASE WHEN first_response_state='PENDING' THEN 'RECORDED' ELSE first_response_state END,
        first_responded_at=CASE WHEN first_response_state='PENDING' THEN clock_timestamp() ELSE first_responded_at END,
        first_responded_by=CASE WHEN first_response_state='PENDING' THEN $5 ELSE first_responded_by END
       WHERE id=$1 RETURNING id,status,resolution`,
      [reportId, status, status === 'RESOLVED' ? resolution!.trim() : null,
        status === 'RESOLVED' ? actor : null, actor]);
    if (requiresOutcomeDecision) await tx.query(`INSERT INTO outcome_reviews
      (id,event_id,report_id,decision,reason,reviewed_by) VALUES($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), current[0].event_id, reportId, outcomeDecision, resolution!.trim(), actor]);
    await tx.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,status,external_status,detail)
      VALUES($1,NULL,$2,$3,0,'IN_APP','UNAVAILABLE',$4)`,
      [randomUUID(), current[0].reporter_id, status === 'RESOLVED' ? 'REPORT_RESOLVED' : 'REPORT_IN_REVIEW', JSON.stringify({ reportId })]);
    await tx.query('INSERT INTO audit(id,actor_id,event_id,action,detail) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), actor, current[0].event_id, 'REPORT_STATUS', JSON.stringify({ reportId, status,
        ...(requiresOutcomeDecision ? { outcomeDecision } : {}) })]);
    return rows[0]!;
  });
}

export async function createAppeal(db: Database, actor: string, input: { reportId?: string; removalId?: string; contentId?: string; description?: string }, key: string) {
  return command(db, actor, 'appeal', key, async tx => {
    if ([input.reportId, input.removalId, input.contentId].filter(Boolean).length !== 1 || !input.description?.trim() || input.description.length > 2000)
      throw new AppError('BAD_REQUEST', '申诉内容无效');
    if (input.reportId) {
      const { rows: report } = await tx.query<{ reporter_id: string; status: string }>('SELECT reporter_id,status FROM reports WHERE id=$1', [input.reportId]);
      if (!report[0]) throw new AppError('NOT_FOUND', '原工单不存在', 404);
      if (report[0].reporter_id !== actor) throw new AppError('FORBIDDEN', '只能申诉自己的工单', 403);
      if (report[0].status !== 'RESOLVED') throw new AppError('INVALID_STATE', '工单结案后才能申请复核', 409);
    } else if (input.removalId) {
      const { rows: removal } = await tx.query<{ user_id: string }>('SELECT user_id FROM registration_removals WHERE id=$1', [input.removalId]);
      if (!removal[0]) throw new AppError('NOT_FOUND', '移除记录不存在', 404);
      if (removal[0].user_id !== actor) throw new AppError('FORBIDDEN', '只能申诉自己的移除记录', 403);
    } else {
      const { rows: content } = await tx.query<{ author_id: string; status: string }>('SELECT author_id,status FROM activity_content WHERE id=$1', [input.contentId]);
      if (!content[0]) throw new AppError('NOT_FOUND', '原内容不存在', 404);
      if (content[0].author_id !== actor) throw new AppError('FORBIDDEN', '只能申诉自己的内容', 403);
      if (content[0].status !== 'REJECTED') throw new AppError('INVALID_STATE', '仅可申诉已驳回的内容', 409);
    }
    const id = randomUUID();
    const { rows } = await tx.query<{ id: string; status: string }>(
      'INSERT INTO appeals(id,report_id,removal_id,content_id,appellant_id,description) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id,status',
      [id, input.reportId ?? null, input.removalId ?? null, input.contentId ?? null, actor, input.description.trim()]);
    if (!rows[0]) throw new AppError('INVALID_STATE', '该内容已有申诉', 409);
    await tx.query('INSERT INTO audit(id,actor_id,action) VALUES($1,$2,$3)', [randomUUID(), actor, 'CREATE_APPEAL']);
    return rows[0]!;
  });
}

export async function listAppeals(db: Database, offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', '申诉列表页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取申诉需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(id,status,created_at,updated_at)::text,',' ORDER BY id),'')) AS snapshot
      FROM appeals`);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', '申诉列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query(`SELECT a.id,a.report_id,a.removal_id,a.content_id,a.appellant_id,a.description,a.status,a.resolution,a.outcome,a.updated_at,a.created_at,
      rm.reason AS removal_reason,rm.event_id AS removal_event_id,
      rp.kind AS report_kind,rp.description AS report_description,rp.resolution AS report_resolution,rp.resolved_by AS report_resolved_by,
      c.kind AS content_kind,c.body AS content_body,c.moderation_reason AS content_moderation_reason,c.moderated_by AS content_moderated_by
      FROM appeals a LEFT JOIN registration_removals rm ON rm.id=a.removal_id
      LEFT JOIN reports rp ON rp.id=a.report_id LEFT JOIN activity_content c ON c.id=a.content_id
      ORDER BY CASE WHEN a.status='RESOLVED' THEN 1 ELSE 0 END,
        CASE WHEN a.status<>'RESOLVED' THEN a.created_at END ASC,
        CASE WHEN a.status='RESOLVED' THEN a.created_at END DESC,a.id ASC
      LIMIT 100 OFFSET $1`, [offset]);
    const total = totals[0]!.total;
    return { items: rows, total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
      snapshot: currentSnapshot };
  });
}

export async function listMyAppeals(db: Database, actor: string) {
  const { rows } = await db.query('SELECT id,report_id,removal_id,content_id,description,status,resolution,outcome,updated_at FROM appeals WHERE appellant_id=$1 ORDER BY created_at DESC', [actor]);
  return rows;
}

export async function changeAppealStatus(db: Database, actor: string, appealId: string, status: string, resolution: string | undefined, key: string, outcome?: string) {
  return command(db, actor, `appeal-status:${appealId}`, key, async tx => {
    if (!['IN_REVIEW', 'RESOLVED'].includes(status)) throw new AppError('BAD_REQUEST', '申诉状态无效');
    if (status === 'RESOLVED' && (typeof resolution !== 'string' || resolution.trim().length < 5 || resolution.length > 1000))
      throw new AppError('BAD_REQUEST', '复核结论需为 5 至 1000 字');
    const { rows: current } = await tx.query<{ status: string; appellant_id: string; report_id: string | null; report_resolved_by: string | null;
      content_id: string | null; content_moderated_by: string | null; content_status: string | null; content_kind: string | null;
      content_parent_id: string | null; content_event_id: string | null; content_event_version: number | null; content_body: string | null }>(
      `SELECT a.status,a.appellant_id,a.report_id,r.resolved_by AS report_resolved_by,a.content_id,
       c.moderated_by AS content_moderated_by,c.status AS content_status,c.kind AS content_kind,
       c.parent_id AS content_parent_id,c.event_id AS content_event_id,c.event_version AS content_event_version,c.body AS content_body
       FROM appeals a LEFT JOIN reports r ON r.id=a.report_id LEFT JOIN activity_content c ON c.id=a.content_id
       WHERE a.id=$1 FOR UPDATE OF a`, [appealId]);
    if (!current[0]) throw new AppError('NOT_FOUND', '申诉不存在', 404);
    if (current[0].status === 'RESOLVED' || current[0].status === status)
      throw new AppError('INVALID_STATE', '申诉状态不可重复或回退', 409);
    if (status === 'RESOLVED' && current[0].report_id && !current[0].report_resolved_by)
      throw new AppError('INVALID_STATE', '原举报结案人员身份待核实，暂不能结案申诉', 409);
    if (status === 'RESOLVED' && current[0].report_resolved_by === actor)
      throw new AppError('INVALID_STATE', '原举报结案人员须回避复核', 409);
    if (current[0].content_id) {
      if (status === 'RESOLVED' && !['UPHOLD', 'OVERTURN'].includes(outcome ?? ''))
        throw new AppError('BAD_REQUEST', '内容复核需选择维持或撤销驳回');
      if (status === 'RESOLVED' && (!current[0].content_moderated_by || current[0].content_moderated_by === actor))
        throw new AppError('INVALID_STATE', '原内容审核人员须回避复核', 409);
      if (status === 'RESOLVED' && current[0].content_status !== 'REJECTED')
        throw new AppError('INVALID_STATE', '原内容状态已变化', 409);
    } else if (outcome !== undefined) throw new AppError('BAD_REQUEST', '该申诉不需要内容复核选项');
    if (status === 'RESOLVED' && current[0].content_id && outcome === 'OVERTURN') {
      const { rows: eventRows } = await tx.query<{ version: number }>(
        'SELECT version FROM events WHERE id=$1 FOR SHARE', [current[0].content_event_id]);
      if (current[0].content_kind === 'ANSWER' && current[0].content_parent_id) {
        const { rows: facts } = await tx.query<{ event_version: number }>(
          'SELECT event_version FROM activity_fact_todos WHERE question_content_id=$1', [current[0].content_parent_id]);
        if (facts[0] && facts[0].event_version !== eventRows[0]?.version)
          throw new AppError('INVALID_STATE', '旧版事实回答不能通过申诉作为当前活动回答公开', 409);
      }
      await tx.query("UPDATE activity_content SET status='APPROVED' WHERE id=$1 AND status='REJECTED'", [current[0].content_id]);
      if (current[0].content_kind === 'QUESTION')
        await tx.query(`UPDATE activity_fact_todos t SET status='OPEN',resolved_at=NULL FROM events e
          WHERE t.question_content_id=$1 AND t.status='REJECTED' AND e.id=t.event_id AND t.event_version=e.version`,
          [current[0].content_id]);
      if (current[0].content_kind === 'ANSWER' && current[0].content_parent_id)
        await tx.query(`UPDATE activity_fact_todos t SET status='RESOLVED',resolved_at=now() FROM events e
          WHERE t.question_content_id=$1 AND t.status='OPEN' AND e.id=t.event_id AND t.event_version=e.version`,
          [current[0].content_parent_id]);
      if (current[0].content_kind === 'ANNOUNCEMENT' && current[0].content_event_version === eventRows[0]?.version) {
        const faq = parseAnnouncementFaq(current[0].content_body ?? '');
        if (faq) await tx.query(`UPDATE activity_fact_todos SET status='RESOLVED',resolved_at=now()
          WHERE event_id=$1 AND event_version=$2 AND question_text=$3 AND status='OPEN'`,
          [current[0].content_event_id, current[0].content_event_version, faq.question]);
      }
      await tx.query('INSERT INTO audit(id,actor_id,event_id,action,detail) VALUES($1,$2,$3,$4,$5)',
        [randomUUID(), actor, current[0].content_event_id, 'CONTENT_REVIEW_OVERTURN', JSON.stringify({ contentId: current[0].content_id, appealId })]);
    }
    const { rows } = await tx.query<{ id: string; status: string; resolution: string | null; outcome: string | null }>(
      'UPDATE appeals SET status=$2,resolution=$3,resolved_by=$4,outcome=$5,updated_at=now() WHERE id=$1 RETURNING id,status,resolution,outcome',
      [appealId, status, status === 'RESOLVED' ? resolution!.trim() : null, status === 'RESOLVED' ? actor : null,
        status === 'RESOLVED' && current[0].content_id ? outcome : null]);
    await tx.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,status,external_status,detail)
      VALUES($1,NULL,$2,$3,0,'IN_APP','UNAVAILABLE',$4)`,
      [randomUUID(), current[0].appellant_id, status === 'RESOLVED' ? 'APPEAL_RESOLVED' : 'APPEAL_IN_REVIEW', JSON.stringify({ appealId })]);
    await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)', [randomUUID(), actor, 'APPEAL_STATUS', JSON.stringify({ appealId, status })]);
    return rows[0]!;
  });
}

export async function listMyRemovals(db: Database, actor: string) {
  const { rows } = await db.query('SELECT id,registration_id,event_id,reason,created_at FROM registration_removals WHERE user_id=$1 ORDER BY created_at DESC', [actor]);
  return rows;
}

export async function createPrivacyRequest(db: Database, actor: string, input: { kind?: string }, key: string,
  protectionSource: 'REQUEST_INTAKE' | 'STARTUP_REPAIR' = 'REQUEST_INTAKE') {
  if (!['EXPORT', 'DELETE', 'CORRECT'].includes(input.kind ?? '')) throw new AppError('BAD_REQUEST', '个人信息请求类型无效');
  if (input.kind !== 'DELETE') {
    return command(db, actor, 'privacy-request', key, async tx => {
      const { rows } = await tx.query<PrivacyRequestRow>(`INSERT INTO privacy_requests(id,user_id,kind) VALUES($1,$2,$3)
        RETURNING id,kind,status,protection_applied_at,consents_revoked_count,aliases_removed_count`,
      [randomUUID(), actor, input.kind]);
      await tx.query('INSERT INTO audit(id,actor_id,action) VALUES($1,$2,$3)', [randomUUID(), actor, 'CREATE_PRIVACY_REQUEST']);
      return privacyRequestWithNotice(rows[0]!);
    });
  }
  if (!actor || !key) throw new AppError('BAD_REQUEST', '身份与幂等键必填');
  return db.transaction(async tx => {
    // The final send and consent/alias grants hold this same user row through
    // their last checks. After this transaction commits, those operations can
    // observe the pending request before sending or publishing anything new.
    await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [actor]);
    const claimed = await claimIdempotency(tx, actor, 'privacy-request', key);
    let request: PrivacyRequestRow | undefined;
    if (!claimed) {
      const { rows: prior } = await tx.query<{ result: { id?: unknown; kind?: unknown } }>(
        'SELECT result FROM idempotency WHERE actor_id=$1 AND route=$2 AND key=$3', [actor, 'privacy-request', key]);
      if (prior[0]?.result?.kind !== 'DELETE' || typeof prior[0].result.id !== 'string')
        throw new AppError('IDEMPOTENCY_MISMATCH', '此幂等键已用于其他个人信息请求，请使用新键重试', 409);
      const { rows } = await tx.query<PrivacyRequestRow>(`SELECT id,kind,status,protection_applied_at,
        consents_revoked_count,aliases_removed_count FROM privacy_requests WHERE id=$1 AND user_id=$2 FOR UPDATE`,
      [prior[0].result.id, actor]);
      request = rows[0];
      if (!request) throw new AppError('NOT_FOUND', '原个人信息请求不存在', 404);
      if (['FULFILLED', 'CANCELLED'].includes(request.status)) return privacyRequestWithNotice(request);
    }
    if (!request) {
      const { rows: existing } = await tx.query<PrivacyRequestRow>(`SELECT id,kind,status,protection_applied_at,
        consents_revoked_count,aliases_removed_count FROM privacy_requests WHERE user_id=$1
        AND kind='DELETE' AND status NOT IN ('FULFILLED','CANCELLED') ORDER BY created_at,id LIMIT 1 FOR UPDATE`, [actor]);
      request = existing[0];
    }
    request ??= (await tx.query<PrivacyRequestRow>(`INSERT INTO privacy_requests(id,user_id,kind)
      VALUES($1,$2,'DELETE') RETURNING id,kind,status,protection_applied_at,
      consents_revoked_count,aliases_removed_count`, [randomUUID(), actor])).rows[0]!;
    const { rows: withdrawn } = await tx.query<{ purpose: NotificationPurpose }>(`UPDATE notification_consents
      SET granted=false,updated_at=clock_timestamp() WHERE user_id=$1
      AND purpose IN ('EVENT_REMINDER','SIMILAR_ACTIVITY_INVITES') AND granted=true RETURNING purpose`, [actor]);
    for (const row of withdrawn) {
      const notice = consentNotice(row.purpose);
      const withdrawalText = '因本人注销或删除申请，系统撤回此项授权。';
      const withdrawalVersion = createHash('sha256').update(
        `DELETE_REQUEST\n${row.purpose}\n${notice.scope}\n${withdrawalText}`).digest('hex');
      await tx.query(`INSERT INTO notification_consent_history
        (id,user_id,purpose,scope,notice_version,notice_text,granted,source)
        VALUES($1,$2,$3,$4,$5,$6,false,'DELETE_REQUEST')`,
      [randomUUID(), actor, row.purpose, notice.scope, withdrawalVersion, withdrawalText]);
    }
    const { rows: aliases } = await tx.query<{ event_id: string; notice_version: string | null }>(
      'DELETE FROM event_aliases WHERE user_id=$1 RETURNING event_id,notice_version', [actor]);
    for (const alias of aliases) {
      const notice = eventAliasNotice(alias.event_id);
      await tx.query(`INSERT INTO event_alias_consent_history
        (id,event_id,user_id,purpose,scope,notice_version,notice_text,granted,source)
        VALUES($1,$2,$3,$4,$5,$6,$7,false,'DELETE_REQUEST')`,
      [randomUUID(), alias.event_id, actor, notice.purpose, notice.scope,
        alias.notice_version ?? 'LEGACY_UNVERSIONED',
        alias.notice_version === notice.version ? notice.text : '']);
    }
    const { rows: protectedRows } = await tx.query<PrivacyRequestRow>(`UPDATE privacy_requests SET
      status=CASE WHEN status='OPEN' THEN 'PROTECTED_PENDING_POLICY' ELSE status END,
      protection_applied_at=COALESCE(protection_applied_at,clock_timestamp()),
      consents_revoked_count=consents_revoked_count+$2,aliases_removed_count=aliases_removed_count+$3
      WHERE id=$1 RETURNING id,kind,status,protection_applied_at,consents_revoked_count,aliases_removed_count`,
    [request.id, withdrawn.length, aliases.length]);
    // Older deployments could already contain more than one open request for
    // the same person. The account-level protection applies to every one, but
    // the withdrawal counts belong only to the request that performed it.
    const { rows: additionalRequests } = await tx.query<{ id: string }>(`UPDATE privacy_requests SET
      status=CASE WHEN status='OPEN' THEN 'PROTECTED_PENDING_POLICY' ELSE status END,
      protection_applied_at=COALESCE(protection_applied_at,$3)
      WHERE user_id=$1 AND id<>$2 AND kind='DELETE' AND status NOT IN ('FULFILLED','CANCELLED')
      AND (protection_applied_at IS NULL OR status='OPEN') RETURNING id`,
    [actor, request.id, protectedRows[0]!.protection_applied_at]);
    if (!request.protection_applied_at || withdrawn.length || aliases.length || additionalRequests.length) {
      await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
        [randomUUID(), actor, 'PRIVACY_DELETE_PROTECTED', JSON.stringify({ requestId: request.id,
          consentWithdrawals: withdrawn.length, aliasesRemoved: aliases.length,
          ...(additionalRequests.length ? { additionalRequestsProtected: additionalRequests.length } : {}),
          ...(protectionSource === 'STARTUP_REPAIR' ? { source: protectionSource } : {}) })]);
    }
    const receipt = privacyRequestWithNotice(protectedRows[0]!);
    await tx.query('UPDATE idempotency SET result=$4 WHERE actor_id=$1 AND route=$2 AND key=$3',
      [actor, 'privacy-request', key, JSON.stringify(receipt)]);
    return receipt;
  });
}

export async function protectPendingDeletionRequests(db: Database): Promise<number> {
  let protectedAccounts = 0;
  while (true) {
    const { rows } = await db.query<{ id: string; user_id: string }>(`SELECT DISTINCT ON (user_id) id,user_id
      FROM privacy_requests WHERE kind='DELETE' AND status NOT IN ('FULFILLED','CANCELLED')
      AND protection_applied_at IS NULL ORDER BY user_id,created_at,id LIMIT 100`);
    if (!rows.length) return protectedAccounts;
    for (const row of rows) {
      await createPrivacyRequest(db, row.user_id, { kind: 'DELETE' }, `startup-delete-protection:${row.id}`, 'STARTUP_REPAIR');
      protectedAccounts++;
    }
  }
}

type PrivacyRequestRow = { id: string; kind: string; status: string; protection_applied_at: Date | null;
  consents_revoked_count: number; aliases_removed_count: number };
type PrivacyRequestReceipt = Pick<PrivacyRequestRow, 'id' | 'kind' | 'status'> & {
  protection?: { state: 'APPLIED' | 'NOT_APPLIED'; appliedAt: string | null;
    consentWithdrawals: number; aliasesRemoved: number }; notice?: string
};

function privacyRequestWithNotice(request: PrivacyRequestRow): PrivacyRequestReceipt {
  const base = { id: request.id, kind: request.kind, status: request.status };
  if (request.kind !== 'DELETE' || ['FULFILLED', 'CANCELLED'].includes(request.status)) return base;
  const applied = Boolean(request.protection_applied_at);
  return { ...base, protection: { state: applied ? 'APPLIED' : 'NOT_APPLIED',
    appliedAt: request.protection_applied_at ? new Date(request.protection_applied_at).toISOString() : null,
    consentWithdrawals: request.consents_revoked_count, aliasesRemoved: request.aliases_removed_count },
  notice: applied
    ? '已收到注销或删除申请；已阻止后续外部通知和再约候选展示，撤回相关授权并移除活动内昵称（如有）。本次申请尚未停用账号、删除资料或去标识；共享活动记录、争议记录、保留依据和备份处理仍待负责人逐项核查。'
    : '已收到注销或删除申请；尚未停用账号、删除资料或去标识。共享活动记录与争议记录将按用途分别核查；隔离保留的依据和期限仍待负责人批准。处理结果会区分已删除、已停用、已去标识和隔离保留，不能承诺全部立即删除。' };
}

export async function listPrivacyRequests(db: Database, actor: string) {
  const { rows } = await db.query<PrivacyRequestRow>(`SELECT id,kind,status,protection_applied_at,
    consents_revoked_count,aliases_removed_count FROM privacy_requests WHERE user_id=$1 ORDER BY created_at DESC`, [actor]);
  return rows.map(privacyRequestWithNotice);
}

export async function listPrivacyForOperations(db: Database, offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', '个人信息请求页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取个人信息请求需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(id,kind,status,created_at)::text,',' ORDER BY id),'')) AS snapshot
      FROM privacy_requests`);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', '个人信息请求列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query(`SELECT id,user_id,kind,status,created_at FROM privacy_requests
      ORDER BY created_at,id LIMIT 100 OFFSET $1`, [offset]);
    const total = totals[0]!.total;
    return { items: rows, total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
      snapshot: currentSnapshot };
  });
}

export async function getPrivacyRequestImpact(db: Database, operator: string, requestId: string) {
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    const { rows: requests } = await tx.query<{ user_id: string; kind: string; status: string }>(
      'SELECT user_id,kind,status FROM privacy_requests WHERE id=$1 FOR SHARE', [requestId]);
    const request = requests[0];
    if (!request) throw new AppError('NOT_FOUND', '个人信息请求不存在', 404);
    if (request.kind !== 'DELETE') throw new AppError('BAD_REQUEST', '仅注销或删除请求需要影响清单');
    const { rows } = await tx.query<Record<string, number>>(
      `SELECT
       (SELECT count(*)::int FROM users WHERE id=$1) AS profile,
       (SELECT count(*)::int FROM sessions WHERE user_id=$1) AS sessions,
       (SELECT count(*)::int FROM events WHERE host_id=$1) AS hosted_events,
       (SELECT count(*)::int FROM registrations WHERE user_id=$1) AS registrations,
       (SELECT count(*)::int FROM registration_status_history h JOIN registrations r ON r.id=h.registration_id
         WHERE r.user_id=$1) AS registration_status_history,
       (SELECT count(*)::int FROM activity_content WHERE author_id=$1) AS authored_content,
       (SELECT count(*)::int FROM reports WHERE reporter_id=$1) AS reported_disputes,
       (SELECT count(*)::int FROM appeals WHERE appellant_id=$1) AS appeals,
       (SELECT count(*)::int FROM notifications WHERE user_id=$1) AS notifications,
       (SELECT count(*)::int FROM notification_consents WHERE user_id=$1) AS notification_consents,
       (SELECT count(*)::int FROM notification_consent_history WHERE user_id=$1) AS notification_consent_history,
       (SELECT count(*)::int FROM event_aliases WHERE user_id=$1) AS event_aliases,
       (SELECT count(*)::int FROM event_alias_consent_history WHERE user_id=$1) AS event_alias_consent_history,
       (SELECT count(*)::int FROM share_intents WHERE sender_id=$1) AS share_intents,
       (SELECT count(*)::int FROM personal_export_tickets WHERE user_id=$1) AS personal_export_tickets,
       (SELECT count(*)::int FROM user_blocks WHERE blocker_id=$1) AS blocks_created,
       (SELECT count(*)::int FROM user_blocks WHERE blocked_id=$1) AS blocks_received,
       (SELECT count(*)::int FROM event_versions v JOIN events e ON e.id=v.event_id WHERE e.host_id=$1) AS hosted_event_versions,
       (SELECT count(*)::int FROM event_status_history h JOIN events e ON e.id=h.event_id
         WHERE e.host_id=$1) AS hosted_event_status_history,
       (SELECT count(*)::int FROM outcomes o JOIN events e ON e.id=o.event_id WHERE e.host_id=$1) AS hosted_outcomes,
       (SELECT count(*)::int FROM outcome_reviews o JOIN events e ON e.id=o.event_id
         WHERE e.host_id=$1) AS hosted_outcome_reviews,
       (SELECT count(*)::int FROM outcome_reviews o JOIN reports r ON r.id=o.report_id
         WHERE r.reporter_id=$1) AS reported_outcome_reviews,
       (SELECT count(*)::int FROM venue_evidence v JOIN events e ON e.id=v.event_id WHERE e.host_id=$1) AS hosted_venue_evidence,
       (SELECT count(*)::int FROM expense_ledgers WHERE created_by=$1) AS created_expense_ledgers,
       (SELECT count(*)::int FROM share_opens WHERE user_id=$1) AS share_opens,
       (SELECT count(*)::int FROM invite_unknown_opens WHERE user_id=$1) AS unknown_source_invite_opens,
       (SELECT count(*)::int FROM reservations WHERE claimed_by=$1) AS claimed_reservations,
       (SELECT count(*)::int FROM offers o JOIN registrations r ON r.id=o.registration_id WHERE r.user_id=$1) AS waitlist_offers,
       (SELECT count(*)::int FROM offer_status_history h JOIN offers o ON o.id=h.offer_id
         JOIN registrations r ON r.id=o.registration_id WHERE r.user_id=$1) AS waitlist_offer_history,
       (SELECT count(*)::int FROM checkins WHERE user_id=$1) AS check_ins,
       (SELECT count(*)::int FROM manual_checkins WHERE user_id=$1) AS manual_check_ins,
       (SELECT count(*)::int FROM manual_checkins WHERE requested_by=$1) AS requested_manual_check_ins,
       (SELECT count(*)::int FROM outcome_feedback WHERE user_id=$1) AS outcome_feedback,
       (SELECT count(*)::int FROM expense_shares WHERE user_id=$1) AS expense_shares,
       (SELECT count(*)::int FROM activity_fact_todos WHERE requester_id=$1) AS fact_questions,
       (SELECT count(*)::int FROM registration_removals WHERE user_id=$1) AS registration_removals,
       (SELECT count(*)::int FROM privacy_requests WHERE user_id=$1) AS privacy_requests,
       (SELECT count(*)::int FROM audit WHERE actor_id=$1) AS audit_actions,
       (SELECT count(*)::int FROM business_events b JOIN audit a ON a.id=b.event_uuid WHERE a.actor_id=$1) AS business_events,
       (SELECT count(*)::int FROM cohost_grants WHERE user_id=$1) AS cohost_grants,
       (SELECT count(*)::int FROM cohost_grants WHERE granted_by=$1) AS cohost_grants_issued,
       (SELECT count(*)::int FROM idempotency WHERE actor_id=$1) AS idempotency_records,
       (SELECT count(*)::int FROM ai_draft_requests WHERE actor_id=$1) AS ai_draft_requests,
       (SELECT count(*)::int FROM ai_action_proposals WHERE actor_id=$1) AS ai_action_proposals`, [request.user_id]);
    const count = rows[0]!;
    await tx.query('INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
      [randomUUID(), operator, 'READ_PRIVACY_IMPACT', JSON.stringify({ requestId })]);
    return { requestId, status: request.status, assessmentStatus: 'POLICY_REVIEW_REQUIRED',
      inventoryScope: 'SELECTED_CATEGORIES_ONLY', counts: {
      profile: count.profile, sessions: count.sessions, hostedEvents: count.hosted_events,
      registrations: count.registrations, registrationStatusHistory: count.registration_status_history,
      authoredContent: count.authored_content,
      reportedDisputes: count.reported_disputes, appeals: count.appeals, notifications: count.notifications,
      notificationConsents: count.notification_consents, notificationConsentHistory: count.notification_consent_history,
      eventAliases: count.event_aliases, eventAliasConsentHistory: count.event_alias_consent_history,
      shareIntents: count.share_intents, personalExportTickets: count.personal_export_tickets,
      blocksCreated: count.blocks_created, blocksReceived: count.blocks_received,
      hostedEventVersions: count.hosted_event_versions,
      hostedEventStatusHistory: count.hosted_event_status_history, hostedOutcomes: count.hosted_outcomes,
      hostedOutcomeReviews: count.hosted_outcome_reviews, reportedOutcomeReviews: count.reported_outcome_reviews,
      hostedVenueEvidence: count.hosted_venue_evidence, createdExpenseLedgers: count.created_expense_ledgers,
      shareOpens: count.share_opens, unknownSourceInviteOpens: count.unknown_source_invite_opens,
      claimedReservations: count.claimed_reservations, waitlistOffers: count.waitlist_offers,
      waitlistOfferHistory: count.waitlist_offer_history,
      checkIns: count.check_ins, manualCheckIns: count.manual_check_ins,
      requestedManualCheckIns: count.requested_manual_check_ins, outcomeFeedback: count.outcome_feedback,
      expenseShares: count.expense_shares, factQuestions: count.fact_questions,
      registrationRemovals: count.registration_removals, privacyRequests: count.privacy_requests,
      auditActions: count.audit_actions, businessEvents: count.business_events,
      cohostGrants: count.cohost_grants, cohostGrantsIssued: count.cohost_grants_issued,
      idempotencyRecords: count.idempotency_records, aiDraftRequests: count.ai_draft_requests,
      aiActionProposals: count.ai_action_proposals
    } };
  });
}
