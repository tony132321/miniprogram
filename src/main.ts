import { mkdir } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createDatabase, createProductionDatabase } from './db.ts';
import { createWechatExchange } from './auth.ts';
import { createApp } from './server.ts';
import { runDueJobs } from './jobs.ts';
import { operatorAccountsFromEnvironment, type OperatorConfig } from './operator-auth.ts';
import { resolveRuntimeStage } from './runtime-stage.ts';
import { validateRetentionPolicy } from './retention-policy.ts';
import { parseReportResponsePolicy } from './report-response-policy.ts';
import { protectPendingDeletionRequests } from './operations.ts';
import { FileDeletionMarkerStore, replayPrivacyDeletionMarkers } from './privacy-deletion-journal.ts';
import { HttpsDeletionMarkerStore } from './https-deletion-marker.ts';
import { startPrivacyQuarantineMaintenance } from './privacy-maintenance.ts';

const runtime = resolveRuntimeStage(process.env);
const environment = runtime.environment;
const devAuth = process.env.DEV_AUTH === '1';
if (environment === 'production' && devAuth) throw new Error('DEV_AUTH is forbidden in production');
if (environment === 'production' && !process.env.CHECKIN_SECRET) throw new Error('CHECKIN_SECRET is required in production');
const checkInSecret = process.env.CHECKIN_SECRET ?? randomBytes(32).toString('hex');
const operatorValues = [process.env.OPS_USERNAME, process.env.OPS_PASSWORD_HASH, process.env.OPS_TOTP_SECRET];
if (operatorValues.some(Boolean) && !operatorValues.every(Boolean)) throw new Error('OPS_USERNAME, OPS_PASSWORD_HASH and OPS_TOTP_SECRET must be set together');
if (process.env.OPS_ACCOUNTS_JSON !== undefined && operatorValues.some(Boolean)) throw new Error('OPS_ACCOUNTS_JSON cannot be combined with single-account settings');
const operatorAuth: OperatorConfig | undefined = operatorValues.every(Boolean)
  ? { username: operatorValues[0]!, passwordHash: operatorValues[1]!, totpSecret: operatorValues[2]! } : undefined;
const operatorAccounts = operatorAccountsFromEnvironment(process.env.OPS_ACCOUNTS_JSON);
const reportResponsePolicy = parseReportResponsePolicy(process.env.REPORT_RESPONSE_POLICY_JSON);
if (environment === 'production' && process.env.DELETION_MARKER_PATH)
  throw new Error('The local deletion marker file is only for controlled local rehearsals');
if (process.env.DELETION_MARKER_PATH && (process.env.DELETION_MARKER_URL || process.env.DELETION_MARKER_TOKEN))
  throw new Error('Configure one deletion marker store, not both local and HTTPS');
if ((process.env.DELETION_MARKER_PATH || process.env.DELETION_MARKER_URL || process.env.DELETION_MARKER_TOKEN) &&
  !process.env.RETENTION_POLICY_JSON)
  throw new Error('RETENTION_POLICY_JSON is required with a deletion marker store');
