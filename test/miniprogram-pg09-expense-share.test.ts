import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

type Share = { userId: string; amountFen: number; participantHandled: boolean; hostReceived: boolean };
type Ledger = { id: string; totalFen: number; status: 'RECORD_ONLY'; revision: number; current: boolean;
  shares: Share[] };

const shares: Share[] = [
  { userId: 'host', amountFen: 2000, participantHandled: false, hostReceived: false },
  { userId: 'member-b', amountFen: 2001, participantHandled: true, hostReceived: false },
  { userId: 'member-c', amountFen: 3000, participantHandled: false, hostReceived: true },
  { userId: 'member-d', amountFen: 3000, participantHandled: true, hostReceived: true }
];
const currentLedger: Ledger = { id: 'ledger-v2', totalFen: 10001, status: 'RECORD_ONLY', revision: 2,
  current: true, shares };
const oldLedger: Ledger = { id: 'ledger-v1', totalFen: 9001, status: 'RECORD_ONLY', revision: 1,
  current: false, shares: [
    { ...shares[0]!, amountFen: 1800 }, { ...shares[1]!, amountFen: 1801 },
    { ...shares[2]!, amountFen: 2700 }, { ...shares[3]!, amountFen: 2700 }
  ] };
const aliasId = createHash('sha256').update('e1:member-b').digest('hex').slice(0, 16);
const eventDetail = { id: 'e1', hostId: 'host', version: 5, status: 'CONFIRMED',
  recruiting: false, reviewStatus: 'APPROVED', payload: {
    title: '周末羽毛球', visibility: 'INVITE', feeMode: 'AA', feeCapFen: 5000,
    startAt: '2027-03-22T11:00:00Z', endAt: '2027-03-22T13:00:00Z' } };

function mountExpensePage(initialLedgers: Ledger[], initialActor = 'host') {
  let actor = initialActor;
  let ledgers = initialLedgers;
  let expenseReads = 0;
  let onExpenseRead: ((read: number) => Promise<Ledger[]> | Ledger[]) | undefined;
  let eventReads = 0;
  let onEventRead: ((read: number) => Promise<typeof eventDetail> | typeof eventDetail) | undefined;
  let page: Record<string, any> | undefined;
  const clipboard: string[] = [];
  const navigations: string[] = [];
  const clipboardSuccess: Array<() => void> = [];
  let deferClipboardSuccess = false;

  runInNewContext(readFileSync(new URL('../miniprogram/subpackages/activity/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if ((path === '../../utils/api.js' || path === '../../../utils/api.js')) return { api: { async get(route: string) {
        if (route === '/me/registrations?eventId=e1') return { items: actor === 'member-b'
          ? [{ event_id: 'e1', status: 'CONFIRMED' }] : [] };
        if (route === '/events/e1') {
          eventReads++;
          return onEventRead ? onEventRead(eventReads) : eventDetail;
        }
        if (route === '/system/safety') return { status: 'OPEN' };
        if (route === '/events/e1/aliases') return { items: [{ id: aliasId, displayName: '阿北' }],
          notice: { version: 'v1', text: '活动内昵称说明' } };
        if (route === '/events/e1/expenses') {
          expenseReads++;
          return { items: onExpenseRead ? await onExpenseRead(expenseReads) : ledgers };
        }
        return { items: [] };
      } } };
      if ((path === '../../utils/checkin-qr.js' || path === '../utils/checkin-qr.js')) return { drawCheckInQr() {} };
      if ((path === '../../utils/sha256.js' || path === '../../../utils/sha256.js')) return { sha256(value: string) {
        return createHash('sha256').update(value).digest('hex');
      } };
      if ((path === '../../config.js' || path === '../../../config.js')) return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: {
      getStorageSync(key: string) { return key === 'devUser' ? actor : ''; },
      setClipboardData({ data, success }: { data: string; success?: () => void }) {
        clipboard.push(data);
        if (success && deferClipboardSuccess) clipboardSuccess.push(success);
        else success?.();
      },
      navigateTo({ url }: { url: string }) { navigations.push(url); }
    },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1' });
  return { page, clipboard, navigations, setActor(value: string) { actor = value; },
    setLedgers(value: Ledger[]) { ledgers = value; },
    setExpenseRead(value: (read: number) => Promise<Ledger[]> | Ledger[]) { onExpenseRead = value; },
    setEventRead(value: (read: number) => Promise<typeof eventDetail> | typeof eventDetail) { onEventRead = value; },
    deferClipboardSuccess() { deferClipboardSuccess = true; },
    flushClipboardSuccess() { for (const success of clipboardSuccess.splice(0)) success(); },
    get expenseReads() { return expenseReads; }, get eventReads() { return eventReads; } };
}

