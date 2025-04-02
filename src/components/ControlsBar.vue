<script setup lang="ts">
import { computed } from 'vue';
import { format, addMinutes } from 'date-fns';
import type { ScheduledToot } from '../types/mastodon';

const props = defineProps<{
  scheduledDate: string;
  scheduledTime: string;
  visibility: ScheduledToot['visibility'];
  language: string;
  isEditing: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:scheduledDate', value: string): void;
  (e: 'update:scheduledTime', value: string): void;
  (e: 'update:visibility', value: ScheduledToot['visibility']): void;
  (e: 'update:language', value: string): void;
  (e: 'cancel'): void;
}>();

const minDateTime = computed(() => {
  const now = new Date();
  const minDate = addMinutes(now, 5); // Minimum 5 minutes in the future
  return format(minDate, "yyyy-MM-dd'T'HH:mm");
});

const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
] as const;
</script>

<template>
  <div class="controls-bar">
    <div class="form-group">
      <label for="scheduled-date">Date</label>
      <input
        id="scheduled-date"
        type="date"
        :value="scheduledDate"
        @input="emit('update:scheduledDate', ($event.target as HTMLInputElement).value)"
        :min="minDateTime.split('T')[0]"
        required
      />
    </div>
    <div class="form-group">
      <label for="scheduled-time">Time</label>
      <input
        id="scheduled-time"
        type="time"
        :value="scheduledTime"
        @input="emit('update:scheduledTime', ($event.target as HTMLInputElement).value)"
        required
      />
    </div>
    <div class="form-group">
      <label for="visibility">Visibility</label>
      <select
        id="visibility"
        :value="visibility"
        @change="emit('update:visibility', ($event.target as HTMLSelectElement).value as ScheduledToot['visibility'])"
      >
        <option value="public">Public</option>
        <option value="unlisted">Unlisted</option>
        <option value="private">Followers only</option>
        <option value="direct">Direct message</option>
      </select>
    </div>
    <div class="form-group">
      <label for="language">Language</label>
      <select
        id="language"
        :value="language"
        @change="emit('update:language', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="lang in languages" :key="lang.code" :value="lang.code">
          {{ lang.name }}
        </option>
      </select>
    </div>
  </div>
  <div class="form-actions">
    <button
      v-if="isEditing"
      type="button"
      class="cancel-button"
      @click="emit('cancel')"
    >
      Cancel
    </button>
    <button
      type="submit"
      :class="{ 'edit-mode': isEditing }"
    >
      {{ isEditing ? 'Update' : 'Schedule' }}
    </button>
  </div>
</template>

<style scoped>
.controls-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #f8f8f8;
  border-radius: .5rem;
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 0.9rem;
  color: #666;
}

input, select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #333;
  border-radius: 4px;
  font-size: 0.9rem;
  background-color: white;
}

input#scheduled-date, input#scheduled-time, input#visibility, input#language {
  height: 2.2rem;
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.form-actions button {
  background-color: #333;
  color: white;
  border: none;
  padding: 0.8rem 1rem;
  border-radius: 3rem;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background-color 0.3s ease;
  width: 100%;
}

.form-actions button:hover {
  background-color: #222;
}

.form-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-button {
  background-color: #95a5a6;
  color: white;
}

.cancel-button:hover:not(:disabled) {
  background-color: #7f8c8d;
}

button.edit-mode {
  background-color: #2b90d9;
  color: white;
}

button.edit-mode:hover:not(:disabled) {
  background-color: #2577b1;
}

@media (max-width: 768px) {
  .controls-bar {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .form-group {
    margin: 0.5rem 0;
    flex-basis: 40%;
  }

  .form-actions {
    flex-direction: column;
  }
  
  .cancel-button,
  button[type="submit"] {
    width: 100%;
  }
}
</style> 