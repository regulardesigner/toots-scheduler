<script setup lang="ts">
defineProps<{
  message: string;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();
</script>

<template>
  <div class="thanks-confirm">
    <h2 class="thanks-title">
      Send a thank-you?
    </h2>
    <p class="thanks-description">
      This sends the following direct message from your account to the app's author. Only they will see it, including your name and the time below:
    </p>
    <blockquote class="thanks-preview">
      {{ message }}
    </blockquote>
    <div class="thanks-actions">
      <button
        class="btn-cancel"
        type="button"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        class="btn-send"
        type="button"
        @click="emit('confirm')"
      >
        Send
      </button>
    </div>
  </div>
</template>

<style scoped>
.thanks-confirm {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.thanks-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #333;
  margin: 0;
  padding-right: 2rem; /* avoid overlap with ModalView close button */
}

.thanks-description {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
}

.thanks-preview {
  margin: 0;
  padding: 0.75rem 1rem;
  background-color: #f8f8f8;
  border-left: 3px solid #ccc;
  border-radius: 0 4px 4px 0;
  font-size: 0.9rem;
  color: #333;
  white-space: pre-line;
}

.thanks-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn-cancel,
.btn-send {
  flex: 1;
  padding: 0.8rem 1rem;
  border: none;
  border-radius: 3rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.btn-cancel {
  background-color: #95a5a6;
  color: white;
}

.btn-cancel:hover {
  background-color: #7f8c8d;
}

.btn-send {
  background-color: #333;
  color: white;
}

.btn-send:hover {
  background-color: #222;
}
</style>
