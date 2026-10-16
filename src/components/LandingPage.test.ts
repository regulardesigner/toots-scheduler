import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import LandingPage from './LandingPage.vue';
import ModalView from './Modals/ModalView.vue';
import TestimonialsSlider from './Landing/TestimonialsSlider.vue';

type ObserverCallback = (entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void;

const HINT = '[aria-label="Scroll to the FAQ"]';

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
    vi.restoreAllMocks();
  });

  it('has one <h1> and no <main> of its own (App provides it)', () => {
    const wrapper = mount(LandingPage);

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('main').exists()).toBe(false);
  });

  it('shows the scroll hint while the FAQ is out of view, then hides it for good', async () => {
    const observer = stubIntersectionObserver();
    const wrapper = mount(LandingPage);
    await nextTick();

    observer.trigger(false);
    await nextTick();
    expect(wrapper.find(HINT).exists()).toBe(true);

    observer.trigger(true);
    await nextTick();
    expect(wrapper.find(HINT).exists()).toBe(false);
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it('never shows the hint when the FAQ is already in view on load', async () => {
    const observer = stubIntersectionObserver();
    const wrapper = mount(LandingPage);
    await nextTick();

    expect(wrapper.find(HINT).exists()).toBe(false);

    observer.trigger(true);
    await nextTick();
    expect(wrapper.find(HINT).exists()).toBe(false);
  });

  it('scrolls to the FAQ section and moves focus to its heading when the hint is clicked', async () => {
    const observer = stubIntersectionObserver();
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    const wrapper = mount(LandingPage, { attachTo: document.body });
    observer.trigger(false);
    await nextTick();

    await wrapper.find(HINT).trigger('click');

    const faq = wrapper.find('section.frequently-asked-questions');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    expect(scrollIntoView.mock.contexts[0]).toBe(faq.element);
    expect(document.activeElement).toBe(faq.find('h2').element);
    wrapper.unmount();
  });

  it('disconnects the FAQ observer on unmount', async () => {
    const observer = stubIntersectionObserver();
    const wrapper = mount(LandingPage);
    await nextTick();

    wrapper.unmount();

    expect(observer.disconnect).toHaveBeenCalled();
  });

  it('opens the sign-in dialog from both "Get started" buttons', async () => {
    const wrapper = mount(LandingPage, { global: { stubs: { LoginForm: true } } });
    const buttons = wrapper.findAll('button').filter(button => button.text() === 'Get started');
    const modal = wrapper.findComponent(ModalView);

    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      await button.trigger('click');
      expect(modal.props('isOpen')).toBe(true);
      modal.vm.$emit('close');
      await nextTick();
      expect(modal.props('isOpen')).toBe(false);
    }
  });

  it('shows the testimonials', () => {
    const wrapper = mount(LandingPage);

    expect(wrapper.findComponent(TestimonialsSlider).exists()).toBe(true);
  });

  it('does not show the hint when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const wrapper = mount(LandingPage);
    await nextTick();

    expect(wrapper.find(HINT).exists()).toBe(false);
  });
});
