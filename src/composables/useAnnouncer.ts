/**
 * Time between emptying a live region and writing the message into it. It makes an identical message
 * count as a change, and lets a focus move or a navigation made in the same tick be spoken first.
 */
export const ANNOUNCE_DELAY_MS = 100;
/** Safari needs the live regions in the page for a moment before it reads their changes. */
export const READY_DELAY_MS = 500;
/** A spoken message is removed afterwards, so that nobody finds stale text when reading the page. */
export const CLEAR_AFTER_MS = 7000;

import { readonly, ref, type Ref } from 'vue';

type Politeness = 'polite' | 'assertive';

interface RegionState {
  /** Text of the region, rendered by App.vue. */
  message: Ref<string>;
  /** Messages waiting to be written: several announced in a row are all spoken, once each. */
  texts: string[];
  writeTimer: number | undefined;
  clearTimer: number | undefined;
}

const regions: Record<Politeness, RegionState> = {
  polite: { message: ref(''), texts: [], writeTimer: undefined, clearTimer: undefined },
  assertive: { message: ref(''), texts: [], writeTimer: undefined, clearTimer: undefined },
};

/** When App.vue mounted the regions (Date.now()); null until then, and messages wait. */
let readySince: number | null = null;

function scheduleWrite(region: RegionState): void {
  if (readySince === null || region.texts.length === 0) return;
  window.clearTimeout(region.writeTimer);
  const untilReady = readySince + READY_DELAY_MS - Date.now();
  region.writeTimer = window.setTimeout(() => {
    const text = region.texts.join(' ');
    region.message.value = text;
    region.texts = [];
    region.writeTimer = undefined;
    region.clearTimer = window.setTimeout(() => {
      // Only the text written here: a newer message has its own timer.
      if (region.message.value === text) region.message.value = '';
    }, CLEAR_AFTER_MS);
  }, Math.max(ANNOUNCE_DELAY_MS, untilReady));
}

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
  const region = regions[assertive ? 'assertive' : 'polite'];

  window.clearTimeout(region.clearTimer);
  region.message.value = '';
  if (!region.texts.includes(text)) region.texts.push(text);
  scheduleWrite(region);
}

/** Called by App.vue once the regions are in the page: messages announced until then are written READY_DELAY_MS later. */
function markReady(): void {
  if (readySince !== null) return;
  readySince = Date.now();
  Object.values(regions).forEach(scheduleWrite);
}

/** Test only: back to the state before App.vue mounted, with empty regions and no timers. */
export function resetAnnouncer(): void {
  readySince = null;
  for (const region of Object.values(regions)) {
    window.clearTimeout(region.writeTimer);
    window.clearTimeout(region.clearTimer);
    region.message.value = '';
    region.texts = [];
    region.writeTimer = undefined;
    region.clearTimer = undefined;
  }
}

/**
 * Screen reader announcements through two persistent live regions (polite and assertive).
 * @returns {Object} `announce`, `markReady` for App.vue, and the read-only text of each region.
 */
export function useAnnouncer() {
  return {
    announce,
    markReady,
    politeMessage: readonly(regions.polite.message),
    assertiveMessage: readonly(regions.assertive.message),
  };
}
