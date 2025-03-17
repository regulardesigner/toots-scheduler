import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Feature, FeatureGroup, UserFeatureState } from '@/types/features';

const STORAGE_KEY = 'masto-publish-later-features';

export const useFeaturesStore = defineStore('features', () => {
  const features = ref<FeatureGroup[]>([
    {
      version: '1.2.0',
      date: '2024-03-18',
      features: [
        {
          id: 'multi-account-support',
          title: '🤘 Multi-Account Support',
          description: 'You can now schedule toots for multiple accounts!',
          elementId: 'multi-account-button',
        },
        {
          id: 'edit-scheduled-toots',
          title: '🖊️ Edit Scheduled Toots',
          description: 'Made a typo? You can now edit your scheduled toots!',
          elementId: 'edit-button',
        },
      ],
    },
    {
      version: '1.1.0',
      date: '2024-03-17',
      features: [
        {
          id: 'schedule-posts',
          title: '🕒 Schedule Posts',
          description: 'You can now schedule your posts to be published at a specific time!',
          elementId: 'schedule-button',
        },
        {
          id: 'delete-scheduled-toots',
          title: '🗑️ Delete Scheduled Toots',
          description: 'You can now delete your scheduled toots!',
          elementId: 'delete-button',
        },
      ],
    },
  ]);

  // Get the latest version from features
  const latestVersion = computed(() => {
    return features.value[0]?.version || '1.0.0';
  });

  const userState = ref<UserFeatureState>({
    lastSeenVersion: '',
    seenFeatures: [],
  });

  // Load state from localStorage
  function loadState() {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      userState.value = JSON.parse(savedState);
    }
  }

  // Save state to localStorage
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userState.value));
  }

  // Get new features that haven't been seen
  const newFeatures = computed(() => {
    return features.value.filter(
      (group: FeatureGroup) => !userState.value.seenFeatures.includes(group.version)
    );
  });

  // Mark features as seen
  function markFeaturesAsSeen() {
    userState.value.seenFeatures = features.value.map((group: FeatureGroup) => group.version);
    userState.value.lastSeenVersion = latestVersion.value;
    saveState();
  }

  // Check if a specific feature is new
  function isFeatureNew(featureId: string): boolean {
    return !userState.value.seenFeatures.includes(featureId);
  }

  // Initialize store
  loadState();

  return {
    features,
    newFeatures,
    isFeatureNew,
    markFeaturesAsSeen,
  };
}); 