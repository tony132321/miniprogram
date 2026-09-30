import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

async function workbench(fetchMock: (path: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<unknown>) {
  const html = await readFile(new URL('../operations/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const elements = new Map<string, { value: string; textContent: string; disabled: boolean; onclick?: () => Promise<void>;
    focus: () => void; replaceChildren: () => void; appendChild: (child: unknown) => void; children: unknown[] }>();
  const item = (id: string) => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', disabled: false, children: [],
      focus() {}, replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); } });
    return elements.get(id)!;
  };
  const storage = new Map([['operatorToken', 'session-token']]);
  let nextKey = 0;
  runInNewContext(script, { document: { getElementById: item, createElement: () => ({ textContent: '', value: '', placeholder: '',
    children: [] as unknown[], appendChild(child: unknown) { this.children.push(child); }, focus() {} }) }, fetch: fetchMock,
    crypto: { randomUUID: () => `ui-test-key-${++nextKey}` },
    sessionStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key) } });
  return { item, storage };
}

test('failed logout retains the token and does not claim the operator session ended', async () => {
  const ui = await workbench(async () => { throw new Error('network unavailable'); });
  await ui.item('operatorLogout').onclick?.();
  assert.equal(ui.storage.get('operatorToken'), 'session-token');
  assert.match(ui.item('status').textContent, /退出失败/);
});

test('logout removes every visible operator result and resets private page controls', async () => {
  const ui = await workbench(async () => ({ ok: true }));
  const lists = ['reports', 'reportResponseAlerts', 'reportTriage', 'eventReviews', 'holds', 'rateLimits',
    'registrationAnomalies', 'notificationFollowups', 'notificationHistory', 'failedJobs',
    'aiDraftAlerts', 'aiDraftAlertReviews', 'aiEventCosts', 'supportMinutesHistory', 'appeals', 'privacy', 'content'];
  for (const id of lists) ui.item(id).appendChild({ textContent: `private-${id}` });
  for (const id of ['publicGate', 'emergencyGate', 'coverageResult', 'reportInspection', 'hostReviewResult'])
    ui.item(id).textContent = `private-${id}`;
  for (const id of ['devUser', 'reportCaseId', 'reportAssignee', 'holdEventId', 'supportEventId',
    'coverageId', 'hostReviewUserId']) ui.item(id).value = `private-${id}`;
  await ui.item('operatorLogout').onclick?.();
  assert.equal(ui.storage.has('operatorToken'), false);
  assert.equal(ui.item('token').value, '');
  for (const id of lists) assert.equal(ui.item(id).children.length, 0, `${id} remains visible`);
  for (const id of ['publicGate', 'emergencyGate', 'coverageResult', 'reportInspection', 'hostReviewResult'])
    assert.equal(ui.item(id).textContent, '', `${id} remains visible`);
  for (const id of ['devUser', 'reportCaseId', 'reportAssignee', 'holdEventId', 'supportEventId',
    'coverageId', 'hostReviewUserId']) assert.equal(ui.item(id).value, '', `${id} retains private input`);
  for (const id of ['moreAiDraftAlerts', 'moreAiDraftAlertReviews', 'moreAiEventCosts'])
    assert.equal(ui.item(id).disabled, true, `${id} still loads private data`);
});

test('signing in as another operator clears the previous account’s private page state', async () => {
  const ui = await workbench(async (path, options) => path === '/ops/auth/login' && options?.method === 'POST'
    ? { ok: true, status: 200, json: async () => ({ token: 'second-operator-token' }) }
    : { ok: true, status: 200, json: async () => ({ items: [], status: 'OPEN', weeks: [] }) });
  ui.item('coverageResult').textContent = '前一账号的值守核查结果';
  ui.item('hostReviewResult').textContent = '前一账号的主办方核验结果';
  ui.item('hostReviewUserId').value = 'previous-host-id';
  ui.item('operatorUser').value = 'second-operator';
  await ui.item('operatorLogin').onclick?.();
  assert.equal(ui.storage.get('operatorToken'), 'second-operator-token');
  assert.equal(ui.item('coverageResult').textContent, '');
  assert.equal(ui.item('hostReviewResult').textContent, '');
  assert.equal(ui.item('hostReviewUserId').value, '');
});

test('a late first login cannot replace the operator who completed a later login', async () => {
  const pending = new Map<string, (response: unknown) => void>();
  const ui = await workbench(async (path, options) => {
    if (path === '/ops/auth/login') {
      const user = JSON.parse(options?.body || '{}').username;
      return new Promise(resolve => { pending.set(user, resolve); });
    }
    return { ok: true, status: 200, json: async () => ({ items: [], status: 'OPEN', weeks: [] }) };
  });
  ui.item('operatorUser').value = 'first';
  const first = ui.item('operatorLogin').onclick?.();
  ui.item('operatorUser').value = 'second';
  const second = ui.item('operatorLogin').onclick?.();
  pending.get('second')?.({ ok: true, status: 200, json: async () => ({ token: 'second-token' }) });
  await second;
  const secondStatus = ui.item('status').textContent;
  pending.get('first')?.({ ok: true, status: 200, json: async () => ({ token: 'first-token' }) });
  await first;
  assert.equal(ui.storage.get('operatorToken'), 'second-token');
  assert.equal(ui.item('token').value, 'second-token');
  assert.equal(ui.item('status').textContent, secondStatus);
});

test('logout cancels a pending login response', async () => {
  let finishLogin!: (response: unknown) => void;
  const ui = await workbench(async path => path === '/ops/auth/login'
    ? new Promise(resolve => { finishLogin = resolve; })
    : { ok: true, status: 200, json: async () => ({ items: [], status: 'OPEN', weeks: [] }) });
  ui.item('operatorUser').value = 'operator';
  const login = ui.item('operatorLogin').onclick?.();
  await ui.item('operatorLogout').onclick?.();
  finishLogin({ ok: true, status: 200, json: async () => ({ token: 'late-token' }) });
  await login;
  assert.equal(ui.storage.has('operatorToken'), false);
  assert.equal(ui.item('token').value, '');
  assert.equal(ui.item('status').textContent, '已退出登录');
});

test('a pending refresh cannot overwrite logged-out state', async () => {
  let resolveReads!: (value: unknown) => void;
  const reads = new Promise(resolve => { resolveReads = resolve; });
  const ui = await workbench(async (_path, options) => options?.method === 'POST'
    ? { ok: true } : reads);
  const refresh = ui.item('refresh').onclick?.();
  await ui.item('operatorLogout').onclick?.();
  resolveReads({ ok: true, json: async () => ({ items: [] }) });
  await refresh;
  assert.equal(ui.item('status').textContent, '已退出登录');
});

test('an expired operator session clears private workbench state and disables its controls', async () => {
  const ui = await workbench(async path => path === '/ops/metrics'
    ? { ok: false, status: 401, json: async () => ({ code: 'UNAUTHENTICATED', message: '登录已失效' }) }
    : { ok: true, status: 200, json: async () => ({ items: [], status: 'OPEN', weeks: [] }) });
  ui.item('reports').appendChild({ textContent: '旧举报' });
  ui.item('coverageResult').textContent = '旧值守记录';
  ui.item('hostReviewResult').textContent = '旧主办方核验';
  ui.item('publicGate').textContent = '开放 · 私有原因';
  ui.item('emergencyGate').textContent = '关闭 · 私有原因';
  ui.item('supportEventId').value = 'private-event-id';
  await ui.item('refresh').onclick?.();
  assert.equal(ui.storage.has('operatorToken'), false);
  assert.equal(ui.item('token').value, '');
  assert.equal(ui.item('reports').children.length, 0);
  for (const id of ['coverageResult', 'hostReviewResult', 'publicGate', 'emergencyGate'])
    assert.equal(ui.item(id).textContent, '', `${id} remains visible`);
  assert.equal(ui.item('supportEventId').value, '');
  assert.equal(ui.item('operatorWorkbench').disabled, true);
  assert.match(ui.item('status').textContent, /登录已失效.*重新登录/);
});

test('an old 401 response cannot invalidate a newly logged-in operator', async () => {
  let releaseOld!: (response: unknown) => void;
  const oldMetrics = new Promise(resolve => { releaseOld = resolve; });
  const ui = await workbench(async (path, options) => {
    if (path === '/ops/auth/login') return { ok: true, status: 200, json: async () => ({ token: 'new-operator-token' }) };
    if (path === '/ops/metrics' && options?.headers?.Authorization === 'Bearer session-token') return oldMetrics;
    return { ok: true, status: 200, json: async () => ({ items: [], status: 'OPEN', weeks: [] }) };
  });
  const oldRefresh = ui.item('refresh').onclick?.();
  ui.item('operatorUser').value = 'another-operator';
  await ui.item('operatorLogin').onclick?.();
  const newStatus = ui.item('status').textContent;
  releaseOld({ ok: false, status: 401, json: async () => ({ code: 'UNAUTHENTICATED', message: '登录已失效' }) });
  await oldRefresh;
  assert.equal(ui.storage.get('operatorToken'), 'new-operator-token');
  assert.equal(ui.item('token').value, 'new-operator-token');
  assert.equal(ui.item('status').textContent, newStatus);
  assert.equal(ui.item('operatorWorkbench').disabled, false);
});

