import { ref, onMounted, onUnmounted } from 'vue';
import { useFeaturesStore } from '@/stores/features';

export function useFeatureHighlight(featureId: string) {
  const featuresStore = useFeaturesStore();
  const isHighlighted = ref(false);
  let highlightTimeout: number | null = null;

  const highlight = () => {
    if (featuresStore.isFeatureNew(featureId)) {
      isHighlighted.value = true;
      
      // Remove highlight after 3 seconds
      highlightTimeout = window.setTimeout(() => {
        isHighlighted.value = false;
      }, 3000);
    }
  };

  onMounted(() => {
    highlight();
  });

  onUnmounted(() => {
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }
  });

  return {
    isHighlighted,
  };
} 