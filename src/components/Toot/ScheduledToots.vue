<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMastodonApi } from '../../composables/useMastodonApi';
import TootCard from './TootCard.vue';
import ModalView from '../Modals/ModalView.vue';
import DeleteConfirmModal from '../Modals/DeleteConfirmModal.vue';
import { useScheduledTootsStore } from '../../stores/scheduledToots';
import type { MastodonStatus } from '../../types/mastodon';

const PREVIEW_MAX_LENGTH = 120;

const api = useMastodonApi();
const store = useScheduledTootsStore();

/** The toot pending deletion, or null when no confirmation is open. */
const tootToDelete = ref<MastodonStatus | null>(null);

/** Truncated preview text shown inside the confirmation modal. */
const tootDeletePreview = ref('');

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
 * Confirms the deletion of the pending toot and refreshes the list.
 */
async function handleDeleteConfirm() {
  if (!tootToDelete.value) return;
  const id = tootToDelete.value.id;
  handleDeleteCancel();

  try {
    store.setLoading(true);
    await api.deleteScheduledToot(id);
    await store.fetchScheduledToots();
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to delete toot');
  } finally {
    store.setLoading(false);
  }
}

function handleEdit(id: string) {
  const toot = store.toots.find(t => t.id === id);
  if (toot) {
    store.setEditingToot(toot);

    
    // Scroll to textarea after a short delay to ensure the content is rendered
    setTimeout(() => {
      document.querySelector('.content-area textarea')?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center'
      });
    }, 100);
  }
}

onMounted(() => {
  store.fetchScheduledToots();
});
</script>

<template>
  <div class="scheduled-toots">
    <!-- Outside <summary>, whose children may lose their heading role; the summary is drawn over this row. -->
    <h2
      id="scheduled-toots-title"
      tabindex="-1"
    >
      Scheduled Toots ({{ store.count }})
    </h2>
    <details
      class="toots-details"
      :open="store.count > 0 || !!store.error"
    >
      <summary class="toots-summary">
        <span class="visually-hidden">Show or hide the scheduled toots</span>
      </summary>
      
      <div
        v-if="store.isLoading"
        class="loading"
      >
        Loading scheduled toots...
      </div>
      
      <div
        v-else-if="store.error"
        class="error"
        role="alert"
      >
        {{ store.error }}
      </div>
      
      <div
        v-else-if="store.count === 0"
        class="empty-state"
      >
        No scheduled toots yet.
      </div>
      
      <div
        v-else
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
            :scheduled-at="toot.scheduled_at || ''"
            :text="toot.params?.text"
            :visibility="toot.params?.visibility"
            :language="toot.params?.language"
            :spoiler_text="toot.params?.spoiler_text"
            :sensitive="toot.params?.sensitive"
            :poll="toot.params?.poll"
            :medias="toot.media_attachments"
            :is-loading="store.isLoading"
            :on-delete="handleDeleteRequest"
            :on-edit="handleEdit"
          />
        </TransitionGroup>
      </div>
    </details>
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

.toots-details {
  width: 100%;
  /* Pulls the summary up over the heading row (2.25rem = h2 line height). */
  margin-top: -2.25rem;
}

.toots-summary {
  cursor: pointer;
  list-style: none;
}

.toots-summary::-webkit-details-marker {
  display: none;
}

.toots-summary {
  position: relative;
  height: 2.25rem;
  padding-right: 2rem;
}

.toots-summary:focus-visible {
  outline: 2px solid #333;
  outline-offset: 2px;
}

.toots-summary::after {
  content: '▼';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.8rem;
  color: #666;
  transition: transform 0.2s ease;
}

.toots-details[open] .toots-summary::after {
  transform: translateY(-50%) rotate(180deg);
}

h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: #333;
  display: block;
  padding-right: 2rem;
}

h2:focus {
  outline: none;
}

.toots-details > :not(summary) {
  margin-top: 0.5rem;
}

.loading, .error, .empty-state {
  text-align: center;
  padding: 1rem;
  color: #666;
  background-color: #f5f5f5;
  border-radius: 0.5rem;
}

.error {
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
</style> 