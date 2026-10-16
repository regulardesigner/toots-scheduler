<script setup lang="ts">
/** Line paths for each direction, drawn in a 24×24 box. */
const PATHS = {
  left: 'M19 12H5M12 19l-7-7 7-7',
  right: 'M5 12h14M12 5l7 7-7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
} as const;

withDefaults(defineProps<{
  direction: keyof typeof PATHS;
  /** Width and height, in pixels. */
  size?: number;
}>(), {
  size: 18,
});
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    aria-hidden="true"
  >
    <path
      :d="PATHS[direction]"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
