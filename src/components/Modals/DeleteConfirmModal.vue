<script setup lang="ts">
defineProps<{
  tootPreview: string;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();
</script>

<template>
  <div class="delete-confirm">
    <h2 class="delete-title">Delete scheduled toot?</h2>
    <p class="delete-description">This action cannot be undone.</p>
    <blockquote v-if="tootPreview" class="toot-preview">
      {{ tootPreview }}
    </blockquote>
    <div class="delete-actions">
      <button class="btn-cancel" type="button" @click="emit('cancel')">
        Cancel
      </button>
      <button class="btn-delete" type="button" @click="emit('confirm')">
        Delete
      </button>
    </div>
  </div>
</template>

<style scoped>
.delete-confirm {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.delete-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #333;
  margin: 0;
  padding-right: 2rem; /* avoid overlap with ModalView close button */
}

.delete-description {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
}

.toot-preview {
  margin: 0;
  padding: 0.75rem 1rem;
  background-color: #f8f8f8;
  border-left: 3px solid #ccc;
  border-radius: 0 4px 4px 0;
  font-size: 0.9rem;
  color: #333;
  white-space: pre-line;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.delete-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn-cancel,
.btn-delete {
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
  background-color: #333;
  color: white;
}

.btn-cancel:hover {
  background-color: #222;
}

.btn-delete {
  background-color: #e74c3c;
  color: white;
}

.btn-delete:hover {
  background-color: #c0392b;
}

@media (max-width: 768px) {
  .delete-actions {
    flex-direction: column;
  }
}
</style>
