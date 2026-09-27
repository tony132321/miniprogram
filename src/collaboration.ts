import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db.ts';
import { getEvent } from './events.ts';
import { AppError } from './errors.ts';
import { audit, command } from './registrations.ts';
import { parseAnnouncementFaq } from './announcement-faq.ts';
import { hasCohostCapability } from './cohosts.ts';

export type ContentKind = 'ANNOUNCEMENT' | 'QUESTION' | 'ANSWER';
export type ContentStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type ContentRow = { id: string; event_id: string; author_id: string; kind: ContentKind; parent_id: string | null; body: string; status: ContentStatus;
  moderation_reason?: string | null; event_version?: number | null; fact_event_version?: number | null; created_at: Date };

export async function requireMember(db: Queryable, actor: string, eventId: string) {
  const event = await getEvent(db, actor, eventId);
  if (event.hostId !== actor && !event.cohostCapabilities?.length) {
    const { rows } = await db.query("SELECT 1 FROM registrations WHERE event_id=$1 AND user_id=$2 AND status IN ('CONFIRMED','RECONFIRM_REQUIRED','WAITLISTED','OFFERED')", [eventId, actor]);
    if (!rows.length) throw new AppError('FORBIDDEN', '无权访问活动协作内容', 403);
  }
  return event;
}

function localTime(value: string): string {
  return new Date(Date.parse(value) + 8 * 60 * 60_000).toISOString().slice(0, 16).replace('T', ' ');
}

function answerFromCurrentEvent(question: string, event: Awaited<ReturnType<typeof getEvent>>): string | null {
  const p = event.payload;
  if (/几点开始|什么时候开始|开始时间/.test(question) && p.startAt)
    return `当前版本 ${event.version}：活动开始时间为 ${localTime(p.startAt)}（Asia/Shanghai）。`;
  if (/几点结束|什么时候结束|结束时间/.test(question) && p.endAt)
    return `当前版本 ${event.version}：活动结束时间为 ${localTime(p.endAt)}（Asia/Shanghai）。`;
  if (/地点|场地|球馆|在哪里/.test(question) && p.venueStatus === 'HOST_CONFIRMED' && p.venueName)
    return `当前版本 ${event.version}：主办方已确认公共场地为 ${p.city} ${p.venueName}；平台未核验场馆库存。`;
  if (/费用|多少钱|收费|免费/.test(question) && p.feeMode)
    return p.feeMode === 'FREE' ? `当前版本 ${event.version}：活动规则写明免费。`
      : p.feeCapFen !== undefined ? `当前版本 ${event.version}：AA，每人费用上限 ${p.feeCapFen / 100} 元；实际费用以结项记录为准。` : null;
  return null;
}

export type FactAnswer = { answer: string; source: 'CURRENT_EVENT' | 'APPROVED_ANSWER' | 'APPROVED_ANNOUNCEMENT' | 'UNKNOWN';
  eventVersion: number; todoId?: string; sourceContentId?: string };

