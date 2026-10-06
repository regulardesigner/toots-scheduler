import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const api = vi.hoisted(() => ({ getInstanceConfiguration: vi.fn() }));
vi.mock('../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn().mockResolvedValue({}), isAxiosError: () => false } }));

import { useInstanceStore } from './instance';
import { useAuthStore } from './auth';
import { SUPPORTED_IMAGE_TYPES } from '../utils/media';

const credentials = { instance: 'https://masto.example', clientId: 'id', clientSecret: 'secret', accessToken: 'token-a' };

const DEFAULTS = {
  maxCharacters: 500,
  maxMediaAttachments: 4,
  imageSizeLimit: 8 * 1024 * 1024,
  supportedMimeTypes: SUPPORTED_IMAGE_TYPES,
};

function limitsOf(store: ReturnType<typeof useInstanceStore>) {
  return {
    maxCharacters: store.maxCharacters,
    maxMediaAttachments: store.maxMediaAttachments,
    imageSizeLimit: store.imageSizeLimit,
    supportedMimeTypes: store.supportedMimeTypes,
  };
}

describe('instance store', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    setActivePinia(createPinia());
    api.getInstanceConfiguration.mockResolvedValue({
      maxCharacters: 1000,
      maxMediaAttachments: 2,
      imageSizeLimit: 16 * 1024 * 1024,
      supportedMimeTypes: ['image/png', 'video/mp4'],
    });
  });

  it('uses the defaults and asks nothing before sign-in', () => {
    const store = useInstanceStore();

    expect(limitsOf(store)).toEqual(DEFAULTS);
    expect(api.getInstanceConfiguration).not.toHaveBeenCalled();
  });

  it('reads the limits after sign-in, keeping only image types', async () => {
    const store = useInstanceStore();
    useAuthStore().completeLogin(credentials);
    await flushPromises();

    expect(limitsOf(store)).toEqual({
      maxCharacters: 1000,
      maxMediaAttachments: 2,
      imageSizeLimit: 16 * 1024 * 1024,
      supportedMimeTypes: ['image/png'],
    });
  });

  it('reads the limits of a restored session', async () => {
    localStorage.setItem('mastodon_auth', JSON.stringify({ ...credentials, lastActivityAt: Date.now() }));
    const store = useInstanceStore();
    await flushPromises();

    expect(api.getInstanceConfiguration).toHaveBeenCalledTimes(1);
    expect(store.maxCharacters).toBe(1000);
  });

  it('falls back to the defaults when the instance cannot be read', async () => {
    api.getInstanceConfiguration.mockRejectedValue(new Error('Request failed with status code 404'));
    const store = useInstanceStore();
    useAuthStore().completeLogin(credentials);
    await flushPromises();

    expect(api.getInstanceConfiguration).toHaveBeenCalledTimes(1);
    expect(limitsOf(store)).toEqual(DEFAULTS);
  });

  it('keeps the default of each limit the instance did not give', async () => {
    api.getInstanceConfiguration.mockResolvedValue({ maxCharacters: 1000 });
    const store = useInstanceStore();
    useAuthStore().completeLogin(credentials);
    await flushPromises();

    expect(limitsOf(store)).toEqual({ ...DEFAULTS, maxCharacters: 1000 });
  });

  it('goes back to the defaults on sign-out and reads them again for the next account', async () => {
    const store = useInstanceStore();
    const auth = useAuthStore();
    auth.completeLogin(credentials);
    await flushPromises();

    await auth.logout();
    await flushPromises();
    expect(limitsOf(store)).toEqual(DEFAULTS);

    api.getInstanceConfiguration.mockResolvedValue({ maxCharacters: 5000 });
    auth.completeLogin({ ...credentials, accessToken: 'token-b' });
    await flushPromises();
    expect(store.maxCharacters).toBe(5000);
  });

  it('ignores limits that arrive after the session changed', async () => {
    let answer!: (value: unknown) => void;
    api.getInstanceConfiguration.mockReturnValue(new Promise(resolve => { answer = resolve; }));
    const store = useInstanceStore();
    const auth = useAuthStore();
    auth.completeLogin(credentials);
    await flushPromises();

    await auth.logout();
    answer({ maxCharacters: 1000 });
    await flushPromises();

    expect(store.maxCharacters).toBe(500);
  });

  it('ignores a late answer of the previous account after a direct switch', async () => {
    let answerA!: (value: unknown) => void;
    let answerB!: (value: unknown) => void;
    api.getInstanceConfiguration
      .mockReturnValueOnce(new Promise(resolve => { answerA = resolve; }))
      .mockReturnValueOnce(new Promise(resolve => { answerB = resolve; }));
    const store = useInstanceStore();
    const auth = useAuthStore();
    auth.completeLogin(credentials);
    await flushPromises();
    auth.completeLogin({ ...credentials, accessToken: 'token-b' });
    await flushPromises();

    answerB({ maxCharacters: 5000 });
    await flushPromises();
    answerA({ maxCharacters: 1000 });
    await flushPromises();

    expect(store.maxCharacters).toBe(5000);
  });
});
