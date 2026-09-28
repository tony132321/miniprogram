import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createDatabase } from '../src/db.ts';
import { createDraft, getEvent } from '../src/events.ts';
import { cancelRegistration } from '../src/registrations.ts';
import { publishApprovedInvite } from './helpers.ts';
import { executePrivacyDeletionSafeguards } from '../src/privacy-deletion.ts';
import { createPrivacyRequest } from '../src/operations.ts';
import { FileDeletionMarkerStore, executePrivacyDeletionWithMarker } from '../src/privacy-deletion-journal.ts';
import { deidentifySharedActivity } from '../src/privacy-shared-deidentification.ts';

const policy = JSON.stringify({
  schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
  approved_by: 'synthetic-test-owner', approved_at: '2026-09-27T00:00:00.000Z',
  records: [...['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup']
    .map(name => ({ class: name, status: 'APPROVED', approved_days: 30,
      ...(name === 'dispute_or_required_logs' ? { approved_trigger: 'DELETE_EXECUTION' } : {}),
      legal_basis: 'Synthetic test basis only', deletion_action: 'Synthetic test action', access_roles: ['PRIVACY'] })),
    ...['voice_raw', 'photo'].map(name => ({ class: name, status: 'NOT_ENABLED' }))]
});

test('former host recruitment closes while another member keeps event and exit rights', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','host-openid'),('p2','member-openid')");
    const draft = await createDraft(db, 'p1', {
      title: 'private host text', type: 'badminton', startAt: '2027-01-02T12:00:00.000Z',
      endAt: '2027-01-02T14:00:00.000Z', timeZone: 'Asia/Shanghai', city: '深圳',
      venueName: 'private venue', venueStatus: 'HOST_CONFIRMED', minParticipants: 4,
      maxParticipants: 6, registrationDeadline: '2027-01-02T11:30:00.000Z',
      confirmationDeadline: '2027-01-02T10:30:00.000Z', feeMode: 'FREE', feeCapFen: 0,
      cancellationRule: 'private rule', visibility: 'INVITE', approvalMode: 'AUTO', hostParticipates: true
    }, 'member-rights-draft');
    const event = await publishApprovedInvite(db, 'p1', draft.id, draft.version, 'member-rights-publish');
    await db.query("INSERT INTO registrations(id,event_id,user_id,status) VALUES('member-registration',$1,'p2','CONFIRMED')", [event.id]);
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'member-rights-delete');
    await executePrivacyDeletionSafeguards(db, 'operator:privacy', receipt.id, policy);
    const stopped = (await db.query<{ recruiting: boolean; invite_token: string | null }>(
      'SELECT recruiting,invite_token FROM events WHERE id=$1', [event.id])).rows[0]!;
    assert.equal(stopped.recruiting, false);
    assert.equal(stopped.invite_token, null);
    await deidentifySharedActivity(db, 'operator:privacy', receipt.id, policy);
    const visible = await getEvent(db, 'p2', event.id);
    assert.equal(visible.id, event.id);
    assert.doesNotMatch(JSON.stringify(visible), /private host text|private venue|private rule/);
    const exited = await cancelRegistration(db, 'p2', 'member-registration', visible.version, 'member-rights-exit');
    assert.equal(exited.status, 'CANCELLED');
  } finally { await db.close(); }
});

