import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const api = vi.hoisted(() => ({ registerApplication: vi.fn() }));
vi.mock('../../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import LoginForm from './LoginForm.vue';
import { takePendingLogin } from '../../utils/oauthFlow';
import { createCodeChallenge } from '../../utils/pkce';

describe('LoginForm', () => {
  let assign: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    api.registerApplication.mockResolvedValue({ client_id: 'client-id', client_secret: 'client-secret' });
    assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
  });

  afterEach(() => {
    assign.mockRestore();
  });

  it('accepts a bare domain and redirects to the instance with state and a PKCE challenge', async () => {
    const wrapper = mount(LoginForm);

    await wrapper.find('#instance').setValue('mastodon.social');
    await wrapper.find('form').trigger('submit');
    // WebCrypto hashing resolves outside the microtask queue: wait for the redirect itself.
    await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(1));

    expect(api.registerApplication).toHaveBeenCalledWith('https://mastodon.social');
    const pending = takePendingLogin();
    expect(pending).toMatchObject({ instance: 'https://mastodon.social', clientId: 'client-id', clientSecret: 'client-secret' });

    const url = new URL(assign.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('https://mastodon.social/oauth/authorize');
    expect(url.searchParams.get('state')).toBe(pending?.state);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(await createCodeChallenge(pending!.codeVerifier));
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('refuses a plain http instance without contacting it', async () => {
    const wrapper = mount(LoginForm);

    await wrapper.find('#instance').setValue('http://mastodon.social');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('.error').text()).toBe('The instance address must use https://');
    expect(api.registerApplication).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('puts focus back on the instance field after a failed attempt', async () => {
    api.registerApplication.mockRejectedValue(new Error('boom'));
    const wrapper = mount(LoginForm, { attachTo: document.body });

    await wrapper.find('#instance').setValue('mastodon.social');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(document.activeElement).toBe(wrapper.find('#instance').element);
    wrapper.unmount();
  });
});
