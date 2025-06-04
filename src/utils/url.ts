export function normalizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.origin;
  } catch {
    throw new Error('Invalid URL format');
  }
}