test('shared event facts survive while former host and member identities and authored text are deidentified', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-shared-deid-'));
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','openid-to-delete'),('p2','other-openid')");
    const first = await createDraft(db, 'p1', { title: 'p1 private title', venueName: 'private venue',
      cancellationRule: 'Call p1 at private number' }, 'shared-first');
    const second = await createDraft(db, 'p1', { title: 'another private title' }, 'shared-second');
    await db.query(`INSERT INTO event_versions(event_id,version,payload)
      VALUES($1,1,'{"title":"p1 private historical title","venueName":"private venue"}')`, [first.id]);
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status)
      VALUES('mine',$1,'p1','CONFIRMED'),('other',$1,'p2','CONFIRMED')`, [first.id]);
    await db.query(`INSERT INTO activity_content(id,event_id,author_id,kind,body)
      VALUES('my-content',$1,'p1','QUESTION','private authored text')`, [first.id]);
    await db.query(`INSERT INTO activity_content(id,event_id,author_id,kind,body)
      VALUES('my-content-2',$1,'p1','QUESTION','another private question')`, [first.id]);
    await db.query(`INSERT INTO activity_fact_todos(id,event_id,event_version,requester_id,question_text,question_content_id)
      VALUES('todo-1',$1,1,'p1','private authored text','my-content'),
            ('todo-2',$1,1,'p1','another private question','my-content-2')`, [first.id]);
    await db.query(`INSERT INTO checkins(id,event_id,user_id,evidence,checked_at)
      VALUES('my-checkin',$1,'p1','QR',now())`, [first.id]);
    await db.query(`INSERT INTO expense_ledgers(id,event_id,total_fen,created_by,revision)
      VALUES('ledger-first',$1,0,'p2',1),('ledger-second',$2,0,'p2',1)`, [first.id, second.id]);
    await db.query(`INSERT INTO expense_shares(ledger_id,user_id,amount_fen)
      VALUES('ledger-first','p1',0)`);
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'shared-request');
    await executePrivacyDeletionWithMarker(db, new FileDeletionMarkerStore(join(root, 'markers.jsonl')),
      'operator:privacy', receipt.id, policy);
    const result = await deidentifySharedActivity(db, 'operator:privacy', receipt.id, policy);
    assert.equal(result.disposition, 'STRUCTURED_DEIDENTIFIED_REVIEW_PENDING');
    const events = (await db.query<{ id: string; host_id: string; payload: Record<string, unknown> }>(
      'SELECT id,host_id,payload FROM events WHERE id=$1 OR id=$2 ORDER BY id', [first.id, second.id])).rows;
    assert.equal(events.length, 2);
    assert.notEqual(events[0]!.host_id, 'p1');
    assert.notEqual(events[1]!.host_id, 'p1');
    assert.notEqual(events[0]!.host_id, events[1]!.host_id, 'different activities cannot share a public tombstone');
    assert.doesNotMatch(JSON.stringify(events), /private title|private venue|private number|other-openid/);
    assert.doesNotMatch(JSON.stringify((await db.query('SELECT payload FROM event_versions WHERE event_id=$1', [first.id])).rows),
      /private historical|private venue/);
    const registrations = (await db.query<{ user_id: string }>(
      'SELECT user_id FROM registrations WHERE event_id=$1 ORDER BY id', [first.id])).rows;
    assert.notEqual(registrations[0]?.user_id, 'p1');
    assert.equal(registrations[1]?.user_id, 'p2');
    await assert.rejects(() => db.query(`INSERT INTO activity_content(id,event_id,author_id,kind,body)
      VALUES('tombstone-claim',$1,$2,'QUESTION','ordinary write')`, [first.id, registrations[0]!.user_id]),
      /reserved privacy tombstone/);
    await assert.rejects(() => db.query('INSERT INTO users(id,wechat_openid) VALUES($1,$2)',
      [registrations[0]!.user_id, 'claimed-openid']), /reserved privacy tombstone/);
    await assert.rejects(() => db.query(`INSERT INTO activity_content(id,event_id,author_id,kind,body)
      VALUES('cross-event-claim',$1,$2,'QUESTION','ordinary write')`, [second.id, registrations[0]!.user_id]),
      /reserved privacy tombstone/);
    assert.doesNotMatch(JSON.stringify((await db.query('SELECT author_id,body FROM activity_content WHERE id=$1', ['my-content'])).rows),
      /p1|private authored/);
    await assert.rejects(() => db.query('UPDATE activity_content SET event_id=$1 WHERE id=$2',
      [second.id, 'my-content']), /reserved privacy tombstone/);
    await assert.rejects(() => db.query("UPDATE expense_shares SET ledger_id='ledger-second' WHERE ledger_id='ledger-first'"),
      /reserved privacy tombstone/);
    const todos = (await db.query<{ requester_id: string; question_text: string }>(
      'SELECT requester_id,question_text FROM activity_fact_todos WHERE event_id=$1 ORDER BY id', [first.id])).rows;
    assert.equal(todos.length, 2);
    assert.notEqual(todos[0]?.question_text, todos[1]?.question_text);
    assert.doesNotMatch(JSON.stringify(todos), /p1|private authored|another private/);
    assert.notEqual((await db.query<{ user_id: string }>("SELECT user_id FROM checkins WHERE id='my-checkin'")).rows[0]?.user_id, 'p1');
    assert.notEqual((await db.query<{ wechat_openid: string }>("SELECT wechat_openid FROM users WHERE id='p1'")).rows[0]?.wechat_openid,
      'openid-to-delete');
    assert.deepEqual(await deidentifySharedActivity(db, 'operator:privacy', receipt.id, policy), result);
    await assert.rejects(() => db.query(`INSERT INTO activity_content(id,event_id,author_id,kind,body)
      VALUES('late-content',$1,'p1','QUESTION','late private text')`, [first.id]),
      /deleted account identity/);
    // Simulate a legacy/imported late row that bypassed the ordinary-write guard.
    await db.query('ALTER TABLE activity_content DISABLE TRIGGER privacy_tombstone_content');
    await db.query('ALTER TABLE activity_fact_todos DISABLE TRIGGER privacy_tombstone_fact_todos');
    await db.query(`INSERT INTO activity_content(id,event_id,author_id,kind,body)
      VALUES('late-content',$1,'p1','QUESTION','late private text')`, [first.id]);
    await db.query(`INSERT INTO activity_fact_todos(id,event_id,event_version,requester_id,question_text,question_content_id)
      VALUES('late-todo',$1,1,'p1','late private text','late-content')`, [first.id]);
    await db.query('ALTER TABLE activity_fact_todos ENABLE TRIGGER privacy_tombstone_fact_todos');
    await db.query('ALTER TABLE activity_content ENABLE TRIGGER privacy_tombstone_content');
    const rescanned = await deidentifySharedActivity(db, 'operator:privacy', receipt.id, policy);
    assert.ok(rescanned.structuredLinks > result.structuredLinks);
    assert.notEqual((await db.query<{ author_id: string }>("SELECT author_id FROM activity_content WHERE id='late-content'"))
      .rows[0]?.author_id, 'p1');
    assert.doesNotMatch(JSON.stringify((await db.query("SELECT question_text FROM activity_fact_todos WHERE id='late-todo'"))
      .rows), /late private text/);
    assert.deepEqual(await deidentifySharedActivity(db, 'operator:privacy', receipt.id, policy), rescanned);
    await db.query('DELETE FROM privacy_shared_event_tombstones WHERE request_id=$1', [receipt.id]);
    await db.query('SELECT reconcile_privacy_shared_event_tombstones()');
    assert.equal((await db.query<{ count: number }>(`SELECT count(*)::int AS count
      FROM privacy_shared_event_tombstones WHERE request_id=$1`, [receipt.id])).rows[0]?.count, 2);
    await db.query('UPDATE privacy_shared_deidentifications SET affected_events=3 WHERE request_id=$1', [receipt.id]);
    await assert.rejects(() => db.query('SELECT reconcile_privacy_shared_event_tombstones()'),
      /mapping cannot be verified/);
    await db.query('UPDATE privacy_shared_deidentifications SET affected_events=2 WHERE request_id=$1', [receipt.id]);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM privacy_requests WHERE id=$1', [receipt.id]))
      .rows[0]?.status, 'SAFEGUARDS_APPLIED_PENDING_REVIEW');
  } finally { await db.close(); await rm(root, { recursive: true, force: true }); }
});

test('preoccupied deterministic tombstone cannot collide with another member registration', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','collision-p1')");
    const event = await createDraft(db, 'p1', { title: 'collision event' }, 'collision-draft');
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'collision-request');
    const occupied = `deleted:${createHash('sha256').update(`${receipt.id}:${event.id}`).digest('hex').slice(0, 32)}`;
    await db.query('INSERT INTO users(id,wechat_openid) VALUES($1,$2)', [occupied, 'occupied-openid']);
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status)
      VALUES('mine',$1,'p1','CONFIRMED'),('occupied',$1,$2,'CONFIRMED')`, [event.id, occupied]);
    await executePrivacyDeletionSafeguards(db, 'operator:privacy', receipt.id, policy);
    await deidentifySharedActivity(db, 'operator:privacy', receipt.id, policy);
    const rows = (await db.query<{ id: string; user_id: string }>(
      'SELECT id,user_id FROM registrations WHERE event_id=$1 ORDER BY id', [event.id])).rows;
    assert.notEqual(rows[0]?.user_id, 'p1');
    assert.notEqual(rows[0]?.user_id, occupied);
    assert.equal(rows[1]?.user_id, occupied);
  } finally { await db.close(); }
});

