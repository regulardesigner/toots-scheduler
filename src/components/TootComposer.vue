<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useMastodonApi } from '../composables/useMastodonApi';
import { useAuthStore } from '../stores/auth';
import { format, addMinutes, isBefore, parseISO } from 'date-fns';
import type { ScheduledToot } from '../types/mastodon';
import ScheduledToots from './ScheduledToots.vue';
import { useScheduledTootsStore } from '../stores/scheduledToots';

const auth = useAuthStore();
const content = ref('');
const scheduledDate = ref('');
const scheduledTime = ref('');
const isSubmitting = ref(false);
const visibility = ref<ScheduledToot['visibility']>('public');
const language = ref('en');
const error = ref('');
const isSensitive = ref(false);
const spoilerText = ref('');
const HASHTAG = '#TootScheduler';

const api = useMastodonApi();
const store = useScheduledTootsStore();

// Watch for editing toot changes
watch(() => store.editingToot, (newToot) => {
  if (newToot) {
    // Remove the hashtag from the content if it exists
    content.value = (newToot.params?.text || '').replace(` ${HASHTAG}`, '');
    
    // Parse the scheduled date and time
    if (newToot.scheduled_at) {
      const date = parseISO(newToot.scheduled_at);
      scheduledDate.value = format(date, 'yyyy-MM-dd');
      scheduledTime.value = format(date, 'HH:mm');
    }
    
    visibility.value = newToot.params?.visibility as ScheduledToot['visibility'] || 'public';
    language.value = newToot.language || 'en';
    isSensitive.value = newToot.params?.sensitive || false;
    spoilerText.value = newToot.params?.spoiler_text || '';
  }
}, { immediate: true });

function resetForm() {
  content.value = '';
  scheduledDate.value = '';
  scheduledTime.value = '';
  error.value = '';
  isSensitive.value = false;
  spoilerText.value = '';
  visibility.value = 'public';
  language.value = 'en';
}

function handleCancelEdit() {
  store.setEditingToot(null);
  resetForm();
}

onMounted(async () => {
  console.log('Initial auth account:', auth.account);
  if (!auth.account && auth.accessToken) {
    try {
      const accountData = await api.verifyCredentials();
      auth.setAccount(accountData);
      console.log('Fetched account:', accountData);
    } catch (err) {
      console.error('Error fetching user info:', err);
    }
  }
  await store.fetchScheduledToots();
});

const minDateTime = computed(() => {
  const now = new Date();
  const minDate = addMinutes(now, 5); // Minimum 5 minutes in the future
  return format(minDate, "yyyy-MM-dd'T'HH:mm");
});

const characterCount = computed(() => content.value.length);
const remainingCharacters = computed(() => 500 - characterCount.value - HASHTAG.length - 1);

// Add validation for the selected date/time
const isValidScheduledTime = computed(() => {
  if (!scheduledDate.value || !scheduledTime.value) return false;
  const selectedDateTime = new Date(`${scheduledDate.value}T${scheduledTime.value}`);
  const minTime = addMinutes(new Date(), 5);
  return !isBefore(selectedDateTime, minTime);
});

// Common languages used in Mastodon
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

