<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean;
  spoilerText: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:spoilerText', value: string): void;
}>();
</script>

<template>
  <div class="content-warning">
    <div class="form-group">
      <label for="sensitive-toggle" class="warning-label">
        <input
          type="checkbox"
          :checked="modelValue"
          @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
          id="sensitive-toggle"
        />
        Add content warning
      </label>
      <div class="warning-input-wrapper" v-show="modelValue">
        <input
          type="text"
          :value="spoilerText"
          @input="emit('update:spoilerText', ($event.target as HTMLInputElement).value)"
          placeholder="Write your warning here"
          id="spoiler-text"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  margin-right: 0.5rem;
  cursor: pointer;
}

.warning-input-wrapper {
  transition: all 0.2s ease-in-out;
  overflow: hidden;
  opacity: 1;
  max-height: 40px;
}

.warning-input-wrapper input {
  padding: 0.5rem;
  border-radius: 0.3rem;
  border: 1px solid #ccc;
  width: 100%;
}

.warning-input-wrapper[style*="display: none"] {
  opacity: 0;
  max-height: 0;
}

input[type="text"]:disabled {
  background-color: #f0f0f0;
  cursor: not-allowed;
}
</style> 