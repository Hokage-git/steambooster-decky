const PAGES: Record<string, string> = {
  catalog: 'https://steambalance.cc/c/e6c5',
  valuation: 'https://steambalance.cc/c/3f4d',
};
export function pageUrl(page: string): string {
  const url = PAGES[page];
  if (!url) throw new Error('Unknown page');
  return url;
}
export function safeNavigation(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && (!parsed.port || parsed.port === '443');
  } catch { return false; }
}
