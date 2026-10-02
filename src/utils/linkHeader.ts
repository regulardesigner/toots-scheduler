/**
 * Returns the rel="next" URL of an HTTP Link header (RFC 8288), as used by Mastodon pagination.
 * The URL is only returned when it points to the expected origin, so the access token is never
 * sent to a host announced by a rogue instance.
 * @param {string | null | undefined} linkHeader - The raw `Link` response header.
 * @param {string} allowedOrigin - The instance origin, e.g. https://mastodon.social.
 * @returns {string | null} The next page URL, or null when there is none.
 */
export function getNextPageUrl(linkHeader: string | null | undefined, allowedOrigin: string): string | null {
  if (!linkHeader) return null;

  for (const part of linkHeader.split(',')) {
    const match = /^\s*<([^>]*)>(.*)$/.exec(part);
    if (!match || !/;\s*rel="?next"?\s*(;|$)/.test(match[2])) continue;

    try {
      return new URL(match[1]).origin === allowedOrigin ? match[1] : null;
    } catch {
      return null;
    }
  }
  return null;
}
