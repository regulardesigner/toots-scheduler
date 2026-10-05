import { describe, it, expect } from 'vitest';
import { normalizeUrl } from './url';

describe('normalizeUrl', () => {
  it('returns only the origin of a valid URL', () => {
    expect(normalizeUrl('https://mastodon.social/@dams?tab=1#x')).toBe('https://mastodon.social');
  });

  it('drops a trailing slash', () => {
    expect(normalizeUrl('https://mastodon.social/')).toBe('https://mastodon.social');
  });

  it('throws on a string that is not a URL', () => {
    expect(() => normalizeUrl('not a url')).toThrow('Invalid URL format');
  });
});
