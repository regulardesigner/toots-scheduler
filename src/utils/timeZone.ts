/** Shown when the browser does not say which time zone it uses. */
export const UNKNOWN_TIME_ZONE = 'your local time zone';

/**
 * The browser's time zone, in which the composer reads the date and time and the list shows them.
 * @returns {string} An IANA name such as "Europe/Stockholm", or UNKNOWN_TIME_ZONE.
 */
export function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || UNKNOWN_TIME_ZONE;
  } catch {
    return UNKNOWN_TIME_ZONE;
  }
}
