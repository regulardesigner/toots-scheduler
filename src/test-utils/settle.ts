import { nextTick } from 'vue';

/**
 * Waits until a freshly opened ModalView has moved focus inside: it renders on the next tick,
 * then defers the focus by a frame and a task so Safari registers the dialog first.
 */
export async function settleFocus(): Promise<void> {
  await nextTick();
  await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
}
