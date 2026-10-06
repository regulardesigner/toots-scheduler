import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { h, nextTick } from 'vue';
import ModalView from './ModalView.vue';
import { settleFocus } from '../../test-utils/settle';

const mounted: VueWrapper[] = [];

/** A dialog titled "Edit" with a text field and a Save button. */
function mountModal(
  isOpen: boolean,
  initialFocus?: 'first' | 'dialog',
  returnFocus?: () => HTMLElement | null | undefined,
): VueWrapper {
  const wrapper = mount(ModalView, {
    props: { isOpen, labelledBy: 'dialog-title', initialFocus, returnFocus },
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

/** A button outside the dialog, clicked without taking focus, as in Safari. */
function clickedButton(): HTMLButtonElement {
  const button = document.createElement('button');
  document.body.appendChild(button);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
    vi.restoreAllMocks();
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
    await settleFocus();

    pressEscape();
    await wrapper.find('.close-button').trigger('click');
    await wrapper.find('.modal-overlay').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(3);
  });

  it('ignores Escape while closed', async () => {
    const wrapper = mountModal(false);
    await settleFocus();

    pressEscape();

    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('puts focus on the first focusable element of its content when it opens', async () => {
    const wrapper = mountModal(false);

    await wrapper.setProps({ isOpen: true });
    await settleFocus();

    expect(document.activeElement?.id).toBe('first-field');
  });

  it('waits a frame after rendering before moving focus inside, so Safari can name the dialog', async () => {
    const opener = focusedButton();
    const wrapper = mountModal(false);

    await wrapper.setProps({ isOpen: true });
    await nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(document.body.classList.contains('modal-open')).toBe(true);
    expect(document.activeElement).toBe(opener);

    await settleFocus();
    expect(document.activeElement?.id).toBe('first-field');
  });

  it('moves no focus when closed before the deferred focus runs', async () => {
    const opener = focusedButton();
    const wrapper = mountModal(false);

    await wrapper.setProps({ isOpen: true });
    await nextTick();
    await wrapper.setProps({ isOpen: false });
    const elsewhere = focusedButton();
    await settleFocus();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(elsewhere);
    expect(document.activeElement).not.toBe(opener);
  });

  it('does not steal focus from a dialog opened on top before its own deferred focus ran', async () => {
    // Hold the deferred focus callbacks to run the lower dialog's last, after the top one has taken focus.
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback));
    const below = mountModal(false);
    const above = mountModal(false);

    await below.setProps({ isOpen: true });
    await nextTick();
    await above.setProps({ isOpen: true });
    await nextTick();
    expect(frames).toHaveLength(2);
    const [belowFrame, aboveFrame] = frames;

    aboveFrame(0);
    await new Promise(resolve => setTimeout(resolve, 0));
    const aboveDialog = above.find('[role="dialog"]').element;
    expect(aboveDialog.contains(document.activeElement)).toBe(true);

    belowFrame(0);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(aboveDialog.contains(document.activeElement)).toBe(true);
  });

  it('puts focus on the dialog itself, scrolled to the top, with initialFocus="dialog"', async () => {
    const wrapper = mountModal(false, 'dialog');

    await wrapper.setProps({ isOpen: true });
    await settleFocus();

    const dialog = wrapper.find('[role="dialog"]').element as HTMLElement;
    expect(document.activeElement).toBe(dialog);
    expect(dialog.scrollTop).toBe(0);
  });

  it('moves Tab from the dialog itself to its first focusable element', async () => {
    const wrapper = mountModal(false, 'dialog');
    await wrapper.setProps({ isOpen: true });
    await settleFocus();

    pressTab();

    expect(document.activeElement?.id).toBe('first-field');
  });

  it('gives focus back to what had it before opening', async () => {
    const trigger = focusedButton();
    const wrapper = mountModal(false);

    await wrapper.setProps({ isOpen: true });
    await settleFocus();
    await wrapper.setProps({ isOpen: false });

    expect(document.activeElement).toBe(trigger);
  });

  it('gives focus back to the clicked opener even when the click did not focus it (Safari)', async () => {
    const opener = document.createElement('button');
    opener.append(document.createElement('span'));
    document.body.appendChild(opener);
    const wrapper = mountModal(false);
    // Safari neither focuses a clicked button nor, likely, one activated by VoiceOver.
    opener.querySelector('span')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.activeElement).toBe(document.body);

    await wrapper.setProps({ isOpen: true });
    await settleFocus();
    expect(document.activeElement?.id).toBe('first-field');
    await wrapper.setProps({ isOpen: false });

    expect(document.activeElement).toBe(opener);
  });

  it('ignores a click older than a second as the opener', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const opener = clickedButton();
    const wrapper = mountModal(false);
    now.mockReturnValue(2500);

    await wrapper.setProps({ isOpen: true });
    await settleFocus();
    await wrapper.setProps({ isOpen: false });

    expect(document.activeElement).not.toBe(opener);
  });

  it('uses a clicked opener only once', async () => {
    const opener = clickedButton();
    const wrapper = mountModal(false);
    await wrapper.setProps({ isOpen: true });
    await settleFocus();
    await wrapper.setProps({ isOpen: false });
    expect(document.activeElement).toBe(opener);
    opener.blur();

    // Opened again without a click (e.g. by code): the earlier click is not the opener any more.
    await wrapper.setProps({ isOpen: true });
    await settleFocus();
    await wrapper.setProps({ isOpen: false });

    expect(document.activeElement).not.toBe(opener);
  });

  it('focuses the returnFocus target when the opener was removed while it was open', async () => {
    const opener = focusedButton();
    const fallback = document.createElement('button');
    document.body.appendChild(fallback);
    const wrapper = mountModal(false, 'first', () => fallback);
    await wrapper.setProps({ isOpen: true });
    await settleFocus();

    opener.remove();
    await wrapper.setProps({ isOpen: false });

    expect(document.activeElement).toBe(fallback);
  });

  it('prefers the opener to the returnFocus target while the opener is still there', async () => {
    const opener = focusedButton();
    const fallback = document.createElement('button');
    document.body.appendChild(fallback);
    const wrapper = mountModal(false, 'first', () => fallback);
    await wrapper.setProps({ isOpen: true });
    await settleFocus();

    await wrapper.setProps({ isOpen: false });

    expect(document.activeElement).toBe(opener);
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
    await settleFocus();
    await wrapper.setProps({ isOpen: false });
    const elsewhere = focusedButton();

    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);

    expect(document.activeElement).toBe(elsewhere);
  });

  it('brings focus back into the dialog on Tab when it fell out', async () => {
    const wrapper = mountModal(false);
    await wrapper.setProps({ isOpen: true });
    await settleFocus();
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);

    pressTab();

    expect(document.activeElement?.id).toBe('first-field');
  });

  it('wraps Tab from the last focusable to the first, and Shift+Tab back', async () => {
    const wrapper = mountModal(false);
    await wrapper.setProps({ isOpen: true });
    await settleFocus();
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
    await settleFocus();
    await second.setProps({ isOpen: true });
    await settleFocus();

    pressEscape();

    expect(first.emitted('close')).toBeUndefined();
    expect(second.emitted('close')).toHaveLength(1);
  });

  it('locks page scroll with a body class while open', async () => {
    const wrapper = mountModal(false);
    expect(document.body.classList.contains('modal-open')).toBe(false);

    await wrapper.setProps({ isOpen: true });
    await settleFocus();
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
    await settleFocus();

    expect(document.body.classList.contains('modal-open')).toBe(false);
  });
});
