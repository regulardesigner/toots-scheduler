import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import LandingPage from './LandingPage.vue';
import ModalView from './Modals/ModalView.vue';
import TestimonialsSlider from './Landing/TestimonialsSlider.vue';

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

  it('shows the testimonials', () => {
    const wrapper = mount(LandingPage);

    expect(wrapper.findComponent(TestimonialsSlider).exists()).toBe(true);
  });

  it('does not show the hint when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const wrapper = mount(LandingPage);
    await nextTick();

    expect(wrapper.find('.scroll-hint').exists()).toBe(false);
  });
});
