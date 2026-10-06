import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import ContentArea from './ContentArea.vue';
import { useInstanceStore } from '../stores/instance';

let pinia: Pinia;

function mountArea(modelValue = 'Hello', sections = { showMedia: false, showPoll: false }) {
  return mount(ContentArea, {
    props: { modelValue, hasPoll: false, hasMedia: false, ...sections },
    global: { plugins: [pinia] },
  });
}

describe('ContentArea', () => {
  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The live region speaks once typing has paused this long. */
  const PAUSE_MS = 500;

  it("uses Mastodon's default limit until the instance answers", () => {
    const wrapper = mountArea();

    expect(wrapper.find('.character-count [aria-hidden="true"]').text()).toBe('495');
  });

  it("follows the instance's character limit", async () => {
    const wrapper = mountArea();
    useInstanceStore().maxCharacters = 1000;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.character-count [aria-hidden="true"]').text()).toBe('995');
  });

  it('shows the red near-limit style only once the instance limits are known', async () => {
    const wrapper = mountArea('a'.repeat(600));
    expect(wrapper.find('.character-count').classes()).not.toContain('near-limit');

    useInstanceStore().hasCharacterLimit = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.character-count').classes()).toContain('near-limit');
  });

  it('neither shows red nor announces when the instance gave only media limits', async () => {
    useInstanceStore().hasMediaLimit = true;
    const wrapper = mountArea('');
    vi.useFakeTimers();
    await wrapper.setProps({ modelValue: 'a'.repeat(600) });
    vi.advanceTimersByTime(PAUSE_MS);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.character-count').classes()).not.toContain('near-limit');
    expect(wrapper.find('[aria-live="polite"]').text()).toBe('');
  });

  it('counts a long URL as 23 characters and does not truncate the text', () => {
    const wrapper = mountArea(`https://example.com/${'a'.repeat(100)}`);

    expect(wrapper.find('textarea').attributes('maxlength')).toBeUndefined();
    expect(wrapper.find('.character-count [aria-hidden="true"]').text()).toBe('477');
  });

  /** Types the text, then pauses long enough for the live region to speak. */
  async function typeAndPause(wrapper: ReturnType<typeof mountArea>, text: string): Promise<void> {
    await wrapper.setProps({ modelValue: text });
    vi.advanceTimersByTime(PAUSE_MS);
    await wrapper.vm.$nextTick();
  }

  it('is an atomic polite live region', () => {
    const liveRegion = mountArea().find('[aria-live="polite"]');

    expect(liveRegion.attributes('aria-atomic')).toBe('true');
  });

  it('announces the remaining characters only when a step near the limit is reached', async () => {
    vi.useFakeTimers();
    const instance = useInstanceStore();
    instance.maxCharacters = 100;
    instance.hasCharacterLimit = true;
    const wrapper = mountArea('');
    const liveRegion = () => wrapper.find('[aria-live="polite"]').text();
    expect(liveRegion()).toBe('');

    await typeAndPause(wrapper, 'x'.repeat(40));
    expect(liveRegion()).toBe('');

    await typeAndPause(wrapper, 'x'.repeat(55));
    expect(liveRegion()).toBe('45 characters left');

    await typeAndPause(wrapper, 'x'.repeat(56));
    expect(liveRegion()).toBe('45 characters left');

    await typeAndPause(wrapper, 'x'.repeat(100));
    expect(liveRegion()).toBe('Character limit reached');

    await typeAndPause(wrapper, 'x'.repeat(10));
    expect(liveRegion()).toBe('');
  });

  it('waits for a typing pause, then announces a crossed step once, with the latest count', async () => {
    vi.useFakeTimers();
    const instance = useInstanceStore();
    instance.maxCharacters = 100;
    instance.hasCharacterLimit = true;
    const wrapper = mountArea('x'.repeat(45));
    const liveRegion = () => wrapper.find('[aria-live="polite"]').text();
    const changes: string[] = [];
    const observer = new MutationObserver(() => changes.push(liveRegion()));
    observer.observe(wrapper.find('[aria-live="polite"]').element, { childList: true, characterData: true, subtree: true });

    // Each keystroke comes before the pause ends: crossing 50 left does not speak yet.
    for (const length of [49, 50, 51, 52, 53]) {
      await wrapper.setProps({ modelValue: 'x'.repeat(length) });
      vi.advanceTimersByTime(PAUSE_MS - 100);
      await wrapper.vm.$nextTick();
    }
    expect(liveRegion()).toBe('');

    vi.advanceTimersByTime(100);
    await wrapper.vm.$nextTick();
    await Promise.resolve();
    observer.disconnect();

    expect(liveRegion()).toBe('47 characters left');
    expect(changes.filter(text => text !== '')).toEqual(['47 characters left']);
  });

  it('clears its pending announcement on unmount: no timer left, nothing announced', async () => {
    vi.useFakeTimers();
    const instance = useInstanceStore();
    instance.maxCharacters = 100;
    instance.hasCharacterLimit = true;
    const wrapper = mountArea('');
    const liveRegion = wrapper.find('[aria-live="polite"]').element;
    await wrapper.setProps({ modelValue: 'x'.repeat(60) });
    expect(vi.getTimerCount()).toBe(1);

    wrapper.unmount();

    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(PAUSE_MS);
    await Promise.resolve();
    expect(liveRegion.textContent).toBe('');
  });

  it('does not announce anything before the instance limits are known', async () => {
    vi.useFakeTimers();
    const wrapper = mountArea('');
    await typeAndPause(wrapper, 'x'.repeat(480));

    expect(wrapper.find('[aria-live="polite"]').text()).toBe('');
  });

  it('gives the text box and the media and poll toggles a name', () => {
    const wrapper = mountArea();

    expect(wrapper.find('textarea').attributes('aria-label')).toBe('Toot text');
    expect(wrapper.find('textarea').attributes('data-toot-text')).toBeDefined();
    expect(wrapper.find('textarea').attributes('aria-describedby')).toBe('character-count');
    expect(wrapper.find('label[for="media"]').text()).toBe('Add images');
    expect(wrapper.find('label[for="poll"]').text()).toBe('Add a poll');
  });

  it("shows the composer's real state on the toggles", () => {
    const wrapper = mountArea('Hello', { showMedia: true, showPoll: false });

    expect((wrapper.find('#media').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find('#poll').element as HTMLInputElement).checked).toBe(false);
    expect(wrapper.find('#poll').attributes('disabled')).toBeDefined();
  });

  it('announces going one character over the limit', async () => {
    vi.useFakeTimers();
    const instance = useInstanceStore();
    instance.maxCharacters = 100;
    instance.hasCharacterLimit = true;
    const wrapper = mountArea('');
    const liveRegion = () => wrapper.find('[aria-live="polite"]').text();

    await typeAndPause(wrapper, 'x'.repeat(100));
    expect(liveRegion()).toBe('Character limit reached');

    await typeAndPause(wrapper, 'x'.repeat(101));
    expect(liveRegion()).toBe('1 character over the limit');
  });

  it('reads "characters over the limit" in the hidden counter text when over', () => {
    useInstanceStore().maxCharacters = 10;
    const wrapper = mountArea('x'.repeat(13));

    const spoken = wrapper.find('.character-count .visually-hidden').text();
    expect(spoken).toBe('3 characters over the limit');
    expect(wrapper.find('.character-count [aria-hidden="true"]').text()).toBe('-3');
    expect(wrapper.find('.character-count').attributes('id')).toBe('character-count');
  });

  it('reads the remaining count with singular wording', () => {
    useInstanceStore().maxCharacters = 10;

    expect(mountArea('x'.repeat(9)).find('.character-count .visually-hidden').text()).toBe('1 character left');
    expect(mountArea('x'.repeat(11)).find('.character-count .visually-hidden').text()).toBe('1 character over the limit');
  });

  it('counts the extra characters of the content warning', () => {
    const wrapper = mount(ContentArea, {
      props: { modelValue: 'Hello', hasPoll: false, hasMedia: false, showMedia: false, showPoll: false, extraCharacters: 10 },
      global: { plugins: [pinia] },
    });

    expect(wrapper.find('.character-count [aria-hidden="true"]').text()).toBe('485');
  });
});
