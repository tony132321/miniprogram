import type { Database } from '../src/db.ts';
import { register as registerWithInvite } from '../src/registrations.ts';

// Domain tests obtain the real invitation for their fixture event. API tests
// exercise missing and revoked invitations through HTTP.
export async function register(db: Database, actor: string, eventId: string, version: number, key: string) {
  const { rows } = await db.query<{ invite_token: string | null }>('SELECT invite_token FROM events WHERE id=$1', [eventId]);
  return registerWithInvite(db, actor, eventId, version, key, rows[0]?.invite_token ?? null);
}
