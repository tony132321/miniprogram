const classes = ['voice_raw', 'unneeded_draft_input', 'photo', 'ordinary_profile', 'dispute_or_required_logs', 'backup'] as const;
const required = new Set(['unneeded_draft_input', 'ordinary_profile', 'dispute_or_required_logs', 'backup']);

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function filled(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 8 && !/TO_BE|TBD|待定|proposed/i.test(value);
}

export function validateRetentionPolicy(raw: string | undefined): void {
  if (!raw || raw.length > 64 * 1024) throw new Error('RETENTION_POLICY_JSON requires a reviewed purpose-level policy');
  let policy: unknown;
  try { policy = JSON.parse(raw); }
  catch { throw new Error('RETENTION_POLICY_JSON is not valid JSON'); }
  if (!object(policy) || policy.schema !== 'project-irl/retention-policy-v1' ||
    policy.status !== 'OWNER_APPROVED_FOR_REAL_DATA' || !filled(policy.approved_by) ||
    typeof policy.approved_at !== 'string' || !Number.isFinite(Date.parse(policy.approved_at)))
    throw new Error('RETENTION_POLICY_JSON requires an owner-reviewed policy and approval metadata');
  if (!Array.isArray(policy.records) || policy.records.length !== classes.length)
    throw new Error('RETENTION_POLICY_JSON requires every retention class, not one global period');
  const seen = new Set<string>();
  for (const value of policy.records) {
    if (!object(value) || typeof value.class !== 'string' || !classes.includes(value.class as typeof classes[number]) ||
      seen.has(value.class)) throw new Error('RETENTION_POLICY_JSON has a missing or duplicate retention class');
    seen.add(value.class);
    if (value.status === 'NOT_ENABLED' && !required.has(value.class)) continue;
    if (value.status !== 'APPROVED') throw new Error(`RETENTION_POLICY_JSON retention class ${value.class} is not approved`);
    const period = Number.isSafeInteger(value.approved_days) && Number(value.approved_days) > 0 && Number(value.approved_days) <= 36_500;
    const trigger = filled(value.approved_trigger);
    if (!period && !trigger) throw new Error(`RETENTION_POLICY_JSON retention period missing for ${value.class}`);
    if (!filled(value.legal_basis)) throw new Error(`RETENTION_POLICY_JSON legal basis missing for ${value.class}`);
    if (!filled(value.deletion_action)) throw new Error(`RETENTION_POLICY_JSON deletion action missing for ${value.class}`);
    if (!Array.isArray(value.access_roles) || !value.access_roles.length ||
      value.access_roles.some(role => typeof role !== 'string' || !/^[A-Z_]{2,40}$/.test(role)))
      throw new Error(`RETENTION_POLICY_JSON access roles missing for ${value.class}`);
  }
}
