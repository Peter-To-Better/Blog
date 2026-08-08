export function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getReadingTime(content: string): number {
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = content
    .replace(/[\u4e00-\u9fa5]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const minutes = Math.ceil(chineseChars / 400 + englishWords / 200);
  return Math.max(1, minutes);
}

export function getSeriesKey(slug: string): string | null {
  const match = slug.match(/^(.*)-(?:ep-\d+|番外-.+)$/);
  return match ? match[1] : null;
}

export function getExcerpt(content: string, maxLength = 120): string {
  const moreIndex = content.indexOf('<!-- more -->');
  let text = moreIndex > -1 ? content.slice(0, moreIndex) : content;
  text = text
    .replace(/^---[\s\S]*?---/, '')
    .replace(/#{1,6}\s+.*$/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}
