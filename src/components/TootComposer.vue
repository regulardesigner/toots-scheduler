<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useMastodonApi } from '../composables/useMastodonApi';
import { useAuthStore } from '../stores/auth';
import { format, addMinutes, isBefore, parseISO } from 'date-fns';
import type { ScheduledToot, MastodonMediaAttachment } from '../types/mastodon';
import ScheduledToots from './ScheduledToots.vue';
import { useScheduledTootsStore } from '../stores/scheduledToots';
import MediaUpload from './MediaUpload.vue';
import ContentWarning from './ContentWarning.vue';
import ContentArea from './ContentArea.vue';
import ControlsBar from './ControlsBar.vue';

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
const mediaAttachments = ref<MastodonMediaAttachment[]>([]);
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
  mediaAttachments.value = [];
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
        media_ids: mediaAttachments.value.map(media => media.id),
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
        media_ids: mediaAttachments.value.map(media => media.id),
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
          {{ store.count }} scheduled
        </div>
      </div>

      <ContentWarning
        v-model="isSensitive"
        v-model:spoilerText="spoilerText"
      />
      
      <MediaUpload
        v-model="mediaAttachments"
      />

      <ContentArea
        v-model="content"
        :hashtag="HASHTAG"
      />

      <ControlsBar
        v-model:scheduledDate="scheduledDate"
        v-model:scheduledTime="scheduledTime"
        v-model:visibility="visibility"
        v-model:language="language"
        :isEditing="!!store.editingToot"
        @cancel="handleCancelEdit"
      />

      <p v-if="error" class="error">{{ error }}</p>
    </form>

    <ScheduledToots />
  </div>
</template>

<style scoped>
.toot-composer {
  max-width: 600px;
  margin: 3.4rem auto 2rem;;
  padding: 0 0.5rem;
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
  font-size: 0.9rem;
  color: #333;
  background-color: rgb(236, 236, 236);
  padding: 0.5rem 1rem;
  border-radius: 4px;
}

.error {
  color: #e74c3c;
  margin: 1rem 0;
  padding: 0.5rem;
  border-radius: 4px;
  background-color: #fde8e7;
}

@media (max-width: 768px) {
  .toot-composer {
    padding: 0.5rem;
  }
}
</style> 