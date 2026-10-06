<script setup lang="ts">
// Constants
const MIN_SCHEDULE_AHEAD_MINUTES = 5;
const DEFAULT_POLL_EXPIRATION_SECONDS = 86400; // 24 hours

import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { useMastodonApi } from '../../composables/useMastodonApi';
import { useAuthStore } from '../../stores/auth';
import { useInstanceStore } from '../../stores/instance';
import { countGraphemes, countTootCharacters } from '../../utils/tootLength';
import { format, addMinutes, isBefore, parseISO } from 'date-fns';
import type { ScheduledToot, MastodonMediaAttachment, PollFormState } from '../../types/mastodon';
import { buildScheduledToot } from '../../utils/buildScheduledToot';
import ScheduledToots from './ScheduledToots.vue';
import { useScheduledTootsStore } from '../../stores/scheduledToots';
import MediaUpload from '../MediaUpload.vue';
import ContentWarning from '../ContentWarning.vue';
import ContentArea from '../ContentArea.vue';
import ControlsBar from '../ControlsBar.vue';
import PollSection from '../Toot/PollSection.vue';

function createEmptyPoll(): PollFormState {
  return {
    options: ['', ''],
    expiresIn: DEFAULT_POLL_EXPIRATION_SECONDS,
    multiple: false,
    hideTotals: false,
  };
}

const auth = useAuthStore();
const instance = useInstanceStore();
const toast = useToast();
const content = ref('');
const scheduledDate = ref('');
const scheduledTime = ref('');
const isSubmitting = ref(false);
const visibility = ref<ScheduledToot['visibility']>('public');
const language = ref('en');
const error = ref('');
const isSensitive = ref(false);
const showMedia = ref(false);
const showPoll = ref(false);
const spoilerText = ref('');
/** The content warning counts toward the limit, in the counter and in the submit check alike. */
const spoilerLength = computed(() => countGraphemes(spoilerText.value));
const mediaAttachments = ref<MastodonMediaAttachment[]>([]);
const pollData = ref<PollFormState>(createEmptyPoll());

const api = useMastodonApi();
const store = useScheduledTootsStore();

/**
 * Idempotency key of the last attempt. Mastodon returns the first result for a key it has
 * seen in the last hour, so the key is reused only for an identical retry (same payload,
 * same edited toot). Any change gets a new key: a possible duplicate is visible and fixable,
 * whereas reusing a key could silently publish stale content or lose an edited toot.
 */
const idempotencyKey = ref(crypto.randomUUID());
let lastAttemptFingerprint: string | null = null;

function idempotencyKeyFor(toot: ScheduledToot): string {
  const fingerprint = JSON.stringify({ editingId: store.editingToot?.id ?? null, toot });
  if (fingerprint !== lastAttemptFingerprint) {
    idempotencyKey.value = crypto.randomUUID();
    lastAttemptFingerprint = fingerprint;
  }
  return idempotencyKey.value;
}

function handleShowMedia() {
  showMedia.value = !showMedia.value;
}

function handleShowPoll() {
  showPoll.value = !showPoll.value;
  // A closed poll section means no poll: drop what was typed so it can't be sent later.
  if (!showPoll.value) {
    pollData.value = createEmptyPoll();
  }
}