async function showExpenses(context: ReturnType<typeof mountExpensePage>) {
  assert.equal(await context.page.refresh(), true);
  context.page.setData({ activeSection: 'expenseSection' });
}

function assertRecordDisclaimer(text: string) {
  assert.match(text, /(?:非|不是|不代表).*?(?:付款|支付).*?(?:结清|清偿)/,
    'the copied record must say it is neither payment nor settlement proof');
}

test('PG09 top share copies current host AA summary without anyone’s identity or individual amount', async () => {
  const context = mountExpensePage([currentLedger, oldLedger]);
  await showExpenses(context);

  await context.page.shareCurrentEvent();

  assert.equal(context.clipboard.length, 1);
  const copied = context.clipboard[0]!;
  assert.match(copied, /周末羽毛球/);
  assert.match(copied, /第\s*2\s*版/);
  assert.match(copied, /¥?100\.01/);
  assert.match(copied, /4\s*人/);
  assert.match(copied, /仅作记录/);
  assertRecordDisclaimer(copied);
  assert.doesNotMatch(copied, /host|member-[bcd]|阿北|¥?20\.00|¥?20\.01|¥?30\.00|¥?90\.01/);
  assert.deepEqual(context.navigations, [], 'expense sharing should not open the activity invitation card');
});

test('PG09 member share contains only their authorized share, never the ledger total or other members', async () => {
  const context = mountExpensePage([{ ...currentLedger, shares: [shares[1]!] }], 'member-b');
  await showExpenses(context);

  await context.page.shareCurrentEvent();

  assert.equal(context.clipboard.length, 1);
  const copied = context.clipboard[0]!;
  assert.match(copied, /周末羽毛球/);
  assert.match(copied, /¥?20\.01/);
  assert.match(copied, /本人已处理/);
  assert.match(copied, /主办未记录/);
  assertRecordDisclaimer(copied);
  assert.doesNotMatch(copied, /¥?100\.01|¥?20\.00|¥?30\.00|host|member-[bcd]|阿北|4\s*人/);
  assert.deepEqual(context.navigations, []);
});

test('PG05-S success footer keeps its activity share even if the previous section was expenses', async () => {
  const context = mountExpensePage([{ ...currentLedger, shares: [shares[1]!] }], 'member-b');
  await showExpenses(context);
  context.page.setData({ successState: 'JOINED' });

  await context.page.shareCurrentEvent();

  assert.equal(context.clipboard.length, 1);
  assert.match(context.clipboard[0]!, /活动：周末羽毛球/);
  assert.doesNotMatch(context.clipboard[0]!, /¥?20\.01|费用记录摘要/);
});

test('PG09 share rereads the authorized current ledger after a revision replaces the visible one', async () => {
  const context = mountExpensePage([currentLedger]);
  await showExpenses(context);
  context.setLedgers([{ ...currentLedger, id: 'ledger-v3', revision: 3, totalFen: 12001,
    shares: [{ ...shares[0]!, amountFen: 4000 }, ...shares.slice(1)] },
  { ...currentLedger, current: false }]);

  await context.page.shareCurrentEvent();

  assert.equal(context.clipboard.length, 1);
  assert.ok(context.expenseReads >= 2, 'sharing must reread the expenses endpoint');
  assert.match(context.clipboard[0]!, /第\s*3\s*版/);
  assert.match(context.clipboard[0]!, /¥?120\.01/);
  assert.doesNotMatch(context.clipboard[0]!, /¥?100\.01|第\s*2\s*版/);
});

