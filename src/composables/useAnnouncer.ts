/**
 * Time between emptying a live region and writing the message into it. It makes an identical message
 * count as a change, and lets a focus move or a navigation made in the same tick be spoken first.
 */
export const ANNOUNCE_DELAY_MS = 100;

import { readonly, ref, type Ref } from 'vue';

type Politeness = 'polite' | 'assertive';

/** Text of the two persistent live regions rendered once by App.vue (shared by every caller). */
const messages: Record<Politeness, Ref<string>> = {
  polite: ref(''),
  assertive: ref(''),
};

/** Messages waiting for the delay, per region: several announced in a row are all spoken, once each. */
const pending: Record<Politeness, { timer: number | undefined; texts: string[] }> = {
  polite: { timer: undefined, texts: [] },
  assertive: { timer: undefined, texts: [] },
};

/**
 * Speaks a message through live regions that are present from the start: Safari with VoiceOver
 * ignores a live region (or role="alert") that is inserted already filled, as toasts are.
 * @param {string} message - The text to speak.
 * @param {Object} [options]
 * @param {boolean} [options.assertive=false] - Interrupts the screen reader (errors, warnings) instead of waiting.
 */
function announce(message: string, { assertive = false }: { assertive?: boolean } = {}): void {
  const text = message.trim();
  if (!text) return;
  const politeness: Politeness = assertive ? 'assertive' : 'polite';
  const queue = pending[politeness];

  messages[politeness].value = '';
  if (!queue.texts.includes(text)) queue.texts.push(text);
  window.clearTimeout(queue.timer);
  queue.timer = window.setTimeout(() => {
    messages[politeness].value = queue.texts.join(' ');
    queue.texts = [];
    queue.timer = undefined;
  }, ANNOUNCE_DELAY_MS);
}

/**
 * Screen reader announcements through two persistent live regions (polite and assertive).
 * @returns {Object} `announce`, and the read-only text of each region for App.vue to render.
 */
export function useAnnouncer() {
  return {
    announce,
    politeMessage: readonly(messages.polite),
    assertiveMessage: readonly(messages.assertive),
  };
}
