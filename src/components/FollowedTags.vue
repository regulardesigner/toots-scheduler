<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useFollowedTags } from '../composables/useFollowedTags';

const { followedTags, isLoading, error, fetchFollowedTags } = useFollowedTags();

// Filter out TootScheduler and sort tags alphabetically
const filteredTags = computed(() => 
  followedTags.value
    .filter(tag => tag.name.toLowerCase() !== 'tootscheduler')
    .sort((a, b) => a.name.localeCompare(b.name))
);

const firstTwoTags = computed(() => filteredTags.value.slice(0, 2));
const remainingTags = computed(() => filteredTags.value.slice(2));

const emit = defineEmits<{
  (e: 'select-tag', tagName: string): void
}>();

function handleTagClick(tagName: string, event: Event) {
  event.preventDefault();
  emit('select-tag', tagName);
}

onMounted(() => {
  fetchFollowedTags();
});
</script>

<template>
  <div class="followed-tags">
    <div v-if="isLoading">Loading...</div>
    <div v-else-if="error">{{ error }}</div>
    <div v-else-if="followedTags.length === 0">No followed hashtags</div>
    <div v-else class="tags-container">
      <!-- Always show TootScheduler first as non-clickable -->
      <span class="tag default-tag">#TootScheduler</span>
      
      <!-- Show first two filtered tags -->
      <template v-for="tag in firstTwoTags" :key="tag.name">
        <a 
          class="tag" 
          href="#"
          @click="handleTagClick(tag.name, $event)"
        >
          #{{ tag.name }}
        </a>
      </template>

      <!-- Show remaining tags -->
      <details v-if="remainingTags.length > 0" class="more-tags">
        <summary>
          <span class="more-count">+{{ remainingTags.length }} more</span>
        </summary>
        <div class="tags-list">
          <a 
            v-for="tag in remainingTags" 
            :key="tag.name" 
            class="tag"
            href="#"
            @click="handleTagClick(tag.name, $event)"
          >
            #{{ tag.name }}
          </a>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.followed-tags {
  margin: 1rem 0;
  font-size: 0.9rem;
  color: #666;
}

.tags-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tag {
  color: #2b90d9;
  text-decoration: none;
  cursor: pointer;
}

.tag:hover {
  text-decoration: underline;
}

.default-tag {
  color: #666;
  cursor: default;
}

.default-tag:hover {
  text-decoration: none;
}

.more-tags {
  display: inline;
}

summary {
  display: inline-block;
  cursor: pointer;
  color: #666;
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  background-color: #f0f0f0;
  border-radius: 1rem;
  user-select: none;
}

summary:hover {
  background-color: #e0e0e0;
}

.tags-list {
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Remove the default disclosure triangle */
summary::-webkit-details-marker {
  display: none;
}

/* For Firefox */
summary {
  list-style: none;
}
</style> 