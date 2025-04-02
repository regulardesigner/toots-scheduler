<script setup lang="ts">
import { onMounted } from 'vue';
import { useMastodonApi } from '../composables/useMastodonApi';
import TootCard from './TootCard.vue';
import { useScheduledTootsStore } from '../stores/scheduledToots';

const api = useMastodonApi();
const store = useScheduledTootsStore();

async function handleDelete(id: string) {
  if (!confirm('Are you sure you want to delete this scheduled toot?')) {
    return;
  }

  try {
    store.setLoading(true);
    await api.deleteScheduledToot(id);
    await store.fetchScheduledToots(); // Refresh the list
  } catch (err) {
    console.error('Error deleting toot:', err);
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
    <details class="toots-details" :open="store.count > 0">
      <summary class="toots-summary">
        <h1>Scheduled Toots ({{ store.count }})</h1>
      </summary>
      
      <div v-if="store.isLoading" class="loading">
        Loading scheduled toots...
      </div>
      
      <div v-else-if="store.error" class="error">
        {{ store.error }}
      </div>
      
      <div v-else-if="store.count === 0" class="empty-state">
        No scheduled toots yet.
      </div>
      
      <div v-else class="toots-list">
        <TransitionGroup 
          name="toot-list" 
          tag="div"
          class="toots-list"
        >
          <TootCard
            v-for="toot in store.sortedToots"
            :key="toot.id"
            :id="toot.id"
            :scheduled-at="toot.scheduled_at || ''"
            :text="toot.params?.text"
            :visibility="toot.params?.visibility"
            :language="toot.params?.language"
            :spoiler_text="toot.params?.spoiler_text"
            :sensitive="toot.params?.sensitive"
            :medias="toot.media_attachments"
            :is-loading="store.isLoading"
            :on-delete="handleDelete"
            :on-edit="handleEdit"
          />
        </TransitionGroup>
      </div>
    </details>
  </div>
</template>

<style scoped>
.scheduled-toots {
  margin-top: 2rem;
}

.toots-details {
  width: 100%;
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
  padding-right: 2rem;
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

h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: #333;
  display: inline-block;
}

.loading, .error, .empty-state {
  text-align: center;
  padding: 1rem;
  color: #666;
  background-color: #f5f5f5;
  border-radius: 0.5rem;
}

.error {
  color: #e74c3c;
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