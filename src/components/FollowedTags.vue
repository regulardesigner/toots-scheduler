<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useFollowedTags } from '../composables/useFollowedTags';

const { followedTags, isLoading, error, fetchFollowedTags } = useFollowedTags();


const displayedTags = computed(() => followedTags.value.slice(0, 4));
const remainingTags = computed(() => followedTags.value.slice(4));

const emit = defineEmits<{
  (e: 'select-tag', tagName: string): void
}>();

function handleTagClick(tagName: string, event: Event) {
  event.preventDefault();
  emit('select-tag', tagName);
}

function handleDetailClick(event: Event) {
  const element = event?.target as HTMLDetailsElement;
  console.log('Detail clicked:', element);
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
      <!-- Show remaining tags -->
      <details v-if="remainingTags.length > 0" class="more-tags" @click="handleDetailClick($event)">
        <summary>
          <!-- Show first two filtered tags -->
          <template v-for="tag in displayedTags" :key="tag.name">
            <a 
              class="tag" 
              href="#"
              @click="handleTagClick(tag.name, $event)"
            >
              #{{ tag.name }}
            </a>
          </template>
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

summary > span {
  display: inline-block;
  cursor: pointer;
  color: #666;
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  margin-left: 0.5rem;
  background-color: #f0f0f0;
  border-radius: 1rem;
  user-select: none;
}

summary:hover > span {
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