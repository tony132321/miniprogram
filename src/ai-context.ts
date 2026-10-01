import type { Database } from './db.ts';
import { AppError } from './errors.ts';
import { requireMember } from './collaboration.ts';
import { reviewedContentSourceVersion } from './events.ts';
import { actorReadableActivityContentSql } from './content-source-visibility.ts';
import { parseAnnouncementFaq } from './announcement-faq.ts';
import { minimizeAiContextText } from './ai-data-minimization.ts';

export type AiEventContext = {
  event: { id: string; version: number; visibleContentVersion?: number | null; status: string; reviewStatus: string;
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
    const sourceVersion = reviewedContentSourceVersion(event);
    const { rows } = sourceVersion === null ? { rows: [] as Array<{ id: string; body: string }> } :
      await tx.query<{ id: string; body: string }>(`SELECT c.id,c.body FROM activity_content c
      WHERE c.event_id=$1 AND c.event_version=$2 AND c.kind='ANNOUNCEMENT' AND c.status='APPROVED'
        AND ${actorReadableActivityContentSql('c', '$3')}
      ORDER BY c.created_at DESC,c.id DESC LIMIT 10`, [eventId, sourceVersion, actor]);
    return { event: { id: event.id, version: event.version, status: event.status,
      ...(event.visibleContentVersion !== undefined ? { visibleContentVersion: event.visibleContentVersion } : {}),
      reviewStatus: event.reviewStatus, title: safe(p.title), startAt: p.startAt,
      endAt: p.endAt, timeZone: p.timeZone, city: safe(p.city), venueName: safe(p.venueName),
      venueStatus: p.venueStatus, feeMode: p.feeMode, feeCapFen: p.feeCapFen,
      cancellationRule: safe(p.cancellationRule) },
    announcements: rows.flatMap(row => {
      if (!parseAnnouncementFaq(row.body)) return [];
      const text = minimizeAiContextText(row.body);
      return text === null ? [] : [{ sourceContentId: row.id, eventVersion: sourceVersion!,
        trust: 'UNTRUSTED_CONTENT' as const, text }];
    }) };
  });
}
