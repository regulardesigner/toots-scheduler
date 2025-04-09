<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const characterCount = computed(() => props.modelValue.length);
const remainingCharacters = computed(() => 500 - characterCount.value);
</script>

<template>
  <div class="content-area" id="schedule-button">
    <textarea
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      :placeholder="'What\'s on your mind?'"
      required
      :maxlength="500"
      rows="4"
    ></textarea>
    <div class="textarea-footer">
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
  justify-content: end;
  align-items: center;
  padding: 0 0.5rem;
}

.character-count {
  font-size: .875rem;
  color: #666;
}

.character-count.near-limit {
  color: #ff4136;
}
</style> 