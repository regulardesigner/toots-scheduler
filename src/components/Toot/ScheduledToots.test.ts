import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { MastodonStatus } from '../../types/mastodon';

const api = vi.hoisted(() => ({ deleteScheduledToot: vi.fn(), getScheduledToots: vi.fn(), scheduleToot: vi.fn() }));
vi.mock('../../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import ScheduledToots from './ScheduledToots.vue';
import { useScheduledTootsStore } from '../../stores/scheduledToots';
import { settleFocus } from '../../test-utils/settle';

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
    vi.unstubAllGlobals();
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

  it('keeps its alert container in place and visible, empty until an error fills it', async () => {
    const wrapper = await mountList();
    const alert = wrapper.find('[role="alert"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toBe('');
    // Outside the collapsible panel: a live region inside a hidden subtree is not in the accessibility tree.
    expect(alert.element.closest('#scheduled-toots-panel')).toBeNull();

    useScheduledTootsStore().setError('Boom');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').element).toBe(alert.element);
    expect(alert.text()).toBe('Boom');
  });

  it('shows an error even with no toots and the list collapsed, without opening an empty panel', async () => {
    const wrapper = await mountList();
    expect(wrapper.find('.toots-toggle').attributes('aria-expanded')).toBe('false');

    useScheduledTootsStore().setError('Boom');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toBe('Boom');
    expect(wrapper.find('.toots-toggle').attributes('aria-expanded')).toBe('false');
  });

  it('keeps the user\'s choice to collapse the list when an error comes, and still shows the error', async () => {
    api.getScheduledToots.mockResolvedValue([toot]);
    const wrapper = await mountList();
    await wrapper.find('.toots-toggle').trigger('click');
    expect(wrapper.find('.toots-toggle').attributes('aria-expanded')).toBe('false');

    useScheduledTootsStore().setError('Boom');
    await flushPromises();

    expect(wrapper.find('.toots-toggle').attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('[role="alert"]').text()).toBe('Boom');
  });

  it('does not claim there are no toots when the list could not be loaded', async () => {
    const wrapper = await mountList();
    expect(wrapper.find('.empty-state').exists()).toBe(true);

    useScheduledTootsStore().setError('Boom');
    await flushPromises();

    expect(wrapper.find('.empty-state').exists()).toBe(false);
    expect(wrapper.find('[role="alert"]').text()).toBe('Boom');
  });

  it('shows an error and the list together', async () => {
    api.getScheduledToots.mockResolvedValue([toot]);
    const wrapper = await mountList();

    useScheduledTootsStore().setError('Boom');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toBe('Boom');
    expect(wrapper.findAll('.toot-card')).toHaveLength(1);
    expect(wrapper.find('.toots-toggle').attributes('aria-expanded')).toBe('true');
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
      store.isLoading = true;
      await flushPromises();

      expect(wrapper.find('.loading').exists()).toBe(false);
      expect(wrapper.findAll('.delete-button').map(button => button.text())).toEqual(['Deleting…', 'Delete']);
    });

    it('disables every card while one operation is in progress, so operations never overlap', async () => {
      const wrapper = await mountList();
      const store = useScheduledTootsStore();
      store.pendingId = 'a';
      store.pendingAction = 'update';
      await flushPromises();

      const buttons = wrapper.findAll('.toot-card button');
      expect(buttons).toHaveLength(4);
      for (const button of buttons) expect(button.attributes('disabled')).toBeDefined();
    });

    it('ignores Edit while another operation is in progress', async () => {
      const wrapper = await mountList();
      const store = useScheduledTootsStore();
      store.pendingId = 'a';
      store.pendingAction = 'update';

      // A click that slipped through before the re-render.
      wrapper.findAllComponents({ name: 'TootCard' })[1].vm.$emit('edit', 'b');
      await flushPromises();

      expect(store.editingToot).toBeNull();
    });

    it('disables every card, without showing progress on any, while a new toot is being created', async () => {
      let finish!: () => void;
      api.scheduleToot.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
      const wrapper = await mountList();
      const store = useScheduledTootsStore();

      const creating = store.createToot({ status: 'New', scheduled_at: '2031-02-01T12:00:00.000Z', visibility: 'public', language: 'en', sensitive: false, media_ids: [] }, 'key-1');
      await flushPromises();

      const buttons = wrapper.findAll('.toot-card button');
      expect(buttons).toHaveLength(4);
      for (const button of buttons) expect(button.attributes('disabled')).toBeDefined();
      expect(buttons.map(button => button.text())).toEqual(['Edit', 'Delete', 'Edit', 'Delete']);

      wrapper.findAllComponents({ name: 'TootCard' })[1].vm.$emit('edit', 'b');
      await flushPromises();
      expect(store.editingToot).toBeNull();

      finish();
      await creating;
    });

    it('deletes after confirmation and moves focus to the list toggle once the card is gone', async () => {
      api.deleteScheduledToot.mockResolvedValue(undefined);
      const wrapper = await mountList();
      api.getScheduledToots.mockResolvedValue([scheduledToot('b', 2)]);

      // The real ModalView captures this button as its opener and tries to give focus back to it.
      const deleteButton = wrapper.findAll<HTMLButtonElement>('.delete-button')[0];
      deleteButton.element.focus();
      await deleteButton.trigger('click');
      await settleFocus();
      expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull();

      await wrapper.find('.btn-delete').trigger('click');
      await flushPromises();

      expect(api.deleteScheduledToot).toHaveBeenCalledWith('a');
      expect(wrapper.findAll('.toot-card')).toHaveLength(1);
      expect(document.activeElement).toBe(wrapper.find('#scheduled-toots-title button').element);
    });

    it('moves focus to the toggle after a successful deletion even while the card is still in the page', async () => {
      api.deleteScheduledToot.mockResolvedValue(undefined);
      const wrapper = await mountList();
      // Stands for the leave transition, which keeps the deleted card (and its Delete button) for a while.
      api.getScheduledToots.mockResolvedValue([scheduledToot('a', 1), scheduledToot('b', 2)]);

      const deleteButton = wrapper.findAll<HTMLButtonElement>('.delete-button')[0];
      deleteButton.element.focus();
      await deleteButton.trigger('click');
      await settleFocus();
      await wrapper.find('.btn-delete').trigger('click');
      await flushPromises();

      expect(deleteButton.element.isConnected).toBe(true);
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
      expect(wrapper.find('.error').element.parentElement?.getAttribute('role')).toBe('alert');
    });

    it('keeps every toot and leaves focus on the Delete button when the deletion fails', async () => {
      api.deleteScheduledToot.mockRejectedValue(new Error('Record not found'));
      const wrapper = await mountList();

      const deleteButton = wrapper.findAll<HTMLButtonElement>('.delete-button')[0];
      deleteButton.element.focus();
      await deleteButton.trigger('click');
      await flushPromises();
      await wrapper.find('.btn-delete').trigger('click');
      await flushPromises();

      expect(wrapper.find('[role="alert"]').text()).toBe('Record not found');
      expect(wrapper.findAll('.toot-card')).toHaveLength(2);
      expect(document.activeElement).toBe(deleteButton.element);
    });

    it('puts focus back on the Delete button after a failed deletion even if disabling it dropped focus', async () => {
      api.deleteScheduledToot.mockImplementation(async () => {
        // Browsers may drop focus from a control that becomes disabled.
        (document.activeElement as HTMLElement | null)?.blur();
        throw new Error('Record not found');
      });
      const wrapper = await mountList();

      const deleteButton = wrapper.findAll<HTMLButtonElement>('.delete-button')[0];
      deleteButton.element.focus();
      await deleteButton.trigger('click');
      await flushPromises();
      await wrapper.find('.btn-delete').trigger('click');
      await flushPromises();

      expect(document.activeElement).toBe(deleteButton.element);
    });

    it('leaves focus where the user moved it while the deletion was running', async () => {
      let finish!: () => void;
      api.deleteScheduledToot.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
      const elsewhere = document.createElement('input');
      document.body.appendChild(elsewhere);
      const wrapper = await mountList();
      api.getScheduledToots.mockResolvedValue([scheduledToot('b', 2)]);

      const deleteButton = wrapper.findAll<HTMLButtonElement>('.delete-button')[0];
      deleteButton.element.focus();
      await deleteButton.trigger('click');
      await flushPromises();
      await wrapper.find('.btn-delete').trigger('click');
      await flushPromises();

      elsewhere.focus();
      finish();
      await flushPromises();

      expect(wrapper.findAll('.toot-card')).toHaveLength(1);
      expect(document.activeElement).toBe(elsewhere);
    });

    it('neither deletes nor moves focus when the deletion is refused because another change started', async () => {
      const wrapper = await mountList();
      const store = useScheduledTootsStore();

      await wrapper.findAll('.delete-button')[0].trigger('click');
      await flushPromises();
      // Another change started while the confirmation was open.
      store.pendingId = 'b';
      store.pendingAction = 'update';
      const focusSpy = vi.spyOn(wrapper.find<HTMLButtonElement>('#scheduled-toots-title button').element, 'focus');

      await wrapper.find('.btn-delete').trigger('click');
      await flushPromises();

      expect(api.deleteScheduledToot).not.toHaveBeenCalled();
      expect(focusSpy).not.toHaveBeenCalled();
    });

    it('loads the toot into the composer and focuses its text box on Edit', async () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-toot-text', '');
      document.body.appendChild(textarea);
      const wrapper = await mountList();

      await wrapper.findAll('.edit-button')[1].trigger('click');
      await flushPromises();

      expect(useScheduledTootsStore().editingToot?.id).toBe('b');
      expect(document.activeElement).toBe(textarea);
    });

    it('scrolls to the text box without animation when the user prefers reduced motion', async () => {
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-toot-text', '');
      textarea.scrollIntoView = vi.fn();
      document.body.appendChild(textarea);
      const wrapper = await mountList();

      await wrapper.findAll('.edit-button')[0].trigger('click');
      await flushPromises();

      expect(textarea.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
    });
  });
});
