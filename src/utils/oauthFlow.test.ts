import { describe, it, expect, beforeEach } from 'vitest';
import { buildAuthorizeUrl, readAuthorizationCode, savePendingLogin, takePendingLogin, type PendingLogin } from './oauthFlow';

const pending: PendingLogin = {
  instance: 'https://masto.example',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  state: 'state-123',
  codeVerifier: 'verifier-456',
};

describe('oauthFlow', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('pending login', () => {
    it('is returned once, then forgotten', () => {
      savePendingLogin(pending);
      expect(takePendingLogin()).toEqual(pending);
      expect(takePendingLogin()).toBeNull();
    });

    it('is kept in sessionStorage, not localStorage', () => {
      savePendingLogin(pending);
      expect(localStorage.getItem('mastodon_oauth_pending')).toBeNull();
      expect(sessionStorage.getItem('mastodon_oauth_pending')).not.toBeNull();
    });

    it('is null when missing, malformed or incomplete', () => {
      expect(takePendingLogin()).toBeNull();
      sessionStorage.setItem('mastodon_oauth_pending', '{not json');
      expect(takePendingLogin()).toBeNull();
      sessionStorage.setItem('mastodon_oauth_pending', JSON.stringify({ ...pending, codeVerifier: '' }));
      expect(takePendingLogin()).toBeNull();
    });
  });

  describe('buildAuthorizeUrl', () => {
    it('sends state and a PKCE S256 challenge with the minimal scopes', () => {
      const url = new URL(buildAuthorizeUrl('https://masto.example', 'client-id', 'state-123', 'challenge-789'));

      expect(url.origin + url.pathname).toBe('https://masto.example/oauth/authorize');
      expect(Object.fromEntries(url.searchParams)).toEqual({
        response_type: 'code',
        client_id: 'client-id',
        redirect_uri: `${window.location.origin}${import.meta.env.BASE_URL}oauth/callback`,
        scope: 'read:accounts read:statuses write:media write:statuses',
        state: 'state-123',
        code_challenge: 'challenge-789',
        code_challenge_method: 'S256',
      });
    });
  });

  describe('readAuthorizationCode', () => {
    it('returns the code when the state matches', () => {
      expect(readAuthorizationCode('?code=abc&state=state-123', 'state-123')).toBe('abc');
    });

    it('rejects a mismatched or missing state', () => {
      expect(() => readAuthorizationCode('?code=abc&state=forged', 'state-123'))
        .toThrow('This sign-in link is invalid or has expired. Please sign in again.');
      expect(() => readAuthorizationCode('?code=abc', 'state-123'))
        .toThrow('This sign-in link is invalid or has expired. Please sign in again.');
    });

    it('explains a denied authorization', () => {
      expect(() => readAuthorizationCode('?error=access_denied&state=state-123', 'state-123'))
        .toThrow('You cancelled the authorization on your instance.');
      expect(() => readAuthorizationCode('?error=server_error', 'state-123'))
        .toThrow('Your instance refused the authorization. Please try again.');
    });

    it('rejects a callback without a code', () => {
      expect(() => readAuthorizationCode('?state=state-123', 'state-123')).toThrow('No authorization code found');
    });
  });
});
