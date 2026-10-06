import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import MobileNav from './MobileNav.vue';

let wrapper: VueWrapper;

function mountNav(): VueWrapper {
  wrapper = mount(MobileNav, { props: { hasNewFeatures: true }, attachTo: document.body });
  return wrapper;
}

describe('MobileNav', () => {
  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
    document.body.className = '';
  });

  it('has a named menu button that says which element it controls and whether it is open', () => {
    const button = mountNav().find('.burger-menu');

    expect(button.attributes('aria-label')).toBe('Menu');
    expect(button.attributes('aria-controls')).toBe('mobile-menu');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('#mobile-menu').exists()).toBe(true);
  });

  it('opens and closes from the menu button', async () => {
    const button = mountNav().find('.burger-menu');

    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('#mobile-menu').classes()).toContain('is-open');

    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('false');
  });

  it('closes on Escape and gives focus back to the menu button', async () => {
    const button = mountNav().find('.burger-menu');
    await button.trigger('click');
    (wrapper.find('.logout-button').element as HTMLButtonElement).focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(button.attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button.element);
  });

  it('leaves Escape to an open dialog instead of closing the menu too', async () => {
    const button = mountNav().find('.burger-menu');
    await button.trigger('click');
    document.body.classList.add('modal-open');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(button.attributes('aria-expanded')).toBe('true');
  });

  it('ignores Escape that another handler already handled', async () => {
    const button = mountNav().find('.burger-menu');
    await button.trigger('click');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    const handled = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    handled.preventDefault();
    await wrapper.vm.$nextTick();
    expect(button.attributes('aria-expanded')).toBe('false');

    await button.trigger('click');
    document.dispatchEvent(handled);
    await wrapper.vm.$nextTick();
    expect(button.attributes('aria-expanded')).toBe('true');
  });

  it('closes before running the chosen action', async () => {
    const button = mountNav().find('.burger-menu');
    await button.trigger('click');

    await wrapper.find('.thanks-button').trigger('click');

    expect(wrapper.emitted('thanks')).toHaveLength(1);
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button.element);
  });
});
