<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMastodonApi } from '../composables/useMastodonApi';
import { useAuthStore } from '../stores/auth';
import { addMinutes, format } from 'date-fns';
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

const api = useMastodonApi();
const store = useScheduledTootsStore();

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
  const minDate = addMinutes(now, 5);
  return format(minDate, "yyyy-MM-dd'T'HH:mm");
});

const characterCount = computed(() => content.value.length);
const remainingCharacters = computed(() => 500 - characterCount.value);

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

    // Prepare the scheduled datetime
    const scheduledAt = new Date(`${scheduledDate.value}T${scheduledTime.value}`).toISOString();

    // Create the toot
    const toot: ScheduledToot = {
      status: content.value,
      scheduled_at: scheduledAt,
      visibility: visibility.value,
      language: language.value,
      sensitive: isSensitive.value,
      spoiler_text: isSensitive.value ? spoilerText.value : undefined,
    };

    await api.scheduleToot(toot);
    
    // Reset form
    content.value = '';
    scheduledDate.value = '';
    scheduledTime.value = '';
    error.value = '';
    isSensitive.value = false;
    spoilerText.value = '';
    
    // Refresh scheduled toots count
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
          <img :src="auth.account.avatar" :alt="auth.account.display_name" class="user-avatar" />
          <div>
            <div class="user-name">{{ auth.account.display_name }}</div>
            <div class="user-handle">@{{ auth.account.acct }}</div>
          </div>
        </div>
        <div class="scheduled-count">
          {{ store.count }} scheduled
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
            Content warning
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

      <div class="content-area">
        <textarea
          v-model="content"
          placeholder="What's on your mind?"
          :maxlength="500"
          required
        ></textarea>
        <div class="character-count">
          {{ remainingCharacters }} characters remaining
        </div>
      </div>

      <div class="controls-bar">
        <div class="form-group">
          <label for="scheduled-date">Date</label>
          <input
            id="scheduled-date"
            type="date"
            v-model="scheduledDate"
            :min="format(new Date(), 'yyyy-MM-dd')"
            required
          />
        </div>

        <div class="form-group">
          <label for="scheduled-time">Time</label>
          <input
            id="scheduled-time"
            type="time"
            v-model="scheduledTime"
            :min="minDateTime"
            required
          />
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

      <button
        type="submit"
        :disabled="isSubmitting || !content || !scheduledDate || !scheduledTime"
      >
        {{ isSubmitting ? 'Scheduling...' : 'Schedule Toot' }}
      </button>
    </form>
    
    <ScheduledToots />
  </div>
</template>

<style scoped>
.toot-composer {
  max-width: 600px;
  margin: 2rem auto;
  padding: 1rem;
}

.content-area {
  margin-bottom: 1rem;
}

textarea {
  width: 100%;
  min-height: 150px;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
}

.character-count {
  color: #666;
  font-size: 0.9rem;
}

.controls-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #f8f8f8;
  border-radius: 4px;
}

.form-group {
  flex: 1;
  min-width: 0; /* Prevents flex items from overflowing */
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #666;
}

input, select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
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
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background-color: #d0d0d0;
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
  background-color: #f8f8f8;
  border-radius: 4px;
}

.content-warning .form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.warning-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: #666;
  font-size: 0.9rem;
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

.user-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: #f8f8f8;
  border-radius: 4px;
}

.user-details {
  display: flex;
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
  border-radius: 4px;
  object-fit: cover;
}

.user-name {
  font-weight: 500;
  color: #333;
}

.user-handle {
  font-size: 0.9rem;
  color: #666;
}

.scheduled-count {
  font-size: 0.9rem;
  color: #666;
  background-color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: 1px solid #ddd;
}
</style> 