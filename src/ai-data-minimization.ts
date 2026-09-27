export function redactAiContactText(text: string): string {
  return text
    .replace(/(?<![0-9])(?:(?:\+?86)[\s().-]*)?1[3-9](?:[\s().-]*[0-9]){9}(?![0-9])/g, '[手机号]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[邮箱]')
    .replace(/(?<![A-Za-z0-9_])wxid_[A-Za-z0-9_-]{4,}(?![A-Za-z0-9_-])/gi, '[微信号]')
    .replace(/(?:微信(?:号|号码|账号|ID)?|vx)\s*[:：]?\s*[A-Za-z][A-Za-z0-9_-]{5,19}(?![A-Za-z0-9_-])/gi, '[微信号]')
    .replace(/(?<![A-Za-z0-9])(?:QQ(?:号|号码)?|企鹅号)\s*[:：]?\s*[1-9][0-9]{4,11}(?![0-9])/gi, '[QQ号]');
}

// The model context is narrower than the provider output scrubber. Omit ambiguous
// free text when contact language is present instead of trusting a regex to find every handle.
const contactCue = /微信|wxid_|企鹅号|(?<![A-Za-z0-9])(?:vx|qq)(?![A-Za-z0-9])|联系|手机号?|电话|邮箱|邮件|私信|加群|扫码|二维码|whatsapp|telegram/i;

export function minimizeAiContextText(text: string): string | null {
  if (contactCue.test(text) || redactAiContactText(text) !== text) return null;
  return text;
}
