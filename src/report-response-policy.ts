export const reportKinds = ['SAFETY', 'CONTENT', 'ATTENDANCE', 'OTHER'] as const;
export type ReportKind = typeof reportKinds[number];
export type ReportSeverity = 'HIGH' | 'NORMAL';
export type ReportResponsePolicy = {
  defaultSeverityByKind: Record<ReportKind, ReportSeverity>;
  targetMinutesBySeverity: Record<ReportSeverity, number>;
};

export function parseReportResponsePolicy(raw: string | undefined): ReportResponsePolicy | undefined {
  if (raw === undefined) return undefined;
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error('REPORT_RESPONSE_POLICY_JSON must be valid JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2)
    throw new Error('REPORT_RESPONSE_POLICY_JSON must configure defaults and response targets');
  const entries = value as Record<string, unknown>;
  const defaults = entries.defaultSeverityByKind;
  const targets = entries.targetMinutesBySeverity;
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults) ||
    Object.keys(defaults).length !== reportKinds.length ||
    !targets || typeof targets !== 'object' || Array.isArray(targets) ||
    Object.keys(targets).length !== 2)
    throw new Error('REPORT_RESPONSE_POLICY_JSON must configure all report kinds and both severity targets');
  const severityByKind = defaults as Record<string, unknown>;
  const minutesBySeverity = targets as Record<string, unknown>;
  for (const kind of reportKinds) {
    if (!['HIGH', 'NORMAL'].includes(severityByKind[kind] as string))
      throw new Error(`REPORT_RESPONSE_POLICY_JSON invalid ${kind} severity`);
  }
  for (const severity of ['HIGH', 'NORMAL']) {
    const minutes = minutesBySeverity[severity];
    if (!Number.isSafeInteger(minutes) || Number(minutes) < 1 || Number(minutes) > 10080)
      throw new Error(`REPORT_RESPONSE_POLICY_JSON invalid ${severity} target`);
  }
  if (Number(minutesBySeverity.HIGH) >= Number(minutesBySeverity.NORMAL))
    throw new Error('REPORT_RESPONSE_POLICY_JSON HIGH target must be shorter than NORMAL');
  return entries as ReportResponsePolicy;
}