export async function askCurrentFact(db: Database, actor: string, eventId: string, question: string, key: string): Promise<FactAnswer> {
  return command(db, actor, `current-fact:${eventId}`, key, async tx => {
    if (typeof question !== 'string' || !question.trim() || question.length > 200) throw new AppError('BAD_REQUEST', '问题需为 1 至 200 字');
    const event = await requireMember(tx, actor, eventId);
    const { rows: locked } = await tx.query<{ version: number }>('SELECT version FROM events WHERE id=$1 FOR SHARE', [eventId]);
    if (locked[0]?.version !== event.version) throw new AppError('VERSION_CONFLICT', '活动规则已更新，请刷新', 409);
    if (!['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(event.status)) throw new AppError('INVALID_STATE', '当前活动不能提问');
    const cleanQuestion = question.trim();
    const answer = answerFromCurrentEvent(cleanQuestion, event);
    if (answer) return { answer, source: 'CURRENT_EVENT', eventVersion: event.version };
    const { rows: approved } = await tx.query<{ id: string; body: string }>(
      `SELECT t.id,a.body FROM activity_fact_todos t JOIN activity_content a ON a.parent_id=t.question_content_id
        AND a.kind='ANSWER' AND a.status='APPROVED' WHERE t.event_id=$1 AND t.event_version=$2
        AND t.question_text=$3 AND t.status='RESOLVED' ORDER BY a.created_at DESC,a.id DESC LIMIT 1`,
      [eventId, event.version, cleanQuestion]);
    if (approved[0]) return { answer: `当前版本 ${event.version}，主办方已审核回答：${approved[0].body}`,
      source: 'APPROVED_ANSWER', eventVersion: event.version, todoId: approved[0].id };
    const { rows: announcements } = await tx.query<{ id: string; body: string }>(
      `SELECT id,body FROM activity_content WHERE event_id=$1 AND event_version=$2
       AND kind='ANNOUNCEMENT' AND status='APPROVED' ORDER BY created_at DESC,id DESC`, [eventId, event.version]);
    for (const announcement of announcements) {
      const faq = parseAnnouncementFaq(announcement.body);
      if (faq?.question === cleanQuestion) return { answer: `当前版本 ${event.version}，已审核公告：${faq.answer}`,
        source: 'APPROVED_ANNOUNCEMENT', eventVersion: event.version, sourceContentId: announcement.id };
    }
    const previous = await tx.query<{ id: string; status: string; question_content_id: string }>(
      'SELECT id,status,question_content_id FROM activity_fact_todos WHERE event_id=$1 AND event_version=$2 AND requester_id=$3 AND question_text=$4',
      [eventId, event.version, actor, cleanQuestion]);
    if (previous.rows[0]) {
      const todo = previous.rows[0];
      if (todo.status === 'RESOLVED') {
        const { rows: reviewed } = await tx.query<{ body: string }>(
          "SELECT body FROM activity_content WHERE parent_id=$1 AND kind='ANSWER' AND status='APPROVED' ORDER BY created_at DESC,id DESC LIMIT 1",
          [todo.question_content_id]);
        if (reviewed[0]) return { answer: `当前版本 ${event.version}，主办方已审核回答：${reviewed[0].body}`,
          source: 'APPROVED_ANSWER', eventVersion: event.version, todoId: todo.id };
      }
      return { answer: todo.status === 'REJECTED' ? '该问题未通过内容审核，请调整提问方式。'
        : '尚未确认。问题已进入人工审核与主办方待办，审核通过后可由主办方回答。',
      source: 'UNKNOWN', eventVersion: event.version, todoId: todo.id };
    }
    const { rows: openTodos } = await tx.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM activity_fact_todos WHERE event_id=$1 AND requester_id=$2 AND status='OPEN'", [eventId, actor]);
    if ((openTodos[0]?.n ?? 0) >= 5) throw new AppError('TOO_MANY_QUESTIONS', '已有 5 个待处理问题，请等待主办方回复', 429);
    const contentId = randomUUID(); const todoId = randomUUID();
    await tx.query('INSERT INTO activity_content(id,event_id,author_id,kind,body,event_version) VALUES($1,$2,$3,$4,$5,$6)',
      [contentId, eventId, actor, 'QUESTION', cleanQuestion, event.version]);
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO activity_fact_todos(id,event_id,event_version,requester_id,question_text,question_content_id)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
      [todoId, eventId, event.version, actor, cleanQuestion, contentId]);
    if (!inserted.rows.length) {
      await tx.query('DELETE FROM activity_content WHERE id=$1', [contentId]);
      const { rows: existing } = await tx.query<{ id: string }>(
        'SELECT id FROM activity_fact_todos WHERE event_id=$1 AND event_version=$2 AND requester_id=$3 AND question_text=$4',
        [eventId, event.version, actor, cleanQuestion]);
      return { answer: '尚未确认。问题已进入人工审核与主办方待办，审核通过后可由主办方回答。',
        source: 'UNKNOWN', eventVersion: event.version, todoId: existing[0]!.id };
    }
    await audit(tx, actor, eventId, 'UNKNOWN_FACT_QUESTION');
    return { answer: '尚未确认。问题已进入人工审核与主办方待办，审核通过后可由主办方回答。', source: 'UNKNOWN',
      eventVersion: event.version, todoId };
  });
}

export async function listFactTodos(db: Database, actor: string, eventId: string): Promise<Array<{
  id: string; questionContentId: string; question: string; eventVersion: number; status: string
}>> {
  const event = await getEvent(db, actor, eventId);
  if (event.hostId !== actor) throw new AppError('FORBIDDEN', '只有主办方可查看事实待办', 403);
  const { rows } = await db.query<{ id: string; question_content_id: string; body: string; event_version: number; status: string }>(
    `SELECT t.id,t.question_content_id,c.body,t.event_version,t.status FROM activity_fact_todos t
      JOIN activity_content c ON c.id=t.question_content_id WHERE t.event_id=$1 AND t.event_version=$2 AND c.status='APPROVED'
      ORDER BY t.created_at DESC LIMIT 100`, [eventId, event.version]);
  return rows.map(row => ({ id: row.id, questionContentId: row.question_content_id, question: row.body,
    eventVersion: row.event_version, status: row.status }));
}

export async function createContent(db: Database, actor: string, eventId: string, kind: ContentKind, body: string, parentId: string | null, key: string): Promise<ContentRow> {
  return command(db, actor, `content:${eventId}`, key, async tx => {
    const event = await requireMember(tx, actor, eventId);
    const { rows: locked } = await tx.query<{ version: number }>('SELECT version FROM events WHERE id=$1 FOR SHARE', [eventId]);
    if (locked[0]?.version !== event.version) throw new AppError('VERSION_CONFLICT', '活动规则已更新，请刷新', 409);
    if (!['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(event.status)) throw new AppError('INVALID_STATE', '当前活动不能发布内容');
    if (!['ANNOUNCEMENT', 'QUESTION', 'ANSWER'].includes(kind) || typeof body !== 'string' || !body.trim() || body.length > 1000)
      throw new AppError('BAD_REQUEST', '内容无效或超长');
    if ((kind === 'ANNOUNCEMENT' || kind === 'ANSWER') && event.hostId !== actor &&
      !(await hasCohostCapability(tx, actor, eventId, 'MANAGE_ANNOUNCEMENTS')))
      throw new AppError('FORBIDDEN', '只有主办方或获本活动公告权限的协办可以发布公告或回答', 403);
    if (kind === 'ANSWER') {
      const { rows } = await tx.query<{ kind: string; status: string; fact_event_version: number | null }>(
        `SELECT c.kind,c.status,t.event_version AS fact_event_version FROM activity_content c
         LEFT JOIN activity_fact_todos t ON t.question_content_id=c.id WHERE c.id=$1 AND c.event_id=$2`, [parentId, eventId]);
      if (!rows[0] || rows[0].kind !== 'QUESTION' || rows[0].status !== 'APPROVED') throw new AppError('INVALID_PARENT', '只能回答已审核通过的活动问题');
      if (rows[0].fact_event_version !== null && rows[0].fact_event_version !== event.version)
        throw new AppError('INVALID_PARENT', '旧版事实问题只供历史查看，请重新提交当前版本问题', 409);
    } else if (parentId) throw new AppError('BAD_REQUEST', '该内容不应有父项');
    const id = randomUUID();
    const { rows } = await tx.query<ContentRow>(
      'INSERT INTO activity_content(id,event_id,author_id,kind,parent_id,body,event_version) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [id, eventId, actor, kind, parentId, body.trim(), event.version]);
    await audit(tx, actor, eventId, `CONTENT_${kind}`);
    return rows[0]!;
  });
}

export async function listContent(db: Database, actor: string, eventId: string): Promise<ContentRow[]> {
  await requireMember(db, actor, eventId);
  const { rows } = await db.query<ContentRow>(`SELECT c.id,c.event_id,c.author_id,c.kind,c.parent_id,c.body,c.status,c.event_version,
    CASE WHEN c.author_id=$2 THEN c.moderation_reason ELSE NULL END AS moderation_reason,t.event_version AS fact_event_version,c.created_at
    FROM activity_content c LEFT JOIN activity_fact_todos t ON t.question_content_id=c.id
    WHERE c.event_id=$1 AND (c.status='APPROVED' OR c.author_id=$2) ORDER BY c.created_at,c.id`, [eventId, actor]);
  return rows;
}

export async function listMyRejectedContent(db: Database, actor: string) {
  const { rows } = await db.query<ContentRow & { appeal_id: string | null; appeal_status: string | null }>(
    `SELECT c.id,c.event_id,c.author_id,c.kind,c.parent_id,c.body,c.status,c.moderation_reason,c.created_at,
      a.id AS appeal_id,a.status AS appeal_status FROM activity_content c LEFT JOIN appeals a ON a.content_id=c.id
      WHERE c.author_id=$1 AND c.status='REJECTED' ORDER BY c.created_at DESC,c.id DESC`, [actor]);
  return rows;
}

export async function listPendingContent(db: Database, offset = 0, snapshot?: string | null) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_647)
    throw new AppError('BAD_REQUEST', '内容审核列表页码无效');
  if (offset > 0 && (!snapshot || !/^[a-f0-9]{32}$/.test(snapshot)))
    throw new AppError('BAD_REQUEST', '继续读取内容审核需要有效快照');
  return db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: totals } = await tx.query<{ total: number; snapshot: string }>(`SELECT count(*)::int AS total,
      md5(COALESCE(string_agg(jsonb_build_array(id,created_at,kind,parent_id,body)::text,',' ORDER BY id),'')) AS snapshot
      FROM activity_content WHERE status='PENDING_REVIEW'`);
    const currentSnapshot = totals[0]!.snapshot;
    if (offset > 0 && snapshot !== currentSnapshot)
      throw new AppError('QUEUE_CHANGED', '内容审核列表已变化，请从第一页刷新', 409);
    const { rows } = await tx.query<ContentRow>(`SELECT id,event_id,author_id,kind,parent_id,body,status,created_at
      FROM activity_content WHERE status='PENDING_REVIEW' ORDER BY created_at,id LIMIT 100 OFFSET $1`, [offset]);
    const total = totals[0]!.total;
    return { items: rows, total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
      snapshot: currentSnapshot };
  });
}

