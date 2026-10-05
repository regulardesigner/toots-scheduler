import { describe, it, expect } from 'vitest';
import { getNextPageUrl } from './linkHeader';

const ORIGIN = 'https://masto.example';

describe('getNextPageUrl', () => {
  it('returns the next URL from a Mastodon Link header', () => {
    const header = '<https://masto.example/api/v1/scheduled_statuses?limit=40&max_id=7>; rel="next", '
      + '<https://masto.example/api/v1/scheduled_statuses?limit=40&min_id=9>; rel="prev"';
    expect(getNextPageUrl(header, ORIGIN)).toBe('https://masto.example/api/v1/scheduled_statuses?limit=40&max_id=7');
  });

  it('returns null when there is no next link', () => {
    expect(getNextPageUrl('<https://masto.example/api/v1/scheduled_statuses?min_id=9>; rel="prev"', ORIGIN)).toBeNull();
  });

  it('returns null for a missing header', () => {
    expect(getNextPageUrl(undefined, ORIGIN)).toBeNull();
    expect(getNextPageUrl('', ORIGIN)).toBeNull();
  });

  it('refuses a next link on another origin', () => {
    expect(getNextPageUrl('<https://evil.example/steal>; rel="next"', ORIGIN)).toBeNull();
    expect(getNextPageUrl('<https://masto.example.evil.example/x>; rel="next"', ORIGIN)).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(getNextPageUrl('<not a url>; rel="next"', ORIGIN)).toBeNull();
  });

  it('returns the normalized URL that was checked', () => {
    expect(getNextPageUrl('<https://MASTO.example/api/v1/scheduled_statuses?max_id=7>; rel="next"', ORIGIN))
      .toBe('https://masto.example/api/v1/scheduled_statuses?max_id=7');
    expect(getNextPageUrl('< https://masto.example/x >; rel="next"', ORIGIN)).toBe('https://masto.example/x');
  });

  it('accepts an unquoted rel=next', () => {
    expect(getNextPageUrl('<https://masto.example/x>; rel=next', ORIGIN)).toBe('https://masto.example/x');
  });

  it('refuses a scheme downgrade, userinfo tricks and relative links', () => {
    expect(getNextPageUrl('<http://masto.example/x>; rel="next"', ORIGIN)).toBeNull();
    expect(getNextPageUrl('<https://masto.example@evil.example/x>; rel="next"', ORIGIN)).toBeNull();
    expect(getNextPageUrl('</api/v1/scheduled_statuses?max_id=7>; rel="next"', ORIGIN)).toBeNull();
  });

  it('stops at the first next link when it is off-origin', () => {
    const header = '<https://evil.example/x>; rel="next", <https://masto.example/y>; rel="next"';
    expect(getNextPageUrl(header, ORIGIN)).toBeNull();
  });
});
