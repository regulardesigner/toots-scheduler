import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TestimonialsSlider from './TestimonialsSlider.vue';

describe('TestimonialsSlider', () => {
  it('invites real reviews with a link to the author that opens safely in a new tab', () => {
    const wrapper = mount(TestimonialsSlider);

    const link = wrapper.find('.testimonial-yours a');

    expect(link.attributes('href')).toBe('https://mastodon.social/@damsdev');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toContain('noopener');
  });

  /** Gives the slider a size jsdom does not compute, scrolled to the given position. */
  function setTrackScroll(track: Element, scrollLeft: number) {
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1200 });
    Object.defineProperty(track, 'scrollLeft', { configurable: true, value: scrollLeft });
  }

  it('slides the testimonials backwards and forwards with the arrow buttons', async () => {
    const scrollBy = vi.fn();
    Element.prototype.scrollBy = scrollBy;
    const wrapper = mount(TestimonialsSlider);
    const track = wrapper.find('.testimonials-track');
    setTrackScroll(track.element, 450);
    await track.trigger('scroll');

    await wrapper.find('[aria-label="Next testimonial"]').trigger('click');
    await wrapper.find('[aria-label="Previous testimonial"]').trigger('click');

    expect(scrollBy).toHaveBeenCalledTimes(2);
    expect(scrollBy.mock.calls[0][0]).toMatchObject({ behavior: 'smooth' });
  });

  it('marks each arrow disabled at its end, without taking it out of the tab order', async () => {
    const wrapper = mount(TestimonialsSlider);
    const track = wrapper.find('.testimonials-track');
    const prev = wrapper.find('[aria-label="Previous testimonial"]');
    const next = wrapper.find('[aria-label="Next testimonial"]');

    setTrackScroll(track.element, 0);
    await track.trigger('scroll');
    expect(prev.attributes('aria-disabled')).toBe('true');
    expect(next.attributes('aria-disabled')).toBe('false');

    setTrackScroll(track.element, 450);
    await track.trigger('scroll');
    expect(prev.attributes('aria-disabled')).toBe('false');
    expect(next.attributes('aria-disabled')).toBe('false');

    setTrackScroll(track.element, 900);
    await track.trigger('scroll');
    expect(prev.attributes('aria-disabled')).toBe('false');
    expect(next.attributes('aria-disabled')).toBe('true');
    expect(next.attributes('disabled')).toBeUndefined();
  });

  it('keeps focus on an arrow that reaches its end, and ignores further presses', async () => {
    const scrollBy = vi.fn();
    Element.prototype.scrollBy = scrollBy;
    const wrapper = mount(TestimonialsSlider, { attachTo: document.body });
    const track = wrapper.find('.testimonials-track');
    const next = wrapper.find('[aria-label="Next testimonial"]');
    (next.element as HTMLElement).focus();

    setTrackScroll(track.element, 900);
    await track.trigger('scroll');
    await next.trigger('click');

    expect(document.activeElement).toBe(next.element);
    expect(scrollBy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('makes the testimonials slider a labelled, keyboard-scrollable region', () => {
    const wrapper = mount(TestimonialsSlider);

    const track = wrapper.find('.testimonials-track');

    expect(track.attributes('role')).toBe('region');
    expect(track.attributes('aria-label')).toBe('Testimonials');
    expect(track.attributes('tabindex')).toBe('0');
    expect(track.findAll('.testimonial-slide')).toHaveLength(4);
  });
});
