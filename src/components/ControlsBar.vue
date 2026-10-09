<script setup lang="ts">
import { computed } from 'vue';
import { format, addMinutes } from 'date-fns';
import type { ScheduledToot } from '../types/mastodon';
import { getTimeZone } from '../utils/timeZone';
import { LANGUAGES } from '../config/constants';

const props = withDefaults(defineProps<{
  scheduledDate: string;
  scheduledTime: string;
  visibility: ScheduledToot['visibility'];
  language: string;
  isEditing: boolean;
  isSubmitting?: boolean;
}>(), {
  isSubmitting: false,
});

const emit = defineEmits<{
  (e: 'update:scheduledDate', value: string): void;
  (e: 'update:scheduledTime', value: string): void;
  (e: 'update:visibility', value: ScheduledToot['visibility']): void;
  (e: 'update:language', value: string): void;
  (e: 'cancel'): void;
}>();

const submitLabel = computed(() => {
  if (props.isSubmitting) return props.isEditing ? 'Updating…' : 'Scheduling…';
  return props.isEditing ? 'Update' : 'Schedule';
});

/** The date and time fields are read in the browser's time zone: say which one. */
const timeZone = getTimeZone();

const minDateTime = computed(() => {
  const now = new Date();
  const minDate = addMinutes(now, 5); // Minimum 5 minutes in the future
  return format(minDate, "yyyy-MM-dd'T'HH:mm");
});
</script>

<template>
  <div class="controls-bar">
    <div class="form-group">
      <label for="scheduled-date">Date</label>
      <input
        id="scheduled-date"
        type="date"
        :value="scheduledDate"
        :min="minDateTime.split('T')[0]"
        aria-describedby="time-zone-hint"
        required
        @input="emit('update:scheduledDate', ($event.target as HTMLInputElement).value)"
      >
    </div>
    <div class="form-group">
      <label for="scheduled-time">Time</label>
      <input
        id="scheduled-time"
        type="time"
        :value="scheduledTime"
        aria-describedby="time-zone-hint"
        required
        @input="emit('update:scheduledTime', ($event.target as HTMLInputElement).value)"
      >
    </div>
    <div class="form-group">
      <label for="visibility">Visibility</label>
      <select
        id="visibility"
        :value="visibility"
        @change="emit('update:visibility', ($event.target as HTMLSelectElement).value as ScheduledToot['visibility'])"
      >
        <option value="public">
          Public
        </option>
        <option value="unlisted">
          Unlisted
        </option>
        <option value="private">
          Followers only
        </option>
        <option value="direct">
          Direct message
        </option>
      </select>
    </div>
    <div class="form-group">
      <label for="language">Language</label>
      <select
        id="language"
        :value="language"
        @change="emit('update:language', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="lang in LANGUAGES"
          :key="lang.code"
          :value="lang.code"
        >
          {{ lang.name }}
        </option>
      </select>
    </div>
    <p
      id="time-zone-hint"
      class="time-zone-hint"
    >
      Time zone: {{ timeZone }}
    </p>
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
      :disabled="isSubmitting"
    >
      {{ submitLabel }}
    </button>
  </div>
</template>

<style scoped>
.controls-bar {
  position: relative;
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

.time-zone-hint {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.9rem;
  color: #666;
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
  background-color: #2577b1;
  color: white;
}

button.edit-mode:hover:not(:disabled) {
  background-color: #2577b1;
  filter: brightness(0.9);
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