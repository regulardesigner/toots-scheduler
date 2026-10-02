import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { addDays, format } from 'date-fns';
import type { MastodonStatus } from '../../types/mastodon';

const api = vi.hoisted(() => ({
  scheduleToot: vi.fn(),
  rescheduleToot: vi.fn(),
  deleteScheduledToot: vi.fn(),
  getScheduledToots: vi.fn(),
  verifyCredentials: vi.fn(),
}));

vi.mock('../../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ account: null, accessToken: null }) }));
vi.mock('vue-toastification', () => ({
  useToast: () => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import TootComposer from './TootComposer.vue';
import { useScheduledTootsStore } from '../../stores/scheduledToots';

let pinia: Pinia;

function mountComposer(): VueWrapper {
  return mount(TootComposer, { global: { plugins: [pinia] } });
}

async function fillForm(wrapper: VueWrapper, text = 'Hello'): Promise<void> {
  await wrapper.find('textarea').setValue(text);
  await wrapper.find('#scheduled-date').setValue(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  await wrapper.find('#scheduled-time').setValue('12:00');
}

describe('TootComposer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
    api.getScheduledToots.mockResolvedValue([]);
  });

  it('sends a single request when the form is submitted twice quickly', async () => {
    let finish!: () => void;
    api.scheduleToot.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    const wrapper = mountComposer();
    await flushPromises();
    await fillForm(wrapper);

    await wrapper.find('form').trigger('submit');
    await wrapper.find('form').trigger('submit');

    expect(api.scheduleToot).toHaveBeenCalledTimes(1);
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined();

    finish();
    await flushPromises();
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined();
  });

  it('reuses the idempotency key after a failure and renews it after a success', async () => {
    api.scheduleToot.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue({});
    const wrapper = mountComposer();
    await flushPromises();

    await fillForm(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.error').text()).toBe('Network Error');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    await fillForm(wrapper, 'Second toot');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const keys = api.scheduleToot.mock.calls.map(call => call[1]);
    expect(keys).toHaveLength(3);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('restores the language of the toot being edited', async () => {
    const wrapper = mountComposer();
    await flushPromises();
    const toot: MastodonStatus = {
      id: '42',
      content: '',
      created_at: '',
      visibility: 'public',
      url: '',
      media_attachments: [],
      scheduled_at: '2030-01-01T12:00:00.000Z',
      params: { text: 'Bonjour', visibility: 'public', language: 'fr', poll: null },
    };

    useScheduledTootsStore().setEditingToot(toot);
    await flushPromises();

    expect((wrapper.find('#language').element as HTMLSelectElement).value).toBe('fr');
  });
});
