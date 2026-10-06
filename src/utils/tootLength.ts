/** Mastodon counts every URL as this many characters, whatever its length. */
export const CHARACTERS_RESERVED_PER_URL = 23;

const URL_PATTERN = /https?:\/\/[^\s]+/g;
const REMOTE_MENTION_PATTERN = /(^|[^\w])@(\w+)@[\w.-]+\w/g;

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/**
 * Counts graphemes (what a person sees as one character); code points on browsers without Intl.Segmenter.
 * @param {string} text - The text to count.
 * @returns {number} The number of graphemes.
 */
export function countGraphemes(text: string): number {
  return segmenter ? [...segmenter.segment(text)].length : [...text].length;
}

/**
 * Counts a text the way Mastodon does (its StatusLengthValidator): each URL is 23 characters,
 * a remote mention `@user@domain` counts as `@user`, and the rest is counted in graphemes.
 * @param {string} text - The text to count.
 * @returns {number} The length Mastodon would see.
 */
export function countTootCharacters(text: string): number {
  let urls = 0;
  const withoutUrls = text.replace(URL_PATTERN, () => {
    urls += 1;
    return '';
  });
  const shortened = withoutUrls.replace(REMOTE_MENTION_PATTERN, '$1@$2');
  return countGraphemes(shortened) + urls * CHARACTERS_RESERVED_PER_URL;
}