test('PG09 share refuses to copy if the activity version changes after the ledger read', async () => {
  const context = mountExpensePage([currentLedger]);
  await showExpenses(context);
  context.setEventRead(read => read >= 3 ? { ...eventDetail, version: 6 } : eventDetail);

  await context.page.shareCurrentEvent();

  assert.deepEqual(context.clipboard, []);
  assert.deepEqual(context.navigations, []);
  assert.ok(context.eventReads >= 3, 'the event version must be checked after the current ledger read');
});

test('PG09 share refuses a historical-only or empty expense response', async () => {
  const historical = mountExpensePage([currentLedger]);
  await showExpenses(historical);
  historical.setLedgers([{ ...currentLedger, current: false }]);
  await historical.page.shareCurrentEvent();
  assert.deepEqual(historical.clipboard, []);
  assert.deepEqual(historical.navigations, []);

  const empty = mountExpensePage([]);
  await showExpenses(empty);
  await empty.page.shareCurrentEvent();
  assert.deepEqual(empty.clipboard, []);
  assert.deepEqual(empty.navigations, []);
});

test('PG09 share refuses a visitor whose account is forbidden from reading expenses', async () => {
  const context = mountExpensePage([currentLedger], 'visitor');
  await showExpenses(context);
  assert.equal(context.page.data.expenseLoadState, 'FORBIDDEN');

  await context.page.shareCurrentEvent();

  assert.deepEqual(context.clipboard, []);
  assert.deepEqual(context.navigations, []);
  assert.equal(context.expenseReads, 0);
});

test('PG09 ambiguous current revisions and invalid financial values cannot be copied', async () => {
  const invalidResponses: Ledger[][] = [
    [currentLedger, { ...currentLedger, id: 'second-current', revision: 3 }],
    [{ ...currentLedger, revision: 0 }],
    [{ ...currentLedger, totalFen: -1 }]
  ];
  for (const response of invalidResponses) {
    const context = mountExpensePage([currentLedger]);
    await showExpenses(context);
    context.setLedgers(response);
    await context.page.shareCurrentEvent();
    assert.deepEqual(context.clipboard, []);
    assert.deepEqual(context.navigations, []);
  }
});

test('PG09 share drops a late authorized ledger response after account switch', async () => {
  const context = mountExpensePage([currentLedger]);
  await showExpenses(context);
  let releaseExpense: ((ledgers: Ledger[]) => void) | undefined;
  context.setExpenseRead(read => read === 2 ? new Promise(resolve => { releaseExpense = resolve; }) : [currentLedger]);

  const sharing = Promise.resolve(context.page.shareCurrentEvent());
  for (let i = 0; i < 40 && !releaseExpense; i++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(releaseExpense, 'expense sharing must make a fresh authorized read');
  context.setActor('member-b');
  releaseExpense([currentLedger]);
  await sharing;

  assert.deepEqual(context.clipboard, []);
  assert.deepEqual(context.navigations, []);
});

test('PG09 old clipboard callback cannot show success after the account switches', async () => {
  const context = mountExpensePage([{ ...currentLedger, shares: [shares[1]!] }], 'member-b');
  await showExpenses(context);
  context.deferClipboardSuccess();
  await context.page.shareCurrentEvent();
  assert.match(context.clipboard[0] || '', /¥?20\.01/);

  context.setActor('visitor');
  context.flushClipboardSuccess();

  assert.equal(context.page.data.message, '');
});

test('PG09 old clipboard callback cannot show success after a newer ledger loads', async () => {
  const context = mountExpensePage([currentLedger]);
  await showExpenses(context);
  context.deferClipboardSuccess();
  await context.page.shareCurrentEvent();
  assert.match(context.clipboard[0] || '', /第\s*2\s*版/);

  context.setLedgers([{ ...currentLedger, id: 'ledger-v3', revision: 3, totalFen: 12001,
    shares: [{ ...shares[0]!, amountFen: 4000 }, ...shares.slice(1)] },
  { ...currentLedger, current: false }]);
  assert.equal(await context.page.refresh(), true);
  context.flushClipboardSuccess();

  assert.equal(context.page.data.message, '');
});
