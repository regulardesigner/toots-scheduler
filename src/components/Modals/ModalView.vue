<script lang="ts">
/** Dialogs currently open, oldest first: only the last one reacts to the keyboard. */
const openStack: symbol[] = [];

function syncScrollLock(): void {
  document.body.classList.toggle('modal-open', openStack.length > 0);
}
</script>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue';

// What can take focus inside the dialog; disabled controls are skipped, as the browser does.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const props = withDefaults(defineProps<{
  isOpen: boolean;
  /** Id of the heading (or label) inside the slot that names the dialog. */
  labelledBy: string;
  /**
   * Where focus lands on opening: the first focusable element, or the dialog itself
   * (for long content whose first control is at the end, so it opens at the top).
   */
  initialFocus?: 'first' | 'dialog';
}>(), {
  initialFocus: 'first',
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const modalRef = ref<HTMLElement | null>(null);

/** What had focus before the dialog opened. Null unless it really opened, so focus is never moved for nothing. */
let returnFocusTo: HTMLElement | null = null;

function close(): void {
  emit('close');
}

const id = Symbol('modal');

function isTopMost(): boolean {
  return openStack[openStack.length - 1] === id;
}

function getFocusableElements(): HTMLElement[] {
  if (!modalRef.value) return [];
  return Array.from(modalRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/** Escape closes the top-most dialog; Tab and Shift+Tab stay inside it, even when focus has fallen out (e.g. onto the body). */
function handleDocumentKeydown(event: KeyboardEvent): void {
  if (!isTopMost()) return;
  if (event.key === 'Escape' && !event.isComposing) {
    close();
    return;
  }
  if (event.key !== 'Tab' || !modalRef.value) return;
  const focusable = getFocusableElements();
  if (focusable.length === 0) {
    event.preventDefault();
    modalRef.value.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (!modalRef.value.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && (active === first || active === modalRef.value)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || active === modalRef.value)) {
    event.preventDefault();
    first.focus();
  }
}

function activate(): void {
  // Closed again, or unmounted (the template ref is nulled), before the content rendered: nothing to do.
  if (!props.isOpen || !modalRef.value) return;
  openStack.push(id);
  syncScrollLock();
  document.addEventListener('keydown', handleDocumentKeydown);
  if (props.initialFocus === 'dialog') {
    modalRef.value.focus({ preventScroll: true });
    modalRef.value.scrollTop = 0;
    return;
  }
  // The close button is last in the DOM, so this is the dialog's own first field or action.
  const [first] = getFocusableElements();
  (first ?? modalRef.value)?.focus();
}

function deactivate(): void {
  document.removeEventListener('keydown', handleDocumentKeydown);
  const index = openStack.indexOf(id);
  if (index !== -1) openStack.splice(index, 1);
  syncScrollLock();
  const target = returnFocusTo;
  returnFocusTo = null;
  if (target?.isConnected) target.focus();
}

watch(() => props.isOpen, (open) => {
  if (open) {
    // The real opener, captured before anything inside the dialog can take focus.
    returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void nextTick(activate);
  }
  else deactivate();
}, { immediate: true });

// Unmounted while open (e.g. sign-out): give focus back. Already closed: returnFocusTo is null, nothing moves.
onUnmounted(deactivate);
</script>

<template>
  <div
    v-if="isOpen"
    class="modal"
  >
    <div
      class="modal-overlay"
      @click="close"
    />
    <div
      ref="modalRef"
      class="modal-content"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="labelledBy"
    >
      <slot />
      <!-- Last in the DOM, shown top-right: keyboard focus starts on the dialog's content. -->
      <button
        type="button"
        class="close-button"
        aria-label="Close"
        @click="close"
      >
        &times;
      </button>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  background-color: white;
  padding: 2rem;
  border-radius: 1rem;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.close-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0.5rem;
  line-height: 1;
  border-radius: 50%;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    padding: 1.5rem;
  }
}
</style>