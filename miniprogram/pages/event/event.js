const { api } = require('../../utils/api.js');
const { drawCheckInQr } = require('../../utils/checkin-qr.js');
const config = require('../../config.js');
function currentIdentity() {
  return wx.getStorageSync('sessionToken') ? wx.getStorageSync('userId')
    : wx.getStorageSync('devUser') || config.developmentUser || '';
}
function editorIdentity() {
  return wx.getStorageSync('sessionToken') ? 'user:' + wx.getStorageSync('userId')
    : 'dev:' + (wx.getStorageSync('devUser') || config.developmentUser || '');
}
function newSourceToken() {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0')).join('');
}
function eventDisplay(event) {
  const payload = event.payload || {};
  const format = value => {
    const timestamp = Date.parse(value || '');
    if (!Number.isFinite(timestamp)) return '待确认';
    const local = new Date(timestamp + 8 * 60 * 60_000);
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][local.getUTCDay()];
    return `${local.getUTCMonth() + 1} 月 ${local.getUTCDate()} 日（${weekday}）${local.toISOString().slice(11, 16)}`;
  };
  const feeCap = Number(payload.feeCapFen);
  return {
    title: payload.title || event.title || '未命名活动',
    date: format(payload.startAt || event.startAt),
    end: format(payload.endAt || event.endAt),
    location: [payload.city || event.city, payload.venueName || event.venueName].filter(Boolean).join(' · ') || '地点待确认',
    fee: payload.feeMode === 'FREE' ? '免费' : payload.feeMode === 'AA' && Number.isFinite(feeCap)
      ? `AA 制 · 每人上限 ¥${feeCap / 100}` : '费用待确认',
    status: { DRAFT: '草稿', RECRUITING: '招募中', CONFIRMED: '已成局', IN_PROGRESS: '进行中',
      COMPLETED: '已结束', CANCELLED: '已取消', EXPIRED: '未成局' }[event.status] || event.status || '状态待确认'
  };
}
function sectionAvailable(section, isHost, canApproveRegistration) {
  return ['detailsSection', 'registrationSection', 'contentSection', 'checkinSection', 'expenseSection'].includes(section) ||
    (section === 'hostSection' && isHost) ||
    (section === 'cohostApprovalSection' && !isHost && canApproveRegistration);
}
Page({
  data: { id: '', token: '', source: '', activeSection: 'detailsSection', event: null, display: null, registrationLabel: '未报名', inviteSummary: null, loadState: 'IDLE', isHost: false, successState: '',
    joinConfirmation: null, joinSubmitting: false,
    canJoin: false, canExpressInterest: false, canUseCollaboration: false, canPostQuestion: false, canCheckIn: false,
    canApproveRegistration: false, canManageCheckins: false, canManageAnnouncements: false,
    myRegistration: null, registrations: [], cohostGrants: [], cohostUserId: '', selectedCohostCapabilities: ['CHECKIN_MANAGE'], aliases: [],
    safetyStatus: 'UNKNOWN',
    hostAlias: '', aliasInput: '', canSetAlias: false, aliasNoticeVersion: '', aliasNoticeText: '',
    aliasReconfirmationRequired: false, aliasLoadState: 'IDLE', aliasError: '',
    shareMetrics: null, shareSourceToken: '', preparingShare: false,
    repeatCandidates: [], repeatCandidateNames: '暂无', attentionItems: [], factTodos: [], message: '',
    reservationToken: '', reservationTokens: [], checkInToken: '', displayedCheckInToken: '', checkInExpiresIn: 0,
    totalYuan: '', actualCount: '', completionHeld: null, completionAnomaly: '', completionVenueIssue: '', content: [], contentLoadState: 'IDLE', contentError: '',
    expenses: [], expenseLoadState: 'IDLE', expenseError: '', outcome: null, outcomeLoadState: 'IDLE', outcomeError: '',
    checkIns: [], manualCheckIns: [], attendanceLoadState: 'IDLE', attendanceError: '', reconfirmation: null,
    canRequestManualCheckIn: false, currentUser: '',
    feedbackHeld: null, feedbackWouldRepeat: null, feedbackReason: '', questionText: '', factQuestionText: '', announcementText: '', answerText: '', answerQuestionId: '', removalReason: '' },
  async onLoad(options) {
    this.setData({ id: options.id || '', token: options.token || '', source: options.source || '', activeSection: 'detailsSection', successState: '' });
    await getApp().globalData.ready;
    const loaded = await this.refresh();
    if (loaded && options.success === 'published' && this.data.isHost &&
      this.data.event?.id === options.id && this.data.event.status === 'RECRUITING')
      this.setData({ successState: 'PUBLISHED' });
    if (loaded && this.data.loadState === 'READY' &&
      sectionAvailable(options.section, this.data.isHost, this.data.canApproveRegistration)) {
      if (typeof wx.nextTick === 'function') await new Promise(resolve => wx.nextTick(resolve));
      this.scrollToSection(options.section);
    }
  },
  async onShow() {
    this.checkInPageHidden = false;
    const actor = currentIdentity();
    if (this.data.currentUser && this.data.currentUser !== actor) {
      this.refreshId = (this.refreshId || 0) + 1;
      this.clearCheckInToken();
      this.setData({ token: '', source: '', activeSection: 'detailsSection', event: null, display: null, registrationLabel: '未报名', inviteSummary: null, loadState: 'IDLE', isHost: false, successState: '',
        joinConfirmation: null, joinSubmitting: false,
        canJoin: false, canExpressInterest: false, canUseCollaboration: false, canPostQuestion: false, canCheckIn: false,
        canApproveRegistration: false, canManageCheckins: false, canManageAnnouncements: false,
        safetyStatus: 'UNKNOWN', myRegistration: null,
        registrations: [], cohostGrants: [], cohostUserId: '', selectedCohostCapabilities: ['CHECKIN_MANAGE'], aliases: [], hostAlias: '', aliasInput: '', canSetAlias: false,
        aliasNoticeVersion: '', aliasNoticeText: '', aliasReconfirmationRequired: false, aliasLoadState: 'IDLE', aliasError: '',
        shareMetrics: null, shareSourceToken: '', preparingShare: false, repeatCandidates: [],
        repeatCandidateNames: '暂无', attentionItems: [], factTodos: [], content: [], contentLoadState: 'IDLE', contentError: '',
        expenses: [], expenseLoadState: 'IDLE', expenseError: '', outcome: null, outcomeLoadState: 'IDLE', outcomeError: '',
        checkIns: [], manualCheckIns: [], attendanceLoadState: 'IDLE', attendanceError: '', reconfirmation: null, canRequestManualCheckIn: false,
        reservationToken: '', reservationTokens: [], checkInToken: '', displayedCheckInToken: '', checkInExpiresIn: 0,
        totalYuan: '', actualCount: '', completionHeld: null, completionAnomaly: '', completionVenueIssue: '', feedbackHeld: null, feedbackWouldRepeat: null,
        feedbackReason: '', questionText: '', factQuestionText: '', announcementText: '', answerText: '',
        answerQuestionId: '', removalReason: '',
        message: '', currentUser: actor });
    }
    if (!this.hasShown) { this.hasShown = true; return; }
    await getApp().globalData.ready;
    await this.refresh();
  },
  onHide() {
    this.checkInPageHidden = true;
    this.clearCheckInToken();
    this.closeJoinConfirmation();
    if (this.data.successState) this.setData({ successState: '' });
  },
  onUnload() {
    this.checkInPageHidden = true;
    this.clearCheckInToken();
    this.closeJoinConfirmation();
  },
  clearCheckInToken() {
    this.checkInRequestId = (this.checkInRequestId || 0) + 1;
    clearTimeout(this.checkInRefreshTimer);
    this.checkInRefreshTimer = null;
    if (this.data.displayedCheckInToken) this.setData({ displayedCheckInToken: '', checkInExpiresIn: 0 });
  },
  async refresh() {
    const refreshId = (this.refreshId || 0) + 1;
    this.refreshId = refreshId;
    this.clearCheckInToken();
    const actor = currentIdentity();
    this.setData({ loadState: 'LOADING' });
    let summary = null;
    try {
      if (this.data.token) {
        try {
          summary = await api.get('/i/' + encodeURIComponent(this.data.token) +
            (this.data.source ? '?source=' + encodeURIComponent(this.data.source) : ''));
        } catch (error) {
          // A known member may still read the last approved activity details by id.
          if (!this.data.id) throw error;
        }
      }
      const id = this.data.id || summary?.id;
      if (!id) {
        if (refreshId === this.refreshId) this.setData({ loadState: 'ERROR', message: '邀请或活动不存在' });
        return false;
      }
      const mine = await api.get('/me/registrations');
      const myRegistration = mine.items.find(item => item.event_id === id) || null;
      const myStatus = myRegistration?.status;
      const knownMember = ['INTERESTED', 'REQUESTED', 'WAITLISTED', 'OFFERED', 'CONFIRMED', 'RECONFIRM_REQUIRED'].includes(myStatus);
      const privilegedFromOwnList = summary && !knownMember && summary.payload?.visibility !== 'PUBLIC'
        ? (await api.get('/me/events').catch(() => ({ items: [] }))).items.some(item =>
          item.id === id && (item.isHost || item.isCohost))
        : false;
      let event = summary;
      if (!summary || summary.payload?.visibility === 'PUBLIC' || knownMember || privilegedFromOwnList) {
        try { event = await api.get('/events/' + encodeURIComponent(id)); }
        catch (error) { if (!summary) throw error; }
      }
      const isHost = event.hostId === actor;
      const cohostCapabilities = Array.isArray(event.cohostCapabilities) ? event.cohostCapabilities : [];
      const canApproveRegistration = isHost || cohostCapabilities.includes('APPROVE_REGISTRATION');
      const canManageCheckins = isHost || cohostCapabilities.includes('CHECKIN_MANAGE');
      const canManageAnnouncements = isHost || cohostCapabilities.includes('MANAGE_ANNOUNCEMENTS');
      const safety = await api.get('/system/safety').catch(() => ({ status: 'UNKNOWN' }));
      const safetyStatus = ['OPEN', 'CLOSED'].includes(safety?.status) ? safety.status : 'UNKNOWN';
      const registrationLabel = { CONFIRMED: '已确认报名', REQUESTED: '待主办方审核', WAITLISTED: '候补中',
        OFFERED: '待确认补位', INTERESTED: '暂不确定', RECONFIRM_REQUIRED: '待重新确认',
        CANCELLED: '已退出', EXPIRED: '已过期', REJECTED: '未通过' }[myStatus] || '未报名';
      const canJoin = !myStatus || ['CANCELLED', 'EXPIRED', 'REJECTED', 'INTERESTED'].includes(myStatus);
      const canExpressInterest = !myStatus || ['CANCELLED', 'EXPIRED', 'REJECTED'].includes(myStatus);
      const canUseCollaboration = isHost || cohostCapabilities.length > 0 || ['CONFIRMED', 'RECONFIRM_REQUIRED', 'WAITLISTED', 'OFFERED'].includes(myStatus);
      const canPostQuestion = canUseCollaboration && ['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(event.status);
      const canCheckIn = myStatus === 'CONFIRMED' && ['CONFIRMED', 'IN_PROGRESS'].includes(event.status);
      let aliasResponse = { items: [], notice: null, reconfirmationRequired: false };
      const canReadAliases = isHost || ['CONFIRMED', 'RECONFIRM_REQUIRED', 'WAITLISTED', 'OFFERED'].includes(myStatus);
      let aliasLoadState = canReadAliases ? 'READY' : 'FORBIDDEN'; let aliasError = '';
      if (canReadAliases) try {
        aliasResponse = await api.get(`/events/${encodeURIComponent(id)}/aliases`);
        if (!Array.isArray(aliasResponse.items) || !aliasResponse.notice?.version || !aliasResponse.notice?.text)
          throw new Error('昵称授权信息无效，请重试');
      } catch (error) {
        aliasResponse = { items: [], notice: null, reconfirmationRequired: false };
        aliasLoadState = 'ERROR'; aliasError = error.message || '昵称授权信息加载失败，请重试';
      }
      const aliases = aliasResponse.items;
      const hostAlias = aliases.find(item => item.isHost)?.displayName || '主办方未设置活动内昵称';
      const canSetAlias = isHost || ['CONFIRMED', 'RECONFIRM_REQUIRED', 'WAITLISTED', 'OFFERED'].includes(myRegistration?.status);
      const registrations = canApproveRegistration || canManageCheckins
        ? (await api.get(`/events/${encodeURIComponent(id)}/registrations`)).items : [];
      const cohostGrants = isHost ? (await api.get(`/events/${encodeURIComponent(id)}/cohosts`)).items.map(grant => ({
        ...grant, capabilitiesText: grant.capabilities.join('、'),
        usable: grant.status === 'ACTIVE' && Date.parse(grant.expiresAt) > Date.now()
      })) : [];
      const shareMetrics = isHost && event.status !== 'DRAFT' ? await api.get(`/events/${encodeURIComponent(id)}/share-metrics`) : null;
      const repeatCandidates = isHost && event.status === 'COMPLETED'
        ? (await api.get(`/events/${encodeURIComponent(id)}/repeat-candidates`)).items : [];
      const attentionItems = isHost && ['CANCELLED', 'EXPIRED'].includes(event.status)
        ? (await api.get(`/events/${encodeURIComponent(id)}/attention`)).items : [];
      const factTodos = isHost && event.status !== 'DRAFT' ? (await api.get(`/events/${encodeURIComponent(id)}/fact-todos`)).items : [];
      let content = [];
      let contentLoadState = canUseCollaboration ? 'EMPTY' : 'FORBIDDEN';
      let contentError = '';
      if (canUseCollaboration) try {
        const response = await api.get(`/events/${encodeURIComponent(id)}/content`);
        if (!Array.isArray(response.items)) throw new Error('公告问答记录无效，请重试');
        content = response.items;
        contentLoadState = content.length ? 'READY' : 'EMPTY';
      } catch (error) {
        contentLoadState = error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR';
        contentError = error.message || '公告问答加载失败，请重试';
      }
      let expenses = [];
      const canReadExpenses = isHost || ['CONFIRMED', 'RECONFIRM_REQUIRED'].includes(myStatus);
      let expenseLoadState = canReadExpenses ? 'EMPTY' : 'FORBIDDEN';
      let expenseError = '';
      if (canReadExpenses) try {
        const response = await api.get(`/events/${encodeURIComponent(id)}/expenses`);
        if (!Array.isArray(response.items)) throw new Error('费用记录无效，请重试');
        expenses = response.items;
        expenseLoadState = expenses.length ? 'READY' : 'EMPTY';
      } catch (error) {
        expenseLoadState = error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR';
        expenseError = error.message || '费用记录加载失败，请重试';
      }
      let manualCheckIns = [];
      let checkIns = [];
      const canReadAttendance = isHost || cohostCapabilities.length > 0 ||
        ['INTERESTED', 'REQUESTED', 'WAITLISTED', 'OFFERED', 'CONFIRMED', 'RECONFIRM_REQUIRED'].includes(myStatus);
      let attendanceLoadState = canReadAttendance ? 'EMPTY' : 'FORBIDDEN';
      let attendanceError = '';
      if (canReadAttendance) try {
        const [manual, scanned] = await Promise.all([
          api.get(`/events/${encodeURIComponent(id)}/manual-checkins`),
          api.get(`/events/${encodeURIComponent(id)}/checkins`)
        ]);
        if (!Array.isArray(manual.items) || !Array.isArray(scanned.items)) throw new Error('到场记录无效，请重试');
        manualCheckIns = manual.items;
        checkIns = scanned.items;
        attendanceLoadState = manualCheckIns.length || checkIns.length ? 'READY' : 'EMPTY';
      } catch (error) {
        attendanceLoadState = error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR';
        attendanceError = error.message || '到场记录加载失败，请重试';
      }
      const pending = myRegistration?.status === 'RECONFIRM_REQUIRED'
        ? (await api.get(`/events/${encodeURIComponent(id)}/reconfirmation`)).pending : null;
      const labels = { venueName: '场馆', startAt: '开始时间', endAt: '结束时间', feeCapFen: '费用上限（分）', feeMode: '费用模式',
        minParticipants: '最少人数', maxParticipants: '最多人数', visibility: '可见范围', cancellationRule: '取消规则', city: '城市' };
      const reconfirmation = pending ? { ...pending, changes: pending.changes.map(change => ({ ...change, label: labels[change.field] || change.field })) } : null;
      let outcome = null;
      let outcomeLoadState = 'IDLE';
      let outcomeError = '';
      if (event.status === 'COMPLETED') {
        try {
          const response = await api.get(`/events/${encodeURIComponent(id)}/outcome`);
          if (response?.eventId !== id || typeof response.held !== 'boolean' ||
            !Number.isInteger(response.actualCount) || typeof response.myFeedbackSubmitted !== 'boolean' ||
            !['NOT_HELD', 'HOST_ONLY', 'MEMBER_CORROBORATED', 'DISPUTED'].includes(response.level))
            throw new Error('结项证据无效，请重试');
          outcome = response;
          outcomeLoadState = 'READY';
        } catch (error) {
          outcomeLoadState = error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR';
          outcomeError = error.message || '结项证据加载失败，请重试';
        }
      }
      const now = Date.now();
      const canRequestManualCheckIn = canManageCheckins && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(event.status) &&
        now >= Date.parse(event.payload.startAt) - 30 * 60_000 && now <= Date.parse(event.payload.endAt) + 48 * 60 * 60_000;
      if (refreshId !== this.refreshId || actor !== currentIdentity()) return false;
      const previous = this.data.event;
      const shareSourceToken = event.recruiting && !event.riskPaused && previous?.id === id && previous.version === event.version &&
        previous.inviteToken === event.inviteToken ? this.data.shareSourceToken : '';
      this.setData({ id, event, display: eventDisplay(event), inviteSummary: null, loadState: 'READY', isHost, canJoin, canExpressInterest,
        canUseCollaboration, canPostQuestion, canCheckIn, canApproveRegistration, canManageCheckins, canManageAnnouncements,
        safetyStatus, myRegistration, registrationLabel, registrations, cohostGrants, aliases, hostAlias,
        aliasInput: aliases.find(item => item.isMine)?.displayName || '', canSetAlias,
        aliasNoticeVersion: aliasResponse.notice?.version || '', aliasNoticeText: aliasResponse.notice?.text || '',
        aliasReconfirmationRequired: Boolean(aliasResponse.reconfirmationRequired), aliasLoadState, aliasError,
        shareMetrics, shareSourceToken, repeatCandidates,
        repeatCandidateNames: repeatCandidates.join('、') || '暂无', attentionItems, factTodos, content, contentLoadState, contentError,
        expenses, expenseLoadState, expenseError,
        outcome, outcomeLoadState, outcomeError, checkIns, manualCheckIns, attendanceLoadState, attendanceError, reconfirmation,
        canRequestManualCheckIn, currentUser: actor, message: '' });
      this.reconcileSuccessState();
      return true;
    } catch (error) {
      if (refreshId !== this.refreshId || actor !== currentIdentity()) return false;
      const needsLogin = error.code === 'UNAUTHENTICATED' && summary && !config.developmentUser;
      this.setData({ event: null, display: null, registrationLabel: '未报名', inviteSummary: needsLogin ? summary : null,
        loadState: needsLogin ? 'LOGIN_REQUIRED' : 'ERROR', canJoin: false, canExpressInterest: false,
        canUseCollaboration: false, canPostQuestion: false, canCheckIn: false,
        canApproveRegistration: false, canManageCheckins: false, canManageAnnouncements: false,
        myRegistration: null, registrations: [], cohostGrants: [], aliases: [], hostAlias: '', canSetAlias: false,
        aliasNoticeVersion: '', aliasNoticeText: '', aliasReconfirmationRequired: false, aliasLoadState: 'IDLE', aliasError: '',
        content: [], contentLoadState: 'IDLE', contentError: '', expenses: [], expenseLoadState: 'IDLE', expenseError: '',
        outcome: null, outcomeLoadState: 'IDLE', outcomeError: '', checkIns: [],
        manualCheckIns: [], attendanceLoadState: 'IDLE', attendanceError: '', reconfirmation: null,
        attentionItems: [], factTodos: [], shareSourceToken: '', message: error.message || '加载失败' });
      return false;
    }
  },
  async retryLogin() {
    try { await api.login(); await this.refresh(); }
    catch (error) { this.setData({ loadState: 'LOGIN_REQUIRED', message: error.message || '登录失败，请重试' }); }
  },
  goToMyActivities() { wx.switchTab({ url: '/pages/index/index' }); },
  jumpToSection(event) {
    const id = event.currentTarget.dataset.section;
    if (sectionAvailable(id, this.data.isHost, this.data.canApproveRegistration))
      this.scrollToSection(id);
  },
  scrollToSection(id) {
    this.setData({ activeSection: id });
    const selector = '#' + id;
    if (typeof wx.createSelectorQuery !== 'function') return wx.pageScrollTo({ selector, duration: 260 });
    const query = wx.createSelectorQuery();
    query.select(selector).boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec(([rect, viewport]) => {
      if (!rect || !viewport || !Number.isFinite(rect.top) || !Number.isFinite(viewport.scrollTop))
        return wx.pageScrollTo({ selector, duration: 260 });
      wx.pageScrollTo({ scrollTop: Math.max(0, viewport.scrollTop + rect.top - 64), duration: 260 });
    });
  },
  dismissSuccess() { this.setData({ successState: '' }); },
  reconcileSuccessState() {
    const { successState, event, isHost, myRegistration } = this.data;
    const publishedStillCurrent = successState === 'PUBLISHED' && isHost && event?.status === 'RECRUITING';
    const joinedStillCurrent = successState === 'JOINED' && myRegistration?.status === 'CONFIRMED' &&
      ['RECRUITING', 'CONFIRMED', 'IN_PROGRESS'].includes(event?.status);
    if (successState && !publishedStillCurrent && !joinedStillCurrent) this.dismissSuccess();
  },
  viewSuccessDetails() {
    const section = this.data.successState === 'JOINED' ? 'registrationSection' : 'detailsSection';
    this.dismissSuccess();
    this.scrollToSection(section);
  },
  goToReport() {
    const actor = currentIdentity();
    getApp().globalData.reportContext = undefined;
    if (actor && this.data.id) getApp().globalData.reportContext = { actor, eventId: this.data.id };
    wx.switchTab({ url: '/pages/me/me' });
  },
  copySafetyDetails() {
    const event = this.data.event;
    if (!event || this.data.loadState !== 'READY') return this.setData({ message: '活动信息尚未加载完成，请稍后重试。' });
    const details = [
      `活动：${event.payload.title || '未命名活动'}`,
      `时间：${event.payload.startAt || '待定'} 至 ${event.payload.endAt || '待定'}`,
      `公共集合地点：${event.payload.city || '待定'} · ${event.payload.venueName || '待定'}`,
      `主办方：${this.data.hostAlias || '未设置活动内昵称'}`,
      `活动编号：${this.data.id}`,
      '请以当前活动信息和主办方核实为准；遇到人身紧急危险，请先离开风险地点并联系当地应急服务。'
    ].join('\n');
    wx.setClipboardData({ data: details,
      success: () => this.setData({ message: '活动信息已复制，请自行发给可信任的人。' }),
      fail: () => this.setData({ message: '复制失败，请稍后重试。' }) });
  },
  async action(path, payload, successText) {
    try {
      const result = await api.post(path, { expectedVersion: this.data.event.version, ...payload });
      if (await this.refresh()) this.setData({ message: successText });
      return result;
    } catch (error) { this.setData({ message: error.message || '操作失败' }); return null; }
  },
  openJoinConfirmation() {
    if (this.data.loadState !== 'READY' || !this.data.canJoin || !this.data.event) return;
    const event = this.data.event;
    const payload = event.payload || {};
    const display = eventDisplay(event);
    this.joinConfirmationGeneration = (this.joinConfirmationGeneration || 0) + 1;
    this.joinConfirmationActor = currentIdentity();
    this.setData({ joinSubmitting: false, joinConfirmation: {
      id: event.id, version: event.version, token: this.data.token,
      title: display.title, date: display.date, end: display.end, location: display.location, fee: display.fee,
      confirmed: event.stats?.confirmed ?? null, capacity: payload.maxParticipants || null,
      skillLevel: payload.skillLevel || '', cancellationRule: payload.cancellationRule || '请查看活动规则',
      approval: payload.approvalMode === 'MANUAL' ? '提交后由主办方逐一审批' : '自动接受；满员时可能进入候补'
    } });
  },
  closeJoinConfirmation() {
    this.joinConfirmationGeneration = (this.joinConfirmationGeneration || 0) + 1;
    this.joinConfirmationActor = '';
    if (this.data.joinConfirmation || this.data.joinSubmitting)
      this.setData({ joinConfirmation: null, joinSubmitting: false });
  },
  cancelJoin() {
    if (!this.data.joinSubmitting) this.closeJoinConfirmation();
  },
  async submitRegistration(event, actor) {
    if (this.data.loadState !== 'READY' || !this.data.canJoin || this.data.event?.id !== event.id ||
      this.data.event?.version !== event.version || actor !== currentIdentity()) {
      this.setData({ message: '活动信息已变化，请刷新后重新确认报名规则' });
      return null;
    }
    const result = await this.action(`/events/${event.id}/registrations`,
      { inviteToken: this.data.token, acceptedRules: true }, '报名状态已更新');
    if (result && this.data.loadState === 'READY' && this.data.event?.id === event.id &&
      actor === currentIdentity() && this.data.myRegistration?.status === 'CONFIRMED')
      this.setData({ successState: 'JOINED' });
    return result;
  },
  async confirmJoin() {
    const review = this.data.joinConfirmation;
    if (!review || this.data.joinSubmitting) return;
    const generation = this.joinConfirmationGeneration;
    const actor = this.joinConfirmationActor;
    if (actor !== currentIdentity()) {
      this.closeJoinConfirmation();
      this.setData({ message: '登录身份已变化，请重新打开活动并核对报名规则。' });
      return;
    }
    if (this.data.event?.id !== review.id || this.data.event?.version !== review.version || this.data.token !== review.token) {
      this.closeJoinConfirmation();
      this.setData({ message: '活动信息已变化，请重新核对报名规则。' });
      return;
    }
    this.setData({ joinSubmitting: true });
    const loaded = await this.refresh();
    if (generation !== this.joinConfirmationGeneration) return;
    if (!loaded || this.data.loadState !== 'READY') {
      this.closeJoinConfirmation();
      return;
    }
    if (!this.data.canJoin || this.data.event?.id !== review.id || this.data.event?.version !== review.version ||
      this.data.token !== review.token || actor !== currentIdentity()) {
      this.closeJoinConfirmation();
      this.setData({ message: '活动或登录身份已变化，请重新核对报名规则。' });
      return;
    }
    await this.submitRegistration(this.data.event, actor);
    if (generation === this.joinConfirmationGeneration) this.closeJoinConfirmation();
  },
  async join() {
    if (this.data.loadState !== 'READY' || !this.data.canJoin || !this.data.event) return;
    const event = this.data.event;
    const payload = event.payload || {};
    const actor = currentIdentity();
    const fee = payload.feeMode === 'FREE' ? '免费'
      : payload.feeMode === 'AA' ? `AA，上限 ${Number(payload.feeCapFen || 0) / 100} 元/人` : '费用以活动规则为准';
    const approval = payload.approvalMode === 'MANUAL' ? '主办方逐一审批' : '自动接受或候补';
    const content = `活动版本：${event.version}\n${payload.title || event.title || '本次活动'}\n` +
      `时间：${payload.startAt || '待确认'}\n地点：${payload.city || ''} ${payload.venueName || '待确认'}\n` +
      `费用：${fee}${payload.skillLevel ? `\n水平要求：${payload.skillLevel}` : ''}\n` +
      `取消规则：${payload.cancellationRule || '请查看活动规则'}\n报名方式：${approval}`;
    const decision = await new Promise(resolve => wx.showModal({ title: '确认本次报名规则', content,
      confirmText: '确认参加', success: resolve, fail: () => resolve({ confirm: false }) }));
    if (!decision.confirm) return;
    return this.submitRegistration(event, actor);
  },
  interested() { this.action(`/events/${this.data.id}/interests`, { inviteToken: this.data.token }, '已记录待定意向，不占用名额'); },
  async leave() {
    if (!this.data.myRegistration) return;
    const result = await this.action(`/registrations/${this.data.myRegistration.id}/cancel`, {}, '已退出本次活动');
    if (result) wx.switchTab({ url: '/pages/index/index' });
  },
  approve(event) { this.action(`/registrations/${event.currentTarget.dataset.id}/approve`, {}, '已审核报名'); },
  cohostUserInput(event) { this.setData({ cohostUserId: event.detail.value.trim() }); },
  selectCohostMember(event) { this.setData({ cohostUserId: event.currentTarget.dataset.user }); },
  cohostCapabilitiesChanged(event) { this.setData({ selectedCohostCapabilities: event.detail.value }); },
  async grantCohost() {
    if (!this.data.isHost || !this.data.event || !this.data.cohostUserId || !this.data.selectedCohostCapabilities.length)
      return this.setData({ message: '请先选择协办成员和至少一项能力' });
    try {
      const expiresAt = new Date(Date.parse(this.data.event.payload.endAt) + 48 * 60 * 60_000).toISOString();
      await api.post(`/events/${encodeURIComponent(this.data.id)}/cohosts`, {
        expectedVersion: this.data.event.version, userId: this.data.cohostUserId,
        capabilities: this.data.selectedCohostCapabilities, expiresAt
      });
      if (await this.refresh()) this.setData({ cohostUserId: '', message: '本场协办权限已授予，可随时撤回。' });
    } catch (error) { this.setData({ message: error.message || '授权失败' }); }
  },
  async revokeCohost(event) {
    if (!this.data.isHost) return;
    const grantId = event.currentTarget.dataset.id;
    const decision = await new Promise(resolve => wx.showModal({ title: '撤回协办权限',
      content: '撤回后旧会话立即失去本场管理权限；该用户自己的报名仍保留。', success: resolve, fail: () => resolve({ confirm: false }) }));
    if (!decision.confirm) return;
    try {
      await api.post(`/cohost-grants/${encodeURIComponent(grantId)}:revoke`, {});
      if (await this.refresh()) this.setData({ message: '协办权限已撤回。' });
    } catch (error) { this.setData({ message: error.message || '撤回失败' }); }
  },
  removalReasonInput(event) { this.setData({ removalReason: event.detail.value }); },
  removeParticipant(event) {
    const id = event.currentTarget.dataset.id; const userId = event.currentTarget.dataset.user;
    const reason = this.data.removalReason.trim();
    if (reason.length < 5) return this.setData({ message: '请先填写至少 5 字的活动内移除原因' });
    wx.showModal({ title: '移除参与者', content: `将移除 ${userId}，本人会看到原因并可申诉。原因：${reason}`, success: result => {
      if (result.confirm) this.action(`/registrations/${id}/remove`, { reason }, '已移除参与者，原因仅本人及运营可见');
    } });
  },
  reconfirm() {
    wx.showModal({ title: '确认新规则', content: `确认接受活动版本 ${this.data.reconfirmation?.toVersion} 的全部变更吗？`, success: result => {
      if (result.confirm) this.action(`/registrations/${this.data.myRegistration.id}/reconfirm`, {}, '已确认新版本规则');
    } });
  },
  confirmEvent() { this.action(`/events/${this.data.id}/confirm`, {}, '主办方已确认成局'); },
  rotateInvite() { this.action(`/events/${this.data.id}/invite:rotate`, {}, '旧邀请已撤销，分享卡已更新'); },
  cancelEvent() {
    wx.showModal({ title: '取消活动', content: '取消将通知已报名者，且不能继续招募。', success: result => {
      if (result.confirm) this.action(`/events/${this.data.id}/cancel`, {}, '活动已取消');
    } });
  },
  async reserve() {
    const result = await this.action(`/events/${this.data.id}/reservations`, { count: 1 }, '已预留一个席位，球友仍需自行认领');
    if (result) this.setData({ reservationTokens: result });
  },
  reservationInput(event) { this.setData({ reservationToken: event.detail.value.trim() }); },
  claim() { this.action(`/reservations/${encodeURIComponent(this.data.reservationToken)}/claim`, {}, '已认领预留名额'); },
  async showCheckInToken() {
    if (this.checkInPageHidden || !this.data.event || (!this.data.isHost && !this.data.canManageCheckins) ||
      !['CONFIRMED', 'IN_PROGRESS'].includes(this.data.event.status)) return;
    const requestId = this.checkInRequestId = (this.checkInRequestId || 0) + 1;
    const eventId = this.data.id;
    const eventVersion = this.data.event.version;
    const actor = currentIdentity();
    const stillCurrent = () => requestId === this.checkInRequestId && !this.checkInPageHidden &&
      actor === currentIdentity() && this.data.id === eventId && this.data.event?.version === eventVersion &&
      (this.data.isHost || this.data.canManageCheckins);
    clearTimeout(this.checkInRefreshTimer);
    if (this.data.displayedCheckInToken) this.setData({ displayedCheckInToken: '', checkInExpiresIn: 0 });
    try {
      const requestedAt = Date.now();
      const result = await api.post(`/events/${eventId}/checkin-token`, { expectedVersion: eventVersion });
      if (!stillCurrent()) return;
      // The server's remaining lifetime was measured before the response crossed the network.
      const remainingMs = result.expiresInSeconds * 1000 - Math.max(0, Date.now() - requestedAt) - 1000;
      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        this.setData({ displayedCheckInToken: '', checkInExpiresIn: 0, message: '签到码已过期，正在更新。' });
        this.checkInRefreshTimer = setTimeout(() => { if (stillCurrent()) this.showCheckInToken(); }, 1000);
        return;
      }
      this.setData({ displayedCheckInToken: result.token, checkInExpiresIn: Math.ceil(remainingMs / 1000),
        message: '现场二维码将在过期时自动更新。' }, () => {
        if (stillCurrent()) drawCheckInQr(result.token, wx.createCanvasContext('checkinQr', this));
      });
      this.checkInRefreshTimer = setTimeout(() => {
        if (stillCurrent()) this.showCheckInToken();
      }, remainingMs);
    } catch (error) {
      if (stillCurrent()) this.setData({ displayedCheckInToken: '', message: error.message || '签到码获取失败' });
    }
  },
  checkInInput(event) { this.setData({ checkInToken: event.detail.value.trim() }); },
  checkIn() { this.action(`/events/${this.data.id}/checkins`, { token: this.data.checkInToken }, '签到证据已记录'); },
  scanCheckIn() {
    wx.scanCode({ onlyFromCamera: true, scanType: ['qrCode'], success: result => {
      const token = String(result.result || '').trim();
      if (!/^\d+\.[A-Za-z0-9_-]{43}$/.test(token)) return this.setData({ message: '这不是本活动的签到二维码' });
      this.action(`/events/${this.data.id}/checkins`, { token }, '扫码签到证据已记录');
    }, fail: error => {
      if (error.errMsg && !error.errMsg.includes('cancel')) this.setData({ message: '扫码失败，请重试或输入口令' });
    } });
  },
  requestManualCheckIn(event) {
    const userId = event.currentTarget.dataset.user;
    wx.showModal({ title: '补记到场', content: '只会向本人发起确认；未经本人确认不计为到场。', success: result => {
      if (result.confirm) this.action(`/events/${this.data.id}/manual-checkins`, { userId }, '已向参与者发起补记确认');
    } });
  },
  respondManualCheckIn(event) {
    this.action(`/manual-checkins/${event.currentTarget.dataset.id}/respond`, { accepted: event.currentTarget.dataset.accepted },
      event.currentTarget.dataset.accepted ? '已确认人工补记，证据类型与扫码分开' : '已拒绝人工补记');
  },
  actualCountInput(event) { this.setData({ actualCount: event.detail.value }); },
  setCompletionHeld(event) { this.setData({ completionHeld: event.detail.value === 'held' }); },
  completionAnomalyInput(event) { this.setData({ completionAnomaly: event.detail.value }); },
  completionVenueIssueInput(event) { this.setData({ completionVenueIssue: event.detail.value }); },
  complete() {
    const held = this.data.completionHeld;
    if (typeof held !== 'boolean') return this.setData({ message: '请先选择活动是否实际举办' });
    if (held && !/^\d+$/.test(String(this.data.actualCount).trim()))
      return this.setData({ message: '请填写实际到场人数' });
    const anomaly = String(this.data.completionAnomaly || '').trim();
    const venueIssue = String(this.data.completionVenueIssue || '').trim();
    if (anomaly.length > 497 || venueIssue.length > 495)
      return this.setData({ message: '异常或场地问题过长，请缩短至每项 500 字以内（含类型前缀）' });
    const issues = [...(anomaly ? [`异常：${anomaly}`] : []), ...(venueIssue ? [`场地问题：${venueIssue}`] : [])];
    this.action(`/events/${this.data.id}/complete`, { held, actualCount: held ? Number(this.data.actualCount) : 0, issues },
      held ? '活动已结项；可信完成仍需独立反馈' : '已记录活动未举办，不计为完成活动');
  },
  async repeat() {
    const result = await this.action(`/events/${this.data.id}/repeat`, {}, '已生成下一场草稿');
    if (result) wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(result.id) });
  },
  editDraft() {
    wx.removeStorageSync('editEventId');
    wx.setStorageSync('editDraftId', this.data.id);
    wx.setStorageSync('editTargetOwner', editorIdentity());
    wx.switchTab({ url: '/pages/create/create' });
  },
  editPublished() {
    wx.removeStorageSync('editDraftId');
    wx.setStorageSync('editEventId', this.data.id);
    wx.setStorageSync('editTargetOwner', editorIdentity());
    wx.switchTab({ url: '/pages/create/create' });
  },
  yuanInput(event) { this.setData({ totalYuan: event.detail.value }); },
  expense() {
    if (!['READY', 'EMPTY'].includes(this.data.expenseLoadState))
      return this.setData({ message: '费用记录尚未加载，请先重新加载后再记录' });
    const text = String(this.data.totalYuan).trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return this.setData({ message: '请填写明确的非负费用金额，最多保留两位小数' });
    const [yuan, cents = ''] = text.split('.');
    const totalFen = Number(yuan) * 100 + Number(cents.padEnd(2, '0'));
    if (!Number.isSafeInteger(totalFen)) return this.setData({ message: '费用金额超出可记录范围' });
    const currentLedger = this.data.expenses.find(ledger => ledger.current);
    this.action(`/events/${this.data.id}/expenses`, { totalFen,
      expectedLedgerRevision: currentLedger?.revision ?? 0 },
    currentLedger ? '已建立新版费用记录；旧确认仅供历史查看' : '费用记录已保存，平台未收款');
  },
  markHandled(event) { this.action(`/expenses/${event.currentTarget.dataset.ledger}/shares/${event.currentTarget.dataset.user}`, { field: 'PARTICIPANT_HANDLED', value: true }, '已记录本人处理状态'); },
  markReceived(event) { this.action(`/expenses/${event.currentTarget.dataset.ledger}/shares/${event.currentTarget.dataset.user}`, { field: 'HOST_RECEIVED', value: true }, '已记录主办方收到状态'); },
  questionInput(event) { this.setData({ questionText: event.detail.value }); },
  aliasInput(event) { this.setData({ aliasInput: event.detail.value }); },
  async saveAlias() {
    try {
      if (!this.data.aliasNoticeVersion) throw new Error('昵称展示说明暂不可用，请刷新后重试');
      await api.post(`/events/${encodeURIComponent(this.data.id)}/aliases`, {
        displayName: this.data.aliasInput, granted: true, noticeVersion: this.data.aliasNoticeVersion });
      await this.refresh(); this.setData({ message: '仅在本活动内展示的昵称已保存。' });
    } catch (error) {
      if (error.code === 'CONSENT_NOTICE_CHANGED') {
        await this.refresh(); this.setData({ message: '昵称展示说明已更新，请阅读后重新确认。' });
      } else this.setData({ message: error.message });
    }
  },
  async revokeAlias() {
    try {
      await api.post(`/events/${encodeURIComponent(this.data.id)}/aliases`, { displayName: null, granted: false });
      await this.refresh(); this.setData({ message: '已撤回本活动的昵称展示。' });
    } catch (error) { this.setData({ message: error.message }); }
  },
  async blockMember(event) {
    try {
      await api.post(`/events/${encodeURIComponent(this.data.id)}/blocks`, { memberId: event.currentTarget.dataset.member });
      await this.refresh(); this.setData({ message: '已屏蔽此成员；当前活动记录和安全举报入口仍可使用。可在“我的”中撤销。' });
    } catch (error) { this.setData({ message: error.message }); }
  },
  factQuestionInput(event) { this.setData({ factQuestionText: event.detail.value }); },
  async askFact() {
    try {
      const result = await api.post(`/events/${encodeURIComponent(this.data.id)}/facts:ask`, { question: this.data.factQuestionText });
      await this.refresh();
      this.setData({ factQuestionText: '', message: result.answer });
    } catch (error) { this.setData({ message: error.message }); }
  },
  announcementInput(event) { this.setData({ announcementText: event.detail.value }); },
  answerInput(event) { this.setData({ answerText: event.detail.value }); },
  answerQuestionInput(event) { this.setData({ answerQuestionId: event.detail.value.trim() }); },
  async submitContent(kind, body, parentId) {
    try {
      await api.post(`/events/${this.data.id}/content`, { kind, body, parentId });
      await this.refresh();
      this.setData({ message: '内容已提交，审核通过后其他成员可见。' });
    } catch (error) { this.setData({ message: error.message || '提交失败' }); }
  },
  askQuestion() { this.submitContent('QUESTION', this.data.questionText, null); },
  goToContentAppeal() { wx.switchTab({ url: '/pages/me/me' }); },
  postAnnouncement() { this.submitContent('ANNOUNCEMENT', this.data.announcementText, null); },
  answerQuestion() { this.submitContent('ANSWER', this.data.answerText, this.data.answerQuestionId); },
  setFeedbackHeld(event) { this.setData({ feedbackHeld: event.detail.value === 'yes' ? true : event.detail.value === 'no' ? false : null }); },
  setFeedbackWouldRepeat(event) { this.setData({ feedbackWouldRepeat: event.detail.value === 'yes' ? true : event.detail.value === 'no' ? false : null }); },
  feedbackReasonInput(event) { this.setData({ feedbackReason: event.detail.value }); },
  async submitFeedback() {
    if (typeof this.data.feedbackHeld !== 'boolean') return this.setData({ message: '请先选择活动是否实际举办' });
    if (typeof this.data.feedbackWouldRepeat !== 'boolean') return this.setData({ message: '请先选择是否愿意再参加类似活动' });
    try {
      await api.post(`/events/${this.data.id}/feedback`, { expectedVersion: this.data.event.version, held: this.data.feedbackHeld,
        wouldRepeat: this.data.feedbackWouldRepeat, reason: this.data.feedbackReason });
      await this.refresh();
      this.setData({ message: '独立反馈已记录；争议将进入人工处理。' });
    } catch (error) { this.setData({ message: error.message || '反馈失败' }); }
  },
  async prepareShare() {
    const event = this.data.event;
    if (this.data.preparingShare) return;
    if (!this.data.isHost || !event?.inviteToken || event.reviewStatus !== 'APPROVED' || !event.recruiting || event.riskPaused)
      return this.setData({ message: '当前活动不能生成分享卡' });
    const sourceToken = newSourceToken();
    this.setData({ preparingShare: true, shareSourceToken: '' });
    try {
      await api.post(`/events/${this.data.id}/share-intents`, { expectedVersion: event.version, sourceToken });
      if (this.data.event?.id === event.id && this.data.event.version === event.version &&
        this.data.event.inviteToken === event.inviteToken)
        this.setData({ shareSourceToken: sourceToken, message: '分享卡已准备好，请点下方按钮主动分享。' });
    } catch (error) { this.setData({ message: error.message || '分享卡准备失败' }); }
    finally { this.setData({ preparingShare: false }); }
  },
  onShareAppMessage() {
    if (!this.data.isHost || !this.data.event?.inviteToken || this.data.event.reviewStatus !== 'APPROVED' ||
      !this.data.event.recruiting || this.data.event.riskPaused)
      return { title: '活动详情', path: '/pages/index/index' };
    const source = this.data.shareSourceToken ? '&source=' + this.data.shareSourceToken : '';
    return { title: (this.data.event.aiSuggestionGenerated ? '【曾生成 AI 建议】' : '') + this.data.event.payload.title,
      path: '/pages/event/event?token=' + encodeURIComponent(this.data.event.inviteToken) + source };
  }
});
