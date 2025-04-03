<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close-modal'): void;
}>();

const modalRef = ref<HTMLElement | null>(null);

const previousActiveElement = ref<HTMLElement | null>(null);

function handleClose() {
  emit('close-modal');
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.isOpen) {
    handleClose();
  }
}

function getFocusableElements(): HTMLElement[] {
  if (!modalRef.value) return [];
  
  return Array.from(
    modalRef.value.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ) as HTMLElement[];
}

function handleModalKeydown(event: KeyboardEvent) {
  if (!modalRef.value) return;
  
  const focusableElements = getFocusableElements();
  if (focusableElements.length === 0) return;

  const firstFocusableElement = focusableElements[0];
  const lastFocusableElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement as HTMLElement;

  // Handle Tab key
  if (event.key === 'Tab') {
    if (event.shiftKey) {
      // Backward tab
      if (activeElement === firstFocusableElement) {
        event.preventDefault();
        lastFocusableElement.focus();
      }
    } else {
      // Forward tab
      if (activeElement === lastFocusableElement) {
        event.preventDefault();
        firstFocusableElement.focus();
      }
    }
  }
}

function setupFocusTrap() {
  previousActiveElement.value = document.activeElement as HTMLElement;
  
  // Focus the first focusable element
  const focusableElements = getFocusableElements();
  if (focusableElements.length > 0) {
    focusableElements[0].focus();
  } else {
    modalRef.value?.focus();
  }

  // Add keydown handler
  modalRef.value?.addEventListener('keydown', handleModalKeydown);
}

function removeFocusTrap() {
  modalRef.value?.removeEventListener('keydown', handleModalKeydown);
  previousActiveElement.value?.focus();
}

// Focus management
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  if (props.isOpen) {
    nextTick(() => {
      setupFocusTrap();
    });
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  removeFocusTrap();
});

// Watch for isOpen changes to manage focus
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    nextTick(() => {
      setupFocusTrap();
    });
  } else {
    removeFocusTrap();
  }
});
</script>

<template>
  <div v-if="isOpen" class="modal">
    <div class="modal-overlay" @click="handleClose"></div>
    <div 
      ref="modalRef"
      class="modal-content"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-label="Modal dialog"
    >
      <button class="close-button" @click="handleClose">&times;</button>
      <slot @close-child-modal="handleClose" />
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  background-color: white;
  padding: 2rem;
  border-radius: 1rem;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.close-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0.5rem;
  line-height: 1;
  border-radius: 50%;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    padding: 1.5rem;
  }
}
</style>