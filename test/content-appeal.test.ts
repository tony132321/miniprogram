import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { changeApprovedInvite, publishApprovedInvite } from './helpers.ts';
import { register } from './helpers.ts';
import { askCurrentFact, createContent, listContent, listFactTodos, moderateContent } from '../src/collaboration.ts';
import { createAppeal, listAppeals, listMyAppeals, changeAppealStatus } from '../src/operations.ts';

const input = { title: '内容复核测试', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z', endAt: '2027-01-02T14:00:00.000Z',
  timeZone: 'Asia/Shanghai', city: '深圳', venueName: '公共场馆', venueStatus: 'HOST_CONFIRMED', minParticipants: 4, maxParticipants: 4,
  registrationDeadline: '2027-01-02T11:30:00.000Z', confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE',
  feeCapFen: 0, cancellationRule: '开始前可退出', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true };

test('rejected content has an owner-only appeal and independent reversal restores the question todo', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'content-appeal-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'content-appeal-publish');
    await register(db, 'author', event.id, event.version, 'content-appeal-author');
    await register(db, 'member', event.id, event.version, 'content-appeal-member');
    const fact = await askCurrentFact(db, 'author', event.id, '需要自带球拍吗？', 'content-appeal-question');
    const { rows: questions } = await db.query<{ question_content_id: string }>('SELECT question_content_id FROM activity_fact_todos WHERE id=$1', [fact.todoId]);
    const contentId = questions[0]!.question_content_id;
    await assert.rejects(() => createAppeal(db, 'author', { contentId, description: '请复核问题' }, 'too-early'), { code: 'INVALID_STATE' });
    await moderateContent(db, 'moderator', contentId, 'REJECTED', 'reject-content', '请核对活动语境后重审');
    assert.equal((await listContent(db, 'author', event.id))[0]?.status, 'REJECTED');
    assert.equal((await listContent(db, 'author', event.id))[0]?.moderation_reason, '请核对活动语境后重审');
    assert.deepEqual(await listContent(db, 'member', event.id), []);
    await assert.rejects(() => createAppeal(db, 'member', { contentId, description: '伪造申诉' }, 'fake-content-appeal'), { code: 'FORBIDDEN' });
    const appeal = await createAppeal(db, 'author', { contentId, description: '我认为问题符合活动规则，请重新审核' }, 'content-appeal');
    await assert.rejects(() => createAppeal(db, 'author', { contentId, description: '重复提交' }, 'content-appeal-again'), { code: 'INVALID_STATE' });
    assert.equal((await listMyAppeals(db, 'author'))[0]?.content_id, contentId);
    assert.deepEqual(await listMyAppeals(db, 'member'), []);
    const opsAppeal = (await listAppeals(db)).items.find(item => item.id === appeal.id);
    assert.equal(opsAppeal?.content_body, '需要自带球拍吗？');
    assert.equal(opsAppeal?.content_moderation_reason, '请核对活动语境后重审');
    await assert.rejects(() => changeAppealStatus(db, 'moderator', appeal.id, 'RESOLVED', '维持原审核结论', 'self-review', 'UPHOLD'), { code: 'INVALID_STATE' });
    await assert.rejects(() => changeAppealStatus(db, 'reviewer', appeal.id, 'RESOLVED', '已重新核查问题', 'missing-outcome'), { code: 'BAD_REQUEST' });
    const result = await changeAppealStatus(db, 'reviewer', appeal.id, 'RESOLVED', '复核后撤销原驳回', 'reverse-content', 'OVERTURN');
    assert.equal(result.status, 'RESOLVED');
    assert.equal((await listContent(db, 'member', event.id))[0]?.status, 'APPROVED');
    assert.equal((await listContent(db, 'member', event.id))[0]?.moderation_reason, null);
    assert.equal((await listFactTodos(db, 'host', event.id))[0]?.status, 'OPEN');
    assert.equal((await db.query("SELECT count(*)::int AS n FROM notifications WHERE user_id='author' AND kind='CONTENT_REJECTED'")).rows[0]?.n, 1);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM notifications WHERE user_id='author' AND kind='APPEAL_RESOLVED'")).rows[0]?.n, 1);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM notifications WHERE user_id='member' AND kind='APPEAL_RESOLVED'")).rows[0]?.n, 0);
    const secondQuestion = await createContent(db, 'author', event.id, 'QUESTION', '另一条问题', null, 'second-question');
    await moderateContent(db, 'moderator', secondQuestion.id, 'REJECTED', 'second-rejection', '这条问题与活动无关');
    const secondAppeal = await createAppeal(db, 'author', { contentId: secondQuestion.id, description: '请求复核第二条问题' }, 'second-appeal');
    await changeAppealStatus(db, 'reviewer', secondAppeal.id, 'RESOLVED', '维持不予公开结论', 'uphold-second', 'UPHOLD');
    assert.equal((await listContent(db, 'member', event.id)).some(item => item.id === secondQuestion.id), false);
    assert.equal((await listMyAppeals(db, 'author')).find(item => item.id === secondAppeal.id)?.outcome, 'UPHOLD');
    const staleFact = await askCurrentFact(db, 'author', event.id, '现场提供饮用水吗？', 'old-version-fact');
    const { rows: staleQuestions } = await db.query<{ question_content_id: string }>(
      'SELECT question_content_id FROM activity_fact_todos WHERE id=$1', [staleFact.todoId]);
    const staleContentId = staleQuestions[0]!.question_content_id;
    await moderateContent(db, 'moderator', staleContentId, 'REJECTED', 'old-version-reject', '需要更新活动场地说明');
    const staleAppeal = await createAppeal(db, 'author', { contentId: staleContentId, description: '请核查旧版问题' }, 'old-version-appeal');
    const updatedEvent = await changeApprovedInvite(db, 'host', event.id, event.version, { title: '内容复核测试（新版）' }, 'new-title-version');
    await changeAppealStatus(db, 'reviewer', staleAppeal.id, 'RESOLVED', '内容可公开，但原事实待办不可复活',
      'old-version-overturn', 'OVERTURN');
    assert.equal((await listFactTodos(db, 'host', event.id)).some(item => item.id === staleFact.todoId), false);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM activity_fact_todos WHERE id=$1', [staleFact.todoId])).rows[0]?.status, 'REJECTED');
    await assert.rejects(() => createContent(db, 'host', event.id, 'ANSWER', '旧版回答不可冒充当前事实', staleContentId,
      'answer-old-version'), { code: 'INVALID_PARENT' });
    const currentFact = await askCurrentFact(db, 'author', event.id, '现场提供饮用水吗？', 'new-version-fact');
    assert.equal(currentFact.source, 'UNKNOWN');
    assert.notEqual(currentFact.todoId, staleFact.todoId);
    const { rows: currentQuestions } = await db.query<{ question_content_id: string }>(
      'SELECT question_content_id FROM activity_fact_todos WHERE id=$1', [currentFact.todoId]);
    await moderateContent(db, 'moderator', currentQuestions[0]!.question_content_id, 'APPROVED', 'approve-current-question');
    const pendingAnswer = await createContent(db, 'host', event.id, 'ANSWER', '本场自备饮水', currentQuestions[0]!.question_content_id,
      'pending-before-version-change');
    await changeApprovedInvite(db, 'host', event.id, updatedEvent.version, { title: '内容复核测试（第三版）' }, 'third-title-version');
    await assert.rejects(() => moderateContent(db, 'reviewer', pendingAnswer.id, 'APPROVED', 'stale-answer-approve'), { code: 'INVALID_STATE' });
    await moderateContent(db, 'moderator', pendingAnswer.id, 'REJECTED', 'stale-answer-reject', '活动信息已变更，请提交新版回答');
    const staleAnswerAppeal = await createAppeal(db, 'host', { contentId: pendingAnswer.id, description: '请复核旧版回答' }, 'stale-answer-appeal');
    await assert.rejects(() => changeAppealStatus(db, 'reviewer', staleAnswerAppeal.id, 'RESOLVED', '撤销原驳回并公开回答',
      'stale-answer-overturn', 'OVERTURN'), { code: 'INVALID_STATE' });
    assert.equal((await db.query<{ status: string }>('SELECT status FROM appeals WHERE id=$1', [staleAnswerAppeal.id])).rows[0]?.status, 'OPEN');
  } finally { await db.close(); }
});