test('a delayed old write body cannot display its result after another operator logs in', async () => {
  let releaseOld!: (body: unknown) => void;
  const oldBody = new Promise(resolve => { releaseOld = resolve; });
  const ui = await workbench(async path => {
    if (path === '/ops/hosts/old-host/status')
      return { ok: true, status: 200, json: async () => oldBody };
    if (path === '/ops/auth/login')
      return { ok: true, status: 200, json: async () => ({ token: 'new-operator-token' }) };
    return { ok: true, status: 200, json: async () => ({ items: [], status: 'OPEN', weeks: [] }) };
  });
  ui.item('hostReviewUserId').value = 'old-host';
  ui.item('hostReviewReason').value = '人工核验已完成';
  const oldWrite = ui.item('submitHostReview').onclick?.();
  ui.item('operatorUser').value = 'another-operator';
  await ui.item('operatorLogin').onclick?.();
  releaseOld({ hostId: 'old-host', status: 'ESTABLISHED', reviewedBy: 'old-operator' });
  await oldWrite;
  assert.equal(ui.storage.get('operatorToken'), 'new-operator-token');
  assert.equal(ui.item('hostReviewResult').textContent, '');
});

test('an old write network failure cannot replace a newer operator’s status', async () => {
  let rejectOld!: (reason: Error) => void;
  const oldWriteResponse = new Promise((_, reject) => { rejectOld = reject; });
  const ui = await workbench(async path => {
    if (path === '/ops/events/old-event/hold') return oldWriteResponse;
    if (path === '/ops/auth/login')
      return { ok: true, status: 200, json: async () => ({ token: 'new-operator-token' }) };
    return { ok: true, status: 200, json: async () => ({ items: [], status: 'OPEN', weeks: [] }) };
  });
  ui.item('holdEventId').value = 'old-event';
  ui.item('holdReason').value = '旧账号的暂停原因';
  const oldWrite = ui.item('placeHold').onclick?.();
  ui.item('operatorUser').value = 'another-operator';
  await ui.item('operatorLogin').onclick?.();
  const newStatus = ui.item('status').textContent;
  rejectOld(new Error('Failed to fetch'));
  await oldWrite;
  assert.equal(ui.storage.get('operatorToken'), 'new-operator-token');
  assert.equal(ui.item('status').textContent, newStatus);
});

test('an old write body failure cannot display an error for a newer operator', async () => {
  let rejectOld!: (reason: Error) => void;
  const oldBody = new Promise((_, reject) => { rejectOld = reject; });
  const ui = await workbench(async path => {
    if (path === '/ops/hosts/old-host/status')
      return { ok: true, status: 200, json: async () => oldBody };
    if (path === '/ops/auth/login')
      return { ok: true, status: 200, json: async () => ({ token: 'new-operator-token' }) };
    return { ok: true, status: 200, json: async () => ({ items: [], status: 'OPEN', weeks: [] }) };
  });
  ui.item('hostReviewUserId').value = 'old-host';
  ui.item('hostReviewReason').value = '旧账号的核验依据';
  const oldWrite = ui.item('submitHostReview').onclick?.();
  ui.item('operatorUser').value = 'another-operator';
  await ui.item('operatorLogin').onclick?.();
  rejectOld(new Error('body stream aborted'));
  await oldWrite;
  assert.equal(ui.item('hostReviewResult').textContent, '');
});

test('a write that receives 401 expires only its current session and login restores the workbench', async () => {
  const ui = await workbench(async (path, options) => {
    if (path === '/ops/auth/login') return { ok: true, status: 200, json: async () => ({ token: 'renewed-token' }) };
    if (path === '/ops/events/event-1/support-minutes' && options?.method === 'POST')
      return { ok: false, status: 401, json: async () => ({ code: 'UNAUTHENTICATED', message: '登录已失效' }) };
    return { ok: true, status: 200, json: async () => ({ items: [], status: 'OPEN', weeks: [] }) };
  });
  ui.item('supportEventId').value = 'event-1';
  ui.item('supportMinutes').value = '5';
  ui.item('supportCategory').value = 'SUPPORT';
  await ui.item('recordSupportMinutes').onclick?.();
  assert.equal(ui.storage.has('operatorToken'), false);
  assert.equal(ui.item('operatorWorkbench').disabled, true);
  ui.item('operatorUser').value = 'operator';
  await ui.item('operatorLogin').onclick?.();
  assert.equal(ui.storage.get('operatorToken'), 'renewed-token');
  assert.equal(ui.item('operatorWorkbench').disabled, false);
  assert.match(ui.item('status').textContent, /举报 0/);
});

test('a denied queue does not hide other permitted operator queues', async () => {
  const ui = await workbench(async path => path === '/ops/privacy?offset=0'
    ? { ok: false, status: 403, json: async () => ({ code: 'FORBIDDEN', message: '无运营权限' }) }
    : { ok: true, status: 200, json: async () => ({ items: [] }) });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('status').textContent, /举报 0/);
  assert.match(ui.item('status').textContent, /个人信息请求 无权限/);
  assert.doesNotMatch(ui.item('status').textContent, /个人信息请求 0/);
  assert.match(ui.item('status').textContent, /无权限.*privacy/i);
  assert.equal(ui.storage.get('operatorToken'), 'session-token');
});

test('AI draft alert can be reviewed from the operator list without claiming cost settlement', async () => {
  let pending = true;
  const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
  const ui = await workbench(async (path, options) => {
    if (path === '/ops/ai-draft-alerts/review' && options?.method === 'POST') {
      posts.push({ path, body: JSON.parse(options.body!) }); pending = false;
      return { ok: true, status: 200, json: async () => ({ reviewState: 'REVIEW_RECORDED' }) };
    }
    if (path === '/ops/ai-draft-alerts?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: pending ? [{ actor_id: 'host', request_key: 'uncertain',
        event_id: null, status: 'UNKNOWN', reserved_fen: 20, known_cost_fen: null, cost_status: null }] : [],
        total: pending ? 1 : 0, nextOffset: null, snapshot: 'a'.repeat(32) }) };
    if (path === '/ops/ai-draft-alerts/reviews?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: pending ? [] : [{ actor_id: 'host', request_key: 'uncertain',
        reviewed_by: 'operator:ops', note: '已核查内部异常，待供应商账单', status: 'UNKNOWN', reserved_fen: 20 }] }) };
    return { ok: true, status: 200, json: async () => ({ items: [], status: 'OPEN', weeks: [] }) };
  });
  await ui.item('refresh').onclick?.();
  const row = ui.item('aiDraftAlerts').children[0] as { children: Array<{ value?: string; onclick?: () => Promise<void> }> };
  const note = row.children.find(child => child.value !== undefined)!;
  note.value = '已核查内部异常，待供应商账单';
  await row.children.find(child => child.onclick)?.onclick?.();
  assert.deepEqual(posts, [{ path: '/ops/ai-draft-alerts/review',
    body: { userId: 'host', requestKey: 'uncertain', note: '已核查内部异常，待供应商账单' } }]);
  assert.equal(ui.item('aiDraftAlerts').children.length, 0);
  const history = ui.item('aiDraftAlertReviews').children[0] as { textContent: string };
  assert.match(history.textContent, /待供应商账单/);
  assert.doesNotMatch(history.textContent, /已结清|已送达/);
});

