// R1 release policy. A future capability needs a reviewed release change before any route is added.
export const R1_FEATURE_FLAGS = Object.freeze({
  ai_draft: false,
  public_discovery: false,
  open_matching: false,
  merchant_payments: false,
  paid_pro: false,
  photo_album: false,
  auto_booking: false
});

export type FeatureFlag = keyof typeof R1_FEATURE_FLAGS;

const reservedRoots: Record<string, FeatureFlag> = {
  discovery: 'public_discovery', matching: 'open_matching', payments: 'merchant_payments',
  pro: 'paid_pro', albums: 'photo_album', bookings: 'auto_booking'
};

export function disabledFeatureForPath(path: string): FeatureFlag | null {
  if (path === '/events/drafts:generate') return 'ai_draft';
  const segments = path.split('/').filter(Boolean);
  const root = segments[0];
  if (root && reservedRoots[root]) return reservedRoots[root];
  if (root === 'events' && segments.length >= 3) {
    const nested = segments[2];
    if (nested && reservedRoots[nested]) return reservedRoots[nested];
  }
  return null;
}
