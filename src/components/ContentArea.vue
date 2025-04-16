<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  modelValue: string;
  hasPoll: boolean;
  hasMedia: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'add-media'): void;
  (e: 'add-poll'): void;
}>();

const characterCount = computed(() => props.modelValue.length);
const remainingCharacters = computed(() => 500 - characterCount.value);

const isMediaChecked = ref(false);
const isPollChecked = ref(false);

function handleMediaCheckboxChange(event: Event) {
  const target = event.target as HTMLInputElement;
  isMediaChecked.value = target.checked;
  
  emit('add-media');

  if (target.checked) {
    isPollChecked.value = false; // Uncheck poll if media is checked
  }
}

function handlePollCheckboxChange(event: Event) {
  const target = event.target as HTMLInputElement;
  isPollChecked.value = target.checked;

  emit('add-poll');

  if (target.checked) {
    isMediaChecked.value = false; // Uncheck media if poll is checked
  }
}

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
    />
    <div class="media-poll-controls">
      <input 
        type="checkbox" 
        name="media-or-poll" 
        id="media" 
        value="media" 
        aria-label="Upload media" 
        @click="handleMediaCheckboxChange" 
        v-model="isMediaChecked" 
        :disabled="isPollChecked || hasPoll" 
      />
      <input 
        type="checkbox" 
        name="media-or-poll" 
        id="poll" 
        value="poll" 
        aria-label="Add a poll" 
        @click="handlePollCheckboxChange" 
        v-model="isPollChecked" 
        :disabled="isMediaChecked || hasMedia"
      />
    </div>
    <div class="textarea-footer">
      <span class="character-count" :class="{ 'near-limit': remainingCharacters < 50 }">
        {{ remainingCharacters }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.content-area {
  position: relative;
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

.media-poll-controls {
  bottom: 2rem;
  left: 0.3rem;
  position: absolute;
  display: flex;
  gap: 0.2rem;
}

input#media,
input#poll {
  outline-offset: -1px;
  appearance: none;
  cursor: pointer;
  width: 1.6rem;
  height: 1.6rem;
  opacity: 0.8;
}

input[type="checkbox"]#media:disabled,
input[type="checkbox"]#poll:disabled {
  cursor: not-allowed;
  background-color: #f0f0f0;
  border-color: #ccc;
  opacity: 0.4;
}

input[type="checkbox"]#media {
  background-image: url('@/assets/add-images.svg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

input[type="checkbox"]#poll {
  background-image: url('@/assets/add-poll-h.svg');
  background-size: 76%;
  background-position: center;
  background-repeat: no-repeat;
}
input[type="checkbox"]#media:checked {
  opacity: 1;
}
</style> 