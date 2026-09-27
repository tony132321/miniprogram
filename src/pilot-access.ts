// The production allowlist contains only people whose adult pilot admission was checked outside login.
// A WeChat code exchange proves account control, never age or pilot approval.
export function requiresVerifiedPilot(method: string, path: string): boolean {
  if (method !== 'POST') return false;
  if (path === '/events') return true;
  if (/^\/events\/[^/]+\/(publish|registrations|interests|reservations|confirm|repeat|share-intents|invite:rotate|checkins|checkin-token|content|facts:ask|cohosts)$/.test(path)) return true;
  if (/^\/reservations\/[^/]+\/claim$/.test(path) || /^\/offers\/[^/]+\/accept$/.test(path)) return true;
  if (/^\/registrations\/[^/]+\/(approve|reconfirm)$/.test(path)) return true;
  return false;
}