// Watch for editing toot changes
watch(() => store.editingToot, (newToot) => {
  if (newToot) {
    content.value = newToot.params?.text || '';
    
    // Parse the scheduled date and time
    if (newToot.scheduled_at) {
      const date = parseISO(newToot.scheduled_at);
      scheduledDate.value = format(date, 'yyyy-MM-dd');
      scheduledTime.value = format(date, 'HH:mm');
    }
    
    visibility.value = newToot.params?.visibility as ScheduledToot['visibility'] || 'public';
    language.value = newToot.params?.language || 'en';
    isSensitive.value = newToot.params?.sensitive || false;
    spoilerText.value = newToot.params?.spoiler_text || '';
    mediaAttachments.value = newToot.media_attachments || [];

    // Show media section if there are media attachments
    showMedia.value = newToot.media_attachments?.length > 0;

    const poll = newToot.params?.poll;
    if (poll) {
      showPoll.value = true;
      pollData.value = {
        options: poll.options || [],
        expiresIn: Number(poll.expires_in) || DEFAULT_POLL_EXPIRATION_SECONDS,
        multiple: poll.multiple || false,
        hideTotals: poll.hide_totals || false
      };
    } else {
      showPoll.value = false;
      pollData.value = createEmptyPoll();
    }
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
  showMedia.value = false;
  showPoll.value = false;
  pollData.value = createEmptyPoll();
  lastAttemptFingerprint = null;
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
  // Ignore resubmissions (double click, Enter key) while a request is in flight.
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  // Clear and wait a tick so an identical message is inserted again and announced again.
  error.value = '';
  await nextTick();

  try {
    // The instance would refuse it: say why before sending (e.g. an edited toot longer than the limit).
    // Only against limits the instance gave: the defaults are guesses and must not block anything.
    if (instance.isLoaded) {
      const length = countTootCharacters(content.value) + spoilerLength.value;
      if (length > instance.maxCharacters) {
        error.value = `Your toot is ${length} characters long, but your instance allows ${instance.maxCharacters}.`;
        return;
      }
      if (mediaAttachments.value.length > instance.maxMediaAttachments) {
        error.value = `This toot has ${mediaAttachments.value.length} images, but your instance allows ${instance.maxMediaAttachments}.`;
        return;
      }
    }

    // Validate scheduled time
    const scheduledDateTime = new Date(`${scheduledDate.value}T${scheduledTime.value}`);
    const minTime = addMinutes(new Date(), MIN_SCHEDULE_AHEAD_MINUTES);
    
    if (isBefore(scheduledDateTime, minTime)) {
      error.value = `Please schedule the toot at least ${MIN_SCHEDULE_AHEAD_MINUTES} minutes in the future.`;
      return;
    }

    const toot = buildScheduledToot({
      content: content.value,
      scheduledAt: scheduledDateTime,
      visibility: visibility.value,
      language: language.value,
      isSensitive: isSensitive.value,
      spoilerText: spoilerText.value,
      mediaIds: mediaAttachments.value.map(media => media.id),
      showPoll: showPoll.value,
      poll: pollData.value,
    });

    const key = idempotencyKeyFor(toot);

    if (store.editingToot) {
      // updateToot refreshes the list and leaves edit mode itself.
      const result = await store.updateToot(store.editingToot, toot, key);
      if (!result.previousVersionRemoved) {
        toast.warning('Your toot was updated, but the previous version could not be removed. Please delete it from the list.');
      }
    } else {
      await api.scheduleToot(toot, key);
      await store.fetchScheduledToots();
    }

    resetForm();
    
  } catch (err) {
    console.error('Error scheduling toot:', err);
    error.value = err instanceof Error ? err.message : 'Failed to schedule toot. Please try again.';
    // The request may have reached the instance despite the error: refresh so any created toot shows up.
    void store.fetchScheduledToots();
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="toot-composer">
    <form @submit.prevent="handleSubmit">
      <div
        v-if="auth.account"
        class="user-info"
      >
        <div class="user-details">
          <img
            v-if="auth.account?.avatar"
            :src="auth.account?.avatar"
            :alt="auth.account?.display_name"
            class="user-avatar"
          >
          <div>
            <div class="user-name">
              {{ auth.account?.display_name }}
            </div>
            <div class="user-handle">
              @{{ auth.account?.acct }}
            </div>
          </div>
        </div>
        <div class="scheduled-count">
          {{ store.count }} scheduled
        </div>
      </div>

      <ContentWarning
        v-model="isSensitive"
        v-model:spoiler-text="spoilerText"
      />

      <ContentArea
        v-model="content"
        :has-poll="showPoll && pollData.options.some(option => option.trim() !== '')"
        :has-media="mediaAttachments.length > 0"
        :show-media="showMedia"
        :show-poll="showPoll"
        :extra-characters="spoilerLength"
        @add-media="handleShowMedia"
        @add-poll="handleShowPoll"
      />

      <MediaUpload
        v-if="showMedia"
        v-model="mediaAttachments"
      />

      <PollSection
        v-if="showPoll"
        v-model="pollData"
      />

      <ControlsBar
        v-model:scheduled-date="scheduledDate"
        v-model:scheduled-time="scheduledTime"
        v-model:visibility="visibility"
        v-model:language="language"
        :is-editing="!!store.editingToot"
        :is-submitting="isSubmitting"
        @cancel="handleCancelEdit"
      />

      <p
        v-if="error"
        class="error"
        role="alert"
      >
        {{ error }}
      </p>
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
  color: #c0392b;
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