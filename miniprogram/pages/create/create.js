const { api } = require('../../utils/api.js');
const config = require('../../config.js');
function headerActionInsets() {
  try {
    const menu = wx.getMenuButtonBoundingClientRect?.();
    const width = (wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {}).windowWidth;
    if (Number.isFinite(menu?.left) && Number.isFinite(width) && menu.left >= 0 && menu.left < width) {
      const inset = Math.ceil(width - menu.left + 8);
      return { profile: `${inset}px`, draft: `${inset + 40}px` };
    }
  } catch (_) { /* Keep native menu controls clear on older clients. */ }
  return { profile: '112px', draft: '152px' };
}
function iso(date, time) { return new Date(`${date}T${time}:00+08:00`).toISOString(); }
function localParts(value) {
  if (!value) return { date: '', time: '' };
  const local = new Date(Date.parse(value) + 8 * 60 * 60_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}
function localDateTimeLabel(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '待确认';
  const { date, time } = localParts(value);
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${date} ${weekday} ${time}`;
}
function endFromDuration(date, time, minutes) {
  return localParts(new Date(Date.parse(iso(date, time)) + minutes * 60_000).toISOString());
}
const emptyForm = { title: '', city: '', venueName: '', skillLevel: '', minParticipants: '4', maxParticipants: '6',
  feeCapYuan: '50', cancellationRule: '开始前可退出' };
const inspirationBatches = [
  [
    { icon: '🏸', title: '周末羽毛球', subtitle: '运动社交，认识新朋友，新手友好', text: '周末组织一场羽毛球活动，认识新朋友。' },
    { icon: '☕', title: '创业者咖啡', subtitle: '好想法，从一杯香浓咖啡开始', available: false },
    { icon: '🥂', title: '周五小酒局', subtitle: '下班后微醺，喝一杯畅快聊聊', available: false }
  ],
  [
    { icon: '🎯', title: '周六进阶局', subtitle: '搭档轮换，尽情挥拍', text: '周六下午组织一场羽毛球进阶双打活动，大家轮换搭档。' },
    { icon: '☀️', title: '周日晨间球', subtitle: '早起运动，活力开场', text: '周日上午组织一场新手友好的羽毛球活动。' },
    { icon: '✨', title: '同城轻松打', subtitle: '不用紧张，一起来练球', text: '在同城组织一场轻松的羽毛球活动，新手也可以参加。' }
  ]
];
function currentIdentity() {
  const token = wx.getStorageSync('sessionToken');
  return token
    ? 'session:' + wx.getStorageSync('userId') + ':' + token
    : 'dev:' + (wx.getStorageSync('devUser') || config.developmentUser || '');
}
function takeHomeIdeaIntent() {
  try {
    const intent = wx.getStorageSync('irlHomeIdeaIntent');
    wx.removeStorageSync('irlHomeIdeaIntent');
    return intent;
  } catch (_) { return null; }
}
function takeFreshIdeaIntent() {
  try {
    const intent = wx.getStorageSync('irlCreateFreshIntent');
    wx.removeStorageSync('irlCreateFreshIntent');
    return intent;
  } catch (_) { return null; }
}
function emptyEditor() {
  return { stage: 'IDEA', aiText: '', message: '', draft: null, editingEvent: null, publishPreview: null, changePreview: null,
    reviewSummary: null,
    editorLoadState: 'IDLE', editorErrorCode: '', conflict: null,
    safetyStatus: 'UNKNOWN', safetyMessage: '',
    suggestionNotes: [], suggestionUnknown: '', suggestionLoading: false, suggestionSlow: false, form: { ...emptyForm },
    startDate: '', startTime: '20:00', endDate: '', endTime: '22:00', templateDurationMinutes: null,
    repeatEndEdited: false, feeMode: 'AA', hostParticipates: null,
    venueConfirmed: false, visibility: 'INVITE', visibilityIndex: 0, approvalMode: 'AUTO', approvalIndex: 0,
    customDeadlines: false, registrationDate: '', registrationTime: '19:30', confirmationDate: '', confirmationTime: '18:30',
    quickDateSelected: '', quickTimeSelected: '' };
}
Page({
  data: {
    ...emptyEditor(), visibilityLabels: ['仅邀请', '受控公开'], approvalLabels: ['自动接受', '逐一审批'],
    statusBarHeight: (wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {}).statusBarHeight || 0,
    headerActionInsets: headerActionInsets(),
    inspirations: inspirationBatches[0], inspirationBatch: 0
  },
  syncCreateTabBar(stage) {
    const bar = this.getTabBar && this.getTabBar();
    if (!bar) return;
    if (typeof bar.setCreateStage === 'function') bar.setCreateStage(stage);
    else bar.setData({ selected: 2, hidden: stage !== 'FORM' });
  },
  setEditorData(patch, callback) {
    this.setData(patch, callback);
    if (Object.prototype.hasOwnProperty.call(patch, 'stage')) this.syncCreateTabBar(patch.stage);
  },
  async consumeFreshIdeaIntent(identity, generation, pendingEditId) {
    const intent = takeFreshIdeaIntent();
    if (intent?.owner !== identity) return false;
    const blank = emptyEditor();
    const editedFields = ['startDate', 'startTime', 'endDate', 'endTime', 'templateDurationMinutes',
      'repeatEndEdited', 'feeMode', 'hostParticipates', 'venueConfirmed', 'visibility', 'visibilityIndex',
      'approvalMode', 'approvalIndex', 'customDeadlines', 'registrationDate', 'registrationTime',
      'confirmationDate', 'confirmationTime', 'quickDateSelected', 'quickTimeSelected'];
    const currentEdit = this.data.stage !== 'IDEA' || Boolean(String(this.data.aiText || '').trim()) ||
      Boolean(this.data.draft || this.data.editingEvent || this.data.publishPreview || this.data.changePreview) ||
      Object.keys(emptyForm).some(key => String(this.data.form?.[key] ?? '') !== emptyForm[key]) ||
      editedFields.some(key => this.data[key] !== blank[key]);
    if (currentEdit || pendingEditId) {
      const confirmed = await new Promise(resolve => wx.showModal({
        title: '开启新局',
        content: '开启新局会舍弃当前未保存修改，已保存草稿仍保留。',
        confirmText: '开启新局', cancelText: '保留编辑',
        success: result => resolve(Boolean(result.confirm)), fail: () => resolve(false)
      }));
      if (generation !== this._loadGeneration || identity !== currentIdentity()) return true;
      if (!confirmed) {
        if (currentEdit) {
          wx.removeStorageSync('editDraftId');
          wx.removeStorageSync('editEventId');
          wx.removeStorageSync('editTargetOwner');
          this.setData({ message: '已保留当前编辑内容。' });
          await this.loadSafety(generation, identity);
          return true;
        }
        return false;
      }
    }
    wx.removeStorageSync('editDraftId');
    wx.removeStorageSync('editEventId');
    wx.removeStorageSync('editTargetOwner');
    wx.removeStorageSync('irlHomeIdeaIntent');
    this.setEditorData(emptyEditor());
    await this.loadSafety(generation, identity);
    return true;
  },
  discardOldEditorResponse(identity, loadGeneration) {
    if (identity === currentIdentity() && loadGeneration === this._loadGeneration) return false;
    if (identity !== currentIdentity() && loadGeneration === this._loadGeneration)
      this.setEditorData({ ...emptyEditor(), message: '账号已切换，请重新输入活动信息。' });
    return true;
  },
  async onShow() {
    this.syncCreateTabBar(this.data.stage);
    this.stopSuggestion();
    const generation = this._loadGeneration = (this._loadGeneration || 0) + 1;
    let identity = currentIdentity();
    const targetOwner = wx.getStorageSync('editTargetOwner');
    if (this._shownIdentity !== identity) {
      if ((this._shownIdentity && this._shownIdentity !== 'dev:' && targetOwner !== identity) ||
        (targetOwner && identity !== 'dev:' && targetOwner !== identity)) {
        wx.removeStorageSync('editDraftId');
        wx.removeStorageSync('editEventId');
        wx.removeStorageSync('editTargetOwner');
      }
      this._shownIdentity = identity;
      this.setEditorData(emptyEditor());
    }
    const draftId = wx.getStorageSync('editDraftId');
    const eventId = wx.getStorageSync('editEventId');
    const id = draftId || eventId;
    if (!id) {
      await getApp().globalData.ready;
      if (generation !== this._loadGeneration) return;
      const authenticatedIdentity = currentIdentity();
      if (identity !== authenticatedIdentity) {
        identity = authenticatedIdentity;
        this._shownIdentity = identity;
        this.setEditorData(emptyEditor());
      }
      if (await this.consumeFreshIdeaIntent(identity, generation, '')) return;
      const homeIdeaIntent = takeHomeIdeaIntent();
      if (homeIdeaIntent?.owner === identity && typeof homeIdeaIntent.text === 'string') {
        const text = homeIdeaIntent.text.trim().slice(0, 300);
        if (text && this.data.stage === 'IDEA' && !this.data.aiText && !this.data.draft && !this.data.editingEvent)
          this.setData({ aiText: text });
        else if (text) this.setData({ message: '当前有正在编辑的想法或草稿，首页输入未覆盖原内容；请先保存后重新输入。' });
      }
      await this.loadSafety(generation, identity);
      return;
    }
    try {
      await getApp().globalData.ready;
      if (generation !== this._loadGeneration) return;
      const authenticatedIdentity = currentIdentity();
      if (identity !== authenticatedIdentity) {
        identity = authenticatedIdentity;
        this._shownIdentity = identity;
        this.setEditorData(emptyEditor());
      }
      if (targetOwner && targetOwner !== authenticatedIdentity) {
        wx.removeStorageSync('editDraftId');
        wx.removeStorageSync('editEventId');
        wx.removeStorageSync('editTargetOwner');
        if (await this.consumeFreshIdeaIntent(identity, generation, '')) return;
        await this.loadSafety(generation, identity);
        return;
      }
      if (await this.consumeFreshIdeaIntent(identity, generation, id)) return;
      this.setData({ editorLoadState: 'LOADING', editorErrorCode: '', draft: null, editingEvent: null,
        publishPreview: null, changePreview: null });
      const draft = await api.get('/events/' + encodeURIComponent(id));
      if (generation !== this._loadGeneration || identity !== currentIdentity()) return;
      if (draftId && draft.status !== 'DRAFT') throw new Error('活动已发布，不能按草稿编辑');
      if (eventId && !['RECRUITING', 'CONFIRMED'].includes(draft.status)) throw new Error('当前活动不能编辑规则');
      const p = draft.payload;
      const start = localParts(p.startAt); const end = localParts(p.endAt);
      const registration = localParts(p.registrationDeadline); const confirmation = localParts(p.confirmationDeadline);
      const defaultRegistration = p.startAt ? new Date(Date.parse(p.startAt) - 30 * 60_000).toISOString() : null;
      const defaultConfirmation = p.startAt ? new Date(Date.parse(p.startAt) - 90 * 60_000).toISOString() : null;
      const customDeadlines = Boolean((p.registrationDeadline && p.registrationDeadline !== defaultRegistration) ||
        (p.confirmationDeadline && p.confirmationDeadline !== defaultConfirmation));
      const templateDurationMinutes = Number.isSafeInteger(p.templateDurationMinutes) && p.templateDurationMinutes > 0
        ? p.templateDurationMinutes : null;
      const savedDurationMinutes = p.startAt && p.endAt ? Math.round((Date.parse(p.endAt) - Date.parse(p.startAt)) / 60_000) : null;
      const homeIdeaIntent = takeHomeIdeaIntent();
      const homeIdeaBlocked = homeIdeaIntent?.owner === identity &&
        typeof homeIdeaIntent.text === 'string' && Boolean(homeIdeaIntent.text.trim());
      this.setEditorData({ draft: draftId ? draft : null, editingEvent: eventId ? draft : null, stage: 'FORM',
        editorLoadState: 'READY', editorErrorCode: '', conflict: null,
        startDate: start.date, startTime: start.time || '20:00', endDate: end.date, endTime: end.time || '22:00',
        templateDurationMinutes, repeatEndEdited: templateDurationMinutes !== null && savedDurationMinutes !== null &&
          savedDurationMinutes !== templateDurationMinutes,
        feeMode: p.feeMode || 'AA', hostParticipates: p.hostParticipates ?? null, venueConfirmed: p.venueStatus === 'HOST_CONFIRMED',
        visibility: p.visibility || 'INVITE', visibilityIndex: p.visibility === 'PUBLIC' ? 1 : 0,
        approvalMode: p.approvalMode || 'AUTO', approvalIndex: p.approvalMode === 'MANUAL' ? 1 : 0, customDeadlines,
        registrationDate: registration.date, registrationTime: registration.time || '19:30',
        confirmationDate: confirmation.date, confirmationTime: confirmation.time || '18:30', publishPreview: null, changePreview: null,
        form: { title: p.title || '', city: p.city || '', venueName: p.venueName || '', skillLevel: p.skillLevel || '',
          minParticipants: String(p.minParticipants ?? 4),
          maxParticipants: String(p.maxParticipants ?? 6),
          feeCapYuan: templateDurationMinutes !== null && p.feeCapFen === undefined ? '' : String((p.feeCapFen ?? 5000) / 100),
          cancellationRule: p.cancellationRule || '开始前可退出' },
        message: homeIdeaBlocked
          ? `已载入${eventId ? '当前活动规则' : '保存的草稿'}；首页输入未覆盖原内容。如需使用，请返回首页重新输入。`
          : eventId ? '已载入当前活动规则。修改后先预览受影响成员，再确认生效。' : '已载入保存的草稿。' });
      wx.removeStorageSync('editDraftId');
      wx.removeStorageSync('editEventId');
      wx.removeStorageSync('editTargetOwner');
      await this.loadSafety(generation, identity);
    } catch (error) {
      if (generation === this._loadGeneration && identity === currentIdentity())
        this.setData({ editorLoadState: 'ERROR', editorErrorCode: error.code || '', message: error.message || '活动读取失败' });
    }
  },
  backFromCreate() {
    if (this.data.stage === 'REVIEW') return this.backToForm();
    if (this.data.editingEvent && this.data.stage === 'FORM') return this.returnToMyActivities();
    if (this.data.stage === 'FORM') return this.backToIdea();
    return this.returnToMyActivities();
  },
  onHide() { this.stopSuggestion(); },
  onUnload() { this.stopSuggestion(); },
  stopSuggestion() {
    this._suggestGeneration = (this._suggestGeneration || 0) + 1;
    if (this._suggestSlowTimer) clearTimeout(this._suggestSlowTimer);
    if (this._suggestTimeoutTimer) clearTimeout(this._suggestTimeoutTimer);
    this._suggestSlowTimer = null;
    this._suggestTimeoutTimer = null;
    if (this.data.suggestionLoading) this.setData({ suggestionLoading: false, suggestionSlow: false });
  },
  cancelSuggestion() {
    this.stopSuggestion();
    this.setEditorData({ stage: 'FORM', message: '已转为手动填写，原输入与已填字段仍保留。' });
  },
  async retryEditorLoad() {
    if (this.data.editorErrorCode === 'UNAUTHENTICATED' && !config.developmentUser) {
      try { await api.login(); }
      catch (error) { return this.setData({ message: error.message || '重新登录失败' }); }
    }
    return this.onShow();
  },
  returnToMyActivities() { wx.navigateTo({ url: '/subpackages/profile/moments/moments?filter=all' }); },
  goProfile() { wx.switchTab({ url: '/pages/me/me' }); },
  markVersionConflict(error, type, id) {
    if (error.code !== 'VERSION_CONFLICT' || !id) return false;
    this.setEditorData({ stage: 'FORM', conflict: { type, id }, publishPreview: null, changePreview: null,
      message: '活动版本已变化。本地修改尚未保存；请重新载入服务端当前版本并逐项核对。' });
    return true;
  },
  async reloadConflict() {
    const conflict = this.data.conflict;
    if (!conflict) return;
    try {
      wx.setStorageSync(conflict.type === 'event' ? 'editEventId' : 'editDraftId', conflict.id);
      wx.setStorageSync('editTargetOwner', currentIdentity());
      await this.onShow();
    } catch (error) { this.setData({ message: error.message || '当前版本读取失败，请重试' }); }
  },
  async loadSafety(generation, identity) {
    try {
      const safety = await api.get('/system/safety');
      if (generation !== this._loadGeneration || identity !== currentIdentity()) return;
      if (safety.status !== 'OPEN' && safety.status !== 'CLOSED') throw new Error('安全状态不可用');
      this.setData({ safetyStatus: safety.status,
        safetyMessage: safety.status === 'CLOSED' ? '平台已暂停新增活动和报名；仍可查看、退出和举报。' : '' });
    } catch (error) {
      if (generation === this._loadGeneration && identity === currentIdentity())
        this.setData({ safetyStatus: 'UNKNOWN', safetyMessage: '安全状态读取失败，请重试。' });
    }
  },
  retrySafety() { return this.loadSafety(this._loadGeneration, currentIdentity()); },
  selectInspiration(event) {
    const choice = this.data.inspirations[Number(event.currentTarget.dataset.index)];
    if (choice?.available === false) return this.showUnavailable({ currentTarget: { dataset: { name: choice.title } } });
    if (choice) this.setData({ aiText: choice.text, message: '' });
  },
  rotateInspirations() {
    const inspirationBatch = (this.data.inspirationBatch + 1) % inspirationBatches.length;
    this.setData({ inspirationBatch, inspirations: inspirationBatches[inspirationBatch] });
  },
  showUnavailable(event) {
    const name = event.currentTarget.dataset.name || '此功能';
    this.setData({ message: `${name}暂未开放；当前可创建和发布受控羽毛球活动。` });
    wx.showToast?.({ title: `${name}暂未开放`, icon: 'none', duration: 2500 });
  },
  openCohostSetup() {
    if (this._shownIdentity && this._shownIdentity !== currentIdentity()) {
      this.stopSuggestion();
      this.setEditorData({ ...emptyEditor(), message: '账号已切换，请重新输入活动信息。' });
      return;
    }
    const eventId = this.data.editingEvent?.id;
    if (eventId) return wx.navigateTo({ url: '/pages/event/event?id=' + encodeURIComponent(eventId) + '&section=hostSection' });
    this.setData({ message: '发布活动后，在主办工作台从报名名单选择协办成员，并设置本场权限。' });
    wx.showToast?.({ title: '发布后在工作台添加', icon: 'none', duration: 2500 });
  },
  chooseQuickCity(event) {
    const city = event.currentTarget.dataset.city;
    if (!['上海', '北京', '深圳', '杭州', '成都'].includes(city)) return;
    this.setData({ form: { ...this.data.form, city } });
  },
  chooseParticipantRange(event) {
    const presets = { '4-6': [4, 6], '5-10': [5, 10], '10-12': [10, 12] };
    const range = presets[event.currentTarget.dataset.range];
    if (!range) return;
    this.setData({ form: { ...this.data.form, minParticipants: String(range[0]), maxParticipants: String(range[1]) } });
  },
  editReviewSection(event) {
    const section = event.currentTarget.dataset.section;
    if (!['activity', 'schedule', 'venue', 'participants', 'fees', 'visibility'].includes(section)) return;
    this.setEditorData({ stage: 'FORM', publishPreview: null, changePreview: null, reviewSummary: null },
      () => wx.pageScrollTo?.({ selector: `#form-${section}`, duration: 0 }));
  },
  openForm() { this.setEditorData({ stage: 'FORM' }, () => wx.pageScrollTo?.({ scrollTop: 0, duration: 0 })); },
  backToIdea() {
    this.setEditorData({ stage: 'IDEA', publishPreview: null, changePreview: null, reviewSummary: null },
      () => wx.pageScrollTo?.({ scrollTop: 0, duration: 0 }));
  },
  backToForm() {
    this.setEditorData({ stage: 'FORM', publishPreview: null, changePreview: null, reviewSummary: null },
      () => wx.pageScrollTo?.({ scrollTop: 0, duration: 0 }));
  },
  openDrafts() {
    wx.setStorageSync('irlHomeTabIntent', 'drafts');
    wx.switchTab({ url: '/pages/index/index' });
  },
  openHeaderAction() {
    if (this.data.stage !== 'REVIEW') return this.openDrafts();
    wx.showActionSheet({ itemList: ['返回编辑', '我的草稿'], success: ({ tapIndex }) => {
      if (tapIndex === 0) this.backToForm();
      else if (tapIndex === 1) this.openDrafts();
    } });
  },
  input(event) {
    if (this.data.suggestionLoading) this.cancelSuggestion();
    const field = event.currentTarget.dataset.field;
    const patch = { [`form.${field}`]: event.detail.value };
    if (field === 'venueName' && event.detail.value !== this.data.form.venueName) patch.venueConfirmed = false;
    this.setData(patch);
  },
  aiInput(event) { if (this.data.suggestionLoading) this.cancelSuggestion(); this.setData({ aiText: event.detail.value }); },
  setStartDate(event) {
    if (this.data.suggestionLoading) this.cancelSuggestion();
    const startDate = event.detail.value;
    if (this.data.templateDurationMinutes && !this.data.repeatEndEdited) {
      const end = endFromDuration(startDate, this.data.startTime, this.data.templateDurationMinutes);
      this.setData({ startDate, endDate: end.date, endTime: end.time, venueConfirmed: false, quickDateSelected: '' });
    } else this.setData({ startDate,
      endDate: !this.data.endDate || this.data.endDate === this.data.startDate || this.data.endDate < startDate
        ? startDate : this.data.endDate,
      venueConfirmed: startDate === this.data.startDate ? this.data.venueConfirmed : false, quickDateSelected: '' });
  },
  chooseQuickDate(event) {
    const choice = event.currentTarget.dataset.choice;
    const today = new Date(Date.now() + 8 * 60 * 60_000);
    const weekday = today.getUTCDay();
    let offset = (6 - weekday + 7) % 7;
    if (choice === 'sunday') offset = (7 - weekday) % 7;
    if (choice === 'nextWeekend') offset += 7;
    const target = new Date(today.getTime() + offset * 24 * 60 * 60_000).toISOString().slice(0, 10);
    this.setStartDate({ detail: { value: target } });
    this.setData({ quickDateSelected: choice });
  },
  chooseQuickTime(event) {
    const slots = { morning: ['09:00', '12:00'], afternoon: ['14:00', '17:00'], evening: ['18:00', '21:00'] };
    const choice = event.currentTarget.dataset.choice;
    const slot = slots[choice];
    if (!slot) return;
    this.setData({ startTime: slot[0], endDate: this.data.startDate || this.data.endDate,
      endTime: slot[1], venueConfirmed: false, repeatEndEdited: true, quickTimeSelected: choice });
  },
  setStartTime(event) {
    if (this.data.suggestionLoading) this.cancelSuggestion();
    const startTime = event.detail.value;
    if (this.data.startDate && this.data.templateDurationMinutes && !this.data.repeatEndEdited) {
      const end = endFromDuration(this.data.startDate, startTime, this.data.templateDurationMinutes);
      this.setData({ startTime, endDate: end.date, endTime: end.time, venueConfirmed: false, quickTimeSelected: '' });
    } else this.setData({ startTime, venueConfirmed: startTime === this.data.startTime ? this.data.venueConfirmed : false,
      quickTimeSelected: '' });
  },
  setEndDate(event) { if (this.data.suggestionLoading) this.cancelSuggestion(); this.setData({ endDate: event.detail.value,
    venueConfirmed: event.detail.value === this.data.endDate ? this.data.venueConfirmed : false, repeatEndEdited: true }); },
  setEndTime(event) { if (this.data.suggestionLoading) this.cancelSuggestion(); this.setData({ endTime: event.detail.value,
    venueConfirmed: event.detail.value === this.data.endTime ? this.data.venueConfirmed : false, repeatEndEdited: true }); },
  setFeeMode(event) { if (this.data.suggestionLoading) this.cancelSuggestion(); this.setData({ feeMode: event.detail.value ? 'FREE' : 'AA' }); },
  chooseFeeMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode === 'AA' || mode === 'FREE') this.setData({ feeMode: mode });
  },
  setHostParticipates(event) { this.setData({ hostParticipates: event.detail.value === 'yes' }); },
  setVenueConfirmed(event) { this.setData({ venueConfirmed: event.detail.value }); },
  setVisibility(event) {
    const visibilityIndex = Number(event.detail.value);
    const visibility = visibilityIndex === 1 ? 'PUBLIC' : 'INVITE';
    this.setData({ visibility, visibilityIndex, approvalMode: visibility === 'PUBLIC' ? 'MANUAL' : this.data.approvalMode,
      approvalIndex: visibility === 'PUBLIC' ? 1 : this.data.approvalIndex });
  },
  setApprovalMode(event) {
    const approvalIndex = Number(event.detail.value);
    if (this.data.visibility === 'PUBLIC' && approvalIndex === 0) return this.setData({ message: '受控公开活动需逐一审批' });
    this.setData({ approvalMode: approvalIndex === 1 ? 'MANUAL' : 'AUTO', approvalIndex });
  },
  setCustomDeadlines(event) { this.setData({ customDeadlines: event.detail.value }); },
  setRegistrationDate(event) { this.setData({ registrationDate: event.detail.value }); },
  setRegistrationTime(event) { this.setData({ registrationTime: event.detail.value }); },
  setConfirmationDate(event) { this.setData({ confirmationDate: event.detail.value }); },
  setConfirmationTime(event) { this.setData({ confirmationTime: event.detail.value }); },
  async suggest() {
    if (this.data.suggestionLoading) return;
    if (this._shownIdentity && this._shownIdentity !== currentIdentity()) {
      this.setEditorData({ ...emptyEditor(), message: '账号已切换，请重新输入活动想法。' });
      return;
    }
    const identity = currentIdentity();
    const generation = this._suggestGeneration = (this._suggestGeneration || 0) + 1;
    const text = this.data.aiText;
    this.setData({ suggestionLoading: true, suggestionSlow: false });
    this._suggestSlowTimer = setTimeout(() => {
      if (generation === this._suggestGeneration) this.setData({ suggestionSlow: true });
    }, 15_000);
    try {
      const targetEventId = this.data.draft?.id || this.data.editingEvent?.id;
      const suggestionBody = { text, ...(targetEventId ? { eventId: targetEventId } : {}) };
      const request = api.post('/events/drafts:suggest-local', suggestionBody, undefined,
        { timeoutMs: 30_000, keepKeyUntilAck: true });
      const timeout = new Promise((_, reject) => {
        this._suggestTimeoutTimer = setTimeout(() => reject(new Error('提取已超时，请继续手动填写；原输入和已填字段已保留。')), 30_000);
      });
      const result = await Promise.race([request, timeout]);
      if (generation !== this._suggestGeneration) return;
      if (identity !== currentIdentity()) {
        this.stopSuggestion();
        this.setEditorData({ ...emptyEditor(), message: '账号已切换，请重新输入活动想法。' });
        return;
      }
      const fields = result.fields;
      const updates = { suggestionLoading: false, suggestionSlow: false, stage: 'FORM',
        message: result.aiStatus === 'GENERATED' && result.aiContentLabel === 'AI_GENERATED_UNVERIFIED'
          ? 'AI 生成建议未经核验；日期、场地、人数和费用请逐项确认。'
          : '当前未连接 AI，已用规则提取部分字段；日期、场地和费用请逐项确认。' };
      const names = { title: '标题', type: '类型', city: '城市', venueName: '场地', timeZone: '时区', startAt: '开始时间', endAt: '结束时间', maxParticipants: '最多人数',
        skillLevel: '水平要求', templateDurationMinutes: '活动时长',
        feeMode: '费用模式', feeCapFen: '每人费用上限' };
      const sources = { USER_EXPLICIT: '来自原话', TEMPLATE_DEFAULT: '模板默认', NEEDS_CONFIRMATION: '待确认' };
      updates.suggestionNotes = Object.keys(fields).map(key => {
        const value = key === 'startAt' || key === 'endAt' ? localDateTimeLabel(fields[key])
          : key === 'feeCapFen' ? fields[key] / 100 + ' 元'
            : key === 'templateDurationMinutes' ? fields[key] + ' 分钟'
            : key === 'type' && fields[key] === 'badminton' ? '羽毛球' : fields[key];
        return `${names[key] || key}：${value}（${sources[result.fieldSources[key]] || '待确认'}）`;
      });
      updates.suggestionUnknown = (result.unknown || []).join('、');
      if (result.draft) updates.draft = result.draft;
      if (fields.title) updates['form.title'] = fields.title;
      if (fields.city) updates['form.city'] = fields.city;
      if (fields.venueName) updates['form.venueName'] = fields.venueName;
      if (fields.startAt) {
        const start = localParts(fields.startAt);
        updates.startDate = start.date; updates.startTime = start.time;
        updates.endDate = this.data.endDate || start.date;
      }
      if (fields.endAt) {
        const end = localParts(fields.endAt);
        updates.endDate = end.date; updates.endTime = end.time;
      }
      if (Number.isSafeInteger(fields.templateDurationMinutes) && fields.templateDurationMinutes > 0) {
        updates.templateDurationMinutes = fields.templateDurationMinutes;
        updates.repeatEndEdited = false;
        if (!fields.endAt && (updates.startDate || this.data.startDate)) {
          const end = endFromDuration(updates.startDate || this.data.startDate,
            updates.startTime || this.data.startTime, fields.templateDurationMinutes);
          updates.endDate = end.date; updates.endTime = end.time;
        }
      }
      if (fields.maxParticipants) updates['form.maxParticipants'] = String(fields.maxParticipants);
      if (fields.skillLevel) updates['form.skillLevel'] = fields.skillLevel;
      if (fields.feeCapFen !== undefined) updates['form.feeCapYuan'] = String(fields.feeCapFen / 100);
      if (fields.feeMode) updates.feeMode = fields.feeMode;
      this.setEditorData(updates);
      api.acknowledgeMutation?.('POST', '/events/drafts:suggest-local', suggestionBody);
    } catch (error) {
      if (generation === this._suggestGeneration) {
        if (identity !== currentIdentity()) {
          this.stopSuggestion();
          this.setEditorData({ ...emptyEditor(), message: '账号已切换，请重新输入活动想法。' });
        } else this.setData({ suggestionLoading: false, suggestionSlow: false, message: error.message });
      }
    } finally {
      if (generation === this._suggestGeneration) {
        clearTimeout(this._suggestSlowTimer);
        clearTimeout(this._suggestTimeoutTimer);
        this._suggestSlowTimer = null;
        this._suggestTimeoutTimer = null;
      }
    }
  },
  buildInput() {
    const f = this.data.form;
    const startAt = this.data.startDate ? iso(this.data.startDate, this.data.startTime) : undefined;
    const endAt = this.data.endDate ? iso(this.data.endDate, this.data.endTime) : undefined;
    const feeCapFen = f.feeCapYuan === '' ? undefined : Math.round(Number(f.feeCapYuan) * 100);
    return { title: f.title, type: 'badminton', startAt, endAt, timeZone: 'Asia/Shanghai', city: f.city,
      ...(!this.data.editingEvent && this.data.templateDurationMinutes ? { templateDurationMinutes: this.data.templateDurationMinutes } : {}),
      skillLevel: (f.skillLevel || '').trim(),
      venueName: f.venueName, venueStatus: this.data.venueConfirmed ? 'HOST_CONFIRMED' : 'UNCONFIRMED', minParticipants: Number(f.minParticipants),
      maxParticipants: Number(f.maxParticipants),
      registrationDeadline: this.data.customDeadlines
        ? (this.data.registrationDate ? iso(this.data.registrationDate, this.data.registrationTime) : undefined)
        : (startAt ? new Date(Date.parse(startAt) - 30 * 60_000).toISOString() : undefined),
      confirmationDeadline: this.data.customDeadlines
        ? (this.data.confirmationDate ? iso(this.data.confirmationDate, this.data.confirmationTime) : undefined)
        : (startAt ? new Date(Date.parse(startAt) - 90 * 60_000).toISOString() : undefined), feeMode: this.data.feeMode,
      feeCapFen: this.data.feeMode === 'AA' ? feeCapFen : 0, cancellationRule: f.cancellationRule,
      visibility: this.data.visibility, approvalMode: this.data.approvalMode,
      hostParticipates: typeof this.data.hostParticipates === 'boolean' ? this.data.hostParticipates : undefined };
  },
  async saveDraft() {
    const identity = currentIdentity();
    const loadGeneration = this._loadGeneration;
    if (this._shownIdentity && this._shownIdentity !== identity) {
      this.setEditorData({ ...emptyEditor(), message: '账号已切换，请重新输入活动信息。' });
      return null;
    }
    if (['LOADING', 'ERROR'].includes(this.data.editorLoadState))
      return this.setData({ message: '请先重新载入活动，再保存草稿。' });
    if (this.data.editingEvent) return this.setData({ message: '正在编辑已发布活动，请使用变更预览。' });
    if (!this.data.draft && this.data.safetyStatus === 'CLOSED') return this.setData({ message: '平台已暂停新增活动，请稍后重试。' });
    if (this.data.suggestionLoading) this.stopSuggestion();
    try {
      const payload = this.buildInput();
      const draft = this.data.draft
        ? await api.post(`/events/${this.data.draft.id}/draft`, { expectedVersion: this.data.draft.version, patch: payload })
        : await api.post('/events', payload);
      if (this.discardOldEditorResponse(identity, loadGeneration)) return null;
      this.setEditorData({ draft, stage: 'FORM', publishPreview: null, message: '草稿已保存。确认场地、时间、人数和费用后再发布。' });
      return draft;
    } catch (error) {
      if (this.discardOldEditorResponse(identity, loadGeneration)) return null;
      if (!this.markVersionConflict(error, 'draft', this.data.draft?.id))
        this.setData({ message: error.message || '草稿未保存' });
      return null;
    }
  },
  async publish() {
    const identity = currentIdentity();
    const loadGeneration = this._loadGeneration;
    if (this._shownIdentity && this._shownIdentity !== identity) {
      this.setEditorData({ ...emptyEditor(), message: '账号已切换，请重新输入活动信息。' });
      return;
    }
    if (typeof this.data.hostParticipates !== 'boolean')
      return this.setData({ message: '请先明确选择主办方本人是否参加；参加会占用一个名额。' });
    if (this.data.suggestionLoading) this.stopSuggestion();
    if (this.data.editingEvent) {
      try {
        const candidate = this.buildInput();
        const event = this.data.editingEvent;
        const patch = {};
        const venueFactsChanged = ['venueName', 'startAt', 'endAt'].some(key => candidate[key] !== event.payload[key]);
        if (venueFactsChanged && !this.data.venueConfirmed)
          return this.setData({ message: '场馆或时间已改变，请重新确认场地可用及预约情况。' });
        Object.keys(candidate).forEach(key => {
          if (key === 'skillLevel' && !candidate[key] && !event.payload[key]) return;
          if (candidate[key] !== event.payload[key]) patch[key] = candidate[key];
        });
        if (venueFactsChanged) patch.venueStatus = candidate.venueStatus;
        const preview = await api.post(`/events/${event.id}/changes:preview`, { expectedVersion: event.version, patch });
        if (this.discardOldEditorResponse(identity, loadGeneration)) return;
        const labels = { title: '标题', startAt: '开始时间', endAt: '结束时间', city: '城市', venueName: '公共场馆',
          skillLevel: '水平要求',
          venueStatus: '场地状态', minParticipants: '最少人数', maxParticipants: '最多人数',
          registrationDeadline: '报名截止', confirmationDeadline: '成局确认截止', feeMode: '费用模式',
          feeCapFen: '费用上限（分）', cancellationRule: '取消规则', visibility: '可见范围',
          approvalMode: '审批方式', hostParticipates: '主办方参加' };
        this.setEditorData({ stage: 'REVIEW', changePreview: { ...preview, changes: preview.changes.map(item => ({ ...item, label: labels[item.field] || item.field })),
          patch, candidate, expectedVersion: event.version },
          message: '请逐项核对变更差异与受影响人数，然后最终确认。' });
      } catch (error) {
        if (this.discardOldEditorResponse(identity, loadGeneration)) return;
        if (!this.markVersionConflict(error, 'event', this.data.editingEvent?.id))
          this.setData({ changePreview: null, message: error.message || '变更预览失败' });
      }
      return;
    }
    const draft = await this.saveDraft();
    if (!draft) return;
    if (this.discardOldEditorResponse(identity, loadGeneration)) return;
    this.setEditorData({ stage: 'REVIEW', publishPreview: draft,
      reviewSummary: {
        start: localDateTimeLabel(draft.payload.startAt), end: localDateTimeLabel(draft.payload.endAt),
        registration: localDateTimeLabel(draft.payload.registrationDeadline),
        confirmation: localDateTimeLabel(draft.payload.confirmationDeadline),
        fee: draft.payload.feeMode === 'FREE' ? '免费'
          : Number.isSafeInteger(draft.payload.feeCapFen) ? `AA 制 · 每人上限 ¥${(draft.payload.feeCapFen / 100).toFixed(2)}` : 'AA 制 · 上限待确认'
      }, message: '' });
  },
  async confirmPublish() {
    const identity = currentIdentity();
    const loadGeneration = this._loadGeneration;
    if (this._shownIdentity && this._shownIdentity !== identity) {
      this.setEditorData({ ...emptyEditor(), message: '账号已切换，请重新输入活动信息。' });
      return;
    }
    if (['LOADING', 'ERROR'].includes(this.data.editorLoadState))
      return this.setData({ message: '请先重新载入活动，再确认发布。' });
    if (this.data.editingEvent) {
      const preview = this.data.changePreview;
      if (!preview) return this.setData({ message: '请先生成变更预览' });
      const current = this.buildInput();
      if (Object.keys(current).some(key => current[key] !== preview.candidate[key]))
        return this.setEditorData({ stage: 'FORM', changePreview: null, message: '字段已变化，请重新生成变更预览' });
      try {
        const event = await api.post(`/events/${this.data.editingEvent.id}/changes`,
          { expectedVersion: preview.expectedVersion, patch: preview.patch });
        if (this.discardOldEditorResponse(identity, loadGeneration)) return;
        this.setEditorData({ ...emptyEditor(), message: '新版本已生效。' });
        wx.navigateTo({ url: `/pages/event/event?id=${encodeURIComponent(event.id)}` });
      } catch (error) {
        if (this.discardOldEditorResponse(identity, loadGeneration)) return;
        if (!this.markVersionConflict(error, 'event', this.data.editingEvent?.id))
          this.setData({ message: error.message || '变更未提交' });
      }
      return;
    }
    const preview = this.data.publishPreview;
    if (this.data.safetyStatus === 'CLOSED') return this.setData({ message: '平台已暂停发布新活动，请稍后重试。' });
    if (!preview) return this.setData({ message: '请先生成发布预览' });
    const current = this.buildInput();
    if (Object.keys(current).some(key => current[key] !== preview.payload[key])) {
      return this.setEditorData({ stage: 'FORM', publishPreview: null, message: '字段已变化，请重新生成发布预览' });
    }
    try {
      const event = await api.post(`/events/${preview.id}/publish`, { expectedVersion: preview.version });
      if (this.discardOldEditorResponse(identity, loadGeneration)) return;
      this.setEditorData({ ...emptyEditor() });
      wx.navigateTo({ url: `/pages/event/event?id=${encodeURIComponent(event.id)}&success=published` });
    } catch (error) {
      if (this.discardOldEditorResponse(identity, loadGeneration)) return;
      if (!this.markVersionConflict(error, 'draft', preview.id))
        this.setData({ message: error.message || '发布未完成' });
    }
  }
});
