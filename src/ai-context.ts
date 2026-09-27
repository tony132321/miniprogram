import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { requireMember } from './collaboration.ts';
import { parseAnnouncementFaq } from './announcement-faq.ts';
import { minimizeAiContextText } from './ai-data-minimization.ts';

export type AiEventContext = {
  event: { id: string; version: number; status: string; reviewStatus: string;
    title?: string; startAt?: string; endAt?: string;
    timeZone?: string; city?: string; venueName?: string; venueStatus?: string;
    feeMode?: string; feeCapFen?: number; cancellationRule?: string };
  announcements: Array<{ sourceContentId: string; eventVersion: number; trust: 'UNTRUSTED_CONTENT'; text: string }>;
};

// This is a data envelope for a future model adapter, not model instructions or a tool grant.
export async function buildAiEventContext(db: Database, actor: string, eventId: string): Promise<AiEventContext> {
  return db.transaction(async tx => {
    // Membership removals and cohost revocations take this event lock before changing access.
    const { rows: locked } = await tx.query<{ version: number }>('SELECT version FROM events WHERE id=$1 FOR SHARE', [eventId]);
    const event = await requireMember(tx, actor, eventId);
    if (locked[0]?.version !== event.version) throw new AppError('VERSION_CONFLICT', '活动规则已更新，请刷新', 409);
    const p = event.payload;
    const safe = (value: string | undefined) => value === undefined ? undefined : minimizeAiContextText(value) ?? undefined;
    const { rows } = await tx.query<{ id: string; body: string }>(`SELECT id,body FROM activity_content
      WHERE event_id=$1 AND event_version=$2 AND kind='ANNOUNCEMENT' AND status='APPROVED'
      ORDER BY created_at DESC,id DESC LIMIT 10`, [eventId, event.version]);
    return { event: { id: event.id, version: event.version, status: event.status,
      reviewStatus: event.reviewStatus, title: safe(p.title), startAt: p.startAt,
      endAt: p.endAt, timeZone: p.timeZone, city: safe(p.city), venueName: safe(p.venueName),
      venueStatus: p.venueStatus, feeMode: p.feeMode, feeCapFen: p.feeCapFen,
      cancellationRule: safe(p.cancellationRule) },
    announcements: rows.flatMap(row => {
      if (!parseAnnouncementFaq(row.body)) return [];
      const text = minimizeAiContextText(row.body);
      return text === null ? [] : [{ sourceContentId: row.id, eventVersion: event.version,
        trust: 'UNTRUSTED_CONTENT' as const, text }];
    }) };
  });
}
