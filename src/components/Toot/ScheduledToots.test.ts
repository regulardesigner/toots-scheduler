import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { MastodonStatus } from '../../types/mastodon';

const api = vi.hoisted(() => ({ deleteScheduledToot: vi.fn(), getScheduledToots: vi.fn() }));
vi.mock('../../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import ScheduledToots from './ScheduledToots.vue';
import { useScheduledTootsStore } from '../../stores/scheduledToots';

let pinia: Pinia;

async function mountList() {
  const wrapper = mount(ScheduledToots, { global: { plugins: [pinia] } });
  await flushPromises();
  return wrapper;
}

const toot = { id: '1', scheduled_at: '2030-01-01T10:00:00Z', params: { text: 'Hello', visibility: 'public' }, media_attachments: [] } as unknown as MastodonStatus;

describe('ScheduledToots', () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    api.getScheduledToots.mockReset().mockResolvedValue([]);
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
});
