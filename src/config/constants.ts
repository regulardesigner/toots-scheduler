/** OAuth scopes requested from the instance: the minimum this app needs. */
export const OAUTH_SCOPES = 'read:accounts read:statuses write:media write:statuses';

/**
 * OAuth callback URL, built from the page origin only (never from user input).
 * @returns {string} e.g. https://regulardesigner.github.io/toots-scheduler/oauth/callback
 */
export function getRedirectUri(): string {
  return window.location.origin + import.meta.env.BASE_URL + 'oauth/callback';
}

/** A session ends after this much inactivity, even if every tab was closed meanwhile. */
export const SESSION_DURATION_MS = 30 * 60 * 1000;

/** The "session will expire" warning shows this long before the end. */
export const SESSION_WARNING_MS = 5 * 60 * 1000;

/** User activity is written to storage at most this often. */
export const ACTIVITY_WRITE_INTERVAL_MS = 30 * 1000;

/** Who receives the "Say Thanks" direct message: the app's author. */
export const THANKS_RECIPIENT = '@dams@disabled.social';

/** Mastodon's default toot length, used until (or unless) the instance reports its own. */
export const DEFAULT_MAX_CHARACTERS = 500;
