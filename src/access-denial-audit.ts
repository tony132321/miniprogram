import { createHash, randomUUID } from 'node:crypto';
import type { Database } from './db.ts';

const staticSegments = new Set([
  'ai', 'actions', 'alerts', 'appeals', 'approve', 'assign', 'blocks', 'cancel',
  'checkins', 'claim', 'cohost-grants', 'content', 'decline', 'disposition',
  'draft', 'events', 'execute', 'expenses', 'export', 'exports', 'facts:ask',
  'feedback', 'impact', 'interests', 'invite:rotate', 'manual-checkins', 'me',
  'notifications', 'offers', 'ops', 'prepare', 'privacy', 'publish', 'reconfirm',
  'registrations', 'reports', 'reservations', 'respond', 'revoke', 'rotate',
  'shares', 'similar-invites', 'status', 'triage', 'users'
]);
const protectedPrefixes = new Set([
  'ai', 'events', 'registrations', 'offers', 'expenses', 'privacy', 'reports',
  'appeals', 'ops', 'me', 'manual-checkins', 'cohost-grants',
  'notifications', 'reservations', 'users'
]);

export function accessDenialRoute(path: string): { routeTemplate: string; protectedRoute: boolean } {
  const segments = path.split('/').filter(Boolean);
  if (!segments.length || !protectedPrefixes.has(segments[0]!))
    return { routeTemplate: 'UNMAPPED_ROUTE', protectedRoute: false };
  if (segments.length > 8) return { routeTemplate: 'UNMAPPED_ROUTE', protectedRoute: true };
  const template = '/' + segments.map(segment => staticSegments.has(segment) ? segment : ':id').join('/');
  return { routeTemplate: template, protectedRoute: segments.length > 1 || segments[0] === 'ops' };
}

export type AuthenticationClass =
  'UNAUTHENTICATED' | 'MEMBER' | 'DEVELOPMENT_MEMBER' | 'OPERATOR' | 'DEVELOPMENT_OPERATOR';

export async function recordAccessDenial(db: Database, fields: {
  actor: string | null; authenticationClass: AuthenticationClass; routeTemplate: string;
  errorCode: string; requestId: string
}): Promise<void> {
  // The existing operational salt prevents a stored digest from becoming a
  // straightforward dictionary of known user IDs.
  const { rows } = await db.query<{ salt: string }>(
    'SELECT salt FROM business_event_identity_salt WHERE singleton=true');
  if (!rows[0]?.salt) throw new Error('audit pseudonym salt unavailable');
  const pseudonym = fields.actor === null ? 'denied:anonymous' :
    'denied:' + createHash('sha256').update(rows[0].salt + ':' + fields.actor).digest('hex');
  await db.query(
    'INSERT INTO audit(id,actor_id,action,detail) VALUES($1,$2,$3,$4::jsonb)',
    [randomUUID(), pseudonym, 'ACCESS_DENIED', JSON.stringify({
      authenticationClass: fields.authenticationClass,
      routeTemplate: fields.routeTemplate,
      errorCode: /^[A-Z0-9_]{1,64}$/.test(fields.errorCode) ? fields.errorCode : 'UNKNOWN_DENIAL',
      requestId: fields.requestId
    })]
  );
}
