const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Validates an instance address typed by the user and returns its origin.
 * Accepts "mastodon.social" as well as "https://mastodon.social/@me". Only HTTPS is
 * accepted, since the access token would otherwise travel in clear text, except for a
 * local instance during development.
 * @param {string} input - What the user typed.
 * @param {boolean} [allowLocalHttp] - Allow http://localhost; defaults to dev mode only.
 * @returns {string} The instance origin, e.g. https://mastodon.social.
 * @throws {Error} If the address is invalid or does not use HTTPS.
 */
export function normalizeUrl(input: string, allowLocalHttp: boolean = import.meta.env.DEV): string {
  const value = input.trim();
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error('Invalid URL format');
  }

  const isLocalHttp = parsed.protocol === 'http:' && allowLocalHttp && LOCAL_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('The instance address must use https://');
  }

  return parsed.origin;
}
