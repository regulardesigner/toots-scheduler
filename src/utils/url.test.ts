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

  it('accepts a bare domain and surrounding spaces', () => {
    expect(normalizeUrl('  mastodon.social ')).toBe('https://mastodon.social');
    expect(normalizeUrl('mastodon.social/@dams')).toBe('https://mastodon.social');
  });

  it('keeps a non-default port', () => {
    expect(normalizeUrl('https://masto.example:8443/')).toBe('https://masto.example:8443');
  });

  it('refuses plain http', () => {
    expect(() => normalizeUrl('http://mastodon.social', false)).toThrow('The instance address must use https://');
  });

  it('allows http only for a local instance when local http is allowed', () => {
    expect(normalizeUrl('http://localhost:3000', true)).toBe('http://localhost:3000');
    expect(() => normalizeUrl('http://localhost:3000', false)).toThrow('The instance address must use https://');
    expect(() => normalizeUrl('http://mastodon.social', true)).toThrow('The instance address must use https://');
  });

  it('refuses other schemes and credentials in the address', () => {
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow('Invalid URL format');
    expect(() => normalizeUrl('ftp://mastodon.social')).toThrow('The instance address must use https://');
    expect(() => normalizeUrl('https://user:pass@mastodon.social')).toThrow('Invalid URL format');
  });

  it('refuses a host without a dot, such as a mistyped scheme', () => {
    expect(() => normalizeUrl('https:/mastodon.social')).toThrow('Invalid URL format');
    expect(() => normalizeUrl('https:\\\\mastodon.social')).toThrow('Invalid URL format');
    expect(() => normalizeUrl('mastodon')).toThrow('Invalid URL format');
  });

  it('normalizes case, the default port and international domains', () => {
    expect(normalizeUrl('HTTPS://MASTO.EXAMPLE')).toBe('https://masto.example');
    expect(normalizeUrl('mastodon.social:443')).toBe('https://mastodon.social');
    expect(normalizeUrl('münchen.social')).toBe('https://xn--mnchen-3ya.social');
  });

  it('allows every local host form when local http is allowed', () => {
    expect(normalizeUrl('http://127.0.0.1:3000', true)).toBe('http://127.0.0.1:3000');
    expect(normalizeUrl('http://[::1]:3000', true)).toBe('http://[::1]:3000');
    expect(normalizeUrl('localhost:3000', true)).toBe('https://localhost:3000');
  });
});
