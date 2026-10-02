import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  isAxiosError: (error: unknown) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
}));

vi.mock('axios', () => ({ default: http }));

import { useAuthStore } from './auth';

const MINUTE = 60 * 1000;
const NOW = new Date('2030-01-01T12:00:00.000Z').getTime();

const credentials = {
  instance: 'https://masto.example',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  accessToken: 'token',
};

function storeSession(lastActivityAt: number | null): void {
  localStorage.setItem('mastodon_auth', JSON.stringify({ ...credentials, lastActivityAt }));
}

function storedSession(): Record<string, unknown> | null {
  const raw = localStorage.getItem('mastodon_auth');
  return raw ? JSON.parse(raw) : null;
}

function expectRevoked(expected = { client_id: 'client-id', client_secret: 'client-secret', token: 'token' }): void {
  expect(http.post).toHaveBeenCalledTimes(1);
  const [url, body] = http.post.mock.calls[0];
  expect(url).toBe('https://masto.example/oauth/revoke');
  expect(Object.fromEntries(body as URLSearchParams)).toEqual(expected);
}

describe('auth store', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
    setActivePinia(createPinia());
    http.post.mockResolvedValue({ data: {} });
    http.get.mockResolvedValue({ data: { id: '1', acct: 'me' } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('on startup', () => {
    it('does nothing without a saved session', async () => {
      const auth = useAuthStore();
      await flushPromises();

      expect(auth.accessToken).toBeNull();
      expect(http.get).not.toHaveBeenCalled();
    });

    it('restores a recent session and loads the account', async () => {
      storeSession(NOW - 10 * MINUTE);
      const auth = useAuthStore();
      await flushPromises();

      expect(auth.accessToken).toBe('token');
      expect(http.get).toHaveBeenCalledWith('https://masto.example/api/v1/accounts/verify_credentials', {
        headers: { Authorization: 'Bearer token' },
        timeout: 10000,
      });
      expect(auth.account).toEqual({ id: '1', acct: 'me' });
    });

    it('revokes and removes a session idle for 30 minutes, without using its token otherwise', async () => {
      storeSession(NOW - 31 * MINUTE);
      const auth = useAuthStore();
      await flushPromises();

      expectRevoked();
      expect(http.get).not.toHaveBeenCalled();
      expect(auth.accessToken).toBeNull();
      expect(auth.sessionEndReason).toBe('inactivity');
      expect(localStorage.length).toBe(0);
    });

    it('treats a pre-0.14.0 session as expired and revokes its token', async () => {
      localStorage.setItem('mastodon_token', 'legacy-token');
      localStorage.setItem('mastodon_instance', 'https://masto.example');
      localStorage.setItem('mastodon_client_id', 'legacy-id');
      localStorage.setItem('mastodon_client_secret', 'legacy-secret');
      const auth = useAuthStore();
      await flushPromises();

      expectRevoked({ client_id: 'legacy-id', client_secret: 'legacy-secret', token: 'legacy-token' });
      expect(auth.accessToken).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('signs out without revoking when the instance rejects the token', async () => {
      storeSession(NOW - MINUTE);
      http.get.mockRejectedValue({ isAxiosError: true, response: { status: 401 } });
      const auth = useAuthStore();
      await flushPromises();

      expect(auth.accessToken).toBeNull();
      expect(auth.sessionEndReason).toBe('unauthorized');
      expect(http.post).not.toHaveBeenCalled();
      expect(storedSession()).toBeNull();
    });

    it('keeps the session when the instance cannot be reached', async () => {
      storeSession(NOW - MINUTE);
      http.get.mockRejectedValue({ isAxiosError: true, message: 'Network Error' });
      const auth = useAuthStore();
      await flushPromises();

      expect(auth.accessToken).toBe('token');
      expect(storedSession()).not.toBeNull();
    });
  });

  describe('session lifecycle', () => {
    it('removes the legacy keys when a login completes', () => {
      localStorage.setItem('mastodon_token', 'old');
      const auth = useAuthStore();
      auth.completeLogin(credentials);
      expect(localStorage.getItem('mastodon_token')).toBeNull();
    });

    it('never brings back a session that another tab already removed', () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);
      localStorage.removeItem('mastodon_auth'); // logout in another tab, storage event not delivered yet

      auth.recordActivity(NOW + 31 * 1000);

      expect(localStorage.getItem('mastodon_auth')).toBeNull();
      expect(auth.accessToken).toBeNull();
    });

    it('ignores a startup verification that finishes after a logout', async () => {
      storeSession(NOW - MINUTE);
      let answer!: (value: unknown) => void;
      http.get.mockReturnValue(new Promise(resolve => { answer = resolve; }));
      const auth = useAuthStore();

      await auth.logout();
      answer({ data: { id: '1', acct: 'me' } });
      await flushPromises();

      expect(auth.account).toBeNull();
      expect(auth.accessToken).toBeNull();
    });

    it('persists a completed login with the current time as last activity', () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      expect(auth.accessToken).toBe('token');
      expect(storedSession()).toEqual({ ...credentials, lastActivityAt: NOW });
    });

    it('writes activity at most every 30 seconds', () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      auth.recordActivity(NOW + 10 * 1000);
      expect(storedSession()?.lastActivityAt).toBe(NOW);

      auth.recordActivity(NOW + 31 * 1000);
      expect(storedSession()?.lastActivityAt).toBe(NOW + 31 * 1000);
      expect(auth.lastActivityAt).toBe(NOW + 31 * 1000);
    });

    it('revokes the token and clears everything on logout', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      await auth.logout();

      expectRevoked();
      expect(auth.accessToken).toBeNull();
      expect(auth.sessionEndReason).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('still logs out locally when revocation fails', async () => {
      http.post.mockRejectedValue(new Error('Network Error'));
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      await auth.logout();

      expect(auth.accessToken).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('does not revoke on a 401: the token is already invalid', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      await auth.handleUnauthorized();

      expect(http.post).not.toHaveBeenCalled();
      expect(auth.accessToken).toBeNull();
      expect(auth.sessionEndReason).toBe('unauthorized');
    });
  });

  describe('other tabs', () => {
    it('reloads the account when activity reveals another tab switched account', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);
      auth.setAccount({ id: '1', username: 'old', acct: 'old', display_name: 'Old', avatar: '' });
      localStorage.setItem('mastodon_auth', JSON.stringify({ ...credentials, accessToken: 'other-token', lastActivityAt: NOW }));
      http.get.mockResolvedValue({ data: { id: '2', acct: 'new' } });

      auth.recordActivity(NOW + 31 * 1000);
      expect(auth.account).toBeNull();
      await flushPromises();

      expect(auth.accessToken).toBe('other-token');
      expect(auth.account).toEqual({ id: '2', acct: 'new' });
    });

    it('clears the session when another tab clears all storage', () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null }));

      expect(auth.accessToken).toBeNull();
    });

    it('reloads the account when another tab signs in to a different account', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);
      auth.setAccount({ id: '1', username: 'old', acct: 'old', display_name: 'Old', avatar: '' });
      http.get.mockResolvedValue({ data: { id: '2', acct: 'new' } });

      window.dispatchEvent(new StorageEvent('storage', {
        key: 'mastodon_auth',
        newValue: JSON.stringify({ ...credentials, accessToken: 'other-token', lastActivityAt: NOW }),
      }));
      expect(auth.account).toBeNull();
      await flushPromises();

      expect(auth.accessToken).toBe('other-token');
      expect(http.get).toHaveBeenCalledWith('https://masto.example/api/v1/accounts/verify_credentials', {
        headers: { Authorization: 'Bearer other-token' },
        timeout: 10000,
      });
      expect(auth.account).toEqual({ id: '2', acct: 'new' });
    });

    it('logs this tab out when another tab removed the session', () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      window.dispatchEvent(new StorageEvent('storage', { key: 'mastodon_auth', newValue: null }));

      expect(auth.accessToken).toBeNull();
      expect(http.post).not.toHaveBeenCalled();
    });

    it('adopts the activity recorded by another tab', () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      window.dispatchEvent(new StorageEvent('storage', {
        key: 'mastodon_auth',
        newValue: JSON.stringify({ ...credentials, lastActivityAt: NOW + 5 * MINUTE }),
      }));

      expect(auth.lastActivityAt).toBe(NOW + 5 * MINUTE);
      expect(auth.accessToken).toBe('token');
    });

    it('ignores changes to other keys', () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      window.dispatchEvent(new StorageEvent('storage', { key: 'masto-publish-later-features', newValue: null }));

      expect(auth.accessToken).toBe('token');
    });
  });
});