test('overturning a rejected FAQ announcement resolves only its current-version fact todo', async () => {
  const db = await createDatabase();
  try {
    const draft = await createDraft(db, 'host', input, 'faq-appeal-draft');
    const event = await publishApprovedInvite(db, 'host', draft.id, draft.version, 'faq-appeal-publish');
    await register(db, 'author', event.id, event.version, 'faq-appeal-join');
    const fact = await askCurrentFact(db, 'author', event.id, '需要自带球拍吗？', 'faq-appeal-fact');
    const announcement = await createContent(db, 'host', event.id, 'ANNOUNCEMENT',
      '问：需要自带球拍吗？\n答：请自带球拍。', null, 'faq-appeal-content');
    await moderateContent(db, 'moderator', announcement.id, 'REJECTED', 'faq-appeal-reject', '请核实球拍供应情况');
    const appeal = await createAppeal(db, 'host', { contentId: announcement.id, description: '请复核此公告内容' }, 'faq-appeal-open');
    await changeAppealStatus(db, 'reviewer', appeal.id, 'RESOLVED', '已核实并撤销驳回', 'faq-appeal-overturn', 'OVERTURN');
    assert.equal((await db.query<{ status: string }>('SELECT status FROM activity_fact_todos WHERE id=$1', [fact.todoId])).rows[0]?.status,
      'RESOLVED');
    assert.equal((await askCurrentFact(db, 'author', event.id, '需要自带球拍吗？', 'faq-appeal-answer')).source,
      'APPROVED_ANNOUNCEMENT');
  } finally { await db.close(); }
});