export async function moderateContent(db: Database, actor: string, contentId: string, status: 'APPROVED' | 'REJECTED', key: string, reason?: string): Promise<ContentRow> {
  if (!['APPROVED', 'REJECTED'].includes(status)) throw new AppError('BAD_REQUEST', '审核结果无效');
  if (status === 'REJECTED' && (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500))
    throw new AppError('BAD_REQUEST', '驳回原因需为 5 至 500 字');
  return command(db, actor, `moderate-content:${contentId}`, key, async tx => {
    const { rows } = await tx.query<ContentRow>('SELECT * FROM activity_content WHERE id=$1 FOR UPDATE', [contentId]);
    const item = rows[0];
    if (!item) throw new AppError('NOT_FOUND', '内容不存在', 404);
    if (item.status !== 'PENDING_REVIEW') throw new AppError('INVALID_STATE', '内容已审核');
    if (item.kind === 'ANSWER' && status === 'APPROVED' && item.parent_id) {
      const { rows: locked } = await tx.query<{ version: number }>('SELECT version FROM events WHERE id=$1 FOR SHARE', [item.event_id]);
      const { rows: facts } = await tx.query<{ event_version: number }>(
        'SELECT event_version FROM activity_fact_todos WHERE question_content_id=$1', [item.parent_id]);
      if (facts[0] && facts[0].event_version !== locked[0]?.version)
        throw new AppError('INVALID_STATE', '旧版事实回答不能作为当前活动回答通过审核', 409);
    }
    const { rows: updated } = await tx.query<ContentRow>(
      'UPDATE activity_content SET status=$2,moderated_by=$3,moderated_at=now(),moderation_reason=$4 WHERE id=$1 RETURNING *',
      [contentId, status, actor, status === 'REJECTED' ? reason!.trim() : null]);
    if (item.kind === 'QUESTION' && status === 'REJECTED')
      await tx.query("UPDATE activity_fact_todos SET status='REJECTED' WHERE question_content_id=$1 AND status='OPEN'", [contentId]);
    if (item.kind === 'ANSWER' && status === 'APPROVED' && item.parent_id)
      await tx.query("UPDATE activity_fact_todos SET status='RESOLVED',resolved_at=now() WHERE question_content_id=$1 AND status='OPEN'", [item.parent_id]);
    if (item.kind === 'ANNOUNCEMENT' && status === 'APPROVED' && item.event_version) {
      const faq = parseAnnouncementFaq(item.body);
      if (faq) {
        const { rows: currentEvent } = await tx.query<{ version: number }>('SELECT version FROM events WHERE id=$1 FOR SHARE', [item.event_id]);
        if (currentEvent[0]?.version === item.event_version)
          await tx.query(`UPDATE activity_fact_todos SET status='RESOLVED',resolved_at=now()
            WHERE event_id=$1 AND event_version=$2 AND question_text=$3 AND status='OPEN'`,
            [item.event_id, item.event_version, faq.question]);
      }
    }
    if (status === 'REJECTED') {
      const { rows: events } = await tx.query<{ version: number }>('SELECT version FROM events WHERE id=$1', [item.event_id]);
      await tx.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,status,external_status,detail)
        VALUES($1,$2,$3,'CONTENT_REJECTED',$4,'IN_APP','UNAVAILABLE',$5)`,
        [randomUUID(), item.event_id, item.author_id, events[0]!.version, JSON.stringify({ contentId })]);
    }
    await audit(tx, actor, item.event_id, `MODERATE_${status}`);
    return updated[0]!;
  });
}
