<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue';
import TootCard from './TootCard.vue';
import ModalView from '../Modals/ModalView.vue';
import DeleteConfirmModal from '../Modals/DeleteConfirmModal.vue';
import { useScheduledTootsStore } from '../../stores/scheduledToots';
import type { MastodonStatus } from '../../types/mastodon';

const PREVIEW_MAX_LENGTH = 120;

const store = useScheduledTootsStore();

/** The user's own choice (open/closed); null until they click, so the list follows the data. */
const userToggled = ref<boolean | null>(null);
// The error is shown above the panel, open or not: it neither opens the panel nor overrides the user's choice.
const isOpen = computed(() => userToggled.value ?? store.count > 0);

/** First load, nothing to show yet. */
const isFirstLoad = computed(() => store.isLoading && store.count === 0);

/** The list's toggle: focus lands here once a deleted toot's card is gone. */
const listToggle = ref<HTMLButtonElement | null>(null);

/** The toot pending deletion, or null when no confirmation is open. */
const tootToDelete = ref<MastodonStatus | null>(null);

/** Truncated preview text shown inside the confirmation modal. */
const tootDeletePreview = ref('');

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Opens the delete confirmation modal for the given toot ID.
 * @param {string} id - The ID of the toot to delete.
 */
function handleDeleteRequest(id: string) {
  const toot = store.toots.find(t => t.id === id);
  if (!toot) return;
  tootToDelete.value = toot;
  const text = toot.params?.text ?? '';
  tootDeletePreview.value = text.length > PREVIEW_MAX_LENGTH
    ? text.slice(0, PREVIEW_MAX_LENGTH) + '…'
    : text;
}

/**
 * Cancels the pending deletion and closes the confirmation modal.
 */
function handleDeleteCancel() {
  tootToDelete.value = null;
  tootDeletePreview.value = '';
}

/**
 * Confirms the deletion of the pending toot. Only its card shows progress meanwhile.
 */
async function handleDeleteConfirm() {
  if (!tootToDelete.value) return;
  const id = tootToDelete.value.id;
  handleDeleteCancel();
  // Another change started while the dialog was open: deleteToot would refuse, and nothing moved, so neither does focus.
  if (store.pendingId !== null) return;

  const deleted = await store.deleteToot(id);
  await nextTick();
  // The card's own Delete button: the dialog's opener. Not read from document.activeElement, which the
  // button loses while it is disabled during the request.
  const deleteButton = Array.from(document.querySelectorAll<HTMLElement>('[data-toot-id]'))
    .find(card => card.dataset.tootId === id)
    ?.querySelector<HTMLElement>('.delete-button');
  // Unless the user moved focus elsewhere meanwhile.
  const active = document.activeElement;
  if (active && active !== document.body && active !== deleteButton && active.isConnected) return;
  // Decided on the outcome, not on the DOM: a deleted card stays in the page while it animates out.
  // A failure keeps the card, so focus goes back to its Delete button; a success, to the list's toggle.
  if (!deleted && deleteButton) deleteButton.focus();
  else listToggle.value?.focus();
}

/**
 * Loads a toot into the composer, then scrolls to and focuses its text.
 * @param {string} id - The ID of the toot to edit.
 */
async function handleEdit(id: string) {
  // One operation at a time: a toot being saved or deleted must not be swapped out of the composer.
  if (store.pendingId !== null) return;
  const toot = store.toots.find(t => t.id === id);
  if (!toot) return;
  store.setEditingToot(toot);

  // Once the composer has rendered the toot.
  await nextTick();
  const textarea = document.querySelector<HTMLTextAreaElement>('textarea[data-toot-text]');
  textarea?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  textarea?.focus({ preventScroll: true });
}

onMounted(() => {
  void store.fetchScheduledToots();
});
</script>

<template>
  <div class="scheduled-toots">
    <h2
      id="scheduled-toots-title"
    >
      <button
        ref="listToggle"
        type="button"
        class="toots-toggle"
        :aria-expanded="isOpen ? 'true' : 'false'"
        aria-controls="scheduled-toots-panel"
        @click="userToggled = !isOpen"
      >
        Scheduled Toots ({{ store.count }})
      </button>
    </h2>
    <!--
      Always in the DOM and outside the collapsible panel, only its content changes: Safari ignores
      an alert inserted already filled, and one inside a hidden panel is not in the accessibility tree.
    -->
    <div role="alert">
      <p
        v-if="store.error && !isFirstLoad"
        class="error"
      >
        {{ store.error }}
      </p>
    </div>
    <div
      v-show="isOpen"
      id="scheduled-toots-panel"
    >
      <div
        v-if="isFirstLoad"
        class="loading"
      >
        Loading scheduled toots...
      </div>

      <!-- After a failed load, "no toots" may be false: the error above says enough. -->
      <div
        v-else-if="store.count === 0 && !store.error"
        class="empty-state"
      >
        No scheduled toots yet.
      </div>

      <div
        v-else-if="store.count > 0"
        class="toots-list"
      >
        <TransitionGroup 
          name="toot-list" 
          tag="div"
          class="toots-list"
        >
          <TootCard
            v-for="toot in store.sortedToots"
            :id="toot.id"
            :key="toot.id"
            :data-toot-id="toot.id"
            :scheduled-at="toot.scheduled_at"
            :text="toot.params?.text"
            :visibility="toot.params?.visibility"
            :language="toot.params?.language"
            :spoiler-text="toot.params?.spoiler_text"
            :sensitive="toot.params?.sensitive"
            :poll="toot.params?.poll"
            :medias="toot.media_attachments"
            :pending-action="store.pendingId === toot.id ? store.pendingAction : null"
            :busy="store.pendingId !== null"
            @edit="handleEdit"
            @delete="handleDeleteRequest"
          />
        </TransitionGroup>
      </div>
    </div>
  </div>

  <ModalView
    :is-open="!!tootToDelete"
    labelled-by="delete-title"
    @close="handleDeleteCancel"
  >
    <DeleteConfirmModal
      :toot-preview="tootDeletePreview"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    />
  </ModalView>
</template>

<style scoped>
.scheduled-toots {
  margin-top: 2rem;
}

h2 {
  margin: 0;
}

.toots-toggle {
  all: unset;
  display: block; /* all: unset makes it inline; width and ::after need a block box */
  box-sizing: border-box;
  position: relative;
  width: 100%;
  padding-right: 2rem;
  cursor: pointer;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.5;
  color: #333;
}

.toots-toggle:focus-visible {
  outline: 2px solid #333;
  outline-offset: 2px;
}

.toots-toggle::after {
  content: '▼';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.8rem;
  color: #666;
  transition: transform 0.2s ease;
}

.toots-toggle[aria-expanded="true"]::after {
  transform: translateY(-50%) rotate(180deg);
}

#scheduled-toots-panel {
  margin-top: 0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .toots-toggle::after {
    transition: none;
  }
}

.loading, .error, .empty-state {
  text-align: center;
  padding: 1rem;
  color: #666;
  background-color: #f5f5f5;
  border-radius: 0.5rem;
}

.error {
  margin: 0.5rem 0 0;
  color: #c0392b;
  background-color: #fde8e7;
  border-radius: 0.5rem;
}

.toots-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Add transition styles */
.toot-list-move,
.toot-list-enter-active,
.toot-list-leave-active {
  transition: all 0.3s ease;
}

.toot-list-enter-from,
.toot-list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.toot-list-leave-active {
  position: absolute;
}

@media (prefers-reduced-motion: reduce) {
  .toot-list-move,
  .toot-list-enter-active,
  .toot-list-leave-active {
    transition: none;
  }
}
</style> 