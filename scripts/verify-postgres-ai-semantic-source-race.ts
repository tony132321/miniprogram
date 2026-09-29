import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION, type Database } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { publishApprovedInvite, register } from '../test/helpers.ts';
import { askCurrentFact, createContent, moderateContent } from '../src/collaboration.ts';
import { askSemanticCurrentFact, type SemanticFactProvider } from '../src/ai-semantic-answer.ts';
import { assertEmptyPostgresTestDatabase, validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const databaseName = validatePostgresTestUrl(url);
const probe = new pg.Pool({ connectionString: url, max: 1 });
try { await assertEmptyPostgresTestDatabase(probe, databaseName); }
finally { await probe.end(); }

const db = await createProductionDatabase(url);
const writerPool = new pg.Pool({ connectionString: url, max: 2 });
const input = {
  title: '语义竞争合成活动', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
  endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
  venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
  maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
  confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
  cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
};
const provider: SemanticFactProvider = {
  estimateUpperBoundFen: () => 5,
  suggest: async (_question, context) => ({ sourceContentId: context.announcements[0]?.sourceContentId,
    eventVersion: context.event.version, confidence: 0.99, costFen: 5,
    evidence: { modelVersion: 'postgres-fixture-v1', promptHash: 'b'.repeat(64),
      usage: { inputTokens: 10, outputTokens: 3 }, receipt: { status: 'ACCEPTED', reference: 'synthetic-pg-race' } } })
};

async function waitForLock(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const { rows } = await writerPool.query<{ waiting: boolean }>(
      "SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1", [pid]);
    if (rows[0]?.waiting) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('the second PostgreSQL connection did not wait for the source lock');
}

async function verifyLock(label: string, matches: (sql: string) => boolean,
  ask: (raceDb: Database) => Promise<{ answer: string }>,
  updateSql: string, updateParams: unknown[], replay: () => Promise<unknown>): Promise<void> {
  let signalLocked!: () => void;
  let releaseRead!: () => void;
  const locked = new Promise<void>(resolve => { signalLocked = resolve; });
  const released = new Promise<void>(resolve => { releaseRead = resolve; });
  let intercepted = false;
  const raceDb: Database = {
    query: (sql, params) => db.query(sql, params), close: () => db.close(),
    transaction: fn => db.transaction(tx => fn({ query: async <T extends Record<string, unknown>>(
      sql: string, params: unknown[] = []) => {
      const result = await tx.query<T>(sql, params);
      if (!intercepted && matches(sql)) {
        intercepted = true;
        signalLocked();
        await released;
      }
      return result;
    } }))
  };
  const writer = await writerPool.connect();
  try {
    const { rows: pidRows } = await writer.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const pendingAnswer = ask(raceDb);
    await Promise.race([locked, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} did not lock`)), 5000))]);
    const pendingWrite = writer.query(updateSql, updateParams);
    await waitForLock(pidRows[0]!.pid);
    releaseRead();
    const answer = await pendingAnswer;
    assert.ok(answer.answer, `${label} did not return a persisted answer`);
    await pendingWrite;
    await assert.rejects(replay, { code: 'VERSION_CONFLICT' }, `${label} replay exposed a changed source`);
    process.stdout.write(`${label}=writer_waited_then_replay_rejected\n`);
  } finally {
    releaseRead();
    writer.release();
  }
}

async function verifyPrivacyLockOrder(eventId: string, contentId: string): Promise<void> {
  let signalContentLock!: () => void;
  let releaseContentRead!: () => void;
  const contentLocked = new Promise<void>(resolve => { signalContentLock = resolve; });
  const readReleased = new Promise<void>(resolve => { releaseContentRead = resolve; });
  let intercepted = false;
  const raceDb: Database = {
    query: (sql, params) => db.query(sql, params), close: () => db.close(),
    transaction: fn => db.transaction(tx => fn({ query: async <T extends Record<string, unknown>>(
      sql: string, params: unknown[] = []) => {
      const result = await tx.query<T>(sql, params);
      if (!intercepted && sql.includes("kind='ANNOUNCEMENT' AND status='APPROVED' FOR SHARE")) {
        intercepted = true;
        signalContentLock();
        await readReleased;
      }
      return result;
    } }))
  };
  const writer = await writerPool.connect();
  try {
    const pendingAnswer = askSemanticCurrentFact(raceDb, 'pg_member', eventId,
      '要自带球拍吗？', 'pg-inverted-lock-key', provider, { budgetFen: 10, environment: 'test' });
    await Promise.race([contentLocked,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('semantic content lock was not reached')), 5000))]);
    await writer.query('BEGIN');
    await writer.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [eventId]);
    const { rows: pidRows } = await writer.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const pendingWrite = writer.query("UPDATE activity_content SET body='[已移除的个人内容]' WHERE id=$1", [contentId]);
    await waitForLock(pidRows[0]!.pid);
    releaseContentRead();
    await assert.rejects(Promise.race([pendingAnswer,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('semantic final wait deadlocked')), 5000))]),
    { code: 'VERSION_CONFLICT' });
    await Promise.race([pendingWrite,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('privacy writer deadlocked')), 5000))]);
    await writer.query('COMMIT');
    const { rows } = await db.query<{ status: string; known_cost_fen: number; cost_status: string }>(
      "SELECT status,known_cost_fen,cost_status FROM ai_semantic_requests WHERE request_key='pg-inverted-lock-key'");
    assert.deepEqual(rows, [{ status: 'UNKNOWN', known_cost_fen: 5, cost_status: 'KNOWN' }]);
    process.stdout.write('privacyEventFirst=nowait_rejected_no_deadlock_cost_recorded\n');
  } catch (error) {
    await writer.query('ROLLBACK');
    throw error;
  } finally {
    releaseContentRead();
    writer.release();
  }
}

async function verifyContentEventRecheck(): Promise<void> {
  const draft = await createDraft(db, 'pg_host', { ...input, title: '内容权限竞态活动' }, 'pg-content-lock-draft');
  const event = await publishApprovedInvite(db, 'pg_host', draft.id, draft.version, 'pg-content-lock-publish');
  let signalPid!: (pid: number) => void;
  const contentPid = new Promise<number>(resolve => { signalPid = resolve; });
  const raceDb: Database = {
    query: (sql, params) => db.query(sql, params), close: () => db.close(),
    transaction: fn => db.transaction(async tx => {
      const { rows } = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      signalPid(rows[0]!.pid);
      return fn(tx);
    })
  };
  const writer = await writerPool.connect();
  try {
    await writer.query('BEGIN');
    await writer.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [event.id]);
    await writer.query("UPDATE events SET status='CANCELLED' WHERE id=$1", [event.id]);
    const pendingContent = createContent(raceDb, 'pg_host', event.id, 'ANNOUNCEMENT',
      '这条公告不得在取消后写入', null, 'pg-content-lock-key');
    await waitForLock(await contentPid);
    await writer.query('COMMIT');
    await assert.rejects(pendingContent, { code: 'INVALID_STATE' });
    const { rows } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM activity_content WHERE event_id=$1 AND body='这条公告不得在取消后写入'", [event.id]);
    assert.equal(rows[0]?.n, 0);
    process.stdout.write('contentEventRecheck=cancelled_before_reader_rejected\n');
  } catch (error) {
    await writer.query('ROLLBACK');
    throw error;
  } finally { writer.release(); }
}

try {
  const { rows: versions } = await db.query<{ version: number }>('SELECT max(version)::int AS version FROM schema_migrations');
  assert.equal(versions[0]?.version, LATEST_SCHEMA_VERSION);
  const draft = await createDraft(db, 'pg_host', input, 'pg-semantic-draft');
  const event = await publishApprovedInvite(db, 'pg_host', draft.id, draft.version, 'pg-semantic-publish');
  await register(db, 'pg_member', event.id, event.version, 'pg-semantic-join');

  const announcement = await createContent(db, 'pg_host', event.id, 'ANNOUNCEMENT',
    '问：需要自带球拍吗？\n答：请自带球拍。', null, 'pg-announcement');
  await moderateContent(db, 'operator:reviewer', announcement.id, 'APPROVED', 'pg-announcement-approve');
  await verifyLock('approvedAnnouncement', sql => sql.includes("kind='ANNOUNCEMENT' AND status='APPROVED' FOR SHARE"),
    raceDb => askSemanticCurrentFact(raceDb, 'pg_member', event.id, '要自带球拍吗？', 'pg-announcement-key', provider,
      { budgetFen: 10, environment: 'test' }),
    "UPDATE activity_content SET body='[已移除的个人内容]' WHERE id=$1", [announcement.id],
    () => askSemanticCurrentFact(db, 'pg_member', event.id, '要自带球拍吗？', 'pg-announcement-key', provider,
      { budgetFen: 10, environment: 'test' }));

  const unknown = await askCurrentFact(db, 'pg_member', event.id, '有停车场吗？', 'pg-fact-question');
  const { rows: todos } = await db.query<{ question_content_id: string }>(
    'SELECT question_content_id FROM activity_fact_todos WHERE id=$1', [unknown.todoId]);
  await moderateContent(db, 'operator:reviewer', todos[0]!.question_content_id, 'APPROVED', 'pg-question-approve');
  const approvedAnswer = await createContent(db, 'pg_host', event.id, 'ANSWER',
    '停车场入口在东门。', todos[0]!.question_content_id, 'pg-answer');
  await moderateContent(db, 'operator:reviewer', approvedAnswer.id, 'APPROVED', 'pg-answer-approve');
  await verifyLock('approvedAnswer', sql => sql.includes('SELECT a.body,a.parent_id FROM activity_content a') && sql.includes('FOR SHARE'),
    raceDb => askSemanticCurrentFact(raceDb, 'pg_member', event.id, '有停车场吗？', 'pg-answer-key'),
    "UPDATE activity_content SET body='[已移除的个人内容]' WHERE id=$1", [approvedAnswer.id],
    () => askSemanticCurrentFact(db, 'pg_member', event.id, '有停车场吗？', 'pg-answer-key'));

  const secondAnswer = await createContent(db, 'pg_host', event.id, 'ANSWER',
    '停车场入口在西门。', todos[0]!.question_content_id, 'pg-answer-second');
  await moderateContent(db, 'operator:reviewer', secondAnswer.id, 'APPROVED', 'pg-answer-second-approve');
  await verifyLock('approvedAnswerTodo', sql => sql.includes('FROM activity_fact_todos WHERE id=$1') && sql.includes('FOR SHARE'),
    raceDb => askSemanticCurrentFact(raceDb, 'pg_member', event.id, '有停车场吗？', 'pg-answer-todo-key'),
    "UPDATE activity_fact_todos SET question_text='[已移除的个人提问]' WHERE id=$1", [unknown.todoId],
    () => askSemanticCurrentFact(db, 'pg_member', event.id, '有停车场吗？', 'pg-answer-todo-key'));
  const lockOrderContent = await createContent(db, 'pg_host', event.id, 'ANNOUNCEMENT',
    '问：需要自带球拍吗？\n答：请自带球拍。', null, 'pg-inverted-lock-announcement');
  await moderateContent(db, 'operator:reviewer', lockOrderContent.id, 'APPROVED', 'pg-inverted-lock-approve');
  await verifyPrivacyLockOrder(event.id, lockOrderContent.id);
  await verifyContentEventRecheck();
  process.stdout.write(`schemaVersion=${LATEST_SCHEMA_VERSION} independentConnections=2\n`);
} finally {
  await writerPool.end();
  await db.close();
}
