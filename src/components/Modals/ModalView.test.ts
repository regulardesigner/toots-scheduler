import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { h, nextTick } from 'vue';
import ModalView from './ModalView.vue';

const mounted: VueWrapper[] = [];

/** A dialog titled "Edit" with a text field and a Save button. */
function mountModal(isOpen: boolean): VueWrapper {
  const wrapper = mount(ModalView, {
    props: { isOpen, labelledBy: 'dialog-title' },
    slots: {
      default: () => [
        h('h2', { id: 'dialog-title' }, 'Edit'),
        h('input', { id: 'first-field' }),
        h('button', { type: 'button' }, 'Save'),
      ],
    },
    attachTo: document.body,
  });
  mounted.push(wrapper);
  return wrapper;
}

/** A button outside the dialog, focused. */
function focusedButton(): HTMLButtonElement {
  const button = document.createElement('button');
  document.body.appendChild(button);
  button.focus();
  return button;
}

function pressTab(shiftKey = false): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true }));
}

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

describe('ModalView', () => {
  afterEach(() => {
    mounted.splice(0).forEach(wrapper => wrapper.unmount());
    document.body.innerHTML = '';
    document.body.classList.remove('modal-open');
  });

  it('is named by its heading and has a labelled close button', () => {
    const wrapper = mountModal(true);

    expect(wrapper.find('[role="dialog"]').attributes('aria-labelledby')).toBe('dialog-title');
    expect(wrapper.find('[role="dialog"]').attributes('aria-label')).toBeUndefined();
    expect(wrapper.find('.close-button').attributes('aria-label')).toBe('Close');
  });

  it('closes on Escape, the close button and the overlay', async () => {
    const wrapper = mountModal(true);
    await nextTick();

    pressEscape();
    await wrapper.find('.close-button').trigger('click');
    await wrapper.find('.modal-overlay').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(3);
  });

  it('ignores Escape while closed', async () => {
    const wrapper = mountModal(false);
    await nextTick();

    pressEscape();

    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('puts focus on the first focusable element of its content when it opens', async () => {
    const wrapper = mountModal(false);

    await wrapper.setProps({ isOpen: true });
    await nextTick();

    expect(document.activeElement?.id).toBe('first-field');
  });

  it('gives focus back to what had it before opening', async () => {
    const trigger = focusedButton();
    const wrapper = mountModal(false);

    await wrapper.setProps({ isOpen: true });
    await nextTick();
    await wrapper.setProps({ isOpen: false });

    expect(document.activeElement).toBe(trigger);
  });

  it('never moves focus when it was never opened', async () => {
    focusedButton();
    const wrapper = mountModal(false);
    const elsewhere = focusedButton();

    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);

    expect(document.activeElement).toBe(elsewhere);
  });

  it('does not take focus back when unmounted after it was closed', async () => {
    focusedButton();
    const wrapper = mountModal(false);
    await wrapper.setProps({ isOpen: true });
    await nextTick();
    await wrapper.setProps({ isOpen: false });
    const elsewhere = focusedButton();

    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);

    expect(document.activeElement).toBe(elsewhere);
  });

  it('brings focus back into the dialog on Tab when it fell out', async () => {
    const wrapper = mountModal(false);
    await wrapper.setProps({ isOpen: true });
    await nextTick();
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);

    pressTab();

    expect(document.activeElement?.id).toBe('first-field');
  });

  it('wraps Tab from the last focusable to the first, and Shift+Tab back', async () => {
    const wrapper = mountModal(false);
    await wrapper.setProps({ isOpen: true });
    await nextTick();
    (wrapper.find('.close-button').element as HTMLElement).focus();

    pressTab();
    expect(document.activeElement?.id).toBe('first-field');

    pressTab(true);
    expect(document.activeElement).toBe(wrapper.find('.close-button').element);
  });

  it('closes only the top-most dialog on Escape', async () => {
    const first = mountModal(false);
    const second = mountModal(false);
    await first.setProps({ isOpen: true });
    await nextTick();
    await second.setProps({ isOpen: true });
    await nextTick();

    pressEscape();

    expect(first.emitted('close')).toBeUndefined();
    expect(second.emitted('close')).toHaveLength(1);
  });

  it('locks page scroll with a body class while open', async () => {
    const wrapper = mountModal(false);
    expect(document.body.classList.contains('modal-open')).toBe(false);

    await wrapper.setProps({ isOpen: true });
    await nextTick();
    expect(document.body.classList.contains('modal-open')).toBe(true);

    await wrapper.setProps({ isOpen: false });
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('returns focus to the opener even if focus moved before the content rendered', async () => {
    const opener = focusedButton();
    const wrapper = mountModal(false);

    await wrapper.setProps({ isOpen: true });
    (wrapper.find('#first-field').element as HTMLElement).focus();
    await wrapper.setProps({ isOpen: false });

    expect(document.activeElement).toBe(opener);
  });

  it('leaves no trace when unmounted before it activated', async () => {
    const wrapper = mountModal(true);
    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);
    await nextTick();

    expect(document.body.classList.contains('modal-open')).toBe(false);
  });
});
