<script setup lang="ts">
// The live region speaks when the remaining count reaches one of these steps, never on every keystroke.
const ANNOUNCE_STEPS = [50, 20, 10, 0, -1];

import { computed, ref, watch } from 'vue';
import { useInstanceStore } from '../stores/instance';
import { countTootCharacters } from '../utils/tootLength';

const props = withDefaults(defineProps<{
  modelValue: string;
  hasPoll: boolean;
  hasMedia: boolean;
  /** Whether the composer shows the media section: the toggle reflects it, it never keeps its own state. */
  showMedia: boolean;
  /** Whether the composer shows the poll section. */
  showPoll: boolean;
  /** Characters counted with the text but typed elsewhere (the content warning). */
  extraCharacters?: number;
}>(), { extraCharacters: 0 });

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'add-media'): void;
  (e: 'add-poll'): void;
}>();

const instance = useInstanceStore();

/** The length Mastodon counts (URLs as 23, remote mentions shortened, graphemes). */
const characterCount = computed(() => countTootCharacters(props.modelValue) + props.extraCharacters);
/** Against the instance's own limit (Mastodon's default 500 until it answers). */
const remainingCharacters = computed(() => instance.maxCharacters - characterCount.value);

/**
 * How many steps the remaining count has reached; 0 while far from the limit,
 * and until the instance gave its limit (the default could be wrong).
 */
const announceLevel = computed(() =>
  instance.hasCharacterLimit ? ANNOUNCE_STEPS.filter(step => remainingCharacters.value <= step).length : 0,
);

/** Text of the live region: it changes, and is read, only when a step is reached or left. */
const announcement = ref('');

/** "3 characters left" / "1 character over the limit": the wording of the counter and of the live region. */
function spokenCount(remaining: number): string {
  const count = Math.abs(remaining);
  const characters = count === 1 ? 'character' : 'characters';
  return remaining < 0 ? `${count} ${characters} over the limit` : `${count} ${characters} left`;
}

function describeRemaining(remaining: number): string {
  return remaining === 0 ? 'Character limit reached' : spokenCount(remaining);
}

watch(announceLevel, (level) => {
  announcement.value = level === 0 ? '' : describeRemaining(remainingCharacters.value);
});
</script>

<template>
  <div
    id="schedule-button"
    class="content-area"
  >
    <textarea
      :value="modelValue"
      :placeholder="'What\'s on your mind?'"
      aria-label="Toot text"
      aria-describedby="character-count"
      required
      rows="4"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <div class="media-poll-controls">
      <input
        id="media"
        type="checkbox"
        :checked="showMedia"
        :disabled="showPoll || hasPoll"
        @click="emit('add-media')"
      >
      <label
        for="media"
        class="visually-hidden"
      >Add images</label>
      <input
        id="poll"
        type="checkbox"
        :checked="showPoll"
        :disabled="showMedia || hasMedia"
        @click="emit('add-poll')"
      >
      <label
        for="poll"
        class="visually-hidden"
      >Add a poll</label>
    </div>
    <div class="textarea-footer">
      <span
        id="character-count"
        class="character-count"
        :class="{ 'near-limit': instance.hasCharacterLimit && remainingCharacters < 50 }"
      >
        <span aria-hidden="true">{{ remainingCharacters }}</span><span class="visually-hidden">{{ spokenCount(remainingCharacters) }}</span>
      </span>
      <span
        class="visually-hidden"
        aria-live="polite"
      >{{ announcement }}</span>
    </div>
  </div>
</template>

<style scoped>
.content-area {
  overflow: hidden;
  border: 1px solid #999;
  border-radius: 0.5rem;
  position: relative;
  margin-bottom: 1rem;
}

.content-area:focus-within {
  border: solid 2px var(--v-focus-ring-color, #007bff);
}

textarea {
  width: 100%;
  border: none;
  min-height: 20rem;
  padding: 0.5rem;
  font-size: 1.2rem;
  margin-bottom: 0;
  font-weight: 600;
  resize: vertical;
  font-family: inherit;
  outline: none; /* Removes the focus outline */
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
  color: #c0392b;
}

.media-poll-controls {
  bottom: 0.2rem;
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