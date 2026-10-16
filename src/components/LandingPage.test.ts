import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import LandingPage from './LandingPage.vue';
import ModalView from './Modals/ModalView.vue';

type ObserverCallback = (entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void;

/** Stubs IntersectionObserver and returns a trigger for the last observer created. */
function stubIntersectionObserver() {
  let callback: ObserverCallback = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: ObserverCallback) { callback = cb; }
    observe() {}
    disconnect = disconnect;
  });
  return { trigger: (isIntersecting: boolean) => callback([{ isIntersecting }]), disconnect };
}

describe('LandingPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has one <h1> and no <main> of its own (App provides it)', () => {
    const wrapper = mount(LandingPage);

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('main').exists()).toBe(false);
  });

  it('shows the scroll hint until the FAQ comes into view, then hides it for good', async () => {
    const observer = stubIntersectionObserver();
    const wrapper = mount(LandingPage);
    await nextTick();

    expect(wrapper.find('.scroll-hint').exists()).toBe(true);

    observer.trigger(false);
    await nextTick();
    expect(wrapper.find('.scroll-hint').exists()).toBe(true);

    observer.trigger(true);
    await nextTick();
    expect(wrapper.find('.scroll-hint').exists()).toBe(false);
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it('scrolls to the FAQ when the hint is clicked', async () => {
    stubIntersectionObserver();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const wrapper = mount(LandingPage);
    await nextTick();

    await wrapper.find('.scroll-hint').trigger('click');

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('opens the sign-in dialog from the call to action after the FAQ', async () => {
    const wrapper = mount(LandingPage, { global: { stubs: { LoginForm: true } } });

    await wrapper.find('.landing-cta button').trigger('click');

    expect(wrapper.findComponent(ModalView).props('isOpen')).toBe(true);
  });

  it('invites real reviews with a link to the author that opens safely in a new tab', () => {
    const wrapper = mount(LandingPage);

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
    const wrapper = mount(LandingPage);
    const track = wrapper.find('.testimonials-track');
    setTrackScroll(track.element, 450);
    await track.trigger('scroll');

    await wrapper.find('[aria-label="Next testimonial"]').trigger('click');
    await wrapper.find('[aria-label="Previous testimonial"]').trigger('click');

    expect(scrollBy).toHaveBeenCalledTimes(2);
    expect(scrollBy.mock.calls[0][0]).toMatchObject({ behavior: 'smooth' });
  });

  it('disables each arrow when the slider cannot move that way', async () => {
    const wrapper = mount(LandingPage);
    const track = wrapper.find('.testimonials-track');
    const prev = wrapper.find('[aria-label="Previous testimonial"]');
    const next = wrapper.find('[aria-label="Next testimonial"]');

    setTrackScroll(track.element, 0);
    await track.trigger('scroll');
    expect(prev.attributes('disabled')).toBeDefined();
    expect(next.attributes('disabled')).toBeUndefined();

    setTrackScroll(track.element, 450);
    await track.trigger('scroll');
    expect(prev.attributes('disabled')).toBeUndefined();
    expect(next.attributes('disabled')).toBeUndefined();

    setTrackScroll(track.element, 900);
    await track.trigger('scroll');
    expect(prev.attributes('disabled')).toBeUndefined();
    expect(next.attributes('disabled')).toBeDefined();
  });

  it('makes the testimonials slider a labelled, keyboard-scrollable region', () => {
    const wrapper = mount(LandingPage);

    const track = wrapper.find('.testimonials-track');

    expect(track.attributes('role')).toBe('region');
    expect(track.attributes('aria-label')).toBe('Testimonials');
    expect(track.attributes('tabindex')).toBe('0');
    expect(track.findAll('.testimonial-slide')).toHaveLength(4);
  });

  it('does not show the hint when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const wrapper = mount(LandingPage);
    await nextTick();

    expect(wrapper.find('.scroll-hint').exists()).toBe(false);
  });
});