if (environment === 'production') {
  if (!process.env.WECHAT_APP_ID?.trim() || !process.env.WECHAT_APP_SECRET?.trim())
    throw new Error('WECHAT_APP_ID and WECHAT_APP_SECRET are required in production');
  if (!operatorAccounts || operatorAccounts.length < 2)
    throw new Error('OPS_ACCOUNTS_JSON requires independent CONTENT/REPORTS and APPEALS operators in production');
  const contentModerators = operatorAccounts.filter(account => account.permissions?.includes('CONTENT'));
  const reportResolvers = operatorAccounts.filter(account => account.permissions?.includes('REPORTS'));
  if (!contentModerators.length || !reportResolvers.length ||
    [...contentModerators, ...reportResolvers].some(original => !operatorAccounts.some(reviewer =>
      reviewer.username !== original.username && reviewer.permissions?.includes('APPEALS'))))
    throw new Error('OPS_ACCOUNTS_JSON requires an independent APPEALS reviewer for every CONTENT or REPORTS operator');
  if (!operatorAccounts.some(account => account.permissions?.includes('JOBS')))
    throw new Error('OPS_ACCOUNTS_JSON requires a named JOBS operator for failed task recovery');
  validateRetentionPolicy(process.env.RETENTION_POLICY_JSON);
  if (!operatorAccounts.some(dispatcher => dispatcher.permissions?.includes('SAFETY') &&
    operatorAccounts.some(assignee => assignee.username !== dispatcher.username &&
      assignee.permissions?.includes('REPORTS'))))
    throw new Error('OPS_ACCOUNTS_JSON requires an independent SAFETY dispatcher and REPORTS assignee');
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required in production');
  if (!process.env.DELETION_MARKER_URL?.trim() || !process.env.DELETION_MARKER_TOKEN?.trim())
    throw new Error('Production requires a durable HTTPS deletion marker service');
}
if (process.env.DELETION_MARKER_URL || process.env.DELETION_MARKER_TOKEN) {
  if (!process.env.DELETION_MARKER_URL?.trim() || !process.env.DELETION_MARKER_TOKEN?.trim())
    throw new Error('DELETION_MARKER_URL and DELETION_MARKER_TOKEN must be configured together');
  validateRetentionPolicy(process.env.RETENTION_POLICY_JSON);
}
if (process.env.DELETION_MARKER_PATH) validateRetentionPolicy(process.env.RETENTION_POLICY_JSON);
const privacyDeletion = process.env.DELETION_MARKER_URL && process.env.DELETION_MARKER_TOKEN && process.env.RETENTION_POLICY_JSON
  ? { markerStore: new HttpsDeletionMarkerStore(process.env.DELETION_MARKER_URL, process.env.DELETION_MARKER_TOKEN),
    approvedPolicyJson: process.env.RETENTION_POLICY_JSON }
  : process.env.DELETION_MARKER_PATH && process.env.RETENTION_POLICY_JSON
    ? { markerStore: new FileDeletionMarkerStore(process.env.DELETION_MARKER_PATH),
      approvedPolicyJson: process.env.RETENTION_POLICY_JSON } : undefined;
const dataPath = process.env.DATA_PATH ?? runtime.dataPath ?? '';
if (process.env.DELETION_MARKER_PATH && (!isAbsolute(process.env.DELETION_MARKER_PATH) ||
  (dataPath && resolve(process.env.DELETION_MARKER_PATH).startsWith(resolve(dataPath) + sep))))
  throw new Error('DELETION_MARKER_PATH must be absolute and outside the database directory');
if (environment !== 'production') await mkdir(dataPath, { recursive: true });
if (privacyDeletion && environment === 'production') await privacyDeletion.markerStore.list();
const db = environment === 'production'
  ? await createProductionDatabase(process.env.DATABASE_URL ?? '')
  : await createDatabase(dataPath);
if (privacyDeletion) await replayPrivacyDeletionMarkers(db, privacyDeletion.markerStore,
  privacyDeletion.approvedPolicyJson);
await protectPendingDeletionRequests(db);
const wechatExchange = process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET
  ? createWechatExchange(process.env.WECHAT_APP_ID, process.env.WECHAT_APP_SECRET)
  : undefined;
const server = createApp(db, {
  environment, devAuth, checkInSecret, wechatExchange, operatorAuth, operatorAccounts, reportResponsePolicy,
  privacyDeletion,
  operationsUsers: environment === 'production' ? [] : (process.env.OPERATIONS_USERS ?? '').split(',').filter(Boolean),
  trustedProxyIps: (process.env.TRUSTED_PROXY_IPS ?? '').split(',').map(value => value.trim()).filter(Boolean),
  pilotUserIds: (process.env.PILOT_USER_IDS ?? '').split(',').map(value => value.trim()).filter(Boolean)
});
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1..65535');
server.listen(port, '127.0.0.1', () => { process.stdout.write(`Project IRL API listening on http://127.0.0.1:${port}\n`); });
const interval = setInterval(() => { void runDueJobs(db).catch(() => { process.stderr.write('Background jobs failed; inspect jobs table\n'); }); }, 30_000);
const stopPrivacyMaintenance = privacyDeletion ? startPrivacyQuarantineMaintenance(db,
  () => process.stderr.write('Privacy expiry failed; inspect operation logs\n'),
  60 * 60_000, privacyDeletion) : undefined;
async function shutdown() {
  clearInterval(interval);
  stopPrivacyMaintenance?.();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await db.close();
}
process.once('SIGINT', () => { void shutdown().then(() => process.exit(0)); });
process.once('SIGTERM', () => { void shutdown().then(() => process.exit(0)); });
