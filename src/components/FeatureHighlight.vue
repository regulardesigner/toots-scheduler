<script setup lang="ts">
import { useFeatureHighlight } from '@/composables/useFeatureHighlight';

const props = defineProps<{
  featureId: string;
}>();

const { isHighlighted } = useFeatureHighlight(props.featureId);
</script>

<template>
  <div
    class="feature-highlight"
    :class="{ 'is-highlighted': isHighlighted }"
  >
    <slot />
  </div>
</template>

<style scoped>
.feature-highlight {
  position: relative;
  transition: background-color 0.3s ease;
}

.is-highlighted {
  animation: highlight 3s ease-in-out;
}

@keyframes highlight {
  0% {
    background-color: #ffeb3b;
  }
  100% {
    background-color: transparent;
  }
}
</style> 