test('operator workbench pages AI review history and restarts when history changes', async () => {
  const paths: string[] = [];
  let changed = false;
  const row = (key: string) => ({ actor_id: 'host', request_key: key, reviewed_by: 'operator:ops',
    note: '内部复核完成，外部账单待查', status: 'UNKNOWN', reserved_fen: 20, cost_status: null });
  const ui = await workbench(async path => {
    paths.push(path);
    if (path === '/ops/ai-draft-alerts/reviews?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [row(changed ? 'new-review' : 'first-review')], total: 3,
        nextOffset: 1, snapshot: (changed ? 'b' : 'a').repeat(32) }) };
    if (path === `/ops/ai-draft-alerts/reviews?offset=1&snapshot=${'a'.repeat(32)}`) {
      if (changed) return { ok: false, status: 409,
        json: async () => ({ code: 'QUEUE_CHANGED', message: '复核历史已变化' }) };
      return { ok: true, status: 200,
        json: async () => ({ items: [row('older-review')], total: 3, nextOffset: 2, snapshot: 'a'.repeat(32) }) };
    }
    if (path === `/ops/ai-draft-alerts/reviews?offset=2&snapshot=${'a'.repeat(32)}`) return { ok: false,
      status: 409, json: async () => ({ code: 'QUEUE_CHANGED', message: '复核历史已变化' }) };
    return { ok: true, status: 200, json: async () => ({ items: [], status: 'OPEN', weeks: [] }) };
  });
  await ui.item('refresh').onclick?.();
  assert.equal(ui.item('aiDraftAlertReviews').children.length, 1);
  await ui.item('moreAiDraftAlertReviews').onclick?.();
  assert.equal(ui.item('aiDraftAlertReviews').children.length, 2);
  assert.deepEqual(paths.filter(path => path.startsWith('/ops/ai-draft-alerts/reviews?')),
    ['/ops/ai-draft-alerts/reviews?offset=0', `/ops/ai-draft-alerts/reviews?offset=1&snapshot=${'a'.repeat(32)}`]);
  changed = true;
  await ui.item('moreAiDraftAlertReviews').onclick?.();
  assert.equal(ui.item('aiDraftAlertReviews').children.length, 1);
  assert.match((ui.item('aiDraftAlertReviews').children[0] as { textContent: string }).textContent, /new-review/);
  assert.match(ui.item('status').textContent, /AI 草稿复核历史变化，已从第一页刷新/);
});

test('operator refresh shows a recoverable network error instead of a perpetual loading state', async () => {
  let offline = true;
  const ui = await workbench(async path => {
    if (path === '/ops/metrics' && offline) throw new Error('Failed to fetch');
    return { ok: true, status: 200, json: async () => ({ items: [], status: 'OPEN', weeks: [] }) };
  });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('status').textContent, /网络连接失败.*刷新/);
  assert.match(ui.item('metrics').textContent, /读取失败/);
  assert.equal(ui.storage.get('operatorToken'), 'session-token');
  offline = false;
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('metrics').textContent, /到期活动 0/);
});

test('operator workbench lists AI draft alerts without rendering saved suggestions and paginates', async () => {
  const paths: string[] = [];
  const ui = await workbench(async path => {
    paths.push(path);
    if (path === '/ops/ai-draft-alerts?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [{ actor_id: 'host', request_key: 'first', status: 'UNKNOWN',
        budget_fen: 20, known_cost_fen: null, cost_status: null, fallback_reason: null,
        created_at: '2026-09-26T01:00:00Z', result: { fields: { title: 'private-title' } } }],
      total: 2, nextOffset: 1, snapshot: 'a'.repeat(32) }) };
    if (path === `/ops/ai-draft-alerts?offset=1&snapshot=${'a'.repeat(32)}`) return { ok: true, status: 200,
      json: async () => ({ items: [{ actor_id: 'host', request_key: 'second', status: 'COMPLETED',
        budget_fen: 20, known_cost_fen: 7, cost_status: 'UNKNOWN', fallback_reason: 'COST_BOUND_VIOLATION',
        created_at: '2026-09-26T02:00:00Z' }], total: 2, nextOffset: null, snapshot: 'a'.repeat(32) }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('status').textContent, /AI 草稿异常 2/);
  assert.equal(ui.item('aiDraftAlerts').children.length, 1);
  assert.doesNotMatch((ui.item('aiDraftAlerts').children[0] as { textContent: string }).textContent, /private-title/);
  await ui.item('moreAiDraftAlerts').onclick?.();
  assert.equal(ui.item('aiDraftAlerts').children.length, 2);
  assert.deepEqual(paths.filter(path => path.startsWith('/ops/ai-draft-alerts?')),
    ['/ops/ai-draft-alerts?offset=0', `/ops/ai-draft-alerts?offset=1&snapshot=${'a'.repeat(32)}`]);
});

