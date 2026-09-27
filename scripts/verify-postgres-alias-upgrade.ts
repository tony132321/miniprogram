import assert from 'node:assert/strict';
import pg from 'pg';
import { createProductionDatabase, LATEST_SCHEMA_VERSION, type Database } from '../src/db.ts';
import { eventAliasConsentStatus, listEventAliases, setEventAlias } from '../src/event-aliases.ts';
import { validatePostgresTestUrl } from './verify-postgres-guard.ts';

const url = process.env.IRL_PG_TEST_URL;
if (!url) throw new Error('IRL_PG_TEST_URL is required');
const database = validatePostgresTestUrl(url);

const probe = new pg.Pool({ connectionString: url, max: 1 });
let eventId = '';
let host = '';
let member = '';
try {
  const { rows: versions } = await probe.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
  assert.deepEqual(versions.map(row => row.version), Array.from({ length: 49 }, (_, index) => index + 1),
    'target must be a copied schema 49 test database');
  const { rows: candidates } = await probe.query<{ id: string; host_id: string; user_id: string }>(`
    SELECT e.id,e.host_id,r.user_id FROM events e JOIN registrations r ON r.event_id=e.id
    WHERE r.user_id<>e.host_id AND r.status IN ('CONFIRMED','RECONFIRM_REQUIRED','WAITLISTED','OFFERED')
    ORDER BY e.id,r.user_id LIMIT 1`);
  assert.ok(candidates[0], 'upgrade fixture needs an activity with another active member');
  ({ id: eventId, host_id: host, user_id: member } = candidates[0]);
  await probe.query('INSERT INTO event_aliases(event_id,user_id,display_name) VALUES($1,$2,$3)',
    [eventId, host, '升级前旧昵称']);
} finally { await probe.end(); }

let first: Database | undefined;
let second: Database | undefined;
try {
  [first, second] = await Promise.all([createProductionDatabase(url), createProductionDatabase(url)]);
  const { rows: versions } = await first.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
  assert.deepEqual(versions.map(row => row.version), Array.from({ length: LATEST_SCHEMA_VERSION }, (_, index) => index + 1));
  const { rows: legacy } = await first.query<{ display_name: string; notice_version: string | null }>(
    'SELECT display_name,notice_version FROM event_aliases WHERE event_id=$1 AND user_id=$2', [eventId, host]);
  assert.deepEqual(legacy[0], { display_name: '升级前旧昵称', notice_version: null });
  assert.deepEqual(await listEventAliases(second, member, eventId), []);
  const consent = await eventAliasConsentStatus(first, host, eventId);
  assert.equal(consent.reconfirmationRequired, true);
  await setEventAlias(first, host, eventId, '重新确认昵称', true, 'pg-alias-reconfirm', consent.notice.version);
  assert.equal((await listEventAliases(second, member, eventId))[0]?.displayName, '重新确认昵称');
  await setEventAlias(second, host, eventId, null, false, 'pg-alias-withdraw');
  assert.deepEqual(await listEventAliases(first, member, eventId), []);
  const { rows: decisions } = await first.query<{ granted: boolean; purpose: string; scope: string }>(
    'SELECT granted,purpose,scope FROM event_alias_consent_history WHERE event_id=$1 AND user_id=$2 ORDER BY changed_at,id',
    [eventId, host]);
  assert.deepEqual(decisions.map(row => row.granted), [true, false]);
  assert.equal(decisions.every(row => row.purpose === 'EVENT_MEMBER_DISPLAY' && row.scope === `EVENT:${eventId}:MEMBERS`), true);
  console.log(JSON.stringify({ database, fromSchema: 49, toSchema: LATEST_SCHEMA_VERSION, pools: 2,
    legacyPreservedAndHidden: true, reconfirmedAndWithdrawn: true }));
} finally {
  await Promise.allSettled([first?.close(), second?.close()]);
}