async function handleSubmit() {
  try {
    error.value = '';
    isSubmitting.value = true;

    // Validate scheduled time
    const scheduledDateTime = new Date(`${scheduledDate.value}T${scheduledTime.value}`);
    const minTime = addMinutes(new Date(), 5);
    
    if (isBefore(scheduledDateTime, minTime)) {
      error.value = 'Please schedule the toot at least 5 minutes in the future.';
      return;
    }

    // Create the toot with hashtag
    const tootContent = content.value.trim() + ' ' + HASHTAG;

    if (store.editingToot) {
      // Create a new ScheduledToot object for updating
      const updatedToot: ScheduledToot = {
        status: tootContent,
        scheduled_at: scheduledDateTime.toISOString(),
        visibility: visibility.value,
        language: language.value,
        sensitive: isSensitive.value,
        spoiler_text: isSensitive.value ? spoilerText.value : undefined,
      };
      
      await store.updateToot(store.editingToot.id, updatedToot);
    } else {
      // Create the toot
      const toot: ScheduledToot = {
        status: tootContent,
        scheduled_at: scheduledDateTime.toISOString(),
        visibility: visibility.value,
        language: language.value,
        sensitive: isSensitive.value,
        spoiler_text: isSensitive.value ? spoilerText.value : undefined,
      };

      await api.scheduleToot(toot);
    }
    
    // Reset form and refresh toots
    resetForm();
    store.setEditingToot(null);
    await store.fetchScheduledToots();
    
  } catch (err) {
    console.error('Error scheduling toot:', err);
    error.value = err instanceof Error ? err.message : 'Failed to schedule toot. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="toot-composer">
    <form @submit.prevent="handleSubmit">
      <div class="user-info" v-if="auth.account">
        <div class="user-details">
          <img :src="auth.account?.avatar" :alt="auth.account?.display_name" class="user-avatar" />
          <div>
            <div class="user-name">{{ auth.account?.display_name }}</div>
            <div class="user-handle">@{{ auth.account?.acct }}</div>
          </div>
        </div>
        <div class="scheduled-count">
          {{ store.count }} scheduled <span v-if="store.todayTootsCount > 0" class="today-count">({{ store.todayTootsCount }} today)</span>
        </div>
      </div>

      <div class="content-warning">
        <div class="form-group">
          <label for="sensitive-toggle" class="warning-label">
            <input
              type="checkbox"
              v-model="isSensitive"
              id="sensitive-toggle"
            />
            Add content warning
          </label>
          <div class="warning-input-wrapper" v-show="isSensitive">
            <input
              type="text"
              v-model="spoilerText"
              placeholder="Write your warning here"
              id="spoiler-text"
            />
          </div>
        </div>
      </div>

      <div class="content-area" id="schedule-button">
        <textarea
          v-model="content"
          :placeholder="'What\'s on your mind?'"
          required
          :maxlength="500 - HASHTAG.length - 1"
          rows="4"
        >
        </textarea>
        <div class="textarea-footer">
          <span class="hashtag">{{ HASHTAG }}</span>
          <span class="character-count" :class="{ 'near-limit': remainingCharacters < 50 }">
            {{ remainingCharacters }}
          </span>
        </div>
      </div>

      <div class="controls-bar">
        <div class="form-group">
          <label for="scheduled-date">Date</label>
          <input
            id="scheduled-date"
            type="date"
            v-model="scheduledDate"
            :min="minDateTime.split('T')[0]"
            required
          />
        </div>

        <div class="form-group">
          <label for="scheduled-time">Time</label>
          <input
            id="scheduled-time"
            type="time"
            v-model="scheduledTime"
            required
          />
          <small v-if="!isValidScheduledTime && (scheduledDate && scheduledTime)" class="time-warning">
            Must be at least 5 minutes in the future
          </small>
        </div>

        <div class="form-group">
          <label for="visibility">Visibility</label>
          <select id="visibility" v-model="visibility" required>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
            <option value="direct">Direct</option>
          </select>
        </div>

        <div class="form-group">
          <label for="language">Language</label>
          <select id="language" v-model="language" required>
            <option v-for="lang in languages" :key="lang.code" :value="lang.code">
              {{ lang.name }}
            </option>
          </select>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="form-actions">
        <button
          v-if="store.editingToot"
          type="button"
          class="cancel-button"
          @click="handleCancelEdit"
        >
          Cancel Edit
        </button>
        <button
          type="submit"
          :class="{ 'edit-mode': store.editingToot }"
          :disabled="isSubmitting || !content.trim() || !isValidScheduledTime"
        >
          {{ isSubmitting 
            ? (store.editingToot ? 'Updating...' : 'Scheduling...') 
            : (store.editingToot ? 'Update Toot' : 'Schedule Toot') 
          }}
        </button>
      </div>
    </form>
    
    <ScheduledToots />
  </div>
</template>

<style scoped>
.toot-composer {
  max-width: 600px;
  width: 100%;
  margin: 3.4rem auto 2rem;
  padding: 0 0.5rem;
}

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
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  color: #666;
}

.hashtag {
  color: #2b90d9;
  font-size: 0.875rem;
}

.character-count {
  color: #666;
}

.character-count.near-limit {
  font-weight: 700;
  color: #ff4136;
}

.controls-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #f8f8f8;
  border-radius: 0.5rem;
}

.form-group {
  flex: 1;
  min-width: 0; /* Prevents flex items from overflowing */
}

.form-group label {
  display: block;
  font-weight: 700;
  margin-bottom: 0.5rem;
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

button {
  width: 100%;
  padding: 0.75rem;
  background-color: #e0e0e0;
  color: #333;
  border: none;
  border-radius: 3rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background-color: #333;
  color: white;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: #e74c3c;
  margin: 1rem 0;
  padding: 0.5rem;
  border-radius: 4px;
  background-color: #fde8e7;
}

@media (max-width: 768px) {
  .controls-bar {
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group {
    margin: 0.5rem 0;
  }
}

.content-warning {
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: antiquewhite;
  border-radius: 0.5rem;
}

.content-warning .form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.warning-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #333;
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0 !important;
}

.warning-label input[type="checkbox"] {
  width: auto;
  margin: 0;
  cursor: pointer;
}

.warning-input-wrapper {
  transition: all 0.2s ease-in-out;
  overflow: hidden;
  opacity: 1;
  max-height: 40px; /* Approximate height of input */
}

.warning-input-wrapper[style*="display: none"] {
  opacity: 0;
  max-height: 0;
}

input[type="text"]:disabled {
  background-color: #f0f0f0;
  cursor: not-allowed;
}

input#scheduled-date, input#scheduled-time, input#visibility, input#language {
  height: 2.2rem;
}

.user-info {
  margin-top: 3rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: #333;
  border-radius: 0.5rem;
}

.user-details {
  display: flex;
  color: white;
  align-items: center;
  gap: 1rem;
}

.user-details > div {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 2.2rem;
  object-fit: cover;
}

.user-name {
  font-weight: 700;
  color: white;
}

.user-handle {
  font-size: 0.9rem;
  color: lightgray;
}

.scheduled-count {
  display: flex;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #333;
  background-color: rgb(236, 236, 236);
  padding: 0.5rem;
  border-radius: 4px;
}

.today-count {
  display: flex;
  color: white;
  font-weight: 700;
  justify-content: center;
  font-size: smaller;
  align-items: center;
  border-radius: 1rem;
  background: #FF9200;
  padding: 0 0.5rem;
}

.time-warning {
  display: block;
  color: #ff4136;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
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
  .form-actions {
    flex-direction: column;
  }
  
  .cancel-button,
  button[type="submit"] {
    width: 100%;
  }
}
</style> 