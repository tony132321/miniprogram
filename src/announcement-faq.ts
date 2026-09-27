export function parseAnnouncementFaq(body: string): { question: string; answer: string } | null {
  const match = /^问[:：][ \t]*([^\r\n]+)\r?\n答[:：][ \t]*([^\r\n]+)$/.exec(body.trim());
  if (!match?.[1]?.trim() || !match[2]?.trim()) return null;
  return { question: match[1].trim(), answer: match[2].trim() };
}
