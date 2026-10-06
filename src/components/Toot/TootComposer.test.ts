import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { addDays, format } from 'date-fns';
import type { MastodonStatus } from '../../types/mastodon';

const api = vi.hoisted(() => ({
  scheduleToot: vi.fn(),
  scheduledTootExists: vi.fn(),
  rescheduleToot: vi.fn(),
  deleteScheduledToot: vi.fn(),
  getScheduledToots: vi.fn(),
  verifyCredentials: vi.fn(),
}));

vi.mock('../../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ account: null, accessToken: null }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('vue-toastification', () => ({ useToast: () => toast }));

import TootComposer from './TootComposer.vue';
import { useScheduledTootsStore } from '../../stores/scheduledToots';
import { useInstanceStore } from '../../stores/instance';

let pinia: Pinia;

function mountComposer(): VueWrapper {
  return mount(TootComposer, { global: { plugins: [pinia] } });
}

async function fillForm(wrapper: VueWrapper, text = 'Hello'): Promise<void> {
  await wrapper.find('textarea').setValue(text);
  await wrapper.find('#scheduled-date').setValue(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  await wrapper.find('#scheduled-time').setValue('12:00');
}

function makeScheduledToot(overrides: Partial<MastodonStatus> = {}): MastodonStatus {
  return {
    id: '42',
    content: '',
    created_at: '',
    visibility: 'public',
    url: '',
    media_attachments: [],
    scheduled_at: '2030-01-01T12:00:00.000Z',
    params: { text: 'Bonjour', visibility: 'public', language: 'fr', poll: null },
    ...overrides,
  };
}

describe('TootComposer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
    api.getScheduledToots.mockResolvedValue([]);
    api.scheduledTootExists.mockResolvedValue(true);
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
    const toot = makeScheduledToot();

    useScheduledTootsStore().setEditingToot(toot);
    await flushPromises();

    expect((wrapper.find('#language').element as HTMLSelectElement).value).toBe('fr');
  });

  it('renews the idempotency key when the content changes after a failure', async () => {
    api.scheduleToot.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue({});
    const wrapper = mountComposer();
    await flushPromises();

    await fillForm(wrapper, 'First version');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    await wrapper.find('textarea').setValue('Second version');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const [firstKey, secondKey] = api.scheduleToot.mock.calls.map(call => call[1]);
    expect(secondKey).not.toBe(firstKey);
  });

  it('never reuses a failed draft key when switching to editing another toot', async () => {
    api.scheduleToot.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue({});
    api.deleteScheduledToot.mockResolvedValue(undefined);
    const wrapper = mountComposer();
    await flushPromises();

    await fillForm(wrapper, 'New toot');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    useScheduledTootsStore().setEditingToot(makeScheduledToot());
    await flushPromises();
    await wrapper.find('textarea').setValue('Bonjour !');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const [newTootKey, editKey] = api.scheduleToot.mock.calls.map(call => call[1]);
    expect(api.scheduleToot).toHaveBeenCalledTimes(2);
    expect(editKey).not.toBe(newTootKey);
  });

  it('warns when the previous version of an edited toot could not be removed', async () => {
    api.scheduleToot.mockResolvedValue({});
    api.deleteScheduledToot.mockRejectedValue(new Error('Network Error'));
    const wrapper = mountComposer();
    await flushPromises();

    useScheduledTootsStore().setEditingToot(makeScheduledToot());
    await flushPromises();
    await wrapper.find('textarea').setValue('Bonjour !');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('previous version could not be removed'));
  });

  it('refuses a toot longer than the instance allows, without sending it', async () => {
    const wrapper = mountComposer();
    await flushPromises();
    const instance = useInstanceStore();
    instance.maxCharacters = 10;
    instance.isLoaded = true;
    await fillForm(wrapper, 'Hello world!');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(api.scheduleToot).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('Your toot is 12 characters long, but your instance allows 10.');
    expect(wrapper.find('.error').attributes('role')).toBe('alert');
  });

  it('does not block a toot while the instance limits are unknown', async () => {
    api.scheduleToot.mockResolvedValue({});
    api.deleteScheduledToot.mockResolvedValue(undefined);
    const wrapper = mountComposer();
    await flushPromises();
    useScheduledTootsStore().setEditingToot(makeScheduledToot({ params: { text: 'a'.repeat(600), visibility: 'public', language: 'fr', poll: null } }));
    await flushPromises();
    await wrapper.find('textarea').setValue('b'.repeat(600));

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(api.scheduleToot).toHaveBeenCalledTimes(1);
  });

  it('counts the content warning with the text', async () => {
    const wrapper = mountComposer();
    await flushPromises();
    const instance = useInstanceStore();
    instance.maxCharacters = 10;
    instance.isLoaded = true;
    await fillForm(wrapper, 'Hello');
    await wrapper.find('#spoiler-text').setValue('Warning!');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(api.scheduleToot).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('Your toot is 13 characters long, but your instance allows 10.');
  });

  it('counts every character of the content warning, URLs included', async () => {
    const wrapper = mountComposer();
    await flushPromises();
    const instance = useInstanceStore();
    instance.maxCharacters = 30;
    instance.isLoaded = true;
    await fillForm(wrapper, 'Hello');
    await wrapper.find('#spoiler-text').setValue('https://example.com/abcdefghij');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(api.scheduleToot).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('Your toot is 35 characters long, but your instance allows 30.');
  });

  it('refuses more images than the instance allows, without sending', async () => {
    const wrapper = mountComposer();
    await flushPromises();
    const instance = useInstanceStore();
    instance.maxMediaAttachments = 1;
    instance.isLoaded = true;
    const image = { id: 'a', type: 'image', url: 'https://x/a.png', preview_url: 'https://x/a.png' };
    useScheduledTootsStore().setEditingToot(makeScheduledToot({ media_attachments: [image, { ...image, id: 'b' }] as MastodonStatus['media_attachments'] }));
    await flushPromises();

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(api.scheduleToot).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('This toot has 2 images, but your instance allows 1.');
  });

  it('does not send a poll that was opened, filled in and closed again', async () => {
    api.scheduleToot.mockResolvedValue({});
    const wrapper = mountComposer();
    await flushPromises();
    await fillForm(wrapper);

    await wrapper.find('#poll').trigger('click');
    const options = wrapper.findAll('.poll-option input');
    await options[0].setValue('Yes');
    await options[1].setValue('No');
    await wrapper.find('#poll').trigger('click');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(api.scheduleToot).toHaveBeenCalledTimes(1);
    expect(api.scheduleToot.mock.calls[0][0].poll).toBeUndefined();
  });
});
