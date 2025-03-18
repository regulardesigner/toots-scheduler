import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FeatureGroup, UserFeatureState } from '../types/features';

const STORAGE_KEY = 'masto-publish-later-features';

export const useFeaturesStore = defineStore('features', () => {
  const features = ref<FeatureGroup[]>([
    {
      version: '0.6.7',
      date: '2024-03-19',
      features: [
        {
          id: 'edit-scheduled-toots',
          title: '🔄 Edit scheduled toots',
          description: 'Made a typo? No problem! Now you can edit your scheduled toots!',
        },
      ],
    },
    {
      version: '0.5.7',
      date: '2024-03-18',
      features: [
        {
          id: 'whats-new',
          title: '👋 Say hello to What\'s new?',
          description: 'Now you can discover (here) the latest features and updates in the app!',
        },
        {
          id: 'bugs-fixes-0.5.7',
          title: '🐛 Bugs fixes',
          description: 'Yep, I\'ve improved the app and fixed some bugs!',
        },
      ],
    },
    {
      version: '0.4.4',
      date: '2024-03-16',
      features: [
        {
          id: 'timout-session',
          title: '🏴‍☠️ Auto logout session',
          description: 'Safety first! If you leave the page open for too long, you will be logged out automatically.',
        },
      ],
    },
    {
      version: '0.3.4',
      date: '2024-03-14',
      features: [
        {
          id: 'minimun-scheduling-time',
          title: '🐘 Minimum toot scheduling time & Bugs fixes',
          description: 'Mastodon doesn\'t allow you to plan a toot less than 5 minutes later, so I\'ve made sure that\'s no longer possible.',
        },
        {
          id: 'bugs-fixes-0.3.4',
          title: '🐛 Bugs fixes',
          description: 'I\'ve fixed some bugs.',
        },
      ],
    },
    {
      version: '0.2.2',
      date: '2024-03-13',
      features: [
        {
          id: 'hashtag-tootsSheduler',
          title: '🔖 Hashtag Toots Scheduler',
          description: 'Let\'s spread the word! Now all scheduled toots will be tagged with #TootScheduler!',
        },
      ],
    },
    {
      version: '0.1.2',
      date: '2024-03-12',
      features: [
        {
          id: 'schedule-posts',
          title: '🕒 Schedule Posts',
          description: 'Welcome to Toots Scheduler! You can schedule your posts to be published at a specific time!',
        },
        {
          id: 'bugs-fixes-0.1.2',
          title: '🐛 Bugs fixes',
          description: 'I\'ve fixed some bugs.',
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

  // Get last 3 new features
  const lastThreeNewFeatures = computed(() => {
    return newFeatures.value.slice(0, 3);
  });

  // Mark features as seen
  function markFeaturesAsSeen() {
    userState.value.seenFeatures = features.value.map((group: FeatureGroup) => group.version);
    userState.value.lastSeenVersion = latestVersion.value;
    saveState();
  }

  // Initialize store
  loadState();

  return {
    features,
    newFeatures: lastThreeNewFeatures,
    markFeaturesAsSeen,
  };
}); 