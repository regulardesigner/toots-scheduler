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

/** Image types Mastodon accepts that this app lets users attach (used when the instance gives no list). */
export const SUPPORTED_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];

/** Mastodon's default image size limit, in bytes, used when the instance gives none. */
export const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Mastodon's default number of media attachments per toot, used when the instance gives none. */
export const DEFAULT_MAX_MEDIA_ATTACHMENTS = 4;

/** Languages a toot can be written in: ISO 639-1 code and the language's own name (composer and cards). */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
] as const;
