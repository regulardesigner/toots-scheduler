import { describe, it, expect, beforeEach } from 'vitest';
import {
  AUTH_STORAGE_KEY,
  clearStoredAuth,
  isSessionExpired,
  parseStoredAuth,
  readStoredAuth,
  writeStoredAuth,
  type StoredAuth,
} from './authSession';

const MINUTE = 60 * 1000;

const session: StoredAuth = {
  instance: 'https://masto.example',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  accessToken: 'token',
  lastActivityAt: 1_000_000,
};

function setLegacyKeys(): void {
  localStorage.setItem('mastodon_token', 'legacy-token');
  localStorage.setItem('mastodon_instance', 'https://masto.example');
  localStorage.setItem('mastodon_client_id', 'legacy-id');
  localStorage.setItem('mastodon_client_secret', 'legacy-secret');
}

describe('authSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isSessionExpired', () => {
    it('is false within the allowed inactivity and true from its end', () => {
      expect(isSessionExpired(0, 29 * MINUTE, 30 * MINUTE)).toBe(false);
      expect(isSessionExpired(0, 30 * MINUTE, 30 * MINUTE)).toBe(true);
      expect(isSessionExpired(0, 31 * MINUTE, 30 * MINUTE)).toBe(true);
    });

    it('treats a missing or invalid activity time as expired', () => {
      expect(isSessionExpired(null, 0, 30 * MINUTE)).toBe(true);
      expect(isSessionExpired(NaN, 0, 30 * MINUTE)).toBe(true);
    });

    it('tolerates a small clock skew but not an activity time far in the future', () => {
      expect(isSessionExpired(2 * MINUTE, 0, 30 * MINUTE)).toBe(false);
      expect(isSessionExpired(10 * MINUTE, 0, 30 * MINUTE)).toBe(true);
    });
  });

  describe('storage', () => {
    it('round-trips the session under a single key', () => {
      writeStoredAuth(session);
      expect(Object.keys(localStorage)).toEqual([AUTH_STORAGE_KEY]);
      expect(readStoredAuth()).toEqual(session);
    });

    it('reads a pre-0.14.0 session from the legacy keys, without an activity time', () => {
      setLegacyKeys();
      expect(readStoredAuth()).toEqual({
        instance: 'https://masto.example',
        clientId: 'legacy-id',
        clientSecret: 'legacy-secret',
        accessToken: 'legacy-token',
        lastActivityAt: null,
      });
    });

    it('removes the legacy keys when writing or clearing', () => {
      setLegacyKeys();
      writeStoredAuth(session);
      expect(localStorage.getItem('mastodon_token')).toBeNull();

      setLegacyKeys();
      clearStoredAuth();
      expect(localStorage.length).toBe(0);
    });

    it('returns null for nothing, malformed JSON or an incomplete session', () => {
      expect(readStoredAuth()).toBeNull();
      expect(parseStoredAuth('{oops')).toBeNull();
      expect(parseStoredAuth(JSON.stringify({ ...session, accessToken: '' }))).toBeNull();
      expect(parseStoredAuth(JSON.stringify({ ...session, lastActivityAt: 'yesterday' }))).toBeNull();
    });

    it('drops and erases a session whose instance is not a secure origin', () => {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ...session, instance: 'http://masto.example' }));
      expect(readStoredAuth()).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('drops and erases a legacy session on plain http', () => {
      setLegacyKeys();
      localStorage.setItem('mastodon_instance', 'http://masto.example');
      expect(readStoredAuth()).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('drops an instance value that is not a bare origin', () => {
      expect(parseStoredAuth(JSON.stringify({ ...session, instance: 'https://masto.example/path' }))).toBeNull();
    });
  });
});
