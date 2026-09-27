import { AppError } from './errors.ts';
import type { EventInput } from './events.ts';

const numerals: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
function number(word: string): number | undefined {
  if (/^\d+$/.test(word)) return Number(word);
  if (numerals[word] !== undefined) return numerals[word];
  const tens = word.match(/^([一二两三四五六七八九])?十([一二两三四五六七八九])?$/);
  if (tens) return (tens[1] ? numerals[tens[1]]! : 1) * 10 + (tens[2] ? numerals[tens[2]]! : 0);
  return undefined;
}
const shanghaiOffset = 8 * 60 * 60_000;
const weekdays: Record<string, number> = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6 };

function localStartAt(text: string, at: number): string | undefined {
  const date = text.match(/(今天|明天|后天|(?:本|下)?周[一二三四五六日天])/);
  const time = text.match(/(上午|下午|晚上|晚|中午|早上|早晨)?\s*([一二三四五六七八九十\d]{1,2})点(半|[0-5]?\d分?)?/);
  if (!date || !time) return undefined;
  const hour = number(time[2]!);
  if (hour === undefined || hour > 23) return undefined;
  const minute = time[3] === '半' ? 30 : time[3] ? Number(time[3].replace('分', '')) : 0;
  if (!Number.isInteger(minute) || minute > 59) return undefined;
  const period = time[1];
  if (!period && hour <= 12) return undefined; // e.g. “8点” has no reliable AM/PM.
  const local = new Date(at + shanghaiOffset);
  let offsetDays = 0;
  if (date[1] === '明天') offsetDays = 1;
  else if (date[1] === '后天') offsetDays = 2;
  else if (date[1]!.includes('周')) {
    const target = weekdays[date[1]!.slice(-1)]!;
    const current = (local.getUTCDay() + 6) % 7;
    offsetDays = target - current + (date[1]!.startsWith('下周') ? 7 : 0);
    if (offsetDays < 0) {
      if (date[1]!.startsWith('周')) offsetDays += 7;
      else return undefined;
    }
  }
  const adjustedHour = period === '下午' || period === '晚上' || period === '晚' ? hour % 12 + 12
    : period === '中午' && hour < 11 ? hour + 12 : hour;
  const timestamp = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + offsetDays,
    adjustedHour, minute) - shanghaiOffset;
  if (timestamp <= at) return undefined;
  return new Date(timestamp).toISOString();
}

export function localDraftSuggestion(text: string, at = Date.now()): { aiStatus: 'UNAVAILABLE'; source: 'RULE_FALLBACK';
  fields: EventInput; fieldSources: Record<string, 'USER_EXPLICIT' | 'TEMPLATE_DEFAULT' | 'NEEDS_CONFIRMATION'>; unknown: string[] } {
  if (!text.trim() || text.length > 500) throw new AppError('BAD_REQUEST', '请输入 1 到 500 字的活动说明');
  const fields: EventInput = {};
  const fieldSources: Record<string, 'USER_EXPLICIT' | 'TEMPLATE_DEFAULT' | 'NEEDS_CONFIRMATION'> = {};
  const put = (key: keyof EventInput, value: EventInput[keyof EventInput]) => {
    Object.assign(fields, { [key]: value }); fieldSources[key] = 'USER_EXPLICIT';
  };
  const city = text.match(/深圳|广州|上海|北京/);
  if (city) { put('city', city[0]); put('timeZone', 'Asia/Shanghai'); fieldSources.timeZone = 'TEMPLATE_DEFAULT'; }
  if (text.includes('羽毛球')) fields.type = 'badminton';
  if (fields.type) fieldSources.type = 'USER_EXPLICIT';
  const level = text.match(/(新手|初级|中等|中级|进阶|高级)水平/);
  if (level) put('skillLevel', level[0]);
  const count = text.match(/([一二两三四五六七八九十\d]+)个?人/);
  if (count) { const n = number(count[1]!); if (n !== undefined) put('maxParticipants', n); }
  const fee = text.match(/每人(?:大概|约|大约)?\s*([一二两三四五六七八九十\d]+)\s*元?/);
  if (fee) { const yuan = number(fee[1]!); if (yuan !== undefined) put('feeCapFen', yuan * 100); }
  let feeNeedsConfirmation = false;
  if (!fee && /\bAA\b/i.test(text)) {
    const estimate = text.match(/\bAA\b\s*(?:大概|约|大约)\s*([一二两三四五六七八九十\d]+)\s*元?/i);
    const yuan = estimate ? number(estimate[1]!) : undefined;
    if (yuan !== undefined && Number.isSafeInteger(yuan * 100)) {
      put('feeCapFen', yuan * 100);
      fieldSources.feeCapFen = 'NEEDS_CONFIRMATION';
      feeNeedsConfirmation = true;
    }
  }
  if (/\bAA\b/i.test(text)) put('feeMode', 'AA');
  if (/免费|不收费/.test(text)) { put('feeMode', 'FREE'); put('feeCapFen', 0); feeNeedsConfirmation = false; }
  if (city) { const startAt = localStartAt(text, at); if (startAt) put('startAt', startAt); }
  const unknown = [fields.startAt ? '结束时间' : '具体日期时间', ...(!fields.city ? ['城市'] : []),
    '公共场馆及预约依据', '最少人数', '主办方是否参加并占位', '报名与成局截止',
    ...(!fields.feeMode || (fields.feeMode === 'AA' && fields.feeCapFen === undefined) ? ['费用规则和上限'] : []),
    ...(feeNeedsConfirmation ? ['每人费用上限'] : []),
    '取消规则', '公开范围'];
  for (const key of ['endAt', 'venueName', 'venueStatus', 'minParticipants', 'registrationDeadline', 'confirmationDeadline',
    'cancellationRule', 'visibility', 'approvalMode', 'hostParticipates']) fieldSources[key] = 'NEEDS_CONFIRMATION';
  return { aiStatus: 'UNAVAILABLE', source: 'RULE_FALLBACK', fields, fieldSources, unknown };
}
