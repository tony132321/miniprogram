import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

type Share = { userId: string; amountFen: number; participantHandled: boolean; hostReceived: boolean };
type Ledger = { id: string; revision: number; current: boolean; status: string; totalFen: number; shares: Share[] };

function expensePage(ledgers: Ledger[], aliases: Array<{ id: string; displayName: string }> = []) {
  let page: Record<string, any> | undefined;
  let actor = 'host';
  let expenseReads = 0;
  runInNewContext(readFileSync(new URL('../miniprogram/pages/event/event.js', import.meta.url), 'utf8'), {
    require(path: string) {
      if (path === '../../utils/api.js') return { api: { get: async (route: string) => {
        if (route === '/me/registrations?eventId=e1') return { items: [] };
        if (route === '/events/e1') return { id: 'e1', hostId: 'host', version: 2, status: 'CONFIRMED',
          payload: { title: '周末羽毛球', visibility: 'INVITE', feeMode: 'AA', feeCapFen: 2500,
            startAt: '2027-03-22T11:00:00Z', endAt: '2027-03-22T13:00:00Z' } };
        if (route === '/system/safety') return { status: 'OPEN' };
        if (route === '/events/e1/aliases') return { items: aliases, notice: { version: 'v1', text: '活动内昵称说明' } };
        if (route === '/events/e1/expenses') { expenseReads++; return { items: ledgers }; }
        return { items: [] };
      } } };
      if (path === '../../utils/checkin-qr.js') return { drawCheckInQr() {} };
      if (path === '../../utils/sha256.js') return { sha256(value: string) {
        return createHash('sha256').update(value).digest('hex');
      } };
      if (path === '../../config.js') return { developmentUser: 'host' };
      throw new Error(`unexpected require ${path}`);
    },
    Page(definition: Record<string, any>) { page = definition; },
    wx: { getStorageSync(key: string) { return key === 'devUser' ? actor : ''; } },
    setTimeout, clearTimeout
  });
  assert.ok(page);
  page.setData = function (patch: Record<string, unknown>) { Object.assign(this.data, patch); };
  page.setData({ id: 'e1' });
  return { page, setActor(value: string) { actor = value; }, get expenseReads() { return expenseReads; } };
}

const fiveShares: Share[] = [
  { userId: 'host', amountFen: 2000, participantHandled: false, hostReceived: false },
  { userId: 'member-b', amountFen: 2001, participantHandled: true, hostReceived: false },
  { userId: 'member-c', amountFen: 2000, participantHandled: false, hostReceived: false },
  { userId: 'member-d', amountFen: 2000, participantHandled: true, hostReceived: true },
  { userId: 'member-e', amountFen: 2000, participantHandled: false, hostReceived: false }
];
const ledger: Ledger = { id: 'ledger-v2', revision: 2, current: true, status: 'OPEN', totalFen: 10001, shares: fiveShares };

test('PG09 member expansion reveals only shares returned by the authorized expense API', async () => {
  const context = expensePage([ledger]);
  assert.equal(await context.page.refresh(), true);
  assert.equal(context.page.data.expenseLoadState, 'READY');
  assert.deepEqual(context.page.data.expenses[0].visibleShares?.map((share: Share) => share.userId),
    ['host', 'member-b', 'member-c', 'member-d']);

  context.page.toggleExpenseMembers({ currentTarget: { dataset: { ledger: 'ledger-v2' } } });
  assert.deepEqual(context.page.data.expenses[0].visibleShares.map((share: Share) => share.userId),
    ['host', 'member-b', 'member-c', 'member-d', 'member-e']);
  context.page.toggleExpenseMembers({ currentTarget: { dataset: { ledger: 'ledger-v2' } } });
  assert.deepEqual(context.page.data.expenses[0].visibleShares.map((share: Share) => share.userId),
    ['host', 'member-b', 'member-c', 'member-d']);
  assert.equal(context.expenseReads, 1, 'local expansion must not create another API request');
});

test('PG09 uses only consented event nicknames and keeps raw member IDs out of visible share labels', async () => {
  const consentedId = createHash('sha256').update('e1:member-b').digest('hex').slice(0, 16);
  const context = expensePage([ledger], [{ id: consentedId, displayName: '阿北' }]);
  assert.equal(await context.page.refresh(), true);
  assert.deepEqual(context.page.data.expenses[0].shares.map((share: Share & { displayName: string }) => share.displayName),
    ['我的份额', '阿北', '参与者 3', '参与者 4', '参与者 5']);
  context.page.toggleExpenseSort({ currentTarget: { dataset: { ledger: 'ledger-v2' } } });
  assert.equal(context.page.data.expenses[0].visibleShares[0].displayName, '阿北');
});

test('PG09 amount sorting uses actual cents and restores API order without changing the ledger', async () => {
  const context = expensePage([ledger]);
  await context.page.refresh();
  context.page.toggleExpenseSort({ currentTarget: { dataset: { ledger: 'ledger-v2' } } });
  assert.deepEqual(context.page.data.expenses[0].visibleShares.map((share: Share) => share.userId),
    ['member-b', 'host', 'member-c', 'member-d']);
  assert.deepEqual(context.page.data.expenses[0].shares.map((share: Share) => share.userId),
    ['host', 'member-b', 'member-c', 'member-d', 'member-e']);
  context.page.toggleExpenseSort({ currentTarget: { dataset: { ledger: 'ledger-v2' } } });
  assert.deepEqual(context.page.data.expenses[0].visibleShares.map((share: Share) => share.userId),
    ['host', 'member-b', 'member-c', 'member-d']);
  assert.equal(context.expenseReads, 1);
});

test('PG09 detail toggle is scoped to a real ledger and identity changes clear the private rows', async () => {
  const older: Ledger = { ...ledger, id: 'ledger-v1', revision: 1, current: false,
    shares: [{ userId: 'host', amountFen: 1800, participantHandled: true, hostReceived: true }] };
  const context = expensePage([ledger, older]);
  await context.page.refresh();
  context.page.toggleExpenseDetails({ currentTarget: { dataset: { ledger: 'ledger-v1' } } });
  assert.equal(context.page.data.expenses[0].detailsOpen, false);
  assert.equal(context.page.data.expenses[1].detailsOpen, true);
  context.page.toggleExpenseDetails({ currentTarget: { dataset: { ledger: 'missing' } } });
  assert.equal(context.page.data.expenses[0].detailsOpen, false);
  assert.equal(context.page.data.expenses[1].detailsOpen, true);
  context.setActor('visitor');
  await context.page.refresh();
  assert.equal(context.page.data.expenseLoadState, 'FORBIDDEN');
  assert.equal(context.page.data.expenses.length, 0);
  assert.equal(context.expenseReads, 1, 'unauthorized identity must not read the expense endpoint');
});
