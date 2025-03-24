<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: string;
  hashtag: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const characterCount = computed(() => props.modelValue.length);
const remainingCharacters = computed(() => 500 - characterCount.value - props.hashtag.length - 1);
</script>

<template>
  <div class="content-area" id="schedule-button">
    <textarea
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      :placeholder="'What\'s on your mind?'"
      required
      :maxlength="500 - hashtag.length - 1"
      rows="4"
    ></textarea>
    <div class="textarea-footer">
      <span class="hashtag">{{ hashtag }}</span>
      <span class="character-count" :class="{ 'near-limit': remainingCharacters < 50 }">
        {{ remainingCharacters }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.content-area {
  margin-bottom: 1rem;
}

textarea {
  width: 100%;
  min-height: 20rem;
  padding: 0.5rem;
  font-size: 1.2rem;
  margin-bottom: 0;
  font-weight: 600;
  resize: vertical;
  border: 1px solid #999;
  border-radius: 0.5rem;
  font-family: inherit;
}

.textarea-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
  padding: 0 0.5rem;
}

.hashtag {
  color: #666;
  font-size: 0.9rem;
}

.character-count {
  font-size: 0.9rem;
  color: #666;
}

.character-count.near-limit {
  color: #ff4136;
}
</style> 