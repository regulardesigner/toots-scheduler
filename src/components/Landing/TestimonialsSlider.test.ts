import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import TestimonialsSlider from './TestimonialsSlider.vue';

const CARD_WIDTH = 288;
const TRACK_WIDTH = 300;
const SCROLL_WIDTH = 1200;

const PREV = '[aria-label="Previous testimonial"]';
const NEXT = '[aria-label="Next testimonial"]';
const TRACK = '[aria-label="Testimonials slider"]';

/** Gives the track a size happy-dom does not lay out, scrolled to the given position, and fires a scroll. */
async function scrollTrackTo(wrapper: VueWrapper, scrollLeft: number) {
  const track = wrapper.find(TRACK);
  Object.defineProperty(track.element, 'clientWidth', { configurable: true, value: TRACK_WIDTH });
  Object.defineProperty(track.element, 'scrollWidth', { configurable: true, value: SCROLL_WIDTH });
  Object.defineProperty(track.element, 'scrollLeft', { configurable: true, value: scrollLeft });
  await track.trigger('scroll');
}

/** Gives the first card a width happy-dom does not lay out. */
function setCardWidth(wrapper: VueWrapper) {
  Object.defineProperty(wrapper.find('li').element, 'offsetWidth', { configurable: true, value: CARD_WIDTH });
}

describe('TestimonialsSlider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is a named, keyboard-scrollable group described by the "jokes" note', () => {
    const wrapper = mount(TestimonialsSlider);

    const track = wrapper.find(TRACK);
    const note = wrapper.find(`#${track.attributes('aria-describedby')}`);

    expect(track.attributes('role')).toBe('group');
    expect(track.attributes('tabindex')).toBe('0');
    expect(note.text()).toContain('real reviews welcome');
    expect(track.findAll('li')).toHaveLength(4);
  });

  it('slides one card forwards with Next and backwards with Previous', async () => {
    const scrollBy = vi.spyOn(Element.prototype, 'scrollBy').mockImplementation(() => {});
    const wrapper = mount(TestimonialsSlider);
    setCardWidth(wrapper);
    await scrollTrackTo(wrapper, 450);

    await wrapper.find(NEXT).trigger('click');
    await wrapper.find(PREV).trigger('click');

    expect(scrollBy.mock.calls).toEqual([
      [{ left: CARD_WIDTH, behavior: 'smooth' }],
      [{ left: -CARD_WIDTH, behavior: 'smooth' }],
    ]);
  });

  it('slides instantly when the user asked to reduce motion', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const scrollBy = vi.spyOn(Element.prototype, 'scrollBy').mockImplementation(() => {});
    const wrapper = mount(TestimonialsSlider);
    setCardWidth(wrapper);
    await scrollTrackTo(wrapper, 450);

    await wrapper.find(NEXT).trigger('click');

    expect(scrollBy).toHaveBeenCalledWith({ left: CARD_WIDTH, behavior: 'auto' });
  });

  it('marks each arrow disabled at its end, without taking it out of the tab order', async () => {
    const wrapper = mount(TestimonialsSlider);
    const prev = wrapper.find(PREV);
    const next = wrapper.find(NEXT);

    await scrollTrackTo(wrapper, 0);
    expect(prev.attributes('aria-disabled')).toBe('true');
    expect(next.attributes('aria-disabled')).toBe('false');

    await scrollTrackTo(wrapper, 450);
    expect(prev.attributes('aria-disabled')).toBe('false');
    expect(next.attributes('aria-disabled')).toBe('false');

    await scrollTrackTo(wrapper, SCROLL_WIDTH - TRACK_WIDTH);
    expect(prev.attributes('aria-disabled')).toBe('false');
    expect(next.attributes('aria-disabled')).toBe('true');
    expect(next.attributes('disabled')).toBeUndefined();
  });

  it('keeps focus on an arrow that reaches its end, and ignores further presses', async () => {
    const scrollBy = vi.spyOn(Element.prototype, 'scrollBy').mockImplementation(() => {});
    const wrapper = mount(TestimonialsSlider, { attachTo: document.body });
    const next = wrapper.find(NEXT);
    (next.element as HTMLElement).focus();

    await scrollTrackTo(wrapper, SCROLL_WIDTH - TRACK_WIDTH);
    await next.trigger('click');

    expect(document.activeElement).toBe(next.element);
    expect(scrollBy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('re-checks the arrows when the slider is resized, and stops watching on unmount', async () => {
    let onResize: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { onResize = cb; }
      observe() {}
      disconnect = disconnect;
    });
    const wrapper = mount(TestimonialsSlider);
    const track = wrapper.find(TRACK).element;
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: TRACK_WIDTH });
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: SCROLL_WIDTH });

    onResize();
    await wrapper.vm.$nextTick();
    expect(wrapper.find(NEXT).attributes('aria-disabled')).toBe('false');

    wrapper.unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('invites real reviews with a link to the author that opens safely in a new tab', () => {
    const wrapper = mount(TestimonialsSlider);

    const link = wrapper.find('a[href="https://mastodon.social/@damsdev"]');

    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toContain('noopener');
  });
});
