import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from '../src/db.ts';
import { createDraft } from '../src/events.ts';
import { dryRunPrivacyDeletion } from '../src/privacy-deletion.ts';
import { createPrivacyRequest, getPrivacyRequestImpact } from '../src/operations.ts';
import { FileDeletionMarkerStore, executePrivacyDeletionWithMarker } from '../src/privacy-deletion-journal.ts';
import { expireOrdinaryProfile } from '../src/privacy-profile-expiry.ts';

const syntheticPolicy = JSON.stringify({
  schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
  approved_by: 'synthetic-test-owner', approved_at: '2026-09-27T00:00:00.000Z',
  records: [...['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup']
    .map(name => ({ class: name, status: 'APPROVED', approved_days: 30,
      ...(name === 'dispute_or_required_logs' ? { approved_trigger: 'DELETE_EXECUTION' } : {}),
      legal_basis: 'Synthetic test basis only', deletion_action: 'Synthetic test action', access_roles: ['PRIVACY'] })),
    ...['voice_raw', 'photo'].map(name => ({ class: name, status: 'NOT_ENABLED' }))]
});

test('impact and dry run count specific populated fields without returning their values', async () => {
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','secret-openid-p1'),('p2','secret-openid-p2')");
    const event = await createDraft(db, 'p1', { title: 'secret-host-title' }, 'field-inventory-draft');
    await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,detail,provider_ref)
      VALUES('own-notice',$1,'p1','EVENT_REMINDER',1,$2::jsonb,'secret-provider-ref'),
        ('other-notice',$1,'p2','EVENT_REMINDER',1,$2::jsonb,'other-provider-ref')`,
    [event.id, JSON.stringify({ private: 'secret-notification-detail' })]);
    await db.query(`INSERT INTO notification_followups(notification_id,recorded_by,note)
      VALUES('own-notice','operator:jobs','secret-followup-note')`);
    await db.query(`INSERT INTO notification_provider_accepted_event_keys(notification_id,event_uuid)
      VALUES('own-notice','private-own-event-key'),('other-notice','private-other-event-key')`);
    await db.query(`INSERT INTO notification_consent_history(id,user_id,purpose,scope,notice_version,notice_text,granted)
      VALUES('consent-own','p1','EVENT_REMINDER','secret-scope','v1','secret-notice-text',true)`);
    await db.query(`INSERT INTO ai_semantic_requests
      (actor_id,event_id,request_key,fallback_key,request_hash,status,budget_fen,reserved_fen,
        known_cost_fen,cost_status,provider_evidence,result)
      VALUES('p1',$1,'secret-key','secret-fallback',$2,'COMPLETED',10,5,5,'KNOWN',$3::jsonb,$4::jsonb)`,
    [event.id, 'a'.repeat(64), JSON.stringify([{ modelVersion: 'secret-model' }]),
      JSON.stringify({ answer: 'secret-answer' })]);
    await db.query(`INSERT INTO audit(id,actor_id,event_id,action,detail)
      VALUES('own-audit','p1',$1,'TEST',$2::jsonb)`, [event.id, JSON.stringify({ private: 'secret-audit' })]);
    await db.query(`INSERT INTO idempotency(actor_id,route,key,result)
      VALUES('p1','test','secret-idempotency',$1::jsonb)`, [JSON.stringify({ private: 'secret-replay' })]);
    await db.query("INSERT INTO privacy_requests(id,user_id,kind) VALUES('delete-p1','p1','DELETE')");

    const impact = await getPrivacyRequestImpact(db, 'operator:privacy', 'delete-p1');
    const dryRun = await dryRunPrivacyDeletion(db, 'delete-p1');
    const field = (table: string, column: string) => impact.fieldInventory.fields.find(
      item => item.table === table && item.column === column);
    assert.equal(field('users', 'wechat_openid')?.populatedRows, 1);
    assert.equal(field('events', 'payload')?.populatedRows, 1);
    assert.equal(field('notifications', 'detail')?.populatedRows, 1);
    assert.equal(field('notifications', 'provider_ref')?.populatedRows, 1);
    assert.equal(field('notification_provider_accepted_event_keys', 'notification_id')?.populatedRows, 1);
    assert.equal(field('notification_provider_accepted_event_keys', 'event_uuid')?.populatedRows, 1);
    assert.equal(field('notification_followups', 'note')?.populatedRows, 1);
    assert.equal(field('notification_consent_history', 'notice_text')?.populatedRows, 1);
    assert.equal(field('ai_semantic_requests', 'provider_evidence')?.populatedRows, 1);
    assert.equal(field('audit', 'detail')?.populatedRows, 2); // createDraft also has an audit row
    assert.equal(field('idempotency', 'result')?.populatedRows, 2); // createDraft also has a replay receipt
    assert.deepEqual(dryRun.fieldInventory, impact.fieldInventory);
    assert.equal(impact.fieldInventory.countMeaning, 'NON_NULL_ROWS_MATCHING_STRUCTURED_OWNER_LINK');
    assert.equal(impact.fieldInventory.unknownClasses.some(item => item.code === 'PROVIDER_COPIES'), true);
    assert.equal(impact.fieldInventory.unknownClasses.some(item => item.code === 'BACKUP_COPIES'), true);
    assert.doesNotMatch(JSON.stringify(impact), /secret-openid|secret-host-title|secret-notification|secret-provider|secret-followup|secret-notice|secret-key|secret-model|secret-answer|secret-audit|secret-replay/);
    assert.doesNotMatch(JSON.stringify(dryRun), /secret-openid|secret-host-title|secret-notification|secret-provider|secret-followup|secret-notice|secret-key|secret-model|secret-answer|secret-audit|secret-replay/);
  } finally { await db.close(); }
});

test('post-deidentification inventory retains only the deleted person’s hosted and member links', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-inventory-'));
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','p1-private'),('p2','p2-private')");
    const owned = await createDraft(db, 'p1', { title: 'p1 private host text' }, 'inventory-owned');
    const other = await createDraft(db, 'p2', { title: 'p2 private host text' }, 'inventory-other');
    const unrelated = await createDraft(db, 'p2', { title: 'p2 second private host text' }, 'inventory-other-second');
    await db.query("INSERT INTO event_versions(event_id,version,payload) VALUES($1,1,'{\"title\":\"p1 history\"}'),($2,1,'{\"title\":\"p2 history\"}')",
      [owned.id, other.id]);
    await db.query("INSERT INTO registrations(id,event_id,user_id,status) VALUES('p1-other-event',$1,'p1','CONFIRMED')", [other.id]);
    await db.query("INSERT INTO activity_content(id,event_id,author_id,kind,body) VALUES('p1-other-content',$1,'p1','QUESTION','p1 private member text')", [other.id]);
    await db.query(`INSERT INTO jobs(id,kind,event_id,due_at,payload)
      VALUES('p1-host-job','FORMATION_DEADLINE',$1,now()+interval '2 days','{"version":1}'::jsonb),
        ('p1-member-event-job','FORMATION_DEADLINE',$2,now()+interval '2 days','{"version":1}'::jsonb),
        ('unrelated-host-job','FORMATION_DEADLINE',$3,now()+interval '2 days','{"version":1}'::jsonb),
        ('p1-direct-job','PUBLIC_GATE_NOTICE',NULL,now()+interval '2 days','{"userId":"p1"}'::jsonb)`,
    [owned.id, other.id, unrelated.id]);
    const request = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'inventory-delete-p1');
    await db.query("INSERT INTO privacy_requests(id,user_id,kind) VALUES('p2-host-delete','p2','DELETE')");
    const before = await getPrivacyRequestImpact(db, 'operator:privacy', request.id);
    assert.equal(before.counts.hostedEvents, 1);
    assert.equal(before.counts.hostedEventVersions, 1);
    assert.equal(before.counts.registrations, 1);
    assert.equal(before.counts.authoredContent, 1);
    assert.equal(before.counts.hostedEventStatusHistory, 1);
    assert.equal(before.fieldInventory.fields.find(x => x.table === 'event_status_history' && x.column === 'event_id')?.populatedRows, 1);
    assert.equal(before.fieldInventory.fields.find(x => x.table === 'jobs' && x.column === 'payload')?.populatedRows, 2);
    assert.equal(before.fieldInventory.fields.find(x => x.table === 'jobs' && x.column === 'event_id')?.populatedRows, 1);

    await executePrivacyDeletionWithMarker(db, new FileDeletionMarkerStore(join(root, 'markers.jsonl')),
      'operator:privacy', request.id, syntheticPolicy);
    const after = await getPrivacyRequestImpact(db, 'operator:privacy', request.id);
    const otherHost = await getPrivacyRequestImpact(db, 'operator:privacy', 'p2-host-delete');
    const dryRun = await dryRunPrivacyDeletion(db, request.id);
    assert.equal(after.counts.hostedEvents, 1);
    assert.equal(after.counts.hostedEventVersions, 1);
    assert.equal(after.counts.registrations, 1);
    assert.equal(after.counts.authoredContent, 1);
    assert.equal(after.counts.hostedEventStatusHistory, 1);
    assert.equal(after.fieldInventory.fields.find(x => x.table === 'events' && x.column === 'payload')?.populatedRows, 1);
    assert.equal(after.fieldInventory.fields.find(x => x.table === 'event_versions' && x.column === 'payload')?.populatedRows, 1);
    assert.equal(after.fieldInventory.fields.find(x => x.table === 'registrations' && x.column === 'user_id')?.populatedRows, 1);
    assert.equal(after.fieldInventory.fields.find(x => x.table === 'event_status_history' && x.column === 'event_id')?.populatedRows, 1);
    assert.equal(after.fieldInventory.fields.find(x => x.table === 'jobs' && x.column === 'payload')?.populatedRows, 2);
    assert.equal(after.fieldInventory.fields.find(x => x.table === 'jobs' && x.column === 'event_id')?.populatedRows, 1);
    assert.equal(otherHost.fieldInventory.fields.find(x => x.table === 'event_status_history' && x.column === 'event_id')?.populatedRows, 2);
    assert.equal(otherHost.fieldInventory.fields.find(x => x.table === 'jobs' && x.column === 'payload')?.populatedRows, 2);
    assert.equal(otherHost.fieldInventory.fields.find(x => x.table === 'jobs' && x.column === 'event_id')?.populatedRows, 2);
    assert.deepEqual(dryRun.fieldInventory, after.fieldInventory);
    assert.doesNotMatch(JSON.stringify(after), /p1 private|p2 private|p1 history|p2 history/);
  } finally { await db.close(); await rm(root, { recursive: true, force: true }); }
});

test('notification field inventory retains a deleted recipient after expiry without counting another user', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-notification-inventory-'));
  const db = await createDatabase();
  const journal = new FileDeletionMarkerStore(join(root, 'markers.jsonl'));
  const expiryPolicy = JSON.stringify({
    schema: 'project-irl/retention-policy-v1', status: 'OWNER_APPROVED_FOR_REAL_DATA',
    approved_by: 'synthetic-test-owner', approved_at: '2026-09-27T00:00:00.000Z',
    records: [...['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup']
      .map(name => ({ class: name, status: 'APPROVED', approved_days: 1,
        ...(name === 'ordinary_profile' || name === 'dispute_or_required_logs'
          ? { approved_trigger: 'DELETE_EXECUTION' } : {}),
        legal_basis: 'Synthetic test basis only', deletion_action: 'Synthetic test action', access_roles: ['PRIVACY'] })),
      ...['voice_raw', 'photo'].map(name => ({ class: name, status: 'NOT_ENABLED' }))]
  });
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','p1-notice-private'),('p2','p2-notice-private')");
    const event = await createDraft(db, 'p1', { title: 'notification-inventory' }, 'inventory-notice-event');
    await db.query(`INSERT INTO notifications(id,event_id,user_id,kind,event_version,detail,provider_ref)
      VALUES('p1-notice',$1,'p1','EVENT_REMINDER',1,$2::jsonb,'p1-provider'),
        ('p2-notice-a',$1,'p2','EVENT_REMINDER',2,$2::jsonb,'p2-provider-a'),
        ('p2-notice-b',$1,'p2','EVENT_REMINDER',3,$2::jsonb,'p2-provider-b')`,
    [event.id, JSON.stringify({ private: 'secret notification text' })]);
    await db.query(`INSERT INTO notification_followups(notification_id,recorded_by,note)
      VALUES('p1-notice','operator:jobs','p1 followup secret'),
        ('p2-notice-a','operator:jobs','p2 followup secret a'),
        ('p2-notice-b','operator:jobs','p2 followup secret b')`);
    await db.query(`INSERT INTO notification_provider_accepted_event_keys(notification_id,event_uuid)
      VALUES('p1-notice','p1-accepted-event'),
        ('p2-notice-a','p2-accepted-event-a'),('p2-notice-b','p2-accepted-event-b')`);
    const request = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'inventory-notice-delete');
    await db.query("INSERT INTO privacy_requests(id,user_id,kind) VALUES('p2-delete','p2','DELETE')");
    const fieldCount = (impact: Awaited<ReturnType<typeof getPrivacyRequestImpact>>,
      table: string, column: string) => impact.fieldInventory.fields.find(
        item => item.table === table && item.column === column)?.populatedRows;
    const before = await getPrivacyRequestImpact(db, 'operator:privacy', request.id);
    assert.equal(fieldCount(before, 'notifications', 'provider_ref'), 1);
    assert.equal(fieldCount(before, 'notification_provider_accepted_event_keys', 'event_uuid'), 1);
    assert.equal(fieldCount(before, 'notification_followups', 'note'), 1);

    await executePrivacyDeletionWithMarker(db, journal, 'operator:privacy', request.id, expiryPolicy);
    const marker = (await journal.list())[0]!;
    await expireOrdinaryProfile(db, 'operator:privacy', request.id, expiryPolicy,
      { ...marker, recordedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() });
    const after = await getPrivacyRequestImpact(db, 'operator:privacy', request.id);
    const other = await getPrivacyRequestImpact(db, 'operator:privacy', 'p2-delete');
    const dryRun = await dryRunPrivacyDeletion(db, request.id);
    assert.equal(after.ordinaryProfileDisposition?.retainedNotificationRows, 1);
    assert.equal(fieldCount(after, 'notifications', 'provider_ref'), 1);
    assert.equal(fieldCount(after, 'notification_provider_accepted_event_keys', 'event_uuid'), 1);
    assert.equal(fieldCount(after, 'notification_followups', 'note'), 1);
    assert.equal(fieldCount(other, 'notifications', 'provider_ref'), 2);
    assert.equal(fieldCount(other, 'notification_provider_accepted_event_keys', 'event_uuid'), 2);
    assert.equal(fieldCount(other, 'notification_followups', 'note'), 2);
    assert.deepEqual(dryRun.fieldInventory, after.fieldInventory);
    assert.doesNotMatch(JSON.stringify(after), /p1-provider|p2-provider|followup secret|secret notification text/);
  } finally { await db.close(); await rm(root, { recursive: true, force: true }); }
});

test('offer and offer history field inventory follows the applicant across shared deletion tombstones', async () => {
  const root = await mkdtemp(join(tmpdir(), 'irl-offer-inventory-'));
  const db = await createDatabase();
  try {
    await db.query("INSERT INTO users(id,wechat_openid) VALUES('p1','p1-offer-private'),('p2','p2-offer-private')");
    const event = await createDraft(db, 'p2', { title: 'other-host-offer-event' }, 'inventory-offer-event');
    const otherEvent = await createDraft(db, 'p2', { title: 'other-host-second-offer-event' }, 'inventory-offer-event-second');
    await db.query(`INSERT INTO registrations(id,event_id,user_id,status)
      VALUES('p1-registration',$1,'p1','WAITLISTED'),('p2-registration',$1,'p2','WAITLISTED'),
        ('p2-registration-second',$2,'p2','WAITLISTED')`, [event.id, otherEvent.id]);
    await db.query(`INSERT INTO offers(id,event_id,registration_id,expires_at,status)
      VALUES('p1-offer',$1,'p1-registration',now()+interval '15 minutes','ACTIVE'),
        ('p2-offer',$1,'p2-registration',now()+interval '15 minutes','ACTIVE'),
        ('p2-offer-second',$2,'p2-registration-second',now()+interval '15 minutes','ACTIVE')`, [event.id, otherEvent.id]);
    const request = await createPrivacyRequest(db, 'p1', { kind: 'DELETE' }, 'inventory-offer-delete');
    await db.query("INSERT INTO privacy_requests(id,user_id,kind) VALUES('p2-offer-delete','p2','DELETE')");
    const fieldCount = (impact: Awaited<ReturnType<typeof getPrivacyRequestImpact>>,
      table: string, column: string) => impact.fieldInventory.fields.find(
        item => item.table === table && item.column === column)?.populatedRows;
    const before = await getPrivacyRequestImpact(db, 'operator:privacy', request.id);
    assert.equal(before.counts.waitlistOffers, 1);
    assert.equal(before.counts.waitlistOfferHistory, 1);
    assert.equal(before.counts.registrationStatusHistory, 1);
    assert.equal(fieldCount(before, 'offers', 'registration_id'), 1);
    assert.equal(fieldCount(before, 'offer_status_history', 'offer_id'), 1);
    assert.equal(fieldCount(before, 'registration_status_history', 'registration_id'), 1);
    const otherBefore = await getPrivacyRequestImpact(db, 'operator:privacy', 'p2-offer-delete');
    assert.equal(fieldCount(otherBefore, 'offers', 'registration_id'), 2);
    assert.equal(fieldCount(otherBefore, 'offer_status_history', 'offer_id'), 2);
    assert.equal(fieldCount(otherBefore, 'registration_status_history', 'registration_id'), 2);

    await executePrivacyDeletionWithMarker(db, new FileDeletionMarkerStore(join(root, 'markers.jsonl')),
      'operator:privacy', request.id, syntheticPolicy);
    const after = await getPrivacyRequestImpact(db, 'operator:privacy', request.id);
    const other = await getPrivacyRequestImpact(db, 'operator:privacy', 'p2-offer-delete');
    const dryRun = await dryRunPrivacyDeletion(db, request.id);
    assert.equal(after.counts.waitlistOffers, 1);
    assert.equal(after.counts.waitlistOfferHistory, 1);
    assert.equal(after.counts.registrationStatusHistory, 1);
    assert.equal(fieldCount(after, 'offers', 'registration_id'), 1);
    assert.equal(fieldCount(after, 'offer_status_history', 'offer_id'), 1);
    assert.equal(fieldCount(after, 'registration_status_history', 'registration_id'), 1);
    assert.equal(fieldCount(other, 'offers', 'registration_id'), 2);
    assert.equal(fieldCount(other, 'offer_status_history', 'offer_id'), 2);
    assert.equal(fieldCount(other, 'registration_status_history', 'registration_id'), 2);
    assert.deepEqual(dryRun.fieldInventory, after.fieldInventory);
    assert.doesNotMatch(JSON.stringify(after.fieldInventory), /p1-registration|p2-registration|p1-offer|p2-offer/);
  } finally { await db.close(); await rm(root, { recursive: true, force: true }); }
});
