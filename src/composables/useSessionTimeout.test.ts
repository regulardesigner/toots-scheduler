import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), isAxiosError: () => false }));
const toast = vi.hoisted(() => ({ warning: vi.fn(() => 'warning-id'), success: vi.fn(), info: vi.fn(), dismiss: vi.fn() }));

vi.mock('axios', () => ({ default: http }));
vi.mock('vue-toastification', () => ({ useToast: () => toast }));
const announce = vi.hoisted(() => vi.fn());
vi.mock('./useAnnouncer', () => ({ useAnnouncer: () => ({ announce }) }));

import { useSessionTimeout } from './useSessionTimeout';
import { useAuthStore } from '../stores/auth';

const MINUTE = 60 * 1000;
const WARNING = 'Your session is about to expire. Press any key or click anywhere to stay signed in.';
const EXTENDED = 'Session extended for 30 minutes';
const NOW = new Date('2030-01-01T12:00:00.000Z').getTime();
const credentials = { instance: 'https://masto.example', clientId: 'id', clientSecret: 'secret', accessToken: 'token' };

const Host = defineComponent({
  setup() {
    useSessionTimeout();
    return () => null;
  },
});

const mounted: VueWrapper[] = [];

function signInAndMount() {
  const auth = useAuthStore();
  auth.completeLogin(credentials);
  mounted.push(mount(Host));
  return auth;
}

describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
    setActivePinia(createPinia());
    http.post.mockResolvedValue({ data: {} });
    toast.warning.mockReturnValue('warning-id');
  });

  afterEach(() => {
    mounted.splice(0).forEach(wrapper => wrapper.unmount());
    vi.useRealTimers();
  });

  it('does not sign out when another tab kept the session alive just before the deadline', async () => {
    const auth = signInAndMount();
    await vi.advanceTimersByTimeAsync(29 * MINUTE);
    // Activity in another tab, storage event not delivered yet:
    localStorage.setItem('mastodon_auth', JSON.stringify({ ...credentials, lastActivityAt: Date.now() }));

    await vi.advanceTimersByTimeAsync(2 * MINUTE);

    expect(auth.accessToken).toBe('token');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('warns after 25 minutes and signs out, revoking the token, after 30', async () => {
    const auth = signInAndMount();

    await vi.advanceTimersByTimeAsync(25 * MINUTE);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(auth.accessToken).toBe('token');

    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(auth.accessToken).toBeNull();
    expect(auth.sessionEndReason).toBe('inactivity');
    expect(http.post).toHaveBeenCalledWith('https://masto.example/oauth/revoke', expect.any(URLSearchParams), { timeout: 5000 });
  });

  it('postpones the end when the user is active', async () => {
    const auth = signInAndMount();

    await vi.advanceTimersByTimeAsync(20 * MINUTE);
    window.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(20 * MINUTE);
    expect(auth.accessToken).toBe('token');

    await vi.advanceTimersByTimeAsync(11 * MINUTE);
    expect(auth.accessToken).toBeNull();
  });

  it('writes activity to storage at most once per 30 seconds', async () => {
    signInAndMount();
    const setItem = vi.spyOn(window.localStorage, 'setItem');

    for (let i = 0; i < 100; i++) {
      window.dispatchEvent(new Event('pointerdown'));
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(setItem).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30 * 1000);
    window.dispatchEvent(new Event('keydown'));
    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });

  it('counts activity recorded in another tab', async () => {
    const auth = signInAndMount();

    await vi.advanceTimersByTimeAsync(20 * MINUTE);
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'mastodon_auth',
      newValue: JSON.stringify({ ...credentials, lastActivityAt: Date.now() }),
    }));
    await vi.advanceTimersByTimeAsync(20 * MINUTE);

    expect(auth.accessToken).toBe('token');
  });

  it('extends the session from the warning', async () => {
    const auth = signInAndMount();

    await vi.advanceTimersByTimeAsync(25 * MINUTE);
    const options = (toast.warning.mock.calls[0] as unknown[])[1] as { onClick: () => void };
    options.onClick();
    await flushPromises();
    expect(toast.dismiss).toHaveBeenCalledWith('warning-id');

    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(auth.accessToken).toBe('token');
  });

  it('signs out as soon as a throttled background tab becomes visible again after the deadline', async () => {
    const auth = signInAndMount();

    vi.setSystemTime(NOW + 40 * MINUTE);
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();

    expect(auth.accessToken).toBeNull();
    expect(auth.sessionEndReason).toBe('inactivity');
  });

  it('counts scrolling inside an element, such as a long modal', async () => {
    const auth = signInAndMount();
    const panel = document.createElement('div');
    document.body.appendChild(panel);

    await vi.advanceTimersByTimeAsync(20 * MINUTE);
    panel.dispatchEvent(new Event('scroll')); // scroll does not bubble
    await vi.advanceTimersByTimeAsync(20 * MINUTE);

    expect(auth.accessToken).toBe('token');
    panel.remove();
  });

  it('stops listening once unmounted', async () => {
    const auth = useAuthStore();
    auth.completeLogin(credentials);
    const wrapper = mount(Host);
    wrapper.unmount();

    await vi.advanceTimersByTimeAsync(31 * MINUTE);

    expect(auth.accessToken).toBe('token');
  });

  it('says how to stay signed in without pointing at the toast (any key or click)', async () => {
    signInAndMount();

    await vi.advanceTimersByTimeAsync(25 * MINUTE);

    expect(toast.warning).toHaveBeenCalledWith(WARNING, expect.objectContaining({ closeOnClick: false }));
    expect(announce).toHaveBeenCalledWith(WARNING, { assertive: true });
  });

  it('a key pressed during the warning dismisses it and confirms the extension, aloud too', async () => {
    const auth = signInAndMount();
    await vi.advanceTimersByTimeAsync(25 * MINUTE);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    await flushPromises();

    expect(toast.dismiss).toHaveBeenCalledWith('warning-id');
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(EXTENDED, undefined);
    expect(announce).toHaveBeenCalledWith(EXTENDED, { assertive: false });
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(auth.accessToken).toBe('token');
  });

  it('a click on the warning confirms once, though its pointerdown already counted as activity', async () => {
    signInAndMount();
    await vi.advanceTimersByTimeAsync(25 * MINUTE);
    const options = (toast.warning.mock.calls[0] as unknown[])[1] as { onClick: () => void };

    window.dispatchEvent(new Event('pointerdown'));
    options.onClick();
    await flushPromises();

    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('confirms nothing when activity arrives without a warning shown', async () => {
    signInAndMount();
    await vi.advanceTimersByTimeAsync(20 * MINUTE);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushPromises();

    expect(toast.success).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });
});
