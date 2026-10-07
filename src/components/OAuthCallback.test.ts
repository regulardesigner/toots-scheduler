import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const api = vi.hoisted(() => ({ getAccessToken: vi.fn(), verifyCredentials: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() }));

vi.mock('../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));
vi.mock('vue-router', () => ({ useRouter: () => router }));
vi.mock('vue-toastification', () => ({ useToast: () => toast }));
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: () => false } }));

import OAuthCallback from './OAuthCallback.vue';
import { savePendingLogin } from '../utils/oauthFlow';
import { useAuthStore } from '../stores/auth';

const pending = {
  instance: 'https://masto.example',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  state: 'state-123',
  codeVerifier: 'verifier-456',
};

function visitCallback(query: string): void {
  window.history.replaceState(null, '', `/oauth/callback${query}`);
}

function storeExistingSession(): void {
  localStorage.setItem('mastodon_auth', JSON.stringify({
    instance: 'https://masto.example', clientId: 'old-id', clientSecret: 'old-secret', accessToken: 'existing-token', lastActivityAt: Date.now(),
  }));
}

describe('OAuthCallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    setActivePinia(createPinia());
    api.getAccessToken.mockResolvedValue({ access_token: 'token' });
    api.verifyCredentials.mockResolvedValue({ id: '1', acct: 'me' });
  });

  it('exchanges the code with the PKCE verifier, saves the session and strips the code from the URL', async () => {
    savePendingLogin(pending);
    visitCallback('?code=abc&state=state-123');

    mount(OAuthCallback);
    await flushPromises();

    expect(api.getAccessToken).toHaveBeenCalledWith('https://masto.example', 'abc', 'client-id', 'client-secret', 'verifier-456');
    expect(useAuthStore().accessToken).toBe('token');
    expect(router.replace).toHaveBeenCalledWith({ name: 'composer' });
    expect(window.location.search).toBe('');
    expect(sessionStorage.length).toBe(0);
  });

  it('rejects a callback whose state does not match, without exchanging the code', async () => {
    savePendingLogin(pending);
    visitCallback('?code=abc&state=forged');

    mount(OAuthCallback);
    await flushPromises();

    expect(api.getAccessToken).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('This sign-in link is invalid or has expired. Please sign in again.');
    expect(router.replace).toHaveBeenCalledWith({ name: 'home' });
    expect(useAuthStore().accessToken).toBeNull();
  });

  it('rejects a callback when no login was started in this tab', async () => {
    visitCallback('?code=abc&state=state-123');

    mount(OAuthCallback);
    await flushPromises();

    expect(api.getAccessToken).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Sign-in was started in another tab or has expired. Please sign in again.');
  });

  it('signs out again, revoking the new token, when loading the account fails', async () => {
    savePendingLogin(pending);
    visitCallback('?code=abc&state=state-123');
    api.verifyCredentials.mockRejectedValue(new Error('Network Error'));

    mount(OAuthCallback);
    await flushPromises();

    expect(useAuthStore().accessToken).toBeNull();
    expect(localStorage.getItem('mastodon_auth')).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Network Error');
    expect(router.replace).toHaveBeenCalledWith({ name: 'home' });
  });

  it('explains a cancelled authorization', async () => {
    savePendingLogin(pending);
    visitCallback('?error=access_denied&state=state-123');

    mount(OAuthCallback);
    await flushPromises();

    expect(toast.error).toHaveBeenCalledWith('You cancelled the authorization on your instance.');
    expect(router.replace).toHaveBeenCalledWith({ name: 'home' });
  });

  it('leaves an existing session alone when the callback is visited again (Back button)', async () => {
    storeExistingSession();
    const auth = useAuthStore();
    visitCallback('');

    mount(OAuthCallback);
    await flushPromises();

    expect(auth.accessToken).toBe('existing-token');
    expect(localStorage.getItem('mastodon_auth')).not.toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith({ name: 'composer' });
  });

  it('never signs out an existing session on a forged callback', async () => {
    storeExistingSession();
    const auth = useAuthStore();
    savePendingLogin(pending);
    visitCallback('?code=abc&state=forged');

    mount(OAuthCallback);
    await flushPromises();

    expect(api.getAccessToken).not.toHaveBeenCalled();
    expect(auth.accessToken).toBe('existing-token');
    expect(localStorage.getItem('mastodon_auth')).not.toBeNull();
  });
});