test('operator workbench separates known AI costs from uncertain event reservations', async () => {
  const paths: string[] = [];
  const ui = await workbench(async path => {
    paths.push(path);
    if (path === '/ops/ai-event-costs') return { ok: true, status: 200,
      json: async () => ({ items: [{ event_id: 'event-a', request_count: 2, known_cost_fen: 6,
        uncertain_reserved_fen: 10, uncertain_count: 1, prompt: 'private-draft-text' }], nextCursor: 'event-a' }) };
    if (path === '/ops/ai-event-costs?after=event-a') return { ok: true, status: 200,
      json: async () => ({ items: [{ event_id: 'event-b', request_count: 1, known_cost_fen: 2,
        uncertain_reserved_fen: 0, uncertain_count: 0 }], nextCursor: null }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('moreAiEventCosts').onclick?.();
  assert.match((ui.item('aiEventCosts').children[0] as { textContent: string }).textContent,
    /活动 event-a.*已知费用 6 分.*费用不确定占额 10 分/);
  assert.doesNotMatch((ui.item('aiEventCosts').children[0] as { textContent: string }).textContent, /private-draft-text/);
  await ui.item('moreAiEventCosts').onclick?.();
  assert.equal(ui.item('aiEventCosts').children.length, 2);
  assert.deepEqual(paths.filter(path => path.startsWith('/ops/ai-event-costs')),
    ['/ops/ai-event-costs', '/ops/ai-event-costs?after=event-a']);
});

test('operator report closure sends the selected outcome verdict with the written finding', async () => {
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  const ui = await workbench(async (path, options) => {
    if (options?.method === 'POST') {
      writes.push({ path, body: JSON.parse(options.body || '{}') });
      return { ok: true, status: 200, json: async () => ({ status: 'RESOLVED' }) };
    }
    if (path === '/ops/reports?offset=0') return { ok: true, status: 200, json: async () => ({ items: [{
      id: 'attendance-case', kind: 'ATTENDANCE', status: 'OPEN', event_id: 'event-1',
      description: '活动未举办', outcome_review_required: true }], total: 1, nextOffset: null }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  const row = ui.item('reports').children[0] as { children: Array<{ value: string; children: unknown[];
    onclick?: () => Promise<void> }> };
  assert.equal(row.children.length, 4);
  row.children[1]!.value = '已核对场地与到场证据，确认活动举办';
  row.children[2]!.value = 'HELD_CONFIRMED';
  await row.children[3]!.onclick?.();
  assert.deepEqual(writes, [{ path: '/ops/reports/attendance-case/status', body: {
    status: 'RESOLVED', resolution: '已核对场地与到场证据，确认活动举办', outcomeDecision: 'HELD_CONFIRMED' } }]);
});

test('safety workbench inspects one report with a reason and assigns it to a named reviewer', async () => {
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  const ui = await workbench(async (path, options) => {
    if (options?.method === 'POST') {
      writes.push({ path, body: JSON.parse(options.body || '{}') });
      return { ok: true, status: 200, json: async () => path.endsWith('/inspect')
        ? { id: 'case-1', kind: 'SAFETY', status: 'OPEN', description: '逐单核查的安全举报' }
        : { report_id: 'case-1', assignee_id: 'operator:reviewer2' } };
    }
    if (path === '/ops/reports/triage?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [{ id: 'case-1', kind: 'SAFETY', status: 'OPEN' }], total: 1,
        nextOffset: null, snapshot: 'a'.repeat(32) }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('loadReportTriage').onclick?.();
  assert.equal(ui.item('reportTriage').children.length, 1);
  assert.doesNotMatch((ui.item('reportTriage').children[0] as { textContent: string }).textContent, /逐单核查的安全举报/);
  ui.item('reportCaseId').value = 'case-1';
  ui.item('reportScopeReason').value = '接到现场安全告警，需逐单查看';
  await ui.item('inspectReport').onclick?.();
  assert.match(ui.item('reportInspection').textContent, /逐单核查的安全举报/);
  ui.item('reportAssignee').value = 'reviewer2';
  await ui.item('assignReport').onclick?.();
  assert.deepEqual(writes, [
    { path: '/ops/reports/case-1/inspect', body: { reason: '接到现场安全告警，需逐单查看' } },
    { path: '/ops/reports/case-1/assign', body: { assignee: 'reviewer2', reason: '接到现场安全告警，需逐单查看' } }
  ]);
});

test('safety workbench shows overdue and unconfigured first-response cases without private descriptions', async () => {
  const ui = await workbench(async path => {
    if (path === '/ops/reports/response-alerts?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [
        { id: 'late-case', kind: 'SAFETY', status: 'OPEN', severity: 'HIGH', attention: 'OVERDUE',
          first_response_due_at: '2026-09-27T09:00:00Z', assignee_id: 'operator:reviewer',
          description: '不能在安全队列展示的举报正文' },
        { id: 'old-case', kind: 'OTHER', status: 'OPEN', severity: 'UNCLASSIFIED',
          attention: 'TARGET_UNCONFIGURED', first_response_due_at: null, assignee_id: null }
      ], total: 2, nextOffset: null, snapshot: 'a'.repeat(32) }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('loadReportResponseAlerts').onclick?.();
  assert.equal(ui.item('reportResponseAlerts').children.length, 2);
  const rendered = ui.item('reportResponseAlerts').children.map(item => (item as { textContent: string }).textContent).join(' ');
  assert.match(rendered, /逾期/);
  assert.match(rendered, /未配置目标/);
  assert.doesNotMatch(rendered, /不能在安全队列展示的举报正文|15 分钟达标|24 小时达标/);
});

test('safety workbench sends a reason when reclassifying one report', async () => {
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  const ui = await workbench(async (path, options) => {
    if (options?.method === 'POST') {
      writes.push({ path, body: JSON.parse(options.body || '{}') });
      return { ok: true, status: 200, json: async () => ({ reportId: 'case-2', severity: 'HIGH' }) };
    }
    if (path === '/ops/reports/triage?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [{ id: 'case-2', kind: 'OTHER', status: 'OPEN', severity: 'NORMAL' }],
        total: 1, nextOffset: null, snapshot: 'a'.repeat(32) }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  ui.item('reportCaseId').value = 'case-2';
  ui.item('reportSeverity').value = 'HIGH';
  ui.item('reportScopeReason').value = '现场安全线索要求尽快核查';
  await ui.item('classifyReportSeverity').onclick?.();
  assert.equal(writes.length, 0);
  assert.match(ui.item('status').textContent, /核查|列表|刷新/);
  await ui.item('loadReportTriage').onclick?.();
  const row = ui.item('reportTriage').children[0] as { children: Array<{ onclick?: () => void }> };
  row.children[0]!.onclick?.();
  await ui.item('classifyReportSeverity').onclick?.();
  assert.deepEqual(writes, [{ path: '/ops/reports/case-2/severity', body: {
    severity: 'HIGH', expectedSeverity: 'NORMAL', reason: '现场安全线索要求尽快核查' } }]);
});

test('report workbench shows severity and target time without exposing triage descriptions', async () => {
  const ui = await workbench(async path => {
    if (path === '/ops/reports?offset=0') return { ok: true, status: 200, json: async () => ({ items: [{
      id: 'assigned-case', kind: 'CONTENT', status: 'OPEN', description: '处理员可见正文', severity: 'NORMAL',
      first_response_due_at: '2026-09-27T11:00:00Z' }], total: 1, nextOffset: null }) };
    if (path === '/ops/reports/triage?offset=0') return { ok: true, status: 200, json: async () => ({ items: [{
      id: 'triage-case', kind: 'SAFETY', status: 'OPEN', severity: 'UNCLASSIFIED',
      first_response_due_at: null, description: '安全页不得展示的正文' }], total: 1, nextOffset: null }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  await ui.item('loadReportTriage').onclick?.();
  assert.match((ui.item('reports').children[0] as { textContent: string }).textContent,
    /NORMAL.*2026-09-27T11:00:00Z/);
  assert.match((ui.item('reportTriage').children[0] as { textContent: string }).textContent,
    /UNCLASSIFIED.*未配置目标/);
  assert.doesNotMatch((ui.item('reportTriage').children[0] as { textContent: string }).textContent,
    /安全页不得展示的正文/);
});

test('logging out removes the safety inspection and triage details from the workbench', async () => {
  const ui = await workbench(async (path, options) => {
    if (path === '/ops/reports/triage?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [{ id: 'private-case', kind: 'SAFETY', status: 'OPEN' }],
        total: 1, nextOffset: null, snapshot: 'a'.repeat(32) }) };
    if (path === '/ops/reports/private-case/inspect' && options?.method === 'POST')
      return { ok: true, status: 200, json: async () => ({ id: 'private-case', kind: 'SAFETY',
        status: 'OPEN', description: '退出后不能保留的私密举报' }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('loadReportTriage').onclick?.();
  ui.item('reportCaseId').value = 'private-case';
  ui.item('reportScopeReason').value = '本班次安全事件逐单核查原因';
  await ui.item('inspectReport').onclick?.();
  assert.match(ui.item('reportInspection').textContent, /退出后不能保留/);
  await ui.item('operatorLogout').onclick?.();
  assert.equal(ui.item('reportInspection').textContent, '');
  assert.equal(ui.item('reportTriage').children.length, 0);
  assert.equal(ui.item('reportCaseId').value, '');
});

test('operator privacy row can inspect redacted deletion impact counts without showing raw records', async () => {
  const ui = await workbench(async path => {
    if (path === '/ops/privacy?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [{ id: 'request-1', kind: 'DELETE', status: 'OPEN' }] }) };
    if (path === '/ops/privacy/request-1/impact') return { ok: true, status: 200,
      json: async () => ({ assessmentStatus: 'POLICY_REVIEW_REQUIRED',
        counts: { profile: 1, sessions: 1, hostedEvents: 2, registrations: 3, authoredContent: 4,
          reportedDisputes: 1, hostedOutcomeReviews: 2, reportedOutcomeReviews: 1,
          appeals: 0, notifications: 2, notificationConsents: 1, notificationConsentHistory: 2,
          eventAliases: 0, eventAliasConsentHistory: 2, shareIntents: 2, personalExportTickets: 1,
          blocksCreated: 1, blocksReceived: 1,
          shareOpens: 3, unknownSourceInviteOpens: 1, checkIns: 2, outcomeFeedback: 1,
          cohostGrants: 1, privacyRequests: 1, idempotencyRecords: 4, aiActionProposals: 2 } }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  const row = ui.item('privacy').children[0] as { children: Array<{ onclick?: () => Promise<void>; textContent: string }> };
  await row.children[0]?.onclick?.();
  assert.match(row.children[1]!.textContent, /活动 2.*报名 3.*争议 1/);
  assert.match(row.children[1]!.textContent, /通知授权 1.*活动昵称 0.*活动昵称授权历史 2.*分享发起 2.*导出凭证 1.*屏蔽发起 1.*被屏蔽 1/);
  assert.match(row.children[1]!.textContent, /授权变更 2/);
  assert.match(row.children[1]!.textContent, /主办活动复核 2.*本人举报裁决 1/);
  assert.match(row.children[1]!.textContent, /分享打开 3.*未知来源邀请打开 1.*签到 2.*结束反馈 1.*协办授权 1.*隐私请求 1.*幂等记录 4/);
  assert.match(row.children[1]!.textContent, /AI 动作提议 2/);
  assert.doesNotMatch(row.children[1]!.textContent, /正文|openid/);
});

test('operator workbench shows global stop state and sends a reason when safety closes it', async () => {
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  const ui = await workbench(async (path, options) => {
    if (path === '/ops/emergency' && options?.method === 'POST') {
      writes.push({ path, body: JSON.parse(options.body || '{}') });
      return { ok: true, status: 200, json: async () => ({ status: 'CLOSED' }) };
    }
    if (path === '/ops/emergency') return { ok: true, status: 200,
      json: async () => ({ status: 'OPEN', reason: '初始开放', changedBy: 'system' }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('emergencyGate').textContent, /开放.*初始开放/);
  assert.equal(ui.item('closeEmergencyGate').disabled, false);
  ui.item('emergencyReason').value = '发现容量异常需要止损';
  await ui.item('closeEmergencyGate').onclick?.();
  assert.deepEqual(writes, [{ path: '/ops/emergency', body: { status: 'CLOSED', reason: '发现容量异常需要止损' } }]);
});

test('operator can record, independently confirm, open and revoke a public duty shift from the workbench', async () => {
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  const ui = await workbench(async (path, options) => {
    if (options?.method === 'POST') {
      const body = JSON.parse(options.body || '{}') as Record<string, unknown>;
      writes.push({ path, body });
      if (path === '/ops/public-coverage') return { ok: true, status: 201,
        json: async () => ({ id: '11111111-1111-4111-8111-111111111111', responsibleActor: 'duty-owner',
          confirmedBy: null, startsAt: body.startsAt, endsAt: body.endsAt }) };
      return { ok: true, status: 200, json: async () => ({ status: 'OPEN',
        id: '11111111-1111-4111-8111-111111111111', confirmedBy: 'reviewer' }) };
    }
    if (path === '/ops/public-recruitment') return { ok: true, status: 200,
      json: async () => ({ status: 'CLOSED', reason: '尚无值守', changedBy: 'system', coverageId: null }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  ui.item('coverageStartsAt').value = '2027-01-02T10:00';
  ui.item('coverageEndsAt').value = '2027-01-02T13:00';
  ui.item('coverageDrillCompletedAt').value = '2026-09-27T10:00';
  ui.item('coverageDrillReference').value = 'drill-reference-123';
  await ui.item('createPublicCoverage').onclick?.();
  const coverageId = '11111111-1111-4111-8111-111111111111';
  assert.equal(ui.item('coverageId').value, coverageId);
  assert.deepEqual(writes[0], { path: '/ops/public-coverage', body: {
    startsAt: new Date('2027-01-02T10:00').toISOString(),
    endsAt: new Date('2027-01-02T13:00').toISOString(),
    drillCompletedAt: new Date('2026-09-27T10:00').toISOString(), drillReference: 'drill-reference-123' } });
  ui.item('coverageReason').value = '另一位安全运营核对了值守与演练';
  await ui.item('confirmPublicCoverage').onclick?.();
  assert.deepEqual(writes[1], { path: `/ops/public-coverage/${coverageId}/confirm`,
    body: { reason: '另一位安全运营核对了值守与演练' } });
  ui.item('publicGateReason').value = '已确认当前具名值守覆盖';
  await ui.item('openPublicGate').onclick?.();
  assert.deepEqual(writes[2], { path: '/ops/public-recruitment', body: {
    status: 'OPEN', reason: '已确认当前具名值守覆盖', coverageId } });
  ui.item('coverageReason').value = '排班人临时缺席，撤销本次覆盖';
  await ui.item('revokePublicCoverage').onclick?.();
  assert.deepEqual(writes[3], { path: `/ops/public-coverage/${coverageId}/revoke`,
    body: { reason: '排班人临时缺席，撤销本次覆盖' } });
});

test('operator workbench loads later report pages and keeps the full queue count', async () => {
  const paths: string[] = [];
  const ui = await workbench(async path => {
    paths.push(path);
    if (path === '/ops/reports?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [{ id: 'safety-1', kind: 'SAFETY', status: 'OPEN', description: '安全待查' }],
        total: 2, nextOffset: 1, snapshot: 'a'.repeat(32) }) };
    if (path === `/ops/reports?offset=1&snapshot=${'a'.repeat(32)}`) return { ok: true, status: 200,
      json: async () => ({ items: [{ id: 'other-1', kind: 'OTHER', status: 'OPEN', description: '普通待查' }],
        total: 2, nextOffset: null, snapshot: 'a'.repeat(32) }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('status').textContent, /举报 2/);
  assert.equal(ui.item('reports').children.length, 1);
  await ui.item('moreReports').onclick?.();
  assert.equal(ui.item('reports').children.length, 2);
  assert.equal(paths.filter(path => path.startsWith('/ops/reports?')).join(','),
    `/ops/reports?offset=0,/ops/reports?offset=1&snapshot=${'a'.repeat(32)}`);
});

test('operator workbench loads later public reviews and shows their full count', async () => {
  const paths: string[] = [];
  const review = (id: string) => ({ id, version: 2, hostId: 'host', payload: { title: id, city: '深圳', venueName: '球馆' } });
  const ui = await workbench(async path => {
    paths.push(path);
    if (path === '/ops/events/reviews?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [review('first-review')], total: 2, nextOffset: 1, snapshot: 'd'.repeat(32) }) };
    if (path === `/ops/events/reviews?offset=1&snapshot=${'d'.repeat(32)}`) return { ok: true, status: 200,
      json: async () => ({ items: [review('second-review')], total: 2, nextOffset: null, snapshot: 'd'.repeat(32) }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('status').textContent, /活动待审 2/);
  assert.equal(ui.item('eventReviews').children.length, 1);
  await ui.item('moreEventReviews').onclick?.();
  assert.equal(ui.item('eventReviews').children.length, 2);
  assert.deepEqual(paths.filter(path => path.startsWith('/ops/events/reviews?')),
    ['/ops/events/reviews?offset=0', `/ops/events/reviews?offset=1&snapshot=${'d'.repeat(32)}`]);
});

test('operator can distinguish public reviews with identical activity facts', async () => {
  const review = (id: string) => ({ id, version: 2, hostId: 'host', payload: {
    title: '同名羽毛球活动', city: '深圳', venueName: '公共球馆', startAt: '2026-10-06T12:00:00.000Z',
    endAt: '2026-10-06T14:00:00.000Z', minParticipants: 4, maxParticipants: 6 } });
  const ui = await workbench(async path => path === '/ops/events/reviews?offset=0'
    ? { ok: true, status: 200, json: async () => ({ items: [review('activity-a'), review('activity-b')],
      total: 2, nextOffset: null, snapshot: 'a'.repeat(32) }) }
    : { ok: true, status: 200, json: async () => ({ items: [] }) });
  await ui.item('refresh').onclick?.();
  const rows = ui.item('eventReviews').children as Array<{ textContent: string }>;
  assert.equal(rows.length, 2);
  assert.match(rows[0]!.textContent, /activity-a/);
  assert.match(rows[1]!.textContent, /activity-b/);
});

test('operator workbench restarts public review pages when a case changes', async () => {
  let firstPageReads = 0;
  const ui = await workbench(async path => {
    if (path === '/ops/events/reviews?offset=0') {
      firstPageReads += 1;
      return { ok: true, status: 200, json: async () => ({ items: [{ id: 'review', version: 1,
        hostId: 'host', payload: { title: firstPageReads === 1 ? '旧活动' : '新活动', city: '深圳', venueName: '球馆' } }],
        total: 2, nextOffset: 1, snapshot: (firstPageReads === 1 ? 'a' : 'b').repeat(32) }) };
    }
    if (path.startsWith('/ops/events/reviews?offset=1')) return { ok: false, status: 409,
      json: async () => ({ code: 'QUEUE_CHANGED', message: '审核列表已变化' }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  await ui.item('moreEventReviews').onclick?.();
  assert.equal(firstPageReads, 2);
  assert.equal(ui.item('eventReviews').children.length, 1);
  assert.match((ui.item('eventReviews').children[0] as { textContent: string }).textContent, /新活动/);
  assert.match(ui.item('status').textContent, /活动审核列表变化，已从第一页刷新/);
});

test('failed public review page retains its retry offset', async () => {
  let laterReads = 0;
  const review = (title: string) => ({ id: title, version: 1, hostId: 'host', payload: { title, city: '深圳', venueName: '球馆' } });
  const ui = await workbench(async path => {
    if (path === '/ops/events/reviews?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [review('first')], total: 2, nextOffset: 1, snapshot: 'a'.repeat(32) }) };
    if (path.startsWith('/ops/events/reviews?offset=1')) {
      laterReads += 1;
      return laterReads === 1
        ? { ok: false, status: 503, json: async () => ({ message: '暂时不可用' }) }
        : { ok: true, status: 200, json: async () => ({ items: [review('second')], total: 2, nextOffset: null, snapshot: 'a'.repeat(32) }) };
    }
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  await ui.item('moreEventReviews').onclick?.();
  assert.equal(ui.item('eventReviews').children.length, 1);
  assert.equal((ui.item('moreEventReviews') as { disabled?: boolean }).disabled, false);
  await ui.item('moreEventReviews').onclick?.();
  assert.equal(laterReads, 2);
  assert.equal(ui.item('eventReviews').children.length, 2);
});

test('operator workbench loads later content reviews and shows their full count', async () => {
  const paths: string[] = [];
  const content = (id: string) => ({ id, event_id: 'e', kind: 'QUESTION', body: id });
  const ui = await workbench(async path => {
    paths.push(path);
    if (path === '/ops/content?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [content('first-question')], total: 2, nextOffset: 1, snapshot: 'e'.repeat(32) }) };
    if (path === `/ops/content?offset=1&snapshot=${'e'.repeat(32)}`) return { ok: true, status: 200,
      json: async () => ({ items: [content('second-question')], total: 2, nextOffset: null, snapshot: 'e'.repeat(32) }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('status').textContent, /待审核内容 2/);
  assert.equal(ui.item('content').children.length, 1);
  await ui.item('moreContent').onclick?.();
  assert.equal(ui.item('content').children.length, 2);
  assert.deepEqual(paths.filter(path => path.startsWith('/ops/content?')),
    ['/ops/content?offset=0', `/ops/content?offset=1&snapshot=${'e'.repeat(32)}`]);
});

test('operator can distinguish identical pending content by record and author', async () => {
  const content = (id: string, author: string) => ({ id, event_id: 'event-one', author_id: author,
    kind: 'QUESTION', body: '需要自带球拍吗？' });
  const ui = await workbench(async path => path === '/ops/content?offset=0'
    ? { ok: true, status: 200, json: async () => ({ items: [content('question-a', 'p1'), content('question-b', 'p2')],
      total: 2, nextOffset: null, snapshot: 'a'.repeat(32) }) }
    : { ok: true, status: 200, json: async () => ({ items: [] }) });
  await ui.item('refresh').onclick?.();
  const rows = ui.item('content').children as Array<{ textContent: string }>;
  assert.equal(rows.length, 2);
  assert.match(rows[0]!.textContent, /question-a.*p1/);
  assert.match(rows[1]!.textContent, /question-b.*p2/);
});

test('operator workbench restarts content review pages when a case changes', async () => {
  let firstPageReads = 0;
  const ui = await workbench(async path => {
    if (path === '/ops/content?offset=0') {
      firstPageReads += 1;
      return { ok: true, status: 200, json: async () => ({ items: [{ id: 'content', event_id: 'e', kind: 'QUESTION',
        body: firstPageReads === 1 ? '旧问题' : '新问题' }], total: 2, nextOffset: 1,
        snapshot: (firstPageReads === 1 ? 'a' : 'b').repeat(32) }) };
    }
    if (path.startsWith('/ops/content?offset=1')) return { ok: false, status: 409,
      json: async () => ({ code: 'QUEUE_CHANGED', message: '内容审核列表已变化' }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  await ui.item('moreContent').onclick?.();
  assert.equal(firstPageReads, 2);
  assert.equal(ui.item('content').children.length, 1);
  assert.match((ui.item('content').children[0] as { textContent: string }).textContent, /新问题/);
  assert.match(ui.item('status').textContent, /内容审核列表变化，已从第一页刷新/);
});

test('failed content review page retains its retry offset', async () => {
  let laterReads = 0;
  const content = (body: string) => ({ id: body, event_id: 'e', kind: 'QUESTION', body });
  const ui = await workbench(async path => {
    if (path === '/ops/content?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [content('first')], total: 2, nextOffset: 1, snapshot: 'a'.repeat(32) }) };
    if (path.startsWith('/ops/content?offset=1')) {
      laterReads += 1;
      return laterReads === 1
        ? { ok: false, status: 503, json: async () => ({ message: '暂时不可用' }) }
        : { ok: true, status: 200, json: async () => ({ items: [content('second')], total: 2, nextOffset: null, snapshot: 'a'.repeat(32) }) };
    }
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  await ui.item('moreContent').onclick?.();
  assert.equal(ui.item('content').children.length, 1);
  assert.equal((ui.item('moreContent') as { disabled?: boolean }).disabled, false);
  await ui.item('moreContent').onclick?.();
  assert.equal(laterReads, 2);
  assert.equal(ui.item('content').children.length, 2);
});

test('operator workbench pages failed jobs, shows safe metadata and queues a retry', async () => {
  const paths: string[] = [];
  const job = (id: string) => ({ id, kind: 'EVENT_REMINDER', eventId: 'e', attempts: 5, errorCode: 'INTERNAL_ERROR' });
  const ui = await workbench(async (path, options) => {
    paths.push(path);
    if (path === '/ops/jobs/failed?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [job('failed-1')], total: 2, nextOffset: 1, snapshot: 'f'.repeat(32) }) };
    if (path === `/ops/jobs/failed?offset=1&snapshot=${'f'.repeat(32)}`) return { ok: true, status: 200,
      json: async () => ({ items: [job('failed-2')], total: 2, nextOffset: null, snapshot: 'f'.repeat(32) }) };
    if (path === '/ops/jobs/failed-1/retry' && options?.method === 'POST') return { ok: true, status: 202,
      json: async () => ({ jobId: 'failed-1', status: 'PENDING' }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('status').textContent, /失败任务 2/);
  assert.equal(ui.item('failedJobs').children.length, 1);
  await ui.item('moreFailedJobs').onclick?.();
  assert.equal(ui.item('failedJobs').children.length, 2);
  const first = ui.item('failedJobs').children[0] as { textContent: string; children: Array<{ onclick?: () => Promise<void> }> };
  assert.match(first.textContent, /INTERNAL_ERROR/);
  await first.children[0]?.onclick?.();
  assert.equal(paths.includes('/ops/jobs/failed-1/retry'), true);
});

test('operator workbench restarts failed-job pages after queue recovery', async () => {
  let firstPageReads = 0;
  const ui = await workbench(async path => {
    if (path === '/ops/jobs/failed?offset=0') {
      firstPageReads += 1;
      return { ok: true, status: 200, json: async () => ({ items: [{ id: firstPageReads === 1 ? 'old-job' : 'new-job',
        kind: 'EVENT_REMINDER', attempts: 5, errorCode: 'INTERNAL_ERROR' }], total: 2, nextOffset: 1,
        snapshot: (firstPageReads === 1 ? 'a' : 'b').repeat(32) }) };
    }
    if (path.startsWith('/ops/jobs/failed?offset=1')) return { ok: false, status: 409,
      json: async () => ({ code: 'QUEUE_CHANGED', message: '失败任务列表已变化' }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  await ui.item('moreFailedJobs').onclick?.();
  assert.equal(firstPageReads, 2);
  assert.equal(ui.item('failedJobs').children.length, 1);
  assert.match((ui.item('failedJobs').children[0] as { textContent: string }).textContent, /new-job/);
  assert.match(ui.item('status').textContent, /失败任务列表变化，已从第一页刷新/);
});

test('operator workbench loads older privacy requests and shows the full queue count', async () => {
  const paths: string[] = [];
  const ui = await workbench(async path => {
    paths.push(path);
    if (path === '/ops/privacy?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [{ id: 'privacy-1', kind: 'DELETE', status: 'OPEN' }],
        total: 2, nextOffset: 1, snapshot: 'b'.repeat(32) }) };
    if (path === `/ops/privacy?offset=1&snapshot=${'b'.repeat(32)}`) return { ok: true, status: 200,
      json: async () => ({ items: [{ id: 'privacy-2', kind: 'EXPORT', status: 'OPEN' }],
        total: 2, nextOffset: null, snapshot: 'b'.repeat(32) }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('status').textContent, /个人信息请求 2/);
  assert.equal(ui.item('privacy').children.length, 1);
  await ui.item('morePrivacy').onclick?.();
  assert.equal(ui.item('privacy').children.length, 2);
  assert.deepEqual(paths.filter(path => path.startsWith('/ops/privacy?')),
    ['/ops/privacy?offset=0', `/ops/privacy?offset=1&snapshot=${'b'.repeat(32)}`]);
});

test('operator workbench loads older appeals and shows the full queue count', async () => {
  const paths: string[] = [];
  const ui = await workbench(async path => {
    paths.push(path);
    if (path === '/ops/appeals?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [{ id: 'appeal-1', description: '首次申诉', status: 'OPEN' }],
        total: 2, nextOffset: 1, snapshot: 'c'.repeat(32) }) };
    if (path === `/ops/appeals?offset=1&snapshot=${'c'.repeat(32)}`) return { ok: true, status: 200,
      json: async () => ({ items: [{ id: 'appeal-2', description: '后续申诉', status: 'RESOLVED' }],
        total: 2, nextOffset: null, snapshot: 'c'.repeat(32) }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('status').textContent, /申诉 2/);
  assert.equal(ui.item('appeals').children.length, 1);
  await ui.item('moreAppeals').onclick?.();
  assert.equal(ui.item('appeals').children.length, 2);
  assert.deepEqual(paths.filter(path => path.startsWith('/ops/appeals?')),
    ['/ops/appeals?offset=0', `/ops/appeals?offset=1&snapshot=${'c'.repeat(32)}`]);
});

test('operator workbench restarts appeal paging when a case changes', async () => {
  let firstPageReads = 0;
  const ui = await workbench(async path => {
    if (path === '/ops/appeals?offset=0') {
      firstPageReads += 1;
      const description = firstPageReads === 1 ? '旧申诉' : '新申诉';
      return { ok: true, status: 200, json: async () => ({ items: [{ id: 'appeal', description, status: 'OPEN' }],
        total: 2, nextOffset: 1, snapshot: firstPageReads === 1 ? 'a'.repeat(32) : 'b'.repeat(32) }) };
    }
    if (path.startsWith('/ops/appeals?offset=1')) return { ok: false, status: 409,
      json: async () => ({ code: 'QUEUE_CHANGED', message: '队列已变化' }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  await ui.item('moreAppeals').onclick?.();
  assert.equal(firstPageReads, 2);
  assert.equal(ui.item('appeals').children.length, 1);
  assert.match((ui.item('appeals').children[0] as { textContent: string }).textContent, /新申诉/);
  assert.match(ui.item('status').textContent, /申诉列表变化，已从第一页刷新/);
});

test('operator workbench restarts privacy paging when a new request arrives', async () => {
  let firstPageReads = 0;
  const ui = await workbench(async path => {
    if (path === '/ops/privacy?offset=0') {
      firstPageReads += 1;
      const id = firstPageReads === 1 ? 'old-request' : 'new-request';
      return { ok: true, status: 200, json: async () => ({ items: [{ id, kind: 'DELETE', status: 'OPEN' }],
        total: firstPageReads === 1 ? 2 : 3, nextOffset: 1,
        snapshot: firstPageReads === 1 ? 'a'.repeat(32) : 'b'.repeat(32) }) };
    }
    if (path.startsWith('/ops/privacy?offset=1')) return { ok: false, status: 409,
      json: async () => ({ code: 'QUEUE_CHANGED', message: '队列已变化' }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  await ui.item('morePrivacy').onclick?.();
  assert.equal(firstPageReads, 2);
  assert.equal(ui.item('privacy').children.length, 1);
  assert.match((ui.item('privacy').children[0] as { textContent: string }).textContent, /new-request/);
  assert.match(ui.item('status').textContent, /个人信息请求列表变化，已从第一页刷新/);
});

test('operator workbench restarts report paging when the queue changes', async () => {
  let firstPageReads = 0;
  const ui = await workbench(async path => {
    if (path === '/ops/reports?offset=0') {
      firstPageReads += 1;
      const id = firstPageReads === 1 ? 'ordinary' : 'new-safety';
      return { ok: true, status: 200, json: async () => ({ items: [{ id, kind: 'SAFETY', status: 'OPEN', description: id }],
        total: firstPageReads === 1 ? 2 : 3, nextOffset: 1, snapshot: firstPageReads === 1 ? 'a'.repeat(32) : 'b'.repeat(32) }) };
    }
    if (path.includes('offset=1')) return { ok: false, status: 409,
      json: async () => ({ code: 'QUEUE_CHANGED', message: '队列已变化' }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  await ui.item('moreReports').onclick?.();
  assert.equal(firstPageReads, 2);
  assert.equal(ui.item('reports').children.length, 1);
  assert.match((ui.item('reports').children[0] as { textContent: string }).textContent, /new-safety/);
  assert.match(ui.item('status').textContent, /已从第一页刷新/);
});

test('refresh clears an old report cursor before another page can load', async () => {
  let resolveSecond!: (value: unknown) => void;
  const pendingSecond = new Promise(resolve => { resolveSecond = resolve; });
  let firstPageReads = 0;
  let laterPageReads = 0;
  const ui = await workbench(async path => {
    if (path === '/ops/reports?offset=0') {
      firstPageReads += 1;
      return firstPageReads === 1
        ? { ok: true, status: 200, json: async () => ({ items: [{ id: 'old', kind: 'OTHER', status: 'OPEN', description: '旧队列' }],
          total: 2, nextOffset: 1, snapshot: 'a'.repeat(32) }) }
        : pendingSecond;
    }
    if (path.includes('offset=1')) laterPageReads += 1;
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  const refreshing = ui.item('refresh').onclick?.();
  await ui.item('moreReports').onclick?.();
  assert.equal(laterPageReads, 0);
  resolveSecond({ ok: true, status: 200, json: async () => ({ items: [{ id: 'new', kind: 'SAFETY', status: 'OPEN', description: '新队列' }],
    total: 1, nextOffset: null, snapshot: 'b'.repeat(32) }) });
  await refreshing;
  assert.equal(ui.item('reports').children.length, 1);
  assert.match((ui.item('reports').children[0] as { textContent: string }).textContent, /新队列/);
});

test('notification follow-up queue remains visible in workbench status', async () => {
  const ui = await workbench(async path => path === '/ops/notifications/followups?offset=0'
    ? { ok: true, status: 200, json: async () => ({ items: [{ notificationId: 'n1', eventId: 'e1', userId: 'p1', kind: 'EVENT_CANCELLED', externalStatus: 'UNAVAILABLE' }], total: 1, nextOffset: null, snapshot: 'a'.repeat(32) }) }
    : { ok: true, status: 200, json: async () => ({ items: [] }) });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('status').textContent, /通知待跟进 1/);
});

test('operator workbench loads every follow-up page and shows total', async () => {
  const paths: string[] = [];
  const ui = await workbench(async path => {
    paths.push(path);
    if (path === '/ops/notifications/followups?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [{ notificationId: 'first', eventId: 'e', userId: 'p1', kind: 'REMINDER', externalStatus: 'UNAVAILABLE' }],
        total: 2, nextOffset: 1, snapshot: 'a'.repeat(32) }) };
    if (path === `/ops/notifications/followups?offset=1&snapshot=${'a'.repeat(32)}`) return { ok: true, status: 200,
      json: async () => ({ items: [{ notificationId: 'second', eventId: 'e', userId: 'p2', kind: 'REMINDER', externalStatus: 'UNAVAILABLE' }],
        total: 2, nextOffset: null, snapshot: 'a'.repeat(32) }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('status').textContent, /通知待跟进 2/);
  assert.equal(ui.item('notificationFollowups').children.length, 1);
  await ui.item('moreNotificationFollowups').onclick?.();
  assert.equal(ui.item('notificationFollowups').children.length, 2);
  assert.deepEqual(paths.filter(path => path.startsWith('/ops/notifications/followups?')),
    ['/ops/notifications/followups?offset=0', `/ops/notifications/followups?offset=1&snapshot=${'a'.repeat(32)}`]);
});

test('operator workbench reloads follow-ups after a stale page', async () => {
  let firstPageReads = 0;
  const ui = await workbench(async path => {
    if (path === '/ops/notifications/followups?offset=0') {
      firstPageReads += 1;
      return { ok: true, status: 200, json: async () => ({ items: [{ notificationId: firstPageReads === 1 ? 'old' : 'new',
        eventId: 'e', userId: firstPageReads === 1 ? 'old-user' : 'new-user', kind: 'REMINDER', externalStatus: 'UNAVAILABLE' }],
        total: 2, nextOffset: 1, snapshot: (firstPageReads === 1 ? 'a' : 'b').repeat(32) }) };
    }
    if (path.startsWith('/ops/notifications/followups?offset=1')) return { ok: false, status: 409,
      json: async () => ({ code: 'QUEUE_CHANGED', message: '队列已变化' }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  await ui.item('moreNotificationFollowups').onclick?.();
  assert.equal(firstPageReads, 2);
  assert.equal(ui.item('notificationFollowups').children.length, 1);
  assert.match((ui.item('notificationFollowups').children[0] as { textContent: string }).textContent, /new-user/);
  assert.match(ui.item('status').textContent, /通知待跟进列表变化，已从第一页刷新/);
});

test('failed follow-up page can be retried from the same offset', async () => {
  let laterReads = 0;
  const ui = await workbench(async path => {
    if (path === '/ops/notifications/followups?offset=0') return { ok: true, status: 200,
      json: async () => ({ items: [{ notificationId: 'first', eventId: 'e', userId: 'p1', kind: 'REMINDER', externalStatus: 'UNAVAILABLE' }],
        total: 2, nextOffset: 1, snapshot: 'a'.repeat(32) }) };
    if (path.startsWith('/ops/notifications/followups?offset=1')) {
      laterReads += 1;
      return laterReads === 1
        ? { ok: false, status: 503, json: async () => ({ message: '暂时不可用' }) }
        : { ok: true, status: 200, json: async () => ({ items: [{ notificationId: 'second', eventId: 'e', userId: 'p2', kind: 'REMINDER', externalStatus: 'UNAVAILABLE' }],
          total: 2, nextOffset: null, snapshot: 'a'.repeat(32) }) };
    }
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  await ui.item('moreNotificationFollowups').onclick?.();
  assert.equal(ui.item('notificationFollowups').children.length, 1);
  assert.equal((ui.item('moreNotificationFollowups') as { disabled?: boolean }).disabled, false);
  await ui.item('moreNotificationFollowups').onclick?.();
  assert.equal(laterReads, 2);
  assert.equal(ui.item('notificationFollowups').children.length, 2);
});

test('completed notification follow-ups remain reviewable in workbench', async () => {
  const ui = await workbench(async path => path === '/ops/notifications/followups/history'
    ? { ok: true, status: 200, json: async () => ({ items: [{ notificationId: 'n1', eventId: 'e1', userId: 'p1', kind: 'EVENT_CANCELLED',
      externalStatus: 'UNKNOWN_REQUIRES_RECONCILIATION', note: '已联系主办方核对消息', recordedBy: 'operator:reviewer', recordedAt: '2026-09-25T10:00:00.000Z' }] }) }
    : { ok: true, status: 200, json: async () => ({ items: [] }) });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('status').textContent, /最近已跟进 1/);
  assert.equal(ui.item('notificationHistory').children.length, 1);
  assert.match((ui.item('notificationHistory').children[0] as { textContent: string }).textContent, /已联系主办方核对消息/);
});

test('pilot metrics show mature samples and unavailable profit without exposing activity identities', async () => {
  const ui = await workbench(async path => path === '/ops/metrics'
    ? { ok: true, status: 200, json: async () => ({ eventCutoffAt: '2027-02-01T00:00:00.000Z',
      weeks: [{ weekStart: '2027-01-04', qualified: 2, pendingReview: 1, unqualified: 3, reasons: {} }],
      dueEventCompletion: { dueEvents: 6, evidenceQualified: 2, pendingReview: 1, unqualified: 3,
        evidenceQualifiedRate: 1 / 3, possibleRateAfterReview: 0.5,
        minimumSampleMet: false, threshold70Met: null },
      hostReuse28d: { maturedHosts: 3, reusedHosts: 1, rate: 1 / 3, secondEventDue: 1,
        secondEventQualified: 1, secondEventCompletionRate: 1 },
      participantReturn30d: { observedParticipants: 25, maturedParticipants: 20, returnedParticipants: 5,
        rate: 0.25, minimumSampleMet: false, threshold25Met: null },
      waitlistOfferConversion: { issued: 5, accepted: 1, expired: 2, cancelled: 1, active: 1,
        unclassified: 0, matured: 3, acceptanceRate: 1 / 3 },
      attendanceDiagnostic: { status: 'COMPLETE', dueEvents: 6, confirmedAtDeadline: 10,
        attendedFromDeadlineCohort: 7, finalActualAttended: 8, cancelledAfterDeadline: 2,
        removedAfterDeadline: 1, unknownDeadlineStates: 0, missingDeadlineEvents: 0,
        cohortAttendanceRate: 0.7 },
      formationTime: { formedEvents: 2, medianMinutes: 60 },
      contributionProfit: { status: 'UNAVAILABLE', missingInputs: ['confirmedRevenue'] } }) }
    : { ok: true, status: 200, json: async () => ({ items: [] }) });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('metrics').textContent, /2027-01-04.*合格 2.*待复核 1/);
  assert.match(ui.item('metrics').textContent, /成熟主办方 3.*复用 1/);
  assert.match(ui.item('metrics').textContent, /到期活动 6.*证据合格 2.*待复核 1.*33\.3%.*样本不足/);
  assert.match(ui.item('metrics').textContent, /成熟 30 天 20.*再次参与 5.*25\.0%.*成熟用户不足 100/);
  assert.match(ui.item('metrics').textContent, /候补邀请已发 5.*确认 1.*过期 2.*取消 1.*未到期 1.*确认率 33\.3%/);
  assert.match(ui.item('metrics').textContent, /报名截止已确认 10.*其中到场 7.*最终实际到场 8.*本人退出 2.*主办移除 1.*70\.0%/);
  assert.match(ui.item('metrics').textContent, /成局耗时.*2 场.*60\.0 分钟/);
  assert.match(ui.item('metrics').textContent, /贡献利润.*不可计算/);
  assert.doesNotMatch(ui.item('metrics').textContent, /hostId|eventId/);
});

test('operations page labels a mature completion gate pending when case review could change it', async () => {
  const ui = await workbench(async path => path === '/ops/metrics'
    ? { ok: true, status: 200, json: async () => ({ weeks: [],
      dueEventCompletion: { dueEvents: 100, evidenceQualified: 69, pendingReview: 2, unqualified: 29,
        evidenceQualifiedRate: 0.69, possibleRateAfterReview: 0.71,
        minimumSampleMet: true, threshold70Met: null },
      hostReuse28d: {}, directSupportMinutes: {}, contributionProfit: {} }) }
    : { ok: true, status: 200, json: async () => ({ items: [] }) });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('metrics').textContent, /69\.0%.*待复核可能改变结论/);
  assert.doesNotMatch(ui.item('metrics').textContent, /样本不足/);
});

test('operations page withholds attendance rate when old deadline status is unknown', async () => {
  const ui = await workbench(async path => path === '/ops/metrics'
    ? { ok: true, status: 200, json: async () => ({ weeks: [], dueEventCompletion: {}, hostReuse28d: {},
      attendanceDiagnostic: { status: 'PARTIAL', dueEvents: 2, confirmedAtDeadline: 1,
        attendedFromDeadlineCohort: 1, finalActualAttended: 2, cancelledAfterDeadline: 0,
        removedAfterDeadline: 0, unknownDeadlineStates: 1, missingDeadlineEvents: 0,
        cohortAttendanceRate: null }, directSupportMinutes: {}, contributionProfit: {} }) }
    : { ok: true, status: 200, json: async () => ({ items: [] }) });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('metrics').textContent, /报名截止已知确认 1.*最终实际到场 2.*1 条报名状态未知.*不判定比率/);
  assert.doesNotMatch(ui.item('metrics').textContent, /报名到场率 100\.0%/);
});

test('operations page leaves D30 undecided when return check-ins await event evidence', async () => {
  const ui = await workbench(async path => path === '/ops/metrics'
    ? { ok: true, status: 200, json: async () => ({ weeks: [], dueEventCompletion: {}, hostReuse28d: {},
      participantReturn30d: { observedParticipants: 100, maturedParticipants: 100, returnedParticipants: 20,
        pendingReturnParticipants: 10, rate: 0.2, possibleRateAfterReview: 0.3,
        minimumSampleMet: true, threshold25Met: null },
      directSupportMinutes: {}, contributionProfit: {} }) }
    : { ok: true, status: 200, json: async () => ({ items: [] }) });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('metrics').textContent, /再参与待补证据 10.*20\.0%.*待补结项证据可能改变结论.*30\.0%/);
});

test('operations page leaves D30 undecided when first participation is under review', async () => {
  const ui = await workbench(async path => path === '/ops/metrics'
    ? { ok: true, status: 200, json: async () => ({ weeks: [], dueEventCompletion: {}, hostReuse28d: {},
      participantReturn30d: { observedParticipants: 100, maturedParticipants: 100, returnedParticipants: 25,
        pendingFirstParticipants: 1, pendingReturnParticipants: 0, rate: 0.25, possibleRateAfterReview: 0.25,
        minimumSampleMet: true, threshold25Met: null }, directSupportMinutes: {}, contributionProfit: {} }) }
    : { ok: true, status: 200, json: async () => ({ items: [] }) });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('metrics').textContent, /首场待复核 1.*首场参与待复核，成熟样本口径未定/);
});

test('operations page shows partial support minutes and sends a scoped entry', async () => {
  const writes: string[] = [];
  const ui = await workbench(async (path, options) => {
    if (options?.method === 'POST') { writes.push(path); return { ok: true, status: 201, json: async () => ({ id: 'entry' }) }; }
    if (path === '/ops/metrics') return { ok: true, status: 200, json: async () => ({ weeks: [],
      hostReuse28d: { maturedHosts: 0, reusedHosts: 0, rate: null },
      directSupportMinutes: { status: 'PARTIAL', dueEvents: 3, eventsWithEntries: 1, entries: 2, recordedMinutes: 25 },
      contributionProfit: { status: 'UNAVAILABLE', missingInputs: [] } }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  await ui.item('refresh').onclick?.();
  assert.match(ui.item('metrics').textContent, /已记录人工 25 分钟.*1\/3 场.*记录不完整/);
  ui.item('supportEventId').value = 'event-123';
  ui.item('supportMinutes').value = '12';
  ui.item('supportCategory').value = 'SUPPORT';
  await ui.item('recordSupportMinutes').onclick?.();
  assert.deepEqual(writes, ['/ops/events/event-123/support-minutes']);
});

test('an uncertain support minute write retries with the same idempotency key', async () => {
  const keys: string[] = [];
  const ui = await workbench(async (path, options) => {
    if (path.includes('/support-minutes') && options?.method === 'POST') {
      keys.push(options.headers?.['Idempotency-Key'] ?? '');
      if (keys.length === 1) throw new Error('connection interrupted');
      return { ok: true, status: 201, json: async () => ({ id: 'recorded' }) };
    }
    if (path === '/ops/metrics') return { ok: true, status: 200, json: async () => ({ weeks: [], hostReuse28d: {}, directSupportMinutes: {}, contributionProfit: {} }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
  ui.item('supportEventId').value = 'event-123';
  ui.item('supportMinutes').value = '8';
  ui.item('supportCategory').value = 'SUPPORT';
  await ui.item('recordSupportMinutes').onclick?.();
  await ui.item('recordSupportMinutes').onclick?.();
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});
