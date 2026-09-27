import type { Database } from '../src/db.ts';
import { getEvent, publishEvent, type EventRecord } from '../src/events.ts';
import { reviewEvent } from '../src/event-review.ts';
import { changeEvent } from '../src/lifecycle.ts';
import { register as registerWithInvite } from '../src/registrations.ts';

// Most domain tests begin with an activity that can already recruit. Keep the
// required manual review in that fixture; tests of moderation call publishEvent
// directly so they can assert the pending state.
export async function approveInviteEvent(db: Database, event: EventRecord, key = `approve-invite:${event.id}:v${event.version}`): Promise<EventRecord> {
  if (event.payload.visibility !== 'INVITE') throw new Error('approveInviteEvent requires an invitation-only event');
  const current = await getEvent(db, event.hostId, event.id);
  if (current.reviewStatus === 'PENDING')
    await reviewEvent(db, 'operator:test-reviewer', event.id, current.version, 'APPROVED', '邀请制活动内容已人工核对', key);
  else if (current.reviewStatus !== 'APPROVED') throw new Error(`invite event cannot be approved from ${current.reviewStatus}`);
  const approved = await getEvent(db, event.hostId, event.id);
  if (approved.reviewStatus !== 'APPROVED') throw new Error('invite review did not approve the current version');
  return approved;
}

export async function approveInviteById(db: Database, hostId: string, eventId: string): Promise<EventRecord> {
  return approveInviteEvent(db, await getEvent(db, hostId, eventId));
}

export async function publishApprovedInvite(db: Database, actor: string, eventId: string, expectedVersion: number,
  key: string): Promise<EventRecord> {
  const published = await publishEvent(db, actor, eventId, expectedVersion, key);
  return published.payload.visibility === 'INVITE' ? approveInviteEvent(db, published, `review:${key}`) : published;
}

export async function changeApprovedInvite(...args: Parameters<typeof changeEvent>): ReturnType<typeof changeEvent> {
  const changed = await changeEvent(...args);
  return changed.payload.visibility === 'INVITE'
    ? approveInviteEvent(args[0], changed, `review-change:${args[5]}`) : changed;
}

// Domain tests obtain the real invitation for their fixture event. API tests
// exercise missing and revoked invitations through HTTP.
export async function register(db: Database, actor: string, eventId: string, version: number, key: string) {
  const { rows } = await db.query<{ invite_token: string | null }>('SELECT invite_token FROM events WHERE id=$1', [eventId]);
  return registerWithInvite(db, actor, eventId, version, key, rows[0]?.invite_token ?? null);
}