test('repeat sweep discovers outcome, venue and alias history links that appear in isolation', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','isolated-p1'),('p2','isolated-p2')");
    const outcomeEvent = await createDraft(db, 'p2', { title: 'outcome' }, 'isolated-outcome');
    const venueEvent = await createDraft(db, 'p2', { title: 'venue' }, 'isolated-venue');
    const aliasEvent = await createDraft(db, 'p2', { title: 'alias' }, 'isolated-alias');
    const receipt = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'isolated-delete');
    await executePrivacyDeletionSafeguards(db, 'operator:privacy', receipt.id, policy);
    const initial = await deidentifySharedActivity(db, 'operator:privacy', receipt.id, policy);
    assert.equal(initial.affectedEvents, 0);
    await assert.rejects(() => db.query(`INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at)
      VALUES($1,true,4,'p1',now())`, [outcomeEvent.id]), /deleted account identity/);
    await db.query('ALTER TABLE outcomes DISABLE TRIGGER privacy_tombstone_outcomes');
    await db.query('ALTER TABLE venue_evidence DISABLE TRIGGER privacy_tombstone_venue_evidence');
    await db.query('ALTER TABLE event_alias_consent_history DISABLE TRIGGER privacy_tombstone_alias_history');
    await db.query(`INSERT INTO outcomes(event_id,held,actual_count,completed_by,completed_at)
      VALUES($1,true,4,'p1',now())`, [outcomeEvent.id]);
    await db.query(`INSERT INTO venue_evidence(event_id,event_version,venue_name,source_type,recorded_by,
      expires_at,activity_end_at) VALUES($1,1,'private venue','HOST_STATEMENT','p1',now()+interval '1 day',
      '2027-01-02T14:00:00.000Z')`, [venueEvent.id]);
    await db.query(`INSERT INTO event_alias_consent_history(id,event_id,user_id,purpose,scope,notice_version,
      notice_text,granted,source) VALUES('late-alias',$1,'p1','EVENT_MEMBER_DISPLAY','EVENT','v1','notice',true,'USER')`,
    [aliasEvent.id]);
    await db.query('ALTER TABLE event_alias_consent_history ENABLE TRIGGER privacy_tombstone_alias_history');
    await db.query('ALTER TABLE venue_evidence ENABLE TRIGGER privacy_tombstone_venue_evidence');
    await db.query('ALTER TABLE outcomes ENABLE TRIGGER privacy_tombstone_outcomes');
    const rescanned = await deidentifySharedActivity(db, 'operator:privacy', receipt.id, policy);
    assert.equal(rescanned.affectedEvents, 3);
    assert.notEqual((await db.query<{ completed_by: string }>('SELECT completed_by FROM outcomes WHERE event_id=$1',
      [outcomeEvent.id])).rows[0]?.completed_by, 'p1');
    assert.notEqual((await db.query<{ recorded_by: string }>('SELECT recorded_by FROM venue_evidence WHERE event_id=$1',
      [venueEvent.id])).rows[0]?.recorded_by, 'p1');
    assert.notEqual((await db.query<{ user_id: string }>("SELECT user_id FROM event_alias_consent_history WHERE id='late-alias'"))
      .rows[0]?.user_id, 'p1');
  } finally { await db.close(); }
});
