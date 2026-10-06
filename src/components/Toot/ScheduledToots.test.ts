import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { MastodonStatus } from '../../types/mastodon';

const api = vi.hoisted(() => ({ deleteScheduledToot: vi.fn(), getScheduledToots: vi.fn() }));
vi.mock('../../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import ScheduledToots from './ScheduledToots.vue';
import { useScheduledTootsStore } from '../../stores/scheduledToots';

let pinia: Pinia;
let wrapper: VueWrapper | null = null;

async function mountList(): Promise<VueWrapper> {
  wrapper = mount(ScheduledToots, { global: { plugins: [pinia] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

const toot = { id: '1', scheduled_at: '2030-01-01T10:00:00Z', params: { text: 'Hello', visibility: 'public' }, media_attachments: [] } as unknown as MastodonStatus;

function scheduledToot(id: string, day: number): MastodonStatus {
  return {
    id,
    content: '',
    created_at: '',
    visibility: 'public',
    url: '',
    media_attachments: [],
    scheduled_at: `2031-01-0${day}T12:00:00.000Z`,
    params: { text: `Toot ${id}`, visibility: 'public', language: 'en', poll: null },
  };
}

describe('ScheduledToots', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
    api.getScheduledToots.mockResolvedValue([]);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('has a toggle button inside the heading, named with the count', async () => {
    const wrapper = await mountList();
    const button = wrapper.find('h2#scheduled-toots-title button');

    expect(button.text()).toBe('Scheduled Toots (0)');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(button.attributes('aria-controls')).toBe('scheduled-toots-panel');
  });

  it('toggles the panel from the button', async () => {
    const wrapper = await mountList();
    const button = wrapper.find('.toots-toggle');

    expect(wrapper.find<HTMLElement>('#scheduled-toots-panel').element.style.display).toBe('none');
    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find<HTMLElement>('#scheduled-toots-panel').element.style.display).not.toBe('none');
    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find<HTMLElement>('#scheduled-toots-panel').element.style.display).toBe('none');
  });

  it('opens by itself when there are scheduled toots', async () => {
    api.getScheduledToots.mockResolvedValue([toot]);
    const wrapper = await mountList();

    expect(wrapper.find('.toots-toggle').attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('.toots-toggle').text()).toBe('Scheduled Toots (1)');
  });

  it('opens again on an error, even after being collapsed by hand', async () => {
    api.getScheduledToots.mockResolvedValue([toot]);
    const wrapper = await mountList();
    await wrapper.find('.toots-toggle').trigger('click');
    expect(wrapper.find('.toots-toggle').attributes('aria-expanded')).toBe('false');

    useScheduledTootsStore().setError('Boom');
    await flushPromises();

    expect(wrapper.find('.toots-toggle').attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('[role="alert"]').text()).toBe('Boom');
  });

  describe('with two toots', () => {
    beforeEach(() => {
      api.getScheduledToots.mockResolvedValue([scheduledToot('a', 1), scheduledToot('b', 2)]);
    });

    it('shows progress only on the card being deleted, and keeps the list while it refreshes', async () => {
      const wrapper = await mountList();
      const store = useScheduledTootsStore();
      store.pendingId = 'a';
      store.pendingAction = 'delete';
      store.setLoading(true);
      await flushPromises();

      expect(wrapper.find('.loading').exists()).toBe(false);
      expect(wrapper.findAll('.delete-button').map(button => button.text())).toEqual(['Deleting…', 'Delete']);
    });

    it('deletes after confirmation and moves focus to the list toggle once the card is gone', async () => {
      api.deleteScheduledToot.mockResolvedValue(undefined);
      const wrapper = await mountList();
      api.getScheduledToots.mockResolvedValue([scheduledToot('b', 2)]);

      // The real ModalView captures this button as its opener and tries to give focus back to it.
      const deleteButton = wrapper.findAll<HTMLButtonElement>('.delete-button')[0];
      deleteButton.element.focus();
      await deleteButton.trigger('click');
      await flushPromises();
      expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull();

      await wrapper.find('.btn-delete').trigger('click');
      await flushPromises();

      expect(api.deleteScheduledToot).toHaveBeenCalledWith('a');
      expect(wrapper.findAll('.toot-card')).toHaveLength(1);
      expect(document.activeElement).toBe(wrapper.find('#scheduled-toots-title button').element);
    });

    it('keeps focus on the toggle even if the list is collapsed after the deletion', async () => {
      api.deleteScheduledToot.mockResolvedValue(undefined);
      const wrapper = await mountList();
      // The last toot goes: with no user choice, the list collapses by itself.
      api.getScheduledToots.mockResolvedValue([]);

      await wrapper.findAll('.delete-button')[0].trigger('click');
      await flushPromises();
      await wrapper.find('.btn-delete').trigger('click');
      await flushPromises();

      const toggle = wrapper.find('#scheduled-toots-title button');
      expect(toggle.attributes('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(toggle.element);
    });

    it('shows a failed deletion as an alert', async () => {
      api.deleteScheduledToot.mockRejectedValue(new Error('Record not found'));
      const wrapper = await mountList();

      await wrapper.findAll('.delete-button')[0].trigger('click');
      await wrapper.find('.btn-delete').trigger('click');
      await flushPromises();

      expect(wrapper.find('.error').text()).toBe('Record not found');
      expect(wrapper.find('.error').attributes('role')).toBe('alert');
    });

    it('loads the toot into the composer and focuses its text box on Edit', async () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('aria-label', 'Toot text');
      document.body.appendChild(textarea);
      const wrapper = await mountList();
      vi.useFakeTimers();

      await wrapper.findAll('.edit-button')[1].trigger('click');
      expect(useScheduledTootsStore().editingToot?.id).toBe('b');
      vi.advanceTimersByTime(100);

      expect(document.activeElement).toBe(textarea);
    });
  });
});
