import { describe, it, expect } from 'vitest';
import { CHARACTERS_RESERVED_PER_URL, countTootCharacters } from './tootLength';

describe('countTootCharacters', () => {
  it('counts plain text one per character', () => {
    expect(countTootCharacters('Hello')).toBe(5);
    expect(countTootCharacters('')).toBe(0);
  });

  it('counts every URL as 23 characters', () => {
    expect(CHARACTERS_RESERVED_PER_URL).toBe(23);
    expect(countTootCharacters(`https://example.com/${'a'.repeat(100)}`)).toBe(23);
    expect(countTootCharacters('see https://a.example/x and http://b.example/y')).toBe(4 + 23 + 5 + 23);
  });

  it('counts a remote mention as the user name only', () => {
    expect(countTootCharacters('hi @alice@social.example!')).toBe('hi @alice!'.length);
    expect(countTootCharacters('@alice@social.example')).toBe('@alice'.length);
  });

  it('counts graphemes, not UTF-16 code units', () => {
    expect(countTootCharacters('\u{1F468}\u200D\u{1F469}\u200D\u{1F467}')).toBe(1);
    expect(countTootCharacters('\u{1F1EB}\u{1F1F7}')).toBe(1);
  });
